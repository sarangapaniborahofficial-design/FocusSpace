import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Check,
  ChevronDown,
  Headphones,
  Mic,
  Pause,
  PictureInPicture2,
  Play,
  Plus,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { db } from '../db/db';
import { toggleHabitDay } from '../lib/habitActions';
import { openTaskEditor } from '../lib/taskEditor';
import {
  timer,
  useTimer,
  formatClock,
  formatOvertimeClock,
  MODES,
  type Mode,
} from '../lib/timer';
import {
  ambientSound,
  useAmbientSound,
  AMBIENT_TRACKS,
  type AmbientTrack,
} from '../lib/ambientSound';
import { pipHUD, usePipHUD } from '../lib/pipHud';
import { isoToday, uid } from '../lib/utils';
import { useDictation } from '../voice/useDictation';
import type { Task, Subtask } from '../types';

const AMBIENT_OPTIONS: { id: AmbientTrack; label: string; icon: string; fullName: string }[] = [
  { id: 'ocean', label: 'Brown noise', icon: '🌊', fullName: 'Brown Noise / Ocean' },
  { id: 'rain', label: 'Rainfall', icon: '🌧️', fullName: 'Gentle Rainfall' },
  { id: 'lofi', label: 'Lo-Fi Vinyl', icon: '☕', fullName: 'Lo-Fi Analog' },
  { id: 'binaural', label: 'Alpha Waves', icon: '🧘', fullName: 'Alpha Waves 10Hz' },
  { id: 'whitenoise', label: 'White Noise', icon: '⚡', fullName: 'White Noise Mask' },
];

export function SessionInspector({
  selectedTaskId,
}: {
  selectedTaskId?: string | null;
}) {
  const today = isoToday();
  const timerState = useTimer();
  const ambientState = useAmbientSound();
  const pipState = usePipHUD();
  const { isListening, toggle: toggleDictation } = useDictation();

  // Tasks, Categories, Habits
  const activeTask = useLiveQuery(
    () => (timerState.taskId ? db.tasks.get(timerState.taskId) : undefined),
    [timerState.taskId]
  );
  const selectedTask = useLiveQuery(
    () => (selectedTaskId ? db.tasks.get(selectedTaskId) : undefined),
    [selectedTaskId]
  );
  const allTasks = useLiveQuery(() => db.tasks.toArray(), []) ?? [];
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  const habits = useLiveQuery(() => db.habits.filter(h => h.active).toArray(), []) ?? [];
  const catMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);

  // Current focus task
  const currentTask: Task | null = useMemo(() => {
    if (activeTask) return activeTask;
    if (selectedTask) return selectedTask;
    const open = allTasks.filter(t => t.status !== 'Submitted/Done');
    return open[0] || allTasks[0] || null;
  }, [activeTask, selectedTask, allTasks]);

  const category = currentTask ? catMap.get(currentTask.categoryId) : null;
  const subtasks = currentTask?.subtasks || [];
  const completedCount = subtasks.filter(s => s.completed).length;
  const progressPct = subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : 0;
  const habitsDone = habits.filter(h => h.completions.includes(today)).length;

  // Inline Subtask Input
  const [newSubtaskText, setNewSubtaskText] = useState('');
  const [soundMenuOpen, setSoundMenuOpen] = useState(false);
  const soundMenuRef = useRef<HTMLDivElement>(null);

  // Close sound dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (soundMenuRef.current && !soundMenuRef.current.contains(e.target as Node)) {
        setSoundMenuOpen(false);
      }
    };
    if (soundMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [soundMenuOpen]);

  // Chronograph Progress Calculation
  const totalDurationSec = timerState.durations[timerState.mode] * 60;
  const remainingSec = Math.ceil(timerState.remainingMs / 1000);
  const chronoProgressPct = timerState.isOvertime
    ? 100
    : Math.min(100, Math.max(0, Math.round(((totalDurationSec - remainingSec) / totalDurationSec) * 100)));

  // Ambient sound cycling
  const handleCycleSound = () => {
    if (!ambientState.playing || ambientState.track === 'off') {
      ambientSound.start('ocean');
      return;
    }
    const trackOrder: AmbientTrack[] = ['ocean', 'rain', 'lofi', 'binaural', 'whitenoise', 'off'];
    const currentIndex = trackOrder.indexOf(ambientState.track);
    const nextTrack = trackOrder[(currentIndex + 1) % trackOrder.length];
    if (nextTrack === 'off') {
      ambientSound.stop();
    } else {
      ambientSound.start(nextTrack);
    }
  };

  const handleSelectSound = (track: AmbientTrack) => {
    if (track === 'off') {
      ambientSound.stop();
    } else {
      ambientSound.start(track);
    }
    setSoundMenuOpen(false);
  };

  const currentAmbientInfo = AMBIENT_OPTIONS.find(o => o.id === ambientState.track);

  // Subtask Actions
  const handleToggleSubtask = async (subtaskId: string) => {
    if (!currentTask) return;
    const updated = subtasks.map(s =>
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    );
    await db.tasks.update(currentTask.id, {
      subtasks: updated,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTask || !newSubtaskText.trim()) return;
    const newSubtask: Subtask = {
      id: uid(),
      title: newSubtaskText.trim(),
      completed: false,
    };
    await db.tasks.update(currentTask.id, {
      subtasks: [...subtasks, newSubtask],
      updatedAt: new Date().toISOString(),
    });
    setNewSubtaskText('');
  };

  // Scratchpad
  const handleScratchpadChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!currentTask) return;
    const val = e.target.value;
    await db.tasks.update(currentTask.id, {
      notes: val,
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <aside className="w-[320px] xl:w-[350px] shrink-0 h-full rounded-2xl bg-surface border border-line overflow-y-auto p-4 flex flex-col gap-3.5 select-none">
      {/* Top Section Header */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono uppercase tracking-wider text-fg-muted font-bold">
          This session
        </span>
        <span className="size-2 rounded-full bg-accent animate-pulse" />
      </div>

      {/* 1. Tactile Focus Chronograph Card */}
      <div className="rounded-xl bg-surface-2 border border-line p-4 space-y-3 shadow-xs">
        {/* Top Row: Mode switcher pills + Pop out HUD + Reset */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="grid grid-cols-3 gap-1 flex-1 bg-surface border border-line rounded-lg p-0.5">
            {MODES.map(mode => {
              const isActive = timerState.mode === mode;
              const label = mode === 'focus' ? 'Focus' : mode === 'shortBreak' ? 'Break' : 'Long';
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => timer.setMode(mode)}
                  className={`py-1 px-1.5 rounded-md text-[11px] text-center font-medium transition cursor-pointer truncate ${
                    isActive
                      ? 'bg-surface-2 text-fg font-semibold shadow-xs border border-line'
                      : 'text-fg-muted hover:text-fg'
                  }`}
                >
                  {label} {timerState.durations[mode]}m
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Pop out HUD button */}
            <button
              type="button"
              onClick={() => (pipState.isOpen ? pipHUD.close() : pipHUD.open())}
              title={pipState.isOpen ? 'Dock HUD' : 'Pop out Floating HUD'}
              aria-label="Pop out Floating HUD"
              className={`size-7 rounded-lg border grid place-items-center transition cursor-pointer ${
                pipState.isOpen
                  ? 'bg-accent text-accent-fg border-accent'
                  : 'bg-surface border-line text-fg-muted hover:text-fg hover:bg-hover'
              }`}
            >
              <PictureInPicture2 size={13} />
            </button>

            {/* Reset button */}
            <button
              type="button"
              onClick={() => timer.reset()}
              title="Reset Timer"
              aria-label="Reset Timer"
              className="size-7 rounded-lg border border-line bg-surface hover:bg-hover text-fg-muted hover:text-fg grid place-items-center transition cursor-pointer"
            >
              <RotateCcw size={12} />
            </button>
          </div>
        </div>

        {/* Main Readout & Trigger Row */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="min-w-0 flex-1">
            <div
              className={`font-mono text-3xl sm:text-4xl font-bold tracking-tight tabular-nums ${
                timerState.isOvertime ? 'text-accent-text font-black' : 'text-fg'
              }`}
            >
              {timerState.isOvertime
                ? formatOvertimeClock(timerState.overtimeMs ?? 0)
                : formatClock(timerState.remainingMs)}
            </div>
            <div
              className="text-xs text-fg-muted truncate max-w-[180px] mt-0.5 flex items-center gap-1.5"
              title={currentTask ? currentTask.title : 'Free Focus'}
            >
              {category && (
                <span
                  className="size-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: category.color }}
                />
              )}
              <span className="truncate">{currentTask ? currentTask.title : 'Free Focus'}</span>
            </div>
          </div>

          {/* Tactile Keycap Start / Pause Button */}
          <button
            type="button"
            onClick={() => timer.toggle()}
            aria-label={timerState.running ? 'Pause timer' : 'Start timer'}
            title={timerState.running ? 'Pause (Space)' : 'Start (Space)'}
            className="h-10 px-4 rounded-xl bg-accent text-accent-fg font-semibold text-xs flex items-center gap-1.5 keycap hover:bg-accent-hover transition cursor-pointer shrink-0"
          >
            {timerState.running ? (
              <>
                <Pause size={15} />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play size={15} fill="currentColor" />
                <span>Start</span>
              </>
            )}
          </button>
        </div>

        {/* 6px Segmented Architectural Gauge */}
        <div className="space-y-1">
          <div className="relative h-1.5 w-full bg-surface border border-line rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300"
              style={{ width: `${chronoProgressPct}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] font-mono text-fg-muted px-0.5">
            <span>{timerState.isOvertime ? 'Overtime Flow' : 'Progress'}</span>
            <span>{chronoProgressPct}%</span>
          </div>
        </div>

        {/* Integrated Sonic Anchor Bar */}
        <div className="pt-2.5 border-t border-line flex items-center justify-between gap-1.5 relative">
          {/* Ambient Sound Cycle / Selector */}
          <div className="relative" ref={soundMenuRef}>
            <div className="flex items-center rounded-lg border border-line bg-surface hover:bg-hover transition">
              <button
                type="button"
                onClick={handleCycleSound}
                title="Cycle ambient sound"
                className="h-7 px-2 flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg cursor-pointer transition truncate max-w-[125px]"
              >
                <Headphones
                  size={12}
                  className={ambientState.playing ? 'text-accent-text animate-pulse shrink-0' : 'text-fg-muted shrink-0'}
                />
                <span className="truncate font-medium text-[11px]">
                  {ambientState.playing && currentAmbientInfo ? currentAmbientInfo.label : 'Off'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setSoundMenuOpen(!soundMenuOpen)}
                title="Select ambient sound"
                className="size-7 grid place-items-center text-fg-muted hover:text-fg border-l border-line transition cursor-pointer"
              >
                <ChevronDown size={11} />
              </button>
            </div>

            {/* Ambient Sound Menu Popover */}
            {soundMenuOpen && (
              <div className="absolute bottom-8 left-0 w-48 rounded-xl bg-surface border border-line shadow-2xl p-1.5 z-50 select-none space-y-0.5 animate-in fade-in zoom-in-95 duration-150">
                <div className="text-[10px] font-mono uppercase tracking-wider text-fg-muted px-2 py-1 font-semibold">
                  Ambient Soundscape
                </div>
                {AMBIENT_OPTIONS.map(opt => {
                  const isCur = ambientState.playing && ambientState.track === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelectSound(opt.id)}
                      className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center gap-2 transition cursor-pointer ${
                        isCur
                          ? 'bg-accent/15 text-accent-text font-semibold'
                          : 'text-fg hover:bg-hover'
                      }`}
                    >
                      <span className="text-xs">{opt.icon}</span>
                      <span className="truncate">{opt.fullName}</span>
                    </button>
                  );
                })}
                <div className="pt-1 border-t border-line">
                  <button
                    type="button"
                    onClick={() => handleSelectSound('off')}
                    className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center gap-2 transition cursor-pointer ${
                      !ambientState.playing
                        ? 'bg-accent/15 text-accent-text font-semibold'
                        : 'text-fg-muted hover:text-fg hover:bg-hover'
                    }`}
                  >
                    <VolumeX size={12} />
                    <span>Mute / Sound Off</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Volume Slider */}
          <div className="flex items-center gap-1">
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={ambientState.volume}
              onChange={e => ambientSound.setVolume(parseFloat(e.target.value))}
              title={`Volume: ${Math.round(ambientState.volume * 100)}%`}
              aria-label="Ambient volume"
              className="w-12 sm:w-14 h-1 accent-accent rounded-lg cursor-pointer shrink-0"
            />
          </div>

          {/* Dictate Button */}
          <button
            type="button"
            onClick={toggleDictation}
            title={isListening ? 'Stop dictation' : 'Start voice dictation'}
            className={`h-7 px-2 rounded-lg border text-xs flex items-center gap-1 transition cursor-pointer shrink-0 ${
              isListening
                ? 'bg-rose-500/20 text-rose-500 border-rose-500/40 font-semibold animate-pulse'
                : 'bg-surface border-line text-fg-muted hover:text-fg hover:bg-hover'
            }`}
          >
            <Mic size={12} className={isListening ? 'text-rose-500' : ''} />
            <span className="text-[11px] font-medium">{isListening ? 'Listening' : 'Dictate'}</span>
          </button>
        </div>
      </div>

      {/* 2. Subtasks Module */}
      {currentTask && (
        <div className="bg-surface-2 border border-line rounded-xl p-3.5 space-y-2.5">
          <div className="flex justify-between items-center text-xs text-fg-muted">
            <span className="font-semibold text-fg">Subtasks</span>
            <span className="font-mono text-fg font-semibold">
              {completedCount}/{subtasks.length}
            </span>
          </div>

          <div className="h-1.5 bg-surface border border-line rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {subtasks.length > 0 && (
            <div className="space-y-1.5 pt-1 max-h-36 overflow-y-auto pr-1">
              {subtasks.map(s => (
                <div
                  key={s.id}
                  onClick={() => handleToggleSubtask(s.id)}
                  className="flex items-center gap-2 text-xs cursor-pointer text-fg-muted hover:text-fg group"
                >
                  <button
                    type="button"
                    className={`size-3.5 rounded border flex items-center justify-center shrink-0 transition ${
                      s.completed
                        ? 'bg-accent text-accent-fg border-accent'
                        : 'border-line-strong hover:border-line'
                    }`}
                  >
                    {s.completed && <Check size={10} strokeWidth={3} />}
                  </button>
                  <span className={`truncate ${s.completed ? 'line-through opacity-60' : ''}`}>
                    {s.title}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Inline Add Subtask Form */}
          <form onSubmit={handleAddSubtask} className="flex items-center gap-1.5 pt-1">
            <input
              type="text"
              value={newSubtaskText}
              onChange={e => setNewSubtaskText(e.target.value)}
              placeholder="+ Add subtask and press Enter..."
              className="flex-1 bg-surface border border-line rounded-lg px-2.5 py-1 text-xs text-fg placeholder:text-fg-subtle outline-none focus:border-line-strong transition"
            />
            {newSubtaskText.trim() && (
              <button
                type="submit"
                className="px-2 py-1 rounded-lg bg-accent text-accent-fg font-semibold text-xs keycap hover:bg-accent-hover transition cursor-pointer"
              >
                Add
              </button>
            )}
          </form>
        </div>
      )}

      {/* 3. Scratchpad Module */}
      {currentTask && (
        <div className="bg-surface-2 border border-line rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-mono uppercase tracking-wider text-fg-muted font-bold">
              Scratchpad
            </div>
            <button
              type="button"
              onClick={toggleDictation}
              className={`text-[11px] flex items-center gap-1 cursor-pointer transition ${
                isListening ? 'text-rose-500 animate-pulse font-bold' : 'text-fg-muted hover:text-accent-text'
              }`}
            >
              <Mic size={11} />
              <span>{isListening ? 'Listening…' : 'Dictate'}</span>
            </button>
          </div>
          <textarea
            value={currentTask.notes || ''}
            onChange={handleScratchpadChange}
            placeholder="Jot a thought. It saves to the task."
            rows={3}
            className="w-full bg-surface border border-line rounded-xl p-2.5 text-xs text-fg placeholder:text-fg-subtle outline-none focus:border-line-strong transition resize-none leading-relaxed"
          />
        </div>
      )}

      {/* 4. Daily Habits Module */}
      {habits.length > 0 && (
        <div className="bg-surface-2 border border-line rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-fg-muted font-mono uppercase tracking-wider font-bold">
            <span className="text-fg font-semibold">Daily habits</span>
            <span>
              {habitsDone}/{habits.length}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {habits.map(h => {
              const done = h.completions.includes(today);
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => void toggleHabitDay(h.id, today)}
                  className={`px-2 py-1.5 rounded-lg border text-left text-xs truncate flex items-center gap-1.5 cursor-pointer transition ${
                    done
                      ? 'border-accent/40 bg-accent/15 text-accent-text font-semibold'
                      : 'border-line bg-surface text-fg hover:text-fg hover:bg-hover'
                  }`}
                >
                  <span
                    className="size-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: h.color }}
                  />
                  <span className="truncate">{h.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}
