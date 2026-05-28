
---

## 5. 关键约定与坑点

### 5.1 路径约定
- **Hash 路由格式**：`#文件相对路径`（如 `#ai/CNN.md`），路径相对于 `public/`
- **笔记文件根**：`frontend/public/` 下的所有 `.md` 文件
- **资源路径**：在 Markdown 中使用相对于当前 md 文件的相对路径，JS 会自动补全 `/public/目录/`

### 5.2 Wiki 链接
- 语法：`[[文件名]]` 或 `[[路径/文件名]]`
- JS 在渲染前用 `fileNameMap` 和 `fullPathNoExtMap` 查表替换为 `<a href="#...">`
- 查表失败则保留原始 `[[...]]` 文本

### 5.3 图片尺寸
- 语法：`![alt|宽度x高度](path)` 或 `![alt|宽度](path)`
- 渲染后在 DOM 层面通过 `img.setAttribute('width'/'height')` 实现
- `picture-link-convert.py` 用于迁移旧格式

### 5.4 数学公式
- 双渲染路径：优先 `markdown-it-texmath` 插件；失败则回退到手动正则 + KaTeX
- `addLine.py` 预处理确保 `$$` 前有空行

### 5.5 行末空格
- `add_line_breaks.py` 在每行末尾加两个空格 → Markdown 硬换行
- 这可能导致不必要的换行——如果某些行不需要硬换行，这是已知副作用

### 5.6 背景图
- **首页**（`body.homepage`）：`body.homepage::before` 伪元素，`background-image: /images/home-bg.jpg`，opacity 0.35
- **笔记页**（`body.note-page`）：`body.note-page::before`，`background-image: /images/note-bg.png`，opacity 0.25
- **友链页**（`body.friends-page`）：`body.friends-page::before`，与首页共用 `home-bg.jpg`，opacity 0.35
- 切换通过 JS 的 `setBackgroundForPage()` 函数添加/移除 `homepage` / `note-page` / `friends-page` class
- 切换时有 CSS `opacity` + `background-image` 过渡动画

### 5.7 友链页
- 路由：`#friends` hash
- 友链数据硬编码在 `frontend/js/friends.js` 的 `renderFriendsPage()` 函数中
- 每张卡片包含：头像（`friend-avatar`）、昵称（`friend-name`）、简介（`friend-desc`）、访问按钮（`friend-link-btn`）
- 顶栏"友链"按钮点击跳转到 `#friends`
- 友链页背景与首页共用 `home-bg.jpg`（通过 `friends-page` class 控制）

### 5.8 tree.json 更新时机
- 仅在运行 `update.ps1` 时由 `generate-tree.js` 重新生成
- 新增/删除笔记文件后必须重新生成，否则目录树不更新

### 5.9 模块化文件拆分（2026-05-29）
- **JS 拆分**：`frontend/script.js` → `frontend/js/` 下 9 个模块（core / log / home / note-renderer / tree / friends / router / app 等），通过 `index.html` 按依赖顺序 `<script defer>` 加载
- **CSS 拆分**：`frontend/style.css` → `frontend/css/` 下 9 个模块（variables / base / topbar / sidebar / home / note-viewer / friends / log / responsive）
- 保留 `frontend/script.js` 和 `frontend/style.css` 作为后备（不主动删除），但 `index.html` 不再引用 `frontend/style.css`（仍在引用 `script.js`）
- `js/core.js`：核心共享模块，包含 DOM 引用（viewer, body）、常量（SUPPORTED_IMG, SUPPORTED_VIDEO）和工具函数（setBackgroundForPage, clearTOC, showContentSkeleton, escapeHtml, processMathFormulas, enhanceCodeBlocks 等），通过 `window.CoreModule` 导出
- `js/log.js`：日志模块，包含 logTreeData、logFilesAll、logDateMap 等数据和 renderLogPage、buildLogPageUI、showLogDateDetail、loadLogFile、renderLogMarkdown 等函数，通过 `window.LogModule` 导出（仅导出 renderLogPage 和 loadLogFile）
- 修改特定组件时只需阅读对应的模块文件，大幅减少误修改风险

---

## 6. AI 接手最小阅读清单

如果只需要做**前端修改**（UI/渲染/交互），读：
1. `frontend/index.html` — 了解 DOM 结构和库依赖
2. `frontend/js/app.js` — 入口编排
3. `frontend/js/core.js` — 共享状态和工具函数
4. `frontend/js/router.js` — 路由映射和页面切换
5. 按需读 `frontend/js/{组件}.js` 和 `frontend/css/{组件}.css`
   - `home`：首页渲染
   - `note-renderer`：Markdown 渲染
   - `tree`：侧边栏目录树
   - `friends`：友链页
   - `log`：日志页（含日历）

如果只需要做**后端脚本修改**（部署/预处理），读：
1. `update.ps1` — 部署流程
2. `scripts/generate-tree.js` — 目录树生成
3. 相应的 Python 脚本

如果只需要了解**Obsidian 插件**：
1. `update-script/main.js`
2. `update-script/manifest.json`

**不需要读的文件**：
- `frontend/public/` 下的所有笔记 `.md` 文件（除非调试内容渲染问题）
- `frontend/libs/` 下的第三方库源码
- `frontend/images/` 下的图片二进制
- `frontend/tree.json` 的内容（结构从 generate-tree.js 可知）
- `frontend/style.css` 和 `frontend/script.js`（已拆分不再引用，保留仅作备份）
