import React from 'react';
import { AlertCircle, Loader2, Mic, MicOff } from 'lucide-react';
import type { DictationState } from '../useDictation';

export interface MicButtonProps {
  state: DictationState;
  onClick: () => void;
  size?: 'sm' | 'md';
  className?: string;
  title?: string;
}

export function MicButton({
  state,
  onClick,
  size = 'md',
  className = '',
  title,
}: MicButtonProps) {
  const isListening = state === 'listening';
  const isTranscribing = state === 'transcribing';
  const isLoading = state === 'loading-model';
  const isError = state === 'error';

  const sizeClasses =
    size === 'sm'
      ? 'h-7 w-7 text-xs rounded-lg'
      : 'h-9 w-9 text-sm rounded-xl';

  const iconSize = size === 'sm' ? 14 : 17;

  let tooltip = title || 'Start Offline Voice Typing';
  if (isListening) tooltip = 'Listening... (Tap to stop)';
  if (isTranscribing) tooltip = 'Transcribing on-device...';
  if (isLoading) tooltip = 'Loading local voice model...';
  if (isError) tooltip = 'Microphone or Voice Model Error (Tap to retry)';

  return (
    <button
      type="button"
      onClick={onClick}
      title={tooltip}
      aria-label={tooltip}
      className={`relative inline-flex items-center justify-center transition-all duration-150 cursor-pointer select-none keycap shrink-0 ${sizeClasses} ${
        isListening
          ? 'bg-accent/20 text-accent border border-accent shadow-sm animate-pulse ring-2 ring-accent/30'
          : isTranscribing
          ? 'bg-amber-500/15 text-amber-500 border border-amber-500/40 shadow-sm'
          : isLoading
          ? 'bg-surface-2 text-fg-muted border border-line'
          : isError
          ? 'bg-rose-500/10 text-rose-500 border border-rose-500/30 hover:bg-rose-500/20'
          : 'bg-surface-2 text-fg-muted hover:text-fg border border-line hover:border-line-strong hover:bg-hover'
      } ${className}`}
    >
      {isLoading ? (
        <Loader2 size={iconSize} className="animate-spin text-accent" />
      ) : isTranscribing ? (
        <Loader2 size={iconSize} className="animate-spin text-amber-500" />
      ) : isListening ? (
        <Mic size={iconSize} className="text-accent" />
      ) : isError ? (
        <AlertCircle size={iconSize} className="text-rose-500" />
      ) : (
        <Mic size={iconSize} />
      )}

      {/* Pulsing indicator when recording */}
      {isListening && (
        <span className="absolute -top-1 -right-1 size-2 rounded-full bg-accent animate-ping" />
      )}
    </button>
  );
}
