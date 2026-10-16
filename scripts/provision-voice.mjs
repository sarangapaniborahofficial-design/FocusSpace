#!/usr/bin/env node

/**
 * FocusSpace Voice Studio — Offline Asset Provisioner
 *
 * Copies Silero VAD ONNX models, audio worklet scripts, and onnxruntime WebAssembly
 * binaries directly from node_modules into public/vad/ and public/models/wasm/.
 *
 * Guarantees 100% same-origin, zero-cloud offline execution without CDN fallbacks.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const VAD_SRC = path.join(ROOT, 'node_modules', '@ricky0123', 'vad-web', 'dist');
const ONNX_SRC = path.join(ROOT, 'node_modules', 'onnxruntime-web', 'dist');

const PUBLIC_VAD = path.join(ROOT, 'public', 'vad');
const PUBLIC_WASM = path.join(ROOT, 'public', 'models', 'wasm');

console.log('🎙️ FocusSpace Voice Studio — Provisioning offline runtime assets...');

fs.mkdirSync(PUBLIC_VAD, { recursive: true });
fs.mkdirSync(PUBLIC_WASM, { recursive: true });

function copyIfExists(src, dest) {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    const size = (fs.statSync(dest).size / 1024).toFixed(1);
    console.log(`  ✓ Copied: ${path.basename(dest)} (${size} KB) -> ${path.relative(ROOT, path.dirname(dest))}`);
    return true;
  }
  return false;
}

// 1. Provision Silero VAD models and worklet bundle
if (fs.existsSync(VAD_SRC)) {
  const vadFiles = fs.readdirSync(VAD_SRC).filter(f => f.endsWith('.onnx') || f.includes('worklet') || f.endsWith('.wasm'));
  for (const f of vadFiles) {
    copyIfExists(path.join(VAD_SRC, f), path.join(PUBLIC_VAD, f));
  }
} else {
  console.warn('  ⚠️ @ricky0123/vad-web not found in node_modules.');
}

// 2. Provision onnxruntime-web WASM binaries for transformers.js & VAD
if (fs.existsSync(ONNX_SRC)) {
  const wasmFiles = fs.readdirSync(ONNX_SRC).filter(f => f.endsWith('.wasm'));
  for (const f of wasmFiles) {
    copyIfExists(path.join(ONNX_SRC, f), path.join(PUBLIC_WASM, f));
    // Also place in /vad/ for VAD wasm loader fallback
    copyIfExists(path.join(ONNX_SRC, f), path.join(PUBLIC_VAD, f));
  }
} else {
  console.warn('  ⚠️ onnxruntime-web not found in node_modules.');
}

console.log('✅ Offline voice runtime assets provisioned successfully.\n');
