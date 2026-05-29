/**
 * 友链模块 - 从 script.js 拆分
 * 依赖：core.js（提供全局 viewer 等变量和函数）
 * 依赖：toc.js（提供 window.TOCModule.clearTOC）
 */

// ---------- 友链页面渲染 ----------
function renderFriendsPage() {
    document.title = '友链 - CraneCat喵~';

    const friends = [
        {
            avatar: 'https://github.com/CraneCatLin.png',
            name: 'CraneCat\'s Blog',
            desc: '欢迎友链互链 ~',
            url: 'https://cranecat.cn'
        },
        {
            avatar: 'https://axi404.top/avatar/avatar.png',
            name: 'Axi\'s Blog',
            desc: '一只可爱小猫',
            url: 'https://axi404.top'
        }
    ];

    let cardsHTML = '';
    for (const f of friends) {
        cardsHTML += `
            <div class="friend-card">
                <img class="friend-avatar" src="${f.avatar}" alt="${f.name}" loading="lazy" />
                <div class="friend-info">
                    <div class="friend-name">${f.name}</div>
                    <div class="friend-desc">${f.desc}</div>
                </div>
                <a class="friend-link-btn" href="${f.url}" target="_blank" rel="noopener noreferrer">🔗 访问</a>
            </div>`;
    }

    viewer.innerHTML = `
        <div class="friends-page">
            <div class="friends-page-title">🔗 友链</div>
            <div class="friends-cards">${cardsHTML}</div>
        </div>
    `;
    window.TOCModule.clearTOC();
}

// 导出到全局，供 script.js 使用
window.FriendsModule = {
    renderFriendsPage: renderFriendsPage
};