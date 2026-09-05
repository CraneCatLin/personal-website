/**
 * 首页模块 - 从 script.js 拆分
 * 依赖：core.js（提供 viewer, escapeHtml 等全局变量和函数）
 * 依赖：toc.js（提供 window.TOCModule.clearTOC）
 * 依赖：script.js IIFE 赋值的全局变量 window.treeData、window.defaultNotePath、
 *       window.loadFileByPath、window.loadFromHash（作为自由变量引用）
 */

// 动态卡片风格首页
function renderDefaultAbout() {
    window.TOCModule.clearTOC();

    // ----- 收集笔记统计 -----
    let allFiles = [];
    let folderNames = [];
    function collectStats(nodes) {
        for (const node of nodes) {
            if (node.name === '日志') continue; // 跳过日志文件夹
            if (node.type === 'file') {
                allFiles.push(node);
            } else if (node.type === 'folder') {
                folderNames.push(node.name);
                if (node.children) collectStats(node.children);
            }
        }
    }
    if (treeData && treeData.children) collectStats(treeData.children);

    const fileCount = allFiles.length;
    const folderCount = folderNames.length;
    // 随机推荐（一次抽三篇，每次刷新不同）
    const shuffled = [...allFiles].sort(() => Math.random() - 0.5);
    const randomPicks = shuffled.slice(0, 3);

    // ----- 构建卡片 HTML -----
    const cards = [];

    // 卡片1：欢迎 — 网站名 + 一句话介绍
    cards.push(`<div class="home-card card-span-2" style="animation-delay: 0.05s;">
        <div class="card-title">CraneCat 喵~</div>
        <p class="card-desc">这里是我的个人网站，记录学习与生活。涵盖计算机科学、数学、杂谈等各种内容。</p>
        <div class="card-actions">
            <a href="#/" class="card-link primary">进入笔记库</a>
        </div>
    </div>`);

    // 卡片2：关于 & 联系方式（上移，不折叠）
    cards.push(`<div class="home-card card-span-2" style="animation-delay: 0.10s;">
        <div class="card-title">关于本站</div>
        <p class="card-desc">所有原创笔记采用 <strong>CC BY-NC-SA 4.0</strong> 协议共享。非商业性分享、演绎需保留署名并以相同方式共享。</p>
        <div class="about-info">
            <p>邮箱：cranecat_rain@163.com</p>
            <p>QQ：2019412832</p>
            <p>GitHub：<a href="https://github.com/CraneCatLin" target="_blank">CraneCatLin</a></p>
            <p style="margin-top:8px; font-size:0.82rem; color:var(--text-muted);">内容有误、显示 bug、建议想法都欢迎联系~</p>
        </div>
    </div>`);

    // 卡片3：随机阅读（一次三篇，带刷新按钮）
    if (randomPicks.length > 0) {
        const picksHTML = randomPicks.map(p => {
            const pName = (p.name || '').replace(/\.[^.]+$/, '');
            const pPath = p.path || '';
            return `<div class="random-note" data-path="${escapeHtml(pPath)}" style="margin-top:8px; padding:10px 14px; background:rgba(91,155,213,0.06); border-radius:10px; cursor:pointer; transition:all var(--transition); border:1px solid transparent;">
                <span style="color:var(--text-primary); font-weight:600;">${escapeHtml(pName)}</span>
                <span style="float:right; font-size:0.78rem; color:var(--text-muted);">去看看 →</span>
            </div>`;
        }).join('');
        cards.push(`<div class="home-card" style="animation-delay: 0.12s;">
            <div class="card-title">
                随机阅读
                <button class="random-refresh-btn" title="换一批">换一批</button>
            </div>
            <p class="card-desc">不知道该看什么？这里有三篇随机推荐给你的笔记：</p>
            <div class="random-notes-list">${picksHTML}</div>
        </div>`);
    }

    // 卡片5：统计数据
    cards.push(`<div class="home-card" style="animation-delay: 0.26s;">
        <div class="card-title">站点统计</div>
        <div style="display:flex; gap:16px; margin-top:10px; flex-wrap:wrap;">
            <div style="text-align:center; flex:1; min-width:70px;">
                <div style="font-size:1.8rem; font-weight:700; color:var(--primary);">${fileCount}</div>
                <div style="font-size:0.78rem; color:var(--text-muted);">篇笔记</div>
            </div>
            <div style="text-align:center; flex:1; min-width:70px;">
                <div style="font-size:1.8rem; font-weight:700; color:var(--accent);">${folderCount}</div>
                <div style="font-size:0.78rem; color:var(--text-muted);">个分类</div>
            </div>
        </div>
    </div>`);

    // 卡片6：热门标签（分类文件夹名作为标签）
    if (folderNames.length > 0) {
        const tagHTML = folderNames.slice(0, 10).map(name =>
            `<span class="tag-item" data-tag="${escapeHtml(name)}"># ${escapeHtml(name)}</span>`
        ).join('');
        cards.push(`<div class="home-card" style="animation-delay: 0.33s;">
            <div class="card-title">分类标签</div>
            <div class="tag-row">${tagHTML}</div>
        </div>`);
    }

    viewer.innerHTML = `<div class="home-cards">${cards.join('')}</div>`;

    // ----- 绑定交互事件 -----
    bindHomeCardEvents();
}

// 首页卡片交互：点击卡片内链接/笔记项/随机推荐
function bindHomeCardEvents() {
    // "进入笔记库" 按钮
    const primaryLink = viewer.querySelector('.card-link.primary');
    if (primaryLink) {
        primaryLink.addEventListener('click', (e) => {
            e.preventDefault();
            navigateToFirstNote();
        });
    }

    // 随机阅读卡片点击（多篇）
    viewer.querySelectorAll('.random-note').forEach(randomNote => {
        randomNote.addEventListener('click', () => {
            const path = randomNote.dataset.path;
            if (path) {
                window.location.hash = '#' + encodeURIComponent(path);
                loadFileByPath(path);
            }
        });
    });

    // 分类标签点击 → 打开对应文件夹
    viewer.querySelectorAll('.tag-item[data-tag]').forEach(tag => {
        tag.addEventListener('click', () => {
            const folderName = tag.dataset.tag;
            if (treeData && treeData.children) {
                for (const node of treeData.children) {
                    if (node.type === 'folder' && node.name === folderName) {
                        // 找到该文件夹的第一个 md 文件
                        const firstMd = findFirstMd(node);
                        if (firstMd && firstMd.path) {
                            window.location.hash = '#' + encodeURIComponent(firstMd.path);
                            loadFileByPath(firstMd.path);
                        }
                        return;
                    }
                }
            }
        });
    });

    // 随机阅读刷新按钮
    const refreshBtn = viewer.querySelector('.random-refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            refreshRandomCard();
        });
    }

    // 初始化卡片的 3D 倾斜 + Glare 效果
    initCardTilt();
}

// ===== 3D 倾斜 + Glare 高光效果 =====
function initCardTilt() {
    const cards = viewer.querySelectorAll('.home-card');
    if (!cards.length) return;

    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;

            const rotateX = (y - 0.5) * -16;
            const rotateY = (x - 0.5) * 16;

            card.style.transform = `perspective(800px) rotateX(${rotateX.toFixed(1)}deg) rotateY(${rotateY.toFixed(1)}deg)`;

            const glare = card.querySelector(':scope > .glare-layer');
            if (!glare) {
                const layer = document.createElement('div');
                layer.className = 'glare-layer';
                layer.style.cssText = `
                    position: absolute; top: 0; left: 0; right: 0; bottom: 0;
                    border-radius: inherit; pointer-events: none; z-index: 10;
                    opacity: 0; transition: opacity 0.25s ease;
                    background: radial-gradient(
                        ellipse at ${(x * 100).toFixed(0)}% ${(y * 100).toFixed(0)}%,
                        rgba(255, 255, 255, 0.14) 0%,
                        rgba(255, 255, 255, 0.03) 45%,
                        transparent 65%
                    );
                `;
                card.appendChild(layer);
            } else {
                glare.style.background = `radial-gradient(
                    ellipse at ${(x * 100).toFixed(0)}% ${(y * 100).toFixed(0)}%,
                    rgba(255, 255, 255, 0.14) 0%,
                    rgba(255, 255, 255, 0.03) 45%,
                    transparent 65%
                )`;
            }

            const glareLayer = card.querySelector('.glare-layer');
            if (glareLayer) glareLayer.style.opacity = '1';
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg)';
            card.style.transition = 'transform 0.5s cubic-bezier(0.22, 0.61, 0.36, 1)';

            const glareLayer = card.querySelector('.glare-layer');
            if (glareLayer) glareLayer.style.opacity = '0';

            const onTransitionEnd = () => {
                card.style.removeProperty('transform');
                card.style.removeProperty('transition');
                card.removeEventListener('transitionend', onTransitionEnd);
            };
            card.addEventListener('transitionend', onTransitionEnd);
        });

        card.addEventListener('mouseenter', () => {
            card.style.transition = 'transform 0.1s ease-out';
        });
    });
}

// 刷新随机阅读卡片（重新从所有文件中随机选三篇）
function refreshRandomCard() {
    if (!treeData || !treeData.children) return;
    const allFiles = [];
    function collect(nodes) {
        for (const n of nodes) {
            if (n.name === '日志') continue;
            if (n.type === 'file') allFiles.push(n);
            else if (n.type === 'folder' && n.children) collect(n.children);
        }
    }
    collect(treeData.children);
    if (allFiles.length === 0) return;
    const shuffled = [...allFiles].sort(() => Math.random() - 0.5);
    const picks = shuffled.slice(0, 3);
    const cards = viewer.querySelectorAll('.random-note');
    cards.forEach((card, i) => {
        const pick = picks[i] || picks[0]; // fallback if fewer than 3 files
        const rName = (pick.name || '').replace(/\.[^.]+$/, '');
        const rPath = pick.path || '';
        card.dataset.path = rPath;
        const span = card.querySelector('span');
        if (span) span.textContent = rName;
        card.classList.add('random-flash');
        setTimeout(() => card.classList.remove('random-flash'), 400);
    });
}

// 在文件夹中递归查找第一个 .md 文件
function findFirstMd(folderNode) {
    if (!folderNode || !folderNode.children) return null;
    for (const child of folderNode.children) {
        if (child.type === 'file' && child.ext === 'md') {
            return child;
        } else if (child.type === 'folder') {
            const found = findFirstMd(child);
            if (found) return found;
        }
    }
    return null;
}

// 跳转到第一篇笔记
function navigateToFirstNote() {
    if (defaultNotePath) {
        window.location.hash = '#' + encodeURIComponent(defaultNotePath);
        loadFromHash();
    } else if (treeData && treeData.children) {
        const firstMd = findFirstMd({ children: treeData.children });
        if (firstMd && firstMd.path) {
            window.location.hash = '#' + encodeURIComponent(firstMd.path);
            loadFromHash();
        }
    }
}

// 导出到全局，供 script.js 使用
window.HomeModule = {
    renderDefaultAbout: renderDefaultAbout,
    navigateToFirstNote: navigateToFirstNote
};