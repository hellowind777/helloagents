# HelloAGENTS 一键安装脚本（Windows PowerShell 5.1 及以上）。
# 环境变量：
#   HELLOAGENTS_HOSTS   目标宿主，逗号分隔（claude,codex,grok,cursor,hermes），默认 all
#   HELLOAGENTS_METHOD  安装方式：inject 或 plugin，默认由各宿主自动选择
#   HELLOAGENTS_VERSION npm 版本标签，默认 latest
$ErrorActionPreference = 'Stop'

$version = if ($env:HELLOAGENTS_VERSION) { $env:HELLOAGENTS_VERSION } else { 'latest' }
$hosts = if ($env:HELLOAGENTS_HOSTS) { $env:HELLOAGENTS_HOSTS } else { 'all' }
$method = $env:HELLOAGENTS_METHOD

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error '未找到 Node.js，请先安装 Node.js 20.19 或更高版本。Node.js not found; install Node.js 20.19 or newer first.'
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error '未找到 npm，请确认 Node.js 安装完整。npm not found; make sure Node.js is installed completely.'
}

Write-Host "安装 helloagents@$version …"
npm install -g "helloagents@$version"
if ($LASTEXITCODE -ne 0) { Write-Error "npm install 失败，退出码 $LASTEXITCODE"; exit 1 }

$arguments = @('install')
if ($hosts -eq 'all') {
    $arguments += '--all'
} else {
    foreach ($item in $hosts -split ',') {
        $trimmed = $item.Trim()
        if ($trimmed) { $arguments += $trimmed }
    }
}
if ($method -eq 'inject') { $arguments += '--inject' }
elseif ($method -eq 'plugin') { $arguments += '--plugin' }
elseif ($method) { Write-Error "HELLOAGENTS_METHOD 只接受 inject 或 plugin，当前值：$method"; exit 1 }

helloagents @arguments
if ($LASTEXITCODE -ne 0) { Write-Error "helloagents install 失败，退出码 $LASTEXITCODE" }
helloagents doctor
