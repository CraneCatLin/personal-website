#导入配置文件（如果存在）
$configFile = "./config.ps1"
if (Test-Path $configFile) {
    . $configFile
} else {
    Write-Host "警告：未找到配置文件 config.ps1"
}

Write-Host "========================================"
Write-Host "选择提交模式："
Write-Host "  1 - 自动生成提交信息：当前日期 note update"
Write-Host "  2 - 手动输入提交信息"
$mode = Read-Host "请输入 1 或 2"

python ./scripts/addLine.py > ./logs/addLine.log
python ./scripts/gatherToAligned.py > ./logs/gatherToAligned.log
python ./scripts/add_line_breaks.py > ./logs/add_line_breaks.log
node ./scripts/generate-tree.js > ./logs/generate-tree.log
node ./scripts/generate-search-index.js > ./logs/generate-search-index.log
# 根据模式获取提交信息
if ($mode -eq "1") {
    $commitMsg = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') note update"
    Write-Host "自动生成的信息：$commitMsg"
} elseif ($mode -eq "2") {
    $commitMsg = Read-Host "请输入提交信息"
} else {
    Write-Host "错误：无效输入，请运行脚本并输入 1 或 2。"
    exit 1
}

# 执行 Git 命令
Write-Host "----------------------------------------"
Write-Host "执行 git add ."
git add .

Write-Host "执行 git commit -m `"$commitMsg`""
git commit -m "$commitMsg"
if ($LASTEXITCODE -ne 0) {
    Write-Host "提示：git commit 可能没有更改需要提交，继续执行后续命令..."
}

Write-Host "执行 git push"
git push

# 部署 Worker（访问次数计数器）
Write-Host "----------------------------------------"
Write-Host "部署 Worker（页面访问计数）..."
try {
    $workerDir = Join-Path $PSScriptRoot "scripts"
    Push-Location $workerDir
    & npx --yes wrangler deploy 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠ Worker 部署可能失败，请检查 wrangler 配置"
    } else {
        Write-Host "✓ Worker 部署完成（pv-counter）"
    }
    Pop-Location
} catch {
    Write-Host "⚠ Worker 部署出错: $_"
    Write-Host "    跳过 Worker 部署，继续执行后续步骤..."
}

# 执行 OSS 同步
Write-Host "----------------------------------------"
if (-not $OSS_BUCKET_URL) {
    Write-Host "错误：未设置 OSS_BUCKET_URL，请检查 config.ps1 配置文件"
    exit 1
}
Write-Host "执行 ossutil sync ./frontend/ $OSS_BUCKET_URL --update --delete"
ossutil sync ./frontend/ $OSS_BUCKET_URL --update --delete

# ========== 新增：刷新 Cloudflare 缓存 ==========
Write-Host "----------------------------------------"
Write-Host "刷新 Cloudflare 缓存..."

# 从配置文件读取（需要在 config.ps1 中添加这两个变量）
if (-not $CF_ZONE_ID) {
    Write-Host "警告：未设置 CF_ZONE_ID，跳过缓存刷新"
} elseif (-not $CF_API_TOKEN) {
    Write-Host "警告：未设置 CF_API_TOKEN，跳过缓存刷新"
} else {
    $purgeBody = '{"purge_everything": true}' | ConvertTo-Json -Compress
    
    try {
        $response = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/purge_cache" `
            -Method POST `
            -Headers @{
                "Authorization" = "Bearer $CF_API_TOKEN"
                "Content-Type"  = "application/json"
            } `
            -Body $purgeBody `
            -ErrorAction Stop
        
        if ($response.success -eq $true) {
            Write-Host "✓ Cloudflare 缓存已刷新（全站）"
        } else {
            Write-Host "✗ 缓存刷新失败：$($response.errors | ConvertTo-Json)"
        }
    } catch {
        Write-Host "✗ 请求失败：$_"
    }
}

Write-Host "========================================"
Write-Host "所有操作完成。"