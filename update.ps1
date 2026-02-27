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

# 执行 OSS 同步
Write-Host "----------------------------------------"
if (-not $OSS_BUCKET_URL) {
    Write-Host "错误：未设置 OSS_BUCKET_URL，请检查 config.ps1 配置文件"
    exit 1
}
Write-Host "执行 ossutil sync ./frontend/ $OSS_BUCKET_URL --update --delete"
ossutil sync ./frontend/ $OSS_BUCKET_URL --update --delete

Write-Host "========================================"
Write-Host "所有操作完成。"