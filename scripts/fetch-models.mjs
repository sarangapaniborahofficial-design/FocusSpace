#!/usr/bin/env node

/**
 * FocusSpace Voice Studio — Dev-time Model Provisioning Script
 *
 * Downloads quantized ONNX models from HuggingFace into public/models/<model_id>/
 * for 100% same-origin, zero-cloud offline execution.
 *
 * Usage:
 *   node scripts/fetch-models.mjs [model_name]
 * Default model: onnx-community/whisper-tiny.en
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const DEFAULT_REPO = 'onnx-community/whisper-tiny.en';
const targetRepo = process.argv[2] || DEFAULT_REPO;
const localFolder = targetRepo.includes('/') ? targetRepo.split('/').pop() : targetRepo;
const outDir = path.join(ROOT, 'public', 'models', localFolder);

console.log(`\n======================================================`);
console.log(`🎙️ FocusSpace Voice Studio — Model Provisioning`);
console.log(`======================================================`);
console.log(`Source Repo:   ${targetRepo}`);
console.log(`Target Output: ${outDir}\n`);

fs.mkdirSync(outDir, { recursive: true });

const ESSENTIAL_FILES = [
  'config.json',
  'generation_config.json',
  'preprocessor_config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'vocab.json',
  'merges.txt',
  'onnx/encoder_model_quantized.onnx',
  'onnx/decoder_model_merged_quantized.onnx',
];

async function downloadFile(repo, filename) {
  const url = `https://huggingface.co/${repo}/resolve/main/${filename}`;
  const destPath = path.join(outDir, filename);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });

  if (fs.existsSync(destPath)) {
    const stats = fs.statSync(destPath);
    if (stats.size > 0) {
      console.log(`  ✓ Already cached: ${filename} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
      return;
    }
  }

  process.stdout.write(`  ⏳ Fetching ${filename}... `);
  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 404) {
        console.log(`[Skipped - not present in repo]`);
        return;
      }
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    fs.writeFileSync(destPath, Buffer.from(arrayBuffer));
    console.log(`✓ (${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);
  } catch (err) {
    console.error(`FAILED: ${err.message}`);
  }
}

async function main() {
  console.log('1. Provisioning runtime VAD and ONNX WASM binaries from node_modules...');
  execSync(`node "${path.join(__dirname, 'provision-voice.mjs')}"`, { stdio: 'inherit' });

  console.log('2. Provisioning Whisper speech recognition model weights...');
  for (const file of ESSENTIAL_FILES) {
    await downloadFile(targetRepo, file);
  }
  console.log(`\n✅ Model provisioning complete. Files ready in ${outDir}\n`);
}

main().catch(err => {
  console.error('\n❌ Fatal error downloading model:', err);
  process.exit(1);
});
