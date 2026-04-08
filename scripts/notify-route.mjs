import { existsSync } from 'node:fs'
import { join } from 'node:path'

export function resolveBootstrapFile(cwd, installMode) {
  const isActivated = existsSync(join(cwd, '.helloagents'))
  return (installMode === 'global' || isActivated) ? 'bootstrap.md' : 'bootstrap-lite.md'
}

function shouldBypassRoute(prompt) {
  return !prompt || /^\[子代理任务\]/.test(prompt)
}

function buildHelpExtraRules(skillName) {
  if (skillName !== 'help') return ''
  return ' 这是 HelloAGENTS 的帮助命令，不是宿主 CLI 的内置帮助。仅显示 HelloAGENTS 的帮助和当前设置；优先使用当前上下文中已注入的“当前用户设置”，只有上下文不存在该信息时才尝试读取 ~/.helloagents/helloagents.json；自动激活技能说明仅在全局模式或已激活项目中生效。不要调用宿主 CLI 的帮助工具（如 cli_help 或 /help），不要使用子代理，不要读取项目文件；若受工作区限制无法读取配置，必须明确说明并按已知默认值或已注入设置展示。'
}

function routeExplicitCommand({
  prompt,
  cwd,
  host,
  pkgRoot,
  settings,
  resolveCanonicalCommandSkill,
  writeRouteContext,
  appendReplayEvent,
  buildRouteInstruction,
  suppress,
}) {
  const cmdMatch = prompt.match(/^~(\w+)/)
  if (!cmdMatch) return false

  const skillName = cmdMatch[1]
  const canonicalSkillName = resolveCanonicalCommandSkill(skillName)
  writeRouteContext({
    cwd,
    skillName: canonicalSkillName,
    sourceSkillName: skillName,
  })
  appendReplayEvent(cwd, {
    host,
    event: 'command_route_selected',
    source: 'route',
    skillName: canonicalSkillName,
    sourceSkillName: skillName,
  })
  suppress(buildRouteInstruction({
    skillName,
    extraRules: buildHelpExtraRules(skillName),
    cwd,
    pkgRoot,
    host,
    settings,
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
}) {
  const prompt = (payload.prompt || '').trim()
  const cwd = payload.cwd || process.cwd()
  if (shouldBypassRoute(prompt)) {
    clearRouteContext()
    emptySuppress()
    return
  }

  if (routeExplicitCommand({
    prompt,
    cwd,
    host,
    pkgRoot,
    settings,
    resolveCanonicalCommandSkill,
    writeRouteContext,
    appendReplayEvent,
    buildRouteInstruction,
    suppress,
  })) {
    return
  }

  const bootstrapFile = resolveBootstrapFile(cwd, settings.install_mode)
  if (bootstrapFile === 'bootstrap.md') {
    clearRouteContext()
    appendReplayEvent(cwd, {
      host,
      event: 'semantic_route_prompted',
      source: 'route',
      recommendation: getWorkflowRecommendation(cwd),
    })
    suppress(buildSemanticRouteInstruction(cwd))
    return
  }

  clearRouteContext()
  emptySuppress()
}
