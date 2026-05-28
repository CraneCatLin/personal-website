import {
    viewer, clearTOC, renderTOCFromDOM, updateTOCActive, enhanceCodeBlocks,
    processMathFormulas, escapeHtml, setBackgroundForPage, showContentSkeleton,
    currentFilePath, fileNameMap, fullPathNoExtMap, debounce
} from './core.js';

let _currentFilePath = null;

export function setCurrentFilePath(path) {
    _currentFilePath = path;
    // Also update core's mutable variable if needed — we keep local copy
}

export function loadFileByPath(filePath) {
    showContentSkeleton();
    const fullPath = '/public/' + filePath;
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
            viewer.innerHTML = `<div class="markdown-body error"><h2>❌ 加载失败</h2><p>无法加载 ${escapeHtml(filePath)} (${error.message})</p></div>`;
        });
    _currentFilePath = filePath;
    document.body.classList.remove('homepage');
    setBackgroundForPage('note');
}

export function renderMarkdown(markdownText, filePath) {
    if (!window.markdownit) {
        viewer.innerHTML = `<div class="markdown-body error"><h2>❌ 渲染失败</h2><p>markdown-it 未加载</p></div>`;
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

        let pluginEnabled = false;
        if (window.texmath && window.katex) {
            try {
                md.use(window.texmath, {
                    engine: window.katex,
                    delimiters: 'dollars',
                    katexOptions: { throwOnError: false }
                });
                pluginEnabled = true;
            } catch (err) { }
        }

        if (window.hljs) {
            md.options.highlight = function (str, lang) {
                if (lang && window.hljs.getLanguage(lang)) {
                    try { return window.hljs.highlight(str, { language: lang }).value; } catch (__) { }
                }
                return md.utils.escapeHtml(str);
            };
        }

        // 处理 Wiki 链接 [[...]]
        markdownText = markdownText.replace(/\[\[([^\]]+)\]\]/g, function (match, linkText) {
            const trimmed = linkText.trim();
            // 先尝试精确路径匹配
            let resolvedPath = fullPathNoExtMap.get(trimmed);
            if (!resolvedPath) {
                // 尝试文件名匹配（去扩展名）
                resolvedPath = fileNameMap.get(trimmed);
            }
            if (resolvedPath) {
                const safePath = escapeHtml(resolvedPath);
                const displayName = escapeHtml(trimmed);
                return `<a href="#${safePath}">${displayName}</a>`;
            }
            return match;
        });

        // 处理图片尺寸标记 ![alt|width](path)
        markdownText = markdownText.replace(/!\[([^\]]*?)\|(\d+)(?:x(\d+))?\]\(([^)]+)\)/g, function (match, alt, width, height, src) {
            const w = parseInt(width, 10);
            const h = height ? parseInt(height, 10) : undefined;
            let safeSrc = src;
            if (src && !src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('/')) {
                const dir = filePath.substring(0, filePath.lastIndexOf('/') + 1);
                safeSrc = '/public/' + dir + src;
            }
            // 由 markdown-it 渲染 img 后再用 JS 设尺寸
            const altEscaped = escapeHtml(alt || '');
            let imgHTML = `<img src="${escapeHtml(safeSrc)}" alt="${altEscaped}"`;
            if (w) imgHTML += ` width="${w}"`;
            if (h) imgHTML += ` height="${h}"`;
            imgHTML += '>';
            return imgHTML;
        });

        // 处理普通图片路径（非设置了尺寸的）
        markdownText = markdownText.replace(/<img\s+src="([^"]+)"([^>]*)>/gi, function (match, src, rest) {
            if (src && !src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('/')) {
                const dir = filePath.substring(0, filePath.lastIndexOf('/') + 1);
                const newSrc = '/public/' + dir + src;
                return `<img src="${newSrc}"${rest}>`;
            }
            return match;
        });

        const fileNameWithoutExt = filePath.split('/').pop().replace(/\.[^/.]+$/, "");
        document.title = `${fileNameWithoutExt} - CraneCat喵~`;

        let finalHtml;
        if (!pluginEnabled && window.katex) {
            finalHtml = md.render(processMathFormulas(markdownText));
        } else {
            finalHtml = md.render(markdownText);
        }

        viewer.innerHTML = `<div class="markdown-body">${finalHtml}</div>`;

        // hljs 二次高亮（备用）
        if (window.hljs && !md.options.highlight) {
            document.querySelectorAll('.markdown-body pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
        }

        // 笔记内链接跳转
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