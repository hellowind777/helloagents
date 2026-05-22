import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { REPO_ROOT } from './helpers/test-env.mjs';

function read(relativePath) {
  return readFileSync(join(REPO_ROOT, relativePath), 'utf-8');
}

function listRelativeFiles(rootPath, currentPath = rootPath) {
  return readdirSync(currentPath).flatMap((name) => {
    const fullPath = join(currentPath, name);
    if (statSync(fullPath).isDirectory()) {
      return listRelativeFiles(rootPath, fullPath);
    }
    return [relative(rootPath, fullPath).replace(/\\/g, '/')];
  }).sort();
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
  assert.equal(claudeMarketplace.plugins[0].source, './plugins/helloagents-claude');
  assert.equal(claudeMarketplace.plugins[0].version, undefined);

  const codexPlugin = JSON.parse(read('.codex-plugin/plugin.json'));
  assert.equal(codexPlugin.skills, './skills');
  assert.equal(codexPlugin.hooks, undefined);
  assert.equal(Array.isArray(codexPlugin.interface?.defaultPrompt), true);
  assert.equal(codexPlugin.interface.defaultPrompt.length <= 3, true);

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

test('claude marketplace package isolates claude hooks and stays in sync with shared runtime files', () => {
  const packageRoot = join(REPO_ROOT, 'plugins', 'helloagents-claude');
  const packageManifest = JSON.parse(read('plugins/helloagents-claude/.claude-plugin/plugin.json'));
  assert.equal(packageManifest.hooks, undefined);

  assert.equal(
    read('plugins/helloagents-claude/hooks/hooks.json'),
    read('hooks/hooks-claude.json'),
  );

  for (const file of ['bootstrap.md', 'bootstrap-lite.md', 'package.json']) {
    assert.equal(read(`plugins/helloagents-claude/${file}`), read(file));
  }

  for (const dir of ['assets', 'scripts', 'skills', 'templates']) {
    const sourceRoot = join(REPO_ROOT, dir);
    const packageDir = join(packageRoot, dir);
    const expectedFiles = listRelativeFiles(sourceRoot);
    const actualFiles = listRelativeFiles(packageDir);
    assert.deepEqual(actualFiles, expectedFiles, `${dir} file list drifted`);
    for (const file of expectedFiles) {
      const sourcePath = join(sourceRoot, file);
      const packagePath = join(packageDir, file);
      assert.deepEqual(
        readFileSync(packagePath),
        readFileSync(sourcePath),
        `${dir}/${file} drifted`,
      );
    }
  }
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
