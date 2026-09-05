# PROJECT INDEX — WebsiteNote 项目索引

> **用途**：供 AI 接手项目时快速理解全局，减少需要阅读的文件数量。
> **更新日期**：2026-09-05
> **变更摘要**：改进全站搜索体验 — 搜索索引在构建时清理 Markdown 展示噪音，搜索面板支持方向键选择、Enter 打开、焦点管理、加载重试、移动端全屏布局与可访问状态；结果限制为每篇最多两个相关片段，并修复片段高亮偏移。涉及 scripts/generate-search-index.js、frontend/search-index.json、frontend/js/search.js、frontend/index.html、frontend/style.css。页面访问次数计数器继续使用 Cloudflare Workers + KV，Worker 部署由 scripts/deploy-worker.ps1 单独负责

---

## 1. 项目概览

| 项目 | 说明 |
|------|------|
| **名称** | WebsiteNote / CraneCat喵~ |
| **网址** | https://cranecat.cn |
| **类型** | 纯静态个人笔记网站（无后端、无框架） |
| **部署** | OSS 静态托管 + Cloudflare CDN |
| **笔记格式** | Markdown，Obsidian 编写 |
| **VCS** | GitHub: `CraneCatLin/personal-website` |

### 一句话架构

**Obsidian 写 Markdown → 脚本处理格式 + 生成 JSON 目录树 → 纯前端 SPA（JS 路由 + markdown-it 渲染 + KaTeX 数学公式）→ OSS + Cloudflare**

---

## 2. 目录结构总览

```
WebsiteNote/                    # 项目根 = Git 仓库根
├── .gitignore
├── README.md                   # 人类阅读的项目说明
├── PROJECT_INDEX.md            # 本文件：AI 索引
├── config.ps1                  # 敏感配置（OSS_BUCKET_URL, CF_ZONE_ID, CF_API_TOKEN），gitignore
├── update.ps1                  # 一键部署脚本（PowerShell）
│
├── frontend/                   # ★ 前端站点根目录（部署到 OSS 的目录）
│   ├── index.html              # 入口 HTML，单页面骨架
│   ├── 404.html                # 自定义 404 页面（自动跳转首页 + hash）
│   ├── script.js               # ★ 核心 JS：路由、树渲染、内容加载 (~435行)
│   ├── style.css               # ★ 全部样式 (~1880行)
│   ├── tree.json               # 目录树 JSON（由 generate-tree.js 生成）
│   ├── tree-log.json           # 日志目录树 JSON（由 generate-tree.js 单独为日志目录生成）
│   ├── picture-link-convert.py # 一次性工具：转换图片链接格式
│   ├── images/                 # 背景图片（home-bg.jpg, note-bg.png）
│   ├── js/                     # ★ JS 模块目录
│   │   ├── core.js             # 共享模块：DOM引用、工具函数、KaTeX公式渲染、代码复制按钮
│   │   ├── home.js             # 首页模块：动态卡片首页、随机阅读、3D倾斜效果
│   │   ├── log.js              # 日志模块：日历视图、日志列表、日志阅读渲染
│   │   ├── friends.js          # 友链模块：友链页面渲染
│   │   ├── notes.js            # 笔记渲染模块：Markdown渲染、图片/视频预览
│   │   ├── toc.js              # TOC模块：目录树生成、滚动高亮
│   │   ├── tree.js             # 目录树模块：从tree.json加载、构建HTML、绑定交互事件
│   │   ├── search.js           # 全文搜索模块：Fuse.js检索、结果摘要、键盘导航与焦点管理
│   │   ├── ripple.js           # ★ 水面涟漪特效模块（WebGL）：位移映射着色器 + 高光/暗纹 + 双池涟漪管理
│   ├── libs/                   # 第三方库
│   │   ├── js/                 # JS库（marked, highlight.js, KaTeX, markdown-it 等）
│   │   ├── css/                # CSS库（如 github.min.css 语法高亮主题）
│   │   └── katex/              # KaTeX CSS 样式
│   └── public/                 # ★ 笔记文件仓库 + Obsidian Vault
│       ├── .obsidian/          # Obsidian 配置 + 插件（update-script 插件在此）
│
├── scripts/                    # ★ 预处理脚本 + Worker 源码（update.ps1 调用）
│   ├── generate-tree.js        # Node：扫描 public/ 生成 frontend/tree.json
│   ├── addLine.py              # Python：确保 $$ 公式前有空行
│   ├── add_line_breaks.py      # Python：每行末尾加两个空格（Markdown 换行用）
│   ├── gatherToAligned.py      # Python：替换 aligned → gathered 环境名
│   ├── generate-search-index.js # Node：扫描 public/ 下所有 .md 文件（排除日志目录），生成 frontend/search-index.json
│   ├── counter-worker.js       # ★ Cloudflare Worker：页面访问次数计数器（POST 记录/ GET 查询，KV 存储）
│   ├── deploy-worker.ps1       # ★ 一次性部署 Worker 脚本（仅首次部署需要）
│   └── wrangler.toml           # Worker 部署配置（KV 命名空间绑定、路由、兼容性标志）
│
└── update-script/              # Obsidian 插件源码
    ├── main.js                 # 插件逻辑：在 Obsidian Ribbon 添加按钮调用 update.ps1
    └── manifest.json           # 插件元数据
```

---

## 3. 文件职责与关键细节

### 3.1 前端核心

#### `frontend/index.html`
- **角色**：SPA 唯一 HTML 页面
- **内容**：顶栏（首页/笔记/友链/日志按钮 + 移动端菜单按钮）、左侧目录树侧边栏、中间内容区、右侧 TOC 侧边栏、底部 `#sidebarOverlay`（移动端侧边栏半透明遮罩层）
- **加载的库**：`marked` + `highlight.js` + `markdown-it` + `markdown-it-imsize` + `KaTeX` + `texmath`

#### `frontend/script.js`（~450 行）
- **角色**：主要交互逻辑（路由、树渲染、内容渲染）
- **说明**：原始全部逻辑已拆分，部分功能移至 `js/core.js`（共享工具函数）、`js/home.js`（首页模块）、`js/log.js`（日志模块）、`js/friends.js`（友链模块）、`js/notes.js`（笔记渲染模块）、`js/toc.js`（TOC 模块）、`js/tree.js`（目录树模块）
- **IIFE 变量暴露**：通过 `Object.defineProperty` getter 将 `treeData`、`defaultNotePath`、`loadFileByPath`、`loadFromHash` 暴露为 `window.treeData` 等全局属性，供 `js/home.js` 以自由变量形式访问
- **核心机制**：
  - **路由**：基于 `window.location.hash`（`#文件路径`），`hashchange` 事件驱动
  - **目录树**：fetch `/tree.json` → `buildTreeHTML()` 生成 DOM → `bindTreeEvents()` 绑定点击/折叠。加载时自动过滤掉名称为"日志"的文件夹（日志由 `tree-log.json` 单独管理）
  - **内容渲染**：fetch `/public/文件路径` → `markdown-it` 渲染 → 注入 viewer
  - **Wikilink**：`[[文件名]]` 语法 → 替换为 `<a href="#...">`
  - **图片尺寸**：`![alt|宽x高](path)` → 在渲染后通过 DOM 操作设置 width/height 属性
  - **TOC**（移至 `js/toc.js`）：从渲染后的 DOM 提取标题（`:is(h1~h6):not(.note-title)`）→ 构建嵌套目录
  - **数学公式**：优先用 `markdown-it-texmath` 插件；若失败则用正则 + KaTeX 手动替换
  - **代码高亮**：`markdown-it` 的 highlight 回调 + 防退手动 `hljs.highlightElement`
  - **代码复制按钮**：`enhanceCodeBlocks()` 为每个 pre 包裹 wrapper + 复制按钮（移至 `js/core.js`）
  - **骨架屏**：加载时显示 CSS 动画骨架
  - **最后修改时间**：从 `tree.json` 的 `mtime` 读取显示在每个笔记底部
  - **移动端侧边栏**：`initTopbar()` 中的 `toggleSidebarOpen()` 管理 `.sidebar.open` + `#sidebarOverlay.active` + body 滚动锁定；侧边栏内导航按钮（`.sidebar-nav-btn`）点击后自动导航并关闭侧边栏
  - **页面切换**：`smoothPageTransition()` 统一管理平滑过渡（core.js），支持四种模式即时首页、note-page、friends-page、log-page，先淡出 viewer/背景 → 执行变更 → 淡入 viewer/背景 → TOC 延迟显示
- **全局状态**：
  - `treeData`：tree.json 解析结果
  - `currentFilePath`：当前加载的文件相对路径
  - `fileNameMap` / `fullPathNoExtMap`：Wiki 链接快速查找 Map
  - `defaultNotePath`：默认第一个笔记路径（供"笔记"按钮使用）

#### `frontend/style.css`（~1880 行）
- **角色**：全部视觉样式
- **关键设计**：
  - CSS 变量定义在 `:root`（颜色、阴影、过渡）
  - 布局：`grid-template-columns: 250px 1fr`（左侧边栏 + 主区域），主区域再 flex 分内容区和 TOC
  - 移动端：768px 以下左侧边栏变为固定侧滑菜单（`.sidebar.open` + `transform: translateX`），伴随 `#sidebarOverlay` 半透明遮罩层（`.active` 控制显隐）；TOC 隐藏
  - 移动端：笔记标题/正文/表格/代码块/图片/KaTeX 公式等比缩小
  - 移动端顶栏紧凑排版：按钮内边距/字体缩小，菜单按钮居中
  - 移动端溢出处理：表格横向滚动、图片/视频 `max-width: 100%`
  - 背景：`#bgLayer` 独立 div 实现首页/笔记页/友链页背景切换（双缓冲淡入淡出）；`body::before` 作为背景回退
  - viewer/TOC 过渡：`viewer`、`#tocContent` 使用 `opacity + transition` 实现淡入淡出（`toc-hidden` 类控制 TOC 显隐）
  - 骨架屏动画：`skeleton-shimmer` keyframes
  - 代码块复制按钮：`.code-copy-btn` 绝对定位在 `pre` 右上角

#### `frontend/js/core.js`（~220 行）
- **角色**：核心共享模块，新增页面切换平滑过渡管理
- **内容**：
  - **DOM 引用**：`viewer`、`body`、`currentFilePath`、`bgLayer`（背景双缓冲层）、`tocSidebar`、`sidebar`、`tocContent`
  - **常量**：`SUPPORTED_IMG` / `SUPPORTED_VIDEO`
  - **工具函数**：
    - `getFileExtension()` — 获取文件扩展名
    - `setBackgroundSmooth()` — **双缓冲背景切换**：淡出→更换→淡入，支持首页/笔记/友链/日志四模式
    - `initBackground()` — 初始化背景层
    - `fadeViewerContent()` — 淡出 viewer + TOC（200ms），回调后执行变更
    - `revealViewerContent()` — 淡入 viewer，TOC 延迟 150ms 淡入
    - `showContentSkeleton()` — 显示骨架屏（半透明 0.6）
    - `escapeHtml()` — HTML 转义
    - `processMathFormulas()` — 手动 KaTeX 公式渲染
    - `enhanceCodeBlocks()` — 代码块复制按钮
    - `smoothPageTransition(changeFn, isAsync)` — **页面切换统一入口**：淡出→变更→自动/手动淡入（async）
- **导出**：通过 `window.CoreModule` 暴露

#### `frontend/js/log.js`（~397 行）
- **角色**：日志模块（从 `script.js` 拆分）
- **依赖**：`js/core.js`（使用 CoreModule 导出的函数）
- **核心功能**：
  - **日志日历页**：`renderLogPage()` — 加载 `tree-log.json`，构建月份日历表格，支持年/月选择切换
  - **日志数据**：`logDateMap` 以日期为 key 索引日志文件
  - **日历渲染**：按月份生成 7 列表格，日期有日志时显示为可点击（颜色深度反映当日日志数量）
  - **日历导航**：上/下月按钮 + 年份/月份下拉跳转
  - **日志阅读**：`loadLogFile()` + `renderLogMarkdown()` — 加载并渲染 Markdown，显示"← 返回日历"按钮
  - **页面标识**：阅读日志时设置 `body.hide-sidebar` + `log-page` 类
- **导出**：通过 `window.LogModule` 暴露给 `script.js`

#### `frontend/js/home.js`（~310 行）
- **角色**：首页模块（从 `script.js` 拆分）
- **依赖**：通过 script.js IIFE 暴露的全局变量 `window.treeData`、`window.defaultNotePath`、`window.loadFileByPath`、`window.loadFromHash`（以自由变量形式引用）；通过 core.js 的全局变量 `viewer`、`escapeHtml`；通过 toc.js 的 `window.TOCModule.clearTOC`
- **核心功能**：
  - `renderDefaultAbout()` — 渲染卡片式首页（欢迎卡片、关于、随机阅读、统计、标签）
  - `bindHomeCardEvents()` — 绑定首页卡片交互（进入笔记库、随机阅读点击、标签点击、刷新、3D倾斜）
  - `initCardTilt()` — 卡片 3D 倾斜 + Glare 高光鼠标跟随效果
  - `refreshRandomCard()` — 刷新随机推荐卡片内容
  - `findFirstMd()` — 递归查找文件夹内第一个 .md 文件
  - `navigateToFirstNote()` — 跳转到笔记库第一篇笔记
- **导出**：通过 `window.HomeModule` 暴露 `renderDefaultAbout` 和 `navigateToFirstNote`

#### `frontend/js/friends.js`（~46 行）
- **角色**：友链模块（从 `script.js` 拆分）
- **依赖**：使用全局 `viewer`；通过 toc.js 的 `window.TOCModule.clearTOC`
- **核心功能**：
  - `renderFriendsPage()` — 渲染友链卡片列表，设置页面标题，清空 TOC
- **导出**：通过 `window.FriendsModule` 暴露给 `script.js`

#### `frontend/js/toc.js`（~145 行）
- **角色**：TOC 模块（从 `script.js` 拆分）
- **依赖**：通过 `window.TOCModule` 导出 `renderTOCFromDOM`、`clearTOC`、`updateTOCActive`
- **核心功能**：
  - `renderTOCFromDOM()` — 从渲染后的 DOM 提取标题，构建嵌套目录树；移除 `toc-hidden` 类触发淡入
  - `clearTOC()` — 添加 `toc-hidden` 类触发淡出后再清空 HTML
  - `updateTOCActive()` — 滚动时高亮当前目录项（滚动监听事件在 `script.js` 的 `init()` 中绑定）
- **过渡机制**：使用 `toc-hidden` CSS 类（opacity: 0 + transition）实现 TOC 平滑显隐，避免闪烁
- **导出**：通过 `window.TOCModule` 暴露给其他模块

#### `frontend/js/notes.js`（~243 行）
- **角色**：笔记渲染模块（从 `script.js` 拆分）
- **依赖**：通过 `window.CoreModule` 使用 `processMathFormulas`、`escapeHtml`、`revealViewerContent` 等函数
- **核心功能**：
  - `renderMarkdown()` — 使用 markdown-it 渲染 Markdown 内容，处理 Wikilink、图片尺寸、代码高亮、TOC 生成；渲染完成后调用 `revealViewerContent()` 淡入内容
  - `renderImage()` — 渲染图片文件（根据扩展名判断是否支持的图片格式）
  - `renderVideo()` — 渲染视频文件
  - `renderUnsupported()` — 显示不支持的文件类型提示
  - `processImageSizes()` — 在 DOM 层面设置图片宽高属性
  - `convertVideoImgs()` — 转换视频相关的 `<img>` 标签
- **导出**：通过 `window.NotesModule` 暴露 `renderMarkdown`、`renderImage`、`renderVideo`、`renderUnsupported`

#### `frontend/js/search.js`
- **角色**：全站搜索面板与搜索结果交互模块
- **依赖**：Fuse.js；搜索数据来自构建生成的 `search-index.json`
- **核心功能**：
  - 标题权重 0.7、正文权重 0.3 的实时模糊搜索，最多展示 50 篇笔记
  - 每篇笔记最多展示两个相关正文片段，按 Fuse 精确区间高亮并统计命中数
  - 支持 Ctrl/Cmd+K 打开、方向键选择、Enter 打开、Esc 关闭以及清空和加载重试
  - 搜索框获得焦点时预加载索引；面板打开时锁定背景滚动，关闭后恢复原焦点
  - 通过 dialog、combobox、listbox 语义和动态 ARIA 状态提供键盘及读屏支持
- **导出**：通过 `window.SearchModule` 暴露 `init`、`open`、`close`

#### `frontend/tree.json`
- **角色**：目录树数据（由 `scripts/generate-tree.js` 每次部署前生成）
- **结构**：`{ type, name, path, children[], ext?, mtime? }` 递归嵌套
- **path 字段**：相对于 `public/` 的相对路径（如 `"ai/CNN.md"`）

#### `frontend/tree-log.json`
- **角色**：日志目录树数据（由 `scripts/generate-tree.js` 单独为 `public/日志/` 目录生成）
- **结构**：与 `tree.json` 相同（`{ type, name, path, children[], ext?, mtime? }`）
- **用途**：日志模块专用，避免与主笔记目录树混淆

#### `frontend/404.html`
- **角色**：OSS 自定义 404，当访问不存在的路径时自动跳转到 `index.html#原路径`
- **逻辑**：`window.location.pathname` → 设置 `window.location.href = '/index.html#' + currentPath`


#### `frontend/js/ripple.js`
- **角色**：水面涟漪特效模块（WebGL 着色器实现）
- **依赖**：无（纯原生 WebGL 1.0，无第三方库）
- **核心功能**：
  - 使用 WebGL 片段着色器实现位移映射（Displacement Mapping），对背景纹理坐标进行径向偏移采样
  - 高光/暗纹：在着色器中基于正弦波相位计算亮度增减，增强立体感
  - 自动涟漪池（固定 3 个）+ 鼠标涟漪池（最多 3 个），双池独立管理
  - 涟漪生命周期：强度从 0 攀升至峰值（0.2s），再衰减至 0
  - 鼠标涟漪快速淡化（fastFade）逻辑：0.5s 内强度线性归零
  - 背景图自动检测：通过 `body.className` 切换对应的背景图纹理
  - CSS 背景兼容：图片加载失败时保持透明画布，让 CSS 背景透出
  - 性能优化：`requestAnimationFrame` + `visibilitychange` 暂停

#### `frontend/picture-link-convert.py`
- **角色**：一次性工具脚本
- **功能**：将 `![](path =WxH)` 格式批量转换为 `![](alt|WxH)` 格式
- **已执行完毕，不再需要常规运行**

---

### 3.2 预处理脚本

#### `scripts/generate-tree.js`
- **角色**：部署流程核心，生成 `frontend/tree.json`
- **运行方式**：`node scripts/generate-tree.js`
- **输入**：`frontend/public/` 目录
- **输出**：`frontend/tree.json`
- **过滤规则**：
  - 忽略隐藏文件（`.` 开头）
  - 忽略 `.DS_Store`, `.gitkeep`, `.git`, `.hg`, `.svn`, `Thumbs.db`
  - 忽略 `/images` 目录
  - 忽略图片扩展名（`.jpg`, `.png`, `.gif`, `.svg`, `.webp`, `.bmp`）
- **排序**：`localeCompare` 自然排序

#### `scripts/addLine.py`
- **角色**：确保 Markdown 文件中 `$$` 块级公式前有空行，避免渲染问题
- **输入/输出**：原地修改 `frontend/public/**/*.md`

#### `scripts/add_line_breaks.py`
- **角色**：在每行末尾添加两个空格（Markdown 硬换行语法）
- **输入/输出**：原地修改 `frontend/public/**/*.md`

#### `scripts/gatherToAligned.py`
- **角色**：将 Markdown 中的 `aligned` LaTeX 环境替换为 `gathered`
- **实际行为**：正则 `\baligned\b` → `gathered`
- **输入/输出**：原地修改 `frontend/public/**/*.md`

#### `scripts/counter-worker.js`
- **角色**：Cloudflare Workers 页面访问次数计数器（自建，替代方案二不蒜子）
- **运行方式**：由 `wrangler deploy` 部署到 Cloudflare Workers
- **API 接口**（路由绑定 `pv-counter.cranecat.workers.dev`）：
  - `POST /pv?path=xxx` — 记录一次访问，返回 `{ count: number }`
  - `GET /pv?path=xxx` — 查询当前访问次数，返回 `{ count: number }`
- **存储**：Cloudflare KV 命名空间 `PV_COUNTER`，key 为文件路径，value 为计数字符串
- **CORS**：允许所有来源的跨域请求（`Access-Control-Allow-Origin: *`）
- **错误处理**：KV 读写失败时返回 `count: -1`，前端友好降级

#### `scripts/wrangler.toml`
- **角色**：Worker 部署配置
- **关键字段**：
  - `name = "pv-counter"` — Worker 名称
  - `compatibility_flags = ["nodejs_compat"]` — Node.js 兼容模式
  - `route` — 路由绑定到 `pv-counter.cranecat.workers.dev/pv`（或 `cranecat.cn/api/pv`）
  - `[[kv_namespaces]]` — 绑定 KV 命名空间 `PV_COUNTER`，binding 名为 `PV_COUNTER`

---

### 3.3 部署系统

#### `update.ps1`
- **角色**：一键部署主脚本
- **流程**：
  1. 加载 `config.ps1`（OSS/CF 凭证）
  2. 选择提交模式（自动/手动 commit message）
  3. 依次运行预处理脚本：`addLine.py` → `gatherToAligned.py` → `add_line_breaks.py` → `generate-tree.js` → `generate-search-index.js`
  4. `git add .` → `git commit` → `git push`
  5. `ossutil sync ./frontend/ $OSS_BUCKET_URL --update --delete`
  6. 调用 Cloudflare API 刷新全站缓存

#### `config.ps1`
- **内容**：`$OSS_BUCKET_URL`, `$CF_ZONE_ID`, `$CF_API_TOKEN`
- **已 gitignore，不可提交**

#### `update-script/`（Obsidian 插件）
- **`main.js`**：在 Obsidian 左侧 Ribbon 添加终端图标按钮，点击后弹出 PowerShell 窗口执行 `update.ps1`
- **路径计算**：从 `vaultPath`（通常是 `.../WebsiteNote/frontend/public`）向上 3 级到项目根，拼接 `./WebsiteNote/update.ps1`
- **`manifest.json`**：插件元数据，`id: "update-script"`, `isDesktopOnly: true`

---

## 4. 数据流图

```
┌─────────────────────────────────────────────────────────┐
│  开发阶段（本地）                                        │
│                                                         │
│  Obsidian (frontend/public)                             │
│       │                                                 │
│       ▼                                                 │
│  用户编辑 Markdown 笔记                                  │
│       │                                                 │
│       ▼ (点击 Obsidian 插件按钮 或 手动运行)              │
│  update.ps1                                             │
│       │                                                 │
│       ├─► scripts/addLine.py          (处理公式格式)     │
│       ├─► scripts/gatherToAligned.py  (替换 LaTeX 环境)  │
│       ├─► scripts/add_line_breaks.py  (添加换行符)       │
│       ├─► scripts/generate-tree.js    (生成 tree.json)   │
│       ├─► scripts/generate-search-index.js (生成 search-index.json) │
│       ├─► git add/commit/push                             │
│       ├─► ossutil sync ./frontend/ → OSS桶               │
│       └─► Cloudflare API: purge_cache (刷新全站)         │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  访问阶段（线上）                                        │
│                                                         │
│  用户浏览器                                              │
│       │                                                 │
│       ▼  https://cranecat.cn                            │
│  Cloudflare CDN → OSS                                   │
│       │                                                 │
│       ▼  frontend/index.html                            │
│  加载 script.js                                          │
│       │                                                 │
│       ├─► fetch /tree.json → 构建目录树                  │
│       ├─► 读取 hash → 确定要加载的文件路径                │
│       ├─► fetch /public/{path}.md → markdown-it 渲染     │
│       └─► KaTeX 渲染数学公式, hljs 代码高亮               │
└─────────────────────────────────────────────────────────┘
```

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

### 5.8 移动端竖版背景图
- 桌面端使用横版图（`home-bg.jpg`, `note-bg.png`），移动端（≤768px）自动切换为竖版裁切图
- 竖版图位于 `frontend/images/` 下：
  - `home-bg-mobile.jpg` — 首页/友链页
  - `note-bg-mobile.png` — 笔记页
- 切换逻辑通过 CSS media query `@media (max-width: 768px)` 覆盖 `body::before` 的 `background-image` 实现
- 需要在 images/ 目录下放置竖版图后才生效

### 5.6 页面切换过渡机制
- **背景双缓冲**：通过 `#bgLayer` 独立 div 实现背景图淡出 → 替换 → 淡入（setBackgroundSmooth），不再依赖 body::before 的 transition，消除背景闪烁
- **viewer 淡入淡出**：`smoothPageTransition()` 统一管理：先淡出 viewer（200ms），执行页面变更，再淡入（280ms）。异步页面（笔记 fetch）由渲染完成回调 `revealViewerContent` 淡入
- **TOC 延迟显示**：TOC 淡入延迟 150ms，确保内容先渲染完成；切换时 TOC 与 viewer 同步淡出
- **骨架屏**：异步加载笔记时先显示骨架屏（viewer 半透明 0.6），渲染完成后替换为实际内容并淡入至 1
- 背景层 z-index 层级：`body::before`（背景回退）→ `#bgLayer`（实际背景图）→ 内容

### 5.7 背景图
- 首页：`#bgLayer` 的 `background-image: url('/images/home-bg.jpg')`
- 笔记页/友链页：`#bgLayer` 的 `background-image: url('/images/note-bg.png')`
- 日志页：清除 bgLayer 背景 + 隐藏 sidebar + body 纯色背景透出

### 5.9 tree.json 更新时机
- 仅在运行 `update.ps1` 时由 `generate-tree.js` 重新生成
- 新增/删除笔记文件后必须重新生成，否则目录树不更新

### 5.10 tree-log.json 更新时机
- 与 tree.json 同时由 `generate-tree.js` 生成（扫描 `public/日志/` 目录）
- 新增/删除日志文件后必须重新生成，否则日志日历不更新

### 5.11 移动端适配机制
- 侧边栏切换不再使用 `body.sidebar-open` 类，改为 `#sidebar` 的 `.open` 类 + `#sidebarOverlay` 的 `.active` 类
- `toggleSidebarOpen()` 统一管理：打开时 `body.style.overflow = 'hidden'` 锁定背景滚动
- 侧边栏内导航按钮（首页/笔记/友链/日志）点击后自动关闭侧边栏（`toggleSidebarOpen(false)`）
- 手机竖屏优先：所有内容区元素（标题/图片/代码/表格/公式）在 768px 以下自动等比缩小，无需水平滚动
- 顶栏按钮在移动端紧凑排列，菜单按钮居中

---

## 6. AI 接手最小阅读清单

如果只需要做**前端修改**（UI/渲染/交互），读：
 1. `frontend/index.html` — 了解 DOM 结构和库依赖
 2. `frontend/js/core.js` — 共享工具函数
 3. `frontend/js/home.js` — 首页模块
 4. `frontend/js/log.js` — 日志模块
 5. `frontend/js/friends.js` — 友链模块
 6. `frontend/js/notes.js` — 笔记渲染模块
 7. `frontend/js/toc.js` — TOC 模块
 8. `frontend/script.js` — 主要交互逻辑
 9. `frontend/style.css` — 按需搜索类名

如果只需要做**后端脚本修改**（部署/预处理），读：
1. `update.ps1` — 部署流程
2. `scripts/generate-tree.js` — 目录树生成
3. 相应的 Python 脚本

如果只需要做**前端视觉特效修改**（涟漪/水面效果），读：
 1. `frontend/js/ripple.js` — 完整的 WebGL 涟漪特效模块

如果只需要了解**Obsidian 插件**：
1. `update-script/main.js`
2. `update-script/manifest.json`

**不需要读的文件**：
- `frontend/public/` 下的所有笔记 `.md` 文件（除非调试内容渲染问题）
- `frontend/libs/` 下的第三方库源码
- `frontend/images/` 下的图片二进制
- `frontend/tree.json` 的内容（结构从 generate-tree.js 可知）
