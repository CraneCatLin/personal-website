/**
 * toc.js - TOC 模块（从 script.js / notes.js 拆分）
 * 包含：目录树生成、TOC 高亮、TOC 清除
 */

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

    // 递归生成 HTML（保留 markdown-it 和 KaTeX 渲染后的标题格式）
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

function clearTOC() {
    const tocContainer = document.getElementById('tocContent');
    if (tocContainer) tocContainer.innerHTML = '';
    updateTOCActive();
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

// 导出到全局，供 script.js 和 notes.js 使用
window.TOCModule = {
    renderTOCFromDOM: renderTOCFromDOM,
    clearTOC: clearTOC,
    updateTOCActive: updateTOCActive
};