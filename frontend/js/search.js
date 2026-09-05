/**
 * search.js — 全站全文搜索模块
 *
 * 依赖：Fuse.js (frontend/libs/js/fuse.min.js)
 * 搜索索引：/search-index.json（由 scripts/generate-search-index.js 构建时生成）
 *
 * 功能：
 * - 顶栏按钮与 Ctrl/Cmd + K 打开搜索面板
 * - 实时模糊搜索（Fuse.js），防抖 160ms
 * - 同一篇笔记合并展示，最多显示两个相关片段
 * - 支持方向键选择、Enter 打开、Esc 关闭
 * - 管理焦点、滚动锁定和可访问状态
 * - 移动端全屏适配
 */
(function () {
    'use strict';

    // ---------- DOM 元素 ----------
    let searchBtn, overlay, input, resultsContainer, closeBtn, clearBtn;

    // ---------- 状态 ----------
    let fuse = null;
    let indexData = null;
    let indexPromise = null;
    let isOpen = false;
    let debounceTimer = null;
    let focusTimer = null;
    let activeIndex = -1;
    let previouslyFocused = null;

    // ---------- 配置 ----------
    const INDEX_URL = '/search-index.json?v=20260905';
    const DEBOUNCE_MS = 160;
    const HIGHLIGHT_CLASS = 'search-highlight';
    const MAX_RESULTS = 50;
    const MAX_SNIPPETS = 2;
    const SNIPPET_RADIUS = 56;

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
        clearBtn = document.getElementById('searchClearBtn');

        if (!searchBtn || !overlay || !input || !resultsContainer || !closeBtn || !clearBtn) {
            return;
        }

        searchBtn.addEventListener('click', openSearch);
        searchBtn.addEventListener('mouseenter', _loadIndex, { once: true });
        searchBtn.addEventListener('focus', _loadIndex, { once: true });
        closeBtn.addEventListener('click', closeSearch);
        clearBtn.addEventListener('click', _clearSearch);

        overlay.addEventListener('click', function (event) {
            if (event.target === overlay) closeSearch();
        });

        document.addEventListener('keydown', function (event) {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                openSearch();
                return;
            }

            if (!isOpen) return;

            if (event.key === 'Escape') {
                event.preventDefault();
                closeSearch();
            } else if (event.key === 'Tab') {
                _trapFocus(event);
            }
        });

        input.addEventListener('keydown', function (event) {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                _moveSelection(1);
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                _moveSelection(-1);
            } else if (event.key === 'Enter') {
                var items = _getResultItems();
                if (items.length > 0) {
                    event.preventDefault();
                    var selected = activeIndex >= 0 ? items[activeIndex] : items[0];
                    _navigateTo(decodeURIComponent(selected.getAttribute('data-path')));
                }
            }
        });

        input.addEventListener('input', function () {
            clearTimeout(debounceTimer);
            var query = input.value.trim();
            clearBtn.hidden = !query;
            _setActiveIndex(-1, false);

            if (!query) {
                _showHint('输入关键词，搜索标题与笔记正文');
                return;
            }

            if (!fuse) {
                _showLoading();
                _loadIndex().then(function () {
                    if (isOpen && input.value.trim()) _performSearch(input.value.trim());
                }).catch(function () { });
                return;
            }

            debounceTimer = setTimeout(function () {
                _performSearch(query);
            }, DEBOUNCE_MS);
        });

        resultsContainer.addEventListener('click', function (event) {
            var retryButton = event.target.closest('[data-search-retry]');
            if (retryButton) {
                _showLoading();
                _loadIndex(true).then(function () {
                    if (!isOpen) return;
                    var query = input.value.trim();
                    query ? _performSearch(query) : _showHint('输入关键词，搜索标题与笔记正文');
                }).catch(function () { });
                return;
            }

            var item = event.target.closest('.search-result-item');
            if (item) {
                _navigateTo(decodeURIComponent(item.getAttribute('data-path')));
            }
        });

        resultsContainer.addEventListener('mouseover', function (event) {
            var item = event.target.closest('.search-result-item');
            if (!item) return;
            var items = _getResultItems();
            _setActiveIndex(Array.prototype.indexOf.call(items, item), false);
        });
    }

    /**
     * 打开搜索面板
     */
    function openSearch() {
        if (!overlay || !input) return;

        if (isOpen) {
            input.focus();
            return;
        }

        previouslyFocused = document.activeElement;
        isOpen = true;
        overlay.classList.add('active');
        overlay.setAttribute('aria-hidden', 'false');
        searchBtn.setAttribute('aria-expanded', 'true');
        document.body.classList.add('search-open');
        _setPageInert(true);

        focusTimer = setTimeout(function () {
            if (isOpen) input.focus();
        }, 60);

        if (!fuse) {
            _showLoading();
            _loadIndex().then(function () {
                if (!isOpen) return;
                var query = input.value.trim();
                query ? _performSearch(query) : _showHint('输入关键词，搜索标题与笔记正文');
            }).catch(function () { });
        } else if (input.value.trim()) {
            _performSearch(input.value.trim());
        } else {
            _showHint('输入关键词，搜索标题与笔记正文');
        }
    }

    /**
     * 关闭搜索面板并将焦点还给打开前的元素
     */
    function closeSearch() {
        if (!isOpen) return;

        isOpen = false;
        clearTimeout(debounceTimer);
        clearTimeout(focusTimer);
        overlay.classList.remove('active');
        overlay.setAttribute('aria-hidden', 'true');
        searchBtn.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('search-open');
        _setPageInert(false);
        input.value = '';
        clearBtn.hidden = true;
        _showHint('输入关键词，搜索标题与笔记正文');
        _setActiveIndex(-1, false);

        var canRestoreFocus = previouslyFocused && previouslyFocused.matches &&
            previouslyFocused.matches('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])') &&
            !previouslyFocused.disabled && document.contains(previouslyFocused);
        var focusTarget = canRestoreFocus
            ? previouslyFocused
            : searchBtn;
        if (focusTarget && typeof focusTarget.focus === 'function') focusTarget.focus();
        previouslyFocused = null;
    }

    function _clearSearch() {
        clearTimeout(debounceTimer);
        input.value = '';
        clearBtn.hidden = true;
        _showHint('输入关键词，搜索标题与笔记正文');
        _setActiveIndex(-1, false);
        input.focus();
    }

    /**
     * 加载搜索索引；并发调用共用同一个 Promise，失败后可重试
     */
    function _loadIndex(forceReload) {
        if (indexData && !forceReload) {
            _ensureFuse();
            return Promise.resolve(indexData);
        }
        if (indexPromise && !forceReload) return indexPromise;

        if (forceReload) {
            indexData = null;
            fuse = null;
            indexPromise = null;
        }

        indexPromise = fetch(INDEX_URL)
            .then(function (response) {
                if (!response.ok) throw new Error('HTTP ' + response.status);
                return response.json();
            })
            .then(function (data) {
                if (!Array.isArray(data)) throw new Error('索引格式无效');
                indexData = data;
                _ensureFuse();
                if (!fuse) throw new Error('Fuse.js 未加载');
                return data;
            })
            .catch(function (error) {
                indexPromise = null;
                console.error('搜索索引加载失败:', error);
                if (isOpen) _showError('搜索暂时不可用，请检查网络后重试');
                throw error;
            });

        indexPromise.catch(function () { });
        return indexPromise;
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
                minMatchCharLength: 1
            });
        }
    }

    /**
     * 执行搜索并渲染结果
     */
    function _performSearch(query) {
        if (!fuse || !query) return;

        resultsContainer.setAttribute('aria-busy', 'true');
        var rawResults = fuse.search(query);
        var results = rawResults.slice(0, MAX_RESULTS);

        if (results.length === 0) {
            _showEmpty('没有找到“' + query + '”');
            return;
        }

        _renderResults(results, query, rawResults.length);
    }

    /**
     * 从 matches 中提取指定 key 的 indices
     */
    function _getIndices(matches, key) {
        if (!matches) return [];
        for (var i = 0; i < matches.length; i++) {
            if (matches[i].key === key) return matches[i].indices || [];
        }
        return [];
    }

    /**
     * 渲染搜索结果列表
     */
    function _renderResults(results, query, totalResultCount) {
        var totalMatchCount = 0;
        var html = '';

        for (var i = 0; i < results.length; i++) {
            var item = results[i].item;
            var matches = results[i].matches;
            var contentIndices = _getIndices(matches, 'content');
            var titleIndices = _getIndices(matches, 'title');
            var noteMatchCount = Math.max(1, contentIndices.length + titleIndices.length);
            var snippets = _extractSnippets(item.content || '', contentIndices);
            var resultId = 'searchResult-' + i;

            totalMatchCount += noteMatchCount;
            html += '<button type="button" class="search-result-item" id="' + resultId + '"';
            html += ' role="option" tabindex="-1" aria-selected="false" data-path="' + encodeURIComponent(item.path) + '">';

            html += '<span class="search-result-title">';
            html += titleIndices.length > 0
                ? _buildHighlightedSnippet(item.title, titleIndices)
                : _highlightText(item.title, query);
            html += '</span>';

            for (var j = 0; j < snippets.length; j++) {
                html += '<span class="search-result-snippet">' + snippets[j] + '</span>';
            }

            html += '<span class="search-result-meta">';
            html += '<span class="search-result-path">' + escapeHtml(item.path) + '</span>';
            html += '<span class="search-result-count">命中 ' + noteMatchCount + ' 处</span>';
            html += '</span>';
            html += '</button>';
        }

        var statsText = '找到 ' + totalResultCount + ' 篇笔记 · 共 ' + totalMatchCount + ' 处命中';
        if (totalResultCount > results.length) statsText += ' · 显示前 ' + results.length + ' 篇';
        var statsHtml = '<div class="search-stats" role="status">' + statsText + '</div>';

        resultsContainer.innerHTML = statsHtml + html;
        resultsContainer.setAttribute('aria-busy', 'false');
        input.setAttribute('aria-expanded', 'true');
        _setActiveIndex(0, false);
    }

    /**
     * 从正文中提取最多两个相关片段；相邻片段会自动合并
     */
    function _extractSnippets(content, indices) {
        if (!indices || indices.length === 0) {
            var fallback = content.substring(0, SNIPPET_RADIUS * 2).trim();
            if (!fallback) return [];
            if (content.length > SNIPPET_RADIUS * 2) fallback += '…';
            return ['<span class="snippet-text">' + escapeHtml(fallback) + '</span>'];
        }

        var sorted = indices.slice().sort(function (a, b) { return a[0] - b[0]; });
        var rawSnippets = [];

        for (var i = 0; i < sorted.length; i++) {
            var matchStart = sorted[i][0];
            var matchEnd = sorted[i][1];
            var snipStart = Math.max(0, matchStart - SNIPPET_RADIUS);
            var snipEnd = Math.min(content.length, matchEnd + 1 + SNIPPET_RADIUS);
            var previous = rawSnippets[rawSnippets.length - 1];

            if (previous && snipStart <= previous.snipEnd + 10) {
                previous.snipEnd = Math.max(previous.snipEnd, snipEnd);
                previous.matchIndices.push([
                    matchStart - previous.snipStart,
                    matchEnd - previous.snipStart
                ]);
                continue;
            }

            if (rawSnippets.length >= MAX_SNIPPETS) continue;

            rawSnippets.push({
                snipStart: snipStart,
                snipEnd: snipEnd,
                matchIndices: [[matchStart - snipStart, matchEnd - snipStart]]
            });
        }

        return rawSnippets.map(function (snippet) {
            // 不 trim，确保 Fuse 返回的字符位置仍与片段内偏移完全一致。
            var rawText = content.substring(snippet.snipStart, snippet.snipEnd);
            var prefix = snippet.snipStart > 0 ? '…' : '';
            var suffix = snippet.snipEnd < content.length ? '…' : '';
            return prefix + _buildHighlightedSnippet(rawText, snippet.matchIndices) + suffix;
        });
    }

    /**
     * 基于 Fuse 的包含区间构建高亮文本，同时合并重叠区间
     */
    function _buildHighlightedSnippet(text, indices) {
        text = String(text || '');
        if (!indices || indices.length === 0) return escapeHtml(text);

        var normalized = indices.map(function (range) {
            return Array.isArray(range)
                ? [range[0], range[1]]
                : [range.start, range.end];
        }).filter(function (range) {
            return Number.isFinite(range[0]) && Number.isFinite(range[1]);
        }).map(function (range) {
            return [Math.max(0, range[0]), Math.min(text.length - 1, range[1])];
        }).filter(function (range) {
            return range[0] <= range[1];
        }).sort(function (a, b) {
            return a[0] - b[0];
        });

        if (normalized.length === 0) return escapeHtml(text);

        var merged = [];
        for (var i = 0; i < normalized.length; i++) {
            var previous = merged[merged.length - 1];
            if (previous && normalized[i][0] <= previous[1] + 1) {
                previous[1] = Math.max(previous[1], normalized[i][1]);
            } else {
                merged.push(normalized[i].slice());
            }
        }

        var html = '';
        var cursor = 0;
        for (var j = 0; j < merged.length; j++) {
            if (merged[j][0] > cursor) {
                html += '<span>' + escapeHtml(text.substring(cursor, merged[j][0])) + '</span>';
            }
            html += '<span class="' + HIGHLIGHT_CLASS + '">';
            html += escapeHtml(text.substring(merged[j][0], merged[j][1] + 1));
            html += '</span>';
            cursor = merged[j][1] + 1;
        }
        if (cursor < text.length) html += '<span>' + escapeHtml(text.substring(cursor)) + '</span>';
        return html;
    }

    /**
     * 无 Fuse 索引时的安全回退高亮
     */
    function _highlightText(text, query) {
        text = String(text || '');
        if (!query) return escapeHtml(text);

        var words = query.split(/\s+/).filter(function (word) { return word.length > 0; });
        if (words.length === 0) return escapeHtml(text);

        words.sort(function (a, b) { return b.length - a.length; });
        var regex = new RegExp(words.map(_escapeRegex).join('|'), 'gi');
        var html = '';
        var cursor = 0;
        var match;

        while ((match = regex.exec(text)) !== null) {
            html += escapeHtml(text.substring(cursor, match.index));
            html += '<span class="' + HIGHLIGHT_CLASS + '">' + escapeHtml(match[0]) + '</span>';
            cursor = match.index + match[0].length;
            if (match[0].length === 0) regex.lastIndex++;
        }

        html += escapeHtml(text.substring(cursor));
        return html;
    }

    function _getResultItems() {
        return resultsContainer.querySelectorAll('.search-result-item');
    }

    function _moveSelection(direction) {
        var items = _getResultItems();
        if (items.length === 0) return;

        var nextIndex = activeIndex;
        if (nextIndex < 0) {
            nextIndex = direction > 0 ? 0 : items.length - 1;
        } else {
            nextIndex = (nextIndex + direction + items.length) % items.length;
        }
        _setActiveIndex(nextIndex, true);
    }

    function _setActiveIndex(index, shouldScroll) {
        var items = _getResultItems();
        for (var i = 0; i < items.length; i++) {
            var isActive = i === index;
            items[i].classList.toggle('is-active', isActive);
            items[i].setAttribute('aria-selected', isActive ? 'true' : 'false');
        }

        activeIndex = index >= 0 && index < items.length ? index : -1;
        if (activeIndex >= 0) {
            input.setAttribute('aria-activedescendant', items[activeIndex].id);
            if (shouldScroll) items[activeIndex].scrollIntoView({ block: 'nearest' });
        } else {
            input.removeAttribute('aria-activedescendant');
        }
    }

    function _trapFocus(event) {
        var focusable = Array.prototype.filter.call(
            overlay.querySelectorAll('input, button:not([hidden]):not([tabindex="-1"])'),
            function (element) { return !element.disabled && element.offsetParent !== null; }
        );
        if (focusable.length === 0) return;

        var currentIndex = focusable.indexOf(document.activeElement);
        if (event.shiftKey && currentIndex <= 0) {
            event.preventDefault();
            focusable[focusable.length - 1].focus();
        } else if (!event.shiftKey && currentIndex === focusable.length - 1) {
            event.preventDefault();
            focusable[0].focus();
        }
    }

    function _setPageInert(shouldBeInert) {
        var pageRegions = document.querySelectorAll('.topbar, .app-grid');
        for (var i = 0; i < pageRegions.length; i++) {
            pageRegions[i].inert = shouldBeInert;
        }
    }

    function _showLoading() {
        input.setAttribute('aria-expanded', 'false');
        resultsContainer.setAttribute('aria-busy', 'true');
        resultsContainer.innerHTML = '<div class="search-state search-loading" role="status">' +
            '<span class="search-state-icon" aria-hidden="true"></span>' +
            '<span>正在准备搜索…</span></div>';
    }

    function _showHint(text) {
        input.setAttribute('aria-expanded', 'false');
        resultsContainer.setAttribute('aria-busy', 'false');
        resultsContainer.innerHTML = '<div class="search-state search-hint">' +
            '<span>' + escapeHtml(text) + '</span></div>';
    }

    function _showError(text) {
        input.setAttribute('aria-expanded', 'false');
        resultsContainer.setAttribute('aria-busy', 'false');
        resultsContainer.innerHTML = '<div class="search-state search-error" role="alert">' +
            '<span>' + escapeHtml(text) + '</span>' +
            '<button type="button" class="search-retry-btn" data-search-retry>重新加载</button></div>';
    }

    function _showEmpty(text) {
        input.setAttribute('aria-expanded', 'false');
        resultsContainer.setAttribute('aria-busy', 'false');
        resultsContainer.innerHTML = '<div class="search-state search-empty" role="status">' +
            '<span>' + escapeHtml(text) + '</span>' +
            '<small>试试更短的关键词，或只搜索标题中的核心词</small></div>';
    }

    function _navigateTo(filePath) {
        closeSearch();
        window.location.hash = '#' + filePath;
    }

    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(String(text)));
        return div.innerHTML;
    }

    function _escapeRegex(value) {
        return value.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    window.SearchModule = {
        init: init,
        open: openSearch,
        close: closeSearch
    };
})();
