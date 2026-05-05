import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { REPO_ROOT, readText } from './helpers/test-env.mjs'

test('Atanycosts skills fit the existing HelloAGENTS skill structure', () => {
  const expectedSkills = [
    'atanycosts',
    'atanycosts-code-guard',
    'atanycosts-refactor-clean',
    'atanycosts-bishe-stack',
    'atanycosts-frontend-guard',
  ]

  for (const skillName of expectedSkills) {
    assert.equal(
      existsSync(join(REPO_ROOT, 'skills', skillName, 'SKILL.md')),
      true,
      `${skillName} should exist under skills/`,
    )
  }

  const entry = readText(join(REPO_ROOT, 'skills', 'atanycosts', 'SKILL.md'))
  assert.match(entry, /不重定义 HelloAGENTS 命令或输出格式/)
  assert.match(entry, /SSOT 优先/)
  assert.match(entry, /明确失败优先/)
  assert.match(entry, /\.helloagents\//)
  assert.match(entry, /不把历史 Atanycosts 的 `references\/ \/ functions\/ \/ stages\/` 目录整套搬回当前仓/)

  const codeGuard = readText(join(REPO_ROOT, 'skills', 'atanycosts-code-guard', 'SKILL.md'))
  assert.match(codeGuard, /静默兜底/)
  assert.match(codeGuard, /伪需求代码/)
  assert.match(codeGuard, /application\.yml/)
  assert.doesNotMatch(codeGuard, /Atanycosts Shell/)

  const refactorClean = readText(join(REPO_ROOT, 'skills', 'atanycosts-refactor-clean', 'SKILL.md'))
  assert.match(refactorClean, /反兼容反补丁/)
  assert.match(refactorClean, /fallback/)
  assert.match(refactorClean, /legacyMode/)
  assert.doesNotMatch(refactorClean, /## G[1-9]/)

  const bishe = readText(join(REPO_ROOT, 'skills', 'atanycosts-bishe-stack', 'SKILL.md'))
  assert.match(bishe, /这是毕设/)
  assert.match(bishe, /MyBatis 或 MyBatis-Plus/)
  assert.match(bishe, /禁止 JPA/)
  assert.match(bishe, /hello-ui/)
  assert.doesNotMatch(bishe, /ui-ux-pro-max/)

  const frontendGuard = readText(join(REPO_ROOT, 'skills', 'atanycosts-frontend-guard', 'SKILL.md'))
  assert.match(frontendGuard, /不是替代 `hello-ui`/)
  assert.match(frontendGuard, /工程化门禁/)
  assert.match(frontendGuard, /loading/)
  assert.match(frontendGuard, /permission denied/)
  assert.doesNotMatch(frontendGuard, /ui-ux-pro-max/)
})
