# HelloAGENTS v3 -> v4 仓库清理脚本（第 2 版）。
# 作用：把 4.0 重构后不再使用的旧文件移动到 _to_delete/ 目录（不直接删除，可反悔）。
# 用法：在仓库根目录执行  powershell -ExecutionPolicy Bypass -File .\cleanup-v3-files.ps1
# 确认无误后：删除 _to_delete/ 目录与本脚本，然后提交。
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repoRoot
if (-not (Test-Path (Join-Path $repoRoot 'prompts\kernel.md'))) {
    Write-Error '未找到 prompts\kernel.md，请确认已写入 4.0 文件后再运行本脚本。'
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$trash = Join-Path $repoRoot "_to_delete\$stamp"
New-Item -ItemType Directory -Path $trash -Force | Out-Null

# 旧版专有的目录与文件（4.0 中已无对应物或已由新文件取代位置）。
$targets = @(
    'scripts',
    'hooks',
    'templates',
    'bootstrap.md',
    'bootstrap-lite.md',
    'COMMIT_MESSAGE.md',
    '.codex-plugin',
    '.grok-plugin',
    'skills\commands',
    'skills\_meta',
    'skills\helloagents',
    'skills\qa-review',
    'skills\hello-review',
    '.helloagents\sessions',
    'tests\helpers\cli-test-helpers.mjs',
    'tests\helpers\runtime-test-helpers.mjs',
    'tests\helpers\test-env.mjs',
    # 说明：assets\ 下的备用音效（dogdoing 音效包、error/idle/warning.wav）与 icon-large.png
    # 按作者要求保留，不列入清理；notify 组件当前使用 sounds\complete.wav、sounds\confirm.wav 与 icons\icon.png。
    # 新版 README 只引用 01-hero-banner.svg，其余图片随旧 README 一起退役。
    'readme_images\02-feature-icon-installer.svg',
    'readme_images\03-feature-icon-workflow.svg',
    'readme_images\04-feature-icon-safety.svg',
    'readme_images\05-feature-icon-compat.svg',
    'readme_images\06-divider.svg',
    'readme_images\07-demo-snake-with-helloagents.png',
    'readme_images\08-demo-snake-without-helloagents.png',
    # 空目录（3.x 时代创建后一直为空）。
    'docs'
)
# 旧版测试文件都直接位于 tests\ 根目录（4.0 的测试在 tests 的子目录里）。
$targets += Get-ChildItem -Path 'tests' -Filter '*.test.mjs' -File -ErrorAction SilentlyContinue |
    ForEach-Object { "tests\$($_.Name)" }

$moved = 0
foreach ($relative in $targets) {
    $source = Join-Path $repoRoot $relative
    if (-not (Test-Path $source)) { continue }
    $destination = Join-Path $trash $relative
    New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
    Move-Item -Path $source -Destination $destination -Force
    Write-Host "已移动：$relative"
    $moved++
}

# 工作流文件已手动移入 .github\workflows\ 后，暂存目录也可清走。
if ((Test-Path '_github_workflows') -and (Test-Path '.github\workflows\ci.yml')) {
    Move-Item -Path '_github_workflows' -Destination (Join-Path $trash '_github_workflows') -Force
    Write-Host '已移动：_github_workflows（工作流已就位）'
    $moved++
}

Write-Host ''
Write-Host "完成：$moved 项已移动到 $trash"
Write-Host '请检查确认后删除 _to_delete\ 目录与本脚本，再执行 git add -A 提交。'
