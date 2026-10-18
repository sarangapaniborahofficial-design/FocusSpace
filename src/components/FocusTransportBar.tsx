import React from 'react';
import { Play, Pause, RotateCcw, SkipForward, PictureInPicture2, Mic } from 'lucide-react';
import { timer, useTimer, formatClock, MODE_LABELS } from '../lib/timer';
import { pipHUD, usePipHUD } from '../lib/pipHud';
import { getElectronAPI, isVoiceEnabled } from '../lib/runtime';
import type { Task } from '../types';

interface FocusTransportBarProps {
  activeTask?: Task;
  onTriggerVoice?: () => void;
  onNavigateTask?: (taskId: string) => void;
}

export function FocusTransportBar({
  activeTask,
  onTriggerVoice,
  onNavigateTask,
}: FocusTransportBarProps) {
  const timerState = useTimer();
  const { isSupported: isPipSupported, isOpen: isPipOpen } = usePipHUD();

  const totalMinutes = timerState.durations[timerState.mode] || 25;
  const totalMs = totalMinutes * 60_000;
  const elapsedMs = Math.max(0, totalMs - timerState.remainingMs);
  const progressRatio = Math.min(1, Math.max(0, elapsedMs / totalMs));
  const progressPercent = Math.round(progressRatio * 100);

  const handleToggleTimer = () => {
    timer.toggle();
  };

  const handleResetTimer = () => {
    timer.reset();
  };

  const handleSkipTimer = () => {
    timer.nextMode();
  };

  const handlePopoutHud = () => {
    const api = getElectronAPI();
    if (api?.toggleHud) {
      void api.toggleHud();
    } else if (isPipSupported) {
      if (isPipOpen) {
        pipHUD.close();
      } else {
        void pipHUD.open();
      }
    }
  };

  const taskTitle = activeTask?.title || timerState.taskTitle || 'Ready for focus';
  const sessionInfo = `${MODE_LABELS[timerState.mode]} · session ${((timerState.cycle || 0) % 4) + 1} of 4`;

  return (
    <footer
      aria-label="Focus Transport Bar"
      className="h-16 shrink-0 rounded-2xl bg-surface border border-line px-5 flex items-center justify-between gap-4 select-none relative z-30 shadow-pop text-fg"
    >
      {/* Left: Active Task Info */}
      <div className="flex items-center gap-3 w-[200px] sm:w-[260px] min-w-0">
        <div className="min-w-0">
          <button
            onClick={() => activeTask && onNavigateTask?.(activeTask.id)}
            title={taskTitle}
            className="text-left font-bold text-sm sm:text-base text-fg truncate block hover:text-accent-text transition-colors cursor-pointer"
          >
            {taskTitle}
          </button>
          <div className="text-xs text-fg-muted truncate font-medium">
            {sessionInfo}
            {timerState.isOvertime && (
              <span className="ml-2 text-accent-text font-mono text-[11px] animate-pulse">
                +{formatClock(timerState.overtimeMs || 0)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Center: Controls & Scrubber */}
      <div className="flex-1 max-w-xl flex flex-col items-center gap-1">
        <div className="flex items-center gap-4 sm:gap-6">
          <button
            onClick={handleResetTimer}
            title="Reset timer to beginning"
            aria-label="Reset timer"
            className="text-xs sm:text-sm text-fg-muted hover:text-fg transition-colors font-medium cursor-pointer flex items-center gap-1"
          >
            <RotateCcw size={13} className="hidden sm:inline" />
            <span>Reset</span>
          </button>

          <button
            onClick={handleToggleTimer}
            title={timerState.running ? 'Pause focus (Space)' : 'Start focus (Space)'}
            aria-label={timerState.running ? 'Pause timer' : 'Start timer'}
            className="size-9 sm:size-10 rounded-full bg-accent text-accent-fg flex items-center justify-center font-bold hover:scale-105 active:scale-95 transition-transform shadow-md cursor-pointer keycap"
          >
            {timerState.running ? (
              <Pause size={16} fill="currentColor" strokeWidth={0} />
            ) : (
              <Play size={16} fill="currentColor" strokeWidth={0} className="translate-x-0.5" />
            )}
          </button>

          <button
            onClick={handleSkipTimer}
            title="Skip to next session / break"
            aria-label="Skip session"
            className="text-xs sm:text-sm text-fg-muted hover:text-fg transition-colors font-medium cursor-pointer flex items-center gap-1"
          >
            <span>Skip</span>
            <SkipForward size={13} className="hidden sm:inline" />
          </button>
        </div>

        {/* Scrubber / Progress Bar */}
        <div className="flex items-center gap-2.5 sm:gap-3 w-full">
          <span className="font-mono text-[11px] text-fg-muted tabular-nums shrink-0 w-11 text-right">
            {formatClock(elapsedMs)}
          </span>
          <div className="flex-1 h-1.5 bg-surface-2 border border-line rounded-full overflow-hidden relative cursor-pointer group">
            <div
              className="h-full bg-accent rounded-full transition-[width] duration-300 ease-out group-hover:brightness-110"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="font-mono text-[11px] text-fg-muted tabular-nums shrink-0 w-11 text-left">
            {formatClock(totalMs)}
          </span>
        </div>
      </div>

      {/* Right: Pop out HUD & Dictate */}
      <div className="flex items-center justify-end gap-2 sm:gap-3 w-[200px] sm:w-[260px] shrink-0">
        <button
          onClick={handlePopoutHud}
          title="Pop out Always-on-Top Floating HUD (Ctrl+Alt+H)"
          aria-label="Pop out Floating HUD"
          className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line bg-surface-2 hover:bg-hover text-fg hover:text-accent-text text-xs font-semibold transition-all cursor-pointer"
        >
          <PictureInPicture2 size={13} />
          <span>Pop out HUD</span>
        </button>

        {isVoiceEnabled() && onTriggerVoice && (
          <button
            onClick={onTriggerVoice}
            title="Start Universal Voice Dictation (Alt + V)"
            aria-label="Universal Voice Dictation"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line bg-surface-2 hover:bg-hover text-fg hover:text-accent-text text-xs font-semibold transition-all cursor-pointer"
          >
            <Mic size={13} />
            <span>Dictate</span>
          </button>
        )}
      </div>
    </footer>
  );
}
