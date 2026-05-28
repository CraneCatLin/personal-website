// ==================== 共享状态与 DOM 引用 ====================
export const viewer = document.getElementById('viewer');
export const treeContainer = document.getElementById('treeContainer');
export const tocContent = document.getElementById('tocContent');
export const body = document.body;
export const menuToggle = document.getElementById('menuToggle');
export const homeBtn = document.getElementById('homeBtn');
export const notesBtn = document.getElementById('notesBtn');
export const friendsBtn = document.getElementById('friendsBtn');
export const logBtn = document.getElementById('logBtn');

export let currentFilePath = null;
export let defaultNotePath = null;
export let treeData = null;
export let logTreeData = null;

export const fileNameMap = new Map();
export const fullPathNoExtMap = new Map();

// ==================== 工具函数 ====================

export function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
}

export function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

export function getFileIcon(ext) {
    const iconMap = {
        '.md': '📄', '.txt': '📄',
        '.js': '🟨', '.ts': '🔵', '.py': '🐍', '.json': '📋',
        '.html': '🌐', '.css': '🎨', '.xml': '📦',
        '.png': '🖼️', '.jpg': '🖼️', '.jpeg': '🖼️', '.gif': '🖼️', '.svg': '🖼️',
        '.zip': '📦', '.rar': '📦', '.7z': '📦',
        '.pdf': '📕', '.doc': '📘', '.docx': '📘',
    };
    return iconMap[ext] || '📄';
}

export function setBackgroundForPage(pageType) {
    body.classList.remove('homepage', 'note-page', 'friends-page', 'log-page-bg');
    if (pageType === 'home' || pageType === 'defaultAbout') {
        body.classList.add('homepage');
    } else if (pageType === 'note' || pageType === 'notesHub') {
        body.classList.add('note-page');
    } else if (pageType === 'friend') {
        body.classList.add('friends-page');
    } else if (pageType === 'log') {
        body.classList.add('log-page-bg');
    }
}

export function showContentSkeleton() {
    viewer.innerHTML = `
    <div style="padding: 2rem; animation: fadeIn 0.3s ease;">
        <div class="skeleton" style="height:2rem; width:60%; margin-bottom:1.5rem;"></div>
        <div class="skeleton" style="height:1rem; width:90%; margin-bottom:0.6rem;"></div>
        <div class="skeleton" style="height:1rem; width:85%; margin-bottom:0.6rem;"></div>
        <div class="skeleton" style="height:1rem; width:75%; margin-bottom:0.6rem;"></div>
        <div class="skeleton" style="height:1rem; width:80%; margin-bottom:0.6rem;"></div>
        <div class="skeleton" style="height:10rem; width:100%; margin-top:1rem;"></div>
    </div>`;
}

export function clearTOC() {
    if (tocContent) tocContent.innerHTML = '<p style="padding:1rem; color:var(--text-muted);font-size:0.8rem;">无目录</p>';
}

export function renderTOCFromDOM() {
    if (!tocContent) return;
    const viewContent = viewer;
    if (!viewContent) { clearTOC(); return; }
    const headings = viewContent.querySelectorAll(':is(h1, h2, h3, h4, h5, h6):not(.note-title)');
    if (!headings.length) { clearTOC(); return; }
    let tocHTML = '<ul class="toc-list">';
    headings.forEach(h => {
        const level = parseInt(h.tagName[1]);
        const text = h.textContent || '';
        const id = h.id || cleanHeadingForId(text);
        if (!h.id) h.id = id;
        tocHTML += `<li class="toc-item toc-level-${level}"><a href="#${id}">${escapeHtml(text)}</a></li>`;
    });
    tocHTML += '</ul>';
    tocContent.innerHTML = tocHTML;
}

export function cleanHeadingForId(text) {
    return text.trim().toLowerCase()
        .replace(/[^\w\u4e00-\u9fff\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        || 'heading';
}

export function updateTOCActive() {
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

export function enhanceCodeBlocks() {
    const v = viewer;
    if (!v) return;

    const pres = v.querySelectorAll('pre');
    pres.forEach(pre => {
        if (pre.parentElement && pre.parentElement.classList.contains('code-block-wrapper')) return;

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

    v.addEventListener('click', (e) => {
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
            setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
        }).catch(err => {
            console.error('复制失败:', err);
            btn.textContent = 'Failed';
            setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
        });
    });
}

export function processMathFormulas(text) {
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