import React from 'react';
import { Loader2, Mic, Square, X } from 'lucide-react';
import type { DictationState } from '../useDictation';

export interface DictationHudProps {
  state: DictationState;
  audioLevel: number;
  modelProgress?: number;
  errorMessage?: string | null;
  onStop: () => void;
  className?: string;
}

export function DictationHud({
  state,
  audioLevel,
  modelProgress = 0,
  errorMessage,
  onStop,
  className = '',
}: DictationHudProps) {
  if (state === 'idle' || state === 'ready') return null;

  const isListening = state === 'listening';
  const isTranscribing = state === 'transcribing';
  const isLoading = state === 'loading-model';
  const isError = state === 'error';

  return (
    <div
      className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-50 pop-in flex items-center gap-3 px-3.5 py-2 rounded-2xl bg-surface/95 backdrop-blur-xl border border-line-strong shadow-pop keycap text-xs ${className}`}
    >
      <div className="flex items-center gap-2">
        {isLoading ? (
          <Loader2 size={15} className="animate-spin text-accent" />
        ) : isTranscribing ? (
          <Loader2 size={15} className="animate-spin text-amber-500" />
        ) : isError ? (
          <X size={15} className="text-rose-500" />
        ) : (
          <div className="relative flex items-center justify-center">
            <Mic size={15} className="text-accent" />
            <span className="absolute size-2 rounded-full bg-accent animate-ping opacity-75" />
          </div>
        )}

        <div className="flex flex-col">
          <span className="font-semibold text-fg flex items-center gap-1.5">
            {isLoading
              ? `Loading Voice Model (${modelProgress}%)...`
              : isTranscribing
              ? 'Transcribing on-device...'
              : isError
              ? (errorMessage || 'Microphone error')
              : 'Listening offline...'}
          </span>
          <span className="text-[10px] text-fg-muted">
            {isListening ? "Say 'scratch that' to undo · 'new line' for break" : isError ? 'Click stop to dismiss' : '100% on-device private'}
          </span>
        </div>
      </div>

      {/* Real-time audio waveform / level equalizer */}
      {isListening && (
        <div className="flex items-end gap-0.5 h-4 px-1">
          {[0.2, 0.5, 0.9, 0.6, 0.3].map((multiplier, idx) => {
            const barHeight = Math.max(3, Math.min(16, audioLevel * 20 * multiplier));
            return (
              <span
                key={idx}
                className="w-1 rounded-full bg-accent transition-all duration-75"
                style={{ height: `${barHeight}px` }}
              />
            );
          })}
        </div>
      )}

      {/* Stop / Cancel button */}
      <button
        onClick={onStop}
        title="Stop Dictation"
        className="p-1 rounded-lg hover:bg-hover text-fg-muted hover:text-fg transition ml-1"
      >
        <Square size={12} className="fill-current text-rose-500" />
      </button>
    </div>
  );
}
