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

    // ---------- 工具函数：获取文件扩展名 ----------
    function getFileExtension(filename) {
        const dotIndex = filename.lastIndexOf('.');
        return dotIndex === -1 ? '' : filename.slice(dotIndex + 1).toLowerCase();
    }
    function setBackgroundForPage(isHomePage) {
        if (isHomePage) {
            // 如果是首页，移除 note-page 类
            // body 默认就有首页背景图（在 CSS 中定义）
            body.classList.remove('note-page');
        } else {
            // 如果是笔记页，添加 note-page 类
            // 这个类会让 CSS 中的笔记页背景图生效
            body.classList.add('note-page');
        }
    }
    // ---------- 工具函数：根据文件路径从树数据中查找节点 ----------
    function findFileNodeInTree(nodes, targetPath) {
        // console.log(`[路径追踪] 开始查找，目标路径: "${targetPath}"`);
        for (const node of nodes) {
            if (node.type === 'file') {
                // console.log(`[路径追踪] 正在比较 -> 节点路径: "${node.path}"`);
                if (node.path === targetPath) {
                    // console.log(`[路径追踪] √ 匹配成功！`);
                    return node;
                }
            } else if (node.type === 'folder' && node.children) {
                const found = findFileNodeInTree(node.children, targetPath);
                if (found) return found;
            }
        }
        console.log(`[路径追踪] × 遍历完成，未找到匹配项。`);
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
        // ==== 新增：为所有 TOC 链接绑定点击事件，实现平滑滚动而不改变 hash ====
        tocContainer.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const href = link.getAttribute('href');
                if (href && href.startsWith('#')) {
                    const targetId = href.substring(1);
                    const targetElement = document.getElementById(targetId);
                    const mainContent = document.getElementById('mainContent');
                    if (targetElement && mainContent) {
                        // 获取目标元素相对于 mainContent 顶部的位置
                        const targetRect = targetElement.getBoundingClientRect();
                        const mainRect = mainContent.getBoundingClientRect();
                        const targetTopRelativeToMain = targetRect.top - mainRect.top + mainContent.scrollTop;
                        // 减去偏移量（顶栏高度48px + 额外12px间距，保持与 scroll-margin-top 一致）
                        const scrollTo = targetTopRelativeToMain - 60;
                        // 确保不超出滚动范围
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
    // 转义 HTML 防止 XSS（可复用之前的 escapeHtml 函数）
    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
    function clearTOC() {
        const tocContainer = document.getElementById('tocContent');
        if (tocContainer) tocContainer.innerHTML = '';
        updateTOCActive();
    }

    // ---------- 渲染默认"关于本站"内容 ----------
    function renderDefaultAbout() {
        clearTOC()
        const aboutHTML = `
            <div class="markdown-body homepage">
                <h1></h1>
                <blockquote>
                    <p>这里是我的个人网站，有我写的笔记、日记以及一些杂七杂八的内容</p>
                </blockquote>
                <h3>开始浏览</h3>
                <div class="homepage-links">
                    <a href="#/" class="nav-link primary-link">笔记本</a>
                </div>
                
                <h3>Info</h3>
                <ul>
                    <li>邮箱：cranecat_rain@163.com</li>
                    <li>QQ：2019412832</li>
                    <li>github:https://github.com/CraneCatLin （咳暂时也没有什么做完的项目）</li>
                    <li>（内容有误、显示有bug、有建议、有想法都欢迎联系）</li>
                </ul>
                <blockquote>
                    <h4>声明</h4>
                    <p>本站所有原创笔记与内容，除非特别注明，均采用 CC BY-NC-SA 4.0协议进行共享。您可以非商业性地分享、演绎，但需保留原作者署名、链接并采用相同方式共享。
                    <p>本站可能引用的外部图片等素材，其版权归属各自权利人。如有内容侵犯您的权益，请通过邮件或QQ联系，我将及时处理。</p>
                </blockquote>
                <details class="about-details" open>
                    <summary>更多内容</summary>
                    <div class="about-content">
                        <p>持续更新中...</p>
                    </div>
                </details>
            </div>
        `;
        viewer.innerHTML = aboutHTML;

        // 添加导航链接的点击事件
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                if (link.getAttribute('href') === '#/') {
                    e.preventDefault();
                    // 跳转到第一个可用的笔记或者显示目录
                    if (defaultNotePath) {
                        window.location.hash = '#' + encodeURIComponent(defaultNotePath);
                        loadFromHash();
                    } else {
                        // 如果找不到目录，尝试加载一个默认笔记
                        window.location.hash = '#DIP G/2. 数字图像基础.md';
                        loadFromHash();
                    }
                }
            });
        });
    }
    // 显示内容区域骨架屏
    function showContentSkeleton() {
        clearTOC(); // 同时清空目录侧边栏
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
        document.body.classList.remove('homepage');
        setBackgroundForPage(false);
        document.title = '笔记库';
        // 清除文件高亮
        document.querySelectorAll('.tree .item.active').forEach(el => el.classList.remove('active'));
        currentFilePath = '';
    }
    // ---------- 根据 hash 加载内容 ----------
    function loadFromHash() {
        const hash = window.location.hash.slice(1) || '';  // 去掉开头的 '#'
        if (!hash) {
            // 无 hash，显示默认关于页
            renderDefaultAbout();
            // 同时清除所有文件高亮
            document.querySelectorAll('.tree .item.active').forEach(el => el.classList.remove('active'));
            currentFilePath = '';
            // 添加 homepage 类以隐藏侧边栏
            document.body.classList.add('homepage');

            // ==== 新增：设置背景为首页背景 ====
            setBackgroundForPage(true);  // true 表示首页
            return;
        }
        if (hash === 'notes' || hash === 'library' || hash === 'notebook') {
            renderNotesHub();
            return;
        }
        // 特殊链接处理
        if (hash === 'about') {
            renderDefaultAbout();
            document.querySelectorAll('.tree .item.active').forEach(el => el.classList.remove('active'));
            currentFilePath = '';
            document.body.classList.add('homepage');

            // ==== 新增：设置背景为首页背景 ====
            setBackgroundForPage(true);  // true 表示首页
            return;
        }

        // 移除 homepage 类以显示侧边栏
        body.classList.remove('homepage');
        setBackgroundForPage(false);  // false 表示笔记页
        // 解码 URI 中的路径
        const filePath = decodeURIComponent(hash);

        // 检查文件类型并加载
        loadFileByPath(filePath);
    }

    // ---------- 加载文件：根据路径获取并渲染 ----------
    function loadFileByPath(filePath) {
        showContentSkeleton();  //显示骨架屏
        // 修改路径，将相对路径改为相对于根目录的路径
        // 在你的项目结构中，所有文件都存储在 /public 目录下
        // 因此需要为文件路径加上 /public 前缀
        const fullPath = '/public/' + filePath;
        const ext = getFileExtension(filePath).toLowerCase();

        // 图片文件
        if (SUPPORTED_IMG.includes('.' + ext)) {
            renderImage(fullPath);
            updateActiveTreeItem(filePath);
            currentFilePath = filePath;
        }
        // 视频文件
        else if (SUPPORTED_VIDEO.includes('.' + ext)) {
            renderVideo(fullPath);
            updateActiveTreeItem(filePath);
            currentFilePath = filePath;
        }
        // Markdown 文件
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
        // 其他文件类型
        else {
            renderUnsupported(fullPath);
            updateActiveTreeItem(filePath);
            currentFilePath = filePath;
        }
    }

    // 更新树中当前选中项的高亮
    function updateActiveTreeItem(filePath) {
        // 移除所有 active
        document.querySelectorAll('.tree .item.active').forEach(el => el.classList.remove('active'));
        // 找到对应项添加 active
        const items = document.querySelectorAll('.tree .file .item');
        for (let item of items) {
            if (item.dataset.path === filePath) {
                item.classList.add('active');
                break;
            }
        }
    }

    // 渲染图片
    function renderImage(filePath) {
        clearTOC()
        viewer.innerHTML = `
            <div class="markdown-body image-view">
                <h2>🖼️ 图片预览</h2>
                <img src="${filePath}" alt="${filePath.split('/').pop()}" style="max-width:100%;">
                <p><a href="${filePath}" target="_blank">查看原图</a></p>
            </div>
        `;
    }

    // 渲染视频
    function renderVideo(filePath) {
        clearTOC()
        viewer.innerHTML = `
            <div class="markdown-body video-view">
                <h2>🎬 视频播放</h2>
                <video controls src="${filePath}" style="width:100%; max-height:70vh;"></video>
                <p><a href="${filePath}" target="_blank">下载视频</a></p>
            </div>
        `;
    }

    // 渲染不支持的文件
    function renderUnsupported(filePath) {
        clearTOC()
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
                // 若双链包含斜杠，优先作为完整路径匹配
                if (p1.includes('/')) {
                    targetPath = fullPathNoExtMap.get(p1);
                }
                if (!targetPath) {
                    // 否则作为纯文件名匹配（取最后一段）
                    const fileName = p1.split('/').pop();
                    targetPath = fileNameMap.get(fileName);
                }
                if (targetPath) {
                    const encodedPath = encodeURIComponent(targetPath);
                    return `<a href="#${encodedPath}" class="wikilink">${p1}</a>`;
                } else {
                    return match; // 未找到则保留原始 [[...]]
                }
            });
        }

        // 在调用 md.render 之前处理 wikilinks
        if (fileNameMap.size > 0 || fullPathNoExtMap.size > 0) {
            markdownText = replaceWikilinks(markdownText);
        }
        if (!window.markdownit) {
            viewer.innerHTML = `<pre>${markdownText}</pre>`;
            console.warn('markdown-it 未加载，Markdown 将无法渲染。');
            return;
        }

        try {
            // 创建 markdown-it 实例
            const md = window.markdownit({
                html: true,
                xhtmlOut: true,
                breaks: true,
                langPrefix: 'language-',
                linkify: true,
                typographer: true,
                quotes: '""\'\''
            });
            // ---------- 新增：标题收集与 TOC 生成 ----------
            let headings = [];
            let headingCounts = {};

            // 保存默认 heading_open 渲染器
            const defaultHeadingOpen = md.renderer.rules.heading_open || function (tokens, idx, options, env, self) {
                return self.renderToken(tokens, idx, options);
            };

            // 自定义 heading_open：为标题添加 id，并收集信息
            md.renderer.rules.heading_open = function (tokens, idx, options, env, self) {
                const token = tokens[idx];
                // 获取标题文本（从下一个 inline token 中提取）
                const nextToken = tokens[idx + 1];
                let text = '';
                if (nextToken && nextToken.type === 'inline') {
                    text = getInlineText(nextToken);  // 使用上面定义的函数提取纯文本
                }

                // 生成唯一 id
                const baseId = slugify(text) || 'heading';
                if (!headingCounts[baseId]) {
                    headingCounts[baseId] = 0;
                } else {
                    headingCounts[baseId]++;
                }
                const id = headingCounts[baseId] === 0 ? baseId : baseId + '-' + headingCounts[baseId];

                // 设置 id 属性
                token.attrSet('id', id);

                // 收集标题
                headings.push({
                    level: parseInt(token.tag.substring(1)), // 'h2' -> 2
                    text: text,
                    id: id
                });

                return defaultHeadingOpen(tokens, idx, options, env, self);
            };
            let pluginEnabled = false; // 标记插件是否成功启用

            // 尝试注册 markdown-it-texmath 插件
            if (window.texmath && window.katex) {
                try {
                    md.use(window.texmath, {
                        engine: window.katex,           // 传入 KaTeX 引擎
                        delimiters: 'dollars',           // 使用 $...$ 和 $$...$$ 作为分隔符
                        katexOptions: { throwOnError: false } // KaTeX 渲染选项
                    });
                    pluginEnabled = true;
                    console.log('markdown-it-texmath 插件已启用');
                } catch (err) {
                    console.warn('texmath 插件注册失败，将使用后备公式处理:', err);
                }
            } else {
                console.warn('texmath 或 katex 未加载，将使用后备公式处理。');
            }

            // 配置代码高亮
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

            // 提取文件名作为标题（去掉扩展名）
            const fileNameWithoutExt = filePath.split('/').pop().replace(/\.[^/.]+$/, "");

            // 决定最终要渲染的文本
            let finalHtml;
            if (!pluginEnabled && window.katex) {
                // 插件未启用 → 使用后备函数预处理公式
                const processedText = processMathFormulas(markdownText);
                finalHtml = md.render(processedText);
            } else {
                // 插件已启用 或 KaTeX 不存在 → 直接渲染
                finalHtml = md.render(markdownText);
            }

            // 设置页面标题
            document.title = `${fileNameWithoutExt} - 笔记系统`;

            // 在渲染的内容前添加标题
            const contentWithHeader = `<h1 class="note-title">${fileNameWithoutExt}</h1>\n<div class="note-content">${finalHtml}</div>`;

            // 处理相对路径图片
            finalHtml = contentWithHeader.replace(/<img\s+src="([^"]+)"([^>]*)>/gi, function (match, src, rest) {
                if (src && !src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('/')) {
                    const dir = filePath.substring(0, filePath.lastIndexOf('/') + 1);
                    const newSrc = '/public/' + dir + src;
                    return `<img src="${newSrc}"${rest}>`;
                }
                return match;
            });

            // ---------- 解析图片尺寸语法（![alt|widthxheight](path)）----------
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
                        // 匹配格式：数字 或 数字x数字
                        const sizeMatch = sizePart.match(/^(\d+)(?:x(\d+))?$/);
                        if (sizeMatch) {
                            const width = sizeMatch[1];
                            const height = sizeMatch[2]; // 可能为 undefined
                            if (width) img.setAttribute('width', width);
                            if (height) img.setAttribute('height', height);
                            img.setAttribute('alt', newAlt);
                        }
                        // 若不匹配尺寸格式，保留原 alt 不变（即不处理）
                    }
                });
                return tempDiv.innerHTML;
            }

            finalHtml = processImageSizes(finalHtml);

            // ---------- 将指向视频文件的 <img> 标签转换为 <video> 标签 ----------
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
                        // 保留 alt 作为提示文字
                        const alt = img.getAttribute('alt') || '';
                        if (alt) {
                            video.setAttribute('title', alt);
                        }
                        // 复制图片的 width/height 属性（如果之前 processImageSizes 设置了的话）
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

            try {
                if (treeData && treeData.children) {
                    // console.log("[调试] 正在查找文件节点，传入的 filePath 为:", filePath);
                    const fileNode = findFileNodeInTree(treeData.children, filePath);
                    // console.log("[调试] findFileNodeInTree 返回的 fileNode 对象:", fileNode);
                    if (fileNode) {
                        console.log("[调试] 该节点的 mtime 属性值为:", fileNode.mtime);
                    }
                    if (fileNode && fileNode.mtime) {
                        const dateContainer = document.createElement('div');
                        dateContainer.className = 'file-modified-date';
                        dateContainer.style.cssText = 'margin-top: 3rem; padding-top: 1rem; border-top: 1px dashed var(--border-light); color: var(--text-muted); font-size: 0.9em; text-align: center;';

                        const dateObj = new Date(fileNode.mtime);
                        // 格式化为本地日期时间字符串，例如 "2024-01-15 16:30"
                        const formattedDate = dateObj.toLocaleString('zh-CN', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                        }).replace(/\//g, '-');

                        dateContainer.textContent = `最后修改于: ${formattedDate}`;
                        // 将日期信息插入到渲染内容的最底部
                        viewer.querySelector('.markdown-body')?.appendChild(dateContainer);
                    }
                }
            } catch (dateErr) {
                console.warn('无法显示修改日期:', dateErr);
            }

            // 如果 hljs 存在且未通过 markdown-it 高亮，手动高亮代码块
            if (window.hljs && !md.options.highlight) {
                document.querySelectorAll('.markdown-body pre code').forEach((block) => {
                    hljs.highlightElement(block);
                });
            }

            // 处理内部链接
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

    // 处理数学公式的辅助函数
    function processMathFormulas(text) {
        // 1. 先处理块级公式 $$ $$（避免内部行内公式干扰）
        text = text.replace(/\$\$(.*?)\$\$/gs, function (match, formula) {
            try {
                return window.katex.renderToString(formula, { throwOnError: false, displayMode: true });
            } catch (err) {
                console.warn('KaTeX 块级公式($$ $$)渲染错误:', err);
                return match;
            }
        });

        // 2. 处理行内公式 \( \)
        text = text.replace(/\\\((.*?)\\\)/g, function (match, formula) {
            try {
                return window.katex.renderToString(formula, { throwOnError: false, displayMode: false });
            } catch (err) {
                console.warn('KaTeX 行内公式(\\( \\))渲染错误:', err);
                return match;
            }
        });

        // 3. 处理行内公式 $ $（注意边界）
        text = text.replace(/\B\$(.+?)\$\B/g, function (match, formula) {
            try {
                return window.katex.renderToString(formula, { throwOnError: false, displayMode: false });
            } catch (err) {
                console.warn('KaTeX 行内公式($ $)渲染错误:', err);
                return match;
            }
        });

        return text;
    }
    // 添加一个转义HTML的辅助函数
    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // ---------- 构建目录树 ----------
    function buildTreeHTML(nodes, parentPath = '') {
        let html = '<ul class="tree">';
        for (let node of nodes) {
            const nodePath = parentPath ? `${parentPath}/${node.name}` : node.name;
            if (node.type === 'folder') {
                // 文件夹
                html += `<li class="folder">`;
                html += `<div class="item" data-path="${nodePath}" data-type="folder">${node.name}</div>`;
                if (node.children && node.children.length > 0) {
                    html += buildTreeHTML(node.children, nodePath);
                } else {
                    html += '<ul><li class="empty-folder" style="list-style:none; padding-left:1.5rem; color:var(--text-muted);">📪 空文件夹</li></ul>';
                }
                html += `</li>`;
            } else if (node.type === 'file') {
                // 文件：去除扩展名显示
                const displayName = node.name.replace(/\.[^/.]+$/, ""); // 去除扩展名
                html += `<li class="file">`;
                html += `<div class="item" data-path="${nodePath}" data-type="file">${displayName}</div>`;
                html += `</li>`;
            }
        }
        html += '</ul>';
        return html;
    }

    // 绑定树交互事件：文件夹折叠/展开，文件点击加载
    function bindTreeEvents() {
        // 所有文件夹 item 点击切换折叠
        document.querySelectorAll('.tree .folder > .item').forEach(folderItem => {
            folderItem.addEventListener('click', (e) => {
                e.stopPropagation();
                const li = folderItem.closest('.folder');
                li.classList.toggle('collapsed');
                // 可选：改变文件夹图标（已在CSS中用伪元素处理）
            });
        });

        // 所有文件 item 点击加载内容
        document.querySelectorAll('.tree .file > .item').forEach(fileItem => {
            fileItem.addEventListener('click', (e) => {
                e.stopPropagation();
                const path = fileItem.dataset.path;
                if (path) {
                    // 更新 hash (触发 loadFromHash 并加载)
                    window.location.hash = '#' + encodeURIComponent(path);
                    // loadFileByPath 会在 hashchange 中调用，但为了即时响应，直接调用
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

    // 更新 TOC 高亮：根据当前滚动位置找出最合适的标题，并高亮对应的 TOC 链接
    function updateTOCActive() {
        const tocLinks = document.querySelectorAll('#tocContent a');
        if (!tocLinks.length) return;                     // 无 TOC 时直接返回

        const headings = Array.from(document.querySelectorAll('#viewer :is(h1, h2, h3, h4, h5, h6):not(.note-title)'));
        if (!headings.length) {
            // 没有标题时清除所有高亮
            tocLinks.forEach(link => link.classList.remove('active'));
            return;
        }

        let bestHeading = null;
        let bestDistance = Infinity;

        // 策略：先找顶部在视口内（top >= 0）且离顶部最近的标题
        headings.forEach(heading => {
            const rect = heading.getBoundingClientRect();
            const top = rect.top;
            if (top >= 0 && top < bestDistance) {
                bestDistance = top;
                bestHeading = heading;
            }
        });

        // 如果没有这样的标题，则找已经滚过（top < 0）但绝对值最小的（即刚刚离开视口顶部的标题）
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
            // 移除所有 active 类
            tocLinks.forEach(link => link.classList.remove('active'));
            // 为对应链接添加 active
            const activeLink = Array.from(tocLinks).find(link => link.getAttribute('href') === `#${id}`);
            if (activeLink) activeLink.classList.add('active');
        } else {
            // 保底：清除所有高亮
            tocLinks.forEach(link => link.classList.remove('active'));
        }
    }
    // 为所有代码块添加复制按钮
    function enhanceCodeBlocks() {
        const viewer = document.getElementById('viewer');
        if (!viewer) return;

        const pres = viewer.querySelectorAll('pre');
        pres.forEach(pre => {
            // 避免重复包裹
            if (pre.parentElement && pre.parentElement.classList.contains('code-block-wrapper')) {
                return;
            }

            // 创建包裹容器
            const wrapper = document.createElement('div');
            wrapper.className = 'code-block-wrapper';
            wrapper.style.position = 'relative';

            // 创建复制按钮
            const btn = document.createElement('button');
            btn.className = 'code-copy-btn';
            btn.title = '复制代码';
            btn.textContent = 'Copy';   // 也可使用 SVG 图标

            // 将 pre 替换为 wrapper，并将 pre 移入 wrapper
            pre.parentNode.insertBefore(wrapper, pre);
            wrapper.appendChild(pre);
            wrapper.appendChild(btn);
        });

        // 使用事件委托处理复制点击（避免重复绑定）
        viewer.addEventListener('click', (e) => {
            const btn = e.target.closest('.code-copy-btn');
            if (!btn) return;

            const wrapper = btn.closest('.code-block-wrapper');
            if (!wrapper) return;

            const pre = wrapper.querySelector('pre');
            if (!pre) return;

            // 获取纯文本代码（忽略高亮标签）
            const code = pre.querySelector('code') || pre;
            const text = code.innerText || code.textContent;

            // 复制到剪贴板
            navigator.clipboard.writeText(text).then(() => {
                // 成功提示
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
        // 显示侧边栏骨架
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
                // 假设 tree.json 的根是一个对象，包含 children 数组
                // 或者直接是数组。根据常见格式：可能 { "name": "root", "type": "folder", "children": [...] }
                // 我们灵活处理：如果是数组，直接使用；如果是对象且有 children，用其 children
                let nodes = [];
                if (Array.isArray(data)) {
                    nodes = data;
                } else if (data && data.children) {
                    nodes = data.children;
                } else {
                    nodes = []; // 容错
                }
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
                const treeHTML = buildTreeHTML(nodes, '');  // 从根路径开始
                treeContainer.innerHTML = treeHTML;
                bindTreeEvents();
                // 查找第一个笔记文件路径，供"笔记"按钮使用
                defaultNotePath = findFirstFile(nodes);
                console.log('默认笔记路径:', defaultNotePath);

                // 加载完成后，根据当前 hash 决定显示内容
                loadFromHash();
            })
            .catch(error => {
                treeContainer.innerHTML = `<div style="padding:1rem; color:var(--text-secondary);">❌ 加载目录失败: ${error.message}<br>请确保 tree.json 存在且格式正确。</div>`;
                // 即使树加载失败，也要显示默认关于页
                renderDefaultAbout();
            });
    }

    // 递归查找第一个文件路径
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
            // 根据状态改变按钮符号：折叠时显示 ⏵⏴（表示向右展开），展开时显示 ⏴⏵（表示向左折叠）
            toggleToc.textContent = tocSidebar.classList.contains('collapsed') ? '⏵⏴' : '⏴⏵';
        });
    }
    function initTopbar() {
        initTOCSidebar();
        // 菜单按钮：切换侧边栏（移动端）
        if (menuToggle) {
            menuToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                body.classList.toggle('sidebar-open');
            });
        }

        // 首页按钮
        if (homeBtn) {
            homeBtn.addEventListener('click', () => {
                window.location.hash = '';
                // 关闭侧边栏（如果打开）
                body.classList.remove('sidebar-open');
            });
        }

        // 笔记按钮
        if (notesBtn) {
            notesBtn.addEventListener('click', () => {
                body.classList.remove('homepage');        // 确保退出首页模式
                const currentHash = window.location.hash.slice(1);
                if (currentHash !== 'notes') {
                    window.location.hash = '#notes';         // 切换到笔记库过渡页
                } else {
                    // 如果已经在笔记库页，重新渲染（例如从其他笔记返回）
                    renderNotesHub();
                }
                body.classList.remove('sidebar-open');     // 移动端关闭侧边栏
            });
        }

        // 关于按钮
        // if (aboutBtn) {
        //     aboutBtn.addEventListener('click', () => {
        //         window.location.hash = '#about';
        //         body.classList.remove('sidebar-open');
        //     });
        // }

        // 点击遮罩层关闭侧边栏 (监听 document 点击)
        document.addEventListener('click', (e) => {
            if (body.classList.contains('sidebar-open')) {
                const isClickInsideSidebar = e.target.closest('.sidebar');
                const isClickMenuToggle = e.target.closest('#menuToggle');
                if (!isClickInsideSidebar && !isClickMenuToggle) {
                    body.classList.remove('sidebar-open');
                }
            }
        });

        // 窗口大小改变时，如果宽度 > 768，强制关闭 sidebar-open（防止桌面样式干扰）
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

        // 绑定主内容区域的滚动事件，用于 TOC 高亮
        const mainContent = document.getElementById('mainContent');
        if (mainContent) {
            const onScroll = debounce(updateTOCActive, 100);
            mainContent.addEventListener('scroll', onScroll, { passive: true });
        }

        const hash = window.location.hash.slice(1) || '';
        // 如果 marked 或 hljs 未加载，给出提示但功能正常
        if (!window.marked) {
            console.warn('marked.js 未加载，Markdown 将无法渲染。');
        }
        if (!window.hljs) {
            console.warn('highlight.js 未加载，代码块将无高亮。');
        }

        // 如果 katex 未加载，给出提示
        if (!window.katex) {
            console.warn('katex 未加载，数学公式将无法渲染。');
        }
    }

    // 启动一切
    init();
})();