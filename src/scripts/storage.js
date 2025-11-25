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

    // === 核心修复：更智能的匹配逻辑 ===
    
    // 辅助：从 URL 中提取 Chat ID (例如 /app/abc12345 -> abc12345)
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

            // 检查是否存在：优先对比 Chat ID，如果提取不到 ID 则回退到全 URL 对比
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

    // 查询当前 URL 是否已在某个文件夹中
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