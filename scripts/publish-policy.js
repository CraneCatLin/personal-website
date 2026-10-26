/** 发布目录的统一规则；不改变 Obsidian Vault 内的原文件。 */
const fs = require('fs');
const path = require('path');

const ROOT_FILES = new Set([
    'index.html', '404.html', 'script.js', 'style.css', 'tree.json',
    'tree-log.json', 'search-index.json', 'public-files.json'
]);
const ROOT_DIRS = new Set(['js', 'libs', 'images', 'public']);
const PRIVATE_NAMES = /^(?:node_modules|config\.ps1|credentials(?:\..*)?|thumbs\.db|desktop\.ini)$/i;
const PRIVATE_EXTENSIONS = /\.(?:pem|key|pfx|p12|keystore|ps1|sqlite3?|db|bak)$/i;
// 同样保护同步目标中的既有私有对象，避免 --delete 把隔离备份删除。
const OSS_EXCLUDES = [
    '/node_modules/**', '/public/.obsidian/**', '/public/.smtcmp_json_db/**',
    '/public/.smtcmp_vector_db.tar.gz', '**/.*/**', '**/.*',
    '**/node_modules/**', '**/*.pem', '**/*.key', '**/*.pfx', '**/*.p12',
    '**/*.keystore', '**/*.ps1', '**/*.db', '**/*.sqlite', '**/*.sqlite3', '**/*.bak'
];

function isPublishablePath(relativePath) {
    const normalized = relativePath.replace(/\\/g, '/');
    const parts = normalized.split('/');
    if (parts.some(part => !part || part === '..' || part.startsWith('.') || PRIVATE_NAMES.test(part))) return false;
    if (PRIVATE_EXTENSIONS.test(normalized)) return false;
    return parts.length === 1 ? ROOT_FILES.has(parts[0]) : ROOT_DIRS.has(parts[0]);
}

function listPublicFiles(sourceDir) {
    const files = [];
    function walk(dir, prefix = '') {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
            const fullPath = path.join(dir, entry.name);
            const stat = fs.lstatSync(fullPath);
            if (stat.isSymbolicLink()) throw new Error(`发布目录不允许符号链接或联接: ${relativePath}`);
            if (entry.isDirectory()) {
                if (entry.name.startsWith('.') || PRIVATE_NAMES.test(entry.name)) continue;
                if (!prefix && !ROOT_DIRS.has(entry.name)) continue;
                walk(fullPath, relativePath);
            } else if (entry.isFile() && isPublishablePath(relativePath)) {
                files.push(relativePath);
            }
        }
    }
    walk(sourceDir);
    return files.sort();
}

function findSecret(text) {
    const patterns = [
        ['API Key', /\bsk-[A-Za-z0-9_-]{20,}/],
        ['GitHub token', /\b(?:ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})/],
        ['云访问密钥', /\b(?:LTAI[A-Za-z0-9]{16,}|(?:AKIA|ASIA)[A-Z0-9]{16})\b/],
        ['Google API Key', /\bAIza[A-Za-z0-9_-]{30,}/],
        ['私钥', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/]
    ];
    for (const [kind, pattern] of patterns) {
        const match = pattern.exec(text);
        if (match) return { kind, line: text.slice(0, match.index).split('\n').length };
    }
    return null;
}

module.exports = { isPublishablePath, listPublicFiles, findSecret, OSS_EXCLUDES };
