import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { buildCommandRouteHint, buildStateSyncHint, buildWorkflowRouteHint } from './workflow-state.mjs';
import { buildCapabilityHint } from './capability-registry.mjs';
import {
  buildProjectStorageBlock,
  buildProjectStorageHint,
  describeProjectStoreFile,
} from './project-storage.mjs';

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
  return `## 本轮 HelloAGENTS 读取根目录\n\`\`\`json\n${JSON.stringify(readRoot, null, 2)}\n\`\`\``;
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
      summaryParts.push('## 恢复快照（从 STATE.md 读取，只用于找回上次停在哪）');
      summaryParts.push('恢复时先看当前用户消息，确认仍是同一任务再按 STATE.md 接续。');
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

  const projectStorageBlock = buildProjectStorageBlock(cwd);
  if (projectStorageBlock) {
    summaryParts.push('');
    summaryParts.push(projectStorageBlock);
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
  const projectStorageBlock = buildProjectStorageBlock(cwd);
  const stateSyncHint = buildStateSyncHint(cwd);
  const settingsBlock = Object.keys(settings).length
    ? `\n\n## 当前用户设置\n\`\`\`json\n${JSON.stringify(settings, null, 2)}\n\`\`\``
    : '';

  let context = bootstrap;
  if (packageRootBlock) context += `\n\n${packageRootBlock}`;
  if (readRootBlock) context += `\n\n${readRootBlock}`;
  if (projectStorageBlock) context += `\n\n${projectStorageBlock}`;
  if (workflowHint) context += `\n\n## 当前工作流提示\n${workflowHint}`;
  if (capabilityHint) context += `\n\n## 当前按需能力\n${capabilityHint}`;
  if (stateSyncHint) context += `\n\n## STATE.md 提醒\n${stateSyncHint}`;
  context += settingsBlock;
  if (source === 'resume' || source === 'compact') {
    context += '\n\n> ⚠️ 会话已恢复/压缩，请先读取 `.helloagents/STATE.md` 恢复工作状态；先看当前用户消息确认仍是同一任务，再按 STATE.md 接续。';
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
  const projectStorageHint = buildProjectStorageHint(cwd);
  return `用户使用了 ~${skillName} 命令。当前命令技能文件已解析为：${skillPath}。请直接读取这个 SKILL.md；不要再探测其他 helloagents 路径。${aliasNote ? ` ${aliasNote}` : ''}${projectStorageHint ? ` ${projectStorageHint}` : ''}${commandHint ? ` ${commandHint}` : ''}${capabilityHint ? ` ${capabilityHint}` : ''}${extraRules}`;
}

export function buildSemanticRouteInstruction(cwd) {
  const workflowHint = buildWorkflowRouteHint(cwd);
  const capabilityHint = buildCapabilityHint({ cwd });
  const projectStorageHint = buildProjectStorageHint(cwd);
  return [
    '当前消息未使用 ~command。',
    '请根据用户请求的真实意图选路，不依赖关键词表。',
    'Delivery Tier: T0=探索/比较；T1=低风险小改动或显式验证；T2=多文件功能/新项目/需要结构化产物；T3=高风险或不可逆链路。',
    '路由映射：~idea=只读探索，不创建文件；~build=明确实现；~verify=审查/验证；~plan=结构化规划；~prd=重型规格；~auto=自动编排并自动衔接后续阶段。',
    '若判定为 T3，默认先走 ~plan / ~prd；纯审查/验证请求才优先 ~verify。',
    `涉及 UI 任务时，设计决策优先级：当前活跃 plan / PRD → ${describeProjectStoreFile(cwd, 'DESIGN.md')} → 通用 UI 规则。`,
    projectStorageHint,
    workflowHint ? `项目状态：${workflowHint}` : '',
    capabilityHint,
    '意图明确时直接按对应路径推进，不要把选路过程暴露给用户。',
  ].filter(Boolean).join(' ');
}
