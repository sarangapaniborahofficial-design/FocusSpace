import { storage } from './utils';
import { ambientSound, type AmbientTrack } from './ambientSound';
import { useSyncExternalStore } from 'react';

export type SoundscapeType = 'off' | 'brown' | 'rain' | 'binaural';

export interface SoundscapeState {
  type: SoundscapeType;
  volume: number; // 0 to 1
  isPlaying: boolean;
  isDucked: boolean;
}

const STORAGE_TYPE_KEY = 'focusspace-soundscape-type';
const STORAGE_VOL_KEY = 'focusspace-soundscape-vol';

function soundscapeTypeToAmbient(type: SoundscapeType): AmbientTrack {
  switch (type) {
    case 'brown':
      return 'ocean';
    case 'rain':
      return 'rain';
    case 'binaural':
      return 'binaural';
    case 'off':
    default:
      return 'off';
  }
}

function ambientToSoundscapeType(track: AmbientTrack): SoundscapeType {
  switch (track) {
    case 'ocean':
    case 'lofi':
    case 'whitenoise':
      return 'brown';
    case 'rain':
      return 'rain';
    case 'binaural':
      return 'binaural';
    case 'off':
    default:
      return 'off';
  }
}

/**
 * Unified Soundscape Facade
 *
 * Bridges the legacy soundscape API directly to the unified AmbientSynthesizer
 * (ambientSound.ts). Guarantees that toggling sound from the Welcome screen,
 * App Dock, Floating HUD, or Pomodoro view controls the exact same AudioContext
 * and Web Audio synthesis nodes.
 */
class UnifiedSoundscapeEngine {
  private snapshot: SoundscapeState;
  private selectedType: SoundscapeType = 'off';

  constructor() {
    const savedType = storage.get(STORAGE_TYPE_KEY) as SoundscapeType | null;
    const savedVol = storage.get(STORAGE_VOL_KEY);
    if (savedType && ['off', 'brown', 'rain', 'binaural'].includes(savedType)) {
      this.selectedType = savedType;
    }

    const ambientState = ambientSound.getState();
    const initialVol = savedVol !== null ? parseFloat(savedVol) : ambientState.volume;
    if (!isNaN(initialVol) && initialVol >= 0 && initialVol <= 1) {
      ambientSound.setVolume(initialVol);
    }

    this.snapshot = {
      type: ambientState.playing ? ambientToSoundscapeType(ambientState.track) : this.selectedType,
      volume: ambientSound.getState().volume,
      isPlaying: ambientState.playing,
      isDucked: Boolean(ambientState.isDucked),
    };

    ambientSound.subscribe(() => {
      this.updateSnapshot();
    });
  }

  private updateSnapshot(): void {
    const amb = ambientSound.getState();
    const mappedType = amb.playing ? ambientToSoundscapeType(amb.track) : this.selectedType;
    const isPlaying = amb.playing;
    const volume = amb.volume;
    const isDucked = Boolean(amb.isDucked);

    if (
      this.snapshot.type !== mappedType ||
      this.snapshot.isPlaying !== isPlaying ||
      this.snapshot.volume !== volume ||
      this.snapshot.isDucked !== isDucked
    ) {
      this.snapshot = {
        type: mappedType,
        isPlaying,
        volume,
        isDucked,
      };
    }
  }

  getState(): SoundscapeState {
    this.updateSnapshot();
    return this.snapshot;
  }

  subscribe(listener: () => void): () => void {
    return ambientSound.subscribe(() => {
      this.updateSnapshot();
      listener();
    });
  }

  setType(type: SoundscapeType): void {
    this.selectedType = type;
    storage.set(STORAGE_TYPE_KEY, type);

    if (type === 'off') {
      ambientSound.stop();
    } else {
      const ambientTrack = soundscapeTypeToAmbient(type);
      ambientSound.start(ambientTrack);
    }
    this.updateSnapshot();
  }

  play(): void {
    if (this.selectedType === 'off') {
      this.setType('brown');
    } else {
      ambientSound.start(soundscapeTypeToAmbient(this.selectedType));
    }
    this.updateSnapshot();
  }

  stop(): void {
    ambientSound.stop();
    this.updateSnapshot();
  }

  setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    storage.set(STORAGE_VOL_KEY, String(clamped));
    ambientSound.setVolume(clamped);
    this.updateSnapshot();
  }

  setDucked(ducked: boolean): void {
    ambientSound.setDucked(ducked);
    this.updateSnapshot();
  }
}

export const soundscape = new UnifiedSoundscapeEngine();

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
