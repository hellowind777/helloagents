import assert from 'node:assert/strict'
import { join } from 'node:path'

import { writeJson } from './test-env.mjs'

export function parseStdoutJson(result) {
  assert.equal(result.status, 0, result.stderr || result.stdout)
  return result.stdout ? JSON.parse(result.stdout) : null
}

export function getSessionStatePath(project, { workspace = 'workspace', session = 'default' } = {}) {
  return join(project, '.helloagents', 'sessions', workspace, session, 'STATE.md')
}

export function getSessionEvidencePath(project, fileName, { workspace = 'workspace', session = 'default' } = {}) {
  return join(project, '.helloagents', 'sessions', workspace, session, 'artifacts', fileName)
}

export function writeSettings(home, overrides = {}) {
  writeJson(join(home, '.helloagents', 'helloagents.json'), {
    output_language: '',
    output_format: true,
    notify_level: 0,
    ralph_loop_enabled: true,
    guard_enabled: true,
    kb_create_mode: 1,
    project_store_mode: 'local',
    auto_commit_enabled: true,
    commit_attribution: '',
    install_mode: 'standby',
    ...overrides,
  })
}
