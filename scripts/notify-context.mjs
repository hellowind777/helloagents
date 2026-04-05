import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';

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

export function buildCompactionContext({ payload, pkgRoot, settings, bootstrapFile, host }) {
  const summaryParts = [];
  summaryParts.push('## HelloAGENTS 压缩摘要');
  summaryParts.push('以下信息在上下文压缩前保存，确保压缩后不丢失关键状态。');

  const cwd = payload.cwd || process.cwd();
  const statePath = join(cwd, '.helloagents', 'STATE.md');
  if (existsSync(statePath)) {
    try {
      const stateContent = readFileSync(statePath, 'utf-8');
      summaryParts.push('');
      summaryParts.push('## 恢复快照（从 STATE.md 读取，读完即可接上工作）');
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

  if (Object.keys(settings).length) {
    summaryParts.push('');
    summaryParts.push(`## 当前用户设置\n\`\`\`json\n${JSON.stringify(settings, null, 2)}\n\`\`\``);
  }

  return summaryParts.join('\n');
}

export function buildInjectContext({ source, bootstrap, settings, pkgRoot, host, cwd }) {
  const packageRootBlock = buildPackageRootBlock(pkgRoot);
  const readRootBlock = buildReadRootBlock(resolveReadRoot({ cwd, pkgRoot, host, settings }));
  const settingsBlock = Object.keys(settings).length
    ? `\n\n## 当前用户设置\n\`\`\`json\n${JSON.stringify(settings, null, 2)}\n\`\`\``
    : '';

  let context = bootstrap;
  if (packageRootBlock) context += `\n\n${packageRootBlock}`;
  if (readRootBlock) context += `\n\n${readRootBlock}`;
  context += settingsBlock;
  if (source === 'resume' || source === 'compact') {
    context += '\n\n> ⚠️ 会话已恢复/压缩，请先读取 .helloagents/STATE.md 恢复工作状态。';
  }
  return context;
}

export function buildRouteInstruction({ skillName, extraRules = '', cwd, pkgRoot, host, settings }) {
  const readRoot = resolveReadRoot({ cwd, pkgRoot, host, settings });
  const skillPath = join(readRoot.root, 'skills', 'commands', skillName, 'SKILL.md');
  return `用户使用了 ~${skillName} 命令。当前命令技能文件已解析为：${skillPath}。请直接读取这个 SKILL.md；本轮不要再为同一个命令 skill 重复 Test-Path / Get-Content，也不要探测其他 helloagents 路径。${extraRules}`;
}

export function buildSemanticRouteInstruction() {
  return [
    '当前消息未使用 ~command。',
    '请先基于用户请求的真实意图做一次语言无关的 ROUTE / TIER 语义判断，不依赖关键词表，也不要通过扩充多语言词库来选路。',
    'Delivery Tier: T0=探索/比较/发散；T1=低风险小改动或显式验证；T2=多文件功能/新项目/需要结构化 artifact；T3=高风险或不可逆链路（如认证、安全、支付、数据库、生产发布）。',
    '路由映射：~idea=轻量探索；~build=明确实现；~verify=审查/验证；~plan=结构化规划；~prd=重型规格；~auto=自动编排。',
    '若意图已明确，直接按对应路径推进；不要把这一步暴露成额外说明，也不要为了选路重复向用户提问。',
  ].join(' ');
}
