import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

export function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered:', r);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!offlineReady && !needRefresh) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 p-4 rounded-xl shadow-lg border border-line bg-surface text-fg flex items-center gap-4 max-w-sm pop-in">
      <div className="flex-1 text-sm font-medium">
        {offlineReady ? (
          <span>App is ready to work offline.</span>
        ) : (
          <span>New content available, click on reload button to update.</span>
        )}
      </div>
      <div className="flex gap-2 shrink-0">
        {needRefresh && (
          <button onClick={() => updateServiceWorker(true)} className="h-8 px-3 rounded-md bg-inv text-on-inv text-xs font-semibold flex items-center gap-1.5 hover:opacity-90">
            <RefreshCw size={14} /> Reload
          </button>
        )}
        <button onClick={close} className="size-8 grid place-items-center rounded-lg border border-line text-fg-muted hover:bg-hover">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
