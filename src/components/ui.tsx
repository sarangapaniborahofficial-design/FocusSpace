import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/** Friendly "nothing here yet" block: says what is empty and what to do about it. */
export function EmptyState({ icon: Icon, title, text, action, compact }: { icon: LucideIcon; title: string; text?: string; action?: ReactNode; compact?: boolean }) {
  return (
    <div className={`flex flex-col items-center text-center px-6 ${compact ? 'py-6' : 'py-12'}`}>
      <div className="size-11 rounded-xl border border-zinc-100 bg-zinc-50/70 grid place-items-center text-zinc-400 mb-3"><Icon size={19} /></div>
      <div className="text-sm font-medium text-zinc-700">{title}</div>
      {text && <p className="text-sm text-zinc-400 mt-1 max-w-xs">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Circular progress ring; `value` is 0..1. Colours come from theme variables. */
export function Ring({ value, size = 36, stroke = 4, children }: { value: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} style={{ stroke: 'var(--ring-track)' }} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)} style={{ stroke: 'var(--ring-fill)', transition: 'stroke-dashoffset .5s ease' }} />
      </svg>
      {children && <div className="absolute inset-0 grid place-items-center">{children}</div>}
    </div>
  );
}

/** Keeps one broken view from blanking the whole app. Local data is untouched. */
export class ErrorBoundary extends Component<{ children: ReactNode; onReset?: () => void }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('FocusSpace view crashed:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="p-8 max-w-md mx-auto text-center pt-24" role="alert">
        <h1 className="text-lg font-semibold">This view ran into a problem</h1>
        <p className="text-sm text-zinc-400 mt-2">Your tasks and settings are safe in local storage. Try again, or head back to Home.</p>
        <p className="text-xs text-zinc-300 mt-3 break-words">{this.state.error.message}</p>
        <div className="mt-5 flex justify-center gap-2">
          <button onClick={() => this.setState({ error: null })} className="h-10 px-4 rounded-lg border border-zinc-200 bg-zinc-50 text-sm hover:bg-zinc-100">Try again</button>
          <button onClick={() => { this.setState({ error: null }); this.props.onReset?.(); }} className="h-10 px-4 rounded-lg bg-zinc-900 text-white text-sm font-medium">Go to Home</button>
        </div>
      </div>
    );
  }
}

/** Small confirmation dialog. Escape or a click outside cancels. */
export function ConfirmDialog({ title, text, confirmLabel, cancelLabel = 'Cancel', danger, onConfirm, onCancel }: {
  title: string; text?: string; confirmLabel: string; cancelLabel?: string; danger?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onCancel]);
  return (
    <div className="fade-in fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm grid place-items-center p-4" onMouseDown={onCancel}>
      <div role="dialog" aria-modal="true" aria-label={title} onMouseDown={e => e.stopPropagation()} className="pop-in w-full max-w-sm rounded-2xl border border-zinc-200 bg-white shadow-2xl p-5">
        <h2 className="font-semibold">{title}</h2>
        {text && <p className="text-sm text-zinc-400 mt-2">{text}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button autoFocus onClick={onCancel} className="h-10 px-4 rounded-lg text-sm text-zinc-500 hover:bg-zinc-50">{cancelLabel}</button>
          <button onClick={onConfirm} className={`h-10 px-4 rounded-lg text-sm font-medium ${danger ? 'bg-zinc-400/90 text-white hover:bg-zinc-400' : 'bg-zinc-900 text-white hover:bg-white'}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
