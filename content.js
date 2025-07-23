// content.js
let currentShortcut = null;

// 解析快捷键字符串为对象
function parseShortcut(shortcut) {
    if (!shortcut) return null;
    const parts = shortcut.split('+').map(p => p.trim());
    return {
        ctrlKey: parts.includes('Ctrl'),
        altKey: parts.includes('Alt'),
        shiftKey: parts.includes('Shift'),
        metaKey: parts.includes('Command') || parts.includes('Meta'),
        key: parts[parts.length - 1].toLowerCase()
    };
}

// 加载保存的快捷键
function loadShortcut() {
    chrome.storage.sync.get('customShortcut', function(data) {
        if (data.customShortcut) {
            currentShortcut = parseShortcut(data.customShortcut);
        }
    });
}

// 切换视频播放状态
function togglePlayback() {
    const videoElement = document.querySelector('video');
    if (videoElement) {
        videoElement.paused ? videoElement.play() : videoElement.pause();
        return true;
    }
    return false;
}

// 初始化加载快捷键
loadShortcut();

// 监听快捷键更新消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'shortcutUpdated') {
        currentShortcut = parseShortcut(request.shortcut);
        sendResponse({ status: 'success' });
    } else if (request.action === 'toggle-playback') {
        const success = togglePlayback();
        sendResponse({ success: success });
    }
    return true;
});

// 快捷键按键监听
document.addEventListener('keydown', function(e) {
    // 忽略输入框中的按键
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        return;
    }

    if (!currentShortcut) return;

    // 检查修饰键
    if (e.ctrlKey !== currentShortcut.ctrlKey) return;
    if (e.altKey !== currentShortcut.altKey) return;
    if (e.shiftKey !== currentShortcut.shiftKey) return;
    if (e.metaKey !== currentShortcut.metaKey) return;

    // 检查主键
    if (e.key.toLowerCase() !== currentShortcut.key) return;

    // 触发播放/暂停
    e.preventDefault();
    e.stopPropagation();
    togglePlayback();
});

// 初始化时发送状态更新
chrome.runtime.sendMessage({
  action: 'updateStatus',
  message: '内容脚本已加载'
});