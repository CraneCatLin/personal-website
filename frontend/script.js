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
    let treeData = null;                     // 存储解析后的树数据
    let defaultNotePath = null;              // 默认第一个笔记路径（供“笔记”按钮使用）
    const SUPPORTED_IMG = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp'];
    const SUPPORTED_VIDEO = ['.mp4', '.webm', '.ogg', '.mov'];

    // 顶栏元素
    const menuToggle = document.getElementById('menuToggle');
    const homeBtn = document.getElementById('homeBtn');
    const notesBtn = document.getElementById('notesBtn');
    // const aboutBtn = document.getElementById('aboutBtn');

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
    function renderTOC(headings) {
        const tocContainer = document.getElementById('tocContent');
        if (!tocContainer) return;

        if (!headings || headings.length === 0) {
            tocContainer.innerHTML = '<p style="color: var(--text-muted); padding: 0.5rem;">无目录/文档空白</p>';
            return;
        }

        // 构建树形结构
        const root = { level: 0, children: [] };
        const stack = [root];
        for (const h of headings) {
            const node = { ...h, children: [] };
            // 找到合适的父级
            while (stack.length > 1 && stack[stack.length - 1].level >= h.level) {
                stack.pop();
            }
            stack[stack.length - 1].children.push(node);
            stack.push(node);
        }

        // 递归生成 HTML
        function buildHTML(nodes) {
            if (nodes.length === 0) return '';
            let html = '<ul>';
            for (const node of nodes) {
                html += `<li><a href="#${node.id}" class="toc-level-${node.level}">${escapeHtml(node.text)}</a>`;
                if (node.children.length > 0) {
                    html += buildHTML(node.children);
                }
                html += '</li>';
            }
            html += '</ul>';
            return html;
        }

        tocContainer.innerHTML = buildHTML(root.children);
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
    }
    // ---------- 渲染默认"关于本站"内容 ----------
    function renderDefaultAbout() {
        clearTOC()
        const aboutHTML = `
            <div class="markdown-body homepage">
                <h1></h1>
                <blockquote>
                    <p>这里是我的个人网站，有我写的笔记、技能树、作品展示（这个还没有）</p>
                </blockquote>
                <h3>开始浏览</h3>
                <div class="homepage-links">
                    <a href="#/" class="nav-link primary-link">进入笔记库</a>
                </div>
                
                <h3>联系方式</h3>
                <ul>
                    <li>邮箱：cranecat_rain@163.com</li>
                    <li>QQ：2019412832</li>
                    <li>（内容有误、显示有bug、有建议、有想法都欢迎联系）</li>
                </ul>

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
                .then(markdown => renderMarkdown(markdown, filePath))
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

            // 尝试注册 markdown-it-katex 插件（兼容不同变量名）
            const katexPlugin = window.markdownitKatex || window.markdownItKatex;
            if (katexPlugin) {
                try {
                    md.use(katexPlugin, {
                        throwOnError: false,           // 公式错误时不中断渲染
                        delimiters: [                   // 明确指定定界符
                            { left: '$$', right: '$$', display: true },
                            { left: '$', right: '$', display: false },
                            { left: '\\(', right: '\\)', display: false },
                            { left: '\\[', right: '\\]', display: true }
                        ]
                    });
                    pluginEnabled = true;
                    console.log('markdown-it-katex 插件已启用');
                } catch (err) {
                    console.warn('插件注册失败，将使用后备公式处理:', err);
                }
            } else {
                console.warn('markdown-it-katex 插件未找到，将使用后备公式处理。');
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
            renderTOC(headings);
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

            viewer.innerHTML = `<div class="markdown-body">${finalHtml}</div>`;

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

        } catch (error) {
            console.error('Markdown 渲染出错:', error);
            viewer.innerHTML = `<div class="markdown-body error"><h2>❌ 渲染失败</h2><p>${error.message}</p><pre>${escapeHtml(markdownText.substring(0, 200))}...</pre></div>`;
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

    // 从 tree.json 加载目录树
    function loadTree() {
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
                const treeHTML = buildTreeHTML(nodes, '');  // 从根路径开始
                treeContainer.innerHTML = treeHTML;
                bindTreeEvents();

                // 查找第一个笔记文件路径，供“笔记”按钮使用
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
            // 改变按钮符号
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
                if (defaultNotePath) {
                    window.location.hash = '#' + encodeURIComponent(defaultNotePath);
                } else {
                    // 如果树还未加载，尝试使用硬编码，或暂时忽略
                    console.warn('默认笔记路径未就绪');
                    // 可选：设置为一个常见路径
                    window.location.hash = '#DIP G/2. 数字图像基础.md';
                }
                // 关闭侧边栏（移动端）
                body.classList.remove('sidebar-open');
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