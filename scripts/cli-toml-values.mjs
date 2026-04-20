export function getTomlArrayDepthDelta(text) {
  let depth = 0
  let quoted = false
  let escaped = false

  for (const char of String(text || '')) {
    if (escaped) {
      escaped = false
      continue
    }
    if (char === '\\' && quoted) {
      escaped = true
      continue
    }
    if (char === '"') {
      quoted = !quoted
      continue
    }
    if (quoted) continue
    if (char === '[') depth += 1
    if (char === ']') depth -= 1
  }

  return depth
}
