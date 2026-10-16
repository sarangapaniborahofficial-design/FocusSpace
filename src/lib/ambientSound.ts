/**
 * FocusSpace Offline Ambient Sound Synthesizer
 *
 * 100% Offline, synthesized focus sound generator via the Web Audio API.
 * Requires ZERO external sound files, ZERO cloud network calls.
 * Provides infinite, seam-free acoustic soundscapes for deep focus and flow.
 */

export type AmbientTrack = 'rain' | 'ocean' | 'lofi' | 'binaural' | 'whitenoise' | 'off';

export interface AmbientTrackInfo {
  id: AmbientTrack;
  name: string;
  icon: string;
  description: string;
}

export const AMBIENT_TRACKS: AmbientTrackInfo[] = [
  { id: 'rain', name: 'Rainfall', icon: '🌧️', description: 'Gentle cascading rainfall with soft droplet transients' },
  { id: 'ocean', name: 'Deep Ocean', icon: '🌊', description: 'Brown noise with rolling tidal wave swells' },
  { id: 'lofi', name: 'Lo-Fi Vinyl', icon: '☕', description: 'Warm analog room tone with soft vinyl crackle' },
  { id: 'binaural', name: 'Alpha Waves', icon: '🧘', description: '10Hz binaural beat designed for concentration and flow' },
  { id: 'whitenoise', name: 'White Noise', icon: '⚡', description: 'Smooth full-frequency sound mask for open offices' },
];

export interface AmbientSoundState {
  track: AmbientTrack;
  playing: boolean;
  volume: number; // 0..1
}

class AmbientSynthesizer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private currentTrack: AmbientTrack = 'off';
  private currentVolume = 0.5;
  private isRunning = false;
  private activeNodes: Array<{ stop?: () => void; disconnect: () => void }> = [];
  private listeners: Set<(state: AmbientSoundState) => void> = new Set();
  private timerId: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const savedTrack = (localStorage.getItem('focusspace-ambient-track') as AmbientTrack) || 'rain';
        const savedVol = parseFloat(localStorage.getItem('focusspace-ambient-vol') || '0.5');
        this.currentTrack = savedTrack;
        this.currentVolume = isNaN(savedVol) ? 0.5 : Math.max(0, Math.min(1, savedVol));
      } catch {}
    }
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    if (!this.masterGain && this.ctx) {
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.currentVolume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
  }

  private emit() {
    const s: AmbientSoundState = {
      track: this.currentTrack,
      playing: this.isRunning,
      volume: this.currentVolume,
    };
    this.listeners.forEach((fn) => fn(s));
  }

  getState(): AmbientSoundState {
    return {
      track: this.currentTrack,
      playing: this.isRunning,
      volume: this.currentVolume,
    };
  }

  subscribe(listener: (state: AmbientSoundState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  setVolume(vol: number) {
    this.currentVolume = Math.max(0, Math.min(1, vol));
    try {
      localStorage.setItem('focusspace-ambient-vol', String(this.currentVolume));
    } catch {}
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.currentVolume, this.ctx.currentTime, 0.05);
    }
    this.emit();
  }

  setTrack(track: AmbientTrack) {
    this.currentTrack = track;
    try {
      localStorage.setItem('focusspace-ambient-track', track);
    } catch {}
    if (this.isRunning) {
      this.stop();
      if (track !== 'off') {
        this.start(track);
      }
    } else {
      this.emit();
    }
  }

  toggle(track?: AmbientTrack): boolean {
    if (this.isRunning) {
      this.stop();
      return false;
    } else {
      this.start(track || this.currentTrack);
      return true;
    }
  }

  start(track: AmbientTrack = this.currentTrack) {
    if (track === 'off') {
      this.stop();
      return;
    }
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    this.stopNodes();
    this.currentTrack = track;
    this.isRunning = true;

    try {
      if (track === 'rain') {
        this.synthRain();
      } else if (track === 'ocean') {
        this.synthOcean();
      } else if (track === 'lofi') {
        this.synthLoFi();
      } else if (track === 'binaural') {
        this.synthBinaural();
      } else if (track === 'whitenoise') {
        this.synthWhiteNoise();
      }
    } catch (err) {
      console.warn('Failed to start ambient synthesis:', err);
    }

    this.emit();
  }

  stop() {
    this.isRunning = false;
    this.stopNodes();
    if (this.ctx && this.ctx.state === 'running') {
      // Keep context alive but stop sound
    }
    this.emit();
  }

  private stopNodes() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    for (const node of this.activeNodes) {
      try {
        if (node.stop) node.stop();
        node.disconnect();
      } catch {}
    }
    this.activeNodes = [];
  }

  // --- Rain Generator ---
  private synthRain() {
    const ctx = this.ctx!;
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      output[i] = (b0 + b1 + b2 + white * 0.5362) * 0.08;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1100, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.7, ctx.currentTime);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);

    whiteNoise.start();
    this.activeNodes.push(whiteNoise, filter, gain);

    // Random soft droplets
    this.timerId = setInterval(() => {
      if (!this.isRunning || !this.ctx) return;
      try {
        const osc = ctx.createOscillator();
        const dropGain = ctx.createGain();
        const freq = 1200 + Math.random() * 800;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.08);

        dropGain.gain.setValueAtTime(0.04 * Math.random(), ctx.currentTime);
        dropGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);

        osc.connect(dropGain);
        dropGain.connect(this.masterGain!);
        osc.start();
        osc.stop(ctx.currentTime + 0.09);
      } catch {}
    }, 180);
  }

  // --- Ocean Wave Generator ---
  private synthOcean() {
    const ctx = this.ctx!;
    const bufferSize = ctx.sampleRate * 3;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = output[i];
      output[i] *= 2.8;
    }

    const brownNoise = ctx.createBufferSource();
    brownNoise.buffer = noiseBuffer;
    brownNoise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, ctx.currentTime);

    // LFO for periodic wave swell
    const lfo = ctx.createOscillator();
    lfo.frequency.setValueAtTime(0.09, ctx.currentTime); // ~11 sec wave swell cycle

    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(220, ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    const ampGain = ctx.createGain();
    ampGain.gain.setValueAtTime(0.85, ctx.currentTime);

    brownNoise.connect(filter);
    filter.connect(ampGain);
    ampGain.connect(this.masterGain!);

    brownNoise.start();
    lfo.start();
    this.activeNodes.push(brownNoise, lfo, lfoGain, filter, ampGain);
  }

  // --- Lo-Fi Vinyl Ambience ---
  private synthLoFi() {
    const ctx = this.ctx!;
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * 0.12;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(1400, ctx.currentTime);
    bandpass.Q.setValueAtTime(1.2, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.6, ctx.currentTime);

    noise.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(this.masterGain!);

    noise.start();
    this.activeNodes.push(noise, bandpass, gain);

    // Vinyl needle clicks
    this.timerId = setInterval(() => {
      if (!this.isRunning || !this.ctx || Math.random() > 0.45) return;
      try {
        const clickBuf = ctx.createBuffer(1, 128, ctx.sampleRate);
        const data = clickBuf.getChannelData(0);
        data[0] = (Math.random() * 2 - 1) * 0.25;
        data[1] = data[0] * -0.5;

        const src = ctx.createBufferSource();
        src.buffer = clickBuf;
        const cGain = ctx.createGain();
        cGain.gain.setValueAtTime(0.12, ctx.currentTime);
        src.connect(cGain);
        cGain.connect(this.masterGain!);
        src.start();
      } catch {}
    }, 140);
  }

  // --- Binaural Alpha Beat (10Hz focus difference) ---
  private synthBinaural() {
    const ctx = this.ctx!;
    const merger = ctx.createChannelMerger(2);

    // Left ear: 216 Hz
    const oscL = ctx.createOscillator();
    oscL.type = 'sine';
    oscL.frequency.setValueAtTime(216, ctx.currentTime);

    // Right ear: 226 Hz (10 Hz Alpha frequency)
    const oscR = ctx.createOscillator();
    oscR.type = 'sine';
    oscR.frequency.setValueAtTime(226, ctx.currentTime);

    // Sub-bass warm drone
    const oscSub = ctx.createOscillator();
    oscSub.type = 'sine';
    oscSub.frequency.setValueAtTime(108, ctx.currentTime);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.18, ctx.currentTime);
    oscSub.connect(subGain);
    subGain.connect(this.masterGain!);

    const gainL = ctx.createGain();
    gainL.gain.setValueAtTime(0.22, ctx.currentTime);
    oscL.connect(gainL);
    gainL.connect(merger, 0, 0);

    const gainR = ctx.createGain();
    gainR.gain.setValueAtTime(0.22, ctx.currentTime);
    oscR.connect(gainR);
    gainR.connect(merger, 0, 1);

    merger.connect(this.masterGain!);

    oscL.start();
    oscR.start();
    oscSub.start();
    this.activeNodes.push(oscL, oscR, oscSub, gainL, gainR, subGain, merger);
  }

  // --- Pure White Noise ---
  private synthWhiteNoise() {
    const ctx = this.ctx!;
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * 0.12;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.55, ctx.currentTime);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);

    noise.start();
    this.activeNodes.push(noise, filter, gain);
  }
}

export const ambientSound = new AmbientSynthesizer();
