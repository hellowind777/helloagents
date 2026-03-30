/**
 * Lightweight TOML line-based helpers for HelloAGENTS CLI config edits.
 * Targets the small subset of TOML structures used by Codex CLI config.
 */

export function isTomlTableHeader(line) {
  const trimmed = String(line || '').trim();
  return trimmed.startsWith('[') && trimmed.endsWith(']');
}

export function normalizeToml(text) {
  const next = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
  return next ? `${next}\n` : '';
}

export function upsertTopLevelTomlKey(text, key, value) {
  const re = new RegExp(`^${key}\\s*=.*$`, 'm');
  const next = re.test(text)
    ? String(text || '').replace(re, `${key} = ${value}`)
    : `${key} = ${value}\n${String(text || '')}`;
  return normalizeToml(next);
}

export function readTopLevelTomlLine(text, key) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (isTomlTableHeader(trimmed)) break;
    if (trimmed.startsWith(`${key} =`)) return trimmed;
  }
  return '';
}

export function ensureTopLevelTomlLine(text, key, line) {
  const normalized = String(line || '').trim();
  if (!normalized) return normalizeToml(text);
  const value = normalized.slice(normalized.indexOf('=') + 1).trim();
  return upsertTopLevelTomlKey(text, key, value);
}

export function readTomlKeyInSection(text, headerLine, key) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const headerIndex = lines.findIndex((line) => line.trim() === headerLine);
  if (headerIndex < 0) return '';

  const keyRe = new RegExp(`^\\s*${key}\\s*=.*$`);
  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (isTomlTableHeader(line)) break;
    if (keyRe.test(line)) return line.trim();
  }
  return '';
}

export function removeTomlKeyInSection(text, headerLine, key) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const headerIndex = lines.findIndex((line) => line.trim() === headerLine);
  if (headerIndex < 0) return normalizeToml(text);

  const keyRe = new RegExp(`^\\s*${key}\\s*=`);
  const nextLines = [];
  let removed = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (index > headerIndex && isTomlTableHeader(line)) {
      nextLines.push(...lines.slice(index));
      break;
    }
    if (index > headerIndex && keyRe.test(line)) {
      removed = true;
      continue;
    }
    nextLines.push(line);
  }

  if (!removed) return normalizeToml(text);
  return normalizeToml(nextLines.join('\n'));
}

export function upsertTomlKeyInSection(text, headerLine, key, value) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const headerIndex = lines.findIndex((line) => line.trim() === headerLine);

  if (headerIndex < 0) {
    const base = normalizeToml(text).trimEnd();
    return base
      ? `${base}\n\n${headerLine}\n${key} = ${value}\n`
      : `${headerLine}\n${key} = ${value}\n`;
  }

  let endIndex = headerIndex + 1;
  while (endIndex < lines.length && !isTomlTableHeader(lines[endIndex])) {
    endIndex += 1;
  }

  const keyRe = new RegExp(`^\\s*${key}\\s*=`);
  let updated = false;
  for (let index = headerIndex + 1; index < endIndex; index += 1) {
    if (keyRe.test(lines[index])) {
      lines[index] = `${key} = ${value}`;
      updated = true;
      break;
    }
  }

  if (!updated) {
    lines.splice(endIndex, 0, `${key} = ${value}`);
  }

  return normalizeToml(lines.join('\n'));
}

export function ensureTomlKeyInSection(text, headerLine, key, line) {
  const normalized = String(line || '').trim();
  if (!normalized) return normalizeToml(text);
  const value = normalized.slice(normalized.indexOf('=') + 1).trim();
  return upsertTomlKeyInSection(text, headerLine, key, value);
}

export function stripTomlSection(text, headerLine) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const kept = [];
  let removed = false;

  for (let index = 0; index < lines.length;) {
    if (lines[index].trim() === headerLine) {
      removed = true;
      index += 1;
      while (index < lines.length && !isTomlTableHeader(lines[index])) {
        index += 1;
      }
      continue;
    }

    kept.push(lines[index]);
    index += 1;
  }

  return {
    removed,
    text: normalizeToml(kept.join('\n')),
  };
}

export function removeTopLevelTomlLines(text, shouldRemove) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const kept = [];
  let currentSection = null;
  let removed = false;

  for (const line of lines) {
    if (isTomlTableHeader(line)) {
      currentSection = line.trim();
      kept.push(line);
      continue;
    }

    if (!currentSection && shouldRemove(line.trim())) {
      removed = true;
      continue;
    }

    kept.push(line);
  }

  return {
    removed,
    text: normalizeToml(kept.join('\n')),
  };
}
