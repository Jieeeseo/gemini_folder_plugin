// src/scripts/content.js - V27.2 (纯图标版)
const STORAGE_KEY = 'gemini_folder_data_v2';
let state = {
    folders: [],
    sidebarOpen: false,
    folderListExpanded: true
};

let currentViewingChat = {
    title: "",
    url: "",
    isValid: false,
    isSaved: false,
    savedFolderName: "",
    isContextual: false
};

let currentFolderToEdit = null;
let selectedFolderIdForAdd = null;
let lastCheckedUrl = "";
let navigationContext = null;

// 幽灵按钮引用
let ghostBtn = null;
let currentHoverTarget = null;

async function init() {
    console.log("%c Gemini Folder Plugin [V27.2] ", "background: #cc00ff; color: #fff; font-size: 16px; padding: 4px; border-radius: 4px;");

    await loadData();
    injectSidebar();
    injectModals();
    injectMenuButton();
    injectGhostButton();

    document.addEventListener('mousemove', handleGlobalMouseMove, { passive: true });
    setInterval(monitorUrlChange, 500);
}

async function loadData() {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    if (data[STORAGE_KEY]) state.folders = data[STORAGE_KEY];
}

async function saveData() {
    await chrome.storage.local.set({ [STORAGE_KEY]: state.folders });
    renderFolderList();
    detectTitle();
}

// ... 状态监控和标题检测 (保持不变) ...

function monitorUrlChange() {
    const url = window.location.href;
    if (url !== lastCheckedUrl) {
        if (navigationContext && !url.includes(navigationContext.url)) {
            navigationContext = null;
        }
        lastCheckedUrl = url;
        updateState("Loading...", url, false, false, "", false);

        detectTitle();
        setTimeout(detectTitle, 500);
        setTimeout(detectTitle, 1200);
    }
}

function detectTitle() {
    const url = window.location.href;
    const isChat = url.includes('/app/') && !url.endsWith('/app') && !url.endsWith('/app/');

    if (!isChat) {
        updateState("No active chat", "", false, false, "", false);
        return;
    }

    if (navigationContext && url.includes(navigationContext.url)) {
        updateState(
            navigationContext.title,
            url,
            true,
            true,
            navigationContext.folderName,
            true
        );
        return;
    }

    let savedInFolders = [];
    let primaryTitle = null;

    for (const folder of state.folders) {
        const found = folder.chats.find(c => c.url === url);
        if (found) {
            savedInFolders.push(folder.name);
            if (!primaryTitle) primaryTitle = found.title;
        }
    }

    if (savedInFolders.length > 0) {
        const folderDisplayStr = savedInFolders.join(", ");
        updateState(
            primaryTitle,
            url,
            true,
            true,
            folderDisplayStr,
            false
        );
        return;
    }

    const match = window.location.pathname.match(/\/app\/([a-zA-Z0-9\-_]{10,})/);
    const chatId = match ? match[1] : null;
    let bestTitle = "";

    if (chatId) {
        const h1 = document.querySelector('h1');
        if (h1 && h1.innerText) {
            const text = h1.innerText.trim();
            if (text.length > 0 && text !== "Gemini") bestTitle = text;
        }
        if (!bestTitle) {
            const sidebarTitle = findTitleInSidebarDeep(chatId);
            if (sidebarTitle) bestTitle = sidebarTitle;
        }
    }

    if (!bestTitle) {
        let docTitle = document.title.replace(' - Gemini', '').replace('Google Gemini', '').trim();
        if (docTitle && docTitle !== "Gemini") bestTitle = docTitle;
    }

    if (bestTitle && bestTitle !== "Gemini" && !bestTitle.includes("Google 账号")) {
        updateState(bestTitle, url, true, false, "", false);
    } else {
        updateState("Current Chat", url, true, false, "", false);
    }
}

function updateState(title, url, isValid, isSaved = false, folderName = "", isContextual = false) {
    if (title && title.length > 100) title = title.substring(0, 90) + "...";

    currentViewingChat = {
        title: title,
        url: url,
        isValid: isValid,
        isSaved: isSaved,
        savedFolderName: folderName,
        isContextual: isContextual
    };
    updateCurrentChatCard();
}

function findTitleInSidebarDeep(chatId) {
    let stack = [document.body];
    while (stack.length > 0) {
        let root = stack.pop();
        if (!root) continue;
        let walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
            acceptNode: (node) => {
                if (['SCRIPT', 'STYLE', 'svg', 'path'].includes(node.tagName)) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        let node = walker.currentNode;
        while (node) {
            if (node.shadowRoot) stack.push(node.shadowRoot);
            if (node.tagName === 'A' && node.href && node.href.includes(chatId)) {
                if (!node.href.includes('accounts.google')) {
                    let text = node.getAttribute('aria-label') || node.innerText;
                    text = text ? text.replace(/[\n\r]+/g, ' ').trim() : "";
                    if (text.length > 0 && text !== "More options" && !text.includes("Google 账号")) return text;
                }
            }
            node = walker.nextNode();
        }
    }
    return null;
}

function updateCurrentChatCard() {
    const titleEl = document.getElementById('gfp-current-title');
    const btnEl = document.getElementById('gfp-btn-save-current');
    const labelEl = document.querySelector('.gfp-card-label');

    if (!titleEl || !btnEl) return;

    titleEl.classList.remove('allow-wrap');
    titleEl.style.fontStyle = "normal";
    titleEl.style.color = "var(--gfp-text-main)";
    btnEl.style.background = "";
    btnEl.style.border = "";
    btnEl.style.color = "";

    if (currentViewingChat.isValid) {
        btnEl.classList.remove('disabled');

        if (currentViewingChat.isSaved) {
            if (currentViewingChat.isContextual) {
                labelEl.innerText = `SAVED IN: ${currentViewingChat.savedFolderName.toUpperCase()}`;
                labelEl.style.color = "var(--gfp-success)";
                titleEl.innerText = currentViewingChat.title;
            } else {
                labelEl.innerText = "STATUS";
                labelEl.style.color = "var(--gfp-text-sub)";
                titleEl.innerText = `Saved in: ${currentViewingChat.savedFolderName}`;
                titleEl.style.color = "var(--gfp-success)";
                titleEl.classList.add('allow-wrap');
            }
            btnEl.innerText = "Add to another Folder";
        } else {
            labelEl.innerText = "STATUS";
            labelEl.style.color = "var(--gfp-text-sub)";
            titleEl.innerText = "Not Saved";
            titleEl.style.color = "var(--gfp-text-sub)";
            titleEl.style.fontStyle = "italic";
            btnEl.innerText = "Save to Folder";
        }
    } else {
        titleEl.innerText = "Select a chat...";
        titleEl.style.color = "var(--gfp-text-sub)";
        btnEl.classList.add('disabled');
        btnEl.innerText = "No Chat";
        labelEl.innerText = "STATUS";
    }
}

// ... 幽灵按钮逻辑 (保持不变) ...

function injectGhostButton() {
    if (document.getElementById('gfp-ghost-add-btn')) return;

    ghostBtn = document.createElement("div");
    ghostBtn.id = "gfp-ghost-add-btn";
    ghostBtn.innerHTML = "＋";
    ghostBtn.title = "Add to Folder";

    ghostBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!currentHoverTarget) return;
        const data = extractDataFromElement(currentHoverTarget);
        if (!data) return;

        pendingChat = data;
        openModal('select-folder');
    });

    document.body.appendChild(ghostBtn);
}

function handleGlobalMouseMove(e) {
    if (state.sidebarOpen || document.querySelector('.gfp-modal-overlay.active')) {
        hideGhostBtn();
        return;
    }

    const path = e.composedPath();
    let target = null;

    for (let el of path) {
        if (el instanceof HTMLElement && isChatListItem(el)) {
            target = el;
            break;
        }
    }

    if (target && !target.id.startsWith('gfp-')) {
        currentHoverTarget = target;
        showGhostBtn(target);
    } else {
        const onGhost = path.some(el => el.id === 'gfp-ghost-add-btn');
        if (!onGhost) {
            hideGhostBtn();
        }
    }
}

function isChatListItem(el) {
    const href = el.getAttribute('href');
    if (href && href.includes('/app/')) {
        if (href.includes('support.google') || href.includes('accounts.google')) return false;
        return true;
    }

    if (el.getAttribute('data-id') || el.getAttribute('data-item-id')) return true;

    if (el.getAttribute('jsaction') && el.innerText.length > 2 && el.offsetHeight > 20) {
        return true;
    }
    return false;
}

function extractDataFromElement(el) {
    let title = el.innerText || el.getAttribute('aria-label') || el.title || "";
    title = title.replace(/[\n\r]+/g, ' ').trim();

    let url = el.getAttribute('href');
    if (!url || !url.includes('/app/')) {
        const id = el.getAttribute('data-id') || el.getAttribute('data-item-id');
        if (id) url = `https://gemini.google.com/app/${id}`;
    }

    let isSimulated = false;
    if (!url || url === '#' || url.endsWith('/app/') || url.endsWith('/app')) {
        url = `simulate-click://${encodeURIComponent(title)}`;
        isSimulated = true;
    } else if (url.startsWith('/')) {
        url = 'https://gemini.google.com' + url;
    }

    return {
        title: title || "Untitled Chat",
        url: url,
        isSimulated: isSimulated
    };
}

function showGhostBtn(targetEl) {
    if (!ghostBtn) return;

    const rect = targetEl.getBoundingClientRect();
    const btnSize = 28;
    const left = rect.right - 45;
    const top = rect.top + (rect.height / 2) - (btnSize / 2);

    ghostBtn.style.left = `${left}px`;
    ghostBtn.style.top = `${top}px`;
    ghostBtn.classList.add('visible');
}

function hideGhostBtn() {
    if (ghostBtn) ghostBtn.classList.remove('visible');
    currentHoverTarget = null;
}

// === 核心修改：纯图标按钮 ===

function injectMenuButton() {
    if (document.getElementById('gfp-menu-btn')) return;
    const btn = document.createElement('div');
    btn.id = 'gfp-menu-btn';
    // 只保留图标，去除文字
    btn.innerHTML = '<span>📁</span>';
    btn.title = "My Folders"; // 添加 Tooltip 方便理解
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

        <div id="modal-select-folder" class="gfp-modal-overlay">
            <div class="gfp-modal">
                <div class="gfp-modal-title">Save to Folder</div>
                <label class="gfp-label">Chat Title</label>
                <input type="text" class="gfp-input" id="gfp-input-save-title">
                <label class="gfp-label">Select Folder</label>
                <div class="gfp-select-list" id="gfp-select-list-container"></div>
                <div class="gfp-modal-actions">
                    <button class="gfp-btn-modal gfp-btn-cancel" id="gfp-cancel-select">Cancel</button>
                    <button class="gfp-btn-modal gfp-btn-confirm" id="gfp-confirm-save">Save</button>
                </div>
            </div>
        </div>
        
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

    const closeAll = () => document.querySelectorAll('.gfp-modal-overlay').forEach(el => el.classList.remove('active'));

    document.getElementById('gfp-cancel-create').onclick = closeAll;
    document.getElementById('gfp-cancel-select').onclick = closeAll;
    document.getElementById('gfp-cancel-edit').onclick = closeAll;

    document.getElementById('gfp-confirm-create').onclick = createNewFolder;
    document.getElementById('gfp-confirm-save').onclick = saveChatToFolder;
    document.getElementById('gfp-confirm-edit').onclick = saveFolderEdit;
    document.getElementById('gfp-btn-delete').onclick = deleteFolder;
}

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

        if (folder.chats && folder.chats.length > 0) {
            folder.chats.forEach((chat, chatIndex) => {
                const wrapper = document.createElement('div');
                wrapper.className = 'gfp-chat-item-wrapper';

                const a = document.createElement('a');
                a.className = 'gfp-chat-link';
                a.href = chat.url;
                a.innerText = `• ${chat.title}`;
                a.title = chat.title;

                a.onclick = (e) => {
                    e.preventDefault();
                    navigationContext = {
                        url: chat.url,
                        title: chat.title,
                        folderName: folder.name
                    };

                    if (chat.url.startsWith('simulate-click://')) {
                        simulateClickByTitle(chat.title);
                    } else {
                        if (window.location.href === chat.url) {
                            detectTitle();
                        } else {
                            window.location.href = chat.url;
                        }
                    }
                };

                const deleteBtn = document.createElement('div');
                deleteBtn.className = 'gfp-chat-delete-btn';
                deleteBtn.innerHTML = '×';
                deleteBtn.title = 'Remove from folder';

                deleteBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (confirm(`Remove "${chat.title}"?`)) {
                        folder.chats.splice(chatIndex, 1);
                        saveData();
                    }
                };

                wrapper.appendChild(a);
                wrapper.appendChild(deleteBtn);
                listContainer.appendChild(wrapper);
            });
        } else {
            listContainer.innerHTML = '<div style="padding:5px 10px; color:#666; font-size:12px;">Empty</div>';
        }

        header.onclick = (e) => {
            if (e.target.closest('.setting-btn')) return;
            const show = listContainer.classList.toggle('show');
            arrow.classList.toggle('expanded', show);
            arrow.innerText = show ? '▼' : '▶';
        };

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

        let prefill = currentViewingChat.title;
        if (prefill === "Not Saved" || prefill.startsWith("Saved in:")) {
            let t = document.title.replace(' - Gemini', '').trim();
            if (t && t !== "Gemini") prefill = t;
            else prefill = "New Chat";
        }
        document.getElementById('gfp-input-save-title').value = prefill;

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
    let finalTitle = document.getElementById('gfp-input-save-title').value.trim();
    if (!finalTitle || finalTitle.startsWith("Saved in:") || finalTitle === "Not Saved") {
        finalTitle = document.title.replace(' - Gemini', '').trim() || "New Chat";
    }

    const folder = state.folders.find(f => f.id === selectedFolderIdForAdd);

    if (folder && currentViewingChat.isValid) {
        const exists = folder.chats.some(c => c.url === currentViewingChat.url);
        if (!exists) {
            folder.chats.push({
                title: finalTitle,
                url: currentViewingChat.url
            });
            saveData();
        }
    }
    document.querySelectorAll('.gfp-modal-overlay').forEach(el => el.classList.remove('active'));
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

function simulateClickByTitle(targetTitle) {
    try { targetTitle = decodeURIComponent(targetTitle); } catch (e) { }
    let stack = [document.body];
    while (stack.length > 0) {
        let root = stack.pop();
        if (!root) continue;
        let walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
        let node = walker.currentNode;
        while (node) {
            if (node.shadowRoot) stack.push(node.shadowRoot);
            let text = node.innerText || node.getAttribute('aria-label') || "";
            if (text.includes(targetTitle) && Math.abs(text.length - targetTitle.length) < 5) {
                let clickable = node.closest('a, button, div[role="button"], div[jsaction]') || node;
                clickable.click();
                if (state.sidebarOpen) toggleSidebar();
                return;
            }
            node = walker.nextNode();
        }
    }
    alert(`Could not locate chat "${targetTitle}". Try scrolling the list.`);
}

init();