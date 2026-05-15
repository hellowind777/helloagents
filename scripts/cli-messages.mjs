import { existsSync } from 'node:fs'
import { join } from 'node:path'

export function createMessageHelpers(isCN) {
  const msg = (cn, en) => (isCN ? cn : en)
  const ok = (message) => console.log(`  ✓ ${message}`)
  return { msg, ok }
}

function codexStandbyStatus({ home, msg }) {
  return existsSync(join(home, '.codex'))
    ? msg('已自动配置', 'Auto-configured')
    : msg('安装 Codex CLI 后重新运行 npm install -g helloagents', 'Install Codex CLI then re-run npm install -g helloagents')
}

function codexGlobalStatus({ home, msg }) {
  return existsSync(join(home, '.codex'))
    ? msg('已自动安装原生本地插件', 'Native local plugin auto-installed')
    : msg('安装 Codex CLI 后重新运行 npm install -g helloagents', 'Install Codex CLI then re-run npm install -g helloagents')
}

function deepseekStandbyStatus({ home, msg }) {
  return existsSync(join(home, '.deepseek'))
    ? msg('已自动配置（~/.deepseek/AGENTS.md）', 'Auto-configured (~/.deepseek/AGENTS.md)')
    : msg('安装 DeepSeek TUI 后重新运行 npm install -g helloagents', 'Install DeepSeek TUI then re-run npm install -g helloagents')
}

function deepseekGlobalStatus({ home, msg }) {
  return existsSync(join(home, '.deepseek'))
    ? msg('已自动切到受管全局载体（~/.deepseek/AGENTS.md）', 'Managed global carrier applied (~/.deepseek/AGENTS.md)')
    : msg('安装 DeepSeek TUI 后重新运行 npm install -g helloagents', 'Install DeepSeek TUI then re-run npm install -g helloagents')
}

function pluginCommands() {
  return [
    '    Claude Code:  /plugin marketplace add hellowind777/helloagents',
    '                  /plugin install helloagents@helloagents',
    '    Gemini CLI:   gemini extensions install https://github.com/hellowind777/helloagents',
  ].join('\n')
}

function removeHint(msg) {
  return msg(
    '如已安装 Claude Code 插件，可手动移除: /plugin remove helloagents\n  如已安装 Gemini CLI 扩展，可手动移除: gemini extensions uninstall helloagents',
    'If the Claude Code plugin is installed, you can remove it: /plugin remove helloagents\n  If the Gemini CLI extension is installed, you can remove it: gemini extensions uninstall helloagents',
  )
}

function restartHint(msg) {
  return msg(
    '重装、刷新或切换模式后，请重启对应 AI CLI 或新开会话；已运行会话不会自动重载注入规则。',
    'After reinstalling, refreshing, or switching modes, restart the target AI CLI or open a new session; already running sessions do not reload injected rules automatically.',
  )
}

function renderInstallMessage(context, mode, state) {
  const { msg } = context
  const install = state === 'install'
  const refresh = state === 'refresh'

  if (mode === 'global') {
    if (install) {
      return msg(
        `\n  ✅ HelloAGENTS 已安装（global 模式）！\n\n    Claude Code / Gemini CLI: 已自动尝试宿主原生插件/扩展安装\n    Codex:        ${codexGlobalStatus(context)}（~/.agents/plugins/marketplace.json + ~/plugins/helloagents）\n    DeepSeek TUI: ${deepseekGlobalStatus(context)}\n\n  ${restartHint(msg)}\n\n  若宿主命令不可用，请手动执行：\n${pluginCommands()}\n\n  切换模式：\n    helloagents --standby   标准模式（默认，非插件安装）`,
        `\n  ✅ HelloAGENTS installed (global mode)!\n\n    Claude Code / Gemini CLI: native plugin/extension install attempted automatically\n    Codex:        ${codexGlobalStatus(context)} (~/.agents/plugins/marketplace.json + ~/plugins/helloagents)\n    DeepSeek TUI: ${deepseekGlobalStatus(context)}\n\n  ${restartHint(msg)}\n\n  If a host command is unavailable, run manually:\n${pluginCommands()}\n\n  Switch modes:\n    helloagents --standby   Standby mode (default, non-plugin install)`,
      )
    }
    return msg(
      refresh
        ? `  global 模式已刷新。\n  Claude Code / Gemini 已自动尝试刷新宿主插件/扩展；Codex 原生本地插件已重装并同步最新文件；DeepSeek TUI 受管全局载体已同步。\n  ${restartHint(msg)}`
        : `  所有项目将自动启用完整 HelloAGENTS 规则。\n  Claude Code / Gemini 已自动尝试安装宿主插件/扩展；Codex 已自动安装原生本地插件；DeepSeek TUI 已切到受管全局载体。\n  ${restartHint(msg)}\n\n若宿主命令不可用，请手动执行：\n${pluginCommands()}`,
      refresh
        ? `  Global mode refreshed.\n  Claude Code / Gemini native plugin/extension refresh was attempted automatically; Codex native local-plugin files were reinstalled and synced; the managed DeepSeek TUI global carrier was refreshed.\n  ${restartHint(msg)}`
        : `  All projects will use full HelloAGENTS rules.\n  Claude Code / Gemini native plugin/extension install was attempted automatically; Codex now uses the native local-plugin path automatically; DeepSeek TUI now uses the managed global carrier.\n  ${restartHint(msg)}\n\nIf a host command is unavailable, run manually:\n${pluginCommands()}`,
    )
  }

  if (install) {
    return msg(
      `\n  ✅ HelloAGENTS 已安装（standby 模式）！\n\n    Claude Code:  已自动配置（~/.claude/CLAUDE.md + hooks）\n    Gemini CLI:   已自动配置（~/.gemini/GEMINI.md）\n    Codex:        ${codexStandbyStatus(context)}\n    DeepSeek TUI: ${deepseekStandbyStatus(context)}\n\n  ${restartHint(msg)}\n\n  standby 模式下，hello-* 技能不会自动触发。\n  在项目中使用 ~wiki 或 ~init 仅创建/同步知识库；用 ~global 初始化项目级全局模式；也可用 ~command 按需调用。\n\n  切换模式：\n    helloagents --global    项目级全局模式（自动尝试 Claude/Gemini 插件或扩展；Codex 自动装原生本地插件；DeepSeek 使用受管 AGENTS 载体）`,
      `\n  ✅ HelloAGENTS installed (standby mode)!\n\n    Claude Code:  Auto-configured (~/.claude/CLAUDE.md + hooks)\n    Gemini CLI:   Auto-configured (~/.gemini/GEMINI.md)\n    Codex:        ${codexStandbyStatus(context)}\n    DeepSeek TUI: ${deepseekStandbyStatus(context)}\n\n  ${restartHint(msg)}\n\n  In standby mode, hello-* skills won't auto-trigger.\n  Use ~wiki or ~init to create or sync the KB only; use ~global to initialize project-level global mode; ~command stays available on demand.\n\n  Switch modes:\n    helloagents --global    Project-level global mode (auto-attempts Claude/Gemini plugins or extensions; native local plugin auto-install for Codex; DeepSeek uses a managed AGENTS carrier)`,
    )
  }

  return msg(
    refresh
      ? `  standby 模式已刷新，CLI 注入与链接已同步最新文件。\n  ${restartHint(msg)}\n  ${removeHint(msg)}`
      : `  项目可通过 ~wiki 或 ~init 创建/同步知识库；用 ~global 初始化项目级全局模式；未初始化时仅注入轻量规则。\n  ${restartHint(msg)}\n  ${removeHint(msg)}`,
    refresh
      ? `  Standby mode refreshed; injected files and links were synchronized.\n  ${restartHint(msg)}\n  ${removeHint(msg)}`
      : `  Projects can use ~wiki or ~init to create/sync the KB; use ~global to initialize project-level global mode. Projects that are not initialized get lite rules only.\n  ${restartHint(msg)}\n  ${removeHint(msg)}`,
  )
}

function renderHelp({ pkgVersion, msg }) {
  return `
HelloAGENTS v${pkgVersion} — The orchestration kernel for AI CLIs

  ${msg('安装', 'Install')}:
  npm install -g helloagents  ${msg('（安装命令并同步稳定运行根目录；CLI 部署需显式执行 helloagents install ...）', '(installs the command and syncs the stable runtime root; deploy to CLIs explicitly with helloagents install ...)')}
  HELLOAGENTS=codex:global npm install -g helloagents
  helloagents-js             ${msg('（受管宿主配置的跨平台稳定入口）', '(cross-platform stable entrypoint for managed host configs)')}

${msg('模式切换', 'Mode switching')}:
  helloagents --global     ${msg('项目级全局模式（自动尝试 Claude/Gemini 插件或扩展；Codex 自动装原生本地插件；DeepSeek 使用受管 AGENTS 载体）', 'Project-level global mode (auto-attempts Claude/Gemini plugins or extensions; native local plugin auto-install for Codex; DeepSeek uses a managed AGENTS carrier)')}
  helloagents --standby    ${msg('标准模式（非插件安装，hello-* 不自动触发，默认）', "Standby mode (non-plugin install, hello-* won't auto-trigger, default)")}

${msg('单 CLI 管理', 'Scoped CLI management')}:
  helloagents install codex --standby
  helloagents install deepseek --standby
  helloagents install --all --global
  helloagents update codex
  helloagents cleanup claude --global
  helloagents uninstall gemini
  ${msg('支持: claude | gemini | codex | deepseek | --all；省略模式时优先沿用该 CLI 已记录/已检测的模式，否则回退 standby', 'Hosts: claude | gemini | codex | deepseek | --all; omit mode to reuse the tracked/detected mode for that CLI, then fall back to standby')}

${msg('分支切换', 'Branch switching')}:
  helloagents switch-branch beta
  helloagents switch-branch beta claude --global
  helloagents branch github:hellowind777/helloagents#beta --all --standby
  ${msg('先通过 npm 安装指定 ref，再通过 npm 脚本同步宿主 CLI', 'Installs the requested ref with npm first, then syncs host CLIs through npm scripts')}

${msg('诊断', 'Diagnostics')}:
  helloagents doctor
  helloagents doctor codex --json
  ${msg('检查 carrier、链接、hooks、配置注入、Codex 插件安装、DeepSeek 原生 doctor 摘要、受管 model_instructions_file 指向、Codex hook trust 本机状态与版本漂移', 'Checks carriers, links, hooks, config injections, Codex plugin installation, DeepSeek native doctor summaries, managed model_instructions_file targeting, machine-local Codex hook trust state, and version drift')}

${msg('Codex /goal', 'Codex /goal')}:
  helloagents codex goals status
  helloagents codex goals enable
  ${msg('仅显式管理 Codex 最新版 [features].goals，不替代 /goal', 'Explicitly manages only latest Codex [features].goals; does not replace /goal')}

${msg('卸载', 'Uninstall')}:
  helloagents cleanup      ${msg('（先清理所有 CLI 注入/链接）', '(cleans all CLI injections/links first)')}
  npm uninstall -g helloagents
  ${msg('如宿主命令不可用，另需手动移除：', 'If host commands are unavailable, also remove manually:')}
    Claude Code:  /plugin remove helloagents
    Gemini CLI:   gemini extensions uninstall helloagents
`.trim()
}

export function createInstallMessagePrinter(context) {
  return {
    printHelp() {
      console.log(renderHelp(context))
    },
    printInstallMsg(mode, state) {
      console.log(renderInstallMessage(context, mode, state))
      if (state === 'install' || state === 'refresh') console.log()
    },
  }
}
