/**
 * Main Entry Point
 * 初始化应用
 */
(async function initApp() {
    console.log("%c Gemini Folder Plugin [V27.5 Final] ", "background: #cc00ff; color: #fff; font-size: 16px; padding: 4px; border-radius: 4px;");

    // 1. 初始化服务
    const storageService = new StorageService();
    const geminiAdapter = new GeminiAdapter();
    
    // 2. 初始化 UI (依赖 storage 和 gemini)
    const uiManager = new UIManager(storageService, geminiAdapter);

    // 3. 加载数据
    await storageService.load();

    // 4. 渲染 UI
    uiManager.init();
    uiManager.renderFolderList();

    // 5. 启动 Gemini 监听
    geminiAdapter.startMonitoring((info) => {
        // 直接将完整信息 (包含context) 传递给 UI 管理器
        uiManager.updateCurrentChatState(info);
    });

    console.log("Gemini Folder Plugin Initialized.");
})();