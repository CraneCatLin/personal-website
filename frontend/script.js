/**
 * script.js - 静态笔记网站核心交互
 * 功能：加载目录树、渲染内容、前端路由、响应式侧滑
 * 依赖：marked.js (全局 marked)、highlight.js (全局 hljs) 和 katex.js (全局 katex)
 * 使用：确保 tree.json 与 index.html 同目录，所有资源路径基于根目录
 */

(function () {
    // ---------- 全局变量 ----------
    const treeContainer = document.getElementById('treeContainer');      // 目录树容器
    const viewer = document.getElementById('viewer');                    // 内容展示区
    const body = document.body;
    let currentFilePath = '';                // 当前加载的文件路径（相对根目录）
    let fileNameMap = new Map();       // 文件名（无扩展名） -> 完整路径
    let fullPathNoExtMap = new Map();  // 完整路径（无扩展名） -> 完整路径
    let treeData = null;                     // 存储解析后的树数据
    let defaultNotePath = null;              // 默认第一个笔记路径（供"笔记"按钮使用）
    const SUPPORTED_IMG = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp'];
    const SUPPORTED_VIDEO = ['.mp4', '.webm', '.ogg', '.mov'];

    // 顶栏元素
    const menuToggle = document.getElementById('menuToggle');
    const homeBtn = document.getElementById('homeBtn');
    const notesBtn = document.getElementById('notesBtn');
    const friendsBtn = document.getElementById('friendsBtn');
    const logBtn = document.getElementById('logBtn');

    // ---------- 工具函数：获取文件扩展名 ----------
    function getFileExtension(filename) {
        const dotIndex = filename.lastIndexOf('.');
        return dotIndex === -1 ? '' : filename.slice(dotIndex + 1).toLowerCase();
    }

    // ---------- 工具函数：根据扩展名返回对应图标 ----------
    function getFileIcon(ext) {
        const iconMap = {
            // 笔记/文档
            'md': '📝',
            'txt': '📃',
            'pdf': '📕',
            'doc': '📘',
            'docx': '📘',
            // 代码
            'py': '🐍',
            'js': '🟨',
            'ts': '🔷',
            'html': '🌐',
            'css': '🎨',
            'c': '⚙️',
            'cpp': '⚙️',
            'h': '⚙️',
            'hpp': '⚙️',
            'java': '☕',
            'rs': '🦀',
            'go': '🔵',
            'json': '📋',
            'xml': '📋',
            'yaml': '📋',
            'yml': '📋',
            'toml': '📋',
            // 图片
            'jpg': '🖼️',
            'jpeg': '🖼️',
            'png': '🖼️',
            'gif': '🖼️',
            'svg': '🖼️',
            'webp': '🖼️',
            'bmp': '🖼️',
            // 视频
            'mp4': '🎬',
            'webm': '🎬',
            'mov': '🎬',
            // 其他
            'zip': '📦',
            'rar': '📦',
            '7z': '📦',
            'gz': '📦',
            'exe': '⚡',
            'sh': '💻',
            'bat': '💻',
            'ps1': '💻',
        };
        return iconMap[ext] || '📄';
    }
    const getExtIcon = getFileIcon; // 别名，供首页卡片和随机推荐使用
    window.getFileIcon = getFileIcon;
    window.getExtIcon = getExtIcon;
    function setBackgroundForPage(isHomePage) {
        body.classList.remove('note-page', 'friends-page', 'log-page');
        if (isHomePage === false) {
            // 笔记页背景
            body.classList.add('note-page');
        } else if (isHomePage === 'friends') {
            // 友链页背景 — 与首页共用 home-bg.jpg
            body.classList.add('friends-page');
        } else if (isHomePage === 'log') {
            // 日志页背景
            body.classList.add('log-page');
        }
        // isHomePage === true 时只移除 class，使用 body::before 默认首页背景
    }
    // ---------- 工具函数：根据文件路径从树数据中查找节点 ----------
    function findFileNodeInTree(nodes, targetPath) {
        for (const node of nodes) {
            if (node.type === 'file') {
                if (node.path === targetPath) {
                    return node;
                }
            } else if (node.type === 'folder' && node.children) {
                const found = findFileNodeInTree(node.children, targetPath);
                if (found) return found;
            }
        }
        return null;
    }
    /* 笔记渲染模块已移至 js/notes.js */
    // 转义 HTML 防止 XSS（使用 DOM API 避免字面量中的 HTML 实体被格式化器破坏）
    function escapeHtml(unsafe) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(unsafe));
        return div.innerHTML;
    }
    /* 首页模块已移至 js/home.js */
    // 显示内容区域骨架屏
    function showContentSkeleton() {
        window.TOCModule.clearTOC();
        viewer.innerHTML = `
        <div class="markdown-body" style="padding: 1rem 0;">
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-line"></div>
            <div class="skeleton skeleton-line short"></div>
            <div class="skeleton skeleton-line"></div>
            <div class="skeleton skeleton-line"></div>
            <div style="margin: 1.5rem 0;">
            <div class="skeleton skeleton-code"></div>
            </div>
            <div class="skeleton skeleton-line" style="width: 40%;"></div>
            <div class="skeleton skeleton-line"></div>
        </div>
        `;
    }

    // 渲染笔记库过渡页（点击"笔记"按钮后默认显示）
    function renderNotesHub() {
        window.TOCModule.clearTOC();
        const hubHTML = `
        <div class="markdown-body">
            <h1>笔记库</h1>
            <blockquote>
            <p>笔记采用 Markdown 编写，支持 LaTeX 数学公式、代码高亮等。如内容有错误欢迎指正~</p>
            <p>由于部分渲染逻辑是手搓的，可能出现图片链接/文本链接/公式的解析渲染失败/错误的情况，如发现希望可以联系我修正~</p>
        </div>
        `;
        viewer.innerHTML = hubHTML;
        document.body.classList.remove('homepage', 'log-page', 'hide-sidebar');
        setBackgroundForPage(false);
        document.title = '笔记库';
        document.querySelectorAll('.tree .item.active').forEach(el => el.classList.remove('active'));
        currentFilePath = '';
    }
    /* 友链模块已移至 js/friends.js */

    // ---------- 根据 hash 加载内容 ----------
    function loadFromHash() {
        const hash = window.location.hash.slice(1) || '';
        if (!hash) {
            window.HomeModule.renderDefaultAbout();
            document.querySelectorAll('.tree .item.active').forEach(el => el.classList.remove('active'));
            currentFilePath = '';
            document.body.classList.add('homepage', 'hide-sidebar');
            setBackgroundForPage(true);
            return;
        }
        if (hash === 'notes' || hash === 'library' || hash === 'notebook') {
            renderNotesHub();
            return;
        }
        if (hash === 'about') {
            window.HomeModule.renderDefaultAbout();
            document.querySelectorAll('.tree .item.active').forEach(el => el.classList.remove('active'));
            currentFilePath = '';
            document.body.classList.remove('log-page');
            document.body.classList.add('homepage', 'hide-sidebar');
            setBackgroundForPage(true);
            return;
        }

        // 友链页面
        if (hash === 'friends') {
            body.classList.remove('homepage', 'log-page');
            body.classList.add('hide-sidebar');
            setBackgroundForPage('friends');
            window.FriendsModule.renderFriendsPage();
            return;
        }

        // 日志页面
        if (hash === 'logs') {
            body.classList.remove('homepage');
            body.classList.add('log-page', 'hide-sidebar');
            setBackgroundForPage('log');
            window.LogModule.renderLogPage();
            return;
        }

        // 日志文件阅读 — 通过 #log:文件路径 标识
        const decodedHash = decodeURIComponent(hash);
        if (decodedHash.startsWith('log:')) {
            body.classList.remove('homepage');
            body.classList.add('log-page', 'hide-sidebar');
            setBackgroundForPage('log');
            const logPath = decodedHash.slice(4);
            window.LogModule.loadLogFile(logPath);
            return;
        }

        // 移除 homepage / log-page / hide-sidebar 类以显示侧边栏和 TOC
        body.classList.remove('homepage', 'log-page', 'hide-sidebar');
        setBackgroundForPage(false);
        const filePath = decodeURIComponent(hash);
        loadFileByPath(filePath);
    }

    // ---------- 加载文件：根据路径获取并渲染 ----------
    function loadFileByPath(filePath) {
        showContentSkeleton();
        const fullPath = '/public/' + filePath;
        const ext = getFileExtension(filePath).toLowerCase();

        if (SUPPORTED_IMG.includes('.' + ext)) {
            window.NotesModule.renderImage(fullPath);
            updateActiveTreeItem(filePath);
            currentFilePath = filePath;
        }
        else if (SUPPORTED_VIDEO.includes('.' + ext)) {
            window.NotesModule.renderVideo(fullPath);
            updateActiveTreeItem(filePath);
            currentFilePath = filePath;
        }
        else if (ext === 'md') {
            fetch(fullPath, {
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            })
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    return response.text();
                })
                .then(markdown => {
                    window.NotesModule.renderMarkdown(markdown, filePath);
                })
                .catch(error => {
                    viewer.innerHTML = `<div class="markdown-body error"><h2>❌ 加载失败</h2><p>无法加载文件 ${filePath} (${error.message})</p></div>`;
                });
            updateActiveTreeItem(filePath);
            currentFilePath = filePath;
        }
        else {
            window.NotesModule.renderUnsupported(fullPath);
            updateActiveTreeItem(filePath);
            currentFilePath = filePath;
        }
    }

    // 更新树中当前选中项的高亮
    function updateActiveTreeItem(filePath) {
        document.querySelectorAll('.tree .item.active').forEach(el => el.classList.remove('active'));
        const items = document.querySelectorAll('.tree .file .item');
        for (let item of items) {
            if (item.dataset.path === filePath) {
                item.classList.add('active');
                break;
            }
        }
    }

    /* 笔记渲染模块已移至 js/notes.js */

    function processMathFormulas(text) {
        text = text.replace(/\$\$(.*?)\$\$/gs, function (match, formula) {
            try {
                return window.katex.renderToString(formula, { throwOnError: false, displayMode: true });
            } catch (err) {
                console.warn('KaTeX 块级公式渲染错误:', err);
                return match;
            }
        });

        text = text.replace(/\\\((.*?)\\\)/g, function (match, formula) {
            try {
                return window.katex.renderToString(formula, { throwOnError: false, displayMode: false });
            } catch (err) {
                console.warn('KaTeX 行内公式渲染错误:', err);
                return match;
            }
        });

        text = text.replace(/\B\$(.+?)\$\B/g, function (match, formula) {
            try {
                return window.katex.renderToString(formula, { throwOnError: false, displayMode: false });
            } catch (err) {
                console.warn('KaTeX 行内公式渲染错误:', err);
                return match;
            }
        });

        return text;
    }
    /* 目录树构建/绑定/加载已移至 js/tree.js */
    // 防抖函数
    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    function enhanceCodeBlocks() {
        const viewer = document.getElementById('viewer');
        if (!viewer) return;

        const pres = viewer.querySelectorAll('pre');
        pres.forEach(pre => {
            if (pre.parentElement && pre.parentElement.classList.contains('code-block-wrapper')) {
                return;
            }

            const wrapper = document.createElement('div');
            wrapper.className = 'code-block-wrapper';
            wrapper.style.position = 'relative';

            const btn = document.createElement('button');
            btn.className = 'code-copy-btn';
            btn.title = '复制代码';
            btn.textContent = 'Copy';

            pre.parentNode.insertBefore(wrapper, pre);
            wrapper.appendChild(pre);
            wrapper.appendChild(btn);
        });

        viewer.addEventListener('click', (e) => {
            const btn = e.target.closest('.code-copy-btn');
            if (!btn) return;

            const wrapper = btn.closest('.code-block-wrapper');
            if (!wrapper) return;

            const pre = wrapper.querySelector('pre');
            if (!pre) return;

            const code = pre.querySelector('code') || pre;
            const text = code.innerText || code.textContent;

            navigator.clipboard.writeText(text).then(() => {
                btn.textContent = 'Success';
                setTimeout(() => {
                    btn.textContent = 'Copy';
                }, 1500);
            }).catch(err => {
                console.error('复制失败:', err);
                btn.textContent = 'Failed';
                setTimeout(() => {
                    btn.textContent = 'Copy';
                }, 1500);
            });
        });
    }
    /* 目录树加载函数已移至 js/tree.js */
    /* 日志模块已移至 js/log.js */

    // ---------- 路由监听 ----------
    window.addEventListener('hashchange', () => {
        loadFromHash();
    });

    // ---------- 顶栏交互 ----------
    function initTOCSidebar() {
        const toggleToc = document.getElementById('toggleToc');
        const tocSidebar = document.getElementById('tocSidebar');
        if (!toggleToc || !tocSidebar) return;

        toggleToc.addEventListener('click', () => {
            tocSidebar.classList.toggle('collapsed');
            toggleToc.textContent = tocSidebar.classList.contains('collapsed') ? '⏵⏴' : '⏴⏵';
        });
    }
    function initTopbar() {
        initTOCSidebar();
        // ========== 移动端侧边栏切换（overlay 模式） ==========
        const sidebarEl = document.getElementById('sidebar');
        const sidebarOverlay = document.getElementById('sidebarOverlay');

        function toggleSidebarOpen(open) {
            if (!sidebarEl) return;
            const isOpen = open !== undefined ? open : !sidebarEl.classList.contains('open');
            sidebarEl.classList.toggle('open', isOpen);
            if (sidebarOverlay) sidebarOverlay.classList.toggle('active', isOpen);
            document.body.style.overflow = isOpen ? 'hidden' : '';
        }

        if (menuToggle) {
            menuToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleSidebarOpen();
            });
        }

        // Overlay click to close sidebar
        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', function () {
                toggleSidebarOpen(false);
            });
        }

        // ========== 侧边栏移动端导航按钮 ==========
        const sidebarNavBtns = document.querySelectorAll('.sidebar-nav-btn');
        sidebarNavBtns.forEach(btn => {
            btn.addEventListener('click', function () {
                const hash = this.dataset.hash;
                if (hash === '') {
                    window.location.hash = '#/';
                } else if (hash === 'notes') {
                    window.location.hash = '#/notes';
                } else if (hash === 'friends') {
                    window.location.hash = '#/friends';
                } else if (hash === 'logs') {
                    window.location.hash = '#/logs';
                }
                // Close sidebar on mobile after navigation
                toggleSidebarOpen(false);
            });
        });

        if (homeBtn) {
            homeBtn.addEventListener('click', () => {
                window.location.hash = '';
                body.classList.remove('sidebar-open');
            });
        }

        if (notesBtn) {
            notesBtn.addEventListener('click', () => {
                body.classList.remove('homepage');
                const currentHash = window.location.hash.slice(1);
                if (currentHash !== 'notes') {
                    window.location.hash = '#notes';
                } else {
                    renderNotesHub();
                }
                body.classList.remove('sidebar-open');
            });
        }

        if (friendsBtn) {
            friendsBtn.addEventListener('click', () => {
                window.location.hash = '#friends';
                body.classList.remove('sidebar-open');
            });
        }

        if (logBtn) {
            logBtn.addEventListener('click', () => {
                window.location.hash = '#logs';
                body.classList.remove('sidebar-open');
            });
        }

        document.addEventListener('click', (e) => {
            if (body.classList.contains('sidebar-open')) {
                const isClickInsideSidebar = e.target.closest('.sidebar');
                const isClickMenuToggle = e.target.closest('#menuToggle');
                if (!isClickInsideSidebar && !isClickMenuToggle) {
                    body.classList.remove('sidebar-open');
                }
            }
        });

        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                body.classList.remove('sidebar-open');
            }
        });
    }

    // 暴露 IIFE 内部变量供首页模块、笔记模块和 tree.js 使用（使用 getter 确保获取实时值）
    Object.defineProperty(window, 'treeData', { get: () => treeData, set: (v) => { treeData = v; } });
    Object.defineProperty(window, 'defaultNotePath', { get: () => defaultNotePath, set: (v) => { defaultNotePath = v; } });
    Object.defineProperty(window, 'loadFileByPath', { get: () => loadFileByPath });
    Object.defineProperty(window, 'loadFromHash', { get: () => loadFromHash });
    Object.defineProperty(window, 'fileNameMap', { get: () => fileNameMap });
    Object.defineProperty(window, 'fullPathNoExtMap', { get: () => fullPathNoExtMap });

    // ---------- 初始化 ----------
    function init() {
        window.TreeModule.loadTree();
        initTopbar();

        const mainContent = document.getElementById('mainContent');
        if (mainContent) {
            const onScroll = debounce(window.TOCModule.updateTOCActive, 100);
            mainContent.addEventListener('scroll', onScroll, { passive: true });
        }

        if (!window.marked) console.warn('marked.js 未加载，Markdown 将无法渲染。');
        if (!window.hljs) console.warn('highlight.js 未加载，代码块将无高亮。');
        if (!window.katex) console.warn('katex 未加载，数学公式将无法渲染。');
    }

    init();
})();