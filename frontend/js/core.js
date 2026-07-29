/**
 * core.js - 核心共享模块（从 script.js 拆分）
 * 包含：DOM 引用、常量、日志和非日志模块共用的工具函数
 */

// ---------- DOM 引用 ----------
const viewer = document.getElementById('viewer');
const body = document.body;
let currentFilePath = '';                // 当前加载的文件路径（相对根目录）

// ---------- 常量 ----------
const SUPPORTED_IMG = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp'];
const SUPPORTED_VIDEO = ['.mp4', '.webm', '.ogg', '.mov'];

// ---------- 工具函数 ----------
function getFileExtension(filename) {
    const dotIndex = filename.lastIndexOf('.');
    return dotIndex === -1 ? '' : filename.slice(dotIndex + 1).toLowerCase();
}

function setBackgroundForPage(isHomePage) {
    body.classList.remove('note-page', 'friends-page', 'log-page');
    if (isHomePage === false) {
        body.classList.add('note-page');
    } else if (isHomePage === 'friends') {
        body.classList.add('friends-page');
    } else if (isHomePage === 'log') {
        body.classList.add('log-page');
    }
}

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

// 转义 HTML 防止 XSS（使用 DOM API 避免字面量中的 HTML 实体被格式化器破坏）
function escapeHtml(unsafe) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(unsafe));
    return div.innerHTML;
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

function enhanceCodeBlocks() {
    const viewerEl = document.getElementById('viewer');
    if (!viewerEl) return;

    const pres = viewerEl.querySelectorAll('pre');
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

    viewerEl.addEventListener('click', (e) => {
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

/**
 * 获取并记录页面的访问次数
 * @param {string} filePath - 文件相对路径（如 "ai/CNN.md"）
 * @returns {Promise<number>} 返回更新后的访问次数
 */
/**
 * 带超时的 fetch 封装（AbortController）
 */
async function fetchWithTimeout(url, options = {}, timeout = 5000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        return response;
    } finally {
        clearTimeout(timer);
    }
}

async function recordPageView(filePath) {
    try {
        const apiUrl = 'https://pv-counter.cranecat.workers.dev/pv?path=' + encodeURIComponent(filePath);
        const response = await fetchWithTimeout(apiUrl, { method: 'POST' }, 5000);
        if (!response.ok) return -1;
        const data = await response.json();
        return data.count || 0;
    } catch (err) {
        console.warn('记录访问次数失败:', err);
        return -1;
    }
}

/**
 * 渲染阅读次数到指定容器
 * @param {HTMLElement} container - 要插入计数信息的元素
 * @param {string} filePath - 文件相对路径
 */
function renderPageViewCount(container, filePath) {
    const pvEl = document.createElement('div');
    pvEl.className = 'page-view-count';
    pvEl.textContent = '阅读次数加载中...';
    container.appendChild(pvEl);

    recordPageView(filePath).then(count => {
        if (count >= 0) {
            pvEl.textContent = `阅读 ${count} 次`;
        } else {
            pvEl.textContent = '阅读获取失败';
            pvEl.style.color = '#999';
            pvEl.style.fontSize = '0.85em';
        }
    });
}

// 导出到全局，供其他模块使用
window.CoreModule = {
    viewer: viewer,
    body: body,
    currentFilePath: currentFilePath,
    SUPPORTED_IMG: SUPPORTED_IMG,
    SUPPORTED_VIDEO: SUPPORTED_VIDEO,
    getFileExtension: getFileExtension,
    setBackgroundForPage: setBackgroundForPage,
    showContentSkeleton: showContentSkeleton,
    escapeHtml: escapeHtml,
    processMathFormulas: processMathFormulas,
    enhanceCodeBlocks: enhanceCodeBlocks,
    recordPageView: recordPageView,
    renderPageViewCount: renderPageViewCount
};
