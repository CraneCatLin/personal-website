param(
    [switch]$SkipGit,
    [switch]$BuildOnly,
    [string]$Message
)

$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
Push-Location $projectRoot
try {
    . (Join-Path $projectRoot 'scripts/project-tools.ps1')
    $node = Get-ProjectNode
    $env:Path = (Split-Path -Parent $node) + [IO.Path]::PathSeparator + $env:Path
    New-Item -ItemType Directory -Path (Join-Path $projectRoot 'logs') -Force | Out-Null

    if (-not $BuildOnly) {
        $configFile = Join-Path $projectRoot 'config.ps1'
        if (-not (Test-Path -LiteralPath $configFile)) { throw '缺少 config.ps1。' }
        . $configFile
        if ($OSS_BUCKET_URL -notmatch '^oss://[a-z0-9][a-z0-9-]+/?$') { throw 'OSS_BUCKET_URL 必须指向已确认的网站桶根目录。' }
    }

    if (-not $SkipGit -and -not $BuildOnly -and -not $Message) {
        Write-Host '选择提交模式：1 自动提交信息；2 手动输入'
        $mode = Read-Host '请输入 1 或 2'
        if ($mode -eq '1') { $Message = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') note update" }
        elseif ($mode -eq '2') { $Message = Read-Host '请输入提交信息' }
        else { throw '提交模式无效，已停止。' }
    }

    Invoke-CheckedCommand python @('scripts/addLine.py') 'logs/addLine.log'
    Invoke-CheckedCommand python @('scripts/gatherToAligned.py') 'logs/gatherToAligned.log'
    Invoke-CheckedCommand python @('scripts/add_line_breaks.py') 'logs/add_line_breaks.log'
    Invoke-CheckedCommand python @('scripts/vendor-assets.py') 'logs/vendor-assets.log'
    Invoke-CheckedCommand $node @('scripts/generate-tree.js') 'logs/generate-tree.log'
    Invoke-CheckedCommand $node @('scripts/generate-search-index.js') 'logs/generate-search-index.log'
    Invoke-CheckedCommand $node @('scripts/prepare-publish.js') 'logs/prepare-publish.log'
    if ($BuildOnly) { Write-Host '公开发布副本已生成：dist/site/'; return }

    if (-not $SkipGit) {
        Invoke-CheckedCommand git @('add', '--all')
        & git diff --cached --quiet
        if ($LASTEXITCODE -eq 1) { Invoke-CheckedCommand git @('commit', '-m', $Message) }
        elseif ($LASTEXITCODE -ne 0) { throw '无法检查 Git 暂存状态。' }
        Invoke-CheckedCommand git @('push')
    }

    $excludes = & $node scripts/prepare-publish.js --oss-excludes | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { throw '无法读取发布过滤规则。' }
    $syncArguments = @('sync', './dist/site/', $OSS_BUCKET_URL, '--update', '--delete')
    foreach ($pattern in $excludes) { $syncArguments += @('--exclude', $pattern) }
    Invoke-CheckedCommand ossutil $syncArguments
    foreach ($entry in @('index.html', '404.html', 'tree.json', 'tree-log.json', 'search-index.json', 'public-files.json')) {
        $objectUrl = $OSS_BUCKET_URL.TrimEnd('/') + '/' + $entry
        Invoke-CheckedCommand ossutil @('set-props', $objectUrl, '--cache-control', 'no-cache', '--metadata-directive', 'update', '--force')
    }

    if (-not $CF_ZONE_ID -or -not $CF_API_TOKEN) { throw 'OSS 上传完成，但缺少 Cloudflare 清缓存配置；请补全后刷新缓存。' }
    $purgeBody = @{ purge_everything = $true } | ConvertTo-Json -Compress
    $response = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/purge_cache" `
        -Method POST -Headers @{ Authorization = "Bearer $CF_API_TOKEN" } `
        -ContentType 'application/json' -Body $purgeBody -ErrorAction Stop
    if (-not $response.success) { throw 'OSS 上传完成，但 Cloudflare 清缓存失败。' }
    Write-Host '公开文件已发布，Cloudflare 缓存已刷新。Obsidian 私有数据未上传。'
} catch {
    Write-Error "发布已停止：$($_.Exception.Message)"
    exit 1
} finally {
    Pop-Location
}
