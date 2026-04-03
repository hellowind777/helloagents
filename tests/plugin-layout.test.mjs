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
  assert.equal(claudePlugin.skills, './skills');
  assert.equal(claudePlugin.hooks, './hooks/hooks-claude.json');

  const codexPlugin = JSON.parse(read('.codex-plugin/plugin.json'));
  assert.equal(codexPlugin.skills, './skills');
  assert.equal(codexPlugin.hooks, undefined);

  const geminiExtension = JSON.parse(read('gemini-extension.json'));
  assert.equal(geminiExtension.contextFileName, 'bootstrap.md');

  const geminiHooks = read('hooks/hooks.json');
  assert.match(geminiHooks, /BeforeAgent/);
  assert.match(geminiHooks, /\$\{extensionPath\}/);
  assert.doesNotMatch(geminiHooks, /UserPromptSubmit/);

  const claudeHooks = read('hooks/hooks-claude.json');
  assert.match(claudeHooks, /UserPromptSubmit/);
  assert.match(claudeHooks, /\$\{CLAUDE_PLUGIN_ROOT\}/);
  assert.match(claudeHooks, /--claude/);
  assert.doesNotMatch(claudeHooks, /BeforeAgent/);
});

test('bootstrap path rules no longer depend on host-name placeholders or wrong carrier-relative skills paths', () => {
  for (const file of ['bootstrap.md', 'bootstrap-lite.md']) {
    const content = read(file);
    assert.doesNotMatch(content, /当前CLI名称/);
    assert.doesNotMatch(content, /本文件所在目录\/skills\/commands/);
    assert.doesNotMatch(content, /本文件所在目录\/skills\/\{技能名\}/);
    assert.match(content, /当前已加载 HelloAGENTS 包根目录/);
    assert.match(content, /已由宿主自动加载，无需再次读取/);
    assert.match(content, /同一轮内对同一配置文件、模块、SKILL、模板只读取一次/);
  }

  const helloagentsSkill = read('skills/helloagents/SKILL.md');
  assert.doesNotMatch(helloagentsSkill, /当前CLI名称/);
  assert.match(helloagentsSkill, /已由宿主自动加载，无需再次读取/);
  assert.match(helloagentsSkill, /仅按需读取具体 SKILL\.md/);
  assert.match(helloagentsSkill, /同一轮内对同一配置文件、模块、SKILL、模板只读取一次/);
});
