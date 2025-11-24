// src/scripts/content.js - V5.1 (修复 Cancel 按钮 Bug)
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
    console.log("%c Gemini Folder Plugin [V5.1] Loaded ", "background: #000; color: #00f; font-size: 16px");
    
    await loadData();
    injectSidebar();
    injectModals();
    injectMenuButton(); 
    startObserver(); 
}

async function loadData() {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    if (data[STORAGE_KEY]) state.folders = data[STORAGE_KEY];
}

async function saveData() {
    await chrome.storage.local.set({ [STORAGE_KEY]: state.folders });
    renderSidebarList(); 
}

// --- DOM 注入 (侧边栏) ---
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

// --- 模态框注入 (修复重点) ---
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
                    <!-- 给 Cancel 按钮加了 ID，去掉了 onclick -->
                    <button class="gfp-btn gfp-btn-cancel" id="gfp-cancel-create">Cancel</button>
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
                        <!-- 给 Cancel 按钮加了 ID -->
                        <button class="gfp-btn gfp-btn-cancel" id="gfp-cancel-settings">Cancel</button>
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
                <div class="gfp-select-list" id="gfp-chat-select-container"></div>
                <!-- 调试信息 -->
                <div id="gfp-debug-text" style="font-size:10px; color:#888; text-align:center; margin-bottom:10px; padding:5px; background:#111; border-radius:4px; max-height:60px; overflow:auto;"></div>
                <div class="gfp-modal-actions">
                    <!-- 给 Cancel 按钮加了 ID -->
                    <button class="gfp-btn gfp-btn-cancel" id="gfp-cancel-add-chat">Cancel</button>
                    <button class="gfp-btn gfp-btn-confirm" id="gfp-confirm-add-chat-final">Add</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modalContainer);

    // --- 事件绑定 (这里是修复的关键) ---
    // 绑定所有的 Cancel 按钮到 closeAllModals 函数
    document.getElementById('gfp-cancel-create').addEventListener('click', closeAllModals);
    document.getElementById('gfp-cancel-settings').addEventListener('click', closeAllModals);
    document.getElementById('gfp-cancel-add-chat').addEventListener('click', closeAllModals);

    // 其他事件绑定
    document.getElementById('gfp-input-foldername').addEventListener('input', function() { document.getElementById('gfp-char-count').innerText = this.value.length; });
    document.getElementById('gfp-confirm-create').onclick = createNewFolder;
    document.getElementById('gfp-confirm-rename').onclick = saveFolderRename;
    document.getElementById('gfp-btn-delete-req').onclick = () => { if(confirm('Are you sure?')) deleteFolder(); };
    document.getElementById('gfp-search-chat-list').addEventListener('input', (e) => { renderChatSelectionList(e.target.value); });
    document.getElementById('gfp-confirm-add-chat-final').onclick = confirmAddChatToFolder;
}

// 独立的关闭函数
function closeAllModals() {
    document.querySelectorAll('.gfp-modal-overlay').forEach(el => el.classList.remove('active'));
}

// === 核心：全域地毯式扫描器 (保持 V5.0 的逻辑) ===

function getAllLinksDeep(root) {
    let links = [];
    if (root.querySelectorAll) {
        try {
            const currentLinks = root.querySelectorAll('a');
            links.push(...Array.from(currentLinks));
        } catch(e) { /* 忽略错误 */ }
    }
    if (root.querySelectorAll) {
        const allElements = root.querySelectorAll('*');
        for (const el of allElements) {
            if (el.shadowRoot) {
                links.push(...getAllLinksDeep(el.shadowRoot));
            }
        }
    }
    return links;
}

function getRecentChatsFromDOM() {
    console.log("Debug: V5.1 Full Scan started...");
    
    const chats = [];
    const seenUrls = new Set();
    
    const allLinks = getAllLinksDeep(document.body);
    
    console.log(`Debug: Scanned ${allLinks.length} total links.`);

    const blacklist = [
        'accounts.google.com', 'support.google.com', 'mail.google.com',
        'policies.google.com', 'myactivity.google.com', 'google 账号', 
        'sign out', 'setting', 'upgrade', 'help', 'manager', 'faq', 'activity'
    ];

    allLinks.forEach(link => {
        const url = link.href;
        if (!url.includes('/app/')) return;
        if (blacklist.some(bad => url.includes(bad))) return;

        const idPart = url.split('/app/')[1];
        if (!idPart || idPart.length < 5) return;

        if (seenUrls.has(url)) return;
        seenUrls.add(url);

        let title = link.innerText || link.getAttribute('aria-label') || link.title || "";
        title = title.replace(/[\n\r]+/g, ' ').trim();
        const lowerTitle = title.toLowerCase();

        if (blacklist.some(bad => lowerTitle.includes(bad))) return;
        if (!title) title = "Chat " + chats.length;

        chats.push({ title, url });
    });

    const debugText = document.getElementById('gfp-debug-text');
    if (debugText) {
        if(chats.length === 0) {
             debugText.innerText = `Scanned ${allLinks.length} raw links. FOUND 0 CHATS. \n(Check Console for details)`;
             debugText.style.color = "red";
        } else {
             debugText.innerText = `Success: Scanned ${allLinks.length} links, Found ${chats.length} chats.`;
             debugText.style.color = "#888";
        }
    }

    return chats;
}

// ... 渲染逻辑 ...

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
        addBtn.onclick = () => { currentFolderToAddChat = folder; openModal('add-chat-to-folder'); };
        settingsBtn.onclick = () => { currentFolderToEdit = folder; openModal('settings'); };
        container.appendChild(el);
    });
}

function renderChatSelectionList(filter = '') {
    const container = document.getElementById('gfp-chat-select-container');
    container.innerHTML = '';
    selectedChatToAdd = null; 

    const chats = getRecentChatsFromDOM();
    const filteredChats = chats.filter(c => !filter || c.title.toLowerCase().includes(filter.toLowerCase()));

    if (filteredChats.length === 0) {
        setTimeout(() => {
            const retryChats = getRecentChatsFromDOM();
            if(retryChats.length > 0) {
                 renderChatSelectionList(filter); 
            }
        }, 1000);
        
        container.innerHTML = '<div style="padding:10px;color:#888;text-align:center">No chats found.<br><small>Scanning page...</small></div>';
        return;
    }

    filteredChats.forEach(chat => {
        const item = document.createElement('div');
        item.className = 'gfp-select-item';
        item.title = chat.url;
        item.innerHTML = `
            <div style="width:100%">
                <div style="font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${chat.title}</div>
                <div style="font-size:10px;color:#666;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${chat.url}</div>
            </div>
        `;
        item.onclick = () => {
            document.querySelectorAll('.gfp-select-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            selectedChatToAdd = chat;
        };
        container.appendChild(item);
    });
}

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

function confirmAddChatToFolder() {
    if (!selectedChatToAdd) { alert("Please select a chat first."); return; }
    if (!currentFolderToAddChat) return;
    const folder = state.folders.find(f => f.id === currentFolderToAddChat.id);
    if (folder) {
        const exists = folder.chats.some(c => c.url === selectedChatToAdd.url);
        if (!exists) { folder.chats.push(selectedChatToAdd); saveData(); }
        else { alert("Chat already in folder."); }
    }
    closeAllModals();
}

function startObserver() {
    const observer = new MutationObserver((mutations) => { injectMenuButton(); });
    observer.observe(document.body, { childList: true, subtree: true });
}

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