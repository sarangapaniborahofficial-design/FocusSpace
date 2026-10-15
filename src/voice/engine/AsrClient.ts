import type { WorkerInMessage, WorkerOutMessage } from './asr.worker';

export interface AsrEngine {
  load(onProgress?: (fraction: number) => void): Promise<void>;
  transcribe(audio: Float32Array): Promise<string>;
  dispose(): void;
  isReady(): boolean;
}

interface QueuedItem {
  id: string;
  audio: Float32Array;
  resolve: (text: string) => void;
  reject: (err: Error) => void;
}

const STOCK_HALLUCINATIONS = new Set([
  'thank you.',
  'thank you',
  'thanks for watching.',
  'thanks for watching',
  'you',
  'you.',
  'bye.',
  'bye',
]);

/**
 * Calculates Root Mean Square energy of 16kHz audio buffer.
 */
export function calculateRms(audio: Float32Array): number {
  if (audio.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < audio.length; i++) {
    sum += audio[i] * audio[i];
  }
  return Math.sqrt(sum / audio.length);
}

/**
 * Checks if a string contains repeated degenerate n-gram loops (Whisper artifact).
 */
export function isDegenerateLoop(text: string): boolean {
  const words = text.toLowerCase().trim().split(/\s+/);
  if (words.length >= 6) {
    const chunk3 = words.slice(0, 3).join(' ');
    const count = (text.toLowerCase().match(new RegExp(chunk3, 'g')) || []).length;
    if (count >= 3) return true;
  }
  return false;
}

export class AsrClient implements AsrEngine {
  private worker: Worker | null = null;
  private queue: QueuedItem[] = [];
  private activeItem: QueuedItem | null = null;
  private ready = false;
  private loadPromise: Promise<void> | null = null;
  private onProgressCallback?: (fraction: number) => void;
  private restartCount = 0;
  private modelName = 'whisper-tiny.en';

  constructor(modelName = 'whisper-tiny.en') {
    this.modelName = modelName;
  }

  isReady(): boolean {
    return this.ready;
  }

  private initWorker(): void {
    if (this.worker) return;

    this.worker = new Worker(new URL('./asr.worker.ts', import.meta.url), {
      type: 'module',
    });

    this.worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
      const msg = e.data;

      if (msg.type === 'progress') {
        this.onProgressCallback?.(msg.fraction);
        return;
      }

      if (msg.type === 'ready') {
        this.ready = true;
        this.restartCount = 0;
        return;
      }

      if (msg.type === 'result') {
        if (this.activeItem && this.activeItem.id === msg.id) {
          let text = msg.text;

          // Hallucination guards:
          // 1. If audio was under 1.5s (24000 samples) and text is a stock hallucination, drop it
          if (this.activeItem.audio.length < 24000 && STOCK_HALLUCINATIONS.has(text.toLowerCase())) {
            text = '';
          }

          // 2. Drop degenerate loop repetitions
          if (isDegenerateLoop(text)) {
            text = '';
          }

          this.activeItem.resolve(text);
          this.activeItem = null;
          this.processNext();
        }
        return;
      }

      if (msg.type === 'error') {
        if (this.activeItem && (!msg.id || this.activeItem.id === msg.id)) {
          this.activeItem.reject(new Error(msg.message));
          this.activeItem = null;
          this.processNext();
        }
        return;
      }
    };

    this.worker.onerror = () => {
      // Worker crashed. Attempt 1 restart if within limits.
      if (this.restartCount < 1) {
        this.restartCount++;
        this.dispose();
        this.initWorker();
        this.load().catch(() => {});
      } else if (this.activeItem) {
        this.activeItem.reject(new Error('ASR Worker crashed and failed to restart'));
        this.activeItem = null;
        this.processNext();
      }
    };
  }

  async load(onProgress?: (fraction: number) => void): Promise<void> {
    if (this.ready) return;
    if (onProgress) this.onProgressCallback = onProgress;
    if (this.loadPromise) return this.loadPromise;

    this.initWorker();

    this.loadPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('ASR model load timed out'));
      }, 90000);

      const handler = (e: MessageEvent<WorkerOutMessage>) => {
        if (e.data.type === 'ready') {
          clearTimeout(timeout);
          this.worker?.removeEventListener('message', handler);
          resolve();
        } else if (e.data.type === 'error' && !('id' in e.data)) {
          clearTimeout(timeout);
          this.worker?.removeEventListener('message', handler);
          reject(new Error(e.data.message));
        }
      };

      this.worker?.addEventListener('message', handler);
      this.worker?.postMessage({
        type: 'load',
        model: this.modelName,
      } satisfies WorkerInMessage);
    });

    return this.loadPromise;
  }

  async transcribe(audio: Float32Array): Promise<string> {
    // Pre-inference Hallucination Guards:
    // Skip utterances shorter than 0.4s (6400 samples) or below RMS energy threshold
    if (audio.length < 6400) return '';
    const rms = calculateRms(audio);
    if (rms < 0.005) return '';

    if (!this.ready) {
      await this.load();
    }

    return new Promise<string>((resolve, reject) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      this.queue.push({ id, audio, resolve, reject });
      if (!this.activeItem) {
        this.processNext();
      }
    });
  }

  private processNext(): void {
    if (this.activeItem || this.queue.length === 0 || !this.worker) return;

    this.activeItem = this.queue.shift()!;
    // Clone buffer for worker transfer
    const copy = new Float32Array(this.activeItem.audio);
    this.worker.postMessage(
      {
        type: 'transcribe',
        id: this.activeItem.id,
        audio: copy,
      } satisfies WorkerInMessage,
      [copy.buffer]
    );
  }

  dispose(): void {
    if (this.worker) {
      this.worker.postMessage({ type: 'dispose' } satisfies WorkerInMessage);
      this.worker.terminate();
      this.worker = null;
    }
    this.ready = false;
    this.loadPromise = null;
    this.activeItem = null;
    this.queue = [];
  }
}

let singletonAsrClient: AsrClient | null = null;

export function getAsrClient(): AsrClient {
  if (!singletonAsrClient) {
    singletonAsrClient = new AsrClient('whisper-tiny.en');
  }
  return singletonAsrClient;
}
