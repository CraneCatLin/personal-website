/** 生成只包含公开文件的发布副本，并在上传前阻断常见密钥。 */
const fs = require('fs');
const path = require('path');
const { listPublicFiles, findSecret, OSS_EXCLUDES } = require('./publish-policy');
const PROJECT_ROOT = path.resolve(__dirname, '..');

function preparePublish(sourceDir = path.join(PROJECT_ROOT, 'frontend'), outputDir = path.join(PROJECT_ROOT, 'dist/site')) {
    const distRoot = path.join(PROJECT_ROOT, 'dist');
    outputDir = path.resolve(outputDir);
    const relativeOutput = path.relative(distRoot, outputDir);
    if (!relativeOutput || relativeOutput.startsWith('..') || path.isAbsolute(relativeOutput)) {
        throw new Error('发布输出必须是本项目 dist/ 下的专用子目录');
    }
    for (const dir of [distRoot, outputDir]) {
        if (fs.existsSync(dir) && fs.lstatSync(dir).isSymbolicLink()) throw new Error('发布输出不能是符号链接');
    }
    const files = listPublicFiles(sourceDir).filter(name => name !== 'public-files.json');
    for (const relativePath of files) {
        if (!/\.(?:md|js|json|html|css|txt|csv|xml|ya?ml|ini|svg)$/i.test(relativePath)) continue;
        const secret = findSecret(fs.readFileSync(path.join(sourceDir, relativePath), 'utf8'));
        if (secret) throw new Error(`阻止发布：${relativePath}:${secret.line} 检出 ${secret.kind}（内容已隐藏）`);
    }
    const publicFiles = files.filter(name => name.startsWith('public/')).map(name => name.slice(7));
    const manifest = { files: publicFiles, notes: publicFiles.filter(name => name.toLowerCase().endsWith('.md')) };
    // 目录已解析且限定在项目 dist/ 内，清理的仅是可重新生成的发布副本。
    fs.rmSync(outputDir, { recursive: true, force: true });
    fs.mkdirSync(outputDir, { recursive: true });
    for (const relativePath of files) {
        const source = path.join(sourceDir, relativePath);
        const destination = path.join(outputDir, relativePath);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.copyFileSync(source, destination);
        const stat = fs.statSync(source);
        fs.utimesSync(destination, stat.atime, stat.mtime);
    }
    const manifestText = JSON.stringify(manifest, null, 2) + '\n';
    fs.writeFileSync(path.join(outputDir, 'public-files.json'), manifestText);
    if (path.resolve(sourceDir) === path.join(PROJECT_ROOT, 'frontend')) {
        const target = path.join(sourceDir, 'public-files.json');
        if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== manifestText) fs.writeFileSync(target, manifestText);
    }
    return { outputDir, files: files.length + 1, notes: manifest.notes.length };
}

if (require.main === module) {
    if (process.argv.includes('--oss-excludes')) console.log(JSON.stringify(OSS_EXCLUDES));
    else console.log(JSON.stringify(preparePublish()));
}
module.exports = { preparePublish };
