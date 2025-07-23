// content.js
// 监听来自后台脚本的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'togglePlayback') {
    try {
      // 查找B站视频元素
      const videoElement = document.querySelector('video');
      
      if (videoElement) {
        // 切换播放状态
        if (videoElement.paused) {
          videoElement.play();
        } else {
          videoElement.pause();
        }
        
        // 返回成功响应
        sendResponse({ success: true });
      } else {
        // 未找到视频元素
        console.error('未找到视频元素');
        sendResponse({ success: false, error: '未找到视频元素' });
      }
    } catch (error) {
      console.error('控制视频失败:', error);
      sendResponse({ success: false, error: error.message });
    }
    
    // 指示异步响应
    return true;
  }
});

// 初始化时发送状态更新
chrome.runtime.sendMessage({
  action: 'updateStatus',
  message: '内容脚本已加载'
});    