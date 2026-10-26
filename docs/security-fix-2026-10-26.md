# 2026-10-26 安全修补与使用说明

## 已完成并上线

- 33 个已上传的 Obsidian 配置/插件/数据库及 node_modules 对象已改为 **private ACL**，未删除云端对象或本地 Vault。原 ACL 清单保存在 Git 忽略的 `logs/security-quarantine-2026-10-26.json`。
- Cloudflare 全站缓存已成功清除。网站与 OSS 直连的 Key 配置、向量数据库压缩包均返回 403；首页为 200。
- 新前端已从 `dist/site/` 发布：334 个公开文件，179 篇 Markdown。实际上传 83 个对象，远程删除数为 0。
- hash 路由校验 `public-files.json` 白名单，拒绝私有/未知路径及非法编码；媒体与错误文本使用安全 DOM 赋值。
- 笔记和日志 HTML 经 DOMPurify 消毒；保留公式、Wikilink、图片尺寸、代码、日志 Obsidian 图片嵌入。HTML 加入 CSP/referrer meta，404 跳转改为外部脚本。
- markdown-it **15.0.3**、KaTeX **0.19.1**、DOMPurify **3.4.17** 已上线。使用固定官方包并验证 SHA512，文件哈希见 `scripts/vendor-assets.json`。
- 使用了 markdown-it 15 的实际浏览器入口 `dist/browser/markdown-it.umd.min.js`，没有误用包中遗留的旧浏览器文件。
- 本项目安装独立 Node.js **24.22.1**，部署脚本优先使用 `.tools/` 中的运行时，不改系统 PATH、系统 Node 或 Obsidian/Electron。
- 发布脚本修正缓存请求体的 JSON 重复编码，检查所有步骤退出码；只上传过滤副本，排除隐藏目录、依赖、密钥文件，并在发现常见明文密钥时停止。
- Wrangler **4.152.0** 与依赖由锁文件固定；Undici 覆盖为 **7.30.1**。npm 官方审计结果为 0 项漏洞。

关键变化：

```diff
- frontend/ 整个目录 → OSS
+ frontend/ → 过滤与密钥检查 → dist/site/ → OSS

- hash / 错误信息 → 字符串拼接 innerHTML
+ 公开清单校验 + DOM 文本/属性赋值 + Markdown HTML 消毒

- 本机旧 Node、未固定 npx 工具、失败后继续发布
+ 项目安全 Node、固定工具、失败即停止、成功后清缓存
```

## 撤销 Key 后，如何继续使用 Obsidian

1. 在 DeepSeek 控制台撤销本次公开的旧 Key，查看近期用量；旧 Key 已在当前对话给出，此文不保存其内容。
2. 在 DeepSeek 创建新 Key，保留实际需要的权限/额度限制。
3. 打开 Obsidian → 设置 → Smart Composer → DeepSeek provider，将 API Key 替换为新值，保存并测试一次普通对话。具体标签名称可能随插件版本不同。
4. 不需要删除 `.obsidian`、重装插件、清空聊天记录或移动 Vault。笔记、插件、工作区和本地数据库均保留。
5. 网站更新继续点击原来的发布按钮即可。它仍运行根目录 `update.ps1`；Key 所在的 `.obsidian/`、`.smtcmp_json_db/` 和向量数据库不会进入发布副本，也不会提交 Git。

请不要将新 Key 粘贴到公开 Markdown、网页或项目报告中。发布检查会阻断常见 Key 格式，但不能识别所有秘密类型。

当前项目已完成工具安装。新机器或重新克隆仓库时，在项目根目录先执行：

```powershell
powershell -File scripts/setup-tools.ps1
```

发布脚本额外支持：

```powershell
# 保留原 Obsidian 发布按钮的交互方式
powershell -File update.ps1

# Git 暂不可用时，明确跳过 Git；仍构建、检查、上传公开文件并清缓存
powershell -File update.ps1 -SkipGit

# 只预处理与构建，完全不执行 Git、OSS 或 Cloudflare 操作
powershell -File update.ps1 -BuildOnly
```

后续同步仍使用 `--delete` 清理公开文件中的旧资源，但有共享的私有路径排除规则，避免删除本次隔离备份。本地私有目录不会因发布被移走或清空。

## Worker：已修好源码，按用户选择稍后手动上线

现有 Wrangler 登录已过期。用户已选择“先完成其他修复，Worker 稍后手动部署”，本次没有更改运行中的 Worker 或 KV 数据。

新源码包含：精确 `/pv` 路由、来源校验、真实公开笔记白名单、KV key 字节限制、平台每客户端 IP/边缘位置 60 次/分钟限流、异常降级。前端已去重同一页面加载中对同一笔记的计数请求。限流是近似的配额保护，不是全局账单硬上限；KV 自增仍非原子，精确统计需要另行设计。

需要上线时，在项目根目录运行：

```powershell
# 首次克隆后安装锁定工具；本机已经完成
$env:Path = "$PWD\.tools\node-v24.22.1-win-x64;$env:Path"
& .\.tools\node-v24.22.1-win-x64\node.exe .\.tools\node-v24.22.1-win-x64\node_modules\npm\bin\npm-cli.js ci --ignore-scripts

# 登录完成后部署；这是更新现有 pv-counter，不新建或清空 KV
& .\.tools\node-v24.22.1-win-x64\node.exe .\node_modules\wrangler\bin\wrangler.js login
powershell -File scripts/deploy-worker.ps1
```

部署前已通过 Wrangler dry-run，显示原有 `PV_COUNTER` KV 与新增 `PV_RATE_LIMIT` 绑定。Worker 每 60 秒从网站公开清单更新笔记路径；日常新增文章不需要重复部署 Worker。

## Cloudflare：需要有控制台权限的人完成

当前项目 Token 可清缓存，但读取 zone 安全设置、规则与 DNS 返回 403。本次没有扩大 Token 权限或改动回源架构。

1. 在 `cranecat.cn` 的 **SSL/TLS → Edge Certificates** 开启 **Always Use HTTPS**。前端已加入 HTTPS 客户端跳转，但 HTTP 状态码级别的重定向仍需 Cloudflare 配置。
2. 在 **Caching → Configuration / Cache Rules / Page Rules** 检查覆盖规则，令 HTML、404 与 JSON 索引/清单尊重源站缓存头。OSS 上六个入口/索引对象已为 `Cache-Control: no-cache`，但线上 Cloudflare 仍强制返回 `max-age=14400`。仅修改默认 Browser Cache TTL 可能不足；已有更高优先级规则也需检查。修改后清缓存并复测。
3. 为本站 HTML 添加响应头规则（规则表达式与现有规则冲突需先查看控制台）：
   - `X-Content-Type-Options: nosniff`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `X-Frame-Options: DENY`，或 CSP 的 `frame-ancestors 'none'`
   - `Content-Security-Policy` 可按 `frontend/index.html` 中现有策略配置，并补 `frame-ancestors 'none'`。先验证文章资源；meta 形式不支持该祖先限制。
4. 核对主域 HTTPS 正常后，可先用较短 `max-age` 启用 HSTS；是否覆盖全部子域或加入 preload 需另行确认。本次没有修改这些可能影响其他子域的选项。

这些项目依赖额外的 Cloudflare 设置权限。无需把新的高权限 Token 发到聊天中；可以由你在控制台完成，或之后确认采用相应管理方式。

## 验证证据与边界

- 8 项 Node/jsdom/Mock KV 回归测试通过，覆盖注入路径、中文媒体、公式/图片/Wikilink、笔记与日志错误、私有发布过滤、Worker 非法请求与限流。
- 发布目录中无隐藏路径，公开清单含 215 个资源、179 篇 Markdown；私有配置未被读取到发布副本。
- 已校验 PowerShell 语法，以及外部程序退出码非零会中止。Python 预处理现在跳过隐藏目录、node_modules 与链接。
- 新前端的线上 HTML、主要自有脚本与三个更新后的库经有效 HTTPS 校验，与发布副本逐字节一致；结果保存在 `logs/security-live-verification.json`。
- npm 审计在添加 Undici 覆盖后为 0；Wrangler 打包 dry-run 通过。未将旧 npm 镜像审计接口的 404 误当作无漏洞，本项目 `.npmrc` 已固定官方 registry。
- 未在真实访客浏览器运行恶意代码、执行压测或线上计数写入。jsdom 验证不等于完整真实浏览器兼容性测试。
- 线上替换前的十份公开文件备份保存在 Git 忽略的 `logs/oss-before-security-fix/`。本次没有删除任何 OSS 对象。
- 系统级 PHP 8.4.7 仍未替换，本站不使用 PHP；全局 PHP/Node 升级可能影响其他项目，应作为系统维护单独处理。本站构建已经使用修复后的独立 Node。
- 项目索引和 README 已更新。后续新聊天应重新读取 `.clinerules/` 的 2026-10-26 版本。

## Git 状态

当前环境无法创建 `.git/index.lock`（Permission denied），因此未暂存、未提交，也未尝试推送。网站前端已单独发布，不受此限制影响。请在项目根目录手动执行：

```powershell
git status --short
git rm --cached --ignore-unmatch scripts/.wrangler/cache/wrangler-account.json
git add --all
git diff --cached --check
git commit -m "Fix private data publishing and frontend security"
git push
```

`git rm --cached` 仅让已经跟踪的 Wrangler 账户缓存退出 Git，不删除本地缓存；新忽略规则会防止它再次提交。不要把 `.tools/`、`node_modules/`、`dist/`、`logs/` 或 Obsidian 私有目录强制加入 Git。
