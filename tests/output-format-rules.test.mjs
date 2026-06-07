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
    assert.ok(content.indexOf('【子代理短路】') < content.indexOf('# HelloAGENTS'));
    assert.match(content, /立即跳过本文件后续仅面向主代理的规则/);
    assert.match(content, /安全、质量、验证和失败处理规则仍持续生效/);
    assert.match(content, /## 通用交付规则（强制）/);
    assert.match(content, /### 产出质量/);
    assert.ok(content.indexOf('### 执行纪律') < content.indexOf('### 表达与语气'));
    assert.match(content, /### 表达与语气/);
    assert.doesNotMatch(content, /#### 交付方式/);
    assert.doesNotMatch(content, /#### 用语与术语/);
    assert.doesNotMatch(content, /#### 收敛与修改原则/);
    assert.match(content, /都必须同时遵守本节全部规则/);
    assert.match(content, /普通问答、解释、分析、改写、邮件回复和其他一次性交付/);
    assert.match(content, /一次做完，直接推进：用户需求明确且已获得执行授权，或已明确同意方案、修改方向或继续执行时，必须持续执行到完成/);
    assert.match(content, /不得把可执行动作改写为建议、可选项、等待确认，也不用“下一步建议”代替实际执行/);
    assert.match(content, /涉及判断与取舍时，先判断约束是否真实，再给干净目标，最后再谈迁移路径。/);
    assert.match(content, /若明显被当前实现、旧命名、旧目录、半成品结构或兼容压力拖住，先切到终局倒推或零遗留视角，重看正确目标。/);
    assert.match(content, /公开 API、持久化数据、已文档化集成、用户承诺、部署与合规要求等才算真实约束；内部调用方、旧命名、旧目录结构、半成品实现和“改动会很大”不自动成立。/);
    assert.match(content, /纯翻译、纯改写、纯提取、纯格式转换，以及无判断空间的机械执行不强制展开/);
    assert.match(content, /默认只交付与当前请求直接对应的一版最终结果/);
    assert.match(content, /“一版”只限制版本数量，不限制完成当前请求所需的必要内容/);
    assert.match(content, /请求已满足时直接结束，不主动追加无执行价值的延伸、派生版本、不同写法、第二版或邀约式收尾/);
    assert.match(content, /准确优先于压缩：不得为了更短而省略必要的条件、边界、风险、状态、路径、验证结论或下一步动作/);
    assert.match(content, /回复末尾只保留结论、风险、限制、已完成状态、阻塞项或真实下一步动作/);
    assert.match(content, /不输出客套内容、重复确认或无执行价值的自我能力陈述/);
    assert.match(content, /说话像成熟同事，不像客服、销售或咨询顾问/);
    assert.match(content, /直接回答，少无执行价值的铺垫。需要先给结论时先给结论，再补必要细节。能用一版说清就只给一版/);
    assert.match(content, /用词用语和表述方式保持自然、清晰、准确、合理、统一，不重复赘述、不冗余、不过度精简；非必要时只使用当前回复语言表达所有用户可见文本。优先使用普通、易懂、贴近用户的表达。必要术语先解释，再补原名；首次说明后固定一个称呼，不反复中英切换/);
    assert.match(content, /不输出黑话、营销话、内部化表述或空泛形容，也不为了显得专业而堆黑话。同一概念前后用语保持一致，避免同义反复、重复解释和堆砌近义句/);
    assert.match(content, /遵循就地收敛原则/);
    assert.match(content, /优先在原条目内收敛表达/);
    assert.match(content, /复用已有概念和表述/);
    assert.match(content, /同步删除重复表述/);
    assert.match(content, /适用条件：/);
    assert.match(content, /排除条件：/);
    assert.match(content, /输出格式：/);
    assert.match(content, /使用约束：/);
    assert.match(content, /输出格式只在缺少 `output_format` 已知值时触发读取/);
    assert.match(content, /会话级缓存优先/);
    assert.match(content, /同一路径的配置文件、模块、SKILL、模板只读一次/);
    assert.match(content, /主代理必须在每轮对话最后一条/);
    assert.match(content, /使用输出格式/);
  assert.match(content, /(某个|任何) skill 在当前对话明确要求输出停顿、确认或总结/);
    assert.match(content, /不再继续调用工具.*不再继续执行/);
    assert.match(content, /最终回复/);
    assert.match(content, /以下内容一律视为中间输出/);
    assert.match(content, /不得使用输出格式/);
    assert.match(content, /凡是不直接面向最终用户终局交付的回复/);
    assert.match(content, /当前对话尚未结束的回复/);
    assert.doesNotMatch(content, /包括子代理、协作汇报和会交回上级代理继续处理的结果/);
    assert.doesNotMatch(content, /子代理不得写 turn-state/);
    assert.match(content, /首行必须保留 `【HelloAGENTS】` 和连字符 `-`，不得省略/);
    assert.match(content, /状态图标与收尾内容必须一致/);
    assert.match(content, /仅在当前对话执行已完成且不存在待确认动作时，才能使用 `✅完成`/);
    assert.match(content, /同一条最终回复只使用一次该格式/);
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
  assert.ok(helloagentsSkill.indexOf('【子代理短路】') < helloagentsSkill.indexOf('# HelloAGENTS'));
  assert.match(helloagentsSkill, /立即跳过本 skill 后续仅面向主代理的规则/);
  assert.match(helloagentsSkill, /不得包装 HelloAGENTS 外层输出格式/);
  assert.match(helloagentsSkill, /直接面向最终用户、且当前对话已经结束的终局交付/);
  assert.match(helloagentsSkill, /通用输出格式/);
  assert.match(helloagentsSkill, /流式内容、进度或状态汇报、中间文本/);
  assert.match(helloagentsSkill, /直接面向最终用户/);
  assert.match(helloagentsSkill, /当前对话尚未结束的文本/);
  assert.doesNotMatch(helloagentsSkill, /子代理不得写 turn-state/);
  assert.match(helloagentsSkill, /最终回复中的 `🔄 下一步` 写真实动作/);
  assert.match(helloagentsSkill, /已获授权且可继续执行时不得收尾/);
  assert.match(helloagentsSkill, /同一条最终回复只包装一次/);
  assert.match(helloagentsSkill, /不在正文里再次输出 `【HelloAGENTS】` 或第二个 `🔄 下一步`/);

  assert.match(helloagentsSkill, /“一版”只限制版本数量，不限制完成当前请求所需的必要内容/);

  const helloWriteSkill = read('skills/hello-write/SKILL.md');
  assert.match(helloWriteSkill, /通用交付规则中的执行纪律与表达与语气要求/);
  assert.match(helloWriteSkill, /邮件回复、问答说明、措辞改写/);
  assert.match(helloWriteSkill, /默认交付一个可直接使用的最终文本/);
  assert.match(helloWriteSkill, /“一个”只限制版本数量，不限制完成当前请求所需的必要篇幅、说明深度和结构/);
  assert.match(helloWriteSkill, /先直接给可用文本或结论，再补必要说明/);
  assert.match(helloWriteSkill, /未明确要求多版本时，只给一个最终版本/);
  assert.match(helloWriteSkill, /必要背景、条件、边界、风险、步骤和示例不得省略/);
  assert.match(helloWriteSkill, /文本已满足请求时直接结束，不加无执行价值的邀约式收尾/);
  assert.doesNotMatch(helloWriteSkill, /简洁、自然、准确、合理、不赘述、不冗余、不过度精简/);
  assert.match(helloWriteSkill, /不重复同一结论/);

  const subagentSkill = read('skills/hello-subagent/SKILL.md');
  assert.match(subagentSkill, /团队协作中的进度与状态汇报都属于中间输出/);
  assert.match(subagentSkill, /交回上级代理继续汇总、决策或复述/);
  assert.match(subagentSkill, /不包装 HelloAGENTS 外层格式/);

  const readmeEn = read('README.md');
  assert.match(readmeEn, /direct final-user closeout from the main agent uses the HelloAGENTS layout/);
  assert.match(readmeEn, /That wrapper is now reserved for direct final-user delivery only/);

  const readmeCn = read('README_CN.md');
  assert.match(readmeCn, /仅主代理直接面向最终用户的终局交付使用 HelloAGENTS 格式/);
  assert.match(readmeCn, /这个外层格式现在只保留给直接面向最终用户的终局交付/);

  const helpSkill = read('skills/commands/help/SKILL.md');
  assert.match(helpSkill, /缺少下表任一配置项/);
  assert.match(helpSkill, /后续轮次复用/);
  assert.match(helpSkill, /主代理最终回复必须使用 HelloAGENTS 格式/);
  assert.match(helpSkill, /流式\/中间输出及子代理输出保持自然/);
});
