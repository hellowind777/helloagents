/**
 * 帮助文本。中英文完整成文维护，不做逐句拼接。
 */

const HELP_CN = `
HelloAGENTS v{version} — AI 编码 CLI 的思维激活层

用法
  helloagents <命令> [参数]

安装与维护
  install <宿主…|--all> [--inject|--plugin]   安装到宿主（默认优先插件方式，其次注入方式）
  uninstall <宿主…|--all> [--purge]           卸载；--purge 同时删除 ~/.helloagents 配置
  update                                      刷新运行副本并同步全部已安装宿主
  init                                        在当前项目写入 AGENTS.md 内核并建立知识库
  doctor [--json]                             体检安装状态，识别 3.x 残留
  migrate                                     清理 3.x 版本的全部残留

附加组件（可选）
  guard on|off [宿主…]                        危险命令拦截（支持：claude、grok、cursor、hermes）
  notify on|off [宿主…]                       完成提醒（支持：claude、grok、cursor、codex、hermes）

其他
  version                                     显示版本
  help                                        显示本说明

宿主
  claude（Claude Code）  codex（Codex CLI）
  grok（Grok Build）     cursor（Cursor）       hermes（Hermes）

说明
  安装方式有两种：插件方式使用宿主自带的插件机制；注入方式把内核写入宿主的
  用户级规则文件（标记包裹，卸载即还原）。Cursor 只支持插件方式——它没有全局
  规则文件，内核随插件以 rules 规则下发，安装后需在 Cursor 里重载窗口生效。
  语言可用环境变量 HELLOAGENTS_LANG=cn|en 指定。
`

const HELP_EN = `
HelloAGENTS v{version} — a thinking-activation layer for AI coding CLIs

Usage
  helloagents <command> [arguments]

Install and maintain
  install <hosts…|--all> [--inject|--plugin]   Install (plugin method preferred, inject as fallback)
  uninstall <hosts…|--all> [--purge]           Uninstall; --purge also removes ~/.helloagents
  update                                       Refresh the runtime copy and all installed hosts
  init                                         Write the kernel into ./AGENTS.md and set up the knowledge base
  doctor [--json]                              Check installation health and detect 3.x leftovers
  migrate                                      Clean up everything left behind by version 3.x

Optional add-ons
  guard on|off [hosts…]                        Dangerous-command blocking (claude, grok, cursor, hermes)
  notify on|off [hosts…]                       Completion notifications (claude, grok, cursor, codex, hermes)

Other
  version                                      Show version
  help                                         Show this message

Hosts
  claude (Claude Code)  codex (Codex CLI)
  grok (Grok Build)     cursor (Cursor)        hermes (Hermes)

Notes
  Two install methods: the plugin method uses the host's own plugin system; the inject
  method writes the kernel into the host's user-level rules file (wrapped in markers;
  uninstalling restores the file). Cursor supports the plugin method only — it has no
  global rules file, so the kernel ships as a plugin rule; reload the window in Cursor
  after installing. Set HELLOAGENTS_LANG=cn|en to choose the language.
`

/**
 * @param {import('./main.mjs').CliContext} ctx
 * @param {'cn' | 'en'} language
 */
export function runHelp(ctx, language) {
  const text = language === 'cn' ? HELP_CN : HELP_EN
  ctx.log(text.replaceAll('{version}', ctx.version).trim())
}
