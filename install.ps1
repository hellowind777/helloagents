# ─── HelloAGENTS Installer (Windows PowerShell) ───
# Usage:
#   irm https://raw.githubusercontent.com/hellowind777/helloagents/main/install.ps1 | iex
#
# Environment variables:
#   $env:HELLOAGENTS_BRANCH  — branch to install from (default: main)

$ErrorActionPreference = "Stop"

$Repo   = "https://github.com/hellowind777/helloagents"
$Branch = if ($env:HELLOAGENTS_BRANCH) { $env:HELLOAGENTS_BRANCH } else { "main" }

# ─── Helpers ───
# Locale detection: zh for Chinese, en otherwise
$UseZh = (Get-UICulture).Name -like "zh*"

function Msg { param([string]$Zh, [string]$En) if ($UseZh) { $Zh } else { $En } }
function Write-Info  { param([string]$Msg) Write-Host "[info]  $Msg" -ForegroundColor Cyan }
function Write-Ok    { param([string]$Msg) Write-Host "[ok]    $Msg" -ForegroundColor Green }
function Write-Warn  { param([string]$Msg) Write-Host "[warn]  $Msg" -ForegroundColor Yellow }
function Write-Err   { param([string]$Msg) Write-Host "[error] $Msg" -ForegroundColor Red; exit 1 }

# ─── Step 0: Detect git ───
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Err (Msg "需要 git，但未找到。请先安装 git。" "git is required but not found. Please install git first.")
}

# ─── Step 1: Detect Python ───
Write-Info (Msg "检测 Python..." "Detecting Python...")

$PythonCmd = $null
foreach ($cmd in @("python", "python3")) {
    try {
        $ver = & $cmd --version 2>&1
        if ($ver -match '(\d+)\.(\d+)') {
            $major = [int]$Matches[1]
            $minor = [int]$Matches[2]
            if ($major -gt 3 -or ($major -eq 3 -and $minor -ge 10)) {
                $PythonCmd = $cmd
                break
            }
        }
    } catch {
        continue
    }
}

if (-not $PythonCmd) {
    Write-Err (Msg "需要 Python >= 3.10，但未找到。请先安装 Python。" "Python >= 3.10 is required but not found. Please install Python first.")
}

$pyVer = & $PythonCmd --version 2>&1
Write-Ok (Msg "找到 $PythonCmd ($pyVer)" "Found $PythonCmd ($pyVer)")

# ─── Step 2: Detect uv ───
Write-Info (Msg "检查 uv..." "Checking for uv...")

$HasUv = $false
try {
    $uvVer = & uv --version 2>&1
    $HasUv = $true
    Write-Ok (Msg "找到 uv ($uvVer)" "Found uv ($uvVer)")
} catch {
    Write-Warn (Msg "未找到 uv，将使用 pip。" "uv not found, will fall back to pip.")
}

# ─── Step 3: Clean up corrupted pip remnants ───
$SitePackages = & $PythonCmd -c "import site; print(site.getsitepackages()[0])" 2>$null
if ($SitePackages -and (Test-Path $SitePackages)) {
    Get-ChildItem -Path $SitePackages -Directory -Filter "~elloagents*" -ErrorAction SilentlyContinue | ForEach-Object {
        Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
        Write-Info (Msg "已清理 pip 残留目录: $($_.Name)" "Cleaned up pip remnant: $($_.Name)")
    }
}

# ─── Step 4: Install ───
Write-Host ""
Write-Host (Msg "正在从分支 $Branch 安装 HelloAGENTS" "Installing HelloAGENTS from branch: $Branch") -ForegroundColor White

if ($HasUv) {
    Write-Info (Msg "使用 uv 安装..." "Installing with uv...")
    if ($Branch -eq "main") {
        & uv tool install --force --from "git+$Repo" helloagents
    } else {
        & uv tool install --force --from "git+$Repo@$Branch" helloagents
    }
} else {
    Write-Info (Msg "使用 pip 安装..." "Installing with pip...")
    if ($Branch -eq "main") {
        & $PythonCmd -m pip install --upgrade --no-cache-dir "git+$Repo.git"
    } else {
        & $PythonCmd -m pip install --upgrade --no-cache-dir "git+$Repo.git@$Branch"
    }
}

if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
    Write-Err (Msg "安装失败（退出码 $LASTEXITCODE）。" "Installation failed (exit code $LASTEXITCODE).")
}

# ─── Step 5: Verify ───
Write-Host ""
Write-Info (Msg "验证安装..." "Verifying installation...")

if (Get-Command helloagents -ErrorAction SilentlyContinue) {
    Write-Ok (Msg "helloagents 包已就绪！" "helloagents package is ready!")
} else {
    Write-Warn (Msg "helloagents 命令未在 PATH 中找到。" "helloagents command not found in PATH.")
    Write-Warn (Msg "可能需要重启终端或将安装路径加入 PATH。" "You may need to restart your terminal or add the install location to PATH.")
}

# ─── Step 6: Interactive target selection ───
Write-Host ""
Write-Host (Msg "✅ 第一步完成：helloagents 包下载成功。" "✅ Step 1 done: helloagents package installed.") -ForegroundColor Green
Write-Host (Msg "👉 第二步：选择要安装到的目标 CLI" "👉 Step 2: Select target CLIs to install to") -ForegroundColor White

try {
    Write-Host ""
    & helloagents
} catch {
    # helloagents not in PATH, skip interactive menu
}
