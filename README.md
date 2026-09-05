# WebsiteNote 个人笔记网站

## 项目简介

这是一个基于静态网页的个人笔记管理系统，支持Markdown格式笔记的在线浏览和管理。
本项目主要为vibe coding结果，目的只要求实现功能，代码质量仅作参考

网址 https://cranecat.cn
## 技术架构

### 前端技术栈
- HTML5 + CSS3 + JavaScript
- Markdown渲染：markdown-it
- 代码高亮：Highlight.js
- 数学公式渲染：KaTeX + texmath
- 响应式设计



## 核心功能

### 笔记管理
- 支持Markdown格式笔记直接导入
- 自动生成目录树结构
- 支持数学公式渲染（texmath + KaTeX）
- 代码语法高亮显示
- 图片和视频嵌入支持
- 每个笔记内自动重新排序多级标题
- 侧边目录导航允许跳转章节

### 用户界面
- 响应式侧边栏导航
- 移动端适配
- 主页和笔记页面切换
- 平滑的页面过渡效果

## 部署方式

### 本地开发
1. 将笔记文件放入 `frontend/public/` 目录
2. 运行 `node scripts/generate-tree.js` 生成目录结构
3. 直接打开 `frontend/index.html` 即可浏览
4. obsidian的提交插件是调用update.ps1，要求 Obsidian 仓库位于项目根目录下的 frontend/public，项目根目录下需包含 submit.ps1、config.ps1 等文件
### 线上部署
配置oss地址，创建根目录脚本config.ps1并输入"$OSS_BUCKET_URL = "oss://your-bucket-name""
运行 [update.ps1] 脚本：
- 自动处理笔记文件格式
- 生成目录树
- 提交Git仓库
- 同步到OSS存储

### 页面访问计数器部署（仅限首次）
本站点内置了基于 Cloudflare Workers + KV 的页面访问次数计数器，每篇笔记/日志底部会显示"阅读 X 次"。

**首次部署步骤（只需执行一次）：**
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/) → Workers & Pages → KV，创建一个命名空间 `PV_COUNTER`
2. 打开 `scripts/wrangler.toml`，找到 `[[kv_namespaces]]` 下的 `id` 字段，填入上一步获取的 **Namespace ID**
3. 确保已安装 wrangler CLI 并登录：
   ```
   npm install -g wrangler
   wrangler login
   ```
4. 运行一次性部署脚本：
   ```
   powershell -File scripts/deploy-worker.ps1
   ```
部署成功后，之后每次运行 `update.ps1` 时不会再重复部署，计数服务持续可用。

## 使用说明

### 图片引用格式
```
![图片名称|大小](图片路径)
```
### 文章引用格式
```
[[文件名]]
```

### 数学公式语法
支持多种LaTeX数学公式格式：
- 行内公式：`$公式$` 或 `\(公式\)`
- 块级公式：`$$公式$$`

### 支持的文件类型
- 文档：`.md`
- 图片：`.jpg`,`.png`, `.gif`, `.svg` 等
- 视频：`.mp4`, `.webm` 等

## 开发维护

### 主要脚本说明
- [generate-tree.js](\scripts\generate-tree.js)：扫描目录生成JSON结构
- [addLine.py](\scripts\addLine.py)：处理文件编码和换行符
- [gatherToAligned.py](\scripts\gatherToAligned.py)：整理文件对齐
- [add_line_breaks.py](file:\scripts\add_line_breaks.py)：添加必要的换行符
- [deploy-worker.ps1](file:\scripts\deploy-worker.ps1)：一次性部署 Cloudflare Worker（页面访问计数器，仅首次部署需要）

### 更新流程
1. 编辑或添加笔记文件
2. 运行 [update.ps1]脚本
3. 选择自动或手动提交信息
4. 系统自动完成部署


## 版权声明

本项目的原创笔记与内容，除非特别注明，均采用 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) 协议进行共享。您可以：

- **分享** — 在任何媒介以任何形式复制、发行本作品
- **演绎** — 修改、转换或以本作品为基础进行创作

但需遵循以下条件：
- **署名** — 您必须给出适当的署名，提供指向本许可协议的链接，同时标明是否（对原始作品）作了修改
- **非商业性使用** — 您不得将本作品用于商业目的
- **相同方式共享** — 如果您再混合、转换或者基于本作品进行创作，您必须基于与原先许可协议相同的许可协议分发您贡献的作品

本项目可能引用的外部图片等素材，其版权归属各自权利人。如有内容侵犯您的权益，请通过邮件或QQ联系，我将及时处理。



# 更新日志
@2026-05-26
修复了引用视频播放问题
文件夹默认折叠

@2026-05-30
变更了整体外观风格
重构了script.js文件，改良结构

@2026-06-20
移动端适配

@2026-06-30
修复 update.ps1 部署导致所有文件 mtime 被刷新的问题 — add_line_breaks.py 内容未变时不再写回
三个 Python 预处理脚本统一使用 LF 换行符写入
新增 .gitattributes 统一仓库换行符规范

@2026-07-09
日志阅读页面新增上一篇/下一篇导航功能
  - 基于 logFilesAll 按日期降序计算相邻文章
  - 边界情况自动禁用按钮（第一篇无"下一篇"，最后一篇无"上一篇"）
  - 长标题使用 text-overflow: ellipsis 自动截断
  - 涉及 frontend/js/log.js、frontend/style.css

@2026-07-14
笔记页面底部新增修改日期标签
  - 从 tree.json 中的 mtime 字段自动读取，显示在笔记标题下方
  - 2026年6月及之前的笔记显示为"2026.6及之前"
  - 2026年7月及之后的笔记精确显示到日（YYYY.M.D）
  - 日志页面不显示修改日期
  - 涉及 frontend/js/notes.js、frontend/style.css


@2026-07-14
新增页面访问次数计数器系统
  - 使用 Cloudflare Workers + KV 自建计数器，替代第三方服务
  - 自动记录每篇笔记/日志的访问次数，在页面底部显示"阅读 X 次"
  - 新增 scripts/counter-worker.js（Worker 源码）和 scripts/wrangler.toml（部署配置）
  - 涉及 scripts/counter-worker.js、scripts/wrangler.toml、frontend/js/core.js、frontend/js/notes.js、frontend/js/log.js、frontend/style.css、update.ps1

@2026-07-15
修复搜索结果页的多个显示问题（search.js）
  - 同一篇笔记的多个匹配合并为单个结果，显示多个片段 + 匹配计数
  - 统计信息改为 "x 篇笔记中共有 y 个结果"
  - 修复高亮位移：基于 Fuse 精确 indices 位置构建高亮，消除假高亮
  - 修复片段文字不可见：-webkit-box 渲染模式下所有文本段均用 <span> 包裹
  - 涉及 frontend/js/search.js

@2026-07-24
移除旧页面 safeFallback 脚本，消除首次加载时"我的笔记本"等旧卡片闪现
  - viewer 保持空白，由 defer JS 无缝填充首页卡片
  - 移除 frontend/index.html 中的内联 safeFallback 脚本块

@2026-09-05
修复首页首次加载时短暂闪现旧式三栏页面框架的问题
  - 初始阶段隐藏尚未完成路由判定的通用页面框架，目录数据加载后再显示正确页面
  - 目录加载失败时仍按当前 hash 初始化页面，并确保解除启动状态
  - 涉及 frontend/index.html、frontend/style.css、frontend/js/tree.js

@2026-09-05
改进全站搜索的视觉与操作体验
  - 实现方向键选择、Enter 打开、焦点恢复、背景滚动锁定和加载失败重试
  - 修复正文片段高亮偏移导致只显示省略号的问题，每篇结果最多展示两个相关片段
  - 搜索索引清理 Markdown 展示噪音，减小体积并提升摘要可读性
  - 完善搜索对话框语义、选中态、空状态、移动端布局与缓存更新
  - 涉及 frontend/index.html、frontend/style.css、frontend/js/search.js、frontend/search-index.json、scripts/generate-search-index.js

@2026-09-05
清理已确认不参与现有功能的历史代码
  - 移除未使用的 marked、markdown-it-imsize、KaTeX auto-render 库及加载标签
  - 路由脚本复用 core.js 的共享工具，删除无调用函数、只写不读状态和旧侧边栏逻辑
  - 清理旧日志详情列表及配套样式、已完成的图片链接迁移脚本和未使用参数
  - 保留公式回退、图片尺寸处理、日志导航、搜索和部署流程
  - 验证记录见 docs/unused-code-audit.md

@2026-09-05
移除页面装饰图标，统一采用文字标签
  - 去掉笔记目录、日志、友链、文件预览和错误提示中的 emoji
  - 去掉搜索按钮、输入框和提示状态的装饰图标，移动端保留“搜索”文字
  - 删除文件图标映射及对应样式，保留目录展开、菜单、关闭及翻页操作
