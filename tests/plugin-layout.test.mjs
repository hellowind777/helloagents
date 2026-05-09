import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { REPO_ROOT } from './helpers/test-env.mjs';

function read(relativePath) {
  return readFileSync(join(REPO_ROOT, relativePath), 'utf-8');
}

test('plugin manifests and host hook files match their target CLIs', () => {
  const claudePlugin = JSON.parse(read('.claude-plugin/plugin.json'));
  assert.equal(claudePlugin.author?.name, 'HelloWind');
  assert.equal(claudePlugin.author?.email, 'hellowind777@gmail.com');
  assert.equal(claudePlugin.repository, 'https://github.com/hellowind777/helloagents');
  assert.equal(claudePlugin.skills, './skills');
  assert.equal(claudePlugin.hooks, './hooks/hooks-claude.json');

  const claudeMarketplace = JSON.parse(read('.claude-plugin/marketplace.json'));
  assert.equal(claudeMarketplace.name, 'helloagents');
  assert.doesNotMatch(claudeMarketplace.description, /Development/);
  assert.equal(claudeMarketplace.plugins[0].name, 'helloagents');
  assert.deepEqual(claudeMarketplace.plugins[0].source, {
    source: 'github',
    repo: 'hellowind777/helloagents',
  });
  assert.equal(claudeMarketplace.plugins[0].version, undefined);

  const codexPlugin = JSON.parse(read('.codex-plugin/plugin.json'));
  assert.equal(codexPlugin.skills, './skills');
  assert.equal(codexPlugin.hooks, undefined);

  const geminiExtension = JSON.parse(read('gemini-extension.json'));
  assert.equal(geminiExtension.contextFileName, 'bootstrap.md');

  const geminiHooks = read('hooks/hooks.json');
  assert.match(geminiHooks, /BeforeAgent/);
  assert.match(geminiHooks, /pre-write --gemini/);
  assert.match(geminiHooks, /write_file\|edit_file/);
  assert.match(geminiHooks, /\$\{extensionPath\}/);
  assert.doesNotMatch(geminiHooks, /UserPromptSubmit/);

  const claudeHooks = read('hooks/hooks-claude.json');
  assert.match(claudeHooks, /UserPromptSubmit/);
  assert.match(claudeHooks, /guard\.mjs\\\" pre-write/);
  assert.match(claudeHooks, /Write\|Edit\|NotebookEdit/);
  assert.match(claudeHooks, /\$\{CLAUDE_PLUGIN_ROOT\}/);
  assert.match(claudeHooks, /--claude/);
  assert.doesNotMatch(claudeHooks, /BeforeAgent/);

  const codexHooks = read('hooks/hooks-codex.json');
  assert.match(codexHooks, /SessionStart/);
  assert.match(codexHooks, /UserPromptSubmit/);
  assert.match(codexHooks, /Stop/);
  assert.match(codexHooks, /--codex --silent/);
  assert.match(codexHooks, /\$\{PLUGIN_ROOT\}/);
  assert.doesNotMatch(codexHooks, /statusMessage/);
});

test('bootstrap path rules no longer depend on host-name placeholders or wrong carrier-relative skills paths', () => {
  for (const file of ['bootstrap.md', 'bootstrap-lite.md']) {
    const content = read(file);
    assert.doesNotMatch(content, /当前CLI名称/);
    assert.doesNotMatch(content, /本文件所在目录\/skills\/commands/);
    assert.doesNotMatch(content, /本文件所在目录\/skills\/\{技能名\}/);
    assert.match(content, /### \.helloagents\/ 目录/);
    assert.match(content, /## 项目存储与上下文/);
    assert.match(content, /路径定义：`\{HELLOAGENTS_READ_ROOT\}`/);
    assert.match(content, /不要读取项目路径|不要.*项目目录.*HelloAGENTS skills 路径/);
    assert.match(content, /同一路径的配置文件、模块、SKILL、模板只读一次/);
    assert.match(content, /输出格式只在缺少 `output_format` 已知值时触发读取/);
  }

  const helloagentsSkill = read('skills/helloagents/SKILL.md');
  assert.doesNotMatch(helloagentsSkill, /当前CLI名称/);
  assert.match(helloagentsSkill, /路径定义：`\{HELLOAGENTS_READ_ROOT\}`/);
  assert.match(helloagentsSkill, /不要.*项目目录.*HelloAGENTS skills 路径/);
  assert.match(helloagentsSkill, /同一路径的配置文件、模块、SKILL、模板只读一次/);
});
