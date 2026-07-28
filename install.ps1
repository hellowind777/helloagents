# HelloAGENTS 一键安装脚本（Windows PowerShell 5.1 及以上）。
# 环境变量：
#   HELLOAGENTS_HOSTS     目标宿主，逗号分隔（claude,codex,grok,cursor,hermes），默认 all
#   HELLOAGENTS_METHOD    安装方式：standard 或 global，默认由各宿主自动选择
#   HELLOAGENTS_VERSION   npm 版本标签，默认 latest（npm 来源时生效）
#   HELLOAGENTS_SOURCE    安装来源：npm 或 git，默认 npm
#   HELLOAGENTS_BRANCH    Git 分支（git 来源时生效），默认 main
#   HELLOAGENTS_GIT_URL   Git 远程地址（git 来源时生效），默认官方仓库
$ErrorActionPreference = 'Stop'

$version  = if ($env:HELLOAGENTS_VERSION)  { $env:HELLOAGENTS_VERSION }  else { 'latest' }
$hosts    = if ($env:HELLOAGENTS_HOSTS)    { $env:HELLOAGENTS_HOSTS }    else { 'all' }
$method   = $env:HELLOAGENTS_METHOD
$source   = if ($env:HELLOAGENTS_SOURCE)   { $env:HELLOAGENTS_SOURCE }   else { 'npm' }
$branch   = if ($env:HELLOAGENTS_BRANCH)   { $env:HELLOAGENTS_BRANCH }   else { 'main' }
$gitUrl   = if ($env:HELLOAGENTS_GIT_URL)  { $env:HELLOAGENTS_GIT_URL }  else { 'https://github.com/hellowind777/helloagents.git' }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error '未找到 Node.js，请先安装 Node.js 20.19 或更高版本。Node.js not found; install Node.js 20.19 or newer first.'
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error '未找到 npm，请确认 Node.js 安装完整。npm not found; make sure Node.js is installed completely.'
}

if ($source -eq 'git') {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        Write-Error 'HELLOAGENTS_SOURCE=git 但未找到 Git。请先安装 Git 或改用 npm 来源。'
    }
    $sourceDir = "$env:USERPROFILE\.helloagents\source"
    if (Test-Path "$sourceDir\.git") {
        Write-Host "更新已有仓库（分支：$branch）…"
        git -C $sourceDir fetch origin $branch
        if ($LASTEXITCODE -ne 0) { Write-Error "git fetch 失败" }
        git -C $sourceDir checkout $branch
        git -C $sourceDir reset --hard "origin/$branch"
        if ($LASTEXITCODE -ne 0) { Write-Error "git checkout/reset 失败" }
    } else {
        Write-Host "克隆仓库（分支：$branch）…"
        New-Item -ItemType Directory -Path $sourceDir -Force | Out-Null
        git clone --branch $branch --single-branch $gitUrl $sourceDir
        if ($LASTEXITCODE -ne 0) { Write-Error "git clone 失败" }
    }
    Write-Host "通过 npm 链接本地仓库…"
    npm install -g $sourceDir
    if ($LASTEXITCODE -ne 0) { Write-Error "npm install 失败，退出码 $LASTEXITCODE"; exit 1 }
} else {
    Write-Host "安装 helloagents@$version …"
    npm install -g "helloagents@$version"
    if ($LASTEXITCODE -ne 0) { Write-Error "npm install 失败，退出码 $LASTEXITCODE"; exit 1 }
}

$arguments = @('install')
if ($hosts -eq 'all') {
    $arguments += '--all'
} else {
    foreach ($item in $hosts -split ',') {
        $trimmed = $item.Trim()
        if ($trimmed) { $arguments += $trimmed }
    }
}
if ($method -eq 'standard') { $arguments += '--standard' }
elseif ($method -eq 'global')  { $arguments += '--global' }
elseif ($method) {
    # 兼容旧版环境变量值
    if ($method -eq 'inject') { $arguments += '--standard' }
    elseif ($method -eq 'plugin') { $arguments += '--global' }
    else { Write-Error "HELLOAGENTS_METHOD 只接受 standard 或 global，当前值：$method"; exit 1 }
}

helloagents @arguments
if ($LASTEXITCODE -ne 0) { Write-Error "helloagents install 失败，退出码 $LASTEXITCODE" }
helloagents doctor
