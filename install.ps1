# HelloAGENTS one-shot installer.
#
# Environment:
#   HELLOAGENTS_ACTION=install|update|uninstall|switch-branch|branch
#   HELLOAGENTS_TARGET=all|claude|gemini|codex
#   HELLOAGENTS_MODE=standby|global
#   HELLOAGENTS_BRANCH=main|beta|...
#   HELLOAGENTS_PACKAGE=helloagents|github:owner/repo#ref|...

$ErrorActionPreference = "Stop"

$Action = if ($env:HELLOAGENTS_ACTION) { $env:HELLOAGENTS_ACTION } else { "install" }
$Target = if ($env:HELLOAGENTS_TARGET) { $env:HELLOAGENTS_TARGET } else { "all" }
$Mode = if ($env:HELLOAGENTS_MODE) { $env:HELLOAGENTS_MODE } else { "standby" }
$Branch = if ($env:HELLOAGENTS_BRANCH) { $env:HELLOAGENTS_BRANCH } else { "" }
$Package = if ($env:HELLOAGENTS_PACKAGE) { $env:HELLOAGENTS_PACKAGE } else { "" }

if (-not $Package) {
    if ($Branch) {
        $Package = "github:hellowind777/helloagents#$Branch"
    } else {
        $Package = "helloagents"
    }
}

function Invoke-Npm {
    param([string[]]$Args)
    & npm @Args
    if ($LASTEXITCODE -ne 0) {
        throw "npm $($Args -join ' ') failed with exit code $LASTEXITCODE"
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
        Invoke-Npm @("explore", "-g", "helloagents", "--", "npm", "run", $ScriptName, "--", "--all", "--$Mode")
    } else {
        Invoke-Npm @("explore", "-g", "helloagents", "--", "npm", "run", $ScriptName, "--", $Target, "--$Mode")
    }
}

function Sync-Hosts {
    Invoke-HostScript "sync-hosts"
}

function Cleanup-Hosts {
    Invoke-HostScript "cleanup-hosts"
}

switch ($Action) {
    "install" {
        Enable-PostinstallDeploy
        Invoke-Npm @("install", "-g", $Package)
    }
    "update" {
        if ($Branch -or $env:HELLOAGENTS_PACKAGE) {
            Invoke-Npm @("install", "-g", $Package)
        } else {
            & npm update -g helloagents
            if ($LASTEXITCODE -ne 0) {
                Invoke-Npm @("install", "-g", "helloagents")
            }
        }
        Sync-Hosts
    }
    "switch-branch" {
        if (-not $Branch -and -not $env:HELLOAGENTS_PACKAGE) {
            throw "HELLOAGENTS_BRANCH or HELLOAGENTS_PACKAGE is required for switch-branch"
        }
        Invoke-Npm @("install", "-g", $Package)
        Sync-Hosts
    }
    "branch" {
        if (-not $Branch -and -not $env:HELLOAGENTS_PACKAGE) {
            throw "HELLOAGENTS_BRANCH or HELLOAGENTS_PACKAGE is required for branch"
        }
        Invoke-Npm @("install", "-g", $Package)
        Sync-Hosts
    }
    "uninstall" {
        try {
            Cleanup-Hosts
        } catch {
            Write-Warning "Failed to cleanup HelloAGENTS host integrations before uninstall: $_"
        }
        Invoke-Npm @("uninstall", "-g", "helloagents")
    }
    default {
        throw "Unsupported HELLOAGENTS_ACTION: $Action"
    }
}
