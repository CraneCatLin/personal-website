# WebsiteNote 安全核查报告

> 本文为修补前快照；后续修复与当前状态见 [安全修补记录](security-fix-2026-10-26.md)。

核查日期：2026-10-26（Asia/Shanghai）。对象：本地 WebsiteNote、网站 OSS 源站、cranecat.cn、阅读计数 Worker。

**结论：需要修补。最紧急的是已确认公开的 DeepSeek API Key，其次是 hash 路由的 DOM 注入问题。PHP/Node.js 的最新服务端漏洞没有直接对应到本站静态托管链路，但本地安装版本需要更新。**

本报告不包含密钥值，也不提供指向密钥文件的线上链接。密钥是否仍有效、是否已被第三方使用，未作验证；公开过的密钥应按已泄露处理。

## 1. 实际发布与访问链路

先读取了 `.clinerules/PROJECT_INDEX.md`、`prompt.md` 和 `.clineignore`，再核对部署、渲染、Worker 源码及线上响应。

```text
本地 Obsidian Vault = frontend/public/
  ├─ Markdown、图片等公开内容
  └─ .obsidian/、AI 插件配置与数据库等本地私有内容
          │
          ▼
update.ps1
  ├─ Python 原地处理 Markdown
  ├─ 系统 Node.js 生成目录树与全文索引
  ├─ git add / commit / push
  ├─ ossutil sync 整个 frontend/ 到 OSS（含 --delete）
  └─ 调用 Cloudflare 清缓存 API
          │
          ▼
OSS 静态网站托管 ← Cloudflare CDN ← 访客浏览器
                                    ├─ 浏览器渲染 Markdown / 数学公式
                                    └─ 独立访问 workers.dev 阅读计数 API

scripts/deploy-worker.ps1 → npx wrangler deploy → Cloudflare Worker + KV
```

关键边界：

- Node.js 用于本地构建和 Wrangler 工具，线上 HTML/JS/Markdown 由 OSS 静态返回。没有发现项目 PHP 文件或 PHP 部署步骤。
- 浏览器中的 JavaScript 库不属于 Node.js 服务端运行时，升级本机 Node.js 不会修复已发布的浏览器库。
- 当前 Worker 使用 Fetch / URL / Response / KV，没有导入 Node.js 模块；实际 `wrangler.toml` 也没有索引所述的 `nodejs_compat` 标志。不能将系统 Node.js 的 CVE 直接等同于该 Worker 受影响。[Cloudflare Node.js 兼容文档](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)
- Git 忽略、目录树隐藏、搜索排除均不构成上传过滤或访问控制。当前上传步骤直接读取物理目录。

## 2. PHP 与 Node.js 最新公告及适用性

以下以核查当日已发布的官方公告为准。

### PHP

2026-10-21 公告：CVE-2026-109618（OOM 清理期间内存损坏）、CVE-2026-109619（请求间残留状态），均可能导致未认证远程代码执行；修复版本为 **8.5.12 / 8.4.27 / 8.3.36 / 8.2.35**。主要适用对象是处理 Web 请求的 PHP 安装。[PHP 官方公告](https://www.php.net/archive/2026.php#2026-10-21-5)

2026-10-23 另有 CVE-2026-115560 的补充提示：特定会在运行时切换 session 序列化处理器的应用，仍需按公告关闭 `session.upload_progress.enabled`，后续常规版本将完整修复。它不意味着所有已更新 PHP 应用仍可被利用。[PHP 补充提示](https://www.php.net/archive/2026.php)

本机实测为 **PHP 8.4.7 CLI**，低于修复版本。本站未使用它处理访客请求，因此不将这些 CVE 判定为本站已存在的服务端漏洞。建议更新至至少 8.4.27；若其他项目使用该 PHP 提供 Web 服务，需立即独立处理其运行服务与补充缓解措施。

### Node.js

2026-10-21 官方安全发布涵盖：

| 等级 | CVE | 主要触发条件 |
| --- | --- | --- |
| 高 | CVE-2026-105482 | DNS 解析含 NUL 的攻击者可控主机名 |
| 高 | CVE-2026-105483、CVE-2026-106069 | 非标准 IP 表示导致 TLS 主机名校验问题 |
| 高 | CVE-2026-111497 | 解压攻击者提供的 Brotli 数据，可能内存破坏或代码执行 |
| 中 | CVE-2026-105481、CVE-2026-106072 | HTTP keep-alive 响应混淆、特殊 IP 证书校验 |
| 中 | CVE-2026-106074 | 构建快照/单文件应用后随机缓存重复 |
| 低 | CVE-2026-106070、CVE-2026-106071、CVE-2026-106073 | ZIP 校验、权限模型通配符或 realpath 检查 |

具体受影响分支与回归条件以各条公告为准，其中部分问题仅涉及 26.x。[Node.js 官方安全公告](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases)

本次对应修复版本为 **22.23.4 / 24.22.1 / 26.12.1**。本机独立 Node.js 实测 **24.11.1**，建议更新到同分支 **24.22.1 或更高安全版本**。[24.22.1 发布说明](https://nodejs.org/en/blog/release/v24.22.1)

本站两个构建脚本只导入 `fs`、`path`，不解析远程主机、不执行 Brotli 解压、不提供 Node.js HTTP 服务，未发现上述服务端攻击路径。Wrangler 等联网工具仍使用本地运行时，应随本机 Node.js 一并维护。Obsidian/Electron 自带的 Node.js 版本不在本次验证范围，升级独立 Node.js 不会自动升级它。

## 3. 已发现的问题

### S1 — 高：DeepSeek Key 与本地插件数据已公开，线上确认

证据：

- `update.ps1:52` 同步整个 `frontend/`，没有私有目录或依赖目录排除规则。
- `frontend/public/.obsidian/plugins/smart-composer/data.json` 存在 1 个非空 DeepSeek `apiKey`。
- 对该对象的匿名 OSS HTTPS GET 返回 200，6202 字节，内容与本地文件完全一致。
- 经系统 curl 校验证书的 Cloudflare HTTPS GET 同样返回 200，内容一致；没有使用跳过证书校验选项。
- `.smtcmp_vector_db.tar.gz` 的匿名 HEAD 返回 200，OSS 对象大小为 4,402,483 字节；未下载或解包数据库内容。
- OSS 桶 ACL 为 `public-read`，该配置对象 ACL 为 `default`；没有桶策略。静态数据的 AES256 存储加密不会阻止已获允许的匿名读取。

影响：该 Key 可被任何发现对象地址的人获取，可能导致额度消耗和对应 API 权限被使用；私有工作区与插件数据也不应发布。尚无证据证明已发生第三方滥用。

建议按顺序处理：

1. 在 DeepSeek 控制台撤销旧 Key、查看近期用量并生成新 Key，避免把新 Key 再次上传。
2. 将已上传的 `.obsidian/`、`.smtcmp_json_db/`、`.smtcmp_vector_db.tar.gz` 等私有对象隔离或移除，并清除 Cloudflare 对这些路径的缓存。对象修改或删除前先核对精确清单。
3. 发布独立、经过过滤的暂存目录，禁止包含隐藏目录、密钥文件、插件数据和 `node_modules/`；本地 Vault 保留原有内容。
4. 为发布增加阻断检查：发现私有路径或高置信密钥即中止上传。

**只增加 Git 忽略或 OSS 上传排除规则，不会自动清理已经公开的对象。只加 Cloudflare 路径拦截，也不能阻止匿名直连 OSS。**

### S2 — 高：hash 路由进入 innerHTML，形成 DOM XSS 攻击路径

位置：`frontend/script.js:82`、`:95`、`:102`、`:129`；`frontend/js/notes.js:33`、`:44`、`:55`；`frontend/js/log.js:245`。

路径：攻击者可构造 URL fragment → `decodeURIComponent` → 未核对公开文件清单 → 媒体预览或错误分支将路径直接插入 `innerHTML`。

在离线 VM 中执行了原始 `script.js`、`notes.js`，经真实 `loadFromHash()` 路由传入只设置测试标记的输入，生成的 HTML 保留攻击者提供的 `img` 与 `onerror` 属性。该路径不要求攻击者上传文件。线上实际引用的这两份脚本与本地逐字节一致。

这是源码与离线路由级验证，未在真实访客浏览器执行测试代码；浏览器自动化连接超时，故未声称完成浏览器执行验证。正常 HTML 解析下，事件处理属性可形成同源脚本执行。本站没有登录功能，不将其夸大成服务端接管或已发生账号失窃。

修补建议：

- 对解码后的 hash 做一次统一校验，限制到已发布的文件清单；拒绝控制字符、目录跳转和非法路径。
- 标题、错误文本使用 `textContent`；媒体和下载链接使用 DOM 属性赋值，避免字符串拼接 HTML 属性。
- 覆盖图片、视频、不支持文件、Markdown 加载失败、日志加载失败等所有分支。
- `escapeHtml()` 当前通过文本节点生成 HTML，适合文本上下文，不能默认认为它已完成引号属性上下文的安全处理。

### S3 — 中：已发布渲染库包含已知漏洞

**markdown-it 13.0.1：应更新。** 线上文件与本地一致，两个渲染器均启用 `html: true`、`linkify: true`、`typographer: true`，符合多条近期公告的配置条件。

| 公告 | 适用条件 | 对当前项目的判断 |
| --- | --- | --- |
| [GHSA-r7fv-28h4-cvq7 / CVE-2026-111759](https://github.com/markdown-it/markdown-it/security/advisories/GHSA-r7fv-28h4-cvq7) | smartquotes，typographer 开启 | 版本与选项符合 |
| [GHSA-6v5v-wf23-fmfq](https://github.com/markdown-it/markdown-it/security/advisories/GHSA-6v5v-wf23-fmfq) | smartquotes 字符串处理复杂度 | 版本与选项符合 |
| [GHSA-253c-mchw-3w2r](https://github.com/markdown-it/markdown-it/security/advisories/GHSA-253c-mchw-3w2r) | linkify 开启 | 版本落入公告范围，旧版本每一条路径未逐项复现 |
| [GHSA-vfgh-jcmw-g37q / CVE-2026-111766](https://github.com/markdown-it/markdown-it/security/advisories/GHSA-vfgh-jcmw-g37q) | 内联 HTML，html 开启 | 版本与选项符合 |

离线限制规模测试：24,000 字节的 smartquotes 输入，在当前全部选项开启时约 42.7 ms，关闭相关选项的对照约 0.34 ms；这是一次有界样本，不能用它推断线上容量。没有向线上提交 DoS 输入。

此处渲染发生在访客浏览器，主要风险是恶意或异常笔记令页面卡顿；本站没有匿名上传 Markdown 的接口。不能据此宣称攻击者可直接使 OSS 或 Node.js 服务器宕机。

建议升级到至少 **14.3.3**，或兼容验证后的 **15.0.3**，回归公式、图片、代码、Wikilink 和日志。仅在渲染完成后消毒 HTML 不能消除解析阶段的复杂度问题。

**KaTeX 0.16.11：需要安排升级，但当前未证明相关 XSS 可独立触发。** 线上完整文件与本地一致。

- [CVE-2025-23207 / GHSA-cg87-wmx4-v546](https://github.com/KaTeX/KaTeX/security/advisories/GHSA-cg87-wmx4-v546)：0.16.21 修复 `htmlData` 属性问题；本站未启用 `trust`，这是公告列出的缓解条件。
- [GHSA-238p-pmpm-9mq7](https://github.com/KaTeX/KaTeX/security/advisories/GHSA-238p-pmpm-9mq7)：0.18.2 修复已有原型污染被利用的问题；需要上游原型污染前提，本次未发现该前提。建议验证后更新至至少 0.18.2，配套更新 CSS 与字体。

highlight.js 11.9.0、Fuse.js 7.0.0 均已识别；所查 highlight.js 官方公告中的旧版已知漏洞范围不应误报给 11.9.0。没有依赖清单和完整锁文件管理这些静态库，不能以 `npm audit` 无结果替代浏览器资产核查。[highlight.js 安全说明](https://github.com/highlightjs/highlight.js/security)

### S4 — 中：HTTP 未升级 HTTPS，主要安全响应头缺失

系统 curl 对 `http://cranecat.cn/` 返回 200，没有重定向到 HTTPS。经有效证书校验的 HTTPS 首页 200 响应中未见：

- `Content-Security-Policy`
- `Strict-Transport-Security`
- `X-Content-Type-Options`
- `Referrer-Policy`
- `X-Frame-Options` 或 CSP `frame-ancestors`

建议在 Cloudflare 配置 HTTP → HTTPS，并在检查子域影响后启用合适的 HSTS；配置响应头规则与 CSP，限制脚本、嵌入、对象和基准 URL，同时允许阅读计数 Worker、笔记资源、KaTeX 必需样式。先核对兼容性，特别是 404 页的内联脚本和笔记中的 HTML。OSS 部署并不会自动理解 Cloudflare Pages 的 `_headers` 文件。

Python TLS 校验曾报告过期，但系统 curl 的完整 HTTPS 请求返回 `VERIFY=0`，检测到的叶证书有效期为 2026-10-12 至 2027-01-10。两种客户端结果不同，**不据此认定网站证书已过期**；证书链/客户端信任差异仍可另查。

### S5 — 中：阅读计数接口缺少代码层的滥用约束

`scripts/counter-worker.js:34` 只检查 `path` 存在且以 `.md` 结尾；`:63` 的 POST 随即读写 KV。代码未核对 `/pv` 路由、真实笔记清单、路径长度、来源或请求频率。

离线 Mock KV 验证表明：无身份凭据、无关 Origin、非 `/pv` 路由和不存在的笔记名，也可走到写入并返回 200。没有对线上执行 POST 或创建测试 KV key。早期线上 GET 返回 200/count 0，后续部分网络请求超时。

匿名阅读计数是预期功能；风险是刷计数、制造大量 key、消耗配额，并非 CORS `*` 本身自动构成高危漏洞。尚未取得 Cloudflare 部署规则权限，不能断言平台完全没有额外限流。

建议增加精确路由、允许的方法、公开路径清单、字节长度上限、应用层限流/去重及错误处理。限制 Origin 可减少普通浏览器跨站调用，但不能替代限流或防机器人措施。`KV.get → put` 不具备原子自增保证，计数准确性也有局限。[Workers KV 写入说明](https://developers.cloudflare.com/kv/api/write-key-value-pairs/)

### S6 — 中：发布失败仍继续，清缓存请求体被重复编码

`update.ps1:64` 对一个已包含 JSON 文本的字符串再次执行 `ConvertTo-Json`。离线验证所得请求体是 **JSON 字符串**，解析类型为 `String`，而不是含布尔字段的 JSON 对象。

Cloudflare 文档要求 JSON 对象形式。应改为：

```diff
-    $purgeBody = '{"purge_everything": true}' | ConvertTo-Json -Compress
+    $purgeBody = @{ purge_everything = $true } | ConvertTo-Json -Compress
```

[Cloudflare 清缓存文档](https://developers.cloudflare.com/cache/how-to/purge-cache/purge-everything/)

此外，预处理、索引生成、`git push`、OSS 同步之后均未系统检查退出码；即使步骤失败，流程可能继续并最终显示“所有操作完成”。修复安全文件后也可能因此误认为已经成功发布或清缓存。

建议以脚本自身目录为工作目录、校验配置、每一步失败立即停止，在上传前审查发布清单和删除范围，并在完成后核验源站与 CDN 的关键文件及敏感路径。

### S7 — 架构边界：源站可直连，Cloudflare 策略不能保护所有入口

匿名 OSS HTTP/HTTPS 均可读取公开对象，未设置桶策略，防盗链允许空 Referer；这是此次密钥暴露的第二个独立入口。

公开静态网站使用 `public-read` 可以是有意设计，不必为了修复本次泄露直接把全桶改为 private 而令站点中断。首先保证桶内只有可公开发布的资产。如果将来依赖 Cloudflare 对某些内容鉴权或强制安全策略，则需设计可验证的私有源站/签名回源等方案，不能只在 CDN 加规则，也不能将 Referer 当作身份认证。

OSS 当前访问日志未启用，版本控制查询也未返回启用状态；本次无法追溯谁读取过已暴露的 Key。建议在明确成本与保留周期后安排访问日志、用量告警和可恢复发布备份。

### S8 — 低至中：工具与静态依赖的可复现性不足

`scripts/deploy-worker.ps1:14` 使用未锁定版本的 `npx --yes wrangler deploy`，会依赖执行时的包解析结果。建议固定已核查版本与锁文件，保留已发布浏览器库的版本/哈希清单。没有发现恶意包的证据，不将未锁版本本身认定为已遭供应链攻击。

`frontend/node_modules/` 也位于当前上传根内，其中有浏览器 MCP 工具包；页面没有引用它，不应随站点发布。此项与 S1 的发布目录隔离一并处理。

## 4. 修补与验收顺序

| 顺序 | 工作 | 验收条件 |
| --- | --- | --- |
| 立即 | 撤销公开的 DeepSeek Key、查用量 | 旧 Key 已撤销；新 Key 只在本地/安全凭据位置保存 |
| 1 | 阻断私有文件发布，处理既有公开对象及缓存 | OSS 与 Cloudflare 的私有路径均不再返回私有内容；本地 Vault 完整 |
| 2 | 修复 hash 与所有 HTML 注入分支 | 无效媒体、未知类型、失败 Markdown/日志路径均安全显示文本；正常中文路径及资源可用 |
| 3 | 升级 markdown-it、KaTeX | 版本/哈希可核实；公式、日志、图片、Wikilink、搜索回归通过 |
| 4 | 修正发布失败处理与清缓存请求 | 故障即中止；缓存请求是对象；源站/CDN 与本地关键文件一致 |
| 5 | HTTPS、安全头、Worker 防滥用 | HTTP 重定向；正常页面带预期头；接口拒绝非法输入且有配额保护 |
| 6 | 升级本地 Node/PHP、锁工具版本 | Node 至少 24.22.1；PHP 至少 8.4.27；工具版本固定 |

未执行上述修补、凭据撤销、远程删除或部署。本次新增的只有本报告，没有业务代码/云配置更改。

## 5. 检查范围与限制

- 核对了部署脚本、构建入口、主要渲染模块、静态库版本、Worker 源码、桶权限/静态托管/日志/防盗链配置及代表性线上 GET/HEAD。
- 对 207 个限定大小与类型的本地文本文件做了常见高置信密钥模式扫描，仅发现上述 DeepSeek Key 候选；这不是所有秘密格式、二进制、数据库和 Git 历史的完整扫描。
- `.git/config`、`.env`、`config.ps1` 的网站 HTTPS 请求返回 404。当前 Git 文件列表未跟踪 `config.ps1` 和 Obsidian 私有目录；对 `config.ps1`、`.env` 的历史路径查询未返回记录。不能推广为整个仓库历史绝无秘密。
- 当前搜索索引未发现隐藏路径条目；这不影响已公开源对象的结论。
- 未证实匿名列桶：测试请求返回首页 HTML，不能把 200 等同于列桶权限。没有做匿名写入测试；桶 ACL 为 public-read，未发现公开写入配置。
- 本地 Cloudflare Token 验证为 active，但读取 zone settings / rulesets / DNS 均返回 403。未审计账户级权限、全部 WAF/缓存规则、回源 TLS 模式、所有 DNS 或审计日志；不需要为完成当前修补盲目扩大 Token 权限。
- 未调用第三方模型 API 测试泄露 Key，也未执行线上恶意脚本、漏洞利用、压测、KV 写入、Cloudflare 清缓存或 OSS 删除。
- 本地 VM 只运行仓库原始渲染逻辑和有界测试；没有将 VM 当作不可信代码的安全沙箱。

## 6. 项目索引更正提案（尚未应用）

现有索引将 Worker 配置标志、错误降级与实际发布边界描述得过于理想化。建议先更正事实；修补后的流程应在落地时再同步更新，并记录更新时间与变更摘要。

```diff
## 3.2 scripts/counter-worker.js
- 错误处理：KV 读写失败时返回 count: -1，前端友好降级
+ 当前 Worker 未捕获 KV 异常；前端在网络失败或非成功状态时返回 -1 并降级显示。

## 3.2 scripts/wrangler.toml
- compatibility_flags = ["nodejs_compat"] — Node.js 兼容模式
- route — 路由绑定到 pv-counter.cranecat.workers.dev/pv（或 cranecat.cn/api/pv）
+ 当前配置为 compatibility_date = "2024-01-01"，无 compatibility_flags 或显式 route。
+ 前端请求 workers.dev 的 /pv；处理器当前未限制 pathname。

## 3.3 update.ps1 / 第 4 节数据流
- ossutil sync ./frontend/ → OSS 桶
+ 当前直接同步整个 frontend/，不会应用 Git 忽略或目录树过滤；Vault 私有数据和 node_modules 也在上传范围。
+ 修补后应在此记录实际发布暂存目录、过滤/阻断规则、失败处理和上线核验步骤。
```

## 7. 关键已发布文件校验基线

以下文件通过完整 HTTPS GET 与本地内容一致；供后续修补复核，不代表安全版本。

| 文件 | SHA-256 |
| --- | --- |
| frontend/script.js | `653c666e11fecc9b81c18821862ff74bdee07d4e974305d75a5741ceb72fa23f` |
| frontend/js/notes.js | `e69f56a801affe9d4e7f839dbb1d70a4f0562c3a23108a3ec7f235e2043e7471` |
| frontend/js/log.js | `55d6333659ccb4e915fe64cd4b89137044ff06c8f5c4e6eed79026eed7fa9cf9` |
| frontend/libs/js/markdown-it.min.js | `d725d1cce2bb4df1e2953690dbb922a1c0692397e5e3ae2b97170a567147e4d7` |
| frontend/libs/js/katex.min.js | `72f9109f21ee43362abeee6953be446a2ee55a5e8e277562a0c01b107983eac4` |
