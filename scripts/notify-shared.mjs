import { readFileSync, readSync } from 'node:fs';

export function readSettings(configFile) {
  try {
    return JSON.parse(readFileSync(configFile, 'utf-8'));
  } catch {
    return {};
  }
}

export function readStdinJson() {
  try {
    const chunks = [];
    const buf = Buffer.alloc(4096);
    let n;
    const fd = process.stdin.fd;
    try {
      while ((n = readSync(fd, buf, 0, buf.length)) > 0) {
        chunks.push(buf.slice(0, n));
      }
    } catch {}
    const raw = Buffer.concat(chunks).toString('utf-8').trim();
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function output(obj) {
  process.stdout.write(JSON.stringify(obj));
}

export function suppressedOutput(hookEventName, additionalContext) {
  output({
    hookSpecificOutput: {
      hookEventName,
      ...(additionalContext != null ? { additionalContext } : {}),
    },
    suppressOutput: true,
  });
}

export function emptySuppress() {
  output({ suppressOutput: true });
}
