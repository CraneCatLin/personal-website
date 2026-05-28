import { viewer, setBackgroundForPage, clearTOC } from './core.js';

export function renderDefaultAbout() {
    document.title = 'CraneCat喵~';
    setBackgroundForPage('home');
    clearTOC();

    viewer.innerHTML = `
    <div class="default-about">
        <div class="about-hero">
            <div class="about-avatar-wrapper">
                <img src="/images/avatar.jpg" alt="CraneCat" class="about-avatar" loading="lazy">
            </div>
            <h1 class="about-name">CraneCat</h1>
            <p class="about-tagline">一只会写代码的猫 🐱</p>
            <p class="about-subtitle">CraneCat 的个人知识库 & 日记本</p>
            <div class="about-social">
                <a href="https://github.com/CraneCatLin" target="_blank" rel="noopener" class="social-link" title="GitHub">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                </a>
            </div>
        </div>
        <div class="about-cards">
            <div class="about-card" id="aboutCardNotes">
                <div class="about-card-icon">📚</div>
                <h3>知识笔记</h3>
                <p>AI 与深度学习笔记</p>
            </div>
            <div class="about-card" id="aboutCardLogs">
                <div class="about-card-icon">📝</div>
                <h3>日常日志</h3>
                <p>记录生活与技术点滴</p>
            </div>
            <div class="about-card" id="aboutCardFriends">
                <div class="about-card-icon">🤝</div>
                <h3>友情链接</h3>
                <p>小伙伴们</p>
            </div>
        </div>
    </div>`;

    // 绑定首页卡片点击事件
    const cardNotes = document.getElementById('aboutCardNotes');
    const cardLogs = document.getElementById('aboutCardLogs');
    const cardFriends = document.getElementById('aboutCardFriends');

    if (cardNotes) {
        cardNotes.addEventListener('click', () => {
            window.location.hash = '#notes';
        });
    }
    if (cardLogs) {
        cardLogs.addEventListener('click', () => {
            window.location.hash = '#logs';
        });
    }
    if (cardFriends) {
        cardFriends.addEventListener('click', () => {
            window.location.hash = '#friends';
        });
    }
}

export function renderNotesHub() {
    document.title = '笔记 - CraneCat喵~';
    setBackgroundForPage('notesHub');
    clearTOC();

    viewer.innerHTML = `
    <div class="notes-hub">
        <h1>📚 知识笔记</h1>
        <p style="text-align:center; color:var(--text-muted); margin-bottom:2rem;">从左侧目录选择一篇笔记开始阅读</p>
        <div class="notes-hub-tips">
            <div class="hub-tip">
                <span class="hub-tip-icon">💡</span>
                <span>支持 Wiki 链接 [[文件名]]</span>
            </div>
            <div class="hub-tip">
                <span class="hub-tip-icon">📐</span>
                <span>支持 KaTeX 数学公式 $...$</span>
            </div>
            <div class="hub-tip">
                <span class="hub-tip-icon">🔍</span>
                <span>页面内搜索：Ctrl+F</span>
            </div>
        </div>
    </div>`;
}

export function renderNotFound(filePath) {
    document.title = '404 - 笔记不存在';
    setBackgroundForPage('note');
    const safePath = escapeHtml ? escapeHtml(filePath) : filePath;
    viewer.innerHTML = `
    <div class="markdown-body error">
        <h2>🔍 笔记不存在</h2>
        <p>无法加载 <code>${safePath}</code></p>
        <p>可能的原因：</p>
        <ul>
            <li>文件已被移动或删除</li>
            <li>路径拼写有误</li>
            <li>tree.json 尚未更新</li>
        </ul>
        <p>💡 提示：新增笔记后请运行 update.ps1 更新目录树</p>
    </div>`;
}