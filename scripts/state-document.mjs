import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export const AUTO_CREATED_STATE_MARKER = '由运行时自动创建；后续按实际任务重写'

function normalizeText(content = '') {
  return String(content || '').replace(/^\uFEFF/, '')
}

export function readStateDocument(filePath) {
  if (!filePath || !existsSync(filePath)) {
    return { body: '' }
  }

  return {
    body: normalizeText(readFileSync(filePath, 'utf-8')),
  }
}

export function composeStateDocument({ body = '' } = {}) {
  const normalizedBody = normalizeText(body).replace(/^\n+/, '')
  return normalizedBody ? `${normalizedBody.replace(/\n+$/, '')}\n` : ''
}

export function looksLikeAutoCreatedState(body = '') {
  return normalizeText(body).includes(AUTO_CREATED_STATE_MARKER)
}

export function writeStateDocument(filePath, { body = '' } = {}) {
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, composeStateDocument({ body }), 'utf-8')
}
