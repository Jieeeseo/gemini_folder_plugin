/**
 * StorageService
 * 负责与 Chrome Storage 交互，以及管理文件夹数据状态
 */
class StorageService {
    constructor() {
        this.STORAGE_KEY = 'gemini_folder_data_v2';
        this.folders = [];
    }

    async load() {
        try {
            const data = await chrome.storage.local.get(this.STORAGE_KEY);
            if (data[this.STORAGE_KEY]) {
                this.folders = data[this.STORAGE_KEY];
            }
        } catch (e) {
            console.error("Failed to load data:", e);
        }
    }

    async save() {
        try {
            await chrome.storage.local.set({ [this.STORAGE_KEY]: this.folders });
        } catch (e) {
            console.error("Failed to save data:", e);
        }
    }

    addFolder(name) {
        this.folders.push({ id: Date.now(), name: name, chats: [] });
        return this.save();
    }

    renameFolder(id, newName) {
        const folder = this.folders.find(f => f.id === id);
        if (folder) {
            folder.name = newName;
            return this.save();
        }
    }

    deleteFolder(id) {
        this.folders = this.folders.filter(f => f.id !== id);
        return this.save();
    }

    // === 新增：重命名对话 ===
    renameChat(folderId, chatIndex, newTitle) {
        const folder = this.folders.find(f => f.id === folderId);
        if (folder && folder.chats[chatIndex]) {
            folder.chats[chatIndex].title = newTitle;
            return this.save();
        }
        return Promise.resolve();
    }

    // === 文件夹排序 ===
    reorderFolders(fromIndex, toIndex) {
        if (fromIndex === toIndex) return Promise.resolve();
        if (fromIndex < 0 || fromIndex >= this.folders.length || toIndex < 0 || toIndex >= this.folders.length) return Promise.resolve();
        
        const [movedFolder] = this.folders.splice(fromIndex, 1);
        this.folders.splice(toIndex, 0, movedFolder);
        
        return this.save();
    }

    // === 对话排序 (仅限同文件夹内) ===
    reorderChats(folderId, fromIndex, toIndex) {
        const folder = this.folders.find(f => f.id === folderId);
        if (!folder) return Promise.resolve();
        
        if (fromIndex === toIndex) return Promise.resolve();
        if (fromIndex < 0 || fromIndex >= folder.chats.length || toIndex < 0 || toIndex >= folder.chats.length) return Promise.resolve();

        const [movedChat] = folder.chats.splice(fromIndex, 1);
        folder.chats.splice(toIndex, 0, movedChat);

        return this.save();
    }

    // 辅助：从 URL 中提取 Chat ID
    getChatId(url) {
        try {
            const match = url.match(/\/app\/([a-zA-Z0-9\-_]+)/);
            return match ? match[1] : null;
        } catch (e) {
            return null;
        }
    }

    addChatToFolder(folderId, chatData) {
        const folder = this.folders.find(f => f.id === folderId);
        if (folder) {
            const newChatId = this.getChatId(chatData.url);
            const exists = folder.chats.some(c => {
                const existingId = this.getChatId(c.url);
                if (newChatId && existingId) {
                    return newChatId === existingId;
                }
                return c.url === chatData.url;
            });

            if (!exists) {
                folder.chats.push({
                    title: chatData.title,
                    url: chatData.url
                });
                return this.save();
            }
        }
        return Promise.resolve();
    }

    removeChatFromFolder(folder, chatIndex) {
        folder.chats.splice(chatIndex, 1);
        return this.save();
    }

    findFoldersByUrl(url) {
        const savedInFolders = [];
        let primaryTitle = null;
        const currentChatId = this.getChatId(url);

        for (const folder of this.folders) {
            let found = folder.chats.find(c => c.url === url);
            if (!found && currentChatId) {
                found = folder.chats.find(c => this.getChatId(c.url) === currentChatId);
            }

            if (found) {
                savedInFolders.push(folder.name);
                if (!primaryTitle) primaryTitle = found.title;
            }
        }
        return { savedInFolders, primaryTitle };
    }
}