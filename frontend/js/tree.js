import { viewer, treeContainer, treeData, logTreeData, fileNameMap, fullPathNoExtMap, getFileIcon } from './core.js';
import { loadFileByPath } from './note-renderer.js';

let _treeData = null;
let _logTreeData = null;

export function setTreeData(data) {
    _treeData = data;
}

export function setLogTreeData(data) {
    _logTreeData = data;
}

export function loadTree() {
    const cacheBuster = '?t=' + Date.now();
    const fetchPromise1 = fetch('/tree.json' + cacheBuster)
        .then(r => r.json())
        .then(data => {
            _treeData = data;
            buildTree(data);
            buildFileNameMaps(data);
        })
        .catch(err => {
            console.error('加载 tree.json 失败:', err);
            if (treeContainer) {
                treeContainer.innerHTML = '<p style="padding:1rem;color:var(--text-muted);">目录加载失败<br><small>请运行 update.ps1</small></p>';
            }
        });

    const fetchPromise2 = fetch('/tree-log.json' + cacheBuster)
        .then(r => r.json())
        .then(data => {
            _logTreeData = data;
        })
        .catch(err => {
            console.log('tree-log.json 不存在或加载失败（可选）:', err);
            _logTreeData = { name: '日志', children: [] };
        });

    return Promise.all([fetchPromise1, fetchPromise2]);
}

export function buildTree(data) {
    if (!treeContainer) return;
    treeContainer.innerHTML = buildTreeHTML(data);
    bindTreeEvents(treeContainer);
}

function buildTreeHTML(node) {
    if (!node) return '';

    const name = node.name || '';
    const isDir = node.type === 'directory' || (node.children && node.children.length > 0);
    const children = node.children || [];

    if (isDir) {
        const sortedChildren = [...children].sort((a, b) => {
            const aIsDir = a.type === 'directory' || (a.children && a.children.length > 0);
            const bIsDir = b.type === 'directory' || (b.children && b.children.length > 0);
            if (aIsDir && !bIsDir) return -1;
            if (!aIsDir && bIsDir) return 1;
            return (a.name || '').localeCompare(b.name || '');
        });

        let html = '<details class="tree-folder"';
        // 展开层级：最多展开两级
        if (node.level && node.level <= 2 && name !== '.') html += ' open';
        html += '>';
        html += `<summary class="tree-folder-label"><span class="tree-icon">📁</span>${escapeHtml(name) || '/'}</summary>`;
        html += '<div class="tree-children">';
        for (const child of sortedChildren) {
            html += buildTreeHTML(child);
        }
        html += '</div></details>';
        return html;
    } else {
        const ext = name.includes('.') ? '.' + name.split('.').pop().toLowerCase() : '';
        const icon = getFileIcon(ext);
        const path = node.path || node.fullPath || '';
        // 重新构造路径 —— 多数情况下 tree.json 有 path
        let filePath = path;
        if (!filePath && node.parentPath) {
            filePath = node.parentPath + '/' + name;
        }
        const safePath = escapeHtml ? escapeHtml(filePath) : filePath;
        return `<div class="tree-file" data-path="${safePath}"><span class="tree-icon">${icon}</span><span class="tree-file-name">${escapeHtml(name)}</span></div>`;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
}

function bindTreeEvents(container) {
    container.addEventListener('click', (e) => {
        const fileDiv = e.target.closest('.tree-file');
        if (!fileDiv) return;

        const path = fileDiv.dataset.path;
        if (path) {
            window.location.hash = '#' + encodeURIComponent(path);
            loadFileByPath(path);
        }
    });

    // 阻止详情展开/折叠的默认行为，改用自定义
    container.querySelectorAll('.tree-folder > .tree-folder-label').forEach(summary => {
        summary.addEventListener('click', (e) => {
            e.stopPropagation();
            const details = summary.parentElement;
            if (details) {
                details.open = !details.open;
            }
        });
    });
}

function buildFileNameMaps(data) {
    fileNameMap.clear();
    fullPathNoExtMap.clear();
    traverseForMaps(data);
}

function traverseForMaps(node, parentPath = '') {
    if (!node) return;
    const name = node.name || '';
    const children = node.children || [];
    const isDir = node.type === 'directory' || children.length > 0;
    const nodePath = node.path || (parentPath ? parentPath + '/' + name : name);

    if (!isDir) {
        // 文件名（去扩展名）→ 完整路径
        const nameNoExt = name.replace(/\.[^/.]+$/, '');
        if (nameNoExt && !fileNameMap.has(nameNoExt)) {
            fileNameMap.set(nameNoExt, nodePath);
        }
        // 完整路径（去扩展名）→ 完整路径
        const pathNoExt = nodePath.replace(/\.[^/.]+$/, '');
        if (pathNoExt && !fullPathNoExtMap.has(pathNoExt)) {
            fullPathNoExtMap.set(pathNoExt, nodePath);
        }
        // 也存去除 public/ 前缀的
        const cleanPath = nodePath.replace(/^public\//, '');
        const cleanPathNoExt = cleanPath.replace(/\.[^/.]+$/, '');
        if (cleanPathNoExt && !fullPathNoExtMap.has(cleanPathNoExt)) {
            fullPathNoExtMap.set(cleanPathNoExt, cleanPath);
        }
    }

    if (children.length > 0) {
        for (const child of children) {
            traverseForMaps(child, isDir ? nodePath : parentPath);
        }
    }
}

export { _treeData as treeData, _logTreeData as logTreeData };