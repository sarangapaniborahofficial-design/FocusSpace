#!/usr/bin/env node
/**
 * FocusSpace — Git Hook Installer for Automated review.txt Creation
 *
 * Installs post-commit and post-merge hooks into .git/hooks/ to ensure
 * review.txt is automatically updated after every local change and commit.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

function findGitHooksDir() {
  let curr = ROOT;
  for (let i = 0; i < 3; i++) {
    const hooksDir = path.join(curr, '.git', 'hooks');
    if (fs.existsSync(path.dirname(hooksDir))) {
      return hooksDir;
    }
    curr = path.resolve(curr, '..');
  }
  return null;
}

const hooksDir = findGitHooksDir();
if (!hooksDir) {
  console.log('[*] No .git directory found. Skipping Git hook installation.');
  process.exit(0);
}

fs.mkdirSync(hooksDir, { recursive: true });

const hookScript = `#!/bin/sh
# FocusSpace Automated review.txt Generator
if command -v node >/dev/null 2>&1; then
  node scripts/generate-review.mjs --silent
fi
`;

const targetHooks = ['post-commit', 'post-merge'];

for (const hookName of targetHooks) {
  const hookPath = path.join(hooksDir, hookName);
  try {
    fs.writeFileSync(hookPath, hookScript, { encoding: 'utf-8', mode: 0o755 });
    console.log(`  ✓ Installed Git hook: .git/hooks/${hookName}`);
  } catch (err) {
    console.warn(`  ! Warning: Failed to write hook ${hookName}:`, err.message);
  }
}

console.log('[SUCCESS] Git hooks for automated review.txt generation installed.\n');
