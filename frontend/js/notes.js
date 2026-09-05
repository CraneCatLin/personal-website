/**
 * 笔记渲染模块 - 从 script.js 拆分
 * 依赖：core.js（提供全局 viewer, escapeHtml, processMathFormulas, enhanceCodeBlocks,
 *       SUPPORTED_VIDEO 等变量和函数）
 *       toc.js（提供 window.TOCModule.clearTOC, window.TOCModule.updateTOCActive）
 *       script.js（提供 window.fileNameMap, window.fullPathNoExtMap）
 */

// ---------- 辅助函数 ----------
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

// ---------- 图片/视频/不支持文件渲染 ----------
function renderImage(filePath) {
    window.TOCModule.clearTOC();
    viewer.innerHTML = `
        <div class="markdown-body image-view">
            <h2>图片预览</h2>
            <img src="${filePath}" alt="${filePath.split('/').pop()}" style="max-width:100%;">
            <p><a href="${filePath}" target="_blank">查看原图</a></p>
        </div>
    `;
}

function renderVideo(filePath) {
    window.TOCModule.clearTOC();
    viewer.innerHTML = `
        <div class="markdown-body video-view">
            <h2>视频播放</h2>
            <video controls src="${filePath}" style="width:100%; max-height:70vh;"></video>
            <p><a href="${filePath}" target="_blank">下载视频</a></p>
        </div>
    `;
}

function renderUnsupported(filePath) {
    window.TOCModule.clearTOC();
    const fileName = filePath.split('/').pop();
    viewer.innerHTML = `
        <div class="markdown-body unsupported">
            <h2>文件无法预览</h2>
            <p>文件类型 "${getFileExtension(filePath)}" 暂不支持在线预览。</p>
            <p><a href="${filePath}" download="${fileName}">点击下载文件</a></p>
        </div>
    `;
}

// ---------- 从 treeData 递归查找文件 mtime ----------
function findMtimeInTree(nodes, targetPath) {
    if (!nodes) return null;
    // nodes 可能是根对象（有 type/children）或者数组
    const list = Array.isArray(nodes) ? nodes : nodes.children;
    if (!list) return null;
    for (const node of list) {
        if (node.type === 'file' && node.path === targetPath) {
            return node.mtime;
        }
        if (node.children) {
            const result = findMtimeInTree(node.children, targetPath);
            if (result) return result;
        }
    }
    return null;
}
// 生成修改日期 HTML（仅用于笔记，日志不调用此函数）
function getMtimeHtml(filePath) {
    const mtime = findMtimeInTree(window.treeData, filePath);
    if (!mtime) return '';
    const date = new Date(mtime);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    let text;
    if (year < 2026 || (year === 2026 && month <= 6)) {
        text = '2026.6及之前';
    } else {
        const day = date.getDate();
        text = `${year}.${month}.${day}`;
    }
    return `<div class="note-mtime">${text}</div>`;
}

// ---------- 渲染 Markdown (使用 markdown-it、highlight.js 和 KaTeX) ----------
function renderMarkdown(markdownText, filePath) {
    function replaceWikilinks(text) {
        return text.replace(/\[\[([^\]]+)\]\]/g, function (match, p1) {
            let targetPath = null;
            if (p1.includes('/')) {
                targetPath = window.fullPathNoExtMap.get(p1);
            }
            if (!targetPath) {
                const fileName = p1.split('/').pop();
                targetPath = window.fileNameMap.get(fileName);
            }
            if (targetPath) {
                const encodedPath = encodeURIComponent(targetPath);
                return `<a href="#${encodedPath}" class="wikilink">${p1}</a>`;
            } else {
                return match;
            }
        });
    }

    if (window.fileNameMap.size > 0 || window.fullPathNoExtMap.size > 0) {
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

        const mtimeHtml = getMtimeHtml(filePath);
        viewer.innerHTML = `<div class="markdown-body">${finalHtml}${mtimeHtml}</div>`;

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
        window.TOCModule.renderTOCFromDOM();
        window.TOCModule.updateTOCActive();
        enhanceCodeBlocks();

        // 显示阅读次数
        const noteContent = viewer.querySelector('.markdown-body');
        if (noteContent) {
            renderPageViewCount(noteContent, filePath);
        }
    } catch (error) {
        console.error('Markdown 渲染出错:', error);
        viewer.innerHTML = `<div class="markdown-body error"><h2>渲染失败</h2><p>${error.message}</p><pre>${escapeHtml(markdownText.substring(0, 200))}...</pre></div>`;
        window.TOCModule.clearTOC();
    }
}

// 导出到全局，供 script.js 使用
window.NotesModule = {
    renderMarkdown: renderMarkdown,
    renderImage: renderImage,
    renderVideo: renderVideo,
    renderUnsupported: renderUnsupported
};