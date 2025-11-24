// ... 前面的 state 定义保持不变 ...
const STORAGE_KEY = 'gemini_folder_data_v2';
let state = {
    folders: [], 
    sidebarOpen: false,
    folderListExpanded: true
};

let currentFolderToAddChat = null; 
let selectedChatToAdd = null;
let currentFolderToEdit = null; 

// --- 初始化 ---
async function init() {
    console.log("Gemini Folder Plugin: Starting...");
    await loadData();
    injectSidebar();
    injectModals();
    injectMenuButton(); 
    
    // 启动监听器
    startObserver(); 
    
    console.log("Gemini Folder Plugin: Loaded!");
}

async function loadData() {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    if (data[STORAGE_KEY]) state.folders = data[STORAGE_KEY];
}

async function saveData() {
    await chrome.storage.local.set({ [STORAGE_KEY]: state.folders });
    renderSidebarList(); 
}

// --- DOM 注入 (保持不变) ---
function injectSidebar() {
    if (document.getElementById('gfp-sidebar')) return;
    const sidebar = document.createElement('div');
    sidebar.id = 'gfp-sidebar';
    sidebar.innerHTML = `
        <div class="gfp-sidebar-header">
            <button class="gfp-close-btn" title="Close">✕</button>
        </div>
        <div class="gfp-create-area">
            <div class="gfp-folder-icon-large">📁</div>
            <button class="gfp-btn-primary" id="gfp-btn-add-folder">Add Folder</button>
        </div>
        <div class="gfp-list-header">
            <span>Folder List</span>
            <span class="gfp-toggle-all" id="gfp-toggle-list">▼</span>
        </div>
        <input type="text" class="gfp-search-input" id="gfp-search-folders" placeholder="Search folders...">
        <div id="gfp-folder-container"></div>
    `;
    document.body.appendChild(sidebar);
    sidebar.querySelector('.gfp-close-btn').onclick = toggleSidebar;
    document.getElementById('gfp-btn-add-folder').onclick = () => openModal('add-folder');
    document.getElementById('gfp-toggle-list').onclick = toggleFolderList;
    document.getElementById('gfp-search-folders').oninput = (e) => renderSidebarList(e.target.value);
    renderSidebarList();
}

function injectMenuButton() {
    if (document.getElementById('gfp-menu-btn')) return;
    const btn = document.createElement('div');
    btn.id = 'gfp-menu-btn';
    btn.innerHTML = '<span>📁</span> <span>My Folders</span>';
    btn.onclick = toggleSidebar;
    document.body.appendChild(btn);
}

// --- 模态框注入 (保持不变) ---
function injectModals() {
    if (document.getElementById('modal-create-folder')) return;
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = `
        <!-- 1. 新建文件夹 -->
        <div id="modal-create-folder" class="gfp-modal-overlay">
            <div class="gfp-modal">
                <div class="gfp-modal-title">Add New Folder</div>
                <div class="gfp-input-group">
                    <span class="gfp-input-hint">Enter Folder Name</span>
                    <span class="gfp-char-limit"><span id="gfp-char-count">0</span>/30</span>
                    <input type="text" class="gfp-search-input" id="gfp-input-foldername" maxlength="30">
                </div>
                <div class="gfp-modal-actions">
                    <button class="gfp-btn gfp-btn-cancel" onclick="closeAllModals()">Cancel</button>
                    <button class="gfp-btn gfp-btn-confirm" id="gfp-confirm-create">Add</button>
                </div>
            </div>
        </div>

        <!-- 2. 文件夹设置 -->
        <div id="modal-settings-folder" class="gfp-modal-overlay">
            <div class="gfp-modal">
                <div class="gfp-modal-title">Folder Settings</div>
                <div class="gfp-input-group">
                    <span class="gfp-input-hint">Rename Folder</span>
                    <input type="text" class="gfp-search-input" id="gfp-input-rename">
                </div>
                <div class="gfp-modal-actions" style="justify-content: space-between;">
                    <button class="gfp-btn gfp-btn-delete" id="gfp-btn-delete-req">Delete Folder</button>
                    <div style="display:flex; gap:8px;">
                        <button class="gfp-btn gfp-btn-cancel" onclick="closeAllModals()">Cancel</button>
                        <button class="gfp-btn gfp-btn-confirm" id="gfp-confirm-rename">Save</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- 3. 添加对话到文件夹 -->
        <div id="modal-add-chat-to-folder" class="gfp-modal-overlay">
            <div class="gfp-modal">
                <div class="gfp-modal-title">Add to Folder</div>
                <input type="text" class="gfp-search-input" id="gfp-search-chat-list" placeholder="Search recent chats...">
                <div class="gfp-select-list" id="gfp-chat-select-container">
                    <!-- 动态生成 -->
                </div>
                <div class="gfp-modal-actions">
                    <button class="gfp-btn gfp-btn-cancel" onclick="closeAllModals()">Cancel</button>
                    <button class="gfp-btn gfp-btn-confirm" id="gfp-confirm-add-chat-final">Add</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modalContainer);

    document.getElementById('gfp-input-foldername').addEventListener('input', function() { document.getElementById('gfp-char-count').innerText = this.value.length; });
    document.getElementById('gfp-confirm-create').onclick = createNewFolder;
    document.getElementById('gfp-confirm-rename').onclick = saveFolderRename;
    document.getElementById('gfp-btn-delete-req').onclick = () => { if(confirm('Are you sure?')) deleteFolder(); };
    document.getElementById('gfp-search-chat-list').addEventListener('input', (e) => { renderChatSelectionList(e.target.value); });
    document.getElementById('gfp-confirm-add-chat-final').onclick = confirmAddChatToFolder;
    window.closeAllModals = () => { document.querySelectorAll('.gfp-modal-overlay').forEach(el => el.classList.remove('active')); };
}

// === 核心修改：智能识别对话链接 ===
function getRecentChatsFromDOM() {
    console.log("Debug: Scanning DOM for REAL chats...");

    // 1. 尝试缩小范围：只在导航栏(nav)里找，如果找不到导航栏，再全屏找
    let rootElement = document.querySelector('nav') || document.body;
    
    // 2. 抓取所有包含 /app/ 的链接
    const allLinks = Array.from(rootElement.querySelectorAll('a[href*="/app/"]'));
    
    const chats = [];
    const seenUrls = new Set();
    
    // 3. 定义黑名单关键词 (必须屏蔽的内容)
    const blacklist = [
        'google', 'account', 'sign out', 'setting', 'upgrade', 'help', 'faq', 'activity', 
        'manager', 'gemini advanced', '@', '账号', '设置', '帮助', '退出'
    ];

    // 4. 定义正则：真正的对话 ID 通常是比较长的字母数字组合
    // 例如: /app/8a7f9d... 或者 /app/abc12345
    // 而不是简单的 /app/ 或 /app/settings
    const chatIdRegex = /\/app\/[a-zA-Z0-9]{8,}/; 

    allLinks.forEach(link => {
        const url = link.href;
        
        // --- 过滤阶段 1: 黑名单检查 (检查 URL 和 文本) ---
        // 获取链接所有可能的文本内容 (包括 aria-label, title, innerText)
        const fullText = (link.innerText + ' ' + (link.getAttribute('aria-label')||'') + ' ' + (link.title||'')).toLowerCase();
        
        // 如果包含黑名单词，直接跳过 (比如你的账号包含 @, 包含 "google 账号")
        if (blacklist.some(word => fullText.includes(word))) return;

        // --- 过滤阶段 2: URL 结构检查 ---
        // 必须符合对话 ID 的格式 (长度大于8的ID)
        if (!chatIdRegex.test(url)) return;
        
        // --- 去重 ---
        if (seenUrls.has(url)) return;
        seenUrls.add(url);

        // --- 提取标题 ---
        // Gemini 的对话标题通常包裹在特定的 class 里面，但也可能是直接的 text
        // 我们取一段看起来最像标题的文本
        let title = link.getAttribute('aria-label') || link.innerText;
        
        // 清洗标题: 去掉换行、多余空格
        title = title.replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();
        
        // 再次检查标题是否是 "Untitled" 或者太短
        if (!title || title.length < 1) title = "Chat " + chats.length;

        chats.push({ title, url });
    });

    console.log(`Debug: Found ${chats.length} real chats.`);
    return chats;
}

// --- 渲染侧边栏 (保持不变) ---
function renderSidebarList(filterText = '') {
    const container = document.getElementById('gfp-folder-container');
    const toggleIcon = document.getElementById('gfp-toggle-list');
    
    if (!state.folderListExpanded && !filterText) {
        container.style.display = 'none';
        toggleIcon.innerText = '▶';
        return;
    } else {
        container.style.display = 'block';
        toggleIcon.innerText = '▼';
    }
    
    container.innerHTML = '';
    
    state.folders.forEach(folder => {
        if (filterText && !folder.name.toLowerCase().includes(filterText.toLowerCase())) return;

        const el = document.createElement('div');
        el.className = 'gfp-folder-item';
        el.innerHTML = `
            <div class="gfp-folder-header">
                <span class="gfp-folder-arrow">▶</span>
                <span class="gfp-folder-name">${folder.name}</span>
                <div class="gfp-folder-actions">
                    <span class="gfp-action-btn gfp-btn-add-chat" title="Add Chat to this Folder">➕</span>
                    <span class="gfp-action-btn gfp-btn-settings" title="Settings">⚙️</span>
                </div>
            </div>
            <div class="gfp-chat-list">
                ${folder.chats.map(chat => `
                    <a href="${chat.url}" class="gfp-chat-link" target="_self">• ${chat.title}</a>
                `).join('')}
            </div>
        `;

        const header = el.querySelector('.gfp-folder-header');
        const arrow = el.querySelector('.gfp-folder-arrow');
        const list = el.querySelector('.gfp-chat-list');
        const addBtn = el.querySelector('.gfp-btn-add-chat');
        const settingsBtn = el.querySelector('.gfp-btn-settings');

        header.onclick = (e) => {
            if (e.target.closest('.gfp-action-btn')) return;
            const isVisible = list.classList.toggle('show');
            arrow.classList.toggle('expanded', isVisible);
            arrow.innerText = isVisible ? '▼' : '▶';
        };

        addBtn.onclick = () => {
            currentFolderToAddChat = folder; 
            openModal('add-chat-to-folder');
        };

        settingsBtn.onclick = () => {
            currentFolderToEdit = folder;
            openModal('settings');
        };

        container.appendChild(el);
    });
}

// --- 渲染模态框里的“对话选择列表” ---
function renderChatSelectionList(filter = '') {
    const container = document.getElementById('gfp-chat-select-container');
    container.innerHTML = '';
    selectedChatToAdd = null; 

    // 获取数据
    const chats = getRecentChatsFromDOM();
    
    // 过滤
    const filteredChats = chats.filter(c => !filter || c.title.toLowerCase().includes(filter.toLowerCase()));

    if (filteredChats.length === 0) {
        container.innerHTML = '<div style="padding:10px;color:#888;text-align:center">No chats found.<br><small>Try expanding your sidebar or scrolling down to load more chats.</small></div>';
        return;
    }

    filteredChats.forEach(chat => {
        const item = document.createElement('div');
        item.className = 'gfp-select-item';
        item.innerHTML = `<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${chat.title}</span>`;
        item.title = chat.title; 
        
        item.onclick = () => {
            document.querySelectorAll('.gfp-select-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            selectedChatToAdd = chat;
        };
        container.appendChild(item);
    });
}

// --- 模态框打开逻辑 (保持不变) ---
function openModal(type) {
    closeAllModals();
    if (type === 'add-folder') {
        document.getElementById('modal-create-folder').classList.add('active');
        document.getElementById('gfp-input-foldername').value = '';
        document.getElementById('gfp-char-count').innerText = '0';
    } else if (type === 'settings') {
        document.getElementById('modal-settings-folder').classList.add('active');
        document.getElementById('gfp-input-rename').value = currentFolderToEdit.name;
    } else if (type === 'add-chat-to-folder') {
        document.getElementById('modal-add-chat-to-folder').classList.add('active');
        document.getElementById('gfp-search-chat-list').value = '';
        renderChatSelectionList(); 
    }
}

// --- 确认添加对话逻辑 (保持不变) ---
function confirmAddChatToFolder() {
    if (!selectedChatToAdd) {
        alert("Please select a chat from the list first.");
        return;
    }
    if (!currentFolderToAddChat) return;

    const folder = state.folders.find(f => f.id === currentFolderToAddChat.id);
    if (folder) {
        const exists = folder.chats.some(c => c.url === selectedChatToAdd.url);
        if (!exists) {
            folder.chats.push(selectedChatToAdd);
            saveData();
        } else {
            alert("This chat is already in the folder.");
        }
    }
    closeAllModals();
}

// --- 简化的 Observer ---
function startObserver() {
    const observer = new MutationObserver((mutations) => {
        injectMenuButton(); 
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

// ... 辅助函数 (保持不变) ...
function createNewFolder() {
    const nameInput = document.getElementById('gfp-input-foldername');
    const name = nameInput.value.trim();
    if (!name) return;
    state.folders.push({ id: Date.now(), name: name, chats: [] });
    saveData();
    closeAllModals();
}

function saveFolderRename() {
    const newName = document.getElementById('gfp-input-rename').value.trim();
    if (!newName || !currentFolderToEdit) return;
    const folder = state.folders.find(f => f.id === currentFolderToEdit.id);
    if (folder) { folder.name = newName; saveData(); }
    closeAllModals();
}

function deleteFolder() {
    if (!currentFolderToEdit) return;
    state.folders = state.folders.filter(f => f.id !== currentFolderToEdit.id);
    saveData();
    closeAllModals();
}

function toggleSidebar() {
    state.sidebarOpen = !state.sidebarOpen;
    const sidebar = document.getElementById('gfp-sidebar');
    if (state.sidebarOpen) sidebar.classList.add('open');
    else sidebar.classList.remove('open');
}

function toggleFolderList() {
    state.folderListExpanded = !state.folderListExpanded;
    renderSidebarList(document.getElementById('gfp-search-folders').value);
}

// 启动
init();