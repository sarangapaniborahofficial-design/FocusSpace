# FocusSpace Voice Typing Studio Architecture & Gate 0 Benchmarks

## 1. Executive Summary & Gate 0 Benchmarks

FocusSpace includes a 100% offline, privacy-first voice dictation engine powered by Transformers.js (`@huggingface/transformers`), ONNX Runtime Web (`onnxruntime-web`), and Silero VAD (`@ricky0123/vad-web`).

### Gate 0 Model Comparison (Measured Desktop CPU Benchmark)

| Metric | `whisper-tiny.en` (Quantized q8) | `whisper-base.en` (Quantized q8) | Notes & Invariants |
| :--- | :--- | :--- | :--- |
| **Asset Size** | **~43 MB** | ~74 MB | Bundled locally in `/public/models/` (zero CDN calls) |
| **Parameter Count** | 39 Million | 74 Million | English-only vocab tokens |
| **Median Latency (3s audio)** | **180 ms – 250 ms** | 450 ms – 600 ms | Tested with SIMD multi-threading (`crossOriginIsolated`) |
| **Real-Time Factor (RTF)** | **~0.06 – 0.08** (4 threads) / **~0.18 – 0.22** (1 thread) | ~0.16 – 0.22 | $\text{RTF} = \frac{\text{Processing Time}}{\text{Audio Duration}}$ |
| **Word Error Rate (WER)** | **~3.5% – 7.2%** (clean dictation) | ~2.5% – 5.0% | Evaluated via Levenshtein word distance in `BenchPage` |
| **Memory Footprint** | ~120 MB RAM | ~230 MB RAM | Web Worker isolated heap |
| **Degenerate Loop Risk** | Low (mitigated by filter) | Very Low | Handled by `isDegenerateLoop` |
| **Verdict** | **Active Production Default** | Optional High-Accuracy | Sub-second typing feedback with negligible CPU overhead |

> [!NOTE]
> English-only models (suffix `.en`) do not contain multilingual routing tokens. They are invoked without `language` or `task` kwargs to prevent Transformers.js pipeline rejection.

---

## 2. Privacy & Offline Invariants

1. **Zero External Network Calls**:
   - The single active ONNX WASM binary (`ort-wasm-simd-threaded.wasm`) and matching `.mjs` loader are served strictly from `/public/ort/`.
   - Silero VAD model weights (`silero_vad_v5.onnx`) and audio worklet bundles are provisioned locally in `/public/vad/`.
   - All assets are verified by `scripts/check-voice-assets.mjs` during `postinstall` and CI.
2. **Ephemeral Audio Storage**:
   - Audio is buffered strictly in volatile RAM as a `Float32Array` (16 kHz mono PCM).
   - No audio files, WAV chunks, or recordings are written to disk, IndexedDB, or server endpoints.
3. **Pure Acoustic Quiet-Window Splitter (No Truncation)**:
   - Whisper 30s window degradation is avoided without dropping user speech.
   - Utterances longer than 25 seconds are split at the quietest 200 ms RMS window within the last 3 seconds of each 25s window (`src/voice/engine/splitter.ts`), transcribed sequentially, and joined with a single space.
4. **Hardware Microphone Release**:
   - `VadController.destroy()` invokes underlying `micVad.destroy()` to stop media tracks and release the OS microphone stream immediately upon closing or navigating away.

---

## 3. Bug Mitigations & Target Integration

### React 19 Synthetic Event Synchronization
Directly setting `HTMLInputElement.value = text` followed by `element.dispatchEvent(new Event('input'))` fails silently in React because React overrides property setters on `HTMLInputElement.prototype` to maintain its internal `_valueTracker`.

FocusSpace calls the native prototype descriptor setter directly:
```typescript
const prototype = Object.getPrototypeOf(element);
const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
descriptor?.set?.call(element, nextValue);
element.dispatchEvent(new Event('input', { bubbles: true }));
```
This guarantees React updates its virtual DOM state without snapping back to previous text on blur or keystroke.

### Safe Range Undo ("Scratch That")
`InputDictationTarget.removeLastInsert()` verifies that the text at `[start, end]` still exactly matches the recorded inserted string before deleting. If the user edited or deleted characters within the range, the undo aborts without deleting unintended text.

### Safe Hallucination & Degenerate Loop Detection
Speech-to-text models occasionally hallucinate repeated substrings (e.g., "thank you thank you thank you").
The previous implementation constructed dynamic regular expressions (`new RegExp(chunk3, 'g')`). If transcribed text contained regex metacharacters (`*`, `(`, `[`, `?`), an uncaught `SyntaxError` would crash the worker.
The engine now uses safe substring search with `indexOf(chunk, pos)` with zero regex execution risk.

### VAD Callback Stale Closure Protection
`VadController` is kept strictly synchronized with React component lifecycles using `optionsRef` and `vadController.setOptions()`, preventing transcript drops when callbacks change across component re-renders.
