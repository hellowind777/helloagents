import test from 'node:test'
import assert from 'node:assert/strict'
import { chmodSync, existsSync, mkdirSync } from 'node:fs'
import { delimiter, dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

import {
  buildHomeEnv,
  createHomeFixture,
  createPackageFixture,
  createTempDir,
  readText,
  writeText,
} from './helpers/test-env.mjs'

function resolveShell() {
  for (const command of ['sh', 'bash']) {
    const result = spawnSync(command, ['-c', 'printf ok'], {
      encoding: 'utf-8',
      windowsHide: true,
    })
    if (!result.error && result.status === 0 && result.stdout === 'ok') return command
  }
  const gitCommand = spawnSync('git', ['--exec-path'], {
    encoding: 'utf-8',
    windowsHide: true,
  })
  if (!gitCommand.error && gitCommand.status === 0) {
    const execPath = gitCommand.stdout.trim()
    const candidates = [
      resolve(execPath, '..', '..', '..', 'bin', 'sh.exe'),
      resolve(execPath, '..', '..', '..', 'usr', 'bin', 'sh.exe'),
      join(dirname(execPath), 'sh.exe'),
    ]
    for (const command of candidates) {
      const result = spawnSync(command, ['-c', 'printf ok'], {
        encoding: 'utf-8',
        windowsHide: true,
      })
      if (!result.error && result.status === 0 && result.stdout === 'ok') return command
    }
  }
  return ''
}

const POSIX_SHELL = resolveShell()

function createFakeNpm(binDir, logPath) {
  const loggerScript = join(binDir, 'npm')
  writeText(
    loggerScript,
    [
      '#!/bin/sh',
      'joined="$*"',
      'printf \'args=%s|deploy=%s|target=%s|mode=%s|branch=%s|package=%s\\n\' "$joined" "${HELLOAGENTS_DEPLOY:-}" "${HELLOAGENTS_TARGET:-}" "${HELLOAGENTS_MODE:-}" "${HELLOAGENTS_BRANCH:-}" "${HELLOAGENTS_PACKAGE:-}" >> "$FAKE_NPM_LOG"',
      'if [ -n "${FAKE_NPM_FAIL_MATCH:-}" ] && [ "$joined" = "$FAKE_NPM_FAIL_MATCH" ]; then',
      '  exit 1',
      'fi',
      'exit 0',
      '',
    ].join('\n'),
  )
  chmodSync(loggerScript, 0o755)
}

function runInstallSh(pkgRoot, home, env = {}) {
  const result = spawnSync(POSIX_SHELL, [join(pkgRoot, 'install.sh')], {
    cwd: pkgRoot,
    env: {
      ...buildHomeEnv(home),
      ...env,
    },
    encoding: 'utf-8',
    windowsHide: true,
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  return result
}

function readLogEntries(logPath) {
  if (!existsSync(logPath)) return []
  return readText(logPath)
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => Object.fromEntries(
      line.split('|').map((part) => {
        const separator = part.indexOf('=')
        return [part.slice(0, separator), part.slice(separator + 1)]
      }),
    ))
}

function createScriptEnv(home, overrides = {}) {
  const fakeBin = createTempDir('helloagents-fake-npm-sh-')
  const logPath = join(home, 'fake-npm-sh.log')
  mkdirSync(fakeBin, { recursive: true })
  createFakeNpm(fakeBin, logPath)
  const basePath = process.env.PATH || process.env.Path || ''
  return {
    logPath,
    env: {
      PATH: `${fakeBin}${delimiter}${basePath}`,
      FAKE_NPM_LOG: logPath,
      ...overrides,
    },
  }
}

test('install.sh install forwards postinstall deploy env for compact host mode specs', { skip: !POSIX_SHELL }, () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const { logPath, env } = createScriptEnv(home, {
    HELLOAGENTS_ACTION: 'install',
    HELLOAGENTS: 'codex:global',
  })

  runInstallSh(pkgRoot, home, env)

  const entries = readLogEntries(logPath)
  assert.equal(entries.length, 1)
  assert.equal(entries[0].args, 'install -g helloagents')
  assert.equal(entries[0].deploy, '1')
  assert.equal(entries[0].target, 'codex')
  assert.equal(entries[0].mode, 'global')
})

test('install.sh update, cleanup, switch-branch, and uninstall dispatch the expected npm commands', { skip: !POSIX_SHELL }, () => {
  const { root: pkgRoot } = createPackageFixture()

  {
    const home = createHomeFixture()
    const { logPath, env } = createScriptEnv(home, {
      HELLOAGENTS_ACTION: 'update',
      HELLOAGENTS_BRANCH: 'beta',
      HELLOAGENTS_TARGET: 'codex',
      HELLOAGENTS_MODE: 'standby',
    })
    runInstallSh(pkgRoot, home, env)
    const entries = readLogEntries(logPath)
    assert.deepEqual(entries.map((entry) => entry.args), [
      'install -g github:hellowind777/helloagents#beta',
      'explore -g helloagents -- npm run sync-hosts -- codex --standby',
    ])
  }

  {
    const home = createHomeFixture()
    const { logPath, env } = createScriptEnv(home, {
      HELLOAGENTS_ACTION: 'cleanup',
      HELLOAGENTS_TARGET: 'all',
      HELLOAGENTS_MODE: 'global',
    })
    runInstallSh(pkgRoot, home, env)
    const entries = readLogEntries(logPath)
    assert.deepEqual(entries.map((entry) => entry.args), [
      'explore -g helloagents -- npm run cleanup-hosts -- --all --global',
    ])
  }

  {
    const home = createHomeFixture()
    const { logPath, env } = createScriptEnv(home, {
      HELLOAGENTS_ACTION: 'switch-branch',
      HELLOAGENTS_BRANCH: 'beta',
      HELLOAGENTS_TARGET: 'gemini',
      HELLOAGENTS_MODE: 'global',
    })
    runInstallSh(pkgRoot, home, env)
    const entries = readLogEntries(logPath)
    assert.deepEqual(entries.map((entry) => entry.args), [
      'install -g github:hellowind777/helloagents#beta',
      'explore -g helloagents -- npm run sync-hosts -- gemini --global',
    ])
  }

  {
    const home = createHomeFixture()
    const failingArgs = 'explore -g helloagents -- npm run uninstall -- claude --global'
    const { logPath, env } = createScriptEnv(home, {
      HELLOAGENTS_ACTION: 'uninstall',
      HELLOAGENTS_TARGET: 'claude',
      HELLOAGENTS_MODE: 'global',
      FAKE_NPM_FAIL_MATCH: failingArgs,
    })
    const result = spawnSync(POSIX_SHELL, [join(pkgRoot, 'install.sh')], {
      cwd: pkgRoot,
      env: {
        ...buildHomeEnv(home),
        ...env,
      },
      encoding: 'utf-8',
      windowsHide: true,
    })

    assert.equal(result.status, 0, result.stderr || result.stdout)

    const entries = readLogEntries(logPath)
    assert.deepEqual(entries.map((entry) => entry.args), [
      'explore -g helloagents -- npm run uninstall -- claude --global',
      'uninstall -g helloagents',
    ])
  }
})

test('install.sh omits the mode for non-install actions so the CLI can reuse tracked or detected host modes', { skip: !POSIX_SHELL }, () => {
  const { root: pkgRoot } = createPackageFixture()

  {
    const home = createHomeFixture()
    const { logPath, env } = createScriptEnv(home, {
      HELLOAGENTS_ACTION: 'update',
      HELLOAGENTS_TARGET: 'codex',
    })
    runInstallSh(pkgRoot, home, env)
    const entries = readLogEntries(logPath)
    assert.deepEqual(entries.map((entry) => entry.args), [
      'update -g helloagents',
      'explore -g helloagents -- npm run sync-hosts -- codex',
    ])
  }

  {
    const home = createHomeFixture()
    const { logPath, env } = createScriptEnv(home, {
      HELLOAGENTS_ACTION: 'cleanup',
      HELLOAGENTS_TARGET: 'all',
    })
    runInstallSh(pkgRoot, home, env)
    const entries = readLogEntries(logPath)
    assert.deepEqual(entries.map((entry) => entry.args), [
      'explore -g helloagents -- npm run cleanup-hosts -- --all',
    ])
  }

  {
    const home = createHomeFixture()
    const { logPath, env } = createScriptEnv(home, {
      HELLOAGENTS_ACTION: 'switch-branch',
      HELLOAGENTS_BRANCH: 'beta',
      HELLOAGENTS_TARGET: 'gemini',
    })
    runInstallSh(pkgRoot, home, env)
    const entries = readLogEntries(logPath)
    assert.deepEqual(entries.map((entry) => entry.args), [
      'install -g github:hellowind777/helloagents#beta',
      'explore -g helloagents -- npm run sync-hosts -- gemini',
    ])
  }
})
