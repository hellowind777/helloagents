import assert from 'node:assert/strict'
import { join } from 'node:path'

import { buildHomeEnv, listFiles, readText, runNode, writeJson, writeText } from './test-env.mjs'

export function hasTimestampedBackup(home, baseName) {
  return listFiles(join(home, '.codex')).some((name) => new RegExp(`^${baseName}_\\d{8}-\\d{6}\\.bak$`).test(name))
}

export function writeTimestampedBackup(home, baseName, content) {
  writeText(join(home, '.codex', `${baseName}_20260403-000000.bak`), content)
}

export function runCli(pkgRoot, home, args) {
  const result = runNode(join(pkgRoot, 'cli.mjs'), args, {
    cwd: pkgRoot,
    env: buildHomeEnv(home),
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  return result
}

export function seedHostConfigs(home) {
  writeText(join(home, '.claude', 'CLAUDE.md'), '# Claude custom\n')
  writeJson(join(home, '.claude', 'settings.json'), {
    model: 'opus',
    permissions: {
      allow: ['Read(*)'],
    },
    hooks: {
      SessionStart: [
        {
          matcher: 'keep',
          hooks: [{ type: 'command', command: 'node "other-claude.mjs"', timeout: 1 }],
        },
      ],
    },
  })

  writeText(join(home, '.gemini', 'GEMINI.md'), '# Gemini custom\n')
  writeJson(join(home, '.gemini', 'settings.json'), {
    hooks: {
      SessionStart: [
        {
          matcher: 'keep',
          hooks: [{ type: 'command', command: 'node "other-gemini.mjs"', timeout: 1 }],
        },
      ],
    },
  })

  writeText(join(home, '.codex', 'AGENTS.md'), '# Codex custom\n')
  writeText(
    join(home, '.codex', 'config.toml'),
    [
      'model_instructions_file = "C:/original/bootstrap.md"',
      'notify = ["node", "C:/original/notify.mjs", "codex-notify"]',
      '',
      '[features]',
      'experimental = true',
      '',
    ].join('\n'),
  )
}

export function readCodexConfig(home) {
  return readText(join(home, '.codex', 'config.toml'))
}
