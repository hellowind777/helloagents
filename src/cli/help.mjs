/**
 * 帮助文本。中英文完整成文维护，不做逐句拼接。
 */

const HELP_CN = `
HelloAGENTS v{version} — AI 编码 CLI 的思维激活层

用法
  helloagents <命令> [参数]
  helloagents [--lang cn|en] <命令> [参数]

安装与维护
  install <宿主…|--all> [--standard|--global]  安装到宿主（默认优先全局模式，其次标准模式）
  uninstall <宿主…|--all> [--purge]            卸载；--purge 同时删除 ~/.helloagents 配置
  update [宿主…]                               刷新运行副本并同步已安装宿主；不指定则全部刷新
  init                                         在当前项目写入 AGENTS.md 内核并建立知识库
  doctor [--json]                              体检安装状态，识别 3.x 残留
  migrate                                      清理 3.x 版本的全部残留

附加组件（可选）
  guard on|off [宿主…]                         危险命令拦截（支持：claude、grok、cursor、hermes）
  notify on|off [宿主…]                        完成提醒（支持：claude、codex、grok、cursor、hermes）

其他
  version                                      显示版本
  help                                         显示本说明

宿主
  claude（Claude Code）    codex（Codex CLI）
  grok（Grok Build）       cursor（Cursor）       hermes（Hermes）

说明
  安装方式有两种：全局模式使用宿主自带的原生插件市场；标准模式把内核注入宿主的
  用户级规则文件（标记包裹，卸载即还原）。Cursor 只支持全局模式——它没有全局
  规则文件，内核随插件以 rules 规则下发，安装后需在 Cursor 里重载窗口生效。
  语言可用环境变量 HELLOAGENTS_LANG=cn|en 指定，或在命令前加 --lang cn|en。
  旧版 --inject/--plugin 别名仍然可用，对应 --standard/--global。
`

const HELP_EN = `
HelloAGENTS v{version} — a thinking-activation layer for AI coding CLIs

Usage
  helloagents <command> [arguments]
  helloagents [--lang cn|en] <command> [arguments]

Install and maintain
  install <hosts…|--all> [--standard|--global]  Install (global mode preferred, standard as fallback)
  uninstall <hosts…|--all> [--purge]            Uninstall; --purge also removes ~/.helloagents
  update [hosts…]                               Refresh the runtime copy and installed hosts; all if omitted
  init                                          Write the kernel into ./AGENTS.md and set up the knowledge base
  doctor [--json]                               Check installation health and detect 3.x leftovers
  migrate                                       Clean up everything left behind by version 3.x

Optional add-ons
  guard on|off [hosts…]                         Dangerous-command blocking (claude, grok, cursor, hermes)
  notify on|off [hosts…]                        Completion notifications (claude, codex, grok, cursor, hermes)

Other
  version                                       Show version
  help                                          Show this message

Hosts
  claude (Claude Code)    codex (Codex CLI)
  grok (Grok Build)       cursor (Cursor)       hermes (Hermes)

Notes
  Two install methods: global mode uses the host's own native plugin marketplace; standard
  mode writes the kernel into the host's user-level rules file (wrapped in markers; uninstalling
  restores the file). Cursor supports global mode only — it has no global rules file, so the
  kernel ships as a plugin rule; reload the window in Cursor after installing.
  Set HELLOAGENTS_LANG=cn|en or use --lang cn|en to choose the language.
  Legacy --inject/--plugin aliases still work, mapping to --standard/--global.
`

/**
 * @param {import('./main.mjs').CliContext} ctx
 * @param {'cn' | 'en'} language
 */
export function runHelp(ctx, language) {
  const text = language === 'cn' ? HELP_CN : HELP_EN
  ctx.log(text.replaceAll('{version}', ctx.version).trim())
}
