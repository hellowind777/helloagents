import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { REPO_ROOT } from './helpers/test-env.mjs';

function read(relativePath) {
  return readFileSync(join(REPO_ROOT, relativePath), 'utf-8');
}

test('bootstrap rules restrict HelloAGENTS wrapper to final non-streaming close-out replies only', () => {
  for (const file of ['bootstrap.md', 'bootstrap-lite.md']) {
    const content = read(file);
    assert.match(content, /适用条件：/);
    assert.match(content, /排除条件：/);
    assert.match(content, /输出格式：/);
    assert.match(content, /使用约束：/);
    assert.match(content, /主代理仅可在本轮最后一条/);
    assert.match(content, /使用输出格式/);
    assert.match(content, /(某个|任何) skill 在本轮(?:如)?明确要求输出停顿、确认或总结/);
    assert.match(content, /不再继续调用工具.*不再继续执行/);
    assert.match(content, /收尾消息/);
    assert.match(content, /以下内容一律视为中间输出/);
    assert.match(content, /不得使用输出格式/);
    assert.match(content, /子代理在任何场景下都不得使用输出格式/);
    assert.match(content, /状态图标与收尾内容必须一致/);
    assert.match(content, /仅在本轮执行已完成且不再等待用户输入时，才能使用 `✅完成`/);
    assert.match(content, /无意义的客套、邀约/);
  }
});

test('skill and help docs describe output_format as final-summary only', () => {
  const helloagentsSkill = read('skills/helloagents/SKILL.md');
  assert.match(helloagentsSkill, /不得包装 HelloAGENTS 外层输出格式/);
  assert.match(helloagentsSkill, /本轮最终收尾消息/);
  assert.match(helloagentsSkill, /所有流式内容、进度或状态汇报、中间文本/);

  const subagentSkill = read('skills/hello-subagent/SKILL.md');
  assert.match(subagentSkill, /团队协作中的进度与状态汇报都属于中间输出/);
  assert.match(subagentSkill, /本轮最终收尾时才可使用 HelloAGENTS 外层输出格式/);

  const helpSkill = read('skills/commands/help/SKILL.md');
  assert.match(helpSkill, /仅主代理在最终收尾回复使用 HelloAGENTS 格式/);
  assert.match(helpSkill, /所有流式\/中间输出及子代理输出保持自然/);
});
