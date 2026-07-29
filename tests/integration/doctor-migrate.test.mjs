import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ensureDir, fileExists, readText, writeJsonAtomic, writeTextAtomic } from '../../src/kernel/fsx.mjs'
import { findHost } from '../../src/hosts/registry.mjs'
import { buildDoctorReport } from '../../src/cli/doctor.mjs'
import { runInstall } from '../../src/cli/install.mjs'
import { cleanLegacyCodexConfig, runMigrate } from '../../src/cli/migrate.mjs'
import { makeCtx, makeFakeHome } from '../helpers/env.mjs'

/** 在临时主目录里布置 3.x 残留。 @param {string} home */
function seedLegacyArtifacts(home) {
  ensureDir(join(home, '.helloagents', 'helloagents', 'scripts'))
  writeTextAtomic(join(home, '.helloagents', 'helloagents.json'), '{"install_mode":"standby"}\n')

  writeTextAtomic(
    join(home, '.claude', 'CLAUDE.md'),
    '# 用户内容\n\n<!-- HELLOAGENTS_START -->\n旧版规则正文\n<!-- HELLOAGENTS_END -->\n',
  )
  writeJsonAtomic(join(home, '.claude', 'settings.json'), {
    model: 'opus',
    hooks: {
      Stop: [
        {
          matcher: '',
          hooks: [{ type: 'command', command: 'node "${CLAUDE_PLUGIN_ROOT}/scripts/notify.mjs" stop' }],
        },
      ],
    },
  })

  writeTextAtomic(
    join(home, '.codex', 'config.toml'),
    [
      'model = "gpt-5"',
      'notify = ["node", "/scripts/notify.mjs"] # helloagents-managed',
      '',
      '[hooks.state."abc123"]',
      'command = "node /home/user/.helloagents/helloagents/scripts/notify.mjs"',
      '',
      '[mcp_servers.docs]',
      'command = "docs-server"',
      '',
    ].join('\n'),
  )

  writeJsonAtomic(join(home, '.grok', 'hooks', 'helloagents.json'), {
    version: 1,
    hooks: {
      Stop: [
        {
          matcher: '',
          hooks: [{ type: 'command', command: 'node "${GROK_PLUGIN_ROOT}/scripts/notify.mjs" stop' }],
        },
      ],
    },
  })

  mkdirSync(join(home, '.cursor', 'plugins', 'local', 'helloagents', 'scripts'), { recursive: true })
}

/** Gemini CLI 不再受支持，它留下的内容按残留处理。 @param {string} home */
function seedGeminiArtifacts(home) {
  writeTextAtomic(
    join(home, '.gemini', 'GEMINI.md'),
    '# 我的规则\n\n<!-- HELLOAGENTS_START -->\n<!-- HelloAGENTS v4.0.0 -->\n内核正文\n<!-- HELLOAGENTS_END -->\n',
  )
  writeJsonAtomic(join(home, '.helloagents', 'install.json'), {
    version: 4,
    hosts: { gemini: { mode: 'plugin', version: '4.0.0', updatedAt: '2026-07-01T00:00:00.000Z' } },
    addons: { guard: [], notify: ['gemini'] },
  })
}

test('doctor 识别 3.x 残留；migrate 全部清理且不伤用户内容', () => {
  const { home, cleanup } = makeFakeHome()
  try {
    const { ctx } = makeCtx(home)
    seedLegacyArtifacts(home)

    const before = buildDoctorReport(ctx)
    assert.ok(before.legacy.length >= 5, `应识别出至少 5 处残留，实际 ${before.legacy.length}`)

    const projectDir = mkdtempSync(join(tmpdir(), 'helloagents-project-'))
    mkdirSync(join(projectDir, '.helloagents', 'sessions', 'beta'), { recursive: true })
    runMigrate(ctx, projectDir)

    assert.equal(fileExists(join(home, '.helloagents', 'helloagents')), false)
    assert.equal(fileExists(join(home, '.helloagents', 'helloagents.json')), false)
    assert.equal(fileExists(join(home, '.grok', 'hooks', 'helloagents.json')), false)
    assert.equal(fileExists(join(home, '.cursor', 'plugins', 'local', 'helloagents')), false)
    assert.equal(fileExists(join(projectDir, '.helloagents', 'sessions')), false)

    const claudeCarrier = readText(join(home, '.claude', 'CLAUDE.md'))
    assert.equal(claudeCarrier, '# 用户内容\n')
    const settingsText = readText(join(home, '.claude', 'settings.json')) ?? ''
    assert.ok(settingsText.includes('"model": "opus"'))
    assert.ok(!settingsText.includes('CLAUDE_PLUGIN_ROOT'))

    const codexConfig = readText(join(home, '.codex', 'config.toml')) ?? ''
    assert.ok(codexConfig.includes('model = "gpt-5"'))
    assert.ok(codexConfig.includes('[mcp_servers.docs]'))
    assert.ok(!codexConfig.includes('helloagents-managed'))
    assert.ok(!codexConfig.includes('[hooks.state.'))

    const after = buildDoctorReport(ctx)
    assert.deepEqual(after.legacy, [])

    rmSync(projectDir, { recursive: true, force: true })
  } finally {
    cleanup()
  }
})

test('doctor 与 migrate 处理 Gemini 残留，用户自己的内容不动', () => {
  const { home, cleanup } = makeFakeHome()
  try {
    const { ctx, lines } = makeCtx(home)
    seedGeminiArtifacts(home)

    const before = buildDoctorReport(ctx)
    assert.ok(before.legacy.some((item) => item.endsWith('GEMINI.md')), 'doctor 应把 GEMINI.md 列为残留')
    assert.ok(before.legacy.some((item) => item.includes('(gemini)')), 'doctor 应把 gemini 安装记录列为残留')

    const projectDir = mkdtempSync(join(tmpdir(), 'helloagents-project-'))
    runMigrate(ctx, projectDir)
    rmSync(projectDir, { recursive: true, force: true })

    assert.equal(readText(join(home, '.gemini', 'GEMINI.md')), '# 我的规则\n')
    assert.ok(
      lines.some((line) => line.includes('gemini extensions uninstall helloagents')),
      'migrate 应提示手动卸载扩展本体',
    )
    assert.deepEqual(buildDoctorReport(ctx).legacy, [])
  } finally {
    cleanup()
  }
})

test('migrate 不动用户自己的 notify 配置，只提示人工确认', () => {
  const dir = mkdtempSync(join(tmpdir(), 'helloagents-codex-'))
  try {
    const configPath = join(dir, 'config.toml')
    writeTextAtomic(configPath, 'notify = ["node", "/opt/my-helloagents-wrapper.mjs"]\n')
    const result = cleanLegacyCodexConfig(configPath)
    assert.equal(result.removed, 0)
    assert.equal(result.userNotifyMentionsHelloagents, true)
    assert.equal(readText(configPath), 'notify = ["node", "/opt/my-helloagents-wrapper.mjs"]\n')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('健康安装下 doctor 无问题；破坏载体后能定位', () => {
  const { home, cleanup } = makeFakeHome()
  try {
    const { ctx } = makeCtx(home)
    const claude = findHost('claude')
    assert.ok(claude)
    runInstall(ctx, [claude], 'standard')

    const healthy = buildDoctorReport(ctx)
    assert.deepEqual(healthy.issues, [])
    assert.deepEqual(healthy.legacy, [])

    rmSync(join(home, '.claude', 'CLAUDE.md'), { force: true })
    const broken = buildDoctorReport(ctx)
    assert.ok(broken.issues.some((issue) => issue.code === 'carrier-missing' && issue.host === 'claude'))
  } finally {
    cleanup()
  }
})

test('doctor 在全局模式下仍检查标准层 hooks 与 Codex 受管配置', () => {
  const { home, cleanup } = makeFakeHome()
  try {
    const { ctx } = makeCtx(home)
    const codex = findHost('codex')
    assert.ok(codex)
    runInstall(ctx, [codex], 'global')

    const healthy = buildDoctorReport(ctx)
    assert.equal(
      healthy.issues.filter((issue) => issue.host === 'codex').length,
      0,
      JSON.stringify(healthy.issues),
    )

    rmSync(join(home, '.codex', 'hooks.json'), { force: true })
    writeTextAtomic(join(home, '.codex', 'config.toml'), 'model = "x"\n')
    const broken = buildDoctorReport(ctx)
    assert.ok(broken.issues.some((issue) => issue.code === 'hooks-missing' && issue.host === 'codex'))
    assert.ok(
      broken.issues.some((issue) => issue.code === 'codex-model-instructions-missing' && issue.host === 'codex'),
    )
  } finally {
    cleanup()
  }
})
