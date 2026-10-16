import { env, pipeline } from '@huggingface/transformers';
import { splitAudio } from './splitter';

// Strict offline privacy invariants:
// 1. Same-origin models only
// 2. Zero third-party network requests
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = '/models/';

// Ensure ONNX WASM binaries load strictly from local origin rather than CDN
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.wasmPaths = '/ort/';
  env.backends.onnx.wasm.numThreads = Math.min(4, Math.max(1, (navigator.hardwareConcurrency || 2) - 1));
}

let transcriber: any = null;
let currentModel = 'whisper-tiny.en';

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
      const chunks = splitAudio(audio);
      const isEnglishOnly = currentModel.endsWith('.en');
      const transcribeOptions: Record<string, any> = {
        return_timestamps: false,
        ...(isEnglishOnly ? {} : { language: 'english', task: 'transcribe' }),
      };

      const texts: string[] = [];
      for (const chunk of chunks) {
        if (chunk.length < 3200) continue; // skip sub-200ms residue if any
        const result = await transcriber(chunk, transcribeOptions);
        const chunkText = typeof result?.text === 'string' ? result.text.trim() : '';
        if (chunkText) {
          texts.push(chunkText);
        }
      }

      const ms = Math.round(performance.now() - start);
      const text = texts.join(' ').trim();

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
