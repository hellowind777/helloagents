import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

export function buildCompactionContext({ payload, pkgRoot, settings, bootstrapFile }) {
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

  if (Object.keys(settings).length) {
    summaryParts.push('');
    summaryParts.push(`## 当前用户设置\n\`\`\`json\n${JSON.stringify(settings, null, 2)}\n\`\`\``);
  }

  return summaryParts.join('\n');
}

export function buildInjectContext({ source, bootstrap, settings }) {
  const settingsBlock = Object.keys(settings).length
    ? `\n\n## 当前用户设置\n\`\`\`json\n${JSON.stringify(settings, null, 2)}\n\`\`\``
    : '';

  let context = bootstrap + settingsBlock;
  if (source === 'resume' || source === 'compact') {
    context += '\n\n> ⚠️ 会话已恢复/压缩，请先读取 .helloagents/STATE.md 恢复工作状态。';
  }
  return context;
}

export function buildRouteInstruction(skillName, extraRules = '') {
  return `用户使用了 ~${skillName} 命令。请按以下顺序读取对应 SKILL.md，找到即停：1. {CWD}/skills/helloagents/skills/commands/${skillName}/SKILL.md 2. ~/.{当前CLI名称}/helloagents/skills/commands/${skillName}/SKILL.md 3. 当前已加载 HelloAGENTS 包根目录下的 skills/commands/${skillName}/SKILL.md。不要自行探索、猜测或改读其他命令 skill。${extraRules}`;
}

export function detectNewProjectRoute(prompt) {
  const newProjectPatterns = [
    /(?:创建|新建|从零|搭建).*(?:项目|应用|系统|网站|游戏|工具|平台|小程序|APP)/,
    /(?:做|写|开发|实现)[一个]*.*(?:项目|应用|系统|网站|游戏|工具|平台|小程序|APP)/,
    /\b(build|create|design|make|new|start|init)\b.*\b(app|game|project|site|website|tool|system|platform)\b/i,
  ];

  for (const pattern of newProjectPatterns) {
    if (pattern.test(prompt)) {
      return '检测到可能是新项目/新应用任务。根据 HelloAGENTS 路由规则，新项目必须进入 ~design 设计流程。请引导用户进入 ~design。';
    }
  }
  return '';
}
