import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';

import { REPO_ROOT, readText } from './helpers/test-env.mjs';

test('workflow contract keeps route and design rules aligned', () => {
  const blueprint = readText(join(REPO_ROOT, 'docs', 'workflow-blueprint.md'));
  assert.match(blueprint, /语言无关的意图分析/);
  assert.match(blueprint, /尽量避免非必要的关键词判断/);

  const notifyContext = readText(join(REPO_ROOT, 'scripts', 'notify-context.mjs'));
  assert.match(notifyContext, /语言无关的 ROUTE \/ TIER 语义判断/);
  assert.match(notifyContext, /不依赖关键词表/);

  const designTemplate = readText(join(REPO_ROOT, 'templates', 'DESIGN.md'));
  for (const section of ['产品表面', '组件与模式', '状态覆盖', '无障碍要求', '禁止事项', '实现备注']) {
    assert.match(designTemplate, new RegExp(`## ${section}`));
  }

  const helloUi = readText(join(REPO_ROOT, 'skills', 'hello-ui', 'SKILL.md'));
  assert.match(helloUi, /设计契约优先级/);
  assert.match(helloUi, /plan\.md/);
  assert.match(helloUi, /\.helloagents\/DESIGN\.md/);
  assert.match(helloUi, /最小设计契约/);

  for (const file of ['bootstrap.md', 'bootstrap-lite.md']) {
    const content = readText(join(REPO_ROOT, file));
    assert.match(content, /Delivery Tier/);
    assert.match(content, /`T0`/);
    assert.match(content, /`T3`/);
    assert.match(content, /plan\.md/);
  }
});
