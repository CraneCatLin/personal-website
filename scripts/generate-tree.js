#!/usr/bin/env node

/**
 * generate-tree.js
 * 递归扫描目录，生成表示目录结构的 tree.json
 * 用法: node generate-tree.js [输入目录] [输出文件]
 * 默认输入目录: 脚本所在目录的 ../public
 * 默认输出文件: 脚本所在目录的 ../frontend/tree.json
 */

const fs = require('fs');
const path = require('path');

// 解析命令行参数
const args = process.argv.slice(2);
const inputDir = args[0] || path.join(__dirname, '../frontend/public');
const outputFile = args[1] || path.join(__dirname, '../frontend/tree.json');

// 需要忽略的隐藏文件/文件夹名称（精确匹配）
const IGNORED_NAMES = new Set(['.DS_Store', '.gitkeep', '.git', '.hg', '.svn', 'Thumbs.db']);
const EXCLUDED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp'];

// 需要忽略的特定路径（相对于项目根目录）
const IGNORED_PATHS = new Set(['/images']);
function shouldIncludeFile(filename) {
    const extension = path.extname(filename).toLowerCase();
    return !EXCLUDED_EXTENSIONS.includes(extension);
}
/**
 * 判断是否为隐藏文件（以点开头）
 */
function isHidden(name) {
    return name.startsWith('.');
}

/**
 * 判断路径是否应该被忽略
 */
function shouldIgnorePath(currentPath, baseDir) {
    const relativePath = path.relative(baseDir, currentPath);
    const normalizedRelativePath = '/' + relativePath.replace(/\\/g, '/');

    // 检查是否在忽略路径列表中
    for (const ignoredPath of IGNORED_PATHS) {
        if (normalizedRelativePath === ignoredPath ||
            normalizedRelativePath.startsWith(ignoredPath + '/') ||
            normalizedRelativePath.startsWith(ignoredPath + '\\')) {
            return true;
        }
    }

    const name = path.basename(currentPath);
    return isHidden(name) || IGNORED_NAMES.has(name);
}

/**
 * 递归扫描目录，返回文件夹对象或 null（应忽略）
 * @param {string} currentPath - 当前绝对路径
 * @param {string} baseDir - 根目录绝对路径（用于计算相对路径）
 * @param {string} relPath - 相对于 baseDir 的路径（用于 path 字段）
 * @returns {object|null} 节点对象或 null（如果该文件夹/文件应被忽略）
 */
function walkDir(currentPath, baseDir, parentRelPath = '') {
    let stats;
    try {
        stats = fs.statSync(currentPath);
    } catch (err) {
        console.error(`无法访问 ${currentPath}: ${err.message}`);
        return null;
    }

    const name = path.basename(currentPath);

    // 使用 path.relative 来正确计算相对于基目录的路径
    const relativePath = path.relative(baseDir, currentPath);
    const currentRelPath = relativePath.replace(/\\/g, '/');

    // 使用增强的忽略判断函数
    if (shouldIgnorePath(currentPath, baseDir)) {
        return null;
    }

    // 处理文件
    if (stats.isFile() && shouldIncludeFile(name)) {
        const ext = path.extname(name).toLowerCase();
        return {
            type: 'file',
            name: name,
            path: currentRelPath,  // 完整的相对路径
            ext: ext,
            mtime: stats.mtime.toISOString()
        };
    }

    // 处理目录
    if (stats.isDirectory()) {
        let children = [];
        let items;
        try {
            items = fs.readdirSync(currentPath);
        } catch (err) {
            console.error(`无法读取目录 ${currentPath}: ${err.message}`);
            return null;
        }

        for (const item of items) {
            const itemPath = path.join(currentPath, item);
            const child = walkDir(itemPath, baseDir, currentRelPath);
            if (child) {
                children.push(child);
            }
        }

        // 对children进行自然排序
        children.sort((a, b) => {
            // 使用自然排序比较函数
            return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        });

        return {
            type: 'folder',
            name: name,
            path: currentRelPath,
            children: children,
            mtime: stats.mtime.toISOString()
        };
    }

    // 其他类型（符号链接等）忽略
    return null;
}

/**
 * 主函数
 */
function main() {
    // 检查输入目录是否存在
    if (!fs.existsSync(inputDir)) {
        console.error(`错误：输入目录不存在 "${inputDir}"`);
        process.exit(1);
    }

    // 检查输入是否为目录
    const stats = fs.statSync(inputDir);
    if (!stats.isDirectory()) {
        console.error(`错误：输入路径不是目录 "${inputDir}"`);
        process.exit(1);
    }

    console.log(`扫描目录: ${inputDir}`);

    // 生成树结构（根目录名称固定为 'public'，但我们可以使用实际文件夹名称）
    // 但要求根对象 name 为 "public"，path 为空
    const rootName = path.basename(inputDir); // 实际上可能是 "public"
    const tree = {
        type: 'folder',
        name: rootName,
        path: '',
        children: []
    };

    // 遍历根目录下的所有项目
    let items;
    try {
        items = fs.readdirSync(inputDir);
    } catch (err) {
        console.error(`无法读取根目录: ${err.message}`);
        process.exit(1);
    }

    for (const item of items) {
        const itemPath = path.join(inputDir, item);
        const child = walkDir(itemPath, inputDir, item);
        if (child) {
            tree.children.push(child);
        }
    }

    // 如果根目录下没有任何有效子项，则输出空树（但通常不会）
    if (tree.children.length === 0) {
        console.warn('警告：根目录下没有找到任何有效文件/文件夹');
    }

    // 确保输出目录存在
    const outputDir = path.dirname(outputFile);
    if (!fs.existsSync(outputDir)) {
        try {
            fs.mkdirSync(outputDir, { recursive: true });
            console.log(`创建输出目录: ${outputDir}`);
        } catch (err) {
            console.error(`无法创建输出目录: ${err.message}`);
            process.exit(1);
        }
    }

    // 写入 JSON 文件
    try {
        fs.writeFileSync(outputFile, JSON.stringify(tree, null, 2), 'utf8');
        console.log(`✅ tree.json 已生成: ${outputFile}`);
    } catch (err) {
        console.error(`写入文件失败: ${err.message}`);
        process.exit(1);
    }
}

// 执行主函数
main();