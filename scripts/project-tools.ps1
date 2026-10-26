# 本项目优先使用已修复的独立 Node；不会改写系统 PATH 或 Obsidian 安装。
function Get-ProjectNode {
    $projectRoot = Split-Path -Parent $PSScriptRoot
    $portableNode = Join-Path $projectRoot '.tools/node-v24.22.1-win-x64/node.exe'
    if (Test-Path -LiteralPath $portableNode) { return $portableNode }
    $nodeCommand = Get-Command node -ErrorAction Stop
    $versionText = & $nodeCommand.Source --version
    $version = [version]($versionText.TrimStart('v'))
    $supported = ($version.Major -eq 24 -and $version -ge [version]'24.22.1') -or
        ($version.Major -eq 26 -and $version -ge [version]'26.12.1')
    if ($LASTEXITCODE -ne 0 -or -not $supported) {
        throw '请先运行 powershell -File scripts/setup-tools.ps1 安装项目专用的安全 Node.js，或更新系统 Node.js。'
    }
    return $nodeCommand.Source
}

function Invoke-CheckedCommand {
    param([string]$Command, [string[]]$Arguments, [string]$LogPath)
    if ($LogPath) { & $Command @Arguments *> $LogPath }
    else { & $Command @Arguments }
    if ($LASTEXITCODE -ne 0) { throw "步骤失败（退出码 $LASTEXITCODE）：$Command；请检查对应日志。" }
}
