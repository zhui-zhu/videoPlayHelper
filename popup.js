document.addEventListener('DOMContentLoaded', function() {
  // 安全获取元素并设置文本内容
  function setElementText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = text;
    } else {
      console.error(`Element with id ${elementId} not found`);
    }
  }
  
  // 测试快捷键配置
  function testShortcutConfig() {
    chrome.commands.getAll(function(commands) {
      const toggleCommand = commands.find(cmd => cmd.name === 'toggle-playback');
      
      if (toggleCommand) {
        console.log('快捷键配置:', toggleCommand.shortcut);
        setElementText('shortcut-info', `当前快捷键: ${toggleCommand.shortcut}`);
      } else {
        console.error('未找到toggle-playback命令配置');
        setElementText('shortcut-info', '快捷键配置错误');
      }
    });
  }
  
  // 尝试连接到后台脚本
  function connectToBackground() {
    return new Promise((resolve, reject) => {
      try {
        const connection = chrome.runtime.connect({ name: 'popup' });
        
        connection.onMessage.addListener(function(message) {
          if (message.action === 'updateStatus') {
            setElementText('status', message.message);
          }
        });
        
        connection.onDisconnect.addListener(function() {
          console.error('与后台脚本的连接断开');
          setElementText('status', '与扩展的连接已断开');
          // 重置连接状态
          popupConnection = null;
          reject(new Error('与后台脚本的连接断开'));
        });
        
        resolve(connection);
      } catch (error) {
        console.error('创建连接失败:', error);
        setElementText('status', '无法连接到扩展');
        reject(error);
      }
    });
  }
  
  // 获取初始状态
  function getInitialStatus() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'getDebugInfo' }, function(response) {
        if (chrome.runtime.lastError) {
          console.error('获取调试信息失败:', chrome.runtime.lastError);
          setElementText('status', '无法获取扩展状态');
          reject(chrome.runtime.lastError);
          return;
        }
        
        if (response && response.status === 'connected') {
          setElementText('status', `已连接到B站视频 (标签ID: ${response.bilibiliTabId})`);
        } else {
          setElementText('status', '未找到B站视频页面');
        }
        
        resolve(response);
      });
    });
  }
  
  // 初始化
  async function initialize() {
    try {
      // 确保DOM完全加载后再访问元素
      testShortcutConfig();
      
      // 并行执行连接和获取状态
      const [connection, status] = await Promise.allSettled([
        connectToBackground(),
        getInitialStatus()
      ]);
      
      if (connection.status === 'rejected') {
        console.error('连接失败:', connection.reason);
      } else {
        // 保存连接引用
        popupConnection = connection.value;
      }
      
      if (status.status === 'rejected') {
        console.error('获取状态失败:', status.reason);
      }
    } catch (error) {
      console.error('初始化失败:', error);
      setElementText('status', '扩展初始化失败');
    }
  }
  
  // 切换视频播放状态
  document.getElementById('toggleButton').addEventListener('click', function() {
    chrome.runtime.sendMessage({ action: 'toggle-playback' }, function(response) {
      if (chrome.runtime.lastError) {
        console.error('发送命令失败:', chrome.runtime.lastError);
        setElementText('status', '无法发送命令');
        
        // 尝试重新连接
        initialize();
      } else if (response && response.status === 'success') {
        setElementText('status', '命令已发送');
      }
    });
  });
  
  // 监听来自后台的状态更新
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'updateStatus') {
      setElementText('status', request.message);
    }
  });
  
  // 存储连接引用的全局变量
  let popupConnection = null;
  
  // 启动初始化
  initialize();
});    