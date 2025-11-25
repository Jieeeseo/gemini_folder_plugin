/**
 * GeminiAdapter
 * 负责解析 Gemini 网页结构、监听 URL 变化、提取对话信息
 */
class GeminiAdapter {
    constructor() {
        this.lastCheckedUrl = "";
        this.navigationContext = null;
    }

    startMonitoring(callback) {
        this.monitorCallback = callback;
        setInterval(() => this.checkUrl(), 500);
    }

    checkUrl() {
        const url = window.location.href;
        if (url !== this.lastCheckedUrl) {
            if (this.navigationContext && !url.includes(this.navigationContext.url)) {
                this.navigationContext = null;
            }
            this.lastCheckedUrl = url;
            
            if (this.monitorCallback) {
                const info = this.detectCurrentChatInfo();
                if (!info.isValid && this.navigationContext && url.includes(this.navigationContext.url)) {
                     this.monitorCallback({ 
                         url, 
                         title: "Loading...", 
                         isValid: false,
                         context: this.navigationContext 
                     });
                } else {
                     this.monitorCallback(info);
                }

                setTimeout(() => this.triggerDetect(), 500);
                setTimeout(() => this.triggerDetect(), 1200);
            }
        }
    }

    triggerDetect() {
        if (this.monitorCallback) {
            const info = this.detectCurrentChatInfo();
            this.monitorCallback(info);
        }
    }

    detectCurrentChatInfo() {
        const url = window.location.href;
        const isChat = url.includes('/app/') && !url.endsWith('/app') && !url.endsWith('/app/');

        if (!isChat) return { title: "No active chat", url, isValid: false };

        // 优先使用 context
        if (this.navigationContext && url.includes(this.navigationContext.url)) {
            return {
                title: this.navigationContext.title,
                url: url,
                isValid: true,
                context: this.navigationContext
            };
        }

        let bestTitle = "";
        const match = window.location.pathname.match(/\/app\/([a-zA-Z0-9\-_]{10,})/);
        const chatId = match ? match[1] : null;

        if (chatId) {
            const h1 = document.querySelector('h1');
            if (h1 && h1.innerText) {
                const text = h1.innerText.trim();
                if (text.length > 0 && text !== "Gemini") bestTitle = text;
            }
            if (!bestTitle) {
                bestTitle = this.findTitleInSidebarDeep(chatId);
            }
        }

        if (!bestTitle) {
            let docTitle = document.title.replace(' - Gemini', '').replace('Google Gemini', '').trim();
            if (docTitle && docTitle !== "Gemini") bestTitle = docTitle;
        }

        if (bestTitle && bestTitle !== "Gemini" && !bestTitle.includes("Google 账号")) {
            return { title: bestTitle, url, isValid: true };
        }

        return { title: "Current Chat", url, isValid: true };
    }

    findTitleInSidebarDeep(chatId) {
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

    simulateClickByTitle(targetTitle) {
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
                    return true;
                }
                node = walker.nextNode();
            }
        }
        return false;
    }
}