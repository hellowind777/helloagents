/**
 * Lightweight TOML line-based helpers for HelloAGENTS CLI config edits.
 * Targets the small subset of TOML structures used by Codex CLI config.
 */

import { getTomlArrayDepthDelta } from './cli-toml-values.mjs'

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

function escapeRegExp(text) {
  return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findFirstTomlSectionIndex(text) {
  const normalized = String(text || '').replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  let index = 0;

  for (const line of lines) {
    if (isTomlTableHeader(line)) return index;
    index += line.length + 1;
  }

  return normalized.length;
}

function splitTopLevelToml(text) {
  const normalized = String(text || '').replace(/\r\n/g, '\n');
  const topLevelEnd = findFirstTomlSectionIndex(normalized);
  return {
    topLevel: normalized.slice(0, topLevelEnd),
    sections: normalized.slice(topLevelEnd),
  };
}

function findTopLevelTomlBlock(text, key) {
  const normalized = String(text || '').replace(/\r\n/g, '\n');
  const topLevelEnd = findFirstTomlSectionIndex(normalized);
  const topLevel = normalized.slice(0, topLevelEnd);
  const re = new RegExp(`^${escapeRegExp(key)}\\s*=`, 'm');
  const match = re.exec(topLevel);
  if (!match) return null;

  const start = match.index;
  const lineEnd = normalized.indexOf('\n', start);
  const firstLineEnd = lineEnd >= 0 ? lineEnd : normalized.length;
  const firstLine = normalized.slice(start, firstLineEnd);
  const value = firstLine.slice(firstLine.indexOf('=') + 1).trim();

  let end = firstLineEnd;
  if (value.startsWith('"""')) {
    const openIndex = normalized.indexOf('"""', firstLine.indexOf('='));
    const closeIndex = normalized.indexOf('"""', openIndex + 3);
    end = closeIndex >= 0 ? closeIndex + 3 : normalized.length;
  }
  if (value.startsWith('[')) {
    let depth = getTomlArrayDepthDelta(firstLine.slice(firstLine.indexOf('=') + 1));
    let lineStart = firstLineEnd + (normalized[firstLineEnd] === '\n' ? 1 : 0);

    while (depth > 0 && lineStart < normalized.length) {
      const lineEndIndex = normalized.indexOf('\n', lineStart);
      const nextLineEnd = lineEndIndex >= 0 ? lineEndIndex : normalized.length;
      const nextLine = normalized.slice(lineStart, nextLineEnd);
      depth += getTomlArrayDepthDelta(nextLine);
      end = nextLineEnd;
      lineStart = nextLineEnd + 1;
    }
  }

  while (end < normalized.length && normalized[end] === '\n') {
    end += 1;
  }

  return {
    start,
    end,
    text: normalized.slice(start, end).trimEnd(),
  };
}

export function readTopLevelTomlBlock(text, key) {
  return findTopLevelTomlBlock(text, key)?.text || '';
}

export function upsertTopLevelTomlBlock(text, key, value) {
  const assignment = `${key} = ${String(value || '').trim()}`;
  const normalized = String(text || '').replace(/\r\n/g, '\n');
  const existing = findTopLevelTomlBlock(normalized, key);
  const next = existing
    ? `${normalized.slice(0, existing.start)}${assignment}\n${normalized.slice(existing.end)}`
    : `${assignment}\n${normalized}`;
  return normalizeToml(next);
}

export function ensureTopLevelTomlBlock(text, key, block) {
  const normalized = String(block || '').trim();
  if (!normalized) return normalizeToml(text);
  const value = normalized.slice(normalized.indexOf('=') + 1).trim();
  return upsertTopLevelTomlBlock(text, key, value);
}

export function removeTopLevelTomlBlock(text, key) {
  const normalized = String(text || '').replace(/\r\n/g, '\n');
  const existing = findTopLevelTomlBlock(normalized, key);
  if (!existing) return normalizeToml(text);
  return normalizeToml(`${normalized.slice(0, existing.start)}${normalized.slice(existing.end)}`);
}

export function prependTopLevelTomlBlocks(text, blocks) {
  const normalizedBlocks = blocks
    .map((block) => String(block || '').trim())
    .filter(Boolean);

  const { topLevel, sections } = splitTopLevelToml(text);
  const normalizedTopLevel = topLevel.replace(/^\n+/, '').trimEnd();
  const normalizedSections = sections.replace(/^\n+/, '').trimEnd();
  const remainder = normalizedTopLevel && normalizedSections
    ? `${normalizedTopLevel}\n\n${normalizedSections}`
    : normalizedTopLevel || normalizedSections;
  if (!normalizedBlocks.length) return normalizeToml(remainder);
  const managedPrelude = normalizedBlocks.join('\n');

  return normalizeToml(
    remainder
      ? `${managedPrelude}\n\n${remainder}`
      : managedPrelude,
  );
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
