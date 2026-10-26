# 从 Node.js 官方站点下载固定版本，校验官方 SHA256；仅安装到本仓库 .tools/。
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$versionName = 'node-v24.22.1-win-x64'
$toolsDir = Join-Path $projectRoot '.tools'
$nodePath = Join-Path $toolsDir "$versionName/node.exe"
if (-not (Test-Path -LiteralPath $nodePath)) {
    New-Item -ItemType Directory -Path $toolsDir -Force | Out-Null
    $archive = Join-Path $toolsDir "$versionName.zip"
    $baseUrl = 'https://nodejs.org/dist/v24.22.1'
    Invoke-WebRequest "$baseUrl/$versionName.zip" -OutFile $archive -UseBasicParsing
    $checksums = (Invoke-WebRequest "$baseUrl/SHASUMS256.txt" -UseBasicParsing).Content
    $checksumLine = ($checksums -split "`n" | Where-Object { $_.Trim().EndsWith(" $versionName.zip") })
    if (@($checksumLine).Count -ne 1) { throw '官方校验清单中没有唯一匹配的 Node 安装包。' }
    $expected = ($checksumLine.Trim() -split '\s+')[0]
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $expected) { throw 'Node 安装包 SHA256 校验失败。' }
    Expand-Archive -LiteralPath $archive -DestinationPath $toolsDir -Force
    Remove-Item -LiteralPath $archive
}
& $nodePath --version
if ($LASTEXITCODE -ne 0) { throw '项目 Node 无法启动。' }
Write-Host '项目 Node 已就绪；系统 Node、Obsidian 和全局 PATH 未改动。'
