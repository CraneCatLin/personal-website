# 遗留代码清理记录

日期：2026-09-05。基准提交：`3dd005c`。

## 已清理与依据

| 位置 | 清理内容 | 不影响当前功能的依据 |
| --- | --- | --- |
| `frontend/libs/js/`、`frontend/index.html` | `marked.min.js`、`markdown-it-imsize.min.js`、`auto-render.min.js` 及三个加载标签 | 笔记和日志均调用 `markdownit`；未注册 imsize 插件，也未调用 `renderMathInElement`。图片尺寸由 `processImageSizes` 处理，公式由 texmath 或手动 KaTeX 回退处理。三个库合计 106,842 字节，约 104.3 KiB，未压缩。 |
| `frontend/script.js` | 重复 DOM 引用、媒体扩展名常量、扩展名判断、背景切换、骨架屏函数 | 复用先于路由加载的 `core.js` 中相同实现。 |
| `frontend/script.js` | `findFileNodeInTree`、`getExtIcon`、局部 `escapeHtml`、`processMathFormulas`、`enhanceCodeBlocks` | 没有实际调用；其他模块使用全局共享函数。笔记修改时间由 `findMtimeInTree` 查找。 |
| `frontend/script.js`、`frontend/js/core.js`、`frontend/js/log.js` | `currentFilePath`、`logTreeData` | 状态仅初始化和赋值，无读取逻辑；`CoreModule.currentFilePath` 也是初始化时的静态副本，无消费者。 |
| `frontend/script.js`、`frontend/index.html`、`frontend/style.css` | 旧 `body.sidebar-open` 监听、隐藏且无事件绑定的 `toggleSidebar`、旧侧栏折叠样式、注释掉的关于按钮 | 当前移动端使用 `.sidebar.open` 和 `#sidebarOverlay.active`；树文件夹及右侧 TOC 的折叠逻辑仍保留。 |
| `frontend/js/log.js`、`frontend/style.css` | `showLogDateDetail`、隐藏的详情容器、旧日志列表/图例/空状态及对应移动端样式 | 详情函数没有调用入口；日期点击直接调用日志阅读。删除的样式在当前模板及笔记中没有使用。日历热度颜色和阅读页样式保留。 |
| `frontend/js/notes.js` | 只向其中追加数据的 `headings` 数组 | TOC 从渲染后的 DOM 读取标题；标题 ID 生成和 `headingCounts` 保留。 |
| `frontend/js/ripple.js` | 四个未读取的 CONFIG 属性、`parentOnError` 局部变量 | 着色器使用自己的常量，删除项没有消费者；未改变着色器及涟漪管理逻辑。 |
| `scripts/generate-tree.js` | 未读取的 `parentRelPath` 参数和实参 | 实际路径始终由 `path.relative(baseDir, currentPath)` 计算。 |
| `frontend/picture-link-convert.py` | 一次性迁移工具 | 项目索引注明迁移已完成；部署及插件均无调用；现有 Markdown 未检出该工具处理的旧图片尺寸格式。 |

## 验证

- 所有自有 JavaScript（前端、构建脚本、Worker、Obsidian 插件）通过语法检查；补丁空白检查通过。
- 入口的 18 个脚本和样式引用均能找到文件。
- 在同一文件系统快照上执行清理前后目录生成器，截获写入并逐项比较：`tree.json`、`tree-log.json` 完全相同，分别覆盖 84 个笔记文件、82 个日志文件。未重写正式 JSON 数据。
- 内置浏览器：清理前后首页正常，统计仍为 84 篇笔记、17 个分类。
- 搜索“卷积”返回 7 篇笔记、31 处命中，Enter 能进入 CNN 笔记。
- 桌面 1440×900：CNN 的 11 个正文标题对应 11 个 TOC 链接；点击目录滚动正文且不更改笔记路由；友链正常。
- 日历切换至 7 月后有 22 个可点击日期；进入 7 月 1 日日志并通过下一篇按钮打开 7 月 2 日，内容与返回日历入口正常。
- “GAMES/纹理.md”正常生成 6 个公式、2 张带尺寸图片、1 个代码块和 1 个复制按钮，点击复制显示 `Success`。
- 移动端 390×844：菜单打开时侧边栏和遮罩激活、背景滚动锁定；点击遮罩后关闭并恢复滚动。验证后已恢复浏览器原尺寸。

## 保留项与范围限制

- `processMathFormulas` 及渲染降级分支：仍有实际调用，不属于废弃代码。
- 图片/视频独立预览、下载分支：即使部分文件不出现在目录树，也可通过 hash 路由进入，因此保留。
- `CoreModule`、其他模块导出和首页全局 getter：保留现有模块组织；没有开展全面接口重构。
- Python 预处理脚本、Worker、部署脚本和 Obsidian 插件：存在部署或手动执行入口，保留；未运行提交、推送、OSS 同步或 Worker 部署。
- 笔记、图片、字体、第三方库内部实现和 Obsidian 数据未作批量清理；其他 CSS 不因一次页面未命中就判定无用。
- 这次是静态引用检查和代表性浏览器回归，不是所有内容与所有设备的穷举验证。阅读计数的线上服务正确性未作独立验证。
- 另发现原有移动端侧栏导航使用 `#/notes` 等地址，而路由判断使用 `#notes`；部分点击同时设置 hash 并直接加载，也可能造成重复请求。这些是功能缺陷候选，保留待单独修复，未与本次清理混改。
