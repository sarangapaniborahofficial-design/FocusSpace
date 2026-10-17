import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  PictureInPicture2,
  ListTodo,
  CheckSquare,
  Volume2,
  VolumeX,
  Headphones,
  FileText,
  LayoutDashboard,
  Mic,
  Plus,
  Play,
  Pause,
  ChevronUp,
  ChevronDown,
  X,
  Sparkles,
} from 'lucide-react';
import { getElectronAPI } from '../lib/runtime';
import { subscribeHudBridge, sendHudCommand, requestHudSync, HudStatePayload, TodoItemSnapshot } from '../lib/hudBridge';
import { pipHUD, usePipHUD } from '../lib/pipHud';
import { useDictation } from '../voice/useDictation';
import { ambientSound, AMBIENT_TRACKS, useAmbientSound, type AmbientTrack, type AmbientSoundState } from '../lib/ambientSound';
import { FocusSpaceLogo } from './FocusSpaceLogo';

export type HudArtboardId = '01' | '02' | '03' | '04' | '05' | '06';

const THEME_TO_ARTBOARD: Record<string, HudArtboardId> = {
  nocturne: '01',
  onyx: '02',
  bauhaus: '03',
  solaris: '04',
};

export function resolveHudArtboard(theme?: string, override?: string | null): HudArtboardId {
  if (override && ['01', '02', '03', '04', '05', '06'].includes(override)) {
    return override as HudArtboardId;
  }
  return THEME_TO_ARTBOARD[theme || 'nocturne'] || '01';
}

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
    return createPortal(<FloatingHUD isNativeWindow={false} />, body);
  } catch {
    return null;
  }
}

type HudTab = 'todo' | 'subtasks' | 'notes' | 'ambient';

export const FloatingHUD: React.FC<{ isNativeWindow?: boolean }> = ({ isNativeWindow = false }) => {
  const [expanded, setExpanded] = useState(false);
  const [hudState, setHudState] = useState<HudStatePayload | null>(null);
  const [activeTab, setActiveTab] = useState<HudTab>('todo');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [scratchpad, setScratchpad] = useState('');
  const ambientState = useAmbientSound();
  const noteRef = useRef<HTMLTextAreaElement | null>(null);

  const { isListening, toggle: toggleDictation } = useDictation({
    onTranscript: (_raw, cleanedText) => {
      const next = scratchpad ? `${scratchpad} ${cleanedText}` : cleanedText;
      setScratchpad(next);
      if (hudState?.activeTask?.id) {
        sendHudCommand({ type: 'SAVE_SCRATCHPAD', v: 1, taskId: hudState.activeTask.id, text: next });
      }
    },
  });

  useEffect(() => {
    if (isNativeWindow) {
      document.documentElement.classList.add('hud-window-mode');
    }
    const unsub = subscribeHudBridge((msg) => {
      if (msg.type === 'STATE_SYNC') {
        setHudState(msg);
        if (msg.theme) {
          document.documentElement.dataset.theme = msg.theme;
        }
        if (msg.activeTask?.scratchpadNotes !== undefined) {
          setScratchpad(msg.activeTask.scratchpadNotes || '');
        }
      }
    });
    requestHudSync();
    return () => {
      unsub();
      if (isNativeWindow) {
        document.documentElement.classList.remove('hud-window-mode');
      }
    };
  }, [isNativeWindow]);

  const currentTheme = hudState?.theme || localStorage.getItem('focusspace-theme') || 'nocturne';

  useEffect(() => {
    document.documentElement.dataset.theme = currentTheme;
  }, [currentTheme]);

  const handleToggleExpand = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const next = !expanded;
    setExpanded(next);
    const api = getElectronAPI();
    if (api) {
      await api.resizeHud(next);
    } else {
      sendHudCommand({ type: 'RESIZE_HUD', v: 1, expanded: next });
    }
  };

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const api = getElectronAPI();
    if (api) {
      await api.hideHud();
    } else {
      sendHudCommand({ type: 'CLOSE_HUD', v: 1 });
    }
  };

  const handleToggleTimer = (e: React.MouseEvent) => {
    e.stopPropagation();
    sendHudCommand({ type: 'TOGGLE_TIMER', v: 1 });
  };

  const handleOpenDashboard = (e: React.MouseEvent) => {
    e.stopPropagation();
    const api = getElectronAPI();
    if (api) {
      api.showMainWindow();
    }
    sendHudCommand({ type: 'SHOW_DASHBOARD', v: 1 });
  };

  const handleToggleAmbient = (e: React.MouseEvent) => {
    e.stopPropagation();
    ambientSound.toggle();
  };

  const handleToggleSubtask = (subtaskId: string) => {
    if (!hudState?.activeTask?.id) return;
    sendHudCommand({
      type: 'COMPLETE_SUBTASK',
      v: 1,
      taskId: hudState.activeTask.id,
      subtaskId,
    });
  };

  const handleToggleTask = (taskId: string) => {
    sendHudCommand({
      type: 'TOGGLE_TASK',
      v: 1,
      taskId,
    });
  };

  const handleSelectActiveTask = (taskId: string) => {
    sendHudCommand({
      type: 'SET_ACTIVE_TASK',
      v: 1,
      taskId,
    });
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTaskTitle.trim();
    if (!title) return;
    sendHudCommand({
      type: 'ADD_TASK',
      v: 1,
      title,
      priority: 'Medium',
    });
    setNewTaskTitle('');
  };

  const handleScratchpadChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setScratchpad(val);
    if (hudState?.activeTask?.id) {
      sendHudCommand({
        type: 'SAVE_SCRATCHPAD',
        v: 1,
        taskId: hudState.activeTask.id,
        text: val,
      });
    }
  };

  // Format Clock & Progress
  const timer = hudState?.timer;
  const isOvertime = Boolean(timer?.isOvertime);
  const totalSec = isOvertime
    ? Math.floor((timer?.overtimeMs || 0) / 1000)
    : Math.max(0, Math.ceil((timer?.remainingMs ?? 25 * 60 * 1000) / 1000));
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  const prefix = isOvertime ? '+' : '';
  const fullClock = `${prefix}${mm}:${ss}`;

  const durationSec = (timer?.durationMinutes || 25) * 60;
  const progressPct = isOvertime
    ? 100
    : Math.min(100, Math.max(0, Math.round(((durationSec - totalSec) / durationSec) * 100)));

  const artboardId = resolveHudArtboard(
    currentTheme,
    hudState?.hudStyleOverride || localStorage.getItem('focusspace-hud-style')
  );

  const isSplitFlap = artboardId === '05';
  const subtasks = hudState?.activeTask?.subtasks || [];
  const todayTasks = hudState?.todayTasks || [];
  const pendingTasksCount = todayTasks.filter((t) => !t.completed).length;

  return (
    <div className="hud-stage">
      <div
        className={`hud-shell ${expanded ? 'hud-expanded' : 'hud-collapsed'} hud-${artboardId} hud-theme-${currentTheme} ${
          isListening ? 'dictating' : ''
        }`}
      >
        {/* Top 76px Bar — Native 0ms Chromium Drag Surface */}
        <div className="hud-top-row" onDoubleClick={() => handleToggleExpand()}>
          {isSplitFlap ? (
            <div className="flap-group">
              <span className="flap-card">
                {prefix}
                {mm}
              </span>
              <span style={{ fontWeight: 800, opacity: 0.6 }}>:</span>
              <span className="flap-card">{ss}</span>
            </div>
          ) : (
            <div className="hud-clock">{fullClock}</div>
          )}

          <div
            className="hud-task-title cursor-pointer"
            onClick={handleOpenDashboard}
            title="Open FocusSpace Dashboard"
          >
            {isListening
              ? '🎙 Listening for note…'
              : hudState?.activeTask?.title || 'Free Focus Session'}
          </div>

          {/* Jump to Dashboard Button */}
          <button
            type="button"
            className="hud-icon-btn btn-dash hud-no-drag"
            onClick={handleOpenDashboard}
            title="Return to Main Dashboard (Ctrl+Alt+D)"
            aria-label="Dashboard"
          >
            <LayoutDashboard size={15} />
          </button>

          {/* Ambient Music / Soundscape Quick-Toggle */}
          <button
            type="button"
            className={`hud-icon-btn btn-ambient hud-no-drag ${ambientState.playing ? 'ambient-active' : ''}`}
            onClick={handleToggleAmbient}
            title={ambientState.playing ? `Pause ${ambientState.track} Sound` : 'Play Ambient Focus Audio'}
            aria-label="Ambient Audio"
          >
            {ambientState.playing ? <Volume2 size={15} /> : <Headphones size={15} />}
          </button>

          {/* Voice Dictate Button */}
          <button
            type="button"
            className="hud-icon-btn btn-mic hud-no-drag"
            onClick={(e) => {
              e.stopPropagation();
              toggleDictation();
            }}
            title="Voice Dictate Note"
            aria-label="Dictate"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
          </button>

          {/* Play / Pause Button */}
          <button
            type="button"
            className="hud-icon-btn btn-pause hud-no-drag"
            onClick={handleToggleTimer}
            title={timer?.running ? 'Pause Timer' : 'Start / Resume Timer'}
            aria-label={timer?.running ? 'Pause' : 'Resume'}
          >
            {timer?.running ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 5v14M16 5v14" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 5v14l12-7z" />
              </svg>
            )}
          </button>

          {/* Expand Chevron + Close X */}
          <div className="hud-util-col hud-no-drag">
            <button
              type="button"
              className="hud-mini-ctrl"
              onClick={handleToggleExpand}
              title={expanded ? 'Collapse Drawer' : 'Expand Tasks, Audio & Notes'}
              aria-label="Toggle Drawer"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                {expanded ? <path d="M18 15l-6-6-6 6" /> : <path d="M6 9l6 6 6-6" />}
              </svg>
            </button>
            <button
              type="button"
              className="hud-mini-ctrl"
              onClick={handleClose}
              title="Hide Floating HUD"
              aria-label="Close HUD"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 6px Bottom Progress Track */}
          <div className="hud-progress-track">
            <div className="hud-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        {/* Expanded 368px Drawer: Tabs, Interactive To-Do, Audio & Notes */}
        {expanded && (
          <div className="hud-drawer hud-no-drag">
            {/* Segmented Tab Bar */}
            <div className="hud-tab-bar">
              <button
                type="button"
                className={`hud-tab-item ${activeTab === 'todo' ? 'active' : ''}`}
                onClick={() => setActiveTab('todo')}
              >
                <ListTodo size={13} />
                <span>Tasks</span>
                {pendingTasksCount > 0 && <span className="hud-tab-badge">{pendingTasksCount}</span>}
              </button>

              <button
                type="button"
                className={`hud-tab-item ${activeTab === 'subtasks' ? 'active' : ''}`}
                onClick={() => setActiveTab('subtasks')}
              >
                <CheckSquare size={13} />
                <span>Subtasks</span>
                {subtasks.length > 0 && <span className="hud-tab-badge">{subtasks.length}</span>}
              </button>

              <button
                type="button"
                className={`hud-tab-item ${activeTab === 'ambient' ? 'active' : ''}`}
                onClick={() => setActiveTab('ambient')}
              >
                <Headphones size={13} />
                <span>Audio</span>
                {ambientState.playing && <span className="hud-sound-dot" />}
              </button>

              <button
                type="button"
                className={`hud-tab-item ${activeTab === 'notes' ? 'active' : ''}`}
                onClick={() => setActiveTab('notes')}
              >
                <FileText size={13} />
                <span>Notes</span>
              </button>
            </div>

            {/* Tab 1: Interactive To-Do List */}
            {activeTab === 'todo' && (
              <div className="hud-tab-content">
                <div className="hud-tasks-scroll">
                  {todayTasks.length === 0 ? (
                    <div className="hud-empty-state">
                      <ListTodo size={22} className="opacity-80" />
                      <span>No active tasks today</span>
                    </div>
                  ) : (
                    todayTasks.map((t) => (
                      <div
                        key={t.id}
                        className={`hud-task-row ${t.completed ? 'completed' : ''} ${
                          hudState?.activeTask?.id === t.id ? 'active-focus-task' : ''
                        }`}
                      >
                        <span
                          className={`hud-checkbox ${t.completed ? 'checked' : ''}`}
                          onClick={() => handleToggleTask(t.id)}
                        >
                          {t.completed && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M5 12l5 5 9-10" />
                            </svg>
                          )}
                        </span>
                        <span
                          className="hud-task-label"
                          onClick={() => handleSelectActiveTask(t.id)}
                          title="Click to focus on this task"
                        >
                          {t.title}
                        </span>
                        {t.priority && t.priority !== 'Medium' && (
                          <span className={`hud-priority-tag priority-${t.priority.toLowerCase()}`}>
                            {t.priority[0]}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Quick Add Task Form */}
                <form onSubmit={handleAddTask} className="hud-quick-add-form">
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="+ Add new task & press Enter"
                    className="hud-quick-input"
                  />
                  <button type="submit" className="hud-quick-submit" disabled={!newTaskTitle.trim()}>
                    <Plus size={14} />
                  </button>
                </form>
              </div>
            )}

            {/* Tab 2: Subtasks of Active Task */}
            {activeTab === 'subtasks' && (
              <div className="hud-tab-content">
                <div className="hud-tasks-scroll">
                  {subtasks.length === 0 ? (
                    <div className="hud-empty-state">
                      <CheckSquare size={22} className="opacity-80" />
                      <span>No subtasks on current task</span>
                    </div>
                  ) : (
                    subtasks.map((st) => (
                      <div
                        key={st.id}
                        className={`hud-task-row ${st.completed ? 'completed' : ''}`}
                        onClick={() => handleToggleSubtask(st.id)}
                      >
                        <span className={`hud-checkbox ${st.completed ? 'checked' : ''}`}>
                          {st.completed && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M5 12l5 5 9-10" />
                            </svg>
                          )}
                        </span>
                        <span className="hud-task-label">{st.title}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Tab 3: Ambient Sound Generator */}
            {activeTab === 'ambient' && (
              <div className="hud-tab-content hud-ambient-tab">
                <div className="hud-ambient-grid">
                  {AMBIENT_TRACKS.map((t) => {
                    const isCurrent = ambientState.track === t.id && ambientState.playing;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          if (ambientState.track === t.id && ambientState.playing) {
                            ambientSound.stop();
                          } else {
                            ambientSound.start(t.id);
                          }
                        }}
                        className={`hud-ambient-pill ${isCurrent ? 'active' : ''}`}
                      >
                        <span className="text-sm">{t.icon}</span>
                        <span className="hud-pill-name">{t.name}</span>
                        {isCurrent && <span className="hud-pulse-dot" />}
                      </button>
                    );
                  })}
                </div>

                <div className="hud-volume-row">
                  <button
                    type="button"
                    onClick={() => ambientSound.toggle()}
                    className="hud-vol-btn"
                  >
                    {ambientState.playing ? <Volume2 size={15} /> : <VolumeX size={15} />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={ambientState.volume}
                    onChange={(e) => ambientSound.setVolume(parseFloat(e.target.value))}
                    className="hud-vol-slider"
                  />
                  <span className="hud-vol-val font-mono text-[10px]">
                    {Math.round(ambientState.volume * 100)}%
                  </span>
                </div>
              </div>
            )}

            {/* Tab 4: Scratchpad Notes */}
            {activeTab === 'notes' && (
              <div className="hud-tab-content">
                <textarea
                  ref={noteRef}
                  className="hud-note-box"
                  placeholder="Capture quick thoughts or click the mic to voice dictate notes directly into this task…"
                  value={scratchpad}
                  onChange={handleScratchpadChange}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
