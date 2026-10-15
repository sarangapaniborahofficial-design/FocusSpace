import { useCallback, useEffect, useRef, useState } from 'react';
import { VadController } from './capture/vad';
import { cleanLight } from './cleanup/disfluency';
import { getAsrClient } from './engine/AsrClient';
import type { DictationTarget } from './target/DictationTarget';

export type DictationState =
  | 'idle'
  | 'loading-model'
  | 'ready'
  | 'listening'
  | 'transcribing'
  | 'error';

export interface UseDictationOptions {
  target?: DictationTarget | null;
  onTranscript?: (raw: string, cleaned: string) => void;
  onError?: (err: Error) => void;
}

export function useDictation(options: UseDictationOptions = {}) {
  const [state, setState] = useState<DictationState>('idle');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modelProgress, setModelProgress] = useState<number>(0);

  const targetRef = useRef<DictationTarget | null>(options.target ?? null);
  targetRef.current = options.target ?? null;

  const vadRef = useRef<VadController | null>(null);
  const asrClient = useRef(getAsrClient());
  const activeRef = useRef<boolean>(false);

  // Initialize or warmup ASR model
  const initEngine = useCallback(async () => {
    if (asrClient.current.isReady()) {
      setState('ready');
      return;
    }
    try {
      setState('loading-model');
      await asrClient.current.load((fraction: number) => {
        setModelProgress(Math.round(fraction * 100));
      });
      setState('ready');
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setState('error');
      options.onError?.(err instanceof Error ? err : new Error(msg));
    }
  }, [options]);

  const handleSpeechStart = useCallback(() => {
    if (!activeRef.current) return;
    setState('listening');
    targetRef.current?.showProvisional();
  }, []);

  const handleSpeechEnd = useCallback(
    async (audio: Float32Array) => {
      if (!activeRef.current) return;
      setState('transcribing');

      try {
        const raw = await asrClient.current.transcribe(audio);
        if (!raw.trim()) {
          targetRef.current?.clearProvisional();
          if (activeRef.current) setState('listening');
          return;
        }

        const cleaned = cleanLight(raw);
        options.onTranscript?.(raw, cleaned.text);

        if (targetRef.current) {
          if (cleaned.command === 'scratch-that') {
            targetRef.current.removeLastInsert();
          } else if (cleaned.command === 'new-line') {
            targetRef.current.insertFinal('\n');
          } else if (cleaned.command === 'new-paragraph') {
            targetRef.current.insertFinal('\n\n');
          } else if (cleaned.text) {
            targetRef.current.insertFinal(cleaned.text);
          }
        }
      } catch (err: any) {
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMessage(msg);
        options.onError?.(err instanceof Error ? err : new Error(msg));
      } finally {
        if (activeRef.current) {
          setState('listening');
        } else {
          setState('ready');
        }
      }
    },
    [options]
  );

  const start = useCallback(async () => {
    setErrorMessage(null);
    activeRef.current = true;

    try {
      // 1. Ensure ASR model is loaded
      if (!asrClient.current.isReady()) {
        setState('loading-model');
        await asrClient.current.load((fraction: number) => {
          setModelProgress(Math.round(fraction * 100));
        });
      }

      // 2. Start VAD
      if (!vadRef.current) {
        vadRef.current = new VadController({
          onSpeechStart: handleSpeechStart,
          onSpeechEnd: handleSpeechEnd,
          onAudioLevel: (lvl: number) => setAudioLevel(lvl),
          onError: (err: Error) => {
            setErrorMessage(err.message);
            setState('error');
            activeRef.current = false;
          },
        });
      }

      await vadRef.current.start();
      setState('listening');
    } catch (err: any) {
      activeRef.current = false;
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setState('error');
      options.onError?.(err instanceof Error ? err : new Error(msg));
    }
  }, [handleSpeechStart, handleSpeechEnd, options]);

  const stop = useCallback(async () => {
    activeRef.current = false;
    if (vadRef.current) {
      await vadRef.current.pause();
    }
    targetRef.current?.clearProvisional();
    setAudioLevel(0);
    setState('ready');
  }, []);

  const toggle = useCallback(async () => {
    if (state === 'listening' || state === 'transcribing') {
      await stop();
    } else {
      await start();
    }
  }, [state, start, stop]);

  // Privacy invariant: Stop listening if tab becomes hidden
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden' && activeRef.current) {
        void stop();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeRef.current = false;
      vadRef.current?.destroy();
    };
  }, []);

  return {
    state,
    audioLevel,
    errorMessage,
    modelProgress,
    isListening: state === 'listening' || state === 'transcribing',
    start,
    stop,
    toggle,
    initEngine,
  };
}
