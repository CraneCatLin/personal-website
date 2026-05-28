import { body, menuToggle, homeBtn, notesBtn, friendsBtn, logBtn, viewer, clearTOC, updateTOCActive, debounce } from './core.js';
import { loadFileByPath } from './note-renderer.js';
import { renderDefaultAbout, renderNotesHub, renderNotFound } from './home.js';
import { renderFriendsPage } from './friends.js';
import { renderLogPage } from './log.js';

// ==================== 路由处理 ====================

export function loadFromHash() {
    const hash = window.location.hash.slice(1);
    if (!hash) {
        renderDefaultAbout();
        return;
    }

    // 特殊路由: #notes
    if (hash === 'notes') {
        renderNotesHub();
        return;
    }

    // 特殊路由: #friends
    if (hash === 'friends') {
        renderFriendsPage();
        return;
    }

    // 特殊路由: #logs
    if (hash === 'logs') {
        renderLogPage();
        return;
    }

    // 日志文件路由: #log:path
    if (hash.startsWith('log:')) {
        const filePath = decodeURIComponent(hash.slice(4));
        if (filePath) {
            loadFileByPath(filePath);
        }
        return;
    }

    // 普通笔记路由
    const filePath = decodeURIComponent(hash);
    loadFileByPath(filePath);
}

export function initTopbar() {
    // TOC 侧栏切换
    const toggleToc = document.getElementById('toggleToc');
    const tocSidebar = document.getElementById('tocSidebar');
    if (toggleToc && tocSidebar) {
        toggleToc.addEventListener('click', () => {
            tocSidebar.classList.toggle('collapsed');
            toggleToc.textContent = tocSidebar.classList.contains('collapsed') ? '⏵⏴' : '⏴⏵';
        });
    }

    // 菜单切换（移动端）
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
            body.classList.remove('sidebar-open');
        });
    }

    // 笔记按钮
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

    // 友链按钮
    if (friendsBtn) {
        friendsBtn.addEventListener('click', () => {
            window.location.hash = '#friends';
            body.classList.remove('sidebar-open');
        });
    }

    // 日志按钮
    if (logBtn) {
        logBtn.addEventListener('click', () => {
            window.location.hash = '#logs';
            body.classList.remove('sidebar-open');
        });
    }

    // 点击外部关闭侧栏
    document.addEventListener('click', (e) => {
        if (body.classList.contains('sidebar-open')) {
            const isClickInsideSidebar = e.target.closest('.sidebar');
            const isClickMenuToggle = e.target.closest('#menuToggle');
            if (!isClickInsideSidebar && !isClickMenuToggle) {
                body.classList.remove('sidebar-open');
            }
        }
    });

    // 窗口 resize 时关闭侧栏
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            body.classList.remove('sidebar-open');
        }
    });
}

export function initRouter() {
    // hashchange 监听
    window.addEventListener('hashchange', () => {
        loadFromHash();
    });

    // 为笔记内链接绑定点击（由 note-renderer 在渲染后处理）
}