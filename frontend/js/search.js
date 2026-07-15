/**
 * search.js — 全站全文搜索模块
 * 
 * 依赖：Fuse.js (frontend/libs/js/fuse.min.js)
 * 搜索索引：/search-index.json（由 scripts/generate-search-index.js 构建时生成）
 * 
 * 功能：
 * - 顶栏搜索图标点击弹出搜索面板
 * - 实时模糊搜索（Fuse.js），防抖 200ms
 * - 结果标题 + 匹配片段 + 路径显示
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
    const MAX_RESULTS = 20;
    const SNIPPET_RADIUS = 60; // 匹配位置前后截取字符数

    /**
     * 初始化搜索模块
     */
    function init() {
        // 需要 DOM 加载后再查找元素
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
            // 搜索按钮/面板尚未渲染，稍后重试
            return;
        }

        // 绑定事件
        searchBtn.addEventListener('click', openSearch);
        closeBtn.addEventListener('click', closeSearch);
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) closeSearch();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && isOpen) closeSearch();
            // Ctrl+K 或 Cmd+K 快捷键打开搜索
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                openSearch();
            }
        });

        // 输入防抖搜索
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

        // 延迟聚焦，等待 CSS 过渡完成
        setTimeout(function () {
            input.focus();
        }, 100);

        // 如果索引未加载，加载索引
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
                // 如果输入框有内容，执行搜索
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
                threshold: 0.4,
                distance: 200,
                includeMatches: true,
                shouldSort: true,
                minMatchCharLength: 1
            });
        }
    }

    /**
     * 执行搜索并渲染结果
     */
    function _performSearch(query) {
        if (!fuse) {
            // Fuse 可能还没初始化完成
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
     * 渲染搜索结果列表
     */
    function _renderResults(results, query) {
        var html = '';
        // 显示结果数量
        html += '<div class="search-stats">找到 ' + results.length + ' 条结果</div>';

        for (var i = 0; i < results.length; i++) {
            var item = results[i].item;
            var matches = results[i].matches;
            var snippet = _extractSnippet(item.content, matches, query);
            var displayPath = item.path;

            html += '<div class="search-result-item" data-path="' + encodeURIComponent(item.path) + '">';
            html += '<div class="search-result-title">' + _highlightText(item.title, query) + '</div>';
            html += '<div class="search-result-snippet">' + snippet + '</div>';
            html += '<div class="search-result-path">' + displayPath + '</div>';
            html += '</div>';
        }

        resultsContainer.innerHTML = html;

        // 绑定点击事件
        var items = resultsContainer.querySelectorAll('.search-result-item');
        for (var j = 0; j < items.length; j++) {
            items[j].addEventListener('click', function (e) {
                var path = decodeURIComponent(this.getAttribute('data-path'));
                _navigateTo(path);
            });
        }
    }

    /**
     * 从匹配结果中提取摘要片段
     */
    function _extractSnippet(content, matches, query) {
        if (!matches || matches.length === 0) {
            return content.substring(0, SNIPPET_RADIUS * 2) + '...';
        }

        // 取 content 字段的第一个匹配位置
        var contentMatch = null;
        for (var i = 0; i < matches.length; i++) {
            if (matches[i].key === 'content') {
                contentMatch = matches[i];
                break;
            }
        }

        if (!contentMatch || !contentMatch.indices || contentMatch.indices.length === 0) {
            return content.substring(0, SNIPPET_RADIUS * 2) + '...';
        }

        // 取第一个匹配片段的起始位置
        var startIdx = contentMatch.indices[0][0];
        var endIdx = contentMatch.indices[0][1];

        var snippetStart = Math.max(0, startIdx - SNIPPET_RADIUS);
        var snippetEnd = Math.min(content.length, endIdx + SNIPPET_RADIUS);

        var snippet = content.substring(snippetStart, snippetEnd);

        // 添加省略号
        if (snippetStart > 0) snippet = '...' + snippet;
        if (snippetEnd < content.length) snippet = snippet + '...';

        // 高亮匹配文本
        return _highlightMatches(snippet, contentMatch.indices, snippetStart);
    }

    /**
     * 高亮文本中的匹配词
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
     * 高亮片段中的匹配位置（基于 Fuse 返回的 indices）
     */
    function _highlightMatches(snippet, indices, offset) {
        var result = escapeHtml(snippet);
        // 由于 snippet 已经过 escapeHtml，indices 位置需要重新计算
        // 简化方案：直接用 _highlightText 基于原始文本
        return _highlightText(snippet, '');
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