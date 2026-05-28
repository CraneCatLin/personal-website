import { viewer, setBackgroundForPage, clearTOC, escapeHtml } from './core.js';

export function renderFriendsPage() {
    document.title = '友情链接 - CraneCat喵~';
    setBackgroundForPage('friend');
    clearTOC();

    const friends = [
        {
            avatar: '/images/friends/friend1.jpg',
            name: 'HuanLin',
            desc: '一位厉害的算法工程师',
            url: 'https://huanlin.cc/'
        },
        {
            avatar: '/images/friends/friend2.jpg',
            name: '小白',
            desc: '全栈开发者，热爱开源',
            url: 'https://xiaobai.dev/'
        },
        {
            avatar: '/images/friends/friend3.jpg',
            name: '喵喵',
            desc: '前端设计狮 🦁',
            url: 'https://meow.design/'
        }
    ];

    let cardsHTML = '';
    for (const f of friends) {
        cardsHTML += `
        <div class="friend-card">
            <img src="${escapeHtml(f.avatar)}" alt="${escapeHtml(f.name)}" class="friend-avatar" loading="lazy" onerror="this.src='/images/avatar.jpg'">
            <div class="friend-name">${escapeHtml(f.name)}</div>
            <div class="friend-desc">${escapeHtml(f.desc)}</div>
            <a href="${escapeHtml(f.url)}" target="_blank" rel="noopener" class="friend-link-btn">去串门 →</a>
        </div>`;
    }

    viewer.innerHTML = `
    <div class="friends-page-content">
        <h1>🤝 友情链接</h1>
        <div class="friends-grid">
            ${cardsHTML}
        </div>
    </div>`;
}