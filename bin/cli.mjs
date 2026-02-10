#!/usr/bin/env node

/**
 * HelloAGENTS npm/npx bootstrap installer.
 *
 * This script is ONLY for first-time setup:
 *   npx helloagents install codex
 *
 * After installation, use the native `helloagents` command directly
 * for all subsequent operations (update, uninstall, status, etc.).
 */

import { execSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const REPO = "https://github.com/hellowind777/helloagents";
const MIN_PYTHON = [3, 10];

function findPython() {
  for (const cmd of ["python3", "python"]) {
    try {
      const out = execSync(`${cmd} --version`, {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      const match = out.match(/Python (\d+)\.(\d+)/);
      if (match) {
        const major = parseInt(match[1], 10);
        const minor = parseInt(match[2], 10);
        if (major > MIN_PYTHON[0] || (major === MIN_PYTHON[0] && minor >= MIN_PYTHON[1])) {
          return cmd;
        }
      }
    } catch {}
  }
  return null;
}

function detectBranch() {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));
    if (pkg.version && /beta/i.test(pkg.version)) return "beta";
  } catch {}
  return "main";
}

function pipInstall(python, branch) {
  const suffix = branch && branch !== "main" ? `@${branch}` : "";
  const url = `git+${REPO}.git${suffix}`;
  console.log(`Installing helloagents Python package (${branch})...`);
  const res = spawnSync(python, ["-m", "pip", "install", "--upgrade", url], {
    stdio: "inherit",
  });
  if (res.status !== 0) {
    console.error("Failed to install helloagents Python package.");
    process.exit(1);
  }
}

// --- Main ---
const python = findPython();
if (!python) {
  console.error("Error: Python >= 3.10 not found.");
  console.error("Please install Python first: https://www.python.org/downloads/");
  process.exit(1);
}

const args = process.argv.slice(2);

// Must provide at least "install <target>"
if (args.length === 0 || args[0] !== "install") {
  console.log("HelloAGENTS npx bootstrap installer");
  console.log("");
  console.log("Usage (first-time install only):");
  console.log("  npx helloagents install codex");
  console.log("  npx helloagents install claude");
  console.log("  npx helloagents install --all");
  console.log("");
  console.log("After installation, use the native command directly:");
  console.log("  helloagents update");
  console.log("  helloagents uninstall <target>");
  console.log("  helloagents status");
  console.log("  helloagents version");
  process.exit(0);
}

// Step 1: Install pip package
pipInstall(python, detectBranch());

// Step 2: Forward install command to native CLI
const res = spawnSync(python, ["-m", "helloagents", ...args], { stdio: "inherit" });

if (res.status === 0) {
  console.log("");
  console.log("Done! From now on, use the native command directly:");
  console.log("  helloagents update          # update to latest version");
  console.log("  helloagents uninstall codex # uninstall from a CLI");
  console.log("  helloagents status          # check installation status");
}

process.exit(res.status ?? 1);
