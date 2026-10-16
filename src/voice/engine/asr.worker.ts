import { env, pipeline } from '@huggingface/transformers';

// Strict offline privacy invariants:
// 1. Same-origin models only
// 2. Zero third-party network requests
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = '/models/';

// Ensure ONNX WASM binaries load strictly from local origin rather than CDN
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.wasmPaths = '/models/wasm/';
  env.backends.onnx.wasm.numThreads = Math.min(4, Math.max(1, (navigator.hardwareConcurrency || 2) - 1));
}

let transcriber: any = null;
let currentModel = 'whisper-tiny.en';

// Whisper 30s window guard: enforce 25s maximum utterance (400,000 samples @ 16kHz)
const MAX_UTTERANCE_SAMPLES = 25 * 16000;

export type WorkerInMessage =
  | { type: 'load'; model?: string }
  | { type: 'transcribe'; id: string; audio: Float32Array }
  | { type: 'dispose' };

export type WorkerOutMessage =
  | { type: 'progress'; fraction: number; file?: string }
  | { type: 'ready' }
  | { type: 'result'; id: string; text: string; ms: number }
  | { type: 'error'; id?: string; message: string };

self.addEventListener('message', async (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data;

  if (msg.type === 'load') {
    try {
      if (msg.model) currentModel = msg.model;
      const isEnglishOnly = currentModel.endsWith('.en');

      // Initialize pipeline with progress tracking
      transcriber = await pipeline('automatic-speech-recognition', currentModel, {
        dtype: 'q8',
        progress_callback: (info: any) => {
          if (info.status === 'progress' && typeof info.progress === 'number') {
            self.postMessage({
              type: 'progress',
              fraction: info.progress / 100,
              file: info.file,
            } satisfies WorkerOutMessage);
          }
        },
      });

      // Warmup inference on 1 second of silence so the first real user utterance executes fast.
      // English-only Whisper models reject 'language: english'; only multilingual models accept it.
      try {
        const silence1s = new Float32Array(16000);
        const warmupOptions = isEnglishOnly ? {} : { language: 'english', task: 'transcribe' };
        await transcriber(silence1s, warmupOptions);
      } catch (warmupErr) {
        console.warn('[FocusSpace ASR Worker] Warmup non-fatal warning:', warmupErr);
      }

      self.postMessage({ type: 'ready' } satisfies WorkerOutMessage);
    } catch (err: any) {
      self.postMessage({
        type: 'error',
        message: err?.message || 'Failed to initialize speech recognition engine',
      } satisfies WorkerOutMessage);
    }
    return;
  }

  if (msg.type === 'transcribe') {
    const { id, audio } = msg;
    const start = performance.now();

    if (!transcriber) {
      self.postMessage({
        type: 'error',
        id,
        message: 'Engine is not loaded yet',
      } satisfies WorkerOutMessage);
      return;
    }

    try {
      // Enforce 25s max utterance cap to prevent Whisper 30s window overflow
      const boundedAudio = audio.length > MAX_UTTERANCE_SAMPLES
        ? audio.subarray(0, MAX_UTTERANCE_SAMPLES)
        : audio;

      const isEnglishOnly = currentModel.endsWith('.en');
      const transcribeOptions: Record<string, any> = {
        return_timestamps: false,
        ...(isEnglishOnly ? {} : { language: 'english', task: 'transcribe' }),
      };

      const result = await transcriber(boundedAudio, transcribeOptions);

      const ms = Math.round(performance.now() - start);
      const text = typeof result?.text === 'string' ? result.text.trim() : '';

      self.postMessage({
        type: 'result',
        id,
        text,
        ms,
      } satisfies WorkerOutMessage);
    } catch (err: any) {
      self.postMessage({
        type: 'error',
        id,
        message: err?.message || 'Transcription failed',
      } satisfies WorkerOutMessage);
    }
    return;
  }

  if (msg.type === 'dispose') {
    transcriber = null;
  }
});
