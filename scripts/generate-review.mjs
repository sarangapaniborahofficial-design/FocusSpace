#!/usr/bin/env node
/**
 * FocusSpace — Option 2 Automated Standard Review Generator
 *
 * Generates review.txt: A unified, code-only single text export containing
 * all tracked application and desktop code without heavy binary models,
 * lockfiles, or build artifacts.
 *
 * Filter criteria (Option 2):
 * - Excludes: package-lock.json, public/, dist/, release/, .agents/,
 *   binary formats (.onnx, .wasm, .exe, .zip, .png, .woff2, etc.)
 * - Outputs to:
 *   - project root: review.txt
 *   - workspace root: ../review.txt
 *   - chat artifacts: <artifactDir>/review.txt
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const WORKSPACE_ROOT = path.resolve(PROJECT_ROOT, '..');
const ARTIFACT_DIR = String.raw`C:\Users\Saran\.gemini\antigravity\brain\76401ca6-b123-4950-81c5-c79e0e7a48d5`;

const EXCLUDE_REGEX = /^(package-lock\.json|public\/|dist\/|dist-electron\/|release\/|\.agents\/)/i;
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp',
  '.onnx', '.wasm', '.bin', '.tar', '.gz', '.zip',
  '.exe', '.dll', '.woff', '.woff2', '.ttf', '.eot'
]);

export function generateReview(silent = false) {
  if (!silent) {
    console.log('[*] FocusSpace -- Generating Option 2 Code Review Export (review.txt)...');
  }

  let trackedFiles = [];
  try {
    const stdout = execSync('git ls-files --cached --others --exclude-standard', {
      cwd: PROJECT_ROOT,
      encoding: 'utf-8',
    });
    trackedFiles = stdout.split(/\r?\n/).filter(Boolean);
  } catch (err) {
    if (!silent) {
      console.error('[!] Failed to execute git ls-files:', err.message);
    }
    return false;
  }

  const eligibleFiles = trackedFiles.filter((relPath) => {
    const normalized = relPath.replace(/\\/g, '/');
    if (EXCLUDE_REGEX.test(normalized)) return false;
    if (normalized === 'review.txt') return false;
    const ext = path.extname(normalized).toLowerCase();
    if (BINARY_EXTENSIONS.has(ext)) return false;
    return true;
  });

  const chunks = [];
  let fileCount = 0;

  for (const relPath of eligibleFiles) {
    const fullPath = path.join(PROJECT_ROOT, relPath);
    if (!fs.existsSync(fullPath)) continue;

    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      chunks.push(`=== FILE: ${relPath.replace(/\\/g, '/')} ===\n`);
      chunks.push(content);
      if (!content.endsWith('\n')) chunks.push('\n');
      chunks.push('\n');
      fileCount++;
    } catch {
      // Ignore unreadable files
    }
  }

  const reviewContent = chunks.join('');
  const destinations = [
    path.join(PROJECT_ROOT, 'review.txt'),
    path.join(WORKSPACE_ROOT, 'review.txt'),
  ];

  if (fs.existsSync(ARTIFACT_DIR)) {
    destinations.push(path.join(ARTIFACT_DIR, 'review.txt'));
  }

  for (const dest of destinations) {
    try {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, reviewContent, 'utf-8');
      if (!silent) {
        const sizeMB = (fs.statSync(dest).size / (1024 * 1024)).toFixed(2);
        console.log(`  + Exported Option 2 review file: ${dest} (${sizeMB} MB)`);
      }
    } catch (writeErr) {
      if (!silent) {
        console.warn(`  ! Warning: Failed to write to ${dest}:`, writeErr.message);
      }
    }
  }

  const finalSizeMB = (Buffer.byteLength(reviewContent, 'utf-8') / (1024 * 1024)).toFixed(2);
  if (!silent) {
    console.log(`[SUCCESS] Option 2 Standard: ${fileCount} code files bundled into review.txt (${finalSizeMB} MB).\n`);
  }
  return true;
}

// Auto-run when executed directly via CLI
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const isSilent = process.argv.includes('--silent') || process.argv.includes('-s');
  generateReview(isSilent);
}
