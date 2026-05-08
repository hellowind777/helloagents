import { isProjectRuntimeActive } from './runtime-scope.mjs'

export function resolveRuntimeInstallMode(settings = {}, host = '') {
  if (!settings || typeof settings !== 'object') return 'standby'
  const hostModes = settings.host_install_modes
  const trackedMode = hostModes && typeof hostModes === 'object' && !Array.isArray(hostModes)
    ? hostModes[host] || ''
    : ''
  return trackedMode || settings.install_mode || 'standby'
}

export function resolveBootstrapFile(cwd, settings = {}, host = '') {
  const installMode = typeof settings === 'string'
    ? settings
    : resolveRuntimeInstallMode(settings, host)
  const isActivated = isProjectRuntimeActive(cwd)
  return (installMode === 'global' || isActivated) ? 'bootstrap.md' : 'bootstrap-lite.md'
}

function shouldBypassRoute(prompt) {
  return !prompt || /^\[子代理任务\]/.test(prompt)
}

function buildHelpExtraRules(skillName) {
  if (skillName !== 'help') return ''
  return ' 这是 HelloAGENTS 的帮助命令，不是宿主 CLI 的内置帮助。仅显示 HelloAGENTS 的帮助和当前设置；优先使用当前会话上下文中已注入的“当前用户设置”、配置文件原始 JSON 或此前读取结果摘要，上下文不存在或缺少要展示的配置项时才读取一次 ~/.helloagents/helloagents.json；自动激活技能说明仅在全局模式或已激活项目中生效。不要调用宿主 CLI 的帮助工具（如 cli_help 或 /help），不要使用子代理，不要读取项目文件；若受工作区限制无法读取配置，必须明确说明并按已知默认值或已注入设置展示。'
}

function routeExplicitCommand({
  prompt,
  payload,
  cwd,
  host,
  pkgRoot,
  settings,
  resolveCanonicalCommandSkill,
  writeRouteContext,
  appendReplayEvent,
  buildRouteInstruction,
  suppress,
  recordReplayEvents,
}) {
  const cmdMatch = prompt.match(/^~(\w+)/)
  if (!cmdMatch) return false

  const skillName = cmdMatch[1]
  const canonicalSkillName = resolveCanonicalCommandSkill(skillName)
  writeRouteContext({
    cwd,
    skillName: canonicalSkillName,
    sourceSkillName: skillName,
    payload,
  })
  if (recordReplayEvents !== false) {
    appendReplayEvent(cwd, {
      host,
      event: 'command_route_selected',
      source: 'route',
      skillName: canonicalSkillName,
      sourceSkillName: skillName,
      payload,
    })
  }
  suppress(buildRouteInstruction({
    skillName,
    extraRules: buildHelpExtraRules(skillName),
    cwd,
    pkgRoot,
    host,
    settings,
    payload,
  }))
  return true
}

export function handleRouteCommand({
  payload,
  host,
  pkgRoot,
  settings,
  buildRouteInstruction,
  buildSemanticRouteInstruction,
  resolveCanonicalCommandSkill,
  writeRouteContext,
  clearRouteContext,
  appendReplayEvent,
  getWorkflowRecommendation,
  suppress,
  emptySuppress,
  recordReplayEvents = true,
}) {
  const prompt = (payload.prompt || '').trim()
  const cwd = payload.cwd || process.cwd()
  if (shouldBypassRoute(prompt)) {
    clearRouteContext({ cwd, payload })
    emptySuppress()
    return
  }

  if (routeExplicitCommand({
    prompt,
    payload,
    cwd,
    host,
    pkgRoot,
    settings,
    resolveCanonicalCommandSkill,
    writeRouteContext,
    appendReplayEvent,
    buildRouteInstruction,
    suppress,
    recordReplayEvents,
  })) {
    return
  }

  const bootstrapFile = resolveBootstrapFile(cwd, settings, host)
  if (bootstrapFile === 'bootstrap.md') {
    clearRouteContext({ cwd, payload })
    if (recordReplayEvents !== false) {
      appendReplayEvent(cwd, {
        host,
        event: 'semantic_route_prompted',
        source: 'route',
        recommendation: getWorkflowRecommendation(cwd, { payload }),
        payload,
      })
    }
    suppress(buildSemanticRouteInstruction(cwd, payload))
    return
  }

  clearRouteContext({ cwd, payload })
  emptySuppress()
}
