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
function Write-Info  { param([string]$Msg) Write-Host "[info]  $Msg" -ForegroundColor Cyan }
function Write-Ok    { param([string]$Msg) Write-Host "[ok]    $Msg" -ForegroundColor Green }
function Write-Warn  { param([string]$Msg) Write-Host "[warn]  $Msg" -ForegroundColor Yellow }
function Write-Err   { param([string]$Msg) Write-Host "[error] $Msg" -ForegroundColor Red; exit 1 }

# ─── Step 1: Detect Python ───
Write-Info "Detecting Python..."

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
    Write-Err "Python >= 3.10 is required but not found. Please install Python first."
}

$pyVer = & $PythonCmd --version 2>&1
Write-Ok "Found $PythonCmd ($pyVer)"

# ─── Step 2: Detect uv ───
Write-Info "Checking for uv..."

$HasUv = $false
try {
    $uvVer = & uv --version 2>&1
    $HasUv = $true
    Write-Ok "Found uv ($uvVer)"
} catch {
    Write-Warn "uv not found, will fall back to pip."
}

# ─── Step 3: Install ───
Write-Host ""
Write-Host "Installing HelloAGENTS from branch: $Branch" -ForegroundColor White

if ($HasUv) {
    Write-Info "Installing with uv..."
    if ($Branch -eq "main") {
        & uv tool install --force --from "git+$Repo" helloagents
    } else {
        & uv tool install --force --from "git+$Repo@$Branch" helloagents
    }
} else {
    Write-Info "Installing with pip..."
    if ($Branch -eq "main") {
        & $PythonCmd -m pip install --upgrade "git+$Repo.git"
    } else {
        & $PythonCmd -m pip install --upgrade "git+$Repo.git@$Branch"
    }
}

if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
    Write-Err "Installation failed (exit code $LASTEXITCODE)."
}

# ─── Step 4: Verify ───
Write-Host ""
Write-Info "Verifying installation..."

try {
    & helloagents version 2>&1 | Out-Null
    Write-Ok "helloagents installed successfully!"
    & helloagents version
} catch {
    Write-Warn "helloagents command not found in PATH."
    Write-Warn "You may need to restart your terminal or add the install location to PATH."
}

# ─── Done ───
Write-Host ""
Write-Host "Installation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "  helloagents install codex      # sync rules to Codex CLI"
Write-Host "  helloagents install claude     # sync rules to Claude Code"
Write-Host "  helloagents install --all      # sync rules to all detected CLIs"
Write-Host ""
Write-Host "  helloagents status             # check installation status"
Write-Host "  helloagents update             # update to latest version"
Write-Host ""
