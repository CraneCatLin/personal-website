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
    // 将标题文本转为 URL 友好的 id
    function slugify(text) {
        return text
            .toString()
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-')
            .replace(/[^\w\u4e00-\u9fa5\-]+/g, '') // 保留中文字符和连字符
            .replace(/\-\-+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    // 从内联 token 中提取纯文本（处理加粗、链接等）
    function getInlineText(token) {
        if (!token) return '';
        if (token.type === 'text') return token.content;
        if (token.children) {
            return token.children.map(child => getInlineText(child)).join('');
        }
        return token.content || '';
    }
    // 将扁平 headings 转换为嵌套 HTML 目录
    function renderTOCFromDOM() {
        const tocContainer = document.getElementById('tocContent');
        if (!tocContainer) return;

        // 获取所有标题元素，排除 .note-title（手动添加的文件名标题）
        const headings = Array.from(document.querySelectorAll('#viewer :is(h1, h2, h3, h4, h5, h6):not(.note-title)'));
        if (headings.length === 0) {
            tocContainer.innerHTML = '<p style="color: var(--text-muted); padding: 0.5rem;">无目录/文档空白</p>';
            return;
        }

        // 构建标题数组，包含 level, id, html (已渲染的 innerHTML)
        const headingItems = headings.map(h => ({
            level: parseInt(h.tagName.substring(1)),
            id: h.id,
            html: h.innerHTML   // 这里包含 KaTeX 生成的 HTML 标签
        }));

        // 构建树形结构（与原有 renderTOC 逻辑一致）
        const root = { level: 0, children: [] };
        const stack = [root];
        for (const h of headingItems) {
            const node = { ...h, children: [] };
            while (stack.length > 1 && stack[stack.length - 1].level >= h.level) {
                stack.pop();
            }
            stack[stack.length - 1].children.push(node);
            stack.push(node);
        }

        // 递归生成 HTML（注意直接插入 node.html，无需转义，因为已由 marked 和 KaTeX 安全渲染）
        function buildHTML(nodes) {
            if (nodes.length === 0) return '';
            let html = '<ul>';
            for (const node of nodes) {
                html += `<li><a href="#${node.id}" class="toc-level-${node.level}">${node.html}</a>`;
                if (node.children.length > 0) {
                    html += buildHTML(node.children);
                }
                html += '</li>';
            }
            html += '</ul>';
            return html;
        }

        tocContainer.innerHTML = buildHTML(root.children);
        // 为所有 TOC 链接绑定点击事件，实现平滑滚动而不改变 hash
        tocContainer.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const href = link.getAttribute('href');
                if (href && href.startsWith('#')) {
                    const targetId = href.substring(1);
                    const targetElement = document.getElementById(targetId);
                    const mainContent = document.getElementById('mainContent');
                    if (targetElement && mainContent) {
                        const targetRect = targetElement.getBoundingClientRect();
                        const mainRect = mainContent.getBoundingClientRect();
                        const targetTopRelativeToMain = targetRect.top - mainRect.top + mainContent.scrollTop;
                        const scrollTo = targetTopRelativeToMain - 60;
                        const maxScroll = mainContent.scrollHeight - mainContent.clientHeight;
                        const finalScroll = Math.min(Math.max(scrollTo, 0), maxScroll);

                        mainContent.scrollTo({
                            top: finalScroll,
                            behavior: 'smooth'
                        });
                    }
                }
            });
        });
    }
    // 转义 HTML 防止 XSS（使用 DOM API 避免字面量中的 HTML 实体被格式化器破坏）
    function escapeHtml(unsafe) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(unsafe));
        return div.innerHTML;
    }
    function clearTOC() {
        const tocContainer = document.getElementById('tocContent');
        if (tocContainer) tocContainer.innerHTML = '';
        updateTOCActive();
    }

    // 🏠 动态卡片风格首页
    function renderDefaultAbout() {
        clearTOC();

        // ----- 收集笔记统计 -----
        let allFiles = [];
        let folderNames = [];
        function collectStats(nodes) {
            for (const node of nodes) {
                if (node.name === '日志') continue; // 跳过日志文件夹
                if (node.type === 'file') {
                    allFiles.push(node);
                } else if (node.type === 'folder') {
                    folderNames.push(node.name);
                    if (node.children) collectStats(node.children);
                }
            }
        }
        if (treeData && treeData.children) collectStats(treeData.children);

        const fileCount = allFiles.length;
        const folderCount = folderNames.length;
        // 随机推荐（一次抽三篇，每次刷新不同）
        const shuffled = [...allFiles].sort(() => Math.random() - 0.5);
        const randomPicks = shuffled.slice(0, 3);

        // ----- 构建卡片 HTML -----
        const cards = [];

        // 卡片1：欢迎 — 网站名 + 一句话介绍
        cards.push(`<div class="home-card card-span-2" style="animation-delay: 0.05s;">
            <div class="card-title">CraneCat 喵~</div>
            <p class="card-desc">这里是我的个人网站，记录学习与生活。涵盖计算机科学、数学、杂谈等各种内容。</p>
            <div class="card-actions">
                <a href="#/" class="card-link primary">进入笔记库</a>
            </div>
        </div>`);

        // 卡片2：关于 & 联系方式（上移，不折叠）
        cards.push(`<div class="home-card card-span-2" style="animation-delay: 0.10s;">
            <div class="card-title">关于本站</div>
            <p class="card-desc">所有原创笔记采用 <strong>CC BY-NC-SA 4.0</strong> 协议共享。非商业性分享、演绎需保留署名并以相同方式共享。</p>
            <div class="about-info">
                <p>📧 邮箱：cranecat_rain@163.com</p>
                <p>💬 QQ：2019412832</p>
                <p>🐙 GitHub：<a href="https://github.com/CraneCatLin" target="_blank">CraneCatLin</a></p>
                <p style="margin-top:8px; font-size:0.82rem; color:var(--text-muted);">内容有误、显示 bug、建议想法都欢迎联系~</p>
            </div>
        </div>`);

        // 卡片3：随机阅读（一次三篇，带刷新按钮）
        if (randomPicks.length > 0) {
            const picksHTML = randomPicks.map(p => {
                const pName = (p.name || '').replace(/\.[^.]+$/, '');
                const pPath = p.path || '';
                return `<div class="random-note" data-path="${escapeHtml(pPath)}" style="margin-top:8px; padding:10px 14px; background:rgba(91,155,213,0.06); border-radius:10px; cursor:pointer; transition:all var(--transition); border:1px solid transparent;">
                    <span style="color:var(--text-primary); font-weight:600;">${escapeHtml(pName)}</span>
                    <span style="float:right; font-size:0.78rem; color:var(--text-muted);">去看看 →</span>
                </div>`;
            }).join('');
            cards.push(`<div class="home-card" style="animation-delay: 0.12s;">
                <div class="card-title">
                    随机阅读
                    <button class="random-refresh-btn" title="换一批">换一批</button>
                </div>
                <p class="card-desc">不知道该看什么？这里有三篇随机推荐给你的笔记：</p>
                <div class="random-notes-list">${picksHTML}</div>
            </div>`);
        }

        // 卡片5：统计数据
        cards.push(`<div class="home-card" style="animation-delay: 0.26s;">
            <div class="card-title">站点统计</div>
            <div style="display:flex; gap:16px; margin-top:10px; flex-wrap:wrap;">
                <div style="text-align:center; flex:1; min-width:70px;">
                    <div style="font-size:1.8rem; font-weight:700; color:var(--primary);">${fileCount}</div>
                    <div style="font-size:0.78rem; color:var(--text-muted);">篇笔记</div>
                </div>
                <div style="text-align:center; flex:1; min-width:70px;">
                    <div style="font-size:1.8rem; font-weight:700; color:var(--accent);">${folderCount}</div>
                    <div style="font-size:0.78rem; color:var(--text-muted);">个分类</div>
                </div>
            </div>
        </div>`);

        // 卡片6：热门标签（分类文件夹名作为标签）
        if (folderNames.length > 0) {
            const tagHTML = folderNames.slice(0, 10).map(name =>
                `<span class="tag-item" data-tag="${escapeHtml(name)}"># ${escapeHtml(name)}</span>`
            ).join('');
            cards.push(`<div class="home-card" style="animation-delay: 0.33s;">
                <div class="card-title">分类标签</div>
                <div class="tag-row">${tagHTML}</div>
            </div>`);
        }

        viewer.innerHTML = `<div class="home-cards">${cards.join('')}</div>`;

        // ----- 绑定交互事件 -----
        bindHomeCardEvents();
    }

    // 首页卡片交互：点击卡片内链接/笔记项/随机推荐
    function bindHomeCardEvents() {
        // "进入笔记库" 按钮
        const primaryLink = viewer.querySelector('.card-link.primary');
        if (primaryLink) {
            primaryLink.addEventListener('click', (e) => {
                e.preventDefault();
                navigateToFirstNote();
            });
        }

        // 随机阅读卡片点击（多篇）
        viewer.querySelectorAll('.random-note').forEach(randomNote => {
            randomNote.addEventListener('click', () => {
                const path = randomNote.dataset.path;
                if (path) {
                    window.location.hash = '#' + encodeURIComponent(path);
                    loadFileByPath(path);
                }
            });
        });

        // 分类标签点击 → 打开对应文件夹
        viewer.querySelectorAll('.tag-item[data-tag]').forEach(tag => {
            tag.addEventListener('click', () => {
                const folderName = tag.dataset.tag;
                if (treeData && treeData.children) {
                    for (const node of treeData.children) {
                        if (node.type === 'folder' && node.name === folderName) {
                            // 找到该文件夹的第一个 md 文件
                            const firstMd = findFirstMd(node);
                            if (firstMd && firstMd.path) {
                                window.location.hash = '#' + encodeURIComponent(firstMd.path);
                                loadFileByPath(firstMd.path);
                            }
                            return;
                        }
                    }
                }
            });
        });

        // 随机阅读刷新按钮
        const refreshBtn = viewer.querySelector('.random-refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                refreshRandomCard();
            });
        }

        // 初始化卡片的 3D 倾斜 + Glare 效果
        initCardTilt();
    }

    // ===== 3D 倾斜 + Glare 高光效果 =====
    function initCardTilt() {
        const cards = viewer.querySelectorAll('.home-card');
        if (!cards.length) return;

        cards.forEach(card => {
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width;
                const y = (e.clientY - rect.top) / rect.height;

                const rotateX = (y - 0.5) * -16;
                const rotateY = (x - 0.5) * 16;

                card.style.transform = `perspective(800px) rotateX(${rotateX.toFixed(1)}deg) rotateY(${rotateY.toFixed(1)}deg)`;

                const glare = card.querySelector(':scope > .glare-layer');
                if (!glare) {
                    const layer = document.createElement('div');
                    layer.className = 'glare-layer';
                    layer.style.cssText = `
                        position: absolute; top: 0; left: 0; right: 0; bottom: 0;
                        border-radius: inherit; pointer-events: none; z-index: 10;
                        opacity: 0; transition: opacity 0.25s ease;
                        background: radial-gradient(
                            ellipse at ${(x * 100).toFixed(0)}% ${(y * 100).toFixed(0)}%,
                            rgba(255, 255, 255, 0.14) 0%,
                            rgba(255, 255, 255, 0.03) 45%,
                            transparent 65%
                        );
                    `;
                    card.appendChild(layer);
                } else {
                    glare.style.background = `radial-gradient(
                        ellipse at ${(x * 100).toFixed(0)}% ${(y * 100).toFixed(0)}%,
                        rgba(255, 255, 255, 0.14) 0%,
                        rgba(255, 255, 255, 0.03) 45%,
                        transparent 65%
                    )`;
                }

                const glareLayer = card.querySelector('.glare-layer');
                if (glareLayer) glareLayer.style.opacity = '1';
            });

            card.addEventListener('mouseleave', () => {
                card.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg)';
                card.style.transition = 'transform 0.5s cubic-bezier(0.22, 0.61, 0.36, 1)';

                const glareLayer = card.querySelector('.glare-layer');
                if (glareLayer) glareLayer.style.opacity = '0';

                const onTransitionEnd = () => {
                    card.style.removeProperty('transform');
                    card.style.removeProperty('transition');
                    card.removeEventListener('transitionend', onTransitionEnd);
                };
                card.addEventListener('transitionend', onTransitionEnd);
            });

            card.addEventListener('mouseenter', () => {
                card.style.transition = 'transform 0.1s ease-out';
            });
        });
    }

    // 刷新随机阅读卡片（重新从所有文件中随机选三篇）
    function refreshRandomCard() {
        if (!treeData || !treeData.children) return;
        const allFiles = [];
        function collect(nodes) {
            for (const n of nodes) {
                if (n.name === '日志') continue;
                if (n.type === 'file') allFiles.push(n);
                else if (n.type === 'folder' && n.children) collect(n.children);
            }
        }
        collect(treeData.children);
        if (allFiles.length === 0) return;
        const shuffled = [...allFiles].sort(() => Math.random() - 0.5);
        const picks = shuffled.slice(0, 3);
        const cards = viewer.querySelectorAll('.random-note');
        cards.forEach((card, i) => {
            const pick = picks[i] || picks[0]; // fallback if fewer than 3 files
            const rName = (pick.name || '').replace(/\.[^.]+$/, '');
            const rPath = pick.path || '';
            card.dataset.path = rPath;
            const span = card.querySelector('span');
            if (span) span.textContent = rName;
            card.classList.add('random-flash');
            setTimeout(() => card.classList.remove('random-flash'), 400);
        });
    }

    // 在文件夹中递归查找第一个 .md 文件
    function findFirstMd(folderNode) {
        if (!folderNode || !folderNode.children) return null;
        for (const child of folderNode.children) {
            if (child.type === 'file' && child.ext === 'md') {
                return child;
            } else if (child.type === 'folder') {
                const found = findFirstMd(child);
                if (found) return found;
            }
        }
        return null;
    }

    // 跳转到第一篇笔记
    function navigateToFirstNote() {
        if (defaultNotePath) {
            window.location.hash = '#' + encodeURIComponent(defaultNotePath);
            loadFromHash();
        } else if (treeData && treeData.children) {
            const firstMd = findFirstMd({ children: treeData.children });
            if (firstMd && firstMd.path) {
                window.location.hash = '#' + encodeURIComponent(firstMd.path);
                loadFromHash();
            }
        }
    }
    // 显示内容区域骨架屏
    function showContentSkeleton() {
        clearTOC();
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
        clearTOC();
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
    // ---------- 友链页面渲染 ----------
    function renderFriendsPage() {
        document.title = '友链 - CraneCat喵~';

        const friends = [
            {
                avatar: 'https://github.com/CraneCatLin.png',
                name: 'CraneCat\'s Blog',
                desc: '欢迎友链互链 ~',
                url: 'https://cranecat.cn'
            },
            {
                avatar: 'https://axi404.top/avatar/avatar.png',
                name: 'Axi\'s Blog',
                desc: '一只可爱小猫',
                url: 'https://axi404.top'
            }
        ];

        let cardsHTML = '';
        for (const f of friends) {
            cardsHTML += `
                <div class="friend-card">
                    <img class="friend-avatar" src="${f.avatar}" alt="${f.name}" loading="lazy" />
                    <div class="friend-info">
                        <div class="friend-name">${f.name}</div>
                        <div class="friend-desc">${f.desc}</div>
                    </div>
                    <a class="friend-link-btn" href="${f.url}" target="_blank" rel="noopener noreferrer">🔗 访问</a>
                </div>`;
        }

        viewer.innerHTML = `
            <div class="friends-page">
                <div class="friends-page-title">🔗 友链</div>
                <div class="friends-cards">${cardsHTML}</div>
            </div>
        `;
        clearTOC();
    }

    // ---------- 根据 hash 加载内容 ----------
    function loadFromHash() {
        const hash = window.location.hash.slice(1) || '';
        if (!hash) {
            renderDefaultAbout();
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
            renderDefaultAbout();
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
            renderFriendsPage();
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
            renderImage(fullPath);
            updateActiveTreeItem(filePath);
            currentFilePath = filePath;
        }
        else if (SUPPORTED_VIDEO.includes('.' + ext)) {
            renderVideo(fullPath);
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
                    renderMarkdown(markdown, filePath);
                })
                .catch(error => {
                    viewer.innerHTML = `<div class="markdown-body error"><h2>❌ 加载失败</h2><p>无法加载文件 ${filePath} (${error.message})</p></div>`;
                });
            updateActiveTreeItem(filePath);
            currentFilePath = filePath;
        }
        else {
            renderUnsupported(fullPath);
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

    function renderImage(filePath) {
        clearTOC();
        viewer.innerHTML = `
            <div class="markdown-body image-view">
                <h2>🖼️ 图片预览</h2>
                <img src="${filePath}" alt="${filePath.split('/').pop()}" style="max-width:100%;">
                <p><a href="${filePath}" target="_blank">查看原图</a></p>
            </div>
        `;
    }

    function renderVideo(filePath) {
        clearTOC();
        viewer.innerHTML = `
            <div class="markdown-body video-view">
                <h2>🎬 视频播放</h2>
                <video controls src="${filePath}" style="width:100%; max-height:70vh;"></video>
                <p><a href="${filePath}" target="_blank">下载视频</a></p>
            </div>
        `;
    }

    function renderUnsupported(filePath) {
        clearTOC();
        const fileName = filePath.split('/').pop();
        viewer.innerHTML = `
            <div class="markdown-body unsupported">
                <h2>📄 文件无法预览</h2>
                <p>文件类型 "${getFileExtension(filePath)}" 暂不支持在线预览。</p>
                <p><a href="${filePath}" download="${fileName}">点击下载文件</a></p>
            </div>
        `;
    }

    // 渲染 Markdown (使用 marked、highlight.js 和 KaTeX)
    function renderMarkdown(markdownText, filePath) {
        function replaceWikilinks(text) {
            return text.replace(/\[\[([^\]]+)\]\]/g, function (match, p1) {
                let targetPath = null;
                if (p1.includes('/')) {
                    targetPath = fullPathNoExtMap.get(p1);
                }
                if (!targetPath) {
                    const fileName = p1.split('/').pop();
                    targetPath = fileNameMap.get(fileName);
                }
                if (targetPath) {
                    const encodedPath = encodeURIComponent(targetPath);
                    return `<a href="#${encodedPath}" class="wikilink">${p1}</a>`;
                } else {
                    return match;
                }
            });
        }

        if (fileNameMap.size > 0 || fullPathNoExtMap.size > 0) {
            markdownText = replaceWikilinks(markdownText);
        }
        if (!window.markdownit) {
            console.warn('markdown-it 未加载，Markdown 将无法渲染。');
            return;
        }

        try {
            const md = window.markdownit({
                html: true,
                xhtmlOut: true,
                breaks: true,
                langPrefix: 'language-',
                linkify: true,
                typographer: true,
                quotes: '""\'\''
            });

            let headings = [];
            let headingCounts = {};

            const defaultHeadingOpen = md.renderer.rules.heading_open || function (tokens, idx, options, env, self) {
                return self.renderToken(tokens, idx, options);
            };

            md.renderer.rules.heading_open = function (tokens, idx, options, env, self) {
                const token = tokens[idx];
                const nextToken = tokens[idx + 1];
                let text = '';
                if (nextToken && nextToken.type === 'inline') {
                    text = getInlineText(nextToken);
                }

                const baseId = slugify(text) || 'heading';
                if (!headingCounts[baseId]) {
                    headingCounts[baseId] = 0;
                } else {
                    headingCounts[baseId]++;
                }
                const id = headingCounts[baseId] === 0 ? baseId : baseId + '-' + headingCounts[baseId];

                token.attrSet('id', id);

                headings.push({
                    level: parseInt(token.tag.substring(1)),
                    text: text,
                    id: id
                });

                return defaultHeadingOpen(tokens, idx, options, env, self);
            };
            let pluginEnabled = false;

            if (window.texmath && window.katex) {
                try {
                    md.use(window.texmath, {
                        engine: window.katex,
                        delimiters: 'dollars',
                        katexOptions: { throwOnError: false }
                    });
                    pluginEnabled = true;
                } catch (err) {
                    console.warn('texmath 插件注册失败，将使用后备公式处理:', err);
                }
            }

            if (window.hljs) {
                md.options.highlight = function (str, lang) {
                    if (lang && window.hljs.getLanguage(lang)) {
                        try {
                            return window.hljs.highlight(str, { language: lang }).value;
                        } catch (__) { }
                    }
                    return md.utils.escapeHtml(str);
                };
            }

            const fileNameWithoutExt = filePath.split('/').pop().replace(/\.[^/.]+$/, "");

            let finalHtml;
            if (!pluginEnabled && window.katex) {
                const processedText = processMathFormulas(markdownText);
                finalHtml = md.render(processedText);
            } else {
                finalHtml = md.render(markdownText);
            }

            document.title = `${fileNameWithoutExt} - 笔记系统`;

            const contentWithHeader = `<h1 class="note-title">${fileNameWithoutExt}</h1>\n<div class="note-content">${finalHtml}</div>`;

            finalHtml = contentWithHeader.replace(/<img\s+src="([^"]+)"([^>]*)>/gi, function (match, src, rest) {
                if (src && !src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('/')) {
                    const dir = filePath.substring(0, filePath.lastIndexOf('/') + 1);
                    const newSrc = '/public/' + dir + src;
                    return `<img src="${newSrc}"${rest}>`;
                }
                return match;
            });

            function processImageSizes(html) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = html;
                const imgs = tempDiv.querySelectorAll('img');
                imgs.forEach(img => {
                    let alt = img.getAttribute('alt') || '';
                    if (alt.includes('|')) {
                        const parts = alt.split('|');
                        const newAlt = parts[0].trim();
                        const sizePart = parts[1].trim();
                        const sizeMatch = sizePart.match(/^(\d+)(?:x(\d+))?$/);
                        if (sizeMatch) {
                            const width = sizeMatch[1];
                            const height = sizeMatch[2];
                            if (width) img.setAttribute('width', width);
                            if (height) img.setAttribute('height', height);
                            img.setAttribute('alt', newAlt);
                        }
                    }
                });
                return tempDiv.innerHTML;
            }

            finalHtml = processImageSizes(finalHtml);

            function convertVideoImgs(html) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = html;
                const imgs = tempDiv.querySelectorAll('img');
                imgs.forEach(img => {
                    const src = img.getAttribute('src') || '';
                    const ext = src.split('.').pop().toLowerCase();
                    if (SUPPORTED_VIDEO.includes('.' + ext)) {
                        const video = document.createElement('video');
                        video.setAttribute('controls', '');
                        video.setAttribute('src', src);
                        video.style.width = '100%';
                        video.style.maxHeight = '70vh';
                        const alt = img.getAttribute('alt') || '';
                        if (alt) {
                            video.setAttribute('title', alt);
                        }
                        const w = img.getAttribute('width');
                        const h = img.getAttribute('height');
                        if (w) video.style.width = w + 'px';
                        if (h) video.style.maxHeight = h + 'px';
                        img.replaceWith(video);
                    }
                });
                return tempDiv.innerHTML;
            }
            finalHtml = convertVideoImgs(finalHtml);

            viewer.innerHTML = `<div class="markdown-body">${finalHtml}</div>`;

            if (window.hljs && !md.options.highlight) {
                document.querySelectorAll('.markdown-body pre code').forEach((block) => {
                    hljs.highlightElement(block);
                });
            }

            document.querySelectorAll('#viewer a').forEach(link => {
                const href = link.getAttribute('href');
                if (href && !href.startsWith('http') && !href.startsWith('#')) {
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        window.location.hash = '#' + href;
                        loadFileByPath(href);
                    });
                }
            });
            renderTOCFromDOM();
            updateTOCActive();
            enhanceCodeBlocks();
        } catch (error) {
            console.error('Markdown 渲染出错:', error);
            viewer.innerHTML = `<div class="markdown-body error"><h2>❌ 渲染失败</h2><p>${error.message}</p><pre>${escapeHtml(markdownText.substring(0, 200))}...</pre></div>`;
            clearTOC();
        }
    }

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
    // ---------- 构建目录树 ----------
    function buildTreeHTML(nodes, parentPath = '') {
        let html = '<ul class="tree">';
        for (let node of nodes) {
            const nodePath = parentPath ? `${parentPath}/${node.name}` : node.name;
            if (node.type === 'folder') {
                const fileCount = (node.children || []).filter(c => c.type === 'file').length;
                const subFolderCount = (node.children || []).filter(c => c.type === 'folder').length;
                html += `<li class="folder collapsed">`;
                html += `<div class="item" data-path="${nodePath}" data-type="folder">`;
                html += `<span class="folder-arrow">▸</span>`;
                html += `<span class="folder-icon">📁</span>`;
                html += `<span class="item-name">${node.name}</span>`;
                if (fileCount + subFolderCount > 0) {
                    html += `<span class="folder-count">${fileCount + subFolderCount}</span>`;
                }
                html += `</div>`;
                if (node.children && node.children.length > 0) {
                    html += buildTreeHTML(node.children, nodePath);
                } else {
                    html += '<ul class="tree"><li class="empty-folder"><span class="empty-hint">📪 空文件夹</span></li></ul>';
                }
                html += `</li>`;
            } else if (node.type === 'file') {
                const displayName = node.name.replace(/\.[^/.]+$/, "");
                const ext = node.ext || '';
                const icon = getFileIcon(ext);
                html += `<li class="file">`;
                html += `<div class="item" data-path="${nodePath}" data-type="file" data-ext="${ext}">`;
                html += `<span class="file-icon">${icon}</span>`;
                html += `<span class="item-name">${displayName}</span>`;
                html += `</div>`;
                html += `</li>`;
            }
        }
        html += '</ul>';
        return html;
    }

    // 绑定树交互事件
    function bindTreeEvents() {
        document.querySelectorAll('.tree .folder > .item').forEach(folderItem => {
            folderItem.addEventListener('click', (e) => {
                e.stopPropagation();
                const li = folderItem.closest('.folder');
                li.classList.toggle('collapsed');
            });
        });

        document.querySelectorAll('.tree .file > .item').forEach(fileItem => {
            fileItem.addEventListener('click', (e) => {
                e.stopPropagation();
                const path = fileItem.dataset.path;
                if (path) {
                    window.location.hash = '#' + encodeURIComponent(path);
                    loadFileByPath(path);
                }
            });
        });
    }
    // 防抖函数
    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    function updateTOCActive() {
        const tocLinks = document.querySelectorAll('#tocContent a');
        if (!tocLinks.length) return;

        const headings = Array.from(document.querySelectorAll('#viewer :is(h1, h2, h3, h4, h5, h6):not(.note-title)'));
        if (!headings.length) {
            tocLinks.forEach(link => link.classList.remove('active'));
            return;
        }

        let bestHeading = null;
        let bestDistance = Infinity;

        headings.forEach(heading => {
            const rect = heading.getBoundingClientRect();
            const top = rect.top;
            if (top >= 0 && top < bestDistance) {
                bestDistance = top;
                bestHeading = heading;
            }
        });

        if (!bestHeading) {
            headings.forEach(heading => {
                const top = heading.getBoundingClientRect().top;
                const absTop = Math.abs(top);
                if (absTop < bestDistance) {
                    bestDistance = absTop;
                    bestHeading = heading;
                }
            });
        }

        if (bestHeading) {
            const id = bestHeading.id;
            tocLinks.forEach(link => link.classList.remove('active'));
            const activeLink = Array.from(tocLinks).find(link => link.getAttribute('href') === `#${id}`);
            if (activeLink) activeLink.classList.add('active');
        } else {
            tocLinks.forEach(link => link.classList.remove('active'));
        }
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
    // 从 tree.json 加载目录树
    function loadTree() {
        treeContainer.innerHTML = `
        <div style="padding: 0.5rem;">
            <div class="tree-skeleton-item tree-skeleton-folder"></div>
            <div class="tree-skeleton-item tree-skeleton-file"></div>
            <div class="tree-skeleton-item tree-skeleton-file"></div>
            <div class="tree-skeleton-item tree-skeleton-folder"></div>
            <div class="tree-skeleton-item tree-skeleton-file"></div>
            <div class="tree-skeleton-item tree-skeleton-file"></div>
        </div>
        `;
        fetch('/tree.json')
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            })
            .then(data => {
                treeData = data;
                let nodes = [];
                if (Array.isArray(data)) {
                    nodes = data;
                } else if (data && data.children) {
                    nodes = data.children;
                } else {
                    nodes = [];
                }
                // 过滤掉"日志"文件夹（日志由 tree-log.json 单独管理）
                nodes = nodes.filter(n => n.name !== '日志');
                // 构建 wiki 链接映射
                fileNameMap.clear();
                fullPathNoExtMap.clear();

                function buildMaps(nodes, parentPath = '') {
                    for (let node of nodes) {
                        const nodePath = parentPath ? `${parentPath}/${node.name}` : node.name;
                        if (node.type === 'file') {
                            const fullPathNoExt = nodePath.replace(/\.[^/.]+$/, "");
                            const fileNameNoExt = node.name.replace(/\.[^/.]+$/, "");
                            if (!fileNameMap.has(fileNameNoExt)) {
                                fileNameMap.set(fileNameNoExt, nodePath);
                            }
                            if (!fullPathNoExtMap.has(fullPathNoExt)) {
                                fullPathNoExtMap.set(fullPathNoExt, nodePath);
                            }
                        } else if (node.type === 'folder' && node.children) {
                            buildMaps(node.children, nodePath);
                        }
                    }
                }
                buildMaps(nodes, '');
                const treeHTML = buildTreeHTML(nodes, '');
                treeContainer.innerHTML = treeHTML;
                bindTreeEvents();
                defaultNotePath = findFirstFile(nodes);
                console.log('默认笔记路径:', defaultNotePath);

                loadFromHash();
            })
            .catch(error => {
                treeContainer.innerHTML = `<div style="padding:1rem; color:var(--text-secondary);">❌ 加载目录失败: ${error.message}<br>请确保 tree.json 存在且格式正确。</div>`;
                renderDefaultAbout();
            });
    }

    function findFirstFile(nodes, parentPath = '') {
        for (let node of nodes) {
            const nodePath = parentPath ? `${parentPath}/${node.name}` : node.name;
            if (node.type === 'file') {
                return nodePath;
            } else if (node.type === 'folder' && node.children) {
                const found = findFirstFile(node.children, nodePath);
                if (found) return found;
            }
        }
        return null;
    }

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
        if (menuToggle) {
            menuToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                body.classList.toggle('sidebar-open');
            });
        }

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

    // ---------- 初始化 ----------
    function init() {
        loadTree();
        initTopbar();

        const mainContent = document.getElementById('mainContent');
        if (mainContent) {
            const onScroll = debounce(updateTOCActive, 100);
            mainContent.addEventListener('scroll', onScroll, { passive: true });
        }

        if (!window.marked) console.warn('marked.js 未加载，Markdown 将无法渲染。');
        if (!window.hljs) console.warn('highlight.js 未加载，代码块将无高亮。');
        if (!window.katex) console.warn('katex 未加载，数学公式将无法渲染。');
    }

    init();
})();