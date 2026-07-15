/**
 * generate-search-index.js
 * 
 * 扫描 frontend/public/ 下所有 .md 文件（排除 日志 目录），
 * 为每个文件提取标题和全文内容，生成 search-index.json
 * 供前端 Fuse.js 全文搜索使用。
 * 
 * 运行方式：node scripts/generate-search-index.js
 * 输出：frontend/search-index.json
 */

const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.resolve(__dirname, '../frontend/public');
const OUTPUT_FILE = path.resolve(__dirname, '../frontend/search-index.json');
const EXCLUDE_DIRS = ['日志']; // 排除的目录名（支持多个）

/**
 * 提取 Markdown 文件标题：
 * 1. 首个 `# ` 行（去除 `# ` 前缀）
 * 2. 无标题则使用文件名（不含扩展名）
 */
function extractTitle(content, fileName) {
    const titleMatch = content.match(/^#\s+(.+?)(?:\s*\n|$)/m);
    if (titleMatch) {
        return titleMatch[1].trim();
    }
    return fileName.replace(/\.md$/, '');
}

/**
 * 递归扫描目录，返回所有 .md 文件的绝对路径
 */
function scanMdFiles(dir, rootDir) {
    const results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(rootDir, fullPath);

        // 检查当前目录或父目录是否被排除
        const parts = relativePath.split(path.sep);
        const shouldExclude = parts.some(part => EXCLUDE_DIRS.includes(part));

        if (shouldExclude) {
            continue;
        }

        if (entry.isDirectory()) {
            results.push(...scanMdFiles(fullPath, rootDir));
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
            results.push(fullPath);
        }
    }

    return results;
}

/**
 * 主函数
 */
function main() {
    console.log('扫描目录:', PUBLIC_DIR);

    if (!fs.existsSync(PUBLIC_DIR)) {
        console.error('错误: public 目录不存在:', PUBLIC_DIR);
        process.exit(1);
    }

    const mdFiles = scanMdFiles(PUBLIC_DIR, PUBLIC_DIR);
    console.log(`找到 ${mdFiles.length} 个 .md 文件（排除日志目录后）`);

    const index = [];

    for (const filePath of mdFiles) {
        const relativePath = path.relative(PUBLIC_DIR, filePath).replace(/\\/g, '/');
        const fileName = path.basename(filePath);
        const content = fs.readFileSync(filePath, 'utf-8');
        const title = extractTitle(content, fileName);

        index.push({
            path: relativePath,
            title: title,
            content: content
        });

        if (index.length % 20 === 0) {
            console.log(`  已处理 ${index.length} 个文件...`);
        }
    }

    // 写入 JSON（未压缩，但 gzip 传输很小）
    const jsonStr = JSON.stringify(index);
    fs.writeFileSync(OUTPUT_FILE, jsonStr, 'utf-8');

    const fileSizeKB = (Buffer.byteLength(jsonStr) / 1024).toFixed(1);
    console.log(`\n完成！共 ${index.length} 条索引`);
    console.log(`输出文件: ${OUTPUT_FILE}`);
    console.log(`索引大小: ${fileSizeKB} KB（原始）`);
    console.log(`预计 gzip 后: ~${(fileSizeKB * 0.3).toFixed(1)} KB`);
}

main();