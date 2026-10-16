import { storage } from '../lib/utils';

export const AUDIO_INPUT_STORAGE_KEY = 'focusspace-audio-input-device';
export const AUDIO_OUTPUT_STORAGE_KEY = 'focusspace-audio-output-device';
export const AUDIO_CONFIGURED_STORAGE_KEY = 'focusspace-audio-configured';

export interface AudioDevice {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

/**
 * Checks if the user has completed initial microphone/output configuration.
 */
export function isAudioConfigured(): boolean {
  return storage.get(AUDIO_CONFIGURED_STORAGE_KEY) === 'true';
}

export function setAudioConfigured(configured = true): void {
  storage.set(AUDIO_CONFIGURED_STORAGE_KEY, configured ? 'true' : 'false');
}

export function getSelectedAudioInput(): string {
  return storage.get(AUDIO_INPUT_STORAGE_KEY) || '';
}

export function setSelectedAudioInput(deviceId: string): void {
  storage.set(AUDIO_INPUT_STORAGE_KEY, deviceId);
}

export function getSelectedAudioOutput(): string {
  return storage.get(AUDIO_OUTPUT_STORAGE_KEY) || '';
}

export function setSelectedAudioOutput(deviceId: string): void {
  storage.set(AUDIO_OUTPUT_STORAGE_KEY, deviceId);
}

/**
 * Requests temporary mic permission to ensure navigator.mediaDevices.enumerateDevices()
 * returns full device labels instead of blank strings.
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return false;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (err) {
    console.warn('Microphone permission request rejected:', err);
    return false;
  }
}

/**
 * Returns available microphone input devices.
 */
export async function getAudioInputDevices(): Promise<AudioDevice[]> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
    return [];
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter(d => d.kind === 'audioinput')
      .map((d, index) => ({
        deviceId: d.deviceId,
        label: d.label || `Microphone ${index + 1}`,
        kind: d.kind,
      }));
  } catch (err) {
    console.warn('Could not enumerate audio input devices:', err);
    return [];
  }
}

/**
 * Returns available audio output devices (speakers/headphones).
 */
export async function getAudioOutputDevices(): Promise<AudioDevice[]> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
    return [];
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter(d => d.kind === 'audiooutput')
      .map((d, index) => ({
        deviceId: d.deviceId,
        label: d.label || `Speaker/Headphones ${index + 1}`,
        kind: d.kind,
      }));
  } catch (err) {
    console.warn('Could not enumerate audio output devices:', err);
    return [];
  }
}

/**
 * Plays a clean, pleasant test chime on the specified audio output device.
 */
export async function testAudioOutput(outputDeviceId?: string): Promise<void> {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const deviceId = outputDeviceId ?? getSelectedAudioOutput();
    if (deviceId && 'setSinkId' in ctx) {
      try {
        await (ctx as any).setSinkId(deviceId);
      } catch (sinkErr) {
        console.warn('setSinkId failed on AudioContext:', sinkErr);
      }
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Gentle two-tone chime (E5 -> G#5)
    osc.frequency.setValueAtTime(659.25, now);
    osc.frequency.exponentialRampToValueAtTime(830.61, now + 0.12);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.55);

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 800);
  } catch (err) {
    console.error('Failed to play test audio output chime:', err);
  }
}

/**
 * Creates a lightweight live audio level meter for microphone input verification.
 */
export function createAudioLevelMeter(
  stream: MediaStream,
  onLevel: (level: number) => void
): () => void {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return () => {};
    const ctx = new AudioCtx();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;

    source.connect(analyser);

    const buffer = new Uint8Array(analyser.frequencyBinCount);
    let animId: number;

    const tick = () => {
      analyser.getByteFrequencyData(buffer);
      let sum = 0;
      for (let i = 0; i < buffer.length; i++) {
        sum += buffer[i];
      }
      const avg = sum / buffer.length;
      const normalized = Math.min(1, Math.max(0, avg / 128));
      onLevel(normalized);
      animId = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      cancelAnimationFrame(animId);
      source.disconnect();
      analyser.disconnect();
      ctx.close().catch(() => {});
    };
  } catch {
    return () => {};
  }
}
