#!/usr/bin/env node
/**
 * FocusSpace — Live review.txt File Watcher
 *
 * Actively watches project source files and triggers automatic
 * review.txt regeneration after every alteration/save.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateReview } from './generate-review.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const WATCH_DIRS = ['src', 'electron', 'scripts'];
const WATCH_FILES = ['package.json', 'vite.config.ts', 'tsconfig.json', 'index.html'];

let debounceTimer = null;

function triggerRegeneration(changedFile) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`\n[${timestamp}] Alteration detected in: ${changedFile}`);
    generateReview(false);
  }, 1000);
}

console.log('👀 FocusSpace -- Live review.txt watcher active.');
console.log('   Watching for alterations across src/, electron/, scripts/, and configs...');

// 1. Initial generation
generateReview(false);

// 2. Watch root files
for (const f of WATCH_FILES) {
  const fullPath = path.join(ROOT, f);
  if (fs.existsSync(fullPath)) {
    fs.watch(fullPath, (eventType) => {
      triggerRegeneration(f);
    });
  }
}

// 3. Watch directories recursively
for (const dir of WATCH_DIRS) {
  const fullDir = path.join(ROOT, dir);
  if (fs.existsSync(fullDir)) {
    try {
      fs.watch(fullDir, { recursive: true }, (eventType, filename) => {
        if (!filename) return;
        const normalized = filename.replace(/\\/g, '/');
        if (
          normalized.endsWith('.tmp') ||
          normalized.endsWith('.swp') ||
          normalized.includes('review.txt') ||
          normalized.includes('node_modules')
        ) {
          return;
        }
        triggerRegeneration(path.join(dir, normalized));
      });
    } catch (watchErr) {
      console.warn(`  ! Warning: Recursive watch not supported for ${dir}:`, watchErr.message);
    }
  }
}
