import { useSyncExternalStore } from 'react';

/** Which task the editor drawer is open on (null = closed). Lives outside React so any view can open it. */
let target: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

export function openTaskEditor(taskId: string) { if (target !== taskId) { target = taskId; emit(); } }
export function closeTaskEditor() { if (target !== null) { target = null; emit(); } }

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
const snapshot = () => target;
export const useTaskEditorTarget = () => useSyncExternalStore(subscribe, snapshot, snapshot);
