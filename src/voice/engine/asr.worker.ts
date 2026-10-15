import { env, pipeline } from '@huggingface/transformers';

// Strict offline privacy invariants:
// 1. Same-origin models only
// 2. Zero third-party network requests
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = '/models/';

// Limit threads to keep UI fluid
if (env.backends?.onnx?.wasm) {
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

      // Warmup inference on 1 second of silence so the first real user utterance executes fast
      try {
        const silence1s = new Float32Array(16000);
        await transcriber(silence1s, {
          language: 'english',
          task: 'transcribe',
        });
      } catch {
        /* warmup catch */
      }

      self.postMessage({ type: 'ready' } satisfies WorkerOutMessage);
    } catch (err: any) {
      // If local files are not yet downloaded in dev mode, provide helpful error or fallback info
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
      const result = await transcriber(audio, {
        language: 'english',
        task: 'transcribe',
        return_timestamps: false,
      });

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
