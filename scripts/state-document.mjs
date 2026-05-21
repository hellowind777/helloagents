import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const STATE_META_BEGIN = '<!-- HELLOAGENTS_STATE_META'
const STATE_META_END = 'HELLOAGENTS_STATE_META -->'

function normalizeText(content = '') {
  return String(content || '').replace(/^\uFEFF/, '')
}

function splitLines(content = '') {
  return normalizeText(content).replace(/\r\n/g, '\n').split('\n')
}

export function parseStateDocument(content = '') {
  const lines = splitLines(content)
  if (lines[0]?.trim() !== STATE_META_BEGIN) {
    return {
      hasMetadata: false,
      metadata: null,
      body: normalizeText(content),
    }
  }

  const endIndex = lines.findIndex((line, index) => index > 0 && line.trim() === STATE_META_END)
  if (endIndex < 0) {
    return {
      hasMetadata: false,
      metadata: null,
      body: normalizeText(content),
    }
  }

  const metadataText = lines.slice(1, endIndex).join('\n').trim()
  const body = lines.slice(endIndex + 1).join('\n').replace(/^\n+/, '')
  try {
    return {
      hasMetadata: true,
      metadata: JSON.parse(metadataText),
      body,
    }
  } catch {
    return {
      hasMetadata: false,
      metadata: null,
      body,
    }
  }
}

export function readStateDocument(filePath) {
  if (!filePath || !existsSync(filePath)) {
    return {
      hasMetadata: false,
      metadata: null,
      body: '',
    }
  }

  return parseStateDocument(readFileSync(filePath, 'utf-8'))
}

export function composeStateDocument({ metadata = {}, body = '' } = {}) {
  const normalizedBody = normalizeText(body).replace(/^\n+/, '')
  return [
    STATE_META_BEGIN,
    JSON.stringify(metadata, null, 2),
    STATE_META_END,
    '',
    normalizedBody,
  ].join('\n').replace(/\n+$/, '\n')
}

export function writeStateDocument(filePath, { metadata = {}, body = '' } = {}) {
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, composeStateDocument({ metadata, body }), 'utf-8')
}
