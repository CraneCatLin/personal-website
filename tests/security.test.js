const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const { preparePublish } = require('../scripts/prepare-publish');
const { generateTree } = require('../scripts/generate-tree');
const { scanMdFiles } = require('../scripts/generate-search-index');
const ROOT = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');

function createApp(t, options = {}) {
    const dom = new JSDOM(read('frontend/index.html'), { url: 'https://cranecat.cn/', runScripts: 'outside-only' });
    t.after(() => dom.window.close());
    const window = dom.window;
    const context = dom.getInternalVMContext();
    const calls = [];
    const files = ['测试/正常.md', '测试/另文.md', '测试/图片.png', '测试/视频.mp4', '测试/附件.txt', '日志/2026-10-26.md'];
    window.fetch = async (url, request = {}) => {
        calls.push({ url, method: request.method || 'GET' });
        if (url === '/public-files.json') return { ok: true, json: async () => ({ files }) };
        if (url.startsWith('https://pv-counter.')) return { ok: true, json: async () => ({ count: 12 }) };
        if (options.failContent) throw new Error('<img src=x onerror="globalThis.auditMarker=1">');
        return { ok: true, text: async () => '# 正常笔记\n\n内容' };
    };
    for (const file of ['highlight.min.js', 'markdown-it.min.js', 'katex.min.js', 'texmath.js', 'purify.min.js']) {
        vm.runInContext(read('frontend/libs/js/' + file), context, { filename: file });
    }
    window.TreeModule = { loadTree() {} };
    window.TOCModule = { clearTOC() {}, updateTOCActive() {}, renderTOCFromDOM() {} };
    window.HomeModule = { renderDefaultAbout() {} };
    for (const file of ['js/core.js', 'js/notes.js', 'js/log.js', 'script.js']) vm.runInContext(read('frontend/' + file), context, { filename: file });
    return { window, document: window.document, calls };
}

test('hash injection and private / unknown paths are rejected before content fetch', async t => {
    const { window, document, calls } = createApp(t);
    for (const route of ['x"><img src=x onerror="globalThis.auditMarker=1">.png', '../x.md', '.obsidian/app.json', '测试/不存在.md']) {
        await window.loadFileByPath(route);
        assert.equal(document.querySelector('#viewer [onerror]'), null);
        assert.equal(document.querySelector('#viewer img'), null);
    }
    assert.equal(calls.filter(call => call.url.startsWith('/public/')).length, 0);
    window.location.hash = '#%E0%A4%A';
    window.loadFromHash();
    assert.match(document.querySelector('#viewer').textContent, /编码/);
});

test('known Chinese media paths still preview, unsupported files still download', async t => {
    const { window, document } = createApp(t);
    await window.loadFileByPath('测试/图片.png');
    assert.equal(document.querySelector('#viewer img').getAttribute('src'), '/public/%E6%B5%8B%E8%AF%95/%E5%9B%BE%E7%89%87.png');
    await window.loadFileByPath('测试/视频.mp4');
    assert.ok(document.querySelector('#viewer video[controls]'));
    await window.loadFileByPath('测试/附件.txt');
    assert.ok(document.querySelector('#viewer a[download]'));
});

test('Markdown retains math, code, Wiki links and image sizing while removing active HTML', t => {
    const { window, document } = createApp(t);
    window.fileNameMap.set('另文', '测试/另文.md');
    const markdown = '# 标题\n\n$x^2$\n\n[[另文]]\n\n![说明|120x80](图片.png)\n\n```js\nconst x = 1;\n```\n\n' +
        '<img src="x" onerror="globalThis.auditMarker=1"><svg onload="globalThis.auditMarker=1"></svg><a href="javascript:alert(1)">危险链接</a><iframe srcdoc="bad"></iframe>';
    window.NotesModule.renderMarkdown(markdown, '测试/正常.md');
    assert.ok(document.querySelector('#viewer .katex'));
    assert.ok(document.querySelector('#viewer pre code'));
    assert.ok(document.querySelector('#viewer a.wikilink'));
    assert.ok(document.querySelector('#viewer img[width="120"][height="80"]'));
    assert.equal(document.querySelector('#viewer [onerror], #viewer [onload], #viewer iframe'), null);
    assert.equal(document.querySelector('#viewer a[href^="javascript:"]'), null);
});

test('notes and log loading errors render as text; repeated view rendering sends one write', async t => {
    const { window, document, calls } = createApp(t, { failContent: true });
    await window.loadFileByPath('测试/正常.md');
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(document.querySelector('#viewer img'), null);
    assert.match(document.querySelector('#viewer').textContent, /<img/);
    await window.LogModule.loadLogFile('日志/2026-10-26.md');
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(document.querySelector('#viewer [onerror]'), null);
    await Promise.all([window.CoreModule.recordPageView('测试/正常.md'), window.CoreModule.recordPageView('测试/正常.md')]);
    assert.equal(calls.filter(call => call.method === 'POST').length, 1);
});

test('log Markdown keeps Obsidian embeds and math without event attributes', t => {
    const { window, document } = createApp(t);
    window.renderLogMarkdown('# 日志\n\n![[图片.png|80]]\n\n$x+y$\n\n<img src=x onerror=alert(1)>', '日志/2026-10-26.md', null, null);
    assert.ok(document.querySelector('#viewer .katex'));
    assert.ok(document.querySelector('#viewer img[width="80"]'));
    assert.equal(document.querySelector('#viewer [onerror]'), null);
});

test('publish stage, tree and search exclude private Vault data and block newly pasted keys', t => {
    const dist = path.join(ROOT, 'dist');
    fs.mkdirSync(dist, { recursive: true });
    const fixture = fs.mkdtempSync(path.join(dist, 'security-test-'));
    t.after(() => {
        assert.ok(path.relative(dist, fixture).startsWith('security-test-'));
        fs.rmSync(fixture, { recursive: true, force: true });
    });
    const source = path.join(fixture, 'source');
    for (const [name, content] of Object.entries({
        'index.html': '<p>safe</p>', 'public/正常.md': '# 正常',
        'public/.obsidian/plugins/test/data.json': JSON.stringify({ apiKey: 'sk-' + 'a'.repeat(32) }),
        'public/.obsidian/private.md': 'private', 'public/.smtcmp_vector_db.tar.gz': 'private',
        'public/node_modules/hidden.md': 'private', 'node_modules/test/index.js': 'private'
    })) {
        const file = path.join(source, name);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, content);
    }
    const privateFile = path.join(source, 'public/.obsidian/plugins/test/data.json');
    const before = fs.readFileSync(privateFile);
    const output = path.join(fixture, 'site');
    preparePublish(source, output);
    assert.deepEqual(fs.readFileSync(privateFile), before);
    assert.equal(fs.existsSync(path.join(output, 'public/.obsidian')), false);
    assert.equal(fs.existsSync(path.join(output, 'node_modules')), false);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(output, 'public-files.json'))).notes, ['正常.md']);
    assert.deepEqual(scanMdFiles(path.join(source, 'public'), path.join(source, 'public')).map(file => path.basename(file)), ['正常.md']);
    const tree = generateTree(path.join(source, 'public'), 'public');
    assert.equal(JSON.stringify(tree).includes('hidden.md'), false);
    fs.writeFileSync(path.join(source, 'public/正常.md'), 'example ' + 'sk-' + 'a'.repeat(32));
    assert.throws(() => preparePublish(source, output), /阻止发布/);
    assert.throws(() => preparePublish(source, path.join(ROOT, 'frontend')), /dist/);
});

function worker(options = {}) {
    const calls = { writes: [], reads: 0, limits: 0, fetches: 0 };
    const context = {
        URL, Response, Request, TextEncoder, AbortSignal, Date, console, addEventListener() {},
        fetch: async () => { calls.fetches++; return { ok: true, json: async () => ({ notes: ['测试/正常.md'] }) }; },
        PV_RATE_LIMIT: { async limit() { calls.limits++; return { success: !options.rateLimited }; } },
        PV_COUNTER: {
            async get() { calls.reads++; if (options.kvFailure) throw new Error('private diagnostic'); return '10'; },
            async put(key, value) { calls.writes.push({ key, value }); }
        }
    };
    vm.createContext(context);
    vm.runInContext(read('scripts/counter-worker.js'), context);
    return { calls, request: (url, method = 'GET', origin = 'https://cranecat.cn') => context.handleRequest(new Request(url, {
        method, headers: { ...(origin ? { Origin: origin } : {}), 'CF-Connecting-IP': '192.0.2.1' }
    })) };
}

test('Worker rejects wrong routes, origins, methods and private / nonexistent keys without KV writes', async () => {
    const w = worker();
    for (const [url, method, origin, expected] of [
        ['https://unit.invalid/other?path=a.md', 'GET', undefined, 404],
        ['https://unit.invalid/pv?path=a.md', 'PUT', undefined, 405],
        ['https://unit.invalid/pv?path=a.md', 'POST', 'https://unrelated.invalid', 403],
        ['https://unit.invalid/pv?path=a.md', 'POST', null, 403],
        ['https://unit.invalid/pv?path=.obsidian/private.md', 'POST', undefined, 400],
        ['https://unit.invalid/pv?path=a.md&path=b.md', 'POST', undefined, 400],
        ['https://unit.invalid/pv?path=' + 'a'.repeat(510) + '.md', 'POST', undefined, 400],
        ['https://unit.invalid/pv?path=absent.md', 'POST', undefined, 404]
    ]) assert.equal((await w.request(url, method, origin)).status, expected);
    assert.equal(w.calls.writes.length, 0);
});

test('Worker enforces limit, keeps valid counts and hides platform failures', async () => {
    const url = 'https://unit.invalid/pv?path=' + encodeURIComponent('测试/正常.md');
    const valid = worker();
    const response = await valid.request(url, 'POST');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://cranecat.cn');
    assert.equal((await response.json()).count, 11);
    assert.deepEqual(valid.calls.writes, [{ key: 'pv:测试/正常.md', value: '11' }]);
    const limited = worker({ rateLimited: true });
    assert.equal((await limited.request(url, 'POST')).status, 429);
    assert.equal(limited.calls.fetches, 0);
    const failing = worker({ kvFailure: true });
    const failure = await failing.request(url, 'POST');
    assert.equal(failure.status, 503);
    assert.equal((await failure.text()).includes('private diagnostic'), false);
    assert.equal(failing.calls.writes.length, 0);
});
