/**
 * 目录树模块 - 从 script.js 拆分
 * 依赖：script.js 通过 Object.defineProperty 暴露的全局变量（window.treeData, window.defaultNotePath,
 *       window.fileNameMap, window.fullPathNoExtMap, window.loadFileByPath, window.loadFromHash）
 *       script.js 通过 window.getFileIcon 暴露的函数
 */

// ---------- 构建目录树 ----------
function buildTreeHTML(nodes, parentPath = '') {
    let html = '<ul class="tree">';
    for (let node of nodes) {
        const nodePath = parentPath ? `${parentPath}/${node.name}` : node.name;
        if (node.type === 'folder') {
            const fileCount = (node.children || []).filter(c => c.type === 'file').length;
            const subFolderCount = (node.children || []).filter(c => c.type === 'folder').length;
            html += `<li class="folder collapsed">`;
            html += `<div class="item" data-path="${nodePath}" data-type="folder">`;
            html += `<span class="folder-arrow">▸</span>`;
            html += `<span class="folder-icon">📁</span>`;
            html += `<span class="item-name">${node.name}</span>`;
            if (fileCount + subFolderCount > 0) {
                html += `<span class="folder-count">${fileCount + subFolderCount}</span>`;
            }
            html += `</div>`;
            if (node.children && node.children.length > 0) {
                html += buildTreeHTML(node.children, nodePath);
            } else {
                html += '<ul class="tree"><li class="empty-folder"><span class="empty-hint">📪 空文件夹</span></li></ul>';
            }
            html += `</li>`;
        } else if (node.type === 'file') {
            const displayName = node.name.replace(/\.[^/.]+$/, "");
            const ext = node.ext || '';
            const icon = window.getFileIcon(ext);
            html += `<li class="file">`;
            html += `<div class="item" data-path="${nodePath}" data-type="file" data-ext="${ext}">`;
            html += `<span class="file-icon">${icon}</span>`;
            html += `<span class="item-name">${displayName}</span>`;
            html += `</div>`;
            html += `</li>`;
        }
    }
    html += '</ul>';
    return html;
}

// 绑定树交互事件
function bindTreeEvents() {
    document.querySelectorAll('.tree .folder > .item').forEach(folderItem => {
        folderItem.addEventListener('click', (e) => {
            e.stopPropagation();
            const li = folderItem.closest('.folder');
            li.classList.toggle('collapsed');
        });
    });

    document.querySelectorAll('.tree .file > .item').forEach(fileItem => {
        fileItem.addEventListener('click', (e) => {
            e.stopPropagation();
            const path = fileItem.dataset.path;
            if (path) {
                window.location.hash = '#' + encodeURIComponent(path);
                window.loadFileByPath(path);
            }
        });
    });
}

function findFirstFile(nodes, parentPath = '') {
    for (let node of nodes) {
        const nodePath = parentPath ? `${parentPath}/${node.name}` : node.name;
        if (node.type === 'file') {
            return nodePath;
        } else if (node.type === 'folder' && node.children) {
            const found = findFirstFile(node.children, nodePath);
            if (found) return found;
        }
    }
    return null;
}

// 从 tree.json 加载目录树
function loadTree() {
    const treeContainer = document.getElementById('treeContainer');
    treeContainer.innerHTML = `
    <div style="padding: 0.5rem;">
        <div class="tree-skeleton-item tree-skeleton-folder"></div>
        <div class="tree-skeleton-item tree-skeleton-file"></div>
        <div class="tree-skeleton-item tree-skeleton-file"></div>
        <div class="tree-skeleton-item tree-skeleton-folder"></div>
        <div class="tree-skeleton-item tree-skeleton-file"></div>
        <div class="tree-skeleton-item tree-skeleton-file"></div>
    </div>
    `;
    fetch('/tree.json')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then(data => {
            window.treeData = data;
            let nodes = [];
            if (Array.isArray(data)) {
                nodes = data;
            } else if (data && data.children) {
                nodes = data.children;
            } else {
                nodes = [];
            }
            // 过滤掉"日志"文件夹（日志由 tree-log.json 单独管理）
            nodes = nodes.filter(n => n.name !== '日志');
            // 构建 wiki 链接映射
            window.fileNameMap.clear();
            window.fullPathNoExtMap.clear();

            function buildMaps(nodes, parentPath = '') {
                for (let node of nodes) {
                    const nodePath = parentPath ? `${parentPath}/${node.name}` : node.name;
                    if (node.type === 'file') {
                        const fullPathNoExt = nodePath.replace(/\.[^/.]+$/, "");
                        const fileNameNoExt = node.name.replace(/\.[^/.]+$/, "");
                        if (!window.fileNameMap.has(fileNameNoExt)) {
                            window.fileNameMap.set(fileNameNoExt, nodePath);
                        }
                        if (!window.fullPathNoExtMap.has(fullPathNoExt)) {
                            window.fullPathNoExtMap.set(fullPathNoExt, nodePath);
                        }
                    } else if (node.type === 'folder' && node.children) {
                        buildMaps(node.children, nodePath);
                    }
                }
            }
            buildMaps(nodes, '');
            const treeHTML = buildTreeHTML(nodes, '');
            treeContainer.innerHTML = treeHTML;
            bindTreeEvents();
            window.defaultNotePath = findFirstFile(nodes);
            console.log('默认笔记路径:', window.defaultNotePath);

            window.loadFromHash();
        })
        .catch(error => {
            treeContainer.innerHTML = `<div style="padding:1rem; color:var(--text-secondary);">❌ 加载目录失败: ${error.message}<br>请确保 tree.json 存在且格式正确。</div>`;
            // 即使目录加载失败，也按当前 hash 初始化正确的页面布局和可用内容
            window.loadFromHash();
        })
        .finally(() => {
            // 当前路由已经决定并完成首轮同步渲染，可以安全显示页面框架
            document.body.classList.remove('is-booting');
        });
}

// 导出到全局，供 script.js 使用
window.TreeModule = {
    loadTree: loadTree
};
