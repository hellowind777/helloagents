# HelloAGENTS one-shot installer.
#
# Environment:
#   HELLOAGENTS=all|claude|gemini|codex|cursor|grok[:standby|global]
#   HELLOAGENTS_ACTION=install|update|cleanup|uninstall|switch-branch|branch
#   HELLOAGENTS_TARGET=all|claude|gemini|codex|cursor|grok
#   HELLOAGENTS_MODE=standby|global
#   HELLOAGENTS_BRANCH=main|beta|...
#   HELLOAGENTS_PACKAGE=helloagents|https://github.com/owner/repo/archive/refs/heads/ref.tar.gz|...

$ErrorActionPreference = "Stop"

$Action = if ($env:HELLOAGENTS_ACTION) { $env:HELLOAGENTS_ACTION } else { "install" }
$Target = if ($env:HELLOAGENTS_TARGET) { $env:HELLOAGENTS_TARGET } else { "" }
$Mode = if ($env:HELLOAGENTS_MODE) { $env:HELLOAGENTS_MODE } else { "" }
$Branch = if ($env:HELLOAGENTS_BRANCH) { $env:HELLOAGENTS_BRANCH } else { "" }
$Package = if ($env:HELLOAGENTS_PACKAGE) { $env:HELLOAGENTS_PACKAGE } else { "" }
$HasExplicitPackage = [bool]$Package
$HasExplicitTarget = $false

if ($env:HELLOAGENTS) {
    $Parts = $env:HELLOAGENTS.Split(":", 2)
    if (-not $Parts[0]) {
        throw "HELLOAGENTS must be target[:mode], for example codex:global"
    }
    if (-not $Target) { $Target = $Parts[0] }
    if (-not $Mode -and $Parts.Count -gt 1) { $Mode = $Parts[1] }
}

$HasExplicitTarget = [bool]$Target

if (-not $Target) { $Target = "all" }
$Target = $Target.ToLowerInvariant()
if ($Mode) { $Mode = $Mode.ToLowerInvariant() }

if (@("all", "claude", "gemini", "codex", "cursor", "grok") -notcontains $Target) {
    throw "Unsupported HELLOAGENTS target: $Target"
}

if ($Mode -and @("standby", "global") -notcontains $Mode) {
    throw "Unsupported HELLOAGENTS mode: $Mode"
}

if (-not $Package) {
    if ($Branch) {
        $Package = "https://github.com/hellowind777/helloagents/archive/refs/heads/$Branch.tar.gz"
    } else {
        $Package = "helloagents"
    }
}

function Invoke-Npm {
    param([string[]]$NpmArgs)
    & npm @NpmArgs
    if ($LASTEXITCODE -ne 0) {
        throw "npm $($NpmArgs -join ' ') failed with exit code $LASTEXITCODE"
    }
}

function Get-AllowScriptsArgs {
    if ($script:AllowScriptsArgsResolved) {
        return $script:AllowScriptsArgs
    }

    $script:AllowScriptsArgsResolved = $true
    $script:AllowScriptsArgs = @()

    try {
        $npmVersion = (& npm --version).Trim()
        $majorText = $npmVersion.Split(".", 2)[0]
        $major = 0
        if ([int]::TryParse($majorText, [ref]$major) -and $major -ge 11) {
            $script:AllowScriptsArgs = @("--allow-scripts=helloagents")
        }
    } catch {
        $script:AllowScriptsArgs = @()
    }

    return $script:AllowScriptsArgs
}

function Invoke-InstallPackage {
    param([string]$PackageSpec)
    $allowScriptsArgs = Get-AllowScriptsArgs
    $npmArgs = @("install", "-g") + $allowScriptsArgs + @($PackageSpec)
    Invoke-Npm -NpmArgs $npmArgs
}

function Clear-HelloagentsEnv {
    foreach ($name in @(
        "HELLOAGENTS",
        "HELLOAGENTS_ACTION",
        "HELLOAGENTS_TARGET",
        "HELLOAGENTS_HOST",
        "HELLOAGENTS_MODE",
        "HELLOAGENTS_BRANCH",
        "HELLOAGENTS_PACKAGE",
        "HELLOAGENTS_DEPLOY"
    )) {
        Remove-Item "Env:$name" -ErrorAction SilentlyContinue
    }
}

Clear-HelloagentsEnv

function Enable-PostinstallDeploy {
    $env:HELLOAGENTS_DEPLOY = "1"
    $env:HELLOAGENTS_TARGET = $Target
    if ($Mode) {
        $env:HELLOAGENTS_MODE = $Mode
    } else {
        $env:HELLOAGENTS_MODE = "standby"
    }
}

function Invoke-HostScript {
    param([string]$ScriptName)
    $scriptArgs = @("explore", "-g", "helloagents", "--", "npm", "run", $ScriptName, "--")
    if ($Target -eq "all") {
        $scriptArgs += "--all"
    } else {
        $scriptArgs += $Target
    }
    if ($Mode) { $scriptArgs += "--$Mode" }
    Invoke-Npm -NpmArgs $scriptArgs
}

function Sync-Hosts {
    Invoke-HostScript "sync-hosts"
}

function Cleanup-Hosts {
    Invoke-HostScript "cleanup-hosts"
}

function Uninstall-Hosts {
    Invoke-HostScript "uninstall"
}

switch ($Action) {
    "install" {
        if ($HasExplicitTarget) {
            Enable-PostinstallDeploy
        }
        Invoke-InstallPackage -PackageSpec $Package
    }
    "update" {
        if ($Branch -or $HasExplicitPackage) {
            Invoke-InstallPackage -PackageSpec $Package
        } else {
            Invoke-InstallPackage -PackageSpec "helloagents@latest"
        }
        if ($HasExplicitTarget) {
            Sync-Hosts
        }
    }
    "cleanup" {
        Cleanup-Hosts
    }
    "switch-branch" {
        if (-not $Branch -and -not $HasExplicitPackage) {
            throw "HELLOAGENTS_BRANCH or HELLOAGENTS_PACKAGE is required for switch-branch"
        }
        Invoke-InstallPackage -PackageSpec $Package
        Sync-Hosts
    }
    "branch" {
        if (-not $Branch -and -not $HasExplicitPackage) {
            throw "HELLOAGENTS_BRANCH or HELLOAGENTS_PACKAGE is required for branch"
        }
        Invoke-InstallPackage -PackageSpec $Package
        Sync-Hosts
    }
    "uninstall" {
        try {
            Uninstall-Hosts
        } catch {
            Write-Warning "Failed to cleanup HelloAGENTS host integrations before uninstall: $_"
        }
        Invoke-Npm -NpmArgs @("uninstall", "-g", "helloagents")
    }
    default {
        throw "Unsupported HELLOAGENTS_ACTION: $Action"
    }
}
