import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { PictureInPicture2 } from 'lucide-react';
import { getElectronAPI } from '../lib/runtime';
import { subscribeHudBridge, sendHudCommand, requestHudSync, HudStatePayload } from '../lib/hudBridge';
import { pipHUD, usePipHUD } from '../lib/pipHud';
import { useDictation } from '../voice/useDictation';

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

export const FloatingHUD: React.FC<{ isNativeWindow?: boolean }> = ({ isNativeWindow = false }) => {
  const [expanded, setExpanded] = useState(false);
  const [hudState, setHudState] = useState<HudStatePayload | null>(null);
  const [scratchpad, setScratchpad] = useState('');
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

  const handleToggleExpand = async (e: React.MouseEvent) => {
    e.stopPropagation();
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

  const handleToggleSubtask = (subtaskId: string) => {
    if (!hudState?.activeTask?.id) return;
    sendHudCommand({
      type: 'COMPLETE_SUBTASK',
      v: 1,
      taskId: hudState.activeTask.id,
      subtaskId,
    });
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
    hudState?.theme || localStorage.getItem('focusspace-theme') || 'nocturne',
    hudState?.hudStyleOverride || localStorage.getItem('focusspace-hud-style')
  );

  const isSplitFlap = artboardId === '05';
  const subtasks = hudState?.activeTask?.subtasks || [];

  return (
    <div className="hud-stage">
      <div
        className={`hud-shell ${expanded ? 'hud-expanded' : 'hud-collapsed'} hud-${artboardId} ${
          isListening ? 'dictating' : ''
        }`}
      >
        {/* Top 76px Bar — Native Chromium Drag Surface */}
        <div className="hud-top-row" onDoubleClick={handleToggleExpand}>
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

          <div className="hud-task-title">
            {isListening
              ? '🎙 Listening for note…'
              : hudState?.activeTask?.title || 'Free Focus Session'}
          </div>

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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
          </button>

          {/* Play / Pause Button */}
          <button
            type="button"
            className="hud-icon-btn btn-pause hud-no-drag"
            onClick={handleToggleTimer}
            title={timer?.running ? 'Pause' : 'Start / Resume'}
            aria-label={timer?.running ? 'Pause' : 'Resume'}
          >
            {timer?.running ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 5v14M16 5v14" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 5v14l12-7z" />
              </svg>
            )}
          </button>

          {/* Compact Expand Chevron + Close X Stack */}
          <div className="hud-util-col hud-no-drag">
            <button
              type="button"
              className="hud-mini-ctrl"
              onClick={handleToggleExpand}
              title={expanded ? 'Collapse Drawer' : 'Expand Subtasks & Notes'}
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

          {/* 6px Bottom Progress Rail */}
          <div className="hud-progress-track">
            <div className="hud-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        {/* Expanded 290px Drawer: Subtasks + Scratchpad */}
        {expanded && (
          <div className="hud-drawer hud-no-drag">
            <div className="hud-subtasks-scroll">
              {subtasks.length === 0 ? (
                <div className="hud-subtask" style={{ opacity: 0.55, cursor: 'default' }}>
                  <span>No subtasks on active task</span>
                </div>
              ) : (
                subtasks.map((st) => (
                  <div
                    key={st.id}
                    className="hud-subtask"
                    onClick={() => handleToggleSubtask(st.id)}
                    style={st.completed ? { textDecoration: 'line-through', opacity: 0.65 } : undefined}
                  >
                    <span className={`hud-checkbox ${st.completed ? 'checked' : ''}`}>
                      {st.completed && (
                        <span style={{ display: 'flex', transform: 'scale(.65)' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12l5 5 9-10" />
                          </svg>
                        </span>
                      )}
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {st.title}
                    </span>
                  </div>
                ))
              )}
            </div>

            <textarea
              ref={noteRef}
              className="hud-note-box"
              placeholder="Quick note for this task…"
              value={scratchpad}
              onChange={handleScratchpadChange}
            />
          </div>
        )}
      </div>
    </div>
  );
};
