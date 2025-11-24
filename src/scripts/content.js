// src/scripts/content.js - V17.0 (支持删除对话版)
const STORAGE_KEY = 'gemini_folder_data_v2';
let state = {
    folders: [],
    sidebarOpen: false,
};

// 当前正在浏览的对话信息
let currentViewingChat = { title: "", url: "", isValid: false };
let currentFolderToEdit = null; // 用于重命名/删除文件夹
let selectedFolderIdForAdd = null; // 用于添加对话

async function init() {
    console.log("%c Gemini Folder Plugin [V17.0] ", "background: #008888; color: #fff; font-size: 16px; padding: 4px; border-radius: 4px;");

    await loadData();
    injectSidebar();
    injectModals();
    injectMenuButton();

    // 启动当前页面监控
    setInterval(checkCurrentPage, 1000);
}

async function loadData() {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    if (data[STORAGE_KEY]) state.folders = data[STORAGE_KEY];
}

async function saveData() {
    await chrome.storage.local.set({ [STORAGE_KEY]: state.folders });
    renderFolderList();
}

// === 核心：监控当前正在查看的对话 ===
function checkCurrentPage() {
    const url = window.location.href;

    // 判断是否在对话页面
    const isChat = url.includes('/app/') && !url.endsWith('/app') && !url.endsWith('/app/');

    if (isChat) {
        // 提取标题
        let title = document.title.replace(' - Gemini', '').trim();
        if (title === 'Gemini' || !title) {
            const h1 = document.querySelector('h1');
            if (h1) title = h1.innerText.trim();
        }
        if (!title) title = "Current Chat";

        currentViewingChat = {
            title: title,
            url: url,
            isValid: true
        };
    } else {
        currentViewingChat = {
            title: "No active chat",
            url: "",
            isValid: false
        };
    }

    updateCurrentChatCard();
}

function updateCurrentChatCard() {
    const titleEl = document.getElementById('gfp-current-title');
    const btnEl = document.getElementById('gfp-btn-save-current');

    if (!titleEl || !btnEl) return;

    if (currentViewingChat.isValid) {
        titleEl.innerText = currentViewingChat.title;
        titleEl.style.color = "var(--gfp-text-main)";
        btnEl.classList.remove('disabled');
        btnEl.innerText = "Save to Folder";
    } else {
        titleEl.innerText = "Select a chat to save...";
        titleEl.style.color = "var(--gfp-text-sub)";
        btnEl.classList.add('disabled');
        btnEl.innerText = "No Chat Detected";
    }
}

// === DOM 注入 ===

function injectMenuButton() {
    if (document.getElementById('gfp-menu-btn')) return;
    const btn = document.createElement('div');
    btn.id = 'gfp-menu-btn';
    btn.innerHTML = '<span>📁</span> <span>Folders</span>';
    btn.onclick = toggleSidebar;
    document.body.appendChild(btn);
}

function injectSidebar() {
    if (document.getElementById('gfp-sidebar')) return;
    const sidebar = document.createElement('div');
    sidebar.id = 'gfp-sidebar';
    sidebar.innerHTML = `
        <div class="gfp-sidebar-header">
            <span class="gfp-sidebar-title">My Folders</span>
            <button class="gfp-close-btn" id="gfp-close-btn">✕</button>
        </div>
        
        <!-- 顶部卡片：当前对话 -->
        <div class="gfp-current-chat-card">
            <div class="gfp-card-label">Currently Viewing</div>
            <div class="gfp-card-title" id="gfp-current-title">Detecting...</div>
            <div class="gfp-card-actions">
                <button class="gfp-btn-action gfp-btn-save disabled" id="gfp-btn-save-current">No Chat Detected</button>
            </div>
        </div>

        <div class="gfp-folders-section">
            <div class="gfp-section-header">
                <span>FOLDERS</span>
                <button class="gfp-btn-icon" id="gfp-btn-new-folder">+ New</button>
            </div>
            <div id="gfp-folder-container"></div>
        </div>
    `;
    document.body.appendChild(sidebar);

    // 绑定事件
    document.getElementById('gfp-close-btn').onclick = toggleSidebar;
    document.getElementById('gfp-btn-new-folder').onclick = () => openModal('create-folder');

    document.getElementById('gfp-btn-save-current').onclick = () => {
        if (currentViewingChat.isValid) {
            openModal('select-folder');
        }
    };

    renderFolderList();
}

function injectModals() {
    if (document.getElementById('modal-create-folder')) return;
    const container = document.createElement('div');
    container.innerHTML = `
        <!-- 创建文件夹 -->
        <div id="modal-create-folder" class="gfp-modal-overlay">
            <div class="gfp-modal">
                <div class="gfp-modal-title">New Folder</div>
                <input type="text" class="gfp-input" id="gfp-input-create" placeholder="Folder Name">
                <div class="gfp-modal-actions">
                    <button class="gfp-btn-modal gfp-btn-cancel" id="gfp-cancel-create">Cancel</button>
                    <button class="gfp-btn-modal gfp-btn-confirm" id="gfp-confirm-create">Create</button>
                </div>
            </div>
        </div>

        <!-- 选择文件夹 -->
        <div id="modal-select-folder" class="gfp-modal-overlay">
            <div class="gfp-modal">
                <div class="gfp-modal-title">Save to Folder</div>
                <div class="gfp-select-list" id="gfp-select-list-container"></div>
                <div class="gfp-modal-actions">
                    <button class="gfp-btn-modal gfp-btn-cancel" id="gfp-cancel-select">Cancel</button>
                    <button class="gfp-btn-modal gfp-btn-confirm" id="gfp-confirm-save">Save</button>
                </div>
            </div>
        </div>
        
        <!-- 文件夹设置 (重命名/删除) -->
        <div id="modal-folder-settings" class="gfp-modal-overlay">
            <div class="gfp-modal">
                <div class="gfp-modal-title">Edit Folder</div>
                <input type="text" class="gfp-input" id="gfp-input-rename">
                <div class="gfp-modal-actions" style="justify-content: space-between;">
                    <button class="gfp-btn-modal" style="background:#ff4444;color:white" id="gfp-btn-delete">Delete</button>
                    <div style="display:flex; gap:8px">
                        <button class="gfp-btn-modal gfp-btn-cancel" id="gfp-cancel-edit">Cancel</button>
                        <button class="gfp-btn-modal gfp-btn-confirm" id="gfp-confirm-edit">Save</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(container);

    // 通用关闭事件
    const closeAll = () => document.querySelectorAll('.gfp-modal-overlay').forEach(el => el.classList.remove('active'));

    document.getElementById('gfp-cancel-create').onclick = closeAll;
    document.getElementById('gfp-cancel-select').onclick = closeAll;
    document.getElementById('gfp-cancel-edit').onclick = closeAll;

    // 业务事件
    document.getElementById('gfp-confirm-create').onclick = createNewFolder;
    document.getElementById('gfp-confirm-save').onclick = saveChatToFolder;
    document.getElementById('gfp-confirm-edit').onclick = saveFolderEdit;
    document.getElementById('gfp-btn-delete').onclick = deleteFolder;
}

// === 渲染逻辑 (包含删除功能) ===

function renderFolderList() {
    const container = document.getElementById('gfp-folder-container');
    container.innerHTML = '';

    if (state.folders.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:#666;margin-top:20px;font-size:12px;">No folders yet</div>';
        return;
    }

    state.folders.forEach(folder => {
        const el = document.createElement('div');
        el.className = 'gfp-folder-item';
        el.innerHTML = `
            <div class="gfp-folder-header">
                <span class="gfp-folder-arrow">▶</span>
                <span class="gfp-folder-name">${folder.name}</span>
                <div class="gfp-folder-tools">
                    <button class="gfp-tool-btn setting-btn">⚙️</button>
                </div>
            </div>
            <div class="gfp-chat-list"></div>
        `;

        const listContainer = el.querySelector('.gfp-chat-list');
        const arrow = el.querySelector('.gfp-folder-arrow');
        const header = el.querySelector('.gfp-folder-header');

        // 渲染文件夹内的对话链接
        if (folder.chats && folder.chats.length > 0) {
            folder.chats.forEach((chat, chatIndex) => {
                // 创建包裹容器
                const wrapper = document.createElement('div');
                wrapper.className = 'gfp-chat-item-wrapper';

                // 创建链接
                const a = document.createElement('a');
                a.className = 'gfp-chat-link';
                a.href = chat.url;
                a.innerText = `• ${chat.title}`;
                a.title = chat.title; // tooltip

                // 创建删除按钮
                const deleteBtn = document.createElement('div');
                deleteBtn.className = 'gfp-chat-delete-btn';
                deleteBtn.innerHTML = '×'; // 或者用 SVG 图标
                deleteBtn.title = 'Remove from folder';

                // 删除事件逻辑
                deleteBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation(); // 防止触发链接跳转

                    if (confirm(`Are you sure you want to remove "${chat.title}" from this folder?`)) {
                        // 执行删除
                        folder.chats.splice(chatIndex, 1);
                        saveData(); // 保存并重新渲染
                    }
                };

                wrapper.appendChild(a);
                wrapper.appendChild(deleteBtn);
                listContainer.appendChild(wrapper);
            });
        } else {
            listContainer.innerHTML = '<div style="padding:5px 10px; color:#666; font-size:12px;">Empty</div>';
        }

        // 折叠展开逻辑
        header.onclick = (e) => {
            if (e.target.closest('.setting-btn')) return;
            const show = listContainer.classList.toggle('show');
            arrow.classList.toggle('expanded', show);
            arrow.innerText = show ? '▼' : '▶';
        };

        // 设置按钮
        el.querySelector('.setting-btn').onclick = () => {
            currentFolderToEdit = folder;
            openModal('edit-folder');
        };

        container.appendChild(el);
    });
}

function renderSelectFolderList() {
    const container = document.getElementById('gfp-select-list-container');
    container.innerHTML = '';
    selectedFolderIdForAdd = null;

    state.folders.forEach(folder => {
        const div = document.createElement('div');
        div.className = 'gfp-select-item';
        div.innerHTML = `📁 ${folder.name}`;
        div.onclick = () => {
            document.querySelectorAll('.gfp-select-item').forEach(i => i.classList.remove('selected'));
            div.classList.add('selected');
            selectedFolderIdForAdd = folder.id;
        };
        container.appendChild(div);
    });
}

// === 业务逻辑函数 ===

function toggleSidebar() {
    state.sidebarOpen = !state.sidebarOpen;
    const sidebar = document.getElementById('gfp-sidebar');
    if (state.sidebarOpen) sidebar.classList.add('open');
    else sidebar.classList.remove('open');
}

function openModal(type) {
    document.querySelectorAll('.gfp-modal-overlay').forEach(el => el.classList.remove('active'));

    if (type === 'create-folder') {
        document.getElementById('modal-create-folder').classList.add('active');
        document.getElementById('gfp-input-create').value = '';
    } else if (type === 'select-folder') {
        if (state.folders.length === 0) {
            alert("Please create a folder first!");
            return;
        }
        document.getElementById('modal-select-folder').classList.add('active');
        renderSelectFolderList();
    } else if (type === 'edit-folder') {
        document.getElementById('modal-folder-settings').classList.add('active');
        document.getElementById('gfp-input-rename').value = currentFolderToEdit.name;
    }
}

function createNewFolder() {
    const name = document.getElementById('gfp-input-create').value.trim();
    if (!name) return;

    state.folders.push({ id: Date.now(), name: name, chats: [] });
    saveData();
    document.querySelectorAll('.gfp-modal-overlay').forEach(el => el.classList.remove('active'));
}

function saveChatToFolder() {
    if (!selectedFolderIdForAdd) {
        alert("Select a folder!");
        return;
    }

    const folder = state.folders.find(f => f.id === selectedFolderIdForAdd);
    if (folder && currentViewingChat.isValid) {
        // 查重
        const exists = folder.chats.some(c => c.url === currentViewingChat.url);
        if (!exists) {
            folder.chats.push({
                title: currentViewingChat.title,
                url: currentViewingChat.url
            });
            saveData();
        }
    }
    document.querySelectorAll('.gfp-modal-overlay').forEach(el => el.classList.remove('active'));
    // 自动展开侧边栏反馈结果
    if (!state.sidebarOpen) toggleSidebar();
}

function saveFolderEdit() {
    const name = document.getElementById('gfp-input-rename').value.trim();
    if (!name) return;
    const folder = state.folders.find(f => f.id === currentFolderToEdit.id);
    if (folder) {
        folder.name = name;
        saveData();
    }
    document.querySelectorAll('.gfp-modal-overlay').forEach(el => el.classList.remove('active'));
}

function deleteFolder() {
    if (!confirm("Delete this folder?")) return;
    state.folders = state.folders.filter(f => f.id !== currentFolderToEdit.id);
    saveData();
    document.querySelectorAll('.gfp-modal-overlay').forEach(el => el.classList.remove('active'));
}

// 启动
init();