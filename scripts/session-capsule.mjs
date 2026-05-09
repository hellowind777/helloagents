import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

import {
  getProjectSessionScope,
  getRuntimeScope,
  readJsonFile,
  removeRuntimeFile,
  writeActiveProjectSession,
  writeJsonFileAtomic,
} from './runtime-scope.mjs'

export { getRuntimeScope }

function buildEmptyCapsule(scope) {
  return {
    version: 1,
    scope: scope.scope,
    key: scope.key,
    cwd: scope.cwd,
    branch: scope.branch,
    workspace: scope.workspace || scope.branch,
    session: scope.session,
    sessionMode: scope.sessionMode,
    updatedAt: new Date().toISOString(),
    turn: null,
    route: null,
    artifacts: {},
  }
}

function normalizeOptions(options = {}) {
  if (!options || typeof options !== 'object') return {}
  if (options.payload && typeof options.payload === 'object') return options
  return {
    ...options,
    payload: options,
  }
}

function getEventSessionAlias(eventPayload = {}) {
  return eventPayload.sessionId || eventPayload.session_id || eventPayload['session-id'] || ''
}

function getScope(cwd, options = {}) {
  const normalizedOptions = normalizeOptions(options)
  if (normalizedOptions.project === true) {
    return {
      ...getProjectSessionScope(cwd, normalizedOptions),
      scope: 'project-session',
    }
  }
  return getRuntimeScope(cwd, normalizedOptions)
}

export function getSessionCapsulePath(cwd = process.cwd(), options = {}) {
  return getScope(cwd, options).capsulePath
}

export function getSessionEventsPath(cwd = process.cwd(), options = {}) {
  return getScope(cwd, options).eventsPath
}

export function getSessionArtifactsDir(cwd = process.cwd(), options = {}) {
  return getScope(cwd, options).artifactsDir
}

export function getSessionArtifactPath(cwd, fileName, options = {}) {
  return join(getSessionArtifactsDir(cwd, options), fileName)
}

export function getSessionArtifactRelativePath(cwd, fileName, options = {}) {
  const scope = getScope(cwd, options)
  if (scope.scope === 'project-session') {
    return `.helloagents/sessions/${scope.workspace || scope.branch}/${scope.session}/artifacts/${fileName}`
  }
  return `~/.helloagents/runtime/${basename(scope.sessionDir)}/artifacts/${fileName}`
}

export function readSessionCapsule(cwd = process.cwd(), options = {}) {
  const scope = getScope(cwd, options)
  const capsule = readJsonFile(scope.capsulePath, null)
  if (!capsule || typeof capsule !== 'object') return buildEmptyCapsule(scope)
  return {
    ...buildEmptyCapsule(scope),
    ...capsule,
    scope: scope.scope,
    key: scope.key,
    cwd: scope.cwd,
    branch: scope.branch,
    workspace: scope.workspace || scope.branch,
    session: scope.session,
    sessionMode: scope.sessionMode,
  }
}

export function writeSessionCapsule(cwd, capsule, options = {}) {
  const scope = getScope(cwd, options)
  const nextCapsule = {
    ...buildEmptyCapsule(scope),
    ...capsule,
    scope: scope.scope,
    key: scope.key,
    cwd: scope.cwd,
    branch: scope.branch,
    workspace: scope.workspace || scope.branch,
    session: scope.session,
    sessionMode: scope.sessionMode,
    updatedAt: new Date().toISOString(),
  }
  writeJsonFileAtomic(scope.capsulePath, nextCapsule)
  writeActiveProjectSession(scope, {
    env: normalizeOptions(options).env,
  })
  return nextCapsule
}

export function updateSessionCapsule(cwd, updater, options = {}) {
  const current = readSessionCapsule(cwd, options)
  const patch = typeof updater === 'function' ? updater(current) : updater
  return writeSessionCapsule(cwd, {
    ...current,
    ...(patch || {}),
  }, options)
}

export function readCapsuleSection(cwd, section, options = {}) {
  return readSessionCapsule(cwd, options)[section] || null
}

export function writeCapsuleSection(cwd, section, value, options = {}) {
  return updateSessionCapsule(cwd, (capsule) => ({
    [section]: value,
    [`${section}UpdatedAt`]: new Date().toISOString(),
    artifacts: capsule.artifacts || {},
  }), options)
}

export function clearCapsuleSection(cwd, section, options = {}) {
  const capsulePath = getSessionCapsulePath(cwd, options)
  if (!existsSync(capsulePath)) return false

  const capsule = readSessionCapsule(cwd, options)
  if (!Object.prototype.hasOwnProperty.call(capsule, section)) return false
  if (capsule[section] == null) return false
  capsule[section] = null
  capsule[`${section}UpdatedAt`] = new Date().toISOString()
  writeSessionCapsule(cwd, capsule, options)
  return true
}

export function appendSessionEvent(cwd, eventPayload, options = {}) {
  const normalizedOptions = normalizeOptions(options)
  const sessionAlias = getEventSessionAlias(eventPayload)
  const scopedOptions = sessionAlias
    ? {
      ...normalizedOptions,
      payload: {
        ...(normalizedOptions.payload || {}),
        _helloagentsSessionAlias: sessionAlias,
      },
    }
    : normalizedOptions
  const scope = getScope(cwd, scopedOptions)
  if (scope.scope === 'project-session' && !scope.active) return ''
  const eventName = eventPayload?.event || ''
  if (!eventName) return ''

  mkdirSync(dirname(scope.eventsPath), { recursive: true })
  const payload = {
    ts: new Date().toISOString(),
    scope: scope.scope,
    key: scope.key,
    sessionId: scope.session,
    ...eventPayload,
  }
  writeFileSync(scope.eventsPath, `${JSON.stringify(payload)}\n`, {
    encoding: 'utf-8',
    flag: 'a',
  })
  writeActiveProjectSession(scope, {
    host: eventPayload.host || '',
    source: eventPayload.source || eventName,
    env: scopedOptions.env,
  })
  return scope.eventsPath
}

export function resetSessionEvents(cwd, options = {}) {
  const scope = getScope(cwd, options)
  if (scope.scope === 'project-session' && !scope.active) return ''
  mkdirSync(dirname(scope.eventsPath), { recursive: true })
  writeFileSync(scope.eventsPath, '', 'utf-8')
  return scope.eventsPath
}

export function readSessionArtifact(cwd, fileName, options = {}) {
  return readJsonFile(getSessionArtifactPath(cwd, fileName, options), null)
}

export function writeSessionArtifact(cwd, fileName, payload, options = {}) {
  const artifactPath = getSessionArtifactPath(cwd, fileName, options)
  writeJsonFileAtomic(artifactPath, payload)
  updateSessionCapsule(cwd, (capsule) => ({
    artifacts: {
      ...(capsule.artifacts || {}),
      [fileName]: {
        path: getSessionArtifactRelativePath(cwd, fileName, options),
        updatedAt: new Date().toISOString(),
        type: basename(fileName, '.json'),
      },
    },
  }), options)
  return artifactPath
}

export function clearSessionArtifact(cwd, fileName, options = {}) {
  const artifactPath = getSessionArtifactPath(cwd, fileName, options)
  rmSync(artifactPath, { force: true })
  const capsuleOptions = normalizeOptions(options)
  const capsule = readSessionCapsule(cwd, capsuleOptions)
  if (capsule.artifacts && Object.prototype.hasOwnProperty.call(capsule.artifacts, fileName)) {
    delete capsule.artifacts[fileName]
    writeSessionCapsule(cwd, capsule, capsuleOptions)
  }
}

export function removeSessionCapsule(cwd, options = {}) {
  removeRuntimeFile(getSessionCapsulePath(cwd, options))
}
