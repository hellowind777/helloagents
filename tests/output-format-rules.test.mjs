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
    assert.match(content, /语言与表述（强制）/);
    assert.match(content, /简洁、自然、准确、合理、不赘述、不冗余、不过度精简/);
    assert.match(content, /准确优先于压缩/);
    assert.match(content, /不输出黑话、营销话、内部化表述或空泛形容/);
    assert.match(content, /不输出客套内容、邀约式表述、重复确认、能力陈述或空泛建议/);
    assert.match(content, /优先在原条目内收敛表达/);
    assert.match(content, /同步删除重复表述/);
    assert.match(content, /适用条件：/);
    assert.match(content, /排除条件：/);
    assert.match(content, /输出格式：/);
    assert.match(content, /使用约束：/);
    assert.match(content, /输出格式只在缺少 `output_format` 已知值时触发读取/);
    assert.match(content, /会话级缓存优先/);
    assert.match(content, /同一路径的配置文件、模块、SKILL、模板只读一次/);
    assert.match(content, /主代理必须在本轮最后一条/);
    assert.match(content, /使用输出格式/);
    assert.match(content, /(某个|任何) skill 在本轮(?:如)?明确要求输出停顿、确认或总结/);
    assert.match(content, /不再继续调用工具.*不再继续执行/);
    assert.match(content, /收尾消息/);
    assert.match(content, /以下内容一律视为中间输出/);
    assert.match(content, /不得使用输出格式/);
    assert.match(content, /子代理在任何场景下都不得使用输出格式/);
    assert.match(content, /首行必须保留 `【HelloAGENTS】` 和连字符 `-`，不得省略/);
    assert.match(content, /状态图标与收尾内容必须一致/);
    assert.match(content, /仅在本轮执行已完成且不存在待确认动作时，才能使用 `✅完成`/);
    assert.match(content, /同一条最终收尾消息只使用一次该格式/);
    assert.match(content, /不得在正文中再次输出 `【HelloAGENTS】` 或第二个 `🔄 下一步`/);
    assert.match(content, /含确认是否执行已给出的方案/);
    assert.match(content, /若正在等待确认，写清待确认动作/);
    assert.match(content, /不用“下一步建议”代替实际执行/);
    assert.match(content, /必须写真正的下一步动作/);
    assert.match(content, /不写单纯当前状态或条件式能力表述/);
    assert.match(content, /含确认是否执行已给出的方案或修改/);
    assert.match(content, /若仍有已授权且可继续执行的动作，不得收尾，必须继续执行/);
  }
});

test('skill and help docs describe output_format as final-summary only', () => {
  const helloagentsSkill = read('skills/helloagents/SKILL.md');
  assert.match(helloagentsSkill, /不得包装 HelloAGENTS 外层输出格式/);
  assert.match(helloagentsSkill, /本轮最终收尾消息/);
  assert.match(helloagentsSkill, /通用输出格式/);
  assert.match(helloagentsSkill, /流式内容、进度或状态汇报、中间文本/);
  assert.match(helloagentsSkill, /最终收尾中的 `🔄 下一步` 写真实动作/);
  assert.match(helloagentsSkill, /已获授权且可继续执行时不得收尾/);
  assert.match(helloagentsSkill, /同一条最终收尾消息只包装一次/);
  assert.match(helloagentsSkill, /不在正文里再次输出 `【HelloAGENTS】` 或第二个 `🔄 下一步`/);

  const helloWriteSkill = read('skills/hello-write/SKILL.md');
  assert.match(helloWriteSkill, /通用语言与表述要求/);
  assert.doesNotMatch(helloWriteSkill, /简洁、自然、准确、合理、不赘述、不冗余、不过度精简/);
  assert.match(helloWriteSkill, /不重复同一结论/);

  const subagentSkill = read('skills/hello-subagent/SKILL.md');
  assert.match(subagentSkill, /团队协作中的进度与状态汇报都属于中间输出/);
  assert.match(subagentSkill, /本轮最终收尾时才可使用 HelloAGENTS 外层输出格式/);

  const readmeEn = read('README.md');
  assert.match(readmeEn, /main-agent final closeout must use the HelloAGENTS layout/);

  const readmeCn = read('README_CN.md');
  assert.match(readmeCn, /主代理最终收尾必须使用 HelloAGENTS 格式/);

  const helpSkill = read('skills/commands/help/SKILL.md');
  assert.match(helpSkill, /缺少下表任一配置项/);
  assert.match(helpSkill, /后续轮次复用/);
  assert.match(helpSkill, /主代理最终收尾必须使用 HelloAGENTS 格式/);
  assert.match(helpSkill, /流式\/中间输出及子代理输出保持自然/);
});
