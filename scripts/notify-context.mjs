import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { buildCommandRouteHint, buildStateSyncHint, buildWorkflowRouteHint } from './workflow-state.mjs';
import { buildCapabilityHint } from './capability-registry.mjs';

const COMMAND_ALIASES = {
  do: 'build',
  design: 'plan',
  review: 'verify',
};

function buildPackageRootBlock(pkgRoot) {
  if (!pkgRoot) return '';
  return `## 当前 HelloAGENTS 包根目录\n\`\`\`text\n${pkgRoot}\n\`\`\``;
}

function resolveStandbyHostRoot(host) {
  const home = homedir();
  const map = {
    claude: join(home, '.claude', 'helloagents'),
    codex: join(home, '.codex', 'helloagents'),
    gemini: join(home, '.gemini', 'helloagents'),
  };
  return map[host] || '';
}

function resolveReadRoot({ cwd, pkgRoot, host, settings }) {
  const projectRoot = join(cwd, 'skills', 'helloagents');
  if (existsSync(projectRoot)) {
    return { source: 'project', root: projectRoot };
  }

  if (settings.install_mode === 'standby') {
    const standbyRoot = resolveStandbyHostRoot(host);
    if (standbyRoot && existsSync(standbyRoot)) {
      return { source: 'standby-home', root: standbyRoot };
    }
  }

  return { source: 'package', root: pkgRoot };
}

function buildReadRootBlock(readRoot) {
  if (!readRoot?.root) return '';
  return `## 当前 HelloAGENTS 读取根目录\n\`\`\`json\n${JSON.stringify(readRoot, null, 2)}\n\`\`\``;
}

export function resolveCanonicalCommandSkill(skillName) {
  return COMMAND_ALIASES[skillName] || skillName;
}

function buildAliasRouteNote(skillName) {
  if (skillName === 'do') {
    return '兼容别名映射：本次按 ~build 规则执行。';
  }
  if (skillName === 'design') {
    return '兼容别名映射：本次按 ~plan 规则执行；方案文件使用 `plan.md`，项目级 UI 契约仍使用 `DESIGN.md`。';
  }
  if (skillName === 'review') {
    return '兼容别名映射：本次按 ~verify 的审查优先模式执行。';
  }
  return '';
}

export function buildCompactionContext({ payload, pkgRoot, settings, bootstrapFile, host }) {
  const summaryParts = [];
  summaryParts.push('## HelloAGENTS 压缩摘要');
  summaryParts.push('以下信息在上下文压缩前保存，确保压缩后不丢失关键状态。');

  const cwd = payload.cwd || process.cwd();
  const statePath = join(cwd, '.helloagents', 'STATE.md');
  const stateSyncHint = buildStateSyncHint(cwd);
  if (existsSync(statePath)) {
    try {
      const stateContent = readFileSync(statePath, 'utf-8');
      summaryParts.push('');
      summaryParts.push('## 恢复游标（从 STATE.md 读取，只用于找回上次停在哪）');
      summaryParts.push('使用约束：当前用户消息、显式命令、活跃方案包 / PRD 与代码事实优先；只有确认仍是同一主线时，才按 STATE.md 接续。');
      summaryParts.push(stateContent);
    } catch {}
  }

  let bootstrap = '';
  try {
    bootstrap = readFileSync(join(pkgRoot, bootstrapFile), 'utf-8');
  } catch {}
  if (bootstrap) {
    summaryParts.push('');
    summaryParts.push('## 核心规则（从 bootstrap 重新注入）');
    summaryParts.push(bootstrap);
  }

  const packageRootBlock = buildPackageRootBlock(pkgRoot);
  if (packageRootBlock) {
    summaryParts.push('');
    summaryParts.push(packageRootBlock);
  }

  const readRootBlock = buildReadRootBlock(resolveReadRoot({ cwd, pkgRoot, host, settings }));
  if (readRootBlock) {
    summaryParts.push('');
    summaryParts.push(readRootBlock);
  }

  if (stateSyncHint) {
    summaryParts.push('');
    summaryParts.push('## STATE.md 提醒');
    summaryParts.push(stateSyncHint);
  }

  if (Object.keys(settings).length) {
    summaryParts.push('');
    summaryParts.push(`## 当前用户设置\n\`\`\`json\n${JSON.stringify(settings, null, 2)}\n\`\`\``);
  }

  return summaryParts.join('\n');
}

export function buildInjectContext({ source, bootstrap, settings, pkgRoot, host, cwd }) {
  const packageRootBlock = buildPackageRootBlock(pkgRoot);
  const readRootBlock = buildReadRootBlock(resolveReadRoot({ cwd, pkgRoot, host, settings }));
  const workflowHint = buildWorkflowRouteHint(cwd);
  const capabilityHint = buildCapabilityHint({ cwd });
  const stateSyncHint = buildStateSyncHint(cwd);
  const settingsBlock = Object.keys(settings).length
    ? `\n\n## 当前用户设置\n\`\`\`json\n${JSON.stringify(settings, null, 2)}\n\`\`\``
    : '';

  let context = bootstrap;
  if (packageRootBlock) context += `\n\n${packageRootBlock}`;
  if (readRootBlock) context += `\n\n${readRootBlock}`;
  if (workflowHint) context += `\n\n## 当前工作流提示\n${workflowHint}`;
  if (capabilityHint) context += `\n\n## 当前按需能力\n${capabilityHint}`;
  if (stateSyncHint) context += `\n\n## STATE.md 提醒\n${stateSyncHint}`;
  context += settingsBlock;
  if (source === 'resume' || source === 'compact') {
    context += '\n\n> ⚠️ 会话已恢复/压缩，请先读取 `.helloagents/STATE.md` 找回上次停在哪；但必须先用当前用户消息、显式命令、活跃方案包 / PRD 与代码事实确认是否仍是同一主线，只有同一主线才按 STATE.md 接续。';
  }
  return context;
}

export function buildRouteInstruction({ skillName, extraRules = '', cwd, pkgRoot, host, settings }) {
  const readRoot = resolveReadRoot({ cwd, pkgRoot, host, settings });
  const canonicalSkillName = resolveCanonicalCommandSkill(skillName);
  const skillPath = join(readRoot.root, 'skills', 'commands', canonicalSkillName, 'SKILL.md');
  const aliasNote = buildAliasRouteNote(skillName);
  const commandHint = buildCommandRouteHint(canonicalSkillName, cwd);
  const capabilityHint = buildCapabilityHint({ cwd, skillName: canonicalSkillName });
  return `用户使用了 ~${skillName} 命令。当前命令技能文件已解析为：${skillPath}。请直接读取这个 SKILL.md；本轮不要再为同一个命令 skill 重复 Test-Path / Get-Content，也不要探测其他 helloagents 路径。${aliasNote ? ` ${aliasNote}` : ''}${commandHint ? ` ${commandHint}` : ''}${capabilityHint ? ` ${capabilityHint}` : ''}${extraRules}`;
}

export function buildSemanticRouteInstruction(cwd) {
  const workflowHint = buildWorkflowRouteHint(cwd);
  const capabilityHint = buildCapabilityHint({ cwd });
  return [
    '当前消息未使用 ~command。',
    '请先基于用户请求的真实意图做一次语言无关的 ROUTE / TIER 语义判断，不依赖关键词表，也不要通过扩充多语言词库来选路。',
    'Delivery Tier: T0=探索/比较/发散；T1=低风险小改动或显式验证；T2=多文件功能/新项目/需要结构化 artifact；T3=高风险或不可逆链路（如认证、安全、支付、数据库、生产发布）。',
    '路由映射：~idea=轻量探索且零副作用，不创建 .helloagents / STATE.md / 方案包，也不执行会改写工作区或外部状态的操作；~build=明确实现；~verify=审查/验证；~plan=结构化规划；~prd=重型规格；~auto=自动编排。',
    '若判定为 T3，默认先走 ~plan / ~prd；只有纯审查、纯验真或纯验证请求才优先走 ~verify，不要直接跳入 ~build。',
    '若判定为 UI / 视觉 / 交互任务，后续所选路径中优先把当前活跃 plan / PRD 的 UI 决策作为 feature 约束，其次读取 `.helloagents/DESIGN.md`，最后才补充通用 UI 规则。',
    workflowHint ? `项目状态补充：${workflowHint}` : '',
    capabilityHint,
    '若意图已明确，直接按对应路径推进；不要把这一步暴露成额外说明，也不要为了选路重复向用户提问。',
  ].filter(Boolean).join(' ');
}
