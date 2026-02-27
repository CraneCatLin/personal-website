# WebsiteNote 个人笔记网站

## 项目简介

这是一个基于静态网页的个人笔记管理系统，支持Markdown格式笔记的在线浏览和管理。

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
