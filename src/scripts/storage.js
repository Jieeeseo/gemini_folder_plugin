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

    addChatToFolder(folderId, chatData) {
        const folder = this.folders.find(f => f.id === folderId);
        if (folder) {
            const exists = folder.chats.some(c => c.url === chatData.url);
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

        for (const folder of this.folders) {
            const found = folder.chats.find(c => c.url === url);
            if (found) {
                savedInFolders.push(folder.name);
                if (!primaryTitle) primaryTitle = found.title;
            }
        }
        return { savedInFolders, primaryTitle };
    }
}