# ========================================
#  一次性部署：Cloudflare Worker（页面访问次数计数器）
#  此脚本只需运行一次，Worker 部署后永久生效
# ========================================

Write-Host "========================================"
Write-Host "部署 Cloudflare Worker（pv-counter）"
Write-Host "========================================"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $scriptDir

try {
    & npx --yes wrangler deploy 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ 部署失败，请检查 wrangler 配置"
        Write-Host "  常见问题："
        Write-Host "    1. 是否已运行 'wrangler login'？"
        Write-Host "    2. wrangler.toml 中的 KV 命名空间 ID 是否正确配置？"
        Write-Host "    3. 网络连接是否正常？"
        exit 1
    } else {
        Write-Host "========================================"
        Write-Host "✓ Worker 部署完成！"
        Write-Host "========================================"
        Write-Host "Worker 名称：pv-counter"
        Write-Host "API 地址：https://pv-counter.cranecat.workers.dev/pv"
        Write-Host ""
        Write-Host "之后每次运行 update.ps1 时不会再重复部署，计数服务持续可用。"
    }
} catch {
    Write-Host "✗ 部署出错: $_"
    exit 1
} finally {
    Pop-Location
}