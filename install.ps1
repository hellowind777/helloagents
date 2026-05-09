# HelloAGENTS one-shot installer.
#
# Environment:
#   HELLOAGENTS=all|claude|gemini|codex[:standby|global]
#   HELLOAGENTS_ACTION=install|update|cleanup|uninstall|switch-branch|branch
#   HELLOAGENTS_TARGET=all|claude|gemini|codex
#   HELLOAGENTS_MODE=standby|global
#   HELLOAGENTS_BRANCH=main|beta|...
#   HELLOAGENTS_PACKAGE=helloagents|github:owner/repo#ref|...

$ErrorActionPreference = "Stop"

$Action = if ($env:HELLOAGENTS_ACTION) { $env:HELLOAGENTS_ACTION } else { "install" }
$Target = if ($env:HELLOAGENTS_TARGET) { $env:HELLOAGENTS_TARGET } else { "" }
$Mode = if ($env:HELLOAGENTS_MODE) { $env:HELLOAGENTS_MODE } else { "" }
$Branch = if ($env:HELLOAGENTS_BRANCH) { $env:HELLOAGENTS_BRANCH } else { "" }
$Package = if ($env:HELLOAGENTS_PACKAGE) { $env:HELLOAGENTS_PACKAGE } else { "" }

if ($env:HELLOAGENTS) {
    $Parts = $env:HELLOAGENTS.Split(":", 2)
    if (-not $Parts[0]) {
        throw "HELLOAGENTS must be target[:mode], for example codex:global"
    }
    if (-not $Target) { $Target = $Parts[0] }
    if (-not $Mode -and $Parts.Count -gt 1) { $Mode = $Parts[1] }
}

if (-not $Target) { $Target = "all" }
if (-not $Mode) { $Mode = "standby" }
$Target = $Target.ToLowerInvariant()
$Mode = $Mode.ToLowerInvariant()

if (@("all", "claude", "gemini", "codex") -notcontains $Target) {
    throw "Unsupported HELLOAGENTS target: $Target"
}

if (@("standby", "global") -notcontains $Mode) {
    throw "Unsupported HELLOAGENTS mode: $Mode"
}

if (-not $Package) {
    if ($Branch) {
        $Package = "github:hellowind777/helloagents#$Branch"
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

function Enable-PostinstallDeploy {
    $env:HELLOAGENTS_DEPLOY = "1"
    $env:HELLOAGENTS_TARGET = $Target
    $env:HELLOAGENTS_MODE = $Mode
}

function Invoke-HostScript {
    param([string]$ScriptName)
    if ($Target -eq "all") {
        Invoke-Npm -NpmArgs @("explore", "-g", "helloagents", "--", "npm", "run", $ScriptName, "--", "--all", "--$Mode")
    } else {
        Invoke-Npm -NpmArgs @("explore", "-g", "helloagents", "--", "npm", "run", $ScriptName, "--", $Target, "--$Mode")
    }
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
        Enable-PostinstallDeploy
        Invoke-Npm -NpmArgs @("install", "-g", $Package)
    }
    "update" {
        if ($Branch -or $env:HELLOAGENTS_PACKAGE) {
            Invoke-Npm -NpmArgs @("install", "-g", $Package)
        } else {
            & npm update -g helloagents
            if ($LASTEXITCODE -ne 0) {
                Invoke-Npm -NpmArgs @("install", "-g", "helloagents")
            }
        }
        Sync-Hosts
    }
    "cleanup" {
        Cleanup-Hosts
    }
    "switch-branch" {
        if (-not $Branch -and -not $env:HELLOAGENTS_PACKAGE) {
            throw "HELLOAGENTS_BRANCH or HELLOAGENTS_PACKAGE is required for switch-branch"
        }
        Invoke-Npm -NpmArgs @("install", "-g", $Package)
        Sync-Hosts
    }
    "branch" {
        if (-not $Branch -and -not $env:HELLOAGENTS_PACKAGE) {
            throw "HELLOAGENTS_BRANCH or HELLOAGENTS_PACKAGE is required for branch"
        }
        Invoke-Npm -NpmArgs @("install", "-g", $Package)
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
