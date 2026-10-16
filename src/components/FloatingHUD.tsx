import { useLiveQuery } from 'dexie-react-hooks';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Coffee,
  Mic,
  Pause,
  PictureInPicture2,
  Play,
  Plus,
  Send,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { db, withStatus } from '../db/db';
import { pipHUD, usePipHUD } from '../lib/pipHud';
import { formatClock, formatOvertimeClock, timer, useTimer } from '../lib/timer';
import { toast } from '../lib/toast';
import { uid } from '../lib/utils';
import { hudBridge, type TimerSnapshot, type TaskSnapshot } from '../lib/hudBridge';
import type { Subtask, Task } from '../types';
import { useDictation } from '../voice/useDictation';
import { createInputTarget } from '../voice/target/inputTarget';
import type { DictationTarget } from '../voice/target/DictationTarget';
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
    return createPortal(<FloatingHUDContent isNativeWindow={false} />, body);
  } catch {
    return null;
  }
}

export function FloatingHUD({ isNativeWindow = false }: { isNativeWindow?: boolean }) {
  return <FloatingHUDContent isNativeWindow={isNativeWindow} />;
}

function FloatingHUDContent({ isNativeWindow = false }: { isNativeWindow?: boolean }) {
  const localTimerState = useTimer();
  const { isExpanded: pipExpanded } = usePipHUD();

  const [syncedTimer, setSyncedTimer] = useState<TimerSnapshot | null>(null);
  const [syncedTask, setSyncedTask] = useState<TaskSnapshot | null>(null);
  const [nativeExpanded, setNativeExpanded] = useState(false);

  // Initialize native window styles & theme
  useEffect(() => {
    if (!isNativeWindow) return;
    const currentTheme = localStorage.getItem('focusspace-theme') || 'nocturne';
    document.documentElement.dataset.theme = currentTheme;
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.background = 'transparent';
    document.body.style.overflow = 'hidden';
    document.body.style.userSelect = 'none';

    // Request immediate sync from main window
    hudBridge.send({ type: 'REQUEST_SYNC', v: 1 });

    const unsub = hudBridge.subscribe((msg) => {
      if (msg.type === 'STATE_SYNC') {
        setSyncedTimer(msg.timer);
        setSyncedTask(msg.activeTask);
      } else if (msg.type === 'RESIZE_HUD') {
        setNativeExpanded(msg.expanded);
      }
    });

    return unsub;
  }, [isNativeWindow]);

  const isExpanded = isNativeWindow ? nativeExpanded : pipExpanded;

  const timerState = isNativeWindow && syncedTimer
    ? {
        mode: syncedTimer.mode as any,
        remainingMs: syncedTimer.remainingMs,
        totalMs: syncedTimer.totalMs,
        running: syncedTimer.running,
        isOvertime: syncedTimer.isOvertime,
        overtimeMs: syncedTimer.overtimeMs,
        taskId: syncedTimer.taskId,
        taskTitle: syncedTimer.taskTitle,
      }
    : localTimerState;

  const liveTask = useLiveQuery(
    async () => {
      if (!timerState.taskId) return undefined;
      return await db.tasks.get(timerState.taskId);
    },
    [timerState.taskId]
  );

  const task: Task | TaskSnapshot | undefined = liveTask ?? (isNativeWindow && syncedTask ? syncedTask : undefined);

  const [scratchText, setScratchText] = useState('');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);

  const scratchTextareaRef = useRef<HTMLTextAreaElement>(null);
  const subtaskInputRef = useRef<HTMLInputElement>(null);
  const [dictationTarget, setDictationTarget] = useState<DictationTarget | null>(null);

  const dictation = useDictation({
    target: dictationTarget,
  });

  const toggleVoice = (field: 'note' | 'subtask') => {
    if (!isExpanded && field === 'note') {
      handleToggleExpand();
    }
    const el = field === 'note' ? scratchTextareaRef.current : subtaskInputRef.current;
    if (!el) {
      dictation.toggle();
      return;
    }
    setDictationTarget(createInputTarget(el));
    dictation.toggle();
  };

  const handleToggleTimer = () => {
    if (isNativeWindow) {
      hudBridge.send({ type: 'TOGGLE_TIMER', v: 1 });
    } else {
      timer.toggle();
    }
  };

  const handleBankOvertime = () => {
    if (isNativeWindow) {
      hudBridge.send({ type: 'BANK_OVERTIME', v: 1 });
    } else {
      timer.bankOvertime();
    }
  };

  const toggleSubtask = async (subtaskId: string) => {
    if (!task) return;
    if (isNativeWindow) {
      hudBridge.send({ type: 'COMPLETE_SUBTASK', v: 1, taskId: task.id, subtaskId });
    }
    const updated = (task.subtasks || []).map(s =>
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    );
    await db.tasks.update(task.id, { subtasks: updated, updatedAt: new Date().toISOString() });
  };

  const addSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !newSubtaskTitle.trim()) return;
    const title = newSubtaskTitle.trim();
    if (isNativeWindow) {
      hudBridge.send({ type: 'ADD_SUBTASK', v: 1, taskId: task.id, title });
    }
    const newSub: Subtask = {
      id: uid(),
      title,
      completed: false,
    };
    const updated = [...(task.subtasks || []), newSub];
    await db.tasks.update(task.id, { subtasks: updated, updatedAt: new Date().toISOString() });
    setNewSubtaskTitle('');
    setIsAddingSubtask(false);
  };

  const saveScratchpad = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!task || !scratchText.trim()) return;
    const text = scratchText.trim();
    if (isNativeWindow) {
      hudBridge.send({ type: 'SAVE_SCRATCHPAD', v: 1, taskId: task.id, text });
    }
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const entry = `• [${timeStr}] ${text}`;
    const newNotes = task.notes ? `${task.notes}\n${entry}` : entry;
    await db.tasks.update(task.id, { notes: newNotes, updatedAt: now.toISOString() });
    setScratchText('');
    toast('Thought saved to task notes', 'success');
  };

  const markTaskDone = async () => {
    if (!task) return;
    if (isNativeWindow) {
      hudBridge.send({ type: 'COMPLETE_TASK', v: 1, taskId: task.id });
    }
    const current = await db.tasks.get(task.id);
    if (current) {
      const updated = withStatus(current, 'Submitted/Done');
      await db.tasks.put(updated);
    }
    toast(`“${task.title}” completed!`, 'success');
  };

  const handleToggleExpand = () => {
    if (isNativeWindow) {
      setNativeExpanded(!isExpanded);
    }
    pipHUD.toggleExpanded();
  };

  const handleClose = () => {
    pipHUD.close();
  };

  const completedSubtasks = (task?.subtasks || []).filter(s => s.completed).length;
  const totalSubtasks = (task?.subtasks || []).length;

  const totalMs = (timerState as any).totalMs || ((timerState as any).durations?.[timerState.mode] || 25) * 60_000;
  const remainingMs = timerState.remainingMs ?? 0;
  const progressPct = timerState.isOvertime ? 100 : Math.max(0, Math.min(100, Math.round(((totalMs - remainingMs) / totalMs) * 100)));

  const isDictating = dictation.state === 'listening' || dictation.state === 'transcribing';

  return (
    <div
      className={`hud-shell ${isExpanded ? 'hud-expanded' : 'hud-collapsed'} ${
        isDictating ? 'hud-dictating' : ''
      }`}
    >
      {/* 76px Top Row (Tactile Hardware Readout) */}
      <div data-tauri-drag-region className="hud-top-row">
        {/* Clock */}
        <div data-tauri-drag-region className="hud-clock">
          {timerState.isOvertime
            ? formatOvertimeClock(timerState.overtimeMs ?? 0)
            : formatClock(timerState.remainingMs)}
        </div>

        {/* Task Title */}
        <div
          data-tauri-drag-region
          className="hud-task-title"
          title={task?.title || timerState.taskTitle || 'Free Focus'}
        >
          {isDictating
            ? '🎙 Listening for note…'
            : task?.title || timerState.taskTitle || 'Free Focus'}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0" data-tauri-drag-region="false">
          <button
            onClick={() => toggleVoice('note')}
            className="hud-icon-btn btn-mic"
            title={isDictating ? 'Stop Voice Dictation' : 'Voice Dictate Note'}
          >
            <Mic size={16} />
          </button>

          {timerState.isOvertime ? (
            <button
              onClick={handleBankOvertime}
              className="hud-icon-btn btn-pause"
              title="Bank Overtime & Start Break"
            >
              <Coffee size={16} />
            </button>
          ) : (
            <button
              onClick={handleToggleTimer}
              className="hud-icon-btn btn-pause"
              title={timerState.running ? 'Pause Timer' : 'Resume Timer'}
            >
              {timerState.running ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
            </button>
          )}

          <button
            onClick={handleToggleExpand}
            className="hud-icon-btn btn-util"
            title={isExpanded ? 'Collapse Drawer' : 'Expand Flow Drawer'}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          <button
            onClick={handleClose}
            className="hud-icon-btn btn-util"
            title="Close HUD"
          >
            <X size={15} />
          </button>
        </div>

        {/* 6px Bottom Progress Track */}
        <div className="hud-progress-track">
          <div className="hud-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Expanded Flow Drawer (290px mode) */}
      {isExpanded && (
        <div className="hud-drawer">
          {/* Subtasks List */}
          <div className="flex items-center justify-between py-1 text-[11px] font-bold text-fg-muted uppercase tracking-wider">
            <span>Subtasks ({completedSubtasks}/{totalSubtasks})</span>
            {task && (
              <button
                onClick={() => setIsAddingSubtask(v => !v)}
                className="text-[10px] text-accent-text hover:underline flex items-center gap-0.5 cursor-pointer font-bold"
              >
                <Plus size={11} /> Add
              </button>
            )}
          </div>

          {isAddingSubtask && task && (
            <form onSubmit={addSubtask} className="flex items-center gap-1 pb-1">
              <input
                ref={subtaskInputRef}
                type="text"
                value={newSubtaskTitle}
                onChange={e => setNewSubtaskTitle(e.target.value)}
                placeholder="New subtask..."
                autoFocus
                className="flex-1 h-6 px-2 text-xs rounded bg-surface-2 border border-line text-fg placeholder:text-fg-subtle outline-none"
              />
              <button
                type="submit"
                disabled={!newSubtaskTitle.trim()}
                className="h-6 px-2 rounded bg-accent text-accent-fg text-xs font-bold disabled:opacity-40 cursor-pointer"
              >
                Add
              </button>
            </form>
          )}

          <div className="space-y-0.5 max-h-24 overflow-y-auto pr-1">
            {(task?.subtasks || []).length === 0 ? (
              <div className="text-[11px] text-fg-subtle italic py-1">No subtasks yet</div>
            ) : (
              (task?.subtasks || []).map(s => (
                <div
                  key={s.id}
                  onClick={() => toggleSubtask(s.id)}
                  className="hud-subtask"
                  style={{
                    textDecoration: s.completed ? 'line-through' : 'none',
                    opacity: s.completed ? 0.65 : 1,
                  }}
                >
                  <span className={`hud-checkbox ${s.completed ? 'checked' : ''}`}>
                    {s.completed && <Check size={11} strokeWidth={3} />}
                  </span>
                  <span className="truncate">{s.title}</span>
                </div>
              ))
            )}
          </div>

          {/* In-Session Scratchpad / Quick Note Box */}
          <form onSubmit={saveScratchpad} className="mt-auto pt-1 relative">
            <textarea
              ref={scratchTextareaRef}
              value={scratchText}
              onChange={e => setScratchText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void saveScratchpad();
                }
              }}
              placeholder="Quick thought for task notes... (Enter to save)"
              className="hud-note-box"
            />
            {scratchText.trim() && (
              <button
                type="submit"
                className="absolute right-2 bottom-3 p-1 rounded bg-accent text-accent-fg hover:bg-accent-hover transition cursor-pointer"
                title="Save note"
              >
                <Send size={11} />
              </button>
            )}
          </form>

          {task && (task as any).status !== 'Submitted/Done' && (
            <div className="flex justify-end pt-1">
              <button
                onClick={markTaskDone}
                className="text-[10px] text-accent-text hover:underline flex items-center gap-1 font-bold cursor-pointer"
              >
                <Check size={11} /> Mark Task Done
              </button>
            </div>
          )}

          <DictationHud
            state={dictation.state}
            audioLevel={dictation.audioLevel}
            modelProgress={dictation.modelProgress}
            onStop={dictation.stop}
          />
        </div>
      )}
    </div>
  );
}
