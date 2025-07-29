// 存储B站视频标签ID
let bilibiliTabId = null;
let debugMode = true; // 启用调试模式
let popupConnection = null; // 存储与弹出窗口的连接

// 初始化 - 查找B站视频标签
function findBilibiliTabs() {
  // 尝试多种可能的B站视频URL模式
  const urlPatterns = [
    'https://*.bilibili.com/video/*',
    'https://*.bilibili.com/bangumi/play/*',
    'https://bilibili.com/video/*',
    'https://bilibili.com/bangumi/play/*'
  ];
  
  let allTabs = [];
  
  // 依次查询每种URL模式的标签
  const queryNextPattern = (index) => {
    if (index >= urlPatterns.length) {
      // 所有模式查询完成
      processFoundTabs(allTabs);
      return;
    }
    
    chrome.tabs.query({ url: urlPatterns[index] }, function(tabs) {
      if (debugMode) console.log(`找到 ${tabs.length} 个匹配 ${urlPatterns[index]} 的标签`);
      allTabs = allTabs.concat(tabs);
      queryNextPattern(index + 1);
    });
  };
  
  queryNextPattern(0);
}

// 处理找到的标签
function processFoundTabs(tabs) {
  if (tabs.length > 0) {
    // 检查所有标签，而不只是第一个
    checkTabsForVideo(tabs);
  } else {
    bilibiliTabId = null;
    updatePopupStatus('未找到打开的B站视频页面');
    if (debugMode) console.log('未找到B站视频页面');
  }
}

// 检查所有标签中是否有视频元素
function checkTabsForVideo(tabs) {
  let processedCount = 0;
  let foundVideo = false;
  
  // 检查每个标签
  tabs.forEach(tab => {
    // 先验证标签是否存在
    chrome.tabs.get(tab.id, function(currentTab) {
      if (chrome.runtime.lastError) {
        console.error('标签不存在:', chrome.runtime.lastError.message);
        processedCount++;
        
        // 所有标签都处理完毕但未找到视频
        if (processedCount === tabs.length && !foundVideo) {
          bilibiliTabId = null;
          updatePopupStatus('找到B站页面，但无法检测视频元素');
          if (debugMode) console.log('找到B站页面，但无法检测视频元素');
        }
        return;
      }
      
      // 标签存在，执行脚本
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // 更精确地检查B站视频播放器
          const video = document.querySelector('video');
          if (!video) return false;
          
          // 检查视频是否可见且非广告
          const isVisible = video.offsetParent !== null;
          const isAd = video.closest('.bpx-player-ad-wrap') !== null;
          
          return isVisible && !isAd;
        }
      }).then(results => {
        processedCount++;
        
        if (results && results[0] && results[0].result && !foundVideo) {
          // 找到合适的视频标签
          foundVideo = true;
          bilibiliTabId = tab.id;
          updatePopupStatus(`已连接到B站视频页面 (${tabs.length}个可用)`);
          if (debugMode) console.log('已连接到标签:', bilibiliTabId);
        }
        
        // 所有标签都处理完毕但未找到视频
        if (processedCount === tabs.length && !foundVideo) {
          bilibiliTabId = null;
          updatePopupStatus('找到B站页面，但未检测到有效视频元素');
          if (debugMode) console.log('找到B站页面，但未检测到有效视频元素');
        }
      }).catch(error => {
        processedCount++;
        console.error('检查视频元素失败:', error);
        
        // 所有标签都处理完毕但未找到视频
        if (processedCount === tabs.length && !foundVideo) {
          bilibiliTabId = null;
          updatePopupStatus('找到B站页面，但无法检测视频元素');
          if (debugMode) console.log('找到B站页面，但无法检测视频元素');
        }
      });
    });
  });
}

// 向弹出页面发送状态更新
function updatePopupStatus(message) {
  // 使用持久连接而非一次性消息
  if (popupConnection) {
    try {
      popupConnection.postMessage({ action: 'updateStatus', message: message });
    } catch (error) {
      if (debugMode) console.error('通过连接发送状态更新失败:', error);
      // 重置连接
      popupConnection = null;
      
      // 尝试一次性消息
      try {
        chrome.runtime.sendMessage({ action: 'updateStatus', message: message });
      } catch (error) {
        if (debugMode) console.error('发送状态更新失败:', error);
      }
    }
  } else {
    // 如果没有连接，尝试发送一次性消息
    try {
      chrome.runtime.sendMessage({ action: 'updateStatus', message: message });
    } catch (error) {
      if (debugMode) console.error('发送状态更新失败:', error);
    }
  }
}

// 监听弹出页面连接
chrome.runtime.onConnect.addListener(function(port) {
  if (port.name === 'popup') {
    popupConnection = port;
    
    // 监听连接断开
    port.onDisconnect.addListener(function() {
      if (debugMode) console.log('弹出窗口连接已断开');
      popupConnection = null;
    });
    
    // 监听来自弹出窗口的消息
    port.onMessage.addListener(function(message) {
      if (message.action === 'toggle-playback') {
        toggleVideoPlayback();
      } else if (message.action === 'getDebugInfo') {
        port.postMessage({
          bilibiliTabId: bilibiliTabId,
          lastUpdated: new Date().toISOString(),
          status: bilibiliTabId ? 'connected' : 'disconnected'
        });
      }
    });
  }
});

// 监听快捷键命令
chrome.commands.onCommand.addListener(function(command) {
  if (debugMode) console.log('收到命令:', command);
  
  if (command === 'toggle-playback') {
    if (debugMode) console.log('执行播放/暂停切换');
    toggleVideoPlayback();
  } else if (command === 'rewind') {
    if (debugMode) console.log('执行快退10秒');
    rewindVideo();
  } else if (command === 'fast-forward') {
    if (debugMode) console.log('执行快进10秒');
    fastForwardVideo();
  }
});

// 监听弹出页面消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'toggle-playback') {
    toggleVideoPlayback();
    sendResponse({ status: 'success' });
  } else if (request.action === 'updateShortcut') {
    // 存储新的快捷键
    chrome.storage.sync.set({ customShortcut: request.shortcut }, function() {
        console.log('快捷键已更新为:', request.shortcut);
        // 通知所有内容脚本更新快捷键
        chrome.tabs.query({}, function(tabs) {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'shortcutUpdated',
                    shortcut: request.shortcut
                }, function(response) {
                    // 忽略没有内容脚本的标签页的错误
                    if (chrome.runtime.lastError) return;
                });
            });
        });
        sendResponse({ status: 'success' });
    });
    return true;
  } else if (request.action === 'updateStatus' && sender.tab) {
    // 处理内容脚本加载状态更新
    bilibiliTabId = sender.tab.id;
    updatePopupStatus('内容脚本已加载，已连接到视频页面');
    if (debugMode) console.log('内容脚本已在标签', sender.tab.id, '加载');
  } else if (request.action === 'getDebugInfo') {
    // 返回调试信息
    sendResponse({
      bilibiliTabId: bilibiliTabId,
      lastUpdated: new Date().toISOString(),
      status: bilibiliTabId ? 'connected' : 'disconnected'
    });
  }
});

// 发送播放/暂停命令到内容脚本
function sendToggleMessage() {
    try {
        chrome.tabs.sendMessage(bilibiliTabId, { action: 'toggle-playback' }, function(response) {
            if (chrome.runtime.lastError) {
                console.error('发送消息失败:', chrome.runtime.lastError);
                updatePopupStatus('无法控制视频 (内容脚本未加载)');
                return;
            }

            if (response && response.success) {
                updatePopupStatus('已发送播放/暂停命令');
            } else {
                updatePopupStatus('视频控制失败 (无响应)');
            }
        });
    } catch (error) {
        console.error('切换播放状态失败:', error);
        updatePopupStatus('视频控制发生错误');
    }
}

// 快退视频10秒
function rewindVideo() {
  findBilibiliTabs();
  if (bilibiliTabId) {
    chrome.scripting.executeScript({
      target: { tabId: bilibiliTabId },
      func: () => {
        const video = document.querySelector('video:not([class*="ad"])');
        if (video) {
          video.currentTime = Math.max(0, video.currentTime - 10);
        }
      }
    }).catch(error => {
      console.error('快退执行失败:', error);
    });
  } else {
    updatePopupStatus('没有找到可控制的视频标签');
  }
}

// 快进视频10秒
function fastForwardVideo() {
  findBilibiliTabs();
  if (bilibiliTabId) {
    chrome.scripting.executeScript({
      target: { tabId: bilibiliTabId },
      func: () => {
        const video = document.querySelector('video:not([class*="ad"])');
        if (video) {
          video.currentTime = Math.min(video.duration, video.currentTime + 10);
        }
      }
    }).catch(error => {
      console.error('快进执行失败:', error);
    });
  } else {
    updatePopupStatus('没有找到可控制的视频标签');
  }
}

// 切换视频播放状态
function toggleVideoPlayback() {
    if (!bilibiliTabId) {
        if (debugMode) console.log('没有找到有效的B站视频标签，尝试重新查找...');
        updatePopupStatus('未找到可控制的视频，正在重新查找...');
        findBilibiliTabs(); // 尝试重新查找B站视频标签
        
        // 短暂延迟后再次检查
        setTimeout(() => {
            if (!bilibiliTabId) {
                updatePopupStatus('未找到可控制的视频，请确保B站视频页面已打开');
                return;
            }
            sendToggleMessage();
        }, 1000);
        return;
    }
    sendToggleMessage();
}

// 监听标签更新事件
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete') {
    // 页面加载完成，检查是否是B站视频页面
    // 使用正则表达式匹配所有B站子域名的视频页面
      const bilibiliRegex = /^https:\/\/(.*\.)?bilibili\.com\/(video|bangumi\/play)\//;
      if (tab.url && bilibiliRegex.test(tab.url)) {
      if (debugMode) console.log('检测到B站页面加载完成:', tab.url);
      findBilibiliTabs();
    }
  }
});

// 监听标签关闭事件
chrome.tabs.onRemoved.addListener(function(tabId) {
  if (tabId === bilibiliTabId) {
    bilibiliTabId = null;
    updatePopupStatus('视频页面已关闭，正在等待新页面...');
    if (debugMode) console.log('标签已关闭:', tabId);
  }
});

// 初始化查找
findBilibiliTabs();

// 定期检查，确保连接状态
setInterval(findBilibiliTabs, 5000);