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
    assert.match(content, /主代理在本轮最后一条/);
    assert.match(content, /必须使用以下格式/);
    assert.match(content, /(某个|任何) skill 在当前轮(?:如)?明确要求输出停顿、确认或总结/);
    assert.match(content, /已经结束流式输出/);
    assert.match(content, /不再继续调用工具、不再继续执行/);
    assert.match(content, /所有流式内容、进度说明、状态汇报、中间输出/);
    assert.match(content, /禁止使用顶部信息栏和底部操作栏/);
    assert.match(content, /子代理在任何场景下都不得使用该格式/);
    assert.match(content, /状态图标与收尾内容必须一致/);
    assert.match(content, /仅在本轮执行已完成且不再等待用户输入时才能使用 `✅完成`/);
    assert.match(content, /条件式能力表述或询问句/);
  }
});

test('skill and help docs describe output_format as final-summary only', () => {
  const helloagentsSkill = read('skills/helloagents/SKILL.md');
  assert.match(helloagentsSkill, /都不得包装 HelloAGENTS 外层输出格式/);
  assert.match(helloagentsSkill, /已经结束流式输出的最终收尾消息/);
  assert.match(helloagentsSkill, /所有流式内容、进度或状态汇报、中间文本/);

  const subagentSkill = read('skills/hello-subagent/SKILL.md');
  assert.match(subagentSkill, /团队协作中的进度与状态汇报都属于中间输出/);
  assert.match(subagentSkill, /只有在本轮结束流式输出并最终收尾时才可使用 HelloAGENTS 外层输出格式/);

  const helpSkill = read('skills/commands/help/SKILL.md');
  assert.match(helpSkill, /仅主代理在流式结束后的最终收尾回复可使用 HelloAGENTS 格式/);
  assert.match(helpSkill, /所有流式\/中间输出及所有子代理输出保持自然/);
});
