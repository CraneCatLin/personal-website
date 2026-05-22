# PROJECT INDEX — WebsiteNote 项目索引

> **用途**：供 AI 接手项目时快速理解全局，减少需要阅读的文件数量。
> **更新日期**：2026-05-23

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
│   ├── script.js               # ★ 核心 JS：路由、树渲染、Markdown 渲染 (~700行)
│   ├── style.css               # ★ 全部样式 (~600行)
│   ├── tree.json               # 目录树 JSON（由 generate-tree.js 生成）
│   ├── picture-link-convert.py # 一次性工具：转换图片链接格式
│   ├── images/                 # 背景图片（home-bg.jpg, note-bg.png）
│   ├── libs/                   # 第三方库（marked, highlight.js, KaTeX, markdown-it 等）
│   └── public/                 # ★ 笔记文件仓库 + Obsidian Vault
│       ├── .obsidian/          # Obsidian 配置 + 插件（update-script 插件在此）
│
├── scripts/                    # ★ 预处理脚本（update.ps1 调用）
│   ├── generate-tree.js        # Node：扫描 public/ 生成 frontend/tree.json
│   ├── addLine.py              # Python：确保 $$ 公式前有空行
│   ├── add_line_breaks.py      # Python：每行末尾加两个空格（Markdown 换行用）
│   └── gatherToAligned.py      # Python：替换 aligned → gathered 环境名
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
- **内容**：顶栏（首页/笔记按钮 + 菜单按钮）、左侧目录树侧边栏、中间内容区、右侧 TOC 侧边栏
- **加载的库**：`marked` + `highlight.js` + `markdown-it` + `markdown-it-imsize` + `KaTeX` + `texmath`
- **入口脚本**：`script.js`（defer 加载）
- **后备内容**：若 JS 失败，显示静态 fallback 页面

#### `frontend/script.js`（~700 行）
- **角色**：全部交互逻辑
- **核心机制**：
  - **路由**：基于 `window.location.hash`（`#文件路径`），`hashchange` 事件驱动
  - **目录树**：fetch `/tree.json` → `buildTreeHTML()` 生成 DOM → `bindTreeEvents()` 绑定点击/折叠
  - **内容渲染**：fetch `/public/文件路径` → `markdown-it` 渲染 → 注入 viewer
  - **Wikilink**：`[[文件名]]` 语法 → 替换为 `<a href="#...">`
  - **图片尺寸**：`![alt|宽x高](path)` → 在渲染后通过 DOM 操作设置 width/height 属性
  - **TOC**：从渲染后的 DOM 提取标题（`:is(h1~h6):not(.note-title)`）→ 构建嵌套目录
  - **数学公式**：优先用 `markdown-it-texmath` 插件；若失败则用正则 + KaTeX 手动替换
  - **代码高亮**：`markdown-it` 的 highlight 回调 + 防退手动 `hljs.highlightElement`
  - **代码复制按钮**：`enhanceCodeBlocks()` 为每个 pre 包裹 wrapper + 复制按钮
  - **骨架屏**：加载时显示 CSS 动画骨架
  - **最后修改时间**：从 `tree.json` 的 `mtime` 读取显示在每个笔记底部
  - **首页/笔记页切换**：`body.classList` 控制 sidebar 显隐和背景图切换
- **全局状态**：
  - `treeData`：tree.json 解析结果
  - `currentFilePath`：当前加载的文件相对路径
  - `fileNameMap` / `fullPathNoExtMap`：Wiki 链接快速查找 Map

#### `frontend/style.css`（~600 行）
- **角色**：全部视觉样式
- **关键设计**：
  - CSS 变量定义在 `:root`（颜色、阴影、过渡）
  - 布局：`grid-template-columns: 250px 1fr`（左侧边栏 + 主区域），主区域再 flex 分内容区和 TOC
  - 移动端：768px 以下左侧边栏变为固定侧滑菜单（`transform: translateX`），TOC 隐藏
  - 背景：`body` 和 `body::before` 伪元素实现首页/笔记页背景切换（淡入淡出）
  - 骨架屏动画：`skeleton-shimmer` keyframes
  - 代码块复制按钮：`.code-copy-btn` 绝对定位在 `pre` 右上角

#### `frontend/tree.json`
- **角色**：目录树数据（由 `scripts/generate-tree.js` 每次部署前生成）
- **结构**：`{ type, name, path, children[], ext?, mtime? }` 递归嵌套
- **path 字段**：相对于 `public/` 的相对路径（如 `"ai/CNN.md"`）

#### `frontend/404.html`
- **角色**：OSS 自定义 404，当访问不存在的路径时自动跳转到 `index.html#原路径`
- **逻辑**：`window.location.pathname` → 设置 `window.location.href = '/index.html#' + currentPath`

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

---

### 3.3 部署系统

#### `update.ps1`
- **角色**：一键部署主脚本
- **流程**：
  1. 加载 `config.ps1`（OSS/CF 凭证）
  2. 选择提交模式（自动/手动 commit message）
  3. 依次运行预处理脚本：`addLine.py` → `gatherToAligned.py` → `add_line_breaks.py` → `generate-tree.js`
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

### 5.6 背景图
- 首页：`body` 的 `background-image: /images/home-bg.jpg`
- 笔记页：`body.note-page::before` 伪元素的 `background-image: /images/note-bg.png`
- 切换时有 CSS `opacity` 过渡动画

### 5.7 tree.json 更新时机
- 仅在运行 `update.ps1` 时由 `generate-tree.js` 重新生成
- 新增/删除笔记文件后必须重新生成，否则目录树不更新

---

## 6. AI 接手最小阅读清单

如果只需要做**前端修改**（UI/渲染/交互），读：
1. `frontend/index.html` — 了解 DOM 结构和库依赖
2. `frontend/script.js` — 全部逻辑
3. `frontend/style.css` — 按需搜索类名

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