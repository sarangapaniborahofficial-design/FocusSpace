#!/usr/bin/env node

/**
 * FocusSpace Voice Studio — Asset Integrity Verifier
 *
 * Checks that all necessary offline voice assets exist and are non-empty:
 * - Single active ONNX WASM binary and matching MJS loader in public/ort/
 * - Silero VAD v5 ONNX model and audio worklet bundle in public/vad/
 * - Whisper tokenizer, configs, and quantized ONNX models in public/models/whisper-tiny.en/
 *
 * In CI/Vercel or postinstall without --strict, missing gitignored models emit
 * a non-fatal warning so deployment builds never crash.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const isStrict = process.argv.includes('--strict');
const isPostInstall =
  process.env.npm_lifecycle_event === 'postinstall' ||
  Boolean(process.env.VERCEL) ||
  Boolean(process.env.CI);

const REQUIRED_FILES = [
  // ONNX Runtime Web consolidated binaries
  'public/ort/ort-wasm-simd-threaded.wasm',
  'public/ort/ort-wasm-simd-threaded.mjs',
  'public/ort/ort-wasm-simd-threaded.asyncify.wasm',
  'public/ort/ort-wasm-simd-threaded.asyncify.mjs',

  // Silero VAD v5 & legacy fallback & audio worklet
  'public/vad/silero_vad_v5.onnx',
  'public/vad/silero_vad_legacy.onnx',
  'public/vad/vad.worklet.bundle.min.js',

  // Whisper Tiny English offline model weights & tokenizer
  'public/models/whisper-tiny.en/config.json',
  'public/models/whisper-tiny.en/generation_config.json',
  'public/models/whisper-tiny.en/preprocessor_config.json',
  'public/models/whisper-tiny.en/tokenizer.json',
  'public/models/whisper-tiny.en/tokenizer_config.json',
  'public/models/whisper-tiny.en/vocab.json',
  'public/models/whisper-tiny.en/merges.txt',
  'public/models/whisper-tiny.en/normalizer.json',
  'public/models/whisper-tiny.en/added_tokens.json',
  'public/models/whisper-tiny.en/special_tokens_map.json',
  'public/models/whisper-tiny.en/quantize_config.json',
  'public/models/whisper-tiny.en/onnx/encoder_model_quantized.onnx',
  'public/models/whisper-tiny.en/onnx/decoder_model_merged_quantized.onnx',
];

console.log('🔍 Checking FocusSpace offline voice assets integrity...');

let missingCount = 0;
let totalBytes = 0;

for (const relPath of REQUIRED_FILES) {
  const fullPath = path.join(ROOT, relPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`  ❌ MISSING: ${relPath}`);
    missingCount++;
    continue;
  }

  const stat = fs.statSync(fullPath);
  if (stat.size === 0) {
    console.error(`  ❌ EMPTY (0 bytes): ${relPath}`);
    missingCount++;
    continue;
  }

  totalBytes += stat.size;
  const sizeStr = stat.size > 1024 * 1024
    ? `${(stat.size / 1024 / 1024).toFixed(2)} MB`
    : `${(stat.size / 1024).toFixed(1)} KB`;
  console.log(`  ✓ ${relPath} (${sizeStr})`);
}

if (missingCount > 0) {
  if (isPostInstall && !isStrict) {
    console.log('\n┌────────────────────────────────────────────────────────────────────────┐');
    console.log('│  🎙️  FocusSpace Voice Studio — Offline Model Provisioning Needed      │');
    console.log('├────────────────────────────────────────────────────────────────────────┤');
    console.log(`│  Notice: ${String(missingCount).padStart(2)} offline model asset(s) not yet present in public/models/. │`);
    console.log('│  This is expected on fresh git clones (models are gitignored).         │');
    console.log('│                                                                        │');
    console.log('│  To provision the local Whisper ASR models (~59 MB), run:              │');
    console.log('│    npm run setup:voice                                                 │');
    console.log('└────────────────────────────────────────────────────────────────────────┘\n');
    process.exit(0);
  }

  console.error('\n┌────────────────────────────────────────────────────────────────────────┐');
  console.error('│  ❌  FocusSpace Voice Studio — Asset Verification Failed              │');
  console.error('├────────────────────────────────────────────────────────────────────────┤');
  console.error(`│  ${String(missingCount).padStart(2)} required file(s) are missing or empty in public/models/ or public/ort/ │`);
  console.error('│  Run "npm run setup:voice" to download and provision offline models.   │');
  console.error('└────────────────────────────────────────────────────────────────────────┘\n');
  process.exit(1);
}

console.log(`\n✅ All ${REQUIRED_FILES.length} voice assets verified! Total payload: ${(totalBytes / 1024 / 1024).toFixed(2)} MB.\n`);
process.exit(0);
