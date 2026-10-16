import { useLiveQuery } from 'dexie-react-hooks';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Coffee,
  ListTodo,
  Minus,
  Pause,
  PictureInPicture2,
  Play,
  Plus,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { db, withStatus } from '../db/db';
import { pipHUD, usePipHUD } from '../lib/pipHud';
import { formatClock, formatOvertimeClock, timer, useTimer } from '../lib/timer';
import { toast } from '../lib/toast';
import { uid } from '../lib/utils';
import type { Subtask, Task } from '../types';
import { useDictation } from '../voice/useDictation';
import { createInputTarget } from '../voice/target/inputTarget';
import type { DictationTarget } from '../voice/target/DictationTarget';
import { MicButton } from '../voice/ui/MicButton';
import { DictationHud } from '../voice/ui/DictationHud';

export function FloatingHUDTrigger({ className = '' }: { className?: string }) {
  const { isOpen, isSupported } = usePipHUD();

  if (!isSupported) return null;

  return (
    <button
      onClick={() => (isOpen ? pipHUD.close() : pipHUD.open())}
      className={`size-8 rounded-xl border flex items-center justify-center transition keycap ${
        isOpen
          ? 'bg-accent text-accent-fg border-accent shadow-sm'
          : 'bg-surface border-line text-fg-muted hover:text-fg hover:border-line-strong'
      } ${className}`}
      title={isOpen ? 'Dock HUD back to app' : 'Pop out Always-on-Top Floating HUD'}
      aria-label={isOpen ? 'Dock HUD' : 'Pop out Floating HUD'}
    >
      <PictureInPicture2 size={14} />
    </button>
  );
}

export function FloatingHUDPortal() {
  const { isOpen, pipWindow } = usePipHUD();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isOpen || !pipWindow || pipWindow.closed) {
    return null;
  }

  try {
    const body = pipWindow.document?.body;
    if (!body) return null;
    return createPortal(<FloatingHUDContent />, body);
  } catch {
    return null;
  }
}

function FloatingHUDContent() {
  const timerState = useTimer();
  const { isExpanded } = usePipHUD();

  const task = useLiveQuery(
    async () => {
      if (!timerState.taskId) return undefined;
      return await db.tasks.get(timerState.taskId);
    },
    [timerState.taskId]
  );

  const [scratchText, setScratchText] = useState('');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);

  const scratchInputRef = useRef<HTMLInputElement>(null);
  const subtaskInputRef = useRef<HTMLInputElement>(null);
  const [dictationTarget, setDictationTarget] = useState<DictationTarget | null>(null);
  const [activeVoiceField, setActiveVoiceField] = useState<'scratch' | 'subtask'>('scratch');

  const dictation = useDictation({
    target: dictationTarget,
  });

  const toggleVoice = (field: 'scratch' | 'subtask') => {
    const el = field === 'scratch' ? scratchInputRef.current : subtaskInputRef.current;
    if (!el) return;
    setActiveVoiceField(field);
    setDictationTarget(createInputTarget(el));
    dictation.toggle();
  };

  const toggleSubtask = async (subtaskId: string) => {
    if (!task) return;
    const updated = (task.subtasks || []).map(s =>
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    );
    await db.tasks.update(task.id, { subtasks: updated, updatedAt: new Date().toISOString() });
  };

  const addSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !newSubtaskTitle.trim()) return;
    const newSub: Subtask = {
      id: uid(),
      title: newSubtaskTitle.trim(),
      completed: false,
    };
    const updated = [...(task.subtasks || []), newSub];
    await db.tasks.update(task.id, { subtasks: updated, updatedAt: new Date().toISOString() });
    setNewSubtaskTitle('');
    setIsAddingSubtask(false);
  };

  const saveScratchpad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !scratchText.trim()) return;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const entry = `• [${timeStr}] ${scratchText.trim()}`;
    const newNotes = task.notes ? `${task.notes}\n${entry}` : entry;
    await db.tasks.update(task.id, { notes: newNotes, updatedAt: now.toISOString() });
    setScratchText('');
    toast('Thought saved to task notes', 'success');
  };

  const markTaskDone = async () => {
    if (!task) return;
    const updated = withStatus(task, 'Submitted/Done');
    await db.tasks.put(updated);
    toast(`“${task.title}” completed!`, 'success');
  };

  const completedSubtasks = (task?.subtasks || []).filter(s => s.completed).length;
  const totalSubtasks = (task?.subtasks || []).length;

  // MICRO-PILL MODE (300 x 84)
  if (!isExpanded) {
    return (
      <div className="h-screen w-screen bg-surface text-fg flex items-center justify-between px-3.5 py-2 select-none border-b border-line box-border font-sans">
        {/* Left: Timer & Task Info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex items-center justify-center shrink-0">
            {timerState.isOvertime ? (
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-accent" />
              </span>
            ) : (
              <div
                className={`size-2.5 rounded-full ${
                  timerState.running ? 'bg-accent animate-pulse' : 'bg-fg-muted/40'
                }`}
              />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 leading-none">
              <span
                className={`font-mono text-sm font-bold tracking-tight tabular-nums ${
                  timerState.isOvertime ? 'text-accent-text font-black' : 'text-fg'
                }`}
              >
                {timerState.isOvertime
                  ? formatOvertimeClock(timerState.overtimeMs ?? 0)
                  : formatClock(timerState.remainingMs)}
              </span>
              {timerState.isOvertime && (
                <span className="text-[9px] font-mono uppercase tracking-wider px-1 py-0.2 rounded bg-accent/20 text-accent-text font-bold">
                  OT
                </span>
              )}
            </div>

            <div className="text-[11px] text-fg-muted truncate max-w-[130px] mt-0.5" title={task?.title || timerState.taskTitle || 'Free Focus'}>
              {task?.title || timerState.taskTitle || 'Free Focus'}
            </div>
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {timerState.isOvertime ? (
            <button
              onClick={() => timer.bankOvertime()}
              className="h-7 px-2 rounded-lg bg-accent text-accent-fg text-[11px] font-bold flex items-center gap-1 hover:bg-accent-hover transition"
              title="Bank Overtime & Start Break"
            >
              <Coffee size={12} /> Bank
            </button>
          ) : (
            <button
              onClick={() => timer.toggle()}
              className={`size-7 rounded-lg flex items-center justify-center transition ${
                timerState.running
                  ? 'bg-surface-2 border border-line text-fg hover:bg-hover'
                  : 'bg-accent text-accent-fg hover:bg-accent-hover'
              }`}
              title={timerState.running ? 'Pause' : 'Start'}
            >
              {timerState.running ? <Pause size={13} /> : <Play size={13} className="ml-0.5" />}
            </button>
          )}

          {task && task.status !== 'Submitted/Done' && (
            <button
              onClick={markTaskDone}
              className="size-7 rounded-lg border border-line hover:border-accent hover:bg-accent/10 text-fg-muted hover:text-accent-text flex items-center justify-center transition"
              title="Mark Task Complete"
            >
              <Check size={13} />
            </button>
          )}

          <button
            onClick={() => pipHUD.toggleExpanded()}
            className="size-7 rounded-lg border border-line hover:bg-hover text-fg-muted hover:text-fg flex items-center justify-center transition"
            title="Expand Flow Drawer"
          >
            <ChevronDown size={14} />
          </button>

          <button
            onClick={() => pipHUD.close()}
            className="size-7 rounded-lg text-fg-subtle hover:text-fg flex items-center justify-center transition"
            title="Close HUD"
          >
            <X size={13} />
          </button>
        </div>
      </div>
    );
  }

  // EXPANDABLE FLOW DRAWER MODE (320 x 260)
  return (
    <div className="h-screen w-screen bg-surface text-fg flex flex-col font-sans select-none overflow-hidden box-border">
      {/* Drawer Header */}
      <div className="h-10 px-3.5 border-b border-line flex items-center justify-between shrink-0 bg-surface-2">
        <div className="flex items-center gap-2">
          <span
            className={`font-mono text-sm font-bold tracking-tight tabular-nums ${
              timerState.isOvertime ? 'text-accent-text font-black' : 'text-fg'
            }`}
          >
            {timerState.isOvertime
              ? formatOvertimeClock(timerState.overtimeMs ?? 0)
              : formatClock(timerState.remainingMs)}
          </span>
          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-surface border border-line text-fg-muted">
            {timerState.isOvertime ? 'Overtime' : timerState.mode}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {timerState.isOvertime ? (
            <button
              onClick={() => timer.bankOvertime()}
              className="h-6 px-2 rounded bg-accent text-accent-fg text-[10px] font-bold flex items-center gap-1 hover:bg-accent-hover transition"
              title="Bank Overtime"
            >
              <Coffee size={11} /> Bank
            </button>
          ) : (
            <button
              onClick={() => timer.toggle()}
              className="h-6 px-2 rounded bg-surface border border-line text-[11px] font-semibold text-fg flex items-center gap-1 hover:bg-hover transition"
            >
              {timerState.running ? <Pause size={11} /> : <Play size={11} />}
              {timerState.running ? 'Pause' : 'Start'}
            </button>
          )}

          <button
            onClick={() => pipHUD.toggleExpanded()}
            className="size-6 rounded hover:bg-hover text-fg-muted hover:text-fg flex items-center justify-center transition"
            title="Collapse to Micro-Pill"
          >
            <ChevronUp size={13} />
          </button>

          <button
            onClick={() => pipHUD.close()}
            className="size-6 rounded hover:bg-hover text-fg-subtle hover:text-fg flex items-center justify-center transition"
            title="Close HUD"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Active Task Overview */}
        {task ? (
          <div className="rounded-xl border border-line bg-surface p-2.5 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-fg-muted">
                Active Task
              </span>
              <button
                onClick={markTaskDone}
                className="text-[10px] text-accent-text hover:underline flex items-center gap-1 font-semibold"
              >
                <Check size={11} /> Mark Done
              </button>
            </div>
            <div className="text-xs font-semibold text-fg line-clamp-1">{task.title}</div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-line p-2 text-center text-xs text-fg-muted">
            Free Focus Session (No task attached)
          </div>
        )}

        {/* Subtask Checklist */}
        {task && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-fg-muted font-medium">
              <span className="flex items-center gap-1">
                <ListTodo size={12} /> Subtasks ({completedSubtasks}/{totalSubtasks})
              </span>
              <button
                onClick={() => setIsAddingSubtask(v => !v)}
                className="text-[10px] text-accent-text hover:underline flex items-center gap-0.5"
              >
                <Plus size={11} /> Add
              </button>
            </div>

            {isAddingSubtask && (
              <form onSubmit={addSubtask} className="flex items-center gap-1">
                <input
                  ref={subtaskInputRef}
                  type="text"
                  value={newSubtaskTitle}
                  onChange={e => setNewSubtaskTitle(e.target.value)}
                  placeholder="New subtask..."
                  autoFocus
                  className="flex-1 h-7 px-2 text-xs rounded bg-surface-2 border border-line text-fg placeholder:text-fg-subtle outline-none"
                />
                <MicButton
                  size="sm"
                  state={activeVoiceField === 'subtask' ? dictation.state : 'idle'}
                  onClick={() => toggleVoice('subtask')}
                  title="Dictate subtask"
                />
                <button
                  type="submit"
                  disabled={!newSubtaskTitle.trim()}
                  className="h-7 px-2 rounded bg-accent text-accent-fg text-xs font-semibold disabled:opacity-40"
                >
                  Add
                </button>
              </form>
            )}

            <div className="space-y-1 max-h-24 overflow-y-auto">
              {(task.subtasks || []).length === 0 ? (
                <div className="text-[11px] text-fg-subtle italic py-1">No subtasks yet</div>
              ) : (
                task.subtasks.map(s => (
                  <label
                    key={s.id}
                    className="flex items-center gap-2 p-1 rounded hover:bg-surface-2 cursor-pointer text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={s.completed}
                      onChange={() => toggleSubtask(s.id)}
                      className="rounded accent-accent"
                    />
                    <span
                      className={`truncate ${
                        s.completed ? 'line-through text-fg-subtle' : 'text-fg'
                      }`}
                    >
                      {s.title}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>
        )}

        {/* In-Session Scratchpad */}
        {task && (
          <form onSubmit={saveScratchpad} className="pt-1">
            <div className="relative">
              <input
                ref={scratchInputRef}
                type="text"
                value={scratchText}
                onChange={e => setScratchText(e.target.value)}
                placeholder="Capture a quick thought (Enter to save)..."
                className="w-full h-8 pl-2.5 pr-14 text-xs rounded-xl bg-surface-2 border border-line text-fg placeholder:text-fg-subtle focus:border-accent outline-none"
              />
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <MicButton
                  size="sm"
                  state={activeVoiceField === 'scratch' ? dictation.state : 'idle'}
                  onClick={() => toggleVoice('scratch')}
                  title="Dictate thought"
                />
                <button
                  type="submit"
                  disabled={!scratchText.trim()}
                  className="size-5 rounded text-fg-muted hover:text-accent-text disabled:opacity-30 flex items-center justify-center transition"
                  title="Save thought to task notes"
                >
                  <Send size={11} />
                </button>
              </div>
            </div>
          </form>
        )}

        <DictationHud
          state={dictation.state}
          audioLevel={dictation.audioLevel}
          modelProgress={dictation.modelProgress}
          onStop={dictation.stop}
        />
      </div>
    </div>
  );
}
