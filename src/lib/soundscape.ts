import { storage } from './utils';

export type SoundscapeType = 'off' | 'brown' | 'rain' | 'binaural';

export interface SoundscapeState {
  type: SoundscapeType;
  volume: number; // 0 to 1
  isPlaying: boolean;
}

const STORAGE_TYPE_KEY = 'focusspace-soundscape-type';
const STORAGE_VOL_KEY = 'focusspace-soundscape-vol';

class SoundscapeEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private currentSource: { stop: () => void } | null = null;
  private currentType: SoundscapeType = 'off';
  private volume: number = 0.5;
  private listeners: Set<() => void> = new Set();

  private snapshot: SoundscapeState;

  constructor() {
    const savedType = storage.get(STORAGE_TYPE_KEY) as SoundscapeType | null;
    const savedVol = storage.get(STORAGE_VOL_KEY);
    if (savedType && ['off', 'brown', 'rain', 'binaural'].includes(savedType)) {
      this.currentType = savedType;
    }
    if (savedVol !== null) {
      const v = parseFloat(savedVol);
      if (!isNaN(v) && v >= 0 && v <= 1) this.volume = v;
    }
    this.snapshot = {
      type: this.currentType,
      volume: this.volume,
      isPlaying: false,
    };
  }

  private initCtx(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  getState(): SoundscapeState {
    return this.snapshot;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(l => l());
  }

  private updateSnapshot() {
    this.snapshot = {
      type: this.currentType,
      volume: this.volume,
      isPlaying: this.currentType !== 'off' && this.currentSource !== null,
    };
    this.notify();
  }

  setVolume(vol: number) {
    const clamped = Math.max(0, Math.min(1, vol));
    this.volume = clamped;
    storage.set(STORAGE_VOL_KEY, String(clamped));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(clamped, this.ctx.currentTime, 0.05);
    }
    this.updateSnapshot();
  }

  setType(type: SoundscapeType) {
    if (this.currentType === type && this.currentSource) return;
    this.stopCurrent();
    this.currentType = type;
    storage.set(STORAGE_TYPE_KEY, type);

    if (type !== 'off') {
      this.startType(type);
    }
    this.updateSnapshot();
  }

  private stopCurrent() {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch {
        // Source may already be stopped
      }
      this.currentSource = null;
    }
  }

  private startType(type: SoundscapeType) {
    const ctx = this.initCtx();
    const now = ctx.currentTime;

    // Fade-in node
    const fadeGain = ctx.createGain();
    fadeGain.gain.setValueAtTime(0.001, now);
    fadeGain.gain.exponentialRampToValueAtTime(1, now + 0.3);
    fadeGain.connect(this.masterGain!);

    if (type === 'brown') {
      this.currentSource = this.createBrownNoise(ctx, fadeGain);
    } else if (type === 'rain') {
      this.currentSource = this.createRainNoise(ctx, fadeGain);
    } else if (type === 'binaural') {
      this.currentSource = this.createBinauralDrone(ctx, fadeGain);
    }
  }

  /**
   * Brown Noise (1/f² integration of random walk)
   * Deep, warm rumble that masks vocal frequencies.
   */
  private createBrownNoise(ctx: AudioContext, destination: AudioNode) {
    const bufferSize = ctx.sampleRate * 5; // 5-second seamless buffer
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = lastOut * 3.5;
    }

    // Seamless loop crossfade (first and last 1000 samples)
    const fadeLen = 1000;
    for (let i = 0; i < fadeLen; i++) {
      const factor = i / fadeLen;
      data[i] = data[i] * factor + data[bufferSize - 1 - i] * (1 - factor);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(450, ctx.currentTime);

    source.connect(lowpass);
    lowpass.connect(destination);
    source.start();

    return {
      stop: () => {
        try {
          source.stop();
          source.disconnect();
          lowpass.disconnect();
        } catch {}
      },
    };
  }

  /**
   * Soft Analog Rain (Pink noise with bandpass + LFO envelope modulation)
   */
  private createRainNoise(ctx: AudioContext, destination: AudioNode) {
    const bufferSize = ctx.sampleRate * 5;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // Paul Kellet's filtered pink noise algorithm
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.12;
      b6 = white * 0.115926;
    }

    // Crossfade loop boundaries
    const fadeLen = 1000;
    for (let i = 0; i < fadeLen; i++) {
      const factor = i / fadeLen;
      data[i] = data[i] * factor + data[bufferSize - 1 - i] * (1 - factor);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    // Filters for rain characteristics
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(1400, ctx.currentTime);

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(120, ctx.currentTime);

    // Subtle gentle swell LFO
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.15, ctx.currentTime);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0.15, ctx.currentTime);

    const rainGain = ctx.createGain();
    rainGain.gain.setValueAtTime(0.85, ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(rainGain.gain);

    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(rainGain);
    rainGain.connect(destination);

    source.start();
    lfo.start();

    return {
      stop: () => {
        try {
          source.stop();
          lfo.stop();
          source.disconnect();
          lfo.disconnect();
        } catch {}
      },
    };
  }

  /**
   * Binaural Alpha Drone (216 Hz left + 230 Hz right -> 14 Hz Alpha focus beat)
   * With warm 108 Hz sub-bass foundation.
   */
  private createBinauralDrone(ctx: AudioContext, destination: AudioNode) {
    const merger = ctx.createChannelMerger(2);

    // Left channel: 216 Hz
    const oscLeft = ctx.createOscillator();
    oscLeft.type = 'sine';
    oscLeft.frequency.setValueAtTime(216, ctx.currentTime);

    // Right channel: 230 Hz (creates 14 Hz alpha difference)
    const oscRight = ctx.createOscillator();
    oscRight.type = 'sine';
    oscRight.frequency.setValueAtTime(230, ctx.currentTime);

    // Sub-bass center foundation
    const oscSub = ctx.createOscillator();
    oscSub.type = 'sine';
    oscSub.frequency.setValueAtTime(108, ctx.currentTime);

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.35, ctx.currentTime);
    oscSub.connect(subGain);

    const leftGain = ctx.createGain();
    leftGain.gain.setValueAtTime(0.2, ctx.currentTime);
    oscLeft.connect(leftGain);

    const rightGain = ctx.createGain();
    rightGain.gain.setValueAtTime(0.2, ctx.currentTime);
    oscRight.connect(rightGain);

    leftGain.connect(merger, 0, 0); // left output
    subGain.connect(merger, 0, 0);

    rightGain.connect(merger, 0, 1); // right output
    subGain.connect(merger, 0, 1);

    merger.connect(destination);

    oscLeft.start();
    oscRight.start();
    oscSub.start();

    return {
      stop: () => {
        try {
          oscLeft.stop();
          oscRight.stop();
          oscSub.stop();
          oscLeft.disconnect();
          oscRight.disconnect();
          oscSub.disconnect();
        } catch {}
      },
    };
  }
}

export const soundscape = new SoundscapeEngine();

import { useSyncExternalStore } from 'react';

export const SOUNDSCAPES: { id: SoundscapeType; label: string; desc: string }[] = [
  { id: 'off', label: 'Off', desc: 'Silence' },
  { id: 'brown', label: 'Brown Noise', desc: 'Deep low-end rumble to block speech' },
  { id: 'rain', label: 'Analog Rain', desc: 'Soft soothing rainfall' },
  { id: 'binaural', label: 'Binaural Drone', desc: '14 Hz Alpha wave focus entrainment' },
];

export function useSoundscape(): SoundscapeState {
  return useSyncExternalStore(
    onStoreChange => soundscape.subscribe(onStoreChange),
    () => soundscape.getState()
  );
}
