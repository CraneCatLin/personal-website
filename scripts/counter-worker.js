/** 阅读计数：仅接受公开笔记，写入前验证来源并通过平台限流绑定。 */
const ALLOWED_ORIGINS = new Set(['https://cranecat.cn', 'https://www.cranecat.cn']);
let noteManifest = null;
let manifestExpires = 0;
let manifestRequest = null;

addEventListener('fetch', event => event.respondWith(handleRequest(event.request)));

function jsonResponse(request, data, status = 200, extraHeaders = {}) {
    const origin = request.headers.get('Origin');
    const headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Vary': 'Origin',
        ...extraHeaders
    };
    if (ALLOWED_ORIGINS.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
    return new Response(data === null ? null : JSON.stringify(data), { status, headers });
}

async function getPublishedNotes() {
    if (noteManifest && Date.now() < manifestExpires) return noteManifest;
    if (!manifestRequest) {
        manifestRequest = (async () => {
            const response = await fetch('https://cranecat.cn/public-files.json', {
                cf: { cacheTtl: 60 }, signal: AbortSignal.timeout(5000)
            });
            if (!response.ok) throw new Error('Manifest unavailable');
            const data = await response.json();
            if (!Array.isArray(data.notes) || !data.notes.every(path => typeof path === 'string')) throw new Error('Invalid manifest');
            noteManifest = new Set(data.notes);
            manifestExpires = Date.now() + 60000;
            return noteManifest;
        })().finally(() => { manifestRequest = null; });
    }
    return manifestRequest;
}

async function handleRequest(request) {
    const url = new URL(request.url);
    if (url.pathname !== '/pv') return jsonResponse(request, { error: '接口不存在' }, 404);
    if (!['GET', 'POST', 'OPTIONS'].includes(request.method)) {
        return jsonResponse(request, { error: '不支持的请求方法' }, 405, { Allow: 'GET, POST, OPTIONS' });
    }
    const origin = request.headers.get('Origin');
    if ((origin && !ALLOWED_ORIGINS.has(origin)) || (request.method !== 'GET' && !ALLOWED_ORIGINS.has(origin))) {
        return jsonResponse(request, { error: '请求来源不允许' }, 403);
    }
    if (request.method === 'OPTIONS') {
        return jsonResponse(request, null, 204, {
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '600'
        });
    }
    const path = url.searchParams.get('path');
    if (url.searchParams.getAll('path').length !== 1 || !path || new TextEncoder().encode('pv:' + path).length > 512 ||
        !path.toLowerCase().endsWith('.md') || /[\u0000-\u001f\u007f<>"'`\\?#]/.test(path) ||
        path.split('/').some(part => !part || part.startsWith('.') || part === 'node_modules')) {
        return jsonResponse(request, { error: '笔记路径无效' }, 400);
    }
    try {
        // 匿名站点没有用户 ID；按 Cloudflare 提供的真实 IP 设宽松的每分钟上限。
        const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
        if (typeof PV_RATE_LIMIT === 'undefined') throw new Error('Rate limit binding unavailable');
        const limit = await PV_RATE_LIMIT.limit({ key: clientIp });
        if (!limit.success) return jsonResponse(request, { error: '请求过于频繁' }, 429, { 'Retry-After': '60' });
        if (!(await getPublishedNotes()).has(path)) return jsonResponse(request, { error: '笔记未公开发布' }, 404);
        const key = 'pv:' + path;
        const value = Number.parseInt(await PV_COUNTER.get(key), 10);
        const current = Number.isSafeInteger(value) && value >= 0 ? value : 0;
        if (request.method === 'GET') return jsonResponse(request, { path, count: current });
        const count = current + 1;
        await PV_COUNTER.put(key, String(count));
        return jsonResponse(request, { path, count });
    } catch (error) {
        // 不把 KV 内部错误、凭据或平台信息返回给访客。
        return jsonResponse(request, { count: -1, error: '计数暂不可用' }, 503, { 'Retry-After': '2' });
    }
}
