/**
 * 日志模块 - 从 script.js 拆分
 * 依赖：core.js（提供全局 viewer, body, currentFilePath, showContentSkeleton, 
 *       escapeHtml, processMathFormulas, enhanceCodeBlocks 等变量和函数）
 * 依赖：toc.js（提供 window.TOCModule.clearTOC）
 */

// ==================== 日志页面 ====================
// 日志数据结构：所有日志文件 + 按日期索引
let logTreeData = null;
let logFilesAll = [];
let logDateMap = {}; // "2026-05-27" -> [file, file, ...]

function renderLogPage() {
    document.title = '日志 - CraneCat喵~';
    window.TOCModule.clearTOC();

    viewer.innerHTML = `<div style="text-align:center; padding:60px 20px; color:var(--text-muted);">加载中...</div>`;

    fetch('/tree-log.json')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then(data => {
            logTreeData = data;

            let nodes = [];
            if (Array.isArray(data)) {
                nodes = data;
            } else if (data && data.children) {
                nodes = data.children;
            } else {
                nodes = [];
            }

            // 收集所有日志文件
            logFilesAll = [];
            logDateMap = {};
            function collectFiles(fileNodes, parentPath = '') {
                for (const n of fileNodes) {
                    const np = parentPath ? parentPath + '/' + n.name : n.name;
                    if (n.type === 'file') {
                        // 确保节点有 path 属性，用基于根目录的完整路径覆盖
                        n.path = np;
                        logFilesAll.push(n);
                        // 从文件名解析日期 YYYY-MM-DD 格式
                        let dateKey = '';
                        const nameMatch = (n.name || '').match(/(\d{4})-(\d{2})-(\d{2})/);
                        if (nameMatch) {
                            dateKey = nameMatch[1] + '-' + nameMatch[2] + '-' + nameMatch[3];
                        }
                        if (dateKey) {
                            if (!logDateMap[dateKey]) logDateMap[dateKey] = [];
                            logDateMap[dateKey].push(n);
                        }
                    } else if (n.type === 'folder' && n.children) {
                        collectFiles(n.children, np);
                    }
                }
            }
            collectFiles(nodes, (data && data.name) || '');
            // 按文件名（日期）排序
            logFilesAll.sort((a, b) => {
                const nameA = (a.name || '').replace(/\.[^.]+$/, '');
                const nameB = (b.name || '').replace(/\.[^.]+$/, '');
                return nameB.localeCompare(nameA);
            });

            if (logFilesAll.length === 0) {
                viewer.innerHTML = `
                    <div class="log-page">
                        <h2 style="text-align:center;color:var(--text-muted);">暂无日志</h2>
                    </div>`;
                return;
            }

            // 默认显示最新年份和月份
            const now = new Date();
            let curYear = now.getFullYear();
            let curMonth = now.getMonth() + 1;

            buildLogPageUI(curYear, curMonth);
        })
        .catch(error => {
            viewer.innerHTML = `<div class="log-page"><p style="text-align:center;color:var(--text-muted);">❌ 加载日志失败: ${error.message}</p></div>`;
        });
}

function buildLogPageUI(year, month) {
    const weekLabels = ['日', '一', '二', '三', '四', '五', '六'];

    function getDaysInMonth(y, m) {
        return new Date(y, m, 0).getDate();
    }

    function getFirstDayOfWeek(y, m) {
        return new Date(y, m - 1, 1).getDay();
    }

    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfWeek(year, month);
    const totalRows = Math.ceil((firstDay + daysInMonth) / 7);

    // 构建今天日期字符串
    const today = new Date();
    const todayKey = today.getFullYear() + '-' +
        String(today.getMonth() + 1).padStart(2, '0') + '-' +
        String(today.getDate()).padStart(2, '0');

    // 构建日历 HTML
    let calHTML = '<table class="log-calendar-table">';
    calHTML += '<thead><tr>' + weekLabels.map(w => `<th>${w}</th>`).join('') + '</tr></thead>';
    calHTML += '<tbody>';

    for (let r = 0; r < totalRows; r++) {
        calHTML += '<tr>';
        for (let c = 0; c < 7; c++) {
            const cellDay = r * 7 + c - firstDay + 1;
            if (cellDay < 1 || cellDay > daysInMonth) {
                calHTML += '<td class="log-cal-empty"></td>';
            } else {
                const dateKey = year + '-' + String(month).padStart(2, '0') + '-' + String(cellDay).padStart(2, '0');
                const entries = logDateMap[dateKey] || [];
                const count = entries.length;
                let levelClass = '';
                if (count >= 3) levelClass = 'log-cal-level-3';
                else if (count >= 2) levelClass = 'log-cal-level-2';
                else if (count >= 1) levelClass = 'log-cal-level-1';
                else levelClass = 'log-cal-no-log';
                const isToday = dateKey === todayKey;
                const todayClass = isToday ? ' log-cal-today' : '';
                const clickableClass = count > 0 ? ' log-cal-clickable' : '';
                const titleAttr = count > 0 ? ` title="${dateKey}: ${count} 篇日志"` : ` title="${dateKey}: 无日志"`;
                calHTML += `<td class="log-cal-cell ${levelClass}${todayClass}${clickableClass}" data-date="${dateKey}"${titleAttr}>${cellDay}</td>`;
            }
        }
        calHTML += '</tr>';
    }
    calHTML += '</tbody></table>';

    // 收集所有可用年份和月份
    const allYears = new Set();
    for (const key of Object.keys(logDateMap)) {
        allYears.add(parseInt(key.split('-')[0]));
    }
    allYears.add(new Date().getFullYear());
    const sortedYears = Array.from(allYears).sort((a, b) => b - a);

    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

    // 构建年份/月份下拉选择器
    const yearSelectHTML = sortedYears.map(y =>
        `<option value="${y}"${y === year ? ' selected' : ''}>${y} 年</option>`
    ).join('');
    const monthSelectHTML = monthNames.map((name, i) =>
        `<option value="${i + 1}"${(i + 1) === month ? ' selected' : ''}>${name}</option>`
    ).join('');

    viewer.innerHTML = `
        <div class="log-page">
            <div class="log-page-header">
                <h1>📅 日志</h1>
            </div>
            <div class="log-calendar-container">
                <div class="log-calendar-header">
                    <button class="log-nav-btn" id="logPrevMonth" title="上个月">◀</button>
                    <div class="log-calendar-jump">
                        <select id="logJumpYear" class="log-jump-select">${yearSelectHTML}</select>
                        <select id="logJumpMonth" class="log-jump-select">${monthSelectHTML}</select>
                    </div>
                    <button class="log-nav-btn" id="logNextMonth" title="下个月">▶</button>
                </div>
                ${calHTML}
            </div>
            <div id="log-date-detail" class="log-date-detail" style="display:none;"></div>
        </div>`;

    // 年份/月份下拉跳转
    const jumpYear = viewer.querySelector('#logJumpYear');
    const jumpMonth = viewer.querySelector('#logJumpMonth');
    if (jumpYear && jumpMonth) {
        const doJump = () => {
            const y = parseInt(jumpYear.value);
            const m = parseInt(jumpMonth.value);
            buildLogPageUI(y, m);
        };
        jumpYear.addEventListener('change', doJump);
        jumpMonth.addEventListener('change', doJump);
    }

    // 月份导航
    const prevBtn = viewer.querySelector('#logPrevMonth');
    const nextBtn = viewer.querySelector('#logNextMonth');
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            let y = year, m = month - 1;
            if (m < 1) { m = 12; y--; }
            buildLogPageUI(y, m);
        });
    }
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            let y = year, m = month + 1;
            if (m > 12) { m = 1; y++; }
            buildLogPageUI(y, m);
        });
    }

    // 日历单元格点击 → 直接跳转到日志文件
    viewer.querySelectorAll('.log-cal-cell.log-cal-clickable').forEach(cell => {
        cell.addEventListener('click', () => {
            const dateKey = cell.dataset.date;
            const entries = logDateMap[dateKey] || [];
            if (entries.length > 0) {
                const filePath = entries[0].path;
                window.location.hash = '#' + encodeURIComponent('log:' + filePath);
                loadLogFile(filePath);
            }
        });
    });
}

// 显示某一天的日志条目（从日历点击进入）
function showLogDateDetail(dateKey, entries) {
    const detailDiv = document.getElementById('log-date-detail');
    if (!detailDiv) return;

    if (entries.length === 0) {
        detailDiv.innerHTML = `<p style="text-align:center;color:var(--text-muted);">该日无日志</p>`;
        detailDiv.style.display = 'block';
        return;
    }

    // 解析日期用于显示
    const parts = dateKey.split('-');
    const displayDate = parts[0] + '年' + parseInt(parts[1]) + '月' + parseInt(parts[2]) + '日';

    let listHTML = `<div class="log-detail-header">
        <button class="log-back-btn" id="logBackToCal">← 返回日历</button>
        <span class="log-detail-date">${displayDate}</span>
        <span class="log-detail-count">${entries.length} 篇</span>
    </div>`;
    listHTML += '<ul class="log-detail-list">';

    for (const f of entries) {
        const displayName = (f.name || '').replace(/\.[^.]+$/, '');
        const path = f.path || '';
        listHTML += `<li class="log-item" data-path="${escapeHtml(path)}">
            <span class="log-item-icon">📝</span>
            <span class="log-item-name">${escapeHtml(displayName)}</span>
        </li>`;
    }
    listHTML += '</ul>';

    detailDiv.innerHTML = listHTML;
    detailDiv.style.display = 'block';

    // 返回按钮
    const backBtn = detailDiv.querySelector('#logBackToCal');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            detailDiv.style.display = 'none';
        });
    }

    // 日志条目点击 → 阅读日志
    detailDiv.querySelectorAll('.log-item').forEach(item => {
        item.addEventListener('click', () => {
            const path = item.dataset.path;
            if (path) {
                window.location.hash = '#' + encodeURIComponent('log:' + path);
                loadLogFile(path);
            }
        });
    });

    detailDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// 加载单个日志文件
function loadLogFile(filePath) {
    showContentSkeleton();
    const fullPath = '/public/' + filePath;
    fetch(fullPath, {
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        }
    })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.text();
        })
        .then(markdown => {
            // 确定上一篇/下一篇（logFilesAll 按日期降序：最新在前）
            // 索引越小越新，越大越旧
            // 上一篇 = 更旧的（索引+1），下一篇 = 更新的（索引-1）
            const idx = logFilesAll.findIndex(f => f.path === filePath);
            const prevFile = (idx >= 0 && idx < logFilesAll.length - 1) ? logFilesAll[idx + 1] : null;
            const nextFile = (idx > 0 && idx < logFilesAll.length) ? logFilesAll[idx - 1] : null;
            renderLogMarkdown(markdown, filePath, prevFile, nextFile);
        })
        .catch(error => {
            viewer.innerHTML = `<div class="markdown-body error"><h2>❌ 加载日志失败</h2><p>无法加载 ${filePath} (${error.message})</p></div>`;
        });
    currentFilePath = filePath;
    document.body.classList.remove('homepage', 'note-page');
    document.body.classList.add('hide-sidebar');
    setBackgroundForPage('log');
}

// 渲染日志 Markdown（带头部返回按钮 + 上一篇/下一篇导航，无 TOC）
function renderLogMarkdown(markdownText, filePath, prevFile, nextFile) {
    if (!window.markdownit) {
        viewer.innerHTML = `<div class="markdown-body error"><h2>❌ 渲染失败</h2><p>markdown-it 未加载</p></div>`;
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

        let pluginEnabled = false;
        if (window.texmath && window.katex) {
            try {
                md.use(window.texmath, {
                    engine: window.katex,
                    delimiters: 'dollars',
                    katexOptions: { throwOnError: false }
                });
                pluginEnabled = true;
            } catch (err) { }
        }

        if (window.hljs) {
            md.options.highlight = function (str, lang) {
                if (lang && window.hljs.getLanguage(lang)) {
                    try { return window.hljs.highlight(str, { language: lang }).value; } catch (__) { }
                }
                return md.utils.escapeHtml(str);
            };
        }

        const fileNameWithoutExt = filePath.split('/').pop().replace(/\.[^/.]+$/, "");

        let finalHtml;
        if (!pluginEnabled && window.katex) {
            finalHtml = md.render(processMathFormulas(markdownText));
        } else {
            finalHtml = md.render(markdownText);
        }

        document.title = `${fileNameWithoutExt} - 日志`;

        // 处理图片路径
        finalHtml = finalHtml.replace(/<img\s+src="([^"]+)"([^>]*)>/gi, function (match, src, rest) {
            if (src && !src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('/')) {
                const dir = filePath.substring(0, filePath.lastIndexOf('/') + 1);
                const newSrc = '/public/' + dir + src;
                return `<img src="${newSrc}"${rest}>`;
            }
            return match;
        });

        // 构建上一篇/下一篇导航 HTML
        const prevBtnHtml = prevFile
            ? `<button class="log-nav-article-btn" data-path="${escapeHtml(prevFile.path)}">← ${escapeHtml(prevFile.name.replace(/\.[^.]+$/, ''))}</button>`
            : `<button class="log-nav-article-btn disabled">← 上一篇</button>`;
        const nextBtnHtml = nextFile
            ? `<button class="log-nav-article-btn" data-path="${escapeHtml(nextFile.path)}">${escapeHtml(nextFile.name.replace(/\.[^.]+$/, ''))} →</button>`
            : `<button class="log-nav-article-btn disabled">下一篇 →</button>`;

        // 返回按钮 + 内容 + 上一篇/下一篇导航
        viewer.innerHTML = `
            <div class="log-reading">
                <div class="log-reading-header">
                    <a href="#logs" class="log-back-btn">← 返回日历</a>
                    <span class="log-reading-title">${escapeHtml(fileNameWithoutExt)}</span>
                </div>
                <div class="log-reading-content markdown-body">
                    ${finalHtml}
                </div>
                <div class="log-nav-prev-next">
                    ${prevBtnHtml}
                    <span class="log-nav-spacer"></span>
                    ${nextBtnHtml}
                </div>
            </div>`;

        // 绑定上一篇/下一篇点击事件
        const navBtns = viewer.querySelectorAll('.log-nav-article-btn:not(.disabled)');
        navBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const path = btn.dataset.path;
                if (path) {
                    window.location.hash = '#' + encodeURIComponent('log:' + path);
                    loadLogFile(path);
                }
            });
        });

        if (window.hljs && !md.options.highlight) {
            document.querySelectorAll('.log-reading-content pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
        }
        enhanceCodeBlocks();
        window.TOCModule.clearTOC();

        // 显示阅读次数
        const logContent = viewer.querySelector('.log-reading-content');
        if (logContent) {
            renderPageViewCount(logContent, filePath);
        }
    } catch (error) {
        console.error('日志 Markdown 渲染出错:', error);
        viewer.innerHTML = `<div class="markdown-body error"><h2>❌ 渲染失败</h2><p>${error.message}</p></div>`;
        window.TOCModule.clearTOC();
    }
}

// 导出到全局，供 script.js 使用
window.LogModule = {
    renderLogPage: renderLogPage,
    loadLogFile: loadLogFile
};