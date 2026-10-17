import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/** Friendly "nothing here yet" block: says what is empty and what to do about it. */
export function EmptyState({ icon: Icon, title, text, action, compact }: { icon: LucideIcon; title: string; text?: string; action?: ReactNode; compact?: boolean }) {
  return (
    <div className={`flex flex-col items-center text-center px-6 ${compact ? 'py-6' : 'py-12'}`}>
      <div className="size-11 rounded-xl border border-line bg-surface-2 grid place-items-center text-fg-muted mb-3"><Icon size={19} /></div>
      <div className="text-sm font-medium text-fg-soft">{title}</div>
      {text && <p className="text-sm text-fg-muted mt-1 max-w-xs">{text}</p>}
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

function explainReactError(msg: string): { title: string; detail: string; isLoop: boolean } {
  if (msg.includes('185') || msg.toLowerCase().includes('maximum update depth')) {
    return {
      title: 'Render Loop Guard Triggered',
      detail: 'A component repeatedly triggered state updates during render (React Error #185). The view was automatically halted to protect system resources and prevent UI freeze.',
      isLoop: true,
    };
  }
  if (msg.includes('31') || msg.toLowerCase().includes('objects are not valid as a react child')) {
    return {
      title: 'Render Formatting Mismatch',
      detail: 'An object or unsupported data structure was passed to the view template (React Error #31).',
      isLoop: false,
    };
  }
  if (msg.includes('310') || msg.toLowerCase().includes('usesyncexternalstore')) {
    return {
      title: 'External Store Desync Protected',
      detail: 'An external store snapshot mutated asynchronously during the render phase.',
      isLoop: true,
    };
  }
  return {
    title: 'This view ran into a problem',
    detail: msg || 'An unexpected runtime error occurred.',
    isLoop: false,
  };
}

/** Keeps one broken view from blanking the whole app. Local data is untouched. */
export class ErrorBoundary extends Component<
  { children: ReactNode; onReset?: () => void; fallbackTitle?: string },
  { error: Error | null; retryCount: number; lastRetry: number }
> {
  state: { error: Error | null; retryCount: number; lastRetry: number } = {
    error: null,
    retryCount: 0,
    lastRetry: 0,
  };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[FocusSpace View Guard]', error, info.componentStack);
  }

  handleRetry = () => {
    const now = Date.now();
    const count = now - this.state.lastRetry < 3000 ? this.state.retryCount + 1 : 1;
    this.setState({ error: null, retryCount: count, lastRetry: now });
  };

  handleReset = () => {
    this.setState({ error: null, retryCount: 0, lastRetry: 0 });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.error) return this.props.children;
    const { title, detail } = explainReactError(this.state.error.message || '');
    const isRepeated = this.state.retryCount >= 3;

    return (
      <div className="p-8 max-w-lg mx-auto text-center pt-20 animate-in fade-in duration-300" role="alert">
        <div className="size-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 grid place-items-center mx-auto mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h1 className="text-lg font-bold text-fg tracking-tight">{this.props.fallbackTitle || title}</h1>
        <p className="text-sm text-fg-muted mt-2">{detail}</p>
        <p className="text-[11px] text-fg-subtle mt-3 font-mono break-all px-3 py-2 rounded-xl bg-surface-2 border border-line select-all">
          {this.state.error.message}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2.5">
          {!isRepeated && (
            <button
              onClick={this.handleRetry}
              className="h-9 px-4 rounded-xl border border-line bg-surface-2 hover:bg-hover text-fg text-xs font-semibold keycap transition cursor-pointer"
            >
              Try Again
            </button>
          )}
          <button
            onClick={this.handleReset}
            className="h-9 px-4 rounded-xl bg-accent text-accent-fg hover:bg-accent-hover text-xs font-semibold keycap shadow-xs transition cursor-pointer"
          >
            Go to Safe Home
          </button>
          {isRepeated && (
            <button
              onClick={() => window.location.reload()}
              className="h-9 px-4 rounded-xl border border-line bg-surface text-fg-muted hover:text-fg text-xs font-medium transition cursor-pointer"
            >
              Reload Workspace
            </button>
          )}
        </div>
      </div>
    );
  }
}

/** Top-level guardrail protecting the whole DOM tree from unmounting into a blank void */
export class RootErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null; copied: boolean }
> {
  state: { error: Error | null; copied: boolean } = { error: null, copied: false };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[FocusSpace Root Safe Guard]', error, info.componentStack);
  }

  handleCopy = () => {
    if (!this.state.error) return;
    const text = `FocusSpace Crash Report\nError: ${this.state.error.name}: ${this.state.error.message}\nStack: ${this.state.error.stack || 'No stack'}`;
    void navigator.clipboard?.writeText(text);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  };

  handleReload = () => {
    window.location.reload();
  };

  handleHardReset = () => {
    try {
      sessionStorage.clear();
      localStorage.removeItem('focusspace-ambient-track');
    } catch {}
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    const { title, detail } = explainReactError(this.state.error.message || '');

    return (
      <div className="fixed inset-0 z-[9999] bg-canvas text-fg grid place-items-center p-6 select-none">
        <div className="max-w-md w-full atelier-card rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-pop border border-line-strong pop-in">
          <div className="size-14 rounded-2xl bg-accent text-accent-fg grid place-items-center mx-auto shadow-md keycap">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-fg">FocusSpace Emergency Recovery</h1>
            <p className="text-xs text-accent-text font-mono uppercase mt-0.5">{title}</p>
          </div>
          <p className="text-xs text-fg-muted leading-relaxed">
            {detail} Your Dexie database, tasks, journal archives, and habits are safe and untouched on disk.
          </p>
          <div className="p-3 rounded-2xl bg-surface-2 border border-line text-left">
            <div className="text-[10px] font-mono uppercase text-fg-subtle mb-1">Diagnostic Signature</div>
            <div className="text-xs font-mono text-fg-muted break-all max-h-24 overflow-y-auto select-all">
              {this.state.error.message}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button
              onClick={this.handleReload}
              className="flex-1 h-10 rounded-xl bg-accent text-accent-fg text-xs font-semibold hover:bg-accent-hover keycap shadow-sm transition cursor-pointer"
            >
              Restart Workspace
            </button>
            <button
              onClick={this.handleCopy}
              className="flex-1 h-10 rounded-xl border border-line bg-surface hover:bg-hover text-fg text-xs font-medium transition cursor-pointer"
            >
              {this.state.copied ? 'Copied to Clipboard!' : 'Copy Diagnostic'}
            </button>
          </div>
          <button
            onClick={this.handleHardReset}
            className="text-[11px] text-fg-subtle hover:text-fg underline pt-1 cursor-pointer block mx-auto"
          >
            Clear Session Cache & Restart
          </button>
        </div>
      </div>
    );
  }
}

/** Small confirmation dialog. Escape or a click outside cancels. */
export function ConfirmDialog({ title, text, children, confirmLabel, cancelLabel = 'Cancel', danger, onConfirm, onCancel }: {
  title: string; text?: string; children?: React.ReactNode; confirmLabel: string; cancelLabel?: string; danger?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onCancel]);
  return (
    <div className="fade-in fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm grid place-items-center p-4" onMouseDown={onCancel}>
      <div role="dialog" aria-modal="true" aria-label={title} onMouseDown={e => e.stopPropagation()} className="pop-in w-full max-w-md rounded-2xl border border-line bg-surface shadow-2xl p-5">
        <h2 className="font-semibold">{title}</h2>
        {text && <p className="text-sm text-fg-muted mt-2">{text}</p>}
        {children}
        <div className="mt-5 flex justify-end gap-2">
          <button autoFocus onClick={onCancel} className="h-8 px-3 rounded-xl text-sm text-fg-muted hover:bg-hover">{cancelLabel}</button>
          <button onClick={onConfirm} className={`h-8 px-3 rounded-xl text-sm font-semibold keycap ${danger ? 'bg-rose-500 text-white hover:bg-rose-600' : 'bg-accent text-accent-fg hover:bg-accent-hover'}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
