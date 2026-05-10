import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export const DEFAULTS = {
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
  host_install_modes: {},
};

export function loadPackageVersion(pkgRoot) {
  try {
    return JSON.parse(readFileSync(`${pkgRoot}/package.json`, 'utf-8'));
  } catch {
    return { version: '0.0.0' };
  }
}

export function ensureConfig(helloagentsHome, configFile, safeJson, ensureDir) {
  ensureDir(helloagentsHome);
  if (!existsSync(configFile)) {
    writeFileSync(configFile, JSON.stringify(DEFAULTS, null, 2), 'utf-8');
    return;
  }

  const existing = safeJson(configFile) || {};
  const reconciled = { ...existing };
  for (const [key, val] of Object.entries(DEFAULTS)) {
    if (!(key in reconciled)) reconciled[key] = val;
  }
  if (JSON.stringify(reconciled) !== JSON.stringify(existing)) {
    writeFileSync(configFile, JSON.stringify(reconciled, null, 2), 'utf-8');
  }
}
