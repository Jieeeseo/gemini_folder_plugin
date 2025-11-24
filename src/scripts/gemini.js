/**
 * GeminiAdapter
 * 负责解析 Gemini 网页结构、监听 URL 变化、提取对话信息
 */
class GeminiAdapter {
    constructor() {
        this.lastCheckedUrl = "";
        this.navigationContext = null; // 用于存储从文件夹跳转时的上下文
    }

    // 启动 URL 监听
    startMonitoring(callback) {
        this.monitorCallback = callback;
        setInterval(() => this.checkUrl(), 500);
    }

    checkUrl() {
        const url = window.location.href;
        if (url !== this.lastCheckedUrl) {
            // 如果上下文 URL 不匹配，清除上下文
            if (this.navigationContext && !url.includes(this.navigationContext.url)) {
                this.navigationContext = null;
            }
            this.lastCheckedUrl = url;
            
            // 触发回调
            if (this.monitorCallback) {
                // 即使还在 Loading，如果上下文存在，也应该传递上下文信息
                const info = this.detectCurrentChatInfo();
                
                // 如果检测结果还在 Loading 但我们有上下文，手动补全上下文
                if (!info.isValid && this.navigationContext && url.includes(this.navigationContext.url)) {
                     this.monitorCallback({ 
                         url, 
                         title: "Loading...", 
                         isValid: false,
                         context: this.navigationContext 
                     });
                } else {
                     // 正常传递检测结果（可能包含 context）
                     this.monitorCallback(info);
                }

                // 延迟多次检测，等待 Gemini 动态加载标题
                setTimeout(() => this.triggerDetect(), 500);
                setTimeout(() => this.triggerDetect(), 1200);
            }
        }
    }

    triggerDetect() {
        if (this.monitorCallback) {
            const info = this.detectCurrentChatInfo();
            // 修改：传递完整的 info 对象，确保 context 不丢失
            this.monitorCallback(info);
        }
    }

    // 获取当前页面的对话信息
    detectCurrentChatInfo() {
        const url = window.location.href;
        const isChat = url.includes('/app/') && !url.endsWith('/app') && !url.endsWith('/app/');

        if (!isChat) return { title: "No active chat", url, isValid: false };

        // 1. 优先使用上下文（如果刚从文件夹点击跳转）
        // 增加容错：确保 navigationContext 存在且 url 匹配
        if (this.navigationContext && url.includes(this.navigationContext.url)) {
            return {
                title: this.navigationContext.title, // 默认标题
                url: url,
                isValid: true,
                context: this.navigationContext // 关键：传递上下文
            };
        }

        // 2. 尝试从 DOM 获取标题
        let bestTitle = "";
        const match = window.location.pathname.match(/\/app\/([a-zA-Z0-9\-_]{10,})/);
        const chatId = match ? match[1] : null;

        if (chatId) {
            // 尝试 H1
            const h1 = document.querySelector('h1');
            if (h1 && h1.innerText) {
                const text = h1.innerText.trim();
                if (text.length > 0 && text !== "Gemini") bestTitle = text;
            }
            // 尝试侧边栏深层查找
            if (!bestTitle) {
                bestTitle = this.findTitleInSidebarDeep(chatId);
            }
        }

        // 3. 尝试 document.title
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

    // 辅助：从 DOM 元素提取对话数据（用于幽灵按钮）
    extractDataFromElement(el) {
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

    isChatListItem(el) {
        const href = el.getAttribute('href');
        if (href && href.includes('/app/')) {
            if (href.includes('support.google') || href.includes('accounts.google')) return false;
            return true;
        }
        if (el.getAttribute('data-id') || el.getAttribute('data-item-id')) return true;
        if (el.getAttribute('jsaction') && el.innerText.length > 2 && el.offsetHeight > 20) return true;
        return false;
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