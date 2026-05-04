import { readFileSync } from 'node:fs'
import { normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  appendSessionEvent,
  clearCapsuleSection,
  getSessionCapsulePath,
  getRuntimeScope,
  readCapsuleSection,
  writeCapsuleSection,
} from './session-capsule.mjs'
import { TURN_STATE_TTL_MS } from './runtime-ttl.mjs'

const VALID_KINDS = new Set(['complete', 'waiting', 'blocked', 'progress'])
const VALID_ROLES = new Set(['main', 'subagent'])
const VALID_REASON_CATEGORIES = new Set([
  'ambiguity',
  'missing-input',
  'missing-file',
  'missing-credential',
  'unauthorized-side-effect',
  'high-risk-confirmation',
  'external-dependency',
  'error',
])
const HELP_TEXT = `Usage:
  helloagents-turn-state write --kind complete --role main
  helloagents-turn-state write --kind waiting --role main --reason-category missing-input --reason "..."
  echo {"kind":"complete","role":"main"} | helloagents-turn-state write
  helloagents-turn-state read [--cwd <path>]
  helloagents-turn-state clear [--cwd <path>]

Options:
  --cwd <path>
  --kind <complete|waiting|blocked|progress>
  --role <main|subagent>
  --phase <name>
  --source <name>
  --reason-category <category>
  --reason <text>
  --requires-delivery-gate
  --blocker-target <text>
  --blocker-evidence <text>
  --blocker-required-action <text>
`

function normalizePath(filePath = '') {
  return filePath ? normalize(resolve(filePath)) : ''
}

function normalizeTurnState(input = {}) {
  const kind = typeof input.kind === 'string' ? input.kind.trim().toLowerCase() : ''
  const role = typeof input.role === 'string' ? input.role.trim().toLowerCase() : 'main'
  const reasonCategory = typeof input.reasonCategory === 'string'
    ? input.reasonCategory.trim().toLowerCase()
    : ''
  const reason = typeof input.reason === 'string' ? input.reason.trim() : ''
  const blocker = normalizeBlocker(input.blocker)

  return {
    kind: VALID_KINDS.has(kind) ? kind : '',
    role: VALID_ROLES.has(role) ? role : 'main',
    phase: typeof input.phase === 'string' ? input.phase.trim().toLowerCase() : '',
    source: typeof input.source === 'string' && input.source.trim() ? input.source.trim() : 'manual',
    requiresDeliveryGate: Boolean(input.requiresDeliveryGate),
    reasonCategory: VALID_REASON_CATEGORIES.has(reasonCategory) ? reasonCategory : '',
    reason,
    ...(blocker ? { blocker } : {}),
  }
}

function normalizeBlocker(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null

  const target = typeof input.target === 'string' ? input.target.trim() : ''
  const evidence = typeof input.evidence === 'string' ? input.evidence.trim() : ''
  const requiredAction = typeof input.requiredAction === 'string'
    ? input.requiredAction.trim()
    : ''

  if (!target && !evidence && !requiredAction) return null
  return { target, evidence, requiredAction }
}

export function clearTurnState(cwd = process.cwd(), options = {}) {
  return clearCapsuleSection(cwd, 'turn', options)
}

export function readTurnState(cwd = process.cwd(), { now = Date.now(), ...options } = {}) {
  const entry = readCapsuleSection(cwd, 'turn', options)
  if (!entry?.cwd || !entry?.kind || !entry?.updatedAt) {
    return null
  }

  const updatedAt = Date.parse(entry.updatedAt)
  if (!Number.isFinite(updatedAt) || (now - updatedAt > TURN_STATE_TTL_MS)) {
    clearTurnState(cwd, options)
    return null
  }

  const normalized = normalizeTurnState(entry)
  if (!normalized.kind) {
    clearTurnState(cwd, options)
    return null
  }

  return {
    cwd: normalizePath(entry.cwd),
    key: entry.key || '',
    path: getSessionCapsulePath(cwd, options),
    updatedAt: entry.updatedAt,
    ...normalized,
  }
}

export function writeTurnState(cwd = process.cwd(), input = {}) {
  const runtimeOptions = {
    payload: input.payload && typeof input.payload === 'object' ? input.payload : input,
    env: input.env || process.env,
    ppid: input.ppid ?? process.ppid,
  }
  const scope = getRuntimeScope(cwd, runtimeOptions)
  const normalized = normalizeTurnState(input)
  if (!normalized.kind) {
    throw new Error('turn-state write requires a valid kind. Example: helloagents-turn-state write --kind complete --role main')
  }
  if (
    (normalized.kind === 'waiting' || normalized.kind === 'blocked')
    && (!normalized.reasonCategory || !normalized.reason)
  ) {
    throw new Error('turn-state waiting/blocked requires reasonCategory and reason')
  }

  const payload = {
    cwd: normalizePath(cwd),
    key: scope.key,
    scope: scope.scope,
    updatedAt: new Date().toISOString(),
    ...normalized,
  }
  writeCapsuleSection(cwd, 'turn', payload, runtimeOptions)

  appendSessionEvent(cwd, {
    event: 'turn_state_written',
    source: normalized.source,
    details: {
      kind: normalized.kind,
      role: normalized.role,
      phase: normalized.phase,
      requiresDeliveryGate: normalized.requiresDeliveryGate,
      reasonCategory: normalized.reasonCategory,
      reason: normalized.reason,
    },
  })

  return payload
}

function readStdinJson() {
  if (process.stdin.isTTY) return {}
  try {
    const text = readFileSync(0, 'utf-8').trim()
    return text ? JSON.parse(text) : {}
  } catch {
    return {}
  }
}

function normalizeOptionName(rawName = '') {
  return rawName.replace(/^-+/, '').replace(/-([a-z])/g, (_, char) => char.toUpperCase())
}

function readOptionValue(args, index, name) {
  const raw = args[index]
  const eqIndex = raw.indexOf('=')
  if (eqIndex >= 0) {
    return { value: raw.slice(eqIndex + 1), nextIndex: index }
  }

  const next = args[index + 1]
  if (next === undefined || next.startsWith('--')) {
    return { value: true, nextIndex: index }
  }
  return { value: next, nextIndex: index + 1 }
}

function assignCliOption(input, name, value) {
  const key = normalizeOptionName(name)
  const aliases = {
    reasonCategory: 'reasonCategory',
    requiresDeliveryGate: 'requiresDeliveryGate',
    blockerTarget: 'blocker.target',
    blockerEvidence: 'blocker.evidence',
    blockerRequiredAction: 'blocker.requiredAction',
  }
  const target = aliases[key] || key
  const allowed = new Set([
    'cwd',
    'kind',
    'role',
    'phase',
    'source',
    'reasonCategory',
    'reason',
    'requiresDeliveryGate',
    'blocker.target',
    'blocker.evidence',
    'blocker.requiredAction',
  ])
  if (!allowed.has(target)) {
    throw new Error(`unknown turn-state option: --${name}`)
  }

  if (target.startsWith('blocker.')) {
    input.blocker = input.blocker || {}
    input.blocker[target.slice('blocker.'.length)] = String(value)
    return
  }

  input[target] = target === 'requiresDeliveryGate'
    ? value === true || String(value).toLowerCase() === 'true'
    : String(value)
}

function parseCliArgs(args = []) {
  const input = {}
  let wantsHelp = false

  for (let index = 0; index < args.length; index += 1) {
    const raw = args[index]
    if (raw === '--help' || raw === '-h') {
      wantsHelp = true
      continue
    }
    if (!raw.startsWith('--')) {
      throw new Error(`unexpected turn-state argument: ${raw}`)
    }

    const optionName = raw.slice(2).split('=')[0]
    const { value, nextIndex } = readOptionValue(args, index, optionName)
    assignCliOption(input, optionName, value)
    index = nextIndex
  }

  return { input, wantsHelp }
}

function mergeInputs(stdinInput, cliInput) {
  return {
    ...stdinInput,
    ...cliInput,
    blocker: {
      ...(stdinInput.blocker || {}),
      ...(cliInput.blocker || {}),
    },
  }
}

function printHelp() {
  process.stdout.write(HELP_TEXT)
}

function main() {
  const command = process.argv[2] || ''
  if (!command || command === '--help' || command === '-h' || command === 'help') {
    printHelp()
    return
  }

  const { input: cliInput, wantsHelp } = parseCliArgs(process.argv.slice(3))
  if (wantsHelp) {
    printHelp()
    return
  }

  const input = mergeInputs(readStdinJson(), cliInput)
  const cwd = input.cwd || process.cwd()

  if (command === 'write') {
    const payload = writeTurnState(cwd, input)
    process.stdout.write(JSON.stringify({
      suppressOutput: true,
      path: getSessionCapsulePath(cwd, input),
      payload,
    }))
    return
  }

  if (command === 'clear') {
    process.stdout.write(JSON.stringify({
      suppressOutput: true,
      cleared: clearTurnState(cwd, input),
    }))
    return
  }

  if (command === 'read') {
    process.stdout.write(JSON.stringify({
      suppressOutput: true,
      state: readTurnState(cwd, input),
    }))
    return
  }

  throw new Error(`unknown turn-state command: ${command}`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main()
  } catch (error) {
    process.stderr.write(`${error.message}\n\n${HELP_TEXT}`)
    process.exit(1)
  }
}
