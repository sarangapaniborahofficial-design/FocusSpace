#!/usr/bin/env node

/**
 * FocusSpace Voice Studio — Offline Asset Provisioner
 *
 * Copies:
 * 1. The single active ONNX Runtime Web WASM variant (ort-wasm-simd-threaded.wasm)
 *    and its matching .mjs loader into public/ort/.
 * 2. Silero VAD v5 model and audio worklet scripts into public/vad/.
 *
 * Cleans up unused duplicate WASM binaries and legacy models, ensuring a minimal
 * footprint and 100% same-origin, zero-cloud offline execution without CDN fallbacks.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const VAD_SRC = path.join(ROOT, 'node_modules', '@ricky0123', 'vad-web', 'dist');
const ONNX_SRC = path.join(ROOT, 'node_modules', 'onnxruntime-web', 'dist');

const PUBLIC_DIR = path.join(ROOT, 'public');
const PUBLIC_ORT = path.join(PUBLIC_DIR, 'ort');
const PUBLIC_VAD = path.join(PUBLIC_DIR, 'vad');
const LEGACY_WASM_DIR = path.join(PUBLIC_DIR, 'models', 'wasm');

console.log('🎙️ FocusSpace Voice Studio — Provisioning consolidated offline runtime assets...');

fs.mkdirSync(PUBLIC_ORT, { recursive: true });
fs.mkdirSync(PUBLIC_VAD, { recursive: true });

function copyIfExists(src, dest) {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    const size = (fs.statSync(dest).size / 1024).toFixed(1);
    console.log(`  ✓ Copied: ${path.basename(dest)} (${size} KB) -> ${path.relative(ROOT, path.dirname(dest))}`);
    return true;
  }
  return false;
}

// 1. Provision the active ONNX Runtime WASM binaries and matching MJS loaders into public/ort/
if (fs.existsSync(ONNX_SRC)) {
  const filesToCopy = [
    'ort-wasm-simd-threaded.wasm',
    'ort-wasm-simd-threaded.mjs',
    'ort-wasm-simd-threaded.asyncify.wasm',
    'ort-wasm-simd-threaded.asyncify.mjs',
  ];

  for (const f of filesToCopy) {
    copyIfExists(path.join(ONNX_SRC, f), path.join(PUBLIC_ORT, f));
  }
} else {
  console.warn('  ⚠️ onnxruntime-web not found in node_modules.');
}

// 2. Provision Silero VAD v5, legacy fallback, and audio worklet scripts into public/vad/
if (fs.existsSync(VAD_SRC)) {
  const vadFiles = ['silero_vad_v5.onnx', 'silero_vad_legacy.onnx', 'vad.worklet.bundle.min.js', 'vad.worklet.bundle.dev.js'];
  for (const f of vadFiles) {
    copyIfExists(path.join(VAD_SRC, f), path.join(PUBLIC_VAD, f));
  }
} else {
  console.warn('  ⚠️ @ricky0123/vad-web not found in node_modules.');
}

// 3. Clean up legacy duplicate models/wasm directory
if (fs.existsSync(LEGACY_WASM_DIR)) {
  fs.rmSync(LEGACY_WASM_DIR, { recursive: true, force: true });
  console.log('  ✓ Cleaned up legacy directory: public/models/wasm/');
}

// 4. Remove stale/unused WASM variants and unneeded files from public/vad/
if (fs.existsSync(PUBLIC_VAD)) {
  const entries = fs.readdirSync(PUBLIC_VAD);
  for (const entry of entries) {
    if (
      entry.endsWith('.wasm') ||
      entry === 'silero_vad_v6.onnx' ||
      entry.endsWith('.d.ts') ||
      entry.endsWith('.d.ts.map') ||
      entry === 'worklet.js' ||
      entry === 'worklet.js.map'
    ) {
      fs.rmSync(path.join(PUBLIC_VAD, entry), { force: true });
      console.log(`  ✓ Removed redundant file: public/vad/${entry}`);
    }
  }
}

console.log('✅ Consolidated offline voice runtime assets provisioned successfully.\n');
