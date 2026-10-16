/**
 * Cross-Window Floating HUD Bridge
 *
 * Uses BroadcastChannel('focusspace-hud-bus') to synchronize timer and task state
 * between the main application window and the standalone native floating HUD window.
 *
 * The main window owns the timer and writes to Dexie.
 * The HUD window is a lightweight view that broadcasts actions back to the main window.
 */

export interface TimerSnapshot {
  mode: string;
  remainingMs: number;
  totalMs: number;
  durationMinutes?: number;
  running: boolean;
  isOvertime: boolean;
  overtimeMs: number;
  taskId?: string;
  taskTitle?: string;
}

export interface TaskSnapshot {
  id: string;
  title: string;
  notes?: string;
  scratchpadNotes?: string;
  status?: string;
  subtasks?: Array<{ id: string; title: string; completed: boolean }>;
}

export interface TodoItemSnapshot {
  id: string;
  title: string;
  completed: boolean;
  priority?: string;
  categoryName?: string;
}

export interface HudStatePayload {
  type: 'STATE_SYNC';
  v: 1;
  timer: TimerSnapshot;
  activeTask: TaskSnapshot | null;
  todayTasks?: TodoItemSnapshot[];
  theme?: string;
  hudStyleOverride?: string | null;
}

export type HudMessage =
  | HudStatePayload
  | { type: 'REQUEST_SYNC'; v: 1 }
  | { type: 'TOGGLE_TIMER'; v: 1 }
  | { type: 'BANK_OVERTIME'; v: 1 }
  | { type: 'COMPLETE_TASK'; v: 1; taskId: string }
  | { type: 'TOGGLE_TASK'; v: 1; taskId: string }
  | { type: 'ADD_TASK'; v: 1; title: string; priority?: string }
  | { type: 'SET_ACTIVE_TASK'; v: 1; taskId: string }
  | { type: 'COMPLETE_SUBTASK'; v: 1; taskId: string; subtaskId: string }
  | { type: 'ADD_SUBTASK'; v: 1; taskId: string; title: string }
  | { type: 'SAVE_SCRATCHPAD'; v: 1; taskId: string; text: string }
  | { type: 'SHOW_DASHBOARD'; v: 1 }
  | { type: 'CLOSE_HUD'; v: 1 }
  | { type: 'RESIZE_HUD'; v: 1; expanded: boolean };

const CHANNEL_NAME = 'focusspace-hud-bus';

class HudBridge {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<(msg: HudMessage) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel(CHANNEL_NAME);
        this.channel.onmessage = (event: MessageEvent) => {
          const msg = event.data;
          if (msg && typeof msg === 'object' && msg.v === 1 && typeof msg.type === 'string') {
            this.listeners.forEach(l => l(msg as HudMessage));
          }
        };
      } catch (err) {
        console.warn('Failed to initialize BroadcastChannel for HUD bridge:', err);
      }
    }
  }

  send(msg: HudMessage): void {
    if (this.channel) {
      try {
        this.channel.postMessage(msg);
      } catch (err) {
        console.warn('Failed to postMessage on hud bridge:', err);
      }
    }
  }

  subscribe(listener: (msg: HudMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const hudBridge = new HudBridge();

export function subscribeHudBridge(listener: (msg: HudMessage) => void): () => void {
  return hudBridge.subscribe(listener);
}

export function sendHudCommand(msg: HudMessage): void {
  hudBridge.send(msg);
}

export function requestHudSync(): void {
  hudBridge.send({ type: 'REQUEST_SYNC', v: 1 });
}
