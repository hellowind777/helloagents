import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { REPO_ROOT } from './helpers/test-env.mjs';

function read(relativePath) {
  return readFileSync(join(REPO_ROOT, relativePath), 'utf-8');
}

test('bootstrap rules restrict HelloAGENTS wrapper to terminal close-out replies only', () => {
  for (const file of ['bootstrap.md', 'bootstrap-lite.md']) {
    const content = read(file);
    assert.match(content, /外层格式仅用于主代理在本轮结束时发出的\*\*收尾消息\*\*/);
    assert.match(content, /只有该 skill 在当前轮明确产出停顿、确认或总结/);
    assert.match(content, /子代理无论是否触发或读取 skill，均不得使用以下格式/);
    assert.match(content, /不再继续调用工具\/不再继续执行/);
    assert.match(content, /流式输出阶段的可见文本/);
    assert.match(content, /工具执行中的状态汇报/);
    assert.match(content, /禁止使用顶部信息栏和底部操作栏/);
  }
});

test('skill and help docs describe output_format as close-out only, not streaming formatting', () => {
  const helloagentsSkill = read('skills/helloagents/SKILL.md');
  assert.match(helloagentsSkill, /都不得包装 HelloAGENTS 外层输出格式/);
  assert.match(helloagentsSkill, /只有当该 skill 在当前轮明确要求输出停顿、确认或总结/);

  const helpSkill = read('skills/commands/help/SKILL.md');
  assert.match(helpSkill, /仅主代理的最终收尾回复可使用 HelloAGENTS 格式/);
  assert.match(helpSkill, /所有子代理输出保持自然/);
});
