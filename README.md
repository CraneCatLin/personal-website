# WebsiteNote 个人笔记网站

## 项目简介

这是一个基于静态网页的个人笔记管理系统，支持Markdown格式笔记的在线浏览和管理。
本项目主要为vibe coding结果，目的只要求实现功能，代码质量仅作参考

## 技术架构

### 前端技术栈
- HTML5 + CSS3 + JavaScript
- Markdown渲染：markdown-it + Marked.js（备用）
- 代码高亮：Highlight.js
- 数学公式渲染：KaTeX + texmath
- 响应式设计



## 核心功能

### 笔记管理
- 支持Markdown格式笔记
- 自动生成目录树结构
- 支持数学公式渲染（texmath + KaTeX）
- 代码语法高亮显示
- 图片和视频嵌入支持

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

### 线上部署
配置oss地址，创建根目录脚本config.ps1并输入"$OSS_BUCKET_URL = "oss://your-bucket-name""
运行 [update.ps1] 脚本：
- 自动处理笔记文件格式
- 生成目录树
- 提交Git仓库
- 同步到OSS存储

## 使用说明

### 图片引用格式
```
![图片名称|大小](图片路径)
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
