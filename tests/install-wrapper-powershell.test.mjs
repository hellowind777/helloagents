import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync } from 'node:fs'
import { delimiter, join } from 'node:path'
import { spawnSync } from 'node:child_process'

import {
  buildHomeEnv,
  createHomeFixture,
  createPackageFixture,
  createTempDir,
  readText,
  writeText,
} from './helpers/test-env.mjs'

function resolvePwsh() {
  for (const command of ['pwsh', 'powershell']) {
    const result = spawnSync(command, ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'], {
      encoding: 'utf-8',
      windowsHide: true,
    })
    if (!result.error && result.status === 0) return command
  }
  return ''
}

const PWSH = resolvePwsh()

function createFakeNpm(binDir, logPath) {
  const loggerScript = join(binDir, 'npm.ps1')
  writeText(
    loggerScript,
    [
      'param([Parameter(ValueFromRemainingArguments = $true)][string[]]$ArgList)',
      '$payload = @{',
      '  args = $ArgList',
      '  deploy = $env:HELLOAGENTS_DEPLOY',
      '  target = $env:HELLOAGENTS_TARGET',
      '  mode = $env:HELLOAGENTS_MODE',
      '  branch = $env:HELLOAGENTS_BRANCH',
      '  package = $env:HELLOAGENTS_PACKAGE',
      '} | ConvertTo-Json -Compress',
      'Add-Content -LiteralPath $env:FAKE_NPM_LOG -Value $payload',
      '$joined = $ArgList -join " "',
      'if ($env:FAKE_NPM_FAIL_MATCH -and $joined -eq $env:FAKE_NPM_FAIL_MATCH) {',
      '  exit 1',
      '}',
      'exit 0',
      '',
    ].join('\n'),
  )
  writeText(
    join(binDir, 'npm.cmd'),
    [
      '@echo off',
      `"${PWSH}" -NoProfile -ExecutionPolicy Bypass -File "%~dp0npm.ps1" %*`,
      'exit /b %ERRORLEVEL%',
      '',
    ].join('\r\n'),
  )
}

function runInstallPs1(pkgRoot, home, env = {}) {
  const result = spawnSync(PWSH, [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    join(pkgRoot, 'install.ps1'),
  ], {
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
    .map((line) => JSON.parse(line))
}

function createScriptEnv(home, overrides = {}) {
  const fakeBin = createTempDir('helloagents-fake-npm-')
  const logPath = join(home, 'fake-npm.log')
  mkdirSync(fakeBin, { recursive: true })
  createFakeNpm(fakeBin, logPath)
  const basePath = process.env.PATH || process.env.Path || ''
  return {
    logPath,
    env: {
      PATH: `${fakeBin}${delimiter}${basePath}`,
      Path: `${fakeBin}${delimiter}${basePath}`,
      FAKE_NPM_LOG: logPath,
      ...overrides,
    },
  }
}

test('install.ps1 install forwards postinstall deploy env for compact host mode specs', { skip: !PWSH }, () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const { logPath, env } = createScriptEnv(home, {
    HELLOAGENTS_ACTION: 'install',
    HELLOAGENTS: 'codex:global',
  })

  runInstallPs1(pkgRoot, home, env)

  const entries = readLogEntries(logPath)
  assert.equal(entries.length, 1)
  assert.deepEqual(entries[0].args, ['install', '-g', 'helloagents'])
  assert.equal(entries[0].deploy, '1')
  assert.equal(entries[0].target, 'codex')
  assert.equal(entries[0].mode, 'global')
})

test('install.ps1 update, cleanup, switch-branch, and uninstall dispatch the expected npm commands', { skip: !PWSH }, () => {
  const { root: pkgRoot } = createPackageFixture()

  {
    const home = createHomeFixture()
    const { logPath, env } = createScriptEnv(home, {
      HELLOAGENTS_ACTION: 'update',
      HELLOAGENTS_BRANCH: 'beta',
      HELLOAGENTS_TARGET: 'codex',
      HELLOAGENTS_MODE: 'standby',
    })
    runInstallPs1(pkgRoot, home, env)
    const entries = readLogEntries(logPath)
    assert.deepEqual(entries.map((entry) => entry.args), [
      ['install', '-g', 'github:hellowind777/helloagents#beta'],
      ['explore', '-g', 'helloagents', '--', 'npm', 'run', 'sync-hosts', '--', 'codex', '--standby'],
    ])
  }

  {
    const home = createHomeFixture()
    const { logPath, env } = createScriptEnv(home, {
      HELLOAGENTS_ACTION: 'cleanup',
      HELLOAGENTS_TARGET: 'all',
      HELLOAGENTS_MODE: 'global',
    })
    runInstallPs1(pkgRoot, home, env)
    const entries = readLogEntries(logPath)
    assert.deepEqual(entries.map((entry) => entry.args), [
      ['explore', '-g', 'helloagents', '--', 'npm', 'run', 'cleanup-hosts', '--', '--all', '--global'],
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
    runInstallPs1(pkgRoot, home, env)
    const entries = readLogEntries(logPath)
    assert.deepEqual(entries.map((entry) => entry.args), [
      ['install', '-g', 'github:hellowind777/helloagents#beta'],
      ['explore', '-g', 'helloagents', '--', 'npm', 'run', 'sync-hosts', '--', 'gemini', '--global'],
    ])
  }

  {
    const home = createHomeFixture()
    const failingArgs = 'explore -g helloagents -- npm run uninstall -- claude --global'
    const resultEnv = createScriptEnv(home, {
      HELLOAGENTS_ACTION: 'uninstall',
      HELLOAGENTS_TARGET: 'claude',
      HELLOAGENTS_MODE: 'global',
      FAKE_NPM_FAIL_MATCH: failingArgs,
    })
    const result = spawnSync(PWSH, [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      join(pkgRoot, 'install.ps1'),
    ], {
      cwd: pkgRoot,
      env: {
        ...buildHomeEnv(home),
        ...resultEnv.env,
      },
      encoding: 'utf-8',
      windowsHide: true,
    })

    assert.equal(result.status, 0, result.stderr || result.stdout)

    const entries = readLogEntries(resultEnv.logPath)
    assert.deepEqual(entries.map((entry) => entry.args), [
      ['explore', '-g', 'helloagents', '--', 'npm', 'run', 'uninstall', '--', 'claude', '--global'],
      ['uninstall', '-g', 'helloagents'],
    ])
  }
})
