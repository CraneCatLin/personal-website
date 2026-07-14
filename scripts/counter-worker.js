/**
 * counter-worker.js - Cloudflare Worker 页面访问计数器
 * 
 * API 端点：
 *   GET /pv?path=<路径>   — 查询指定路径的访问次数
 *   POST /pv?path=<路径>  — 记录一次访问并返回更新后的次数
 * 
 * 数据存储在 Cloudflare KV（命名空间：PV_COUNTER）
 * 以路径为 key，值为访问次数字符串
 */

// CORS 头，允许前端跨域请求
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
    const url = new URL(request.url);

    // 处理 OPTIONS 预检请求（CORS）
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: CORS_HEADERS,
        });
    }

    const path = url.searchParams.get('path');
    if (!path) {
        return new Response(JSON.stringify({ error: '缺少 path 参数' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
    }

    // 只允许笔记 (.md) 和日志文件
    if (!path.endsWith('.md')) {
        return new Response(JSON.stringify({ error: '仅支持 .md 文件' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
    }

    const kvKey = `pv:${path}`;

    if (request.method === 'GET') {
        // 查询次数
        const count = await PV_COUNTER.get(kvKey);
        return new Response(JSON.stringify({
            path: path,
            count: count ? parseInt(count) : 0,
        }), {
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
    }

    if (request.method === 'POST') {
        // 记录一次访问
        const current = await PV_COUNTER.get(kvKey);
        const newCount = (current ? parseInt(current) : 0) + 1;
        await PV_COUNTER.put(kvKey, newCount.toString());

        return new Response(JSON.stringify({
            path: path,
            count: newCount,
        }), {
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
    }

    return new Response(JSON.stringify({ error: '不支持的请求方法' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
}