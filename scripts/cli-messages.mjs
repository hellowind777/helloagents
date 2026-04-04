import { existsSync } from 'node:fs';
import { join } from 'node:path';

export function createMessageHelpers(isCN) {
  const msg = (cn, en) => (isCN ? cn : en);
  const ok = (message) => console.log(`  ✓ ${message}`);
  return { msg, ok };
}

export function createInstallMessagePrinter({ home, pkgVersion, msg }) {
  const codexStandbyStatus = () => existsSync(join(home, '.codex'))
    ? msg('已自动配置', 'Auto-configured')
    : msg('安装 Codex CLI 后重新运行 npm install -g helloagents', 'Install Codex CLI then re-run npm install -g helloagents');

  const codexGlobalStatus = () => existsSync(join(home, '.codex'))
    ? msg('已自动安装原生本地插件', 'Native local plugin auto-installed')
    : msg('安装 Codex CLI 后重新运行 npm install -g helloagents', 'Install Codex CLI then re-run npm install -g helloagents');

  const PLUGIN_CMDS = '    Claude Code:  /plugin marketplace add hellowind777/helloagents\n                  /plugin install helloagents@helloagents\n    Gemini CLI:   gemini extensions install https://github.com/hellowind777/helloagents';
  const REMOVE_HINT = msg(
    '如已安装 Claude Code 插件，建议手动移除: /plugin remove helloagents\n  如已安装 Gemini CLI 扩展，建议手动移除: gemini extensions uninstall helloagents',
    'If Claude Code plugin installed, consider removing: /plugin remove helloagents\n  If Gemini CLI extension installed, consider removing: gemini extensions uninstall helloagents',
  );

  function printInstallMsg(mode, context) {
    const isSwitch = context === 'switch';
    const isRefresh = context === 'refresh';
    const isInstall = !isSwitch && !isRefresh;
    if (mode === 'global') {
      if (isInstall) console.log(msg(
        `\n  ✅ HelloAGENTS 已安装（global 模式）！\n\n${PLUGIN_CMDS}\n    Codex:        ${codexGlobalStatus()}（~/.agents/plugins/marketplace.json + ~/plugins/helloagents）\n\n  切换模式：\n    helloagents --standby   标准模式（默认，非插件安装）`,
        `\n  ✅ HelloAGENTS installed (global mode)!\n\n${PLUGIN_CMDS}\n    Codex:        ${codexGlobalStatus()} (~/.agents/plugins/marketplace.json + ~/plugins/helloagents)\n\n  Switch modes:\n    helloagents --standby   Standby mode (default, non-plugin install)`,
      ));
      else console.log(msg(
        isRefresh
          ? '  global 模式已刷新。\n  Claude Code / Gemini 请保持插件已安装；Codex 原生本地插件链路已重装并同步最新文件。'
          : '  所有项目将自动启用完整 HelloAGENTS 规则。\n  Claude Code / Gemini 请手动安装插件；Codex 已自动走原生本地插件链路。',
        isRefresh
          ? '  Global mode refreshed.\n  Keep Claude Code / Gemini plugins installed; Codex native local-plugin files were reinstalled and synced.'
          : '  All projects will use full HelloAGENTS rules.\n  Install Claude Code / Gemini plugins manually; Codex now uses the native local-plugin path automatically.',
      ));
    } else {
      if (isInstall) console.log(msg(
        `\n  ✅ HelloAGENTS 已安装（standby 模式）！\n\n    Claude Code:  已自动配置（~/.claude/CLAUDE.md + hooks）\n    Gemini CLI:   已自动配置（~/.gemini/GEMINI.md）\n    Codex:        ${codexStandbyStatus()}\n\n  standby 模式下，hello-* 技能不会自动触发。\n  在项目中使用 ~init 激活完整功能，或使用 ~command 按需调用。\n\n  切换模式：\n    helloagents --global    全局模式（Claude/Gemini 装插件；Codex 自动装原生本地插件）`,
        `\n  ✅ HelloAGENTS installed (standby mode)!\n\n    Claude Code:  Auto-configured (~/.claude/CLAUDE.md + hooks)\n    Gemini CLI:   Auto-configured (~/.gemini/GEMINI.md)\n    Codex:        ${codexStandbyStatus()}\n\n  In standby mode, hello-* skills won't auto-trigger.\n  Use ~init in a project to activate full features, or use ~command on demand.\n\n  Switch modes:\n    helloagents --global    Global mode (manual plugins for Claude/Gemini; native local plugin auto-install for Codex)`,
      ));
      else console.log(msg(
        isRefresh
          ? `  standby 模式已刷新，CLI 注入与链接已同步最新文件。\n  ${REMOVE_HINT}`
          : `  项目需通过 ~init 激活完整功能，未激活项目仅注入通用规则。\n  ${REMOVE_HINT}`,
        isRefresh
          ? `  Standby mode refreshed; injected files and links were synchronized.\n  ${REMOVE_HINT}`
          : `  Projects need ~init to activate full features. Unactivated projects get lite rules only.\n  ${REMOVE_HINT}`,
      ));
    }
    if (isInstall || isRefresh) console.log();
  }

  function printHelp() {
    console.log(`
HelloAGENTS v${pkgVersion} — The orchestration kernel for AI CLIs

${msg('安装', 'Install')}:
  npm install -g helloagents  ${msg('（只安装包与命令；CLI 部署需显式执行 helloagents install ...）', '(installs the package/command only; deploy to CLIs explicitly with helloagents install ...)')}
  helloagents-js             ${msg('（稳定别名，避免与系统中同名可执行文件冲突）', '(stable alias to avoid conflicts with system executables of the same name)')}

${msg('模式切换', 'Mode switching')}:
  helloagents --global     ${msg('全局模式（Claude/Gemini 装插件；Codex 自动装原生本地插件）', 'Global mode (manual plugins for Claude/Gemini; native local plugin auto-install for Codex)')}
  helloagents --standby    ${msg('标准模式（非插件安装，hello-* 不自动触发，默认）', "Standby mode (non-plugin install, hello-* won't auto-trigger, default)")}

${msg('单 CLI 管理', 'Scoped CLI management')}:
  helloagents install codex --standby
  helloagents install --all --global
  helloagents update codex
  helloagents cleanup claude --global
  helloagents uninstall gemini
  ${msg('支持: claude | gemini | codex | --all；省略模式时优先沿用该 CLI 已记录/已检测的模式，否则回退 standby', 'Hosts: claude | gemini | codex | --all; omit mode to reuse the tracked/detected mode for that CLI, then fall back to standby')}

${msg('卸载', 'Uninstall')}:
  helloagents cleanup      ${msg('（推荐先执行，显式清理所有 CLI 注入/链接）', '(recommended first, explicitly cleans CLI injections/links)')}
  npm uninstall -g helloagents
  ${msg('如已安装插件，另需手动移除：', 'If plugins installed, also remove manually:')}
    Claude Code:  /plugin remove helloagents
    Gemini CLI:   gemini extensions uninstall helloagents
`.trim());
  }

  return {
    printHelp,
    printInstallMsg,
  };
}
