import { X } from 'lucide-react';
import { dismissToast, useToasts } from '../lib/toast';

const dot = { info: 'bg-zinc-50 dark:bg-zinc-900/500', success: 'bg-emerald-400', error: 'bg-rose-500' } as const;

export function Toaster() {
  const items = useToasts();
  return (
    <div className="fixed top-[72px] left-1/2 -translate-x-1/2 z-[70] w-[min(92vw,420px)] flex flex-col gap-2 pointer-events-none" role="status" aria-live="polite">
      {items.map(t => (
        <div key={t.id} className="toast-in pointer-events-none flex items-center gap-3 rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-900/50 px-4 py-3 text-sm shadow-2xl shadow-black/40">
          <span className={`size-2 rounded-full shrink-0 ${dot[t.kind]}`} />
          <span className="flex-1 min-w-0 text-zinc-700 dark:text-zinc-200 dark:text-zinc-600">{t.message}</span>
          {t.action && (
            <button onClick={() => { t.action?.run(); dismissToast(t.id); }} className="pointer-events-auto shrink-0 font-medium text-zinc-900 dark:text-zinc-100 hover:underline">{t.action.label}</button>
          )}
          <button onClick={() => dismissToast(t.id)} aria-label="Dismiss" className="pointer-events-auto shrink-0 text-zinc-300 dark:text-zinc-500 hover:text-zinc-600 dark:text-zinc-300 dark:text-zinc-500"><X size={14} /></button>
        </div>
      ))}
    </div>
  );
}
