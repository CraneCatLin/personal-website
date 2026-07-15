/**
 * search.js — 全站全文搜索模块
 * 
 * 依赖：Fuse.js (frontend/libs/js/fuse.min.js)
 * 搜索索引：/search-index.json（由 scripts/generate-search-index.js 构建时生成）
 * 
 * 功能：
 * - 顶栏搜索图标点击弹出搜索面板
 * - 实时模糊搜索（Fuse.js），防抖 200ms
 * - 同一篇笔记的多个匹配合并为一个结果显示多个片段+匹配计数
 * - 基于 Fuse 精确 indices 位置高亮，消除假高亮
 * - 统计显示：'x 篇笔记中共有 y 个结果'
 * - ESC/点击遮罩/✕ 关闭
 * - 移动端全屏适配
 */
(function () {
    'use strict';

    // ---------- DOM 元素 ----------
    let searchBtn, overlay, input, resultsContainer, closeBtn;

    // ---------- 状态 ----------
    let fuse = null;        // Fuse 实例
    let indexData = null;   // 搜索索引缓存
    let isOpen = false;
    let debounceTimer = null;

    // ---------- 配置 ----------
    const INDEX_URL = '/search-index.json';
    const DEBOUNCE_MS = 200;
    const HIGHLIGHT_CLASS = 'search-highlight';
    const MAX_RESULTS = 50;
    const SNIPPET_RADIUS = 60; // 匹配位置前后截取字符数

    /**
     * 初始化搜索模块
     */
    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', _initDOM);
        } else {
            _initDOM();
        }
    }

    function _initDOM() {
        searchBtn = document.getElementById('searchBtn');
        overlay = document.getElementById('searchOverlay');
        input = document.getElementById('searchInput');
        resultsContainer = document.getElementById('searchResults');
        closeBtn = document.getElementById('searchCloseBtn');

        if (!searchBtn || !overlay || !input || !resultsContainer || !closeBtn) {
            return;
        }

        searchBtn.addEventListener('click', openSearch);
        closeBtn.addEventListener('click', closeSearch);
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) closeSearch();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && isOpen) closeSearch();
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                openSearch();
            }
        });

        input.addEventListener('input', function () {
            clearTimeout(debounceTimer);
            const query = input.value.trim();
            if (!query) {
                _showHint('输入关键词开始搜索');
                return;
            }
            debounceTimer = setTimeout(function () {
                _performSearch(query);
            }, DEBOUNCE_MS);
        });
    }

    /**
     * 打开搜索面板
     */
    function openSearch() {
        if (isOpen) return;
        isOpen = true;

        overlay.classList.add('active');

        setTimeout(function () {
            input.focus();
        }, 100);

        if (!fuse && !indexData) {
            _showHint('正在加载搜索索引...');
            _loadIndex();
        } else if (indexData) {
            _ensureFuse();
            if (input.value.trim()) {
                _performSearch(input.value.trim());
            } else {
                _showHint('输入关键词开始搜索');
            }
        }
    }

    /**
     * 关闭搜索面板
     */
    function closeSearch() {
        if (!isOpen) return;
        isOpen = false;
        overlay.classList.remove('active');
        input.value = '';
        resultsContainer.innerHTML = '';
        document.activeElement && document.activeElement.blur();
    }

    /**
     * 加载搜索索引文件
     */
    function _loadIndex() {
        if (indexData) {
            _ensureFuse();
            return;
        }

        fetch(INDEX_URL)
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(function (data) {
                indexData = data;
                _ensureFuse();
                _showHint('输入关键词开始搜索');
                if (input.value.trim()) {
                    _performSearch(input.value.trim());
                }
            })
            .catch(function (err) {
                console.error('搜索索引加载失败:', err);
                _showError('搜索索引加载失败，请稍后重试');
            });
    }

    /**
     * 确保 Fuse 实例已初始化
     */
    function _ensureFuse() {
        if (!fuse && indexData && typeof Fuse !== 'undefined') {
            fuse = new Fuse(indexData, {
                keys: [
                    { name: 'title', weight: 0.7 },
                    { name: 'content', weight: 0.3 }
                ],
                threshold: 0.5,
                distance: 100000,
                includeMatches: true,
                shouldSort: true,
                minMatchCharLength: 2
            });
        }
    }

    /**
     * 执行搜索并渲染结果
     */
    function _performSearch(query) {
        if (!fuse) {
            return;
        }

        const rawResults = fuse.search(query);
        const results = rawResults.slice(0, MAX_RESULTS);

        if (results.length === 0) {
            _showEmpty('未找到与 "' + escapeHtml(query) + '" 相关的笔记');
            return;
        }

        _renderResults(results, query);
    }

    /**
     * 从 matches 中提取指定 key 的 indices
     */
    function _getIndices(matches, key) {
        if (!matches) return null;
        for (var i = 0; i < matches.length; i++) {
            if (matches[i].key === key) {
                return matches[i].indices;
            }
        }
        return null;
    }

    /**
     * 渲染搜索结果列表
     * 
     * 需求：
     * 1. 同一篇笔记多个匹配合并为一个结果项，显示该篇标题、多个匹配片段（加高亮）、该篇匹配数量
     * 2. 统计信息显示 "x篇笔记中共有y个结果"
     * 3. 高亮基于 Fuse 精确 indices 位置，消除位移
     */
    function _renderResults(results, query) {
        var totalMatchCount = 0;   // 所有笔记匹配位置数量之和
        var html = '';

        for (var i = 0; i < results.length; i++) {
            var item = results[i].item;
            var matches = results[i].matches;

            // 获取 content 和 title 的匹配 indices
            var contentIndices = _getIndices(matches, 'content') || [];
            var titleIndices = _getIndices(matches, 'title') || [];

            // 该篇的总匹配数 = content 匹配数 + title 匹配数
            var noteMatchCount = contentIndices.length + titleIndices.length;
            totalMatchCount += noteMatchCount;

            // 提取多个匹配片段（每个匹配位置一个片段，重叠的合并）
            var snippets = _extractSnippets(item.content, contentIndices);

            html += '<div class="search-result-item" data-path="' + encodeURIComponent(item.path) + '">';

            // 标题（有精确 indices 则用精确高亮，否则用回退正则）
            if (titleIndices && titleIndices.length > 0) {
                html += '<div class="search-result-title">' + _buildHighlightedSnippet(item.title, titleIndices) + '</div>';
            } else {
                html += '<div class="search-result-title">' + _highlightText(item.title, query) + '</div>';
            }

            // 多个匹配片段
            for (var k = 0; k < snippets.length; k++) {
                html += '<div class="search-result-snippet">' + snippets[k] + '</div>';
            }

            // 底部信息：路径 + 匹配计数
            html += '<div class="search-result-meta">';
            html += '<span class="search-result-path">' + escapeHtml(item.path) + '</span>';
            html += '<span class="search-result-count">' + noteMatchCount + ' 个匹配</span>';
            html += '</div>';

            html += '</div>';
        }

        // 统计信息
        var statsHtml = '<div class="search-stats">' + results.length + ' 篇笔记中共有 ' + totalMatchCount + ' 个结果</div>';

        resultsContainer.innerHTML = statsHtml + html;

        // 绑定点击事件
        var items = resultsContainer.querySelectorAll('.search-result-item');
        for (var j = 0; j < items.length; j++) {
            items[j].addEventListener('click', function (e) {
                // 点击内部元素不冒泡到 .search-result-meta 等
                var path = decodeURIComponent(this.getAttribute('data-path'));
                _navigateTo(path);
            });
        }
    }

    /**
     * 从 content 中提取多个匹配片段
     * 
     * 对每个匹配位置截取前后 SNIPPET_RADIUS 字符，
     * 相邻或重叠的片段自动合并，
     * 返回数组，每个元素是已高亮的 HTML 字符串
     */
    function _extractSnippets(content, indices) {
        if (!indices || indices.length === 0) {
            // 无内容匹配时显示开头片段（无高亮）
            var fallback = content.substring(0, SNIPPET_RADIUS * 2);
            if (content.length > SNIPPET_RADIUS * 2) fallback += '...';
            return ['<span class="snippet-text">' + escapeHtml(fallback) + '</span>'];
        }

        // 按起始位置排序
        var sorted = indices.slice().sort(function (a, b) { return a[0] - b[0]; });

        // 构建片段列表（合并重叠/相邻片段）
        var rawSnippets = [];

        for (var i = 0; i < sorted.length; i++) {
            var matchStart = sorted[i][0];
            var matchEnd = sorted[i][1];

            var snipStart = Math.max(0, matchStart - SNIPPET_RADIUS);
            var snipEnd = Math.min(content.length, matchEnd + SNIPPET_RADIUS);

            // 尝试与上一个片段合并
            if (rawSnippets.length > 0) {
                var prev = rawSnippets[rawSnippets.length - 1];
                // 如果当前片段与上一个重叠或相邻（间隔不超过 10 字符）
                if (snipStart <= prev.snipEnd + 10) {
                    // 扩展上一个片段的结束位置
                    if (snipEnd > prev.snipEnd) {
                        prev.snipEnd = snipEnd;
                    }
                    // 添加当前匹配位置到上一个片段的 indices 列表中
                    prev.matchIndices.push({
                        start: matchStart - prev.snipStart,
                        end: matchEnd - prev.snipStart
                    });
                    continue;
                }
            }

            // 新建片段
            rawSnippets.push({
                snipStart: snipStart,
                snipEnd: snipEnd,
                matchIndices: [{
                    start: matchStart - snipStart,
                    end: matchEnd - snipStart
                }]
            });
        }

        // 渲染为 HTML
        var result = [];
        for (var i = 0; i < rawSnippets.length; i++) {
            var s = rawSnippets[i];
            var rawText = content.substring(s.snipStart, s.snipEnd);

            var prefix = s.snipStart > 0 ? '...' : '';
            var suffix = s.snipEnd < content.length ? '...' : '';

            // 用精确 indices 构建高亮 HTML
            var highlighted = _buildHighlightedSnippet(rawText, s.matchIndices);
            result.push(prefix + highlighted + suffix);
        }

        return result;
    }

    /**
     * 基于精确位置索引构建带高亮的 HTML
     * 
     * 将文本按匹配位置切分成普通段和高亮段，
     * 直接 escapeHtml 后包裹 <span>，消除假高亮位移
     * 
     * @param {string} text - 要渲染的原始文本
     * @param {Array} indices - 匹配位置数组 [[start, end], ...]（相对于 text 的偏移）
     * @returns {string} 带 <span> 高亮的 HTML
     */
    function _buildHighlightedSnippet(text, indices) {
        if (!indices || indices.length === 0) {
            return escapeHtml(text);
        }

        // 按起始位置排序
        var sorted = indices.slice().sort(function (a, b) { return a[0] - b[0]; });

        var segments = [];
        var lastEnd = 0;

        for (var i = 0; i < sorted.length; i++) {
            var idxStart = sorted[i][0];
            var idxEnd = sorted[i][1];

            // 裁剪到有效范围
            if (idxStart < 0) idxStart = 0;
            if (idxEnd >= text.length) idxEnd = text.length - 1;
            if (idxStart > idxEnd) continue;

            // 普通段（高亮区域前的文本）
            if (idxStart > lastEnd) {
                segments.push({
                    text: text.substring(lastEnd, idxStart),
                    highlight: false
                });
            }

            // 高亮段（Fuse 的 indices 是包含区间，[start, end]）
            segments.push({
                text: text.substring(idxStart, idxEnd + 1),
                highlight: true
            });

            lastEnd = idxEnd + 1;
        }

        // 剩余普通段
        if (lastEnd < text.length) {
            segments.push({
                text: text.substring(lastEnd),
                highlight: false
            });
        }

        // 构建 HTML：只对高亮段包裹 <span>，普通段直接输出 escaped HTML
        var html = '';
        for (var i = 0; i < segments.length; i++) {
            var seg = segments[i];
            var escaped = escapeHtml(seg.text);
            if (seg.highlight) {
                html += '<span class="' + HIGHLIGHT_CLASS + '">' + escaped + '</span>';
            } else {
                // 非高亮段也用 <span> 包裹，避免 -webkit-box 渲染模式下裸文本节点不显示
                html += '<span>' + escaped + '</span>';
            }
        }
        return html;
    }

    /**
     * 正则高亮文本（回退方案，用于无精确 indices 时）
     */
    function _highlightText(text, query) {
        if (!query) return escapeHtml(text);
        var escaped = escapeHtml(text);
        var words = query.split(/\s+/).filter(function (w) { return w.length > 0; });
        for (var i = 0; i < words.length; i++) {
            var pattern = _escapeRegex(words[i]);
            var regex = new RegExp('(' + pattern + ')', 'gi');
            escaped = escaped.replace(regex, '<span class="' + HIGHLIGHT_CLASS + '">$1</span>');
        }
        return escaped;
    }

    /**
     * 展示提示信息
     */
    function _showHint(text) {
        resultsContainer.innerHTML = '<div class="search-hint">' + text + '</div>';
    }

    /**
     * 展示错误信息
     */
    function _showError(text) {
        resultsContainer.innerHTML = '<div class="search-error">' + text + '</div>';
    }

    /**
     * 展示空结果
     */
    function _showEmpty(text) {
        resultsContainer.innerHTML = '<div class="search-empty">' + text + '</div>';
    }

    /**
     * 导航到指定笔记
     */
    function _navigateTo(filePath) {
        closeSearch();
        window.location.hash = '#' + filePath;
    }

    /**
     * HTML 转义
     */
    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(text));
        return div.innerHTML;
    }

    /**
     * 正则转义
     */
    function _escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // 导出模块
    window.SearchModule = {
        init: init,
        open: openSearch,
        close: closeSearch
    };
})();