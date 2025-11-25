/**
 * UIManager
 * 负责界面渲染、DOM 注入和 UI 事件处理
 */
class UIManager {
    constructor(storageService, geminiAdapter) {
        this.storage = storageService;
        this.gemini = geminiAdapter;
        
        this.sidebarOpen = false;
        this.currentViewingChat = {};
        this.currentFolderToEdit = null;
        this.selectedFolderIdForAdd = null;
        
        // Ghost Button
        this.ghostBtn = null;
        this.currentHoverTarget = null;
        this.pendingChat = null; // 通过幽灵按钮选中的 chat
    }

    init() {
        // 核心修复：初始化前先清理旧 DOM，防止“僵尸元素”导致逻辑失效
        this.cleanupOldDOM();
        
        this.injectMenuButton();
        this.injectSidebar();
        this.injectModals();
        this.injectGhostButton();
        this.bindGlobalEvents();
    }

    cleanupOldDOM() {
        const idsToRemove = [
            'gfp-menu-btn', 
            'gfp-sidebar', 
            'gfp-ghost-add-btn'
        ];
        idsToRemove.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });

        document.querySelectorAll('.gfp-modal-overlay').forEach(el => {
            if (el.parentElement && el.parentElement.tagName === 'DIV' && !el.parentElement.className) {
                if (el.parentElement.children.length > 0 && el.parentElement.querySelector('#modal-create-folder')) {
                     el.parentElement.remove();
                } else {
                    el.remove();
                }
            } else {
                el.remove();
            }
        });
        
        const oldModals = document.getElementById('modal-create-folder');
        if (oldModals && oldModals.parentElement) oldModals.parentElement.remove();
    }

    // === DOM 注入 ===
    injectMenuButton() {
        const btn = document.createElement('div');
        btn.id = 'gfp-menu-btn';
        btn.innerHTML = Icons.menu; 
        btn.title = "My Folders";
        btn.onclick = () => this.toggleSidebar();
        document.body.appendChild(btn);
    }

    injectSidebar() {
        const sidebar = document.createElement('div');
        sidebar.id = 'gfp-sidebar';
        sidebar.innerHTML = `
            <div class="gfp-sidebar-header">
                <span class="gfp-sidebar-title">My Folders</span>
                <button class="gfp-close-btn" id="gfp-close-btn">${Icons.close}</button>
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
                    <button class="gfp-btn-icon" id="gfp-btn-new-folder" style="display:flex;align-items:center;gap:4px">
                        ${Icons.plus} New
                    </button>
                </div>
                <div id="gfp-folder-container"></div>
            </div>
        `;
        document.body.appendChild(sidebar);

        document.getElementById('gfp-close-btn').onclick = () => this.toggleSidebar();
        document.getElementById('gfp-btn-new-folder').onclick = () => this.openModal('create-folder');
        document.getElementById('gfp-btn-save-current').onclick = () => {
            if (this.currentViewingChat.isValid) {
                this.pendingChat = null; // 清除幽灵按钮的数据，使用当前页面数据
                this.openModal('select-folder');
            }
        };
    }

    injectModals() {
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
        this.bindModalEvents();
    }

    injectGhostButton() {
        this.ghostBtn = document.createElement("div");
        this.ghostBtn.id = "gfp-ghost-add-btn";
        this.ghostBtn.innerHTML = Icons.plus;
        this.ghostBtn.title = "Add to Folder";
        
        this.ghostBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!this.currentHoverTarget) return;
            
            const data = this.gemini.extractDataFromElement(this.currentHoverTarget);
            if (!data) return;

            this.pendingChat = data;
            this.openModal('select-folder');
        };
        document.body.appendChild(this.ghostBtn);
    }

    // === 事件处理 ===
    bindGlobalEvents() {
        document.addEventListener('mousemove', (e) => this.handleGlobalMouseMove(e), { passive: true });
    }

    bindModalEvents() {
        const closeAll = () => document.querySelectorAll('.gfp-modal-overlay').forEach(el => el.classList.remove('active'));

        document.getElementById('gfp-cancel-create').onclick = closeAll;
        document.getElementById('gfp-cancel-select').onclick = closeAll;
        document.getElementById('gfp-cancel-edit').onclick = closeAll;

        document.getElementById('gfp-confirm-create').onclick = async () => {
            const name = document.getElementById('gfp-input-create').value.trim();
            if (!name) return;
            await this.storage.addFolder(name);
            closeAll();
            this.renderFolderList();
        };

        document.getElementById('gfp-confirm-save').onclick = async () => {
            if (!this.selectedFolderIdForAdd) {
                alert("Select a folder!");
                return;
            }
            let finalTitle = document.getElementById('gfp-input-save-title').value.trim();
            if (!finalTitle || finalTitle.startsWith("Saved in:") || finalTitle === "Not Saved") {
                const source = this.pendingChat || this.currentViewingChat;
                finalTitle = source.title || "New Chat";
            }

            const targetUrl = this.pendingChat ? this.pendingChat.url : this.currentViewingChat.url;

            await this.storage.addChatToFolder(this.selectedFolderIdForAdd, {
                title: finalTitle,
                url: targetUrl
            });
            
            closeAll();
            this.renderFolderList();
            if (!this.pendingChat || this.pendingChat.url === this.currentViewingChat.url) {
                this.updateCurrentChatState(this.currentViewingChat); 
            }
            if (!this.sidebarOpen) this.toggleSidebar();
        };

        document.getElementById('gfp-confirm-edit').onclick = async () => {
            const name = document.getElementById('gfp-input-rename').value.trim();
            if (name && this.currentFolderToEdit) {
                await this.storage.renameFolder(this.currentFolderToEdit.id, name);
                closeAll();
                this.renderFolderList();
            }
        };

        document.getElementById('gfp-btn-delete').onclick = async () => {
            if (!this.currentFolderToEdit) return;
            if (confirm("Delete this folder?")) {
                await this.storage.deleteFolder(this.currentFolderToEdit.id);
                closeAll();
                this.renderFolderList();
            }
        };
    }

    handleGlobalMouseMove(e) {
        if (this.sidebarOpen || document.querySelector('.gfp-modal-overlay.active')) {
            this.hideGhostBtn();
            return;
        }

        const path = e.composedPath();
        let target = null;
        for (let el of path) {
            if (el instanceof HTMLElement && this.gemini.isChatListItem(el)) {
                target = el;
                break;
            }
        }

        if (target && !target.id.startsWith('gfp-')) {
            this.currentHoverTarget = target;
            this.showGhostBtn(target);
        } else {
            const onGhost = path.some(el => el.id === 'gfp-ghost-add-btn');
            if (!onGhost) {
                this.hideGhostBtn();
            }
        }
    }

    showGhostBtn(targetEl) {
        if (!this.ghostBtn) return;
        const rect = targetEl.getBoundingClientRect();
        const btnSize = 28;
        const left = rect.right - 45;
        const top = rect.top + (rect.height / 2) - (btnSize / 2);
        this.ghostBtn.style.left = `${left}px`;
        this.ghostBtn.style.top = `${top}px`;
        this.ghostBtn.classList.add('visible');
    }

    hideGhostBtn() {
        if (this.ghostBtn) this.ghostBtn.classList.remove('visible');
        this.currentHoverTarget = null;
    }

    // === 渲染逻辑 ===
    toggleSidebar() {
        this.sidebarOpen = !this.sidebarOpen;
        const sidebar = document.getElementById('gfp-sidebar');
        if (this.sidebarOpen) sidebar.classList.add('open');
        else sidebar.classList.remove('open');
    }

    openModal(type) {
        document.querySelectorAll('.gfp-modal-overlay').forEach(el => el.classList.remove('active'));

        if (type === 'create-folder') {
            document.getElementById('modal-create-folder').classList.add('active');
            document.getElementById('gfp-input-create').value = '';
        } else if (type === 'select-folder') {
            if (this.storage.folders.length === 0) {
                alert("Please create a folder first!");
                return;
            }
            document.getElementById('modal-select-folder').classList.add('active');

            let prefill = "";
            if (this.pendingChat) {
                prefill = this.pendingChat.title;
            } else {
                prefill = this.currentViewingChat.title;
            }

            if (prefill === "Not Saved" || prefill.startsWith("Saved in:") || prefill === "Current Chat") {
                 let t = document.title.replace(' - Gemini', '').trim();
                 if (t && t !== "Gemini") prefill = t;
            }
            
            document.getElementById('gfp-input-save-title').value = prefill || "New Chat";
            this.renderSelectFolderList();
        } else if (type === 'edit-folder') {
            document.getElementById('modal-folder-settings').classList.add('active');
            document.getElementById('gfp-input-rename').value = this.currentFolderToEdit.name;
        }
    }

    renderFolderList() {
        const container = document.getElementById('gfp-folder-container');
        if (!container) return;
        container.innerHTML = '';

        if (this.storage.folders.length === 0) {
            container.innerHTML = '<div style="text-align:center;color:#666;margin-top:20px;font-size:12px;">No folders yet</div>';
            return;
        }

        this.storage.folders.forEach(folder => {
            const el = document.createElement('div');
            el.className = 'gfp-folder-item';
            el.innerHTML = `
                <div class="gfp-folder-header">
                    <span class="gfp-folder-arrow">▶</span>
                    <span class="gfp-folder-name">${folder.name}</span>
                    <div class="gfp-folder-tools">
                        <button class="gfp-tool-btn setting-btn">${Icons.settings}</button>
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
                        this.gemini.navigationContext = {
                            url: chat.url,
                            title: chat.title,
                            folderName: folder.name,
                            contextTitle: chat.title 
                        };

                        if (chat.url.startsWith('simulate-click://')) {
                            const success = this.gemini.simulateClickByTitle(chat.title);
                            if (!success) alert(`Could not locate chat "${chat.title}". Try scrolling the list.`);
                            if (success && this.sidebarOpen) this.toggleSidebar();
                        } else {
                            if (window.location.href === chat.url) {
                                this.gemini.triggerDetect(); // 刷新状态
                            } else {
                                window.location.href = chat.url;
                            }
                        }
                    };

                    const deleteBtn = document.createElement('div');
                    deleteBtn.className = 'gfp-chat-delete-btn';
                    deleteBtn.innerHTML = Icons.close; 
                    deleteBtn.onclick = async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (confirm(`Remove "${chat.title}"?`)) {
                            await this.storage.removeChatFromFolder(folder, chatIndex);
                            this.renderFolderList();
                            this.updateCurrentChatState(); // 刷新状态
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
                this.currentFolderToEdit = folder;
                this.openModal('edit-folder');
            };

            container.appendChild(el);
        });
    }

    renderSelectFolderList() {
        const container = document.getElementById('gfp-select-list-container');
        if (!container) return;
        
        container.innerHTML = '';
        this.selectedFolderIdForAdd = null;

        this.storage.folders.forEach(folder => {
            const div = document.createElement('div');
            div.className = 'gfp-select-item';
            div.innerHTML = `📁 ${folder.name}`;
            div.onclick = () => {
                document.querySelectorAll('.gfp-select-item').forEach(i => i.classList.remove('selected'));
                div.classList.add('selected');
                this.selectedFolderIdForAdd = folder.id;
            };
            container.appendChild(div);
        });
    }

    // 更新当前查看的聊天状态卡片
    updateCurrentChatState(chatInfo) {
        if (chatInfo) {
            const { savedInFolders, primaryTitle } = this.storage.findFoldersByUrl(chatInfo.url);
            
            this.currentViewingChat = {
                ...chatInfo,
                isSaved: savedInFolders.length > 0,
                savedFolderName: savedInFolders.join(", "), 
                title: primaryTitle || chatInfo.title,
                // 确保上下文被传递保存
                context: chatInfo.context 
            };
        }

        const titleEl = document.getElementById('gfp-current-title');
        const btnEl = document.getElementById('gfp-btn-save-current');
        const labelEl = document.querySelector('.gfp-card-label');

        if (!titleEl || !btnEl) return;

        titleEl.classList.remove('allow-wrap');
        titleEl.style.fontStyle = "normal";
        
        btnEl.className = 'gfp-btn-action gfp-btn-save';
        btnEl.innerText = "Save to Folder";
        
        const chat = this.currentViewingChat;

        if (chat.isValid) {
            if (chat.isSaved) {
                // === 核心修改逻辑 ===
                if (chat.context) {
                    // 场景 1: 从文件夹列表进入 (Contextual Mode)
                    // 上标：显示特定文件夹名 (绿色)
                    labelEl.innerText = `SAVED IN: ${chat.context.folderName.toUpperCase()}`;
                    labelEl.style.color = "var(--gfp-success)";
                    
                    // 标题：显示该文件夹下的特定命名 (普通白色)
                    titleEl.innerText = chat.context.contextTitle || chat.title;
                    titleEl.style.color = "var(--gfp-text-main)";
                    titleEl.classList.remove('allow-wrap'); // 标题通常较短，可以不换行，或者按需调整
                } else {
                    // 场景 2: 直接访问/刷新/侧边栏进入 (Direct Mode)
                    // 上标：Status (灰色)
                    labelEl.innerText = "STATUS";
                    labelEl.style.color = "var(--gfp-text-sub)";
                    
                    // 标题：Saved in: [所有文件夹] (绿色，概览)
                    titleEl.innerText = `Saved in: ${chat.savedFolderName}`;
                    titleEl.style.color = "var(--gfp-success)";
                    titleEl.classList.add('allow-wrap');
                }
                
                btnEl.innerText = "Add to another Folder";
            } else {
                // 未保存
                labelEl.innerText = "STATUS";
                labelEl.style.color = "var(--gfp-text-sub)";
                titleEl.innerText = "Not Saved";
                titleEl.style.color = "var(--gfp-text-sub)";
                titleEl.style.fontStyle = "italic";
                
                btnEl.innerText = "Save to Folder";
            }
        } else {
            labelEl.innerText = "STATUS";
            titleEl.innerText = "Select a chat...";
            titleEl.style.color = "var(--gfp-text-sub)";
            btnEl.classList.add('disabled');
            btnEl.innerText = "No Chat";
        }
    }
}