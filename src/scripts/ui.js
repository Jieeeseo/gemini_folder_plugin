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
        this.chatToRename = null; 
        
        this.ROOT_ID = 'gfp-root';
        
        // 拖拽状态
        this.dragSrcIndex = null;
        this.dragSrcChat = null;
    }

    init() {
        this.cleanupOldDOM();
        this.createRootContainer();
        this.injectMenuButton();
        this.injectSidebar();
        this.injectModals();
    }

    createRootContainer() {
        const root = document.createElement('div');
        root.id = this.ROOT_ID;
        document.body.appendChild(root);
    }

    cleanupOldDOM() {
        const existingRoot = document.getElementById(this.ROOT_ID);
        if (existingRoot) existingRoot.remove();

        const idsToRemove = [
            'gfp-menu-btn', 
            'gfp-sidebar',
            'gfp-ghost-add-btn',
            'modal-create-folder',
            'modal-select-folder',
            'modal-folder-settings',
            'modal-rename-chat',
            'gfp-select-list-container'
        ];
        idsToRemove.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });

        document.querySelectorAll('.gfp-modal-overlay').forEach(el => el.remove());
    }

    getRoot() {
        return document.getElementById(this.ROOT_ID) || document.body;
    }

    injectMenuButton() {
        const btn = document.createElement('div');
        btn.id = 'gfp-menu-btn';
        btn.innerHTML = Icons.menu;
        btn.title = "My Folders";
        btn.onclick = () => this.toggleSidebar();
        this.getRoot().appendChild(btn);
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
        this.getRoot().appendChild(sidebar);

        document.getElementById('gfp-close-btn').onclick = () => this.toggleSidebar();
        document.getElementById('gfp-btn-new-folder').onclick = () => this.openModal('create-folder');
        document.getElementById('gfp-btn-save-current').onclick = () => {
            if (this.currentViewingChat.isValid) {
                this.openModal('select-folder');
            }
        };
    }

    injectModals() {
        // 在 HTML 中添加 placeholder
        const modalsHTML = `
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
                    <input type="text" class="gfp-input" id="gfp-input-save-title" placeholder="Please enter a chat name">
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

            <div id="modal-rename-chat" class="gfp-modal-overlay">
                <div class="gfp-modal">
                    <div class="gfp-modal-title">Rename Chat</div>
                    <input type="text" class="gfp-input" id="gfp-input-rename-chat">
                    <div class="gfp-modal-actions">
                        <button class="gfp-btn-modal gfp-btn-cancel" id="gfp-cancel-rename-chat">Cancel</button>
                        <button class="gfp-btn-modal gfp-btn-confirm" id="gfp-confirm-rename-chat">Save</button>
                    </div>
                </div>
            </div>
        `;
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = modalsHTML;
        while (tempDiv.firstChild) {
            this.getRoot().appendChild(tempDiv.firstChild);
        }

        this.bindModalEvents();
    }

    bindModalEvents() {
        const closeAll = () => document.querySelectorAll('.gfp-modal-overlay').forEach(el => el.classList.remove('active'));

        document.getElementById('gfp-cancel-create').onclick = closeAll;
        document.getElementById('gfp-cancel-select').onclick = closeAll;
        document.getElementById('gfp-cancel-edit').onclick = closeAll;
        document.getElementById('gfp-cancel-rename-chat').onclick = closeAll;

        document.getElementById('gfp-confirm-create').onclick = async () => {
            const name = document.getElementById('gfp-input-create').value.trim();
            if (!name) return;
            await this.storage.addFolder(name);
            closeAll();
            this.renderFolderList();
        };

        // === 核心修改：保存对话逻辑 ===
        document.getElementById('gfp-confirm-save').onclick = async () => {
            // 1. 检查是否选择文件夹
            if (!this.selectedFolderIdForAdd) {
                alert("Please select a folder!");
                return;
            }
            
            const titleInput = document.getElementById('gfp-input-save-title');
            let finalTitle = titleInput.value.trim();

            // 2. 检查是否输入了标题 (强制要求)
            if (!finalTitle) {
                alert("Please enter a chat name!");
                titleInput.focus(); // 聚焦输入框
                return;
            }

            const targetUrl = this.currentViewingChat.url;

            await this.storage.addChatToFolder(this.selectedFolderIdForAdd, {
                title: finalTitle,
                url: targetUrl
            });
            
            closeAll();
            this.renderFolderList();
            this.updateCurrentChatState(this.currentViewingChat);
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

        document.getElementById('gfp-confirm-rename-chat').onclick = async () => {
            const name = document.getElementById('gfp-input-rename-chat').value.trim();
            if (name && this.chatToRename) {
                await this.storage.renameChat(this.chatToRename.folderId, this.chatToRename.index, name);
                closeAll();
                this.renderFolderList();
                this.updateCurrentChatState(this.currentViewingChat);
            }
        };
    }

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

            // === 核心修改：预填逻辑 ===
            const titleInput = document.getElementById('gfp-input-save-title');
            
            // 如果对话已经保存过 (isSaved = true)，则预填它已有的名字，方便用户参考或仅修改文件夹
            // 如果是新对话 (isSaved = false)，则清空，并显示 placeholder 提示输入
            if (this.currentViewingChat.isSaved) {
                titleInput.value = this.currentViewingChat.title;
            } else {
                titleInput.value = "";
            }
            
            this.renderSelectFolderList();
        } else if (type === 'edit-folder') {
            document.getElementById('modal-folder-settings').classList.add('active');
            document.getElementById('gfp-input-rename').value = this.currentFolderToEdit.name;
        } else if (type === 'rename-chat') {
            document.getElementById('modal-rename-chat').classList.add('active');
            const folder = this.storage.folders.find(f => f.id === this.chatToRename.folderId);
            if (folder && folder.chats[this.chatToRename.index]) {
                document.getElementById('gfp-input-rename-chat').value = folder.chats[this.chatToRename.index].title;
            }
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

        this.storage.folders.forEach((folder, index) => {
            const el = document.createElement('div');
            el.className = 'gfp-folder-item';
            
            el.draggable = true;
            el.dataset.index = index;

            el.addEventListener('dragstart', (e) => {
                if (e.target.closest('.gfp-chat-item-wrapper')) return;
                this.dragSrcIndex = index;
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', index);
                el.classList.add('dragging');
            });

            el.addEventListener('dragend', (e) => {
                el.classList.remove('dragging');
                this.dragSrcIndex = null;
                container.querySelectorAll('.gfp-folder-item').forEach(item => item.classList.remove('drag-over'));
            });

            el.addEventListener('dragover', (e) => {
                if (this.dragSrcChat) return;
                if (this.dragSrcIndex === null) return; 
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                el.classList.add('drag-over');
                Array.from(container.children).forEach(child => {
                    if (child !== el) child.classList.remove('drag-over');
                });
            });

            el.addEventListener('drop', async (e) => {
                e.stopPropagation();
                if (this.dragSrcIndex === null) return; 
                el.classList.remove('drag-over');
                const targetIndex = parseInt(el.dataset.index);
                if (this.dragSrcIndex !== null && this.dragSrcIndex !== targetIndex) {
                    await this.storage.reorderFolders(this.dragSrcIndex, targetIndex);
                    this.renderFolderList();
                }
                return false;
            });

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
                    
                    wrapper.draggable = true;
                    
                    wrapper.addEventListener('dragstart', (e) => {
                        e.stopPropagation();
                        this.dragSrcChat = { folderId: folder.id, index: chatIndex };
                        e.dataTransfer.effectAllowed = 'move';
                        wrapper.classList.add('dragging');
                    });

                    wrapper.addEventListener('dragend', (e) => {
                        e.stopPropagation();
                        wrapper.classList.remove('dragging');
                        this.dragSrcChat = null;
                        container.querySelectorAll('.gfp-chat-item-wrapper.drag-over').forEach(i => i.classList.remove('drag-over'));
                    });

                    wrapper.addEventListener('dragover', (e) => {
                        if (!this.dragSrcChat || this.dragSrcChat.folderId !== folder.id) return;
                        e.stopPropagation(); 
                        e.preventDefault(); 
                        e.dataTransfer.dropEffect = 'move';
                        wrapper.classList.add('drag-over');
                        Array.from(listContainer.children).forEach(child => {
                            if (child !== wrapper) child.classList.remove('drag-over');
                        });
                    });

                    wrapper.addEventListener('drop', async (e) => {
                        e.stopPropagation();
                        if (!this.dragSrcChat || this.dragSrcChat.folderId !== folder.id) return;
                        wrapper.classList.remove('drag-over');
                        const fromIndex = this.dragSrcChat.index;
                        const toIndex = chatIndex;
                        if (fromIndex !== toIndex) {
                            await this.storage.reorderChats(folder.id, fromIndex, toIndex);
                            this.renderFolderList();
                            setTimeout(() => {
                                const newFolderEl = container.children[index]; 
                                if(newFolderEl) {
                                    const header = newFolderEl.querySelector('.gfp-folder-header');
                                    const arrow = newFolderEl.querySelector('.gfp-folder-arrow');
                                    const list = newFolderEl.querySelector('.gfp-chat-list');
                                    if(list && arrow) {
                                        list.classList.add('show');
                                        arrow.classList.add('expanded');
                                        arrow.innerText = '▼';
                                    }
                                }
                            }, 0);
                        }
                    });

                    const a = document.createElement('a');
                    a.className = 'gfp-chat-link';
                    a.style.cursor = 'pointer';
                    a.innerText = `• ${chat.title}`;
                    a.title = chat.title;
                    
                    a.onclick = (e) => {
                        e.preventDefault();
                        this.gemini.setNavigationContext({
                            url: chat.url,
                            title: chat.title,
                            folderName: folder.name,
                            contextTitle: chat.title 
                        });

                        if (chat.url.startsWith('simulate-click://')) {
                            const success = this.gemini.simulateClickByTitle(chat.title);
                            if (!success) alert(`Could not locate chat "${chat.title}". Try scrolling the list.`);
                            if (success && this.sidebarOpen) this.toggleSidebar();
                        } else {
                            if (window.location.href === chat.url) {
                                window.location.reload();
                            } else {
                                window.location.href = chat.url;
                            }
                        }
                    };

                    const editBtn = document.createElement('div');
                    editBtn.className = 'gfp-chat-edit-btn'; 
                    editBtn.innerHTML = Icons.edit;
                    editBtn.title = 'Rename chat';
                    editBtn.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.chatToRename = { folderId: folder.id, index: chatIndex };
                        this.openModal('rename-chat');
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
                            this.updateCurrentChatState(this.currentViewingChat); 
                        }
                    };

                    wrapper.appendChild(a);
                    wrapper.appendChild(editBtn); 
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
        if (!container) {
            console.error("GFP Error: Select Folder List Container not found in DOM");
            return;
        }
        
        container.innerHTML = '';
        this.selectedFolderIdForAdd = null;

        if (!this.storage.folders || this.storage.folders.length === 0) {
            container.innerHTML = '<div style="padding:10px; color:#666; font-size:13px; text-align:center;">No folders created yet</div>';
            return;
        }

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

    updateCurrentChatState(chatInfo) {
        if (chatInfo) {
            const { savedInFolders, primaryTitle } = this.storage.findFoldersByUrl(chatInfo.url);
            
            this.currentViewingChat = {
                ...chatInfo,
                isSaved: savedInFolders.length > 0,
                savedFolderName: savedInFolders.join(", "), 
                title: primaryTitle || chatInfo.title,
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
                if (chat.context) {
                    labelEl.innerText = `SAVED IN: ${chat.context.folderName.toUpperCase()}`;
                    labelEl.style.color = "var(--gfp-success)";
                    titleEl.innerText = chat.context.contextTitle || chat.title;
                    titleEl.style.color = "var(--gfp-text-main)";
                    titleEl.classList.remove('allow-wrap');
                } else {
                    labelEl.innerText = "STATUS";
                    labelEl.style.color = "var(--gfp-text-sub)";
                    titleEl.innerText = `Saved in: ${chat.savedFolderName}`;
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
            labelEl.innerText = "STATUS";
            titleEl.innerText = "Select a chat...";
            titleEl.style.color = "var(--gfp-text-sub)";
            btnEl.classList.add('disabled');
            btnEl.innerText = "No Chat";
        }
    }
}