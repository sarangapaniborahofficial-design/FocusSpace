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

const EXCLUDE_REGEX = /^(package-lock\.json|public\/|dist\/|dist-electron\/|release\/|\.agents\/|review-bundles\/)/i;
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

  // --- Generate Domain-Specific Review Bundles (Claude-Friendly < 350KB chunks) ---
  const viewFiles = new Set([
    'src/components/Today.tsx',
    'src/components/Analytics.tsx',
    'src/components/PageView.tsx',
    'src/components/Review.tsx',
    'src/components/Calendar.tsx',
    'src/components/Journal.tsx',
    'src/components/Settings.tsx',
    'src/components/TaskManager.tsx',
    'src/components/OnboardingWelcome.tsx',
    'src/components/CategoryView.tsx',
    'src/components/PagesList.tsx',
  ]);

  const domainCategories = {
    '00-README-and-docs.txt': (f) => f.endsWith('.md') && !f.includes('/'),
    '01-desktop-and-core.txt': (f) => f.startsWith('electron/') || f.startsWith('src/db/') || f === 'src/App.tsx' || f === 'src/main.tsx' || f === 'src/types.ts' || f.startsWith('scripts/'),
    '02a-ui-views.txt': (f) => viewFiles.has(f),
    '02b-ui-widgets-and-modals.txt': (f) => f.startsWith('src/components/') && !viewFiles.has(f),
    '03-voice-and-audio.txt': (f) => f.startsWith('src/voice/') || f === 'src/lib/ambientSound.ts' || f === 'src/lib/soundscape.ts',
    '04-vault-and-logic.txt': (f) => f.startsWith('src/lib/') && f !== 'src/lib/ambientSound.ts' && f !== 'src/lib/soundscape.ts',
  };

  const bundleRoots = [
    path.join(PROJECT_ROOT, 'review-bundles'),
    path.join(WORKSPACE_ROOT, 'review-bundles'),
  ];
  if (fs.existsSync(ARTIFACT_DIR)) {
    bundleRoots.push(path.join(ARTIFACT_DIR, 'review-bundles'));
  }

  for (const bRoot of bundleRoots) {
    try {
      fs.mkdirSync(bRoot, { recursive: true });
    } catch {}
  }

  for (const [bundleName, predicate] of Object.entries(domainCategories)) {
    const bundleChunks = [];
    for (const relPath of eligibleFiles) {
      const norm = relPath.replace(/\\/g, '/');
      if (predicate(norm)) {
        const fullPath = path.join(PROJECT_ROOT, relPath);
        if (fs.existsSync(fullPath)) {
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            bundleChunks.push(`=== FILE: ${norm} ===\n`);
            bundleChunks.push(content);
            if (!content.endsWith('\n')) bundleChunks.push('\n');
            bundleChunks.push('\n');
          } catch {}
        }
      }
    }

    const bundleContent = bundleChunks.join('');
    for (const bRoot of bundleRoots) {
      try {
        const bundleDest = path.join(bRoot, bundleName);
        fs.writeFileSync(bundleDest, bundleContent, 'utf-8');
      } catch {}
    }
    if (!silent) {
      const bSizeKB = (Buffer.byteLength(bundleContent, 'utf-8') / 1024).toFixed(1);
      console.log(`  + Exported modular review bundle: review-bundles/${bundleName} (${bSizeKB} KB)`);
    }
  }

  // --- Generate Clean Code-Only ZIP Archive (Zero Heavy AI Models, Claude-Friendly) ---
  const zipName = 'focusspace-code.zip';
  const zipTargets = [
    path.join(PROJECT_ROOT, zipName),
    path.join(WORKSPACE_ROOT, zipName),
  ];
  if (fs.existsSync(ARTIFACT_DIR)) {
    zipTargets.push(path.join(ARTIFACT_DIR, zipName));
  }

  try {
    const primaryZip = zipTargets[0];
    const zipItems = [
      'src',
      'electron',
      'scripts',
      'package.json',
      'vite.config.ts',
      'tsconfig.json',
      'index.html',
      'README.md',
      'STATUS.md',
      'TODO.md',
      'ROADMAP.md',
    ];
    // Use native Windows tar.exe to create a standard .zip archive with zero binary assets
    execSync(`tar.exe -a -cf "${primaryZip}" ${zipItems.join(' ')}`, {
      cwd: PROJECT_ROOT,
      stdio: 'ignore',
    });

    if (fs.existsSync(primaryZip)) {
      const zipSizeKB = (fs.statSync(primaryZip).size / 1024).toFixed(1);
      for (let i = 1; i < zipTargets.length; i++) {
        try {
          fs.copyFileSync(primaryZip, zipTargets[i]);
        } catch {}
      }
      if (!silent) {
        console.log(`  + Exported Code-Only ZIP archive: ${zipName} (${zipSizeKB} KB)`);
      }
    }
  } catch (zipErr) {
    if (!silent) {
      console.warn('  ! Note: Could not create code-only zip archive:', zipErr.message);
    }
  }

  const finalSizeMB = (Buffer.byteLength(reviewContent, 'utf-8') / (1024 * 1024)).toFixed(2);
  if (!silent) {
    console.log(`[SUCCESS] Option 2 Standard: ${fileCount} code files bundled into review.txt (${finalSizeMB} MB) + modular bundles + code-only zip.\n`);
  }
  return true;
}

// Auto-run when executed directly via CLI
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const isSilent = process.argv.includes('--silent') || process.argv.includes('-s');
  generateReview(isSilent);
}
