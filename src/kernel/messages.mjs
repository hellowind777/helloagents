/**
 * 用户可见文案目录。每条消息同时维护中文与英文，键名按“模块.动作”组织。
 * 新增文案必须在这里登记；契约测试会核对源码中引用的键在此处齐全。
 */

/** @type {Record<string, { cn: string, en: string }>} */
export const MESSAGES = {
  'cli.unknownCommand': {
    cn: '未知命令：{command}。执行 helloagents help 查看用法。',
    en: 'Unknown command: {command}. Run "helloagents help" for usage.',
  },
  'cli.unknownHost': {
    cn: '未知宿主：{host}。可用宿主：{hosts}。',
    en: 'Unknown host: {host}. Available hosts: {hosts}.',
  },
  'cli.noTargets': {
    cn: '请指定宿主（例如 helloagents install claude），或使用 --all 安装到全部宿主。',
    en: 'Specify a host (for example: helloagents install claude) or use --all for all hosts.',
  },
  'cli.error': {
    cn: '执行失败：{message}',
    en: 'Command failed: {message}',
  },
  'app.synced': {
    cn: '运行副本已更新：{path}（v{version}）',
    en: 'Runtime copy updated: {path} (v{version})',
  },
  'install.mode.unsupported': {
    cn: '{host} 不支持 {mode} 方式，已跳过。支持的方式：{supported}。',
    en: '{host} does not support the {mode} method; skipped. Supported: {supported}.',
  },
  'install.inject.done': {
    cn: '{host}：内核已写入 {path}',
    en: '{host}: kernel written to {path}',
  },
  'install.plugin.done': {
    cn: '{host}：插件安装完成',
    en: '{host}: plugin installed',
  },
  'install.plugin.manual': {
    cn: '{host}：自动安装未成功，请手动执行：{steps}',
    en: '{host}: automatic install failed. Run manually: {steps}',
  },
  'install.plugin.fallback': {
    cn: '{host}：插件安装未成功，已改用注入方式。',
    en: '{host}: plugin install failed; fell back to the inject method.',
  },
  'install.switched': {
    cn: '{host}：安装方式已从 {from} 切换为 {to}。',
    en: '{host}: install method switched from {from} to {to}.',
  },
  'install.summary': {
    cn: '安装完成：{count} 个宿主。执行 helloagents doctor 可随时体检。',
    en: 'Installed on {count} host(s). Run "helloagents doctor" to check health at any time.',
  },
  'uninstall.host.done': {
    cn: '{host}：已移除。',
    en: '{host}: removed.',
  },
  'uninstall.app.removed': {
    cn: '运行副本已删除：{path}',
    en: 'Runtime copy removed: {path}',
  },
  'uninstall.config.kept': {
    cn: '已保留用户配置 {path}；如需一并删除请使用 --purge。',
    en: 'User settings kept at {path}; add --purge to remove them as well.',
  },
  'update.done': {
    cn: '更新完成：{count} 个宿主已刷新到 v{version}。',
    en: 'Update finished: {count} host(s) refreshed to v{version}.',
  },
  'update.nothing': {
    cn: '尚未安装到任何宿主。先执行 helloagents install。',
    en: 'Nothing is installed yet. Run "helloagents install" first.',
  },
  'init.done': {
    cn: '项目初始化完成：内核已写入 {carrier}，知识库目录 {kb} 已就绪。',
    en: 'Project initialized: kernel written to {carrier}; knowledge base ready at {kb}.',
  },
  'init.kbExists': {
    cn: '已存在的知识库文件保持原样：{files}',
    en: 'Existing knowledge base files were left unchanged: {files}',
  },
  'addon.enabled': {
    cn: '{addon} 已在 {host} 启用。',
    en: '{addon} enabled on {host}.',
  },
  'addon.disabled': {
    cn: '{addon} 已在 {host} 停用。',
    en: '{addon} disabled on {host}.',
  },
  'addon.unsupported': {
    cn: '{host} 不支持 {addon}，已跳过。',
    en: '{host} does not support {addon}; skipped.',
  },
  'addon.noHosts': {
    cn: '尚未安装到任何宿主，无法配置 {addon}。先执行 helloagents install。',
    en: 'No host installed yet, so {addon} cannot be configured. Run "helloagents install" first.',
  },
  'addon.codexUserNotify': {
    cn: 'Codex 的 config.toml 已存在你自己的 notify 配置，为避免覆盖未做修改。如需使用 HelloAGENTS 通知，请手动合并：{line}',
    en: 'Your own notify setting already exists in Codex config.toml; it was left unchanged. To use HelloAGENTS notifications, merge manually: {line}',
  },
  'doctor.ok': {
    cn: '检查通过，没有发现问题。',
    en: 'All checks passed. No issues found.',
  },
  'doctor.issues': {
    cn: '发现 {errors} 个错误、{warnings} 个提醒。',
    en: 'Found {errors} error(s) and {warnings} warning(s).',
  },
  'doctor.hint.reinstall': {
    cn: '建议执行 helloagents update 修复。',
    en: 'Run "helloagents update" to repair.',
  },
  'doctor.hint.migrate': {
    cn: '检测到 3.x 残留，建议执行 helloagents migrate 清理。',
    en: 'Version 3.x leftovers detected. Run "helloagents migrate" to clean them up.',
  },
  'migrate.item': {
    cn: '  已清理：{item}',
    en: '  Cleaned: {item}',
  },
  'cli.modeConflict': {
    cn: '--inject 与 --plugin 只能二选一。',
    en: 'Use either --inject or --plugin, not both.',
  },
  'migrate.done': {
    cn: '迁移完成：清理 {count} 项 3.x 残留。现在可以执行 helloagents install 安装 4.x。',
    en: 'Migration finished: {count} legacy item(s) cleaned. Run "helloagents install" to set up 4.x.',
  },
  'migrate.nothing': {
    cn: '未发现 3.x 残留，无需迁移。',
    en: 'No 3.x leftovers found. Nothing to migrate.',
  },
  'migrate.geminiExtension': {
    cn: 'Gemini CLI 已不再是支持的宿主，安装记录已清除。若当初以扩展方式安装过，请手动执行：gemini extensions uninstall helloagents',
    en: 'Gemini CLI is no longer a supported host; its install record was removed. If you installed the extension, run manually: gemini extensions uninstall helloagents',
  },
  'migrate.codexManualNotify': {
    cn: 'Codex config.toml 中存在疑似 3.x 的 notify 配置但未带管理标记，为安全起见未改动，请人工确认：{path}',
    en: 'A notify entry in Codex config.toml looks like 3.x but has no managed marker. It was left unchanged for safety; please review: {path}',
  },
  'version.synced': {
    cn: '清单版本已同步为 v{version}：{files}',
    en: 'Manifest versions synced to v{version}: {files}',
  },
  'version.checkFailed': {
    cn: '清单版本与 package.json 不一致：{files}',
    en: 'Manifest versions differ from package.json: {files}',
  },
  'version.checkOk': {
    cn: '清单版本一致（v{version}）。',
    en: 'Manifest versions are consistent (v{version}).',
  },
}
