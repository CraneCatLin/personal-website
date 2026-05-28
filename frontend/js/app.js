// ==================== 应用入口 ====================
// 此文件是前端模块化后的唯一入口，负责编排所有模块的初始化

import { body, debounce, updateTOCActive } from './core.js';
import { initTopbar, initRouter, loadFromHash } from './router.js';
import { loadTree } from './tree.js';

function init() {
    // 加载目录树
    loadTree();

    // 初始化顶栏交互
    initTopbar();

    // 初始化路由监听
    initRouter();

    // 主内容区滚动 → 更新 TOC 高亮
    const mainContent = document.getElementById('mainContent');
    if (mainContent) {
        const onScroll = debounce(updateTOCActive, 100);
        mainContent.addEventListener('scroll', onScroll, { passive: true });
    }

    // 初始加载当前 hash
    loadFromHash();

    // 检查第三方库加载状态
    if (!window.marked) console.warn('marked.js 未加载，Markdown 将无法渲染。');
    if (!window.hljs) console.warn('highlight.js 未加载，代码块将无高亮。');
    if (!window.katex) console.warn('katex 未加载，数学公式将无法渲染。');
}

// DOM 就绪后启动
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}