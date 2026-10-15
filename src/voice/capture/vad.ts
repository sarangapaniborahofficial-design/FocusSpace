import { MicVAD } from '@ricky0123/vad-web';

export interface VadControllerOptions {
  onSpeechStart?: () => void;
  onSpeechEnd?: (audio: Float32Array) => void;
  onAudioLevel?: (level: number) => void;
  onError?: (err: Error) => void;
}

export class VadController {
  private micVad: MicVAD | null = null;
  private options: VadControllerOptions;
  private isListening = false;

  constructor(options: VadControllerOptions) {
    this.options = options;
  }

  async start(): Promise<void> {
    if (this.isListening && this.micVad) return;

    try {
      if (!this.micVad) {
        this.micVad = await MicVAD.new({
          // Local asset path to ensure zero third-party calls
          baseAssetPath: '/vad/',
          onnxWASMBasePath: '/vad/',

          // Optimal conversational pause settings (per Voice Guide):
          // ~1000ms redemption silence to allow thinking pauses
          redemptionMs: 1000,
          // ~400ms minimum speech to filter clicks/coughs
          minSpeechMs: 400,
          // ~300ms pre-speech padding to protect first syllable
          preSpeechPadMs: 300,

          positiveSpeechThreshold: 0.5,
          negativeSpeechThreshold: 0.35,

          onSpeechStart: () => {
            this.options.onSpeechStart?.();
          },

          onSpeechEnd: (audio: Float32Array) => {
            this.options.onSpeechEnd?.(audio);
          },

          onFrameProcessed: (probs, frame) => {
            if (this.options.onAudioLevel) {
              // Calculate rough RMS level for HUD visualizer
              let sum = 0;
              for (let i = 0; i < frame.length; i += 4) {
                sum += frame[i] * frame[i];
              }
              const rms = Math.sqrt(sum / (frame.length / 4));
              // Normalize level to 0..1
              const level = Math.min(1, rms * 5);
              this.options.onAudioLevel(level);
            }
          },
        });
      }

      await this.micVad.start();
      this.isListening = true;
    } catch (err: any) {
      this.isListening = false;
      const error = err instanceof Error ? err : new Error(String(err));
      this.options.onError?.(error);
      throw error;
    }
  }

  async pause(): Promise<void> {
    if (this.micVad && this.isListening) {
      await this.micVad.pause();
      this.isListening = false;
    }
  }

  destroy(): void {
    if (this.micVad) {
      this.micVad.pause().catch(() => {});
      this.micVad = null;
    }
    this.isListening = false;
  }

  isActive(): boolean {
    return this.isListening;
  }
}
