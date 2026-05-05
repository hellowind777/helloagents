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
        `\n  ✅ HelloAGENTS 已安装（global 模式）！\n\n    Claude Code / Gemini CLI: 已自动尝试宿主原生插件/扩展安装\n    Codex:        ${codexGlobalStatus(context)}（~/.agents/plugins/marketplace.json + ~/plugins/helloagents）\n\n  ${restartHint(msg)}\n\n  若宿主命令不可用，请手动执行：\n${pluginCommands()}\n\n  切换模式：\n    helloagents --standby   标准模式（默认，非插件安装）`,
        `\n  ✅ HelloAGENTS installed (global mode)!\n\n    Claude Code / Gemini CLI: native plugin/extension install attempted automatically\n    Codex:        ${codexGlobalStatus(context)} (~/.agents/plugins/marketplace.json + ~/plugins/helloagents)\n\n  ${restartHint(msg)}\n\n  If a host command is unavailable, run manually:\n${pluginCommands()}\n\n  Switch modes:\n    helloagents --standby   Standby mode (default, non-plugin install)`,
      )
    }
    return msg(
      refresh
        ? `  global 模式已刷新。\n  Claude Code / Gemini 已自动尝试刷新宿主插件/扩展；Codex 原生本地插件已重装并同步最新文件。\n  ${restartHint(msg)}`
        : `  所有项目将自动启用完整 HelloAGENTS 规则。\n  Claude Code / Gemini 已自动尝试安装宿主插件/扩展；Codex 已自动安装原生本地插件。\n  ${restartHint(msg)}\n\n若宿主命令不可用，请手动执行：\n${pluginCommands()}`,
      refresh
        ? `  Global mode refreshed.\n  Claude Code / Gemini native plugin/extension refresh was attempted automatically; Codex native local-plugin files were reinstalled and synced.\n  ${restartHint(msg)}`
        : `  All projects will use full HelloAGENTS rules.\n  Claude Code / Gemini native plugin/extension install was attempted automatically; Codex now uses the native local-plugin path automatically.\n  ${restartHint(msg)}\n\nIf a host command is unavailable, run manually:\n${pluginCommands()}`,
    )
  }

  if (install) {
    return msg(
      `\n  ✅ HelloAGENTS 已安装（standby 模式）！\n\n    Claude Code:  已自动配置（~/.claude/CLAUDE.md + hooks）\n    Gemini CLI:   已自动配置（~/.gemini/GEMINI.md）\n    Codex:        ${codexStandbyStatus(context)}\n\n  ${restartHint(msg)}\n\n  standby 模式下，hello-* 技能不会自动触发。\n  在项目中使用 ~wiki 仅创建/同步知识库，或用 ~init 完整初始化项目；也可用 ~command 按需调用。\n\n  切换模式：\n    helloagents --global    全局模式（自动尝试 Claude/Gemini 插件或扩展；Codex 自动装原生本地插件）`,
      `\n  ✅ HelloAGENTS installed (standby mode)!\n\n    Claude Code:  Auto-configured (~/.claude/CLAUDE.md + hooks)\n    Gemini CLI:   Auto-configured (~/.gemini/GEMINI.md)\n    Codex:        ${codexStandbyStatus(context)}\n\n  ${restartHint(msg)}\n\n  In standby mode, hello-* skills won't auto-trigger.\n  Use ~wiki to create or sync the KB only, or ~init for the full project setup; ~command stays available on demand.\n\n  Switch modes:\n    helloagents --global    Global mode (auto-attempts Claude/Gemini plugins or extensions; native local plugin auto-install for Codex)`,
    )
  }

  return msg(
    refresh
      ? `  standby 模式已刷新，CLI 注入与链接已同步最新文件。\n  ${restartHint(msg)}\n  ${removeHint(msg)}`
      : `  项目可通过 ~wiki 创建/同步知识库，或通过 ~init 完整初始化；未激活项目仅注入通用规则。\n  ${restartHint(msg)}\n  ${removeHint(msg)}`,
    refresh
      ? `  Standby mode refreshed; injected files and links were synchronized.\n  ${restartHint(msg)}\n  ${removeHint(msg)}`
      : `  Projects can use ~wiki for KB-only activation or ~init for the full project setup. Unactivated projects get lite rules only.\n  ${restartHint(msg)}\n  ${removeHint(msg)}`,
  )
}

function renderHelp({ pkgVersion, msg }) {
  return `
HelloAGENTS v${pkgVersion} — The orchestration kernel for AI CLIs

${msg('安装', 'Install')}:
  npm install -g helloagents  ${msg('（安装命令并同步稳定运行根目录；CLI 部署需显式执行 helloagents install ...）', '(installs the command and syncs the stable runtime root; deploy to CLIs explicitly with helloagents install ...)')}
  HELLOAGENTS=codex:global npm install -g helloagents
  helloagents-js.cmd         ${msg('（受管宿主配置的跨平台稳定入口）', '(cross-platform stable entrypoint for managed host configs)')}

${msg('模式切换', 'Mode switching')}:
  helloagents --global     ${msg('全局模式（自动尝试 Claude/Gemini 插件或扩展；Codex 自动装原生本地插件）', 'Global mode (auto-attempts Claude/Gemini plugins or extensions; native local plugin auto-install for Codex)')}
  helloagents --standby    ${msg('标准模式（非插件安装，hello-* 不自动触发，默认）', "Standby mode (non-plugin install, hello-* won't auto-trigger, default)")}

${msg('单 CLI 管理', 'Scoped CLI management')}:
  helloagents install codex --standby
  helloagents install --all --global
  helloagents update codex
  helloagents cleanup claude --global
  helloagents uninstall gemini
  ${msg('支持: claude | gemini | codex | --all；省略模式时优先沿用该 CLI 已记录/已检测的模式，否则回退 standby', 'Hosts: claude | gemini | codex | --all; omit mode to reuse the tracked/detected mode for that CLI, then fall back to standby')}

${msg('分支切换', 'Branch switching')}:
  helloagents switch-branch beta
  helloagents switch-branch beta claude --global
  helloagents branch github:hellowind777/helloagents#beta --all --standby
  ${msg('先通过 npm 安装指定 ref，再通过 npm 脚本同步宿主 CLI', 'Installs the requested ref with npm first, then syncs host CLIs through npm scripts')}

${msg('诊断', 'Diagnostics')}:
  helloagents doctor
  helloagents doctor codex --json
  ${msg('检查 carrier、链接、hooks、配置注入、Codex 插件安装、受管 model_instructions_file 指向与版本漂移', 'Checks carriers, links, hooks, config injections, Codex plugin installation, managed model_instructions_file targeting, and version drift')}

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
