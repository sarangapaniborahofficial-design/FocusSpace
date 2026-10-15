import { Command, Keyboard, X } from 'lucide-react';
import { useEffect } from 'react';

interface ShortcutGroup {
  category: string;
  shortcuts: { keys: string[]; description: string }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    category: 'Essential',
    shortcuts: [
      { keys: ['Ctrl', 'K'], description: 'Open search & command palette' },
      { keys: ['Ctrl', 'N'], description: 'Quick add a new task' },
      { keys: ['Ctrl', '/'], description: 'Open keyboard shortcuts cheatsheet' },
      { keys: ['Esc'], description: 'Close modals, drawers, or command palette' },
    ],
  },
  {
    category: 'Focus & Productivity',
    shortcuts: [
      { keys: ['Space'], description: 'Start / Pause Pomodoro timer (when outside text inputs)' },
    ],
  },
  {
    category: 'Fast Navigation',
    shortcuts: [
      { keys: ['Ctrl', '1'], description: 'Go to Today / Focus dashboard' },
      { keys: ['Ctrl', '2'], description: 'Go to Calendar' },
      { keys: ['Ctrl', '3'], description: 'Go to Knowledge Pages' },
      { keys: ['Ctrl', '4'], description: 'Go to Analytics' },
      { keys: ['Ctrl', '5'], description: 'Go to Weekly Review' },
      { keys: ['Ctrl', 'J'], description: 'Go to Daily Journal' },
    ],
  },
];

export function ShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

  return (
    <div
      className="fade-in fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-modal-title"
        onMouseDown={e => e.stopPropagation()}
        className="pop-in w-full max-w-lg rounded-2xl border border-line bg-surface shadow-2xl p-6"
      >
        <div className="flex items-center justify-between pb-4 border-b border-line mb-5">
          <div className="flex items-center gap-2.5">
            <span className="size-9 rounded-xl bg-accent/15 text-accent grid place-items-center">
              <Keyboard size={18} />
            </span>
            <div>
              <h2 id="shortcuts-modal-title" className="font-semibold text-base text-fg">Keyboard Shortcuts</h2>
              <p className="text-xs text-fg-muted mt-0.5">Quickly navigate and control your workspace</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
            className="size-8 rounded-lg grid place-items-center text-fg-subtle hover:text-fg hover:bg-hover transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
          {SHORTCUT_GROUPS.map(group => (
            <div key={group.category}>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle mb-2.5">
                {group.category}
              </h3>
              <div className="space-y-2">
                {group.shortcuts.map(s => (
                  <div
                    key={s.description}
                    className="flex items-center justify-between text-sm py-1.5 px-2.5 rounded-lg hover:bg-surface-2 transition-colors"
                  >
                    <span className="text-fg-soft text-xs sm:text-sm">{s.description}</span>
                    <div className="flex items-center gap-1 shrink-0 ml-3">
                      {s.keys.map(k => (
                        <kbd
                          key={k}
                          className="px-2 py-0.5 text-xs font-mono font-medium rounded-md border border-line bg-surface-2 text-fg shadow-xs"
                        >
                          {k === 'Ctrl' && isMac ? '⌘' : k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-line flex items-center justify-between text-xs text-fg-muted">
          <span>Press <kbd className="font-mono text-[11px] px-1.5 py-0.5 rounded border border-line bg-surface-2 text-fg">Esc</kbd> to close</span>
          <button
            onClick={onClose}
            className="h-8 px-3 rounded-xl bg-accent text-accent-fg font-medium text-xs hover:bg-accent-hover transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
