import { useSyncExternalStore } from 'react';

export type ToastKind = 'info' | 'success' | 'error';
export interface ToastAction { label: string; run: () => void; }
export interface ToastItem { id: number; message: string; kind: ToastKind; action?: ToastAction; }

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());

export function dismissToast(id: number) {
  const next = items.filter(t => t.id !== id);
  if (next.length !== items.length) { items = next; emit(); }
}

/** Fire-and-forget notification, callable from anywhere (components, the timer, db helpers). */
export function toast(message: string, kind: ToastKind = 'info', options: { action?: ToastAction; duration?: number } = {}) {
  const id = nextId++;
  items = [...items.slice(-2), { id, message, kind, action: options.action }];
  emit();
  window.setTimeout(() => dismissToast(id), options.duration ?? (options.action ? 6500 : 3800));
  return id;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
const snapshot = () => items;

export const useToasts = () => useSyncExternalStore(subscribe, snapshot, snapshot);
