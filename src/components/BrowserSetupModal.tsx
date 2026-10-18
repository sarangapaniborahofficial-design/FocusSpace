import React from 'react';
import { X, Check, Globe } from 'lucide-react';
import { ChromeLogo, EdgeLogo, BraveLogo, FirefoxLogo, WebBrowserLogo } from './BrandIcons';

export interface BrowserOption {
  id: string;
  name: string;
  description: string;
  renderIcon: (size?: number) => React.ReactElement;
}

export const BROWSER_OPTIONS: BrowserOption[] = [
  {
    id: 'system',
    name: 'System Default Browser',
    description: 'Use the default browser currently set in Windows Settings.',
    renderIcon: (size = 22) => <WebBrowserLogo size={size} />,
  },
  {
    id: 'chrome',
    name: 'Google Chrome',
    description: 'Open web apps in Google Chrome (chrome.exe).',
    renderIcon: (size = 22) => <ChromeLogo size={size} />,
  },
  {
    id: 'edge',
    name: 'Microsoft Edge',
    description: 'Open web apps in Microsoft Edge (msedge.exe).',
    renderIcon: (size = 22) => <EdgeLogo size={size} />,
  },
  {
    id: 'brave',
    name: 'Brave Browser',
    description: 'Open web apps in privacy-first Brave (brave.exe).',
    renderIcon: (size = 22) => <BraveLogo size={size} />,
  },
  {
    id: 'firefox',
    name: 'Mozilla Firefox',
    description: 'Open web apps in Mozilla Firefox (firefox.exe).',
    renderIcon: (size = 22) => <FirefoxLogo size={size} />,
  },
];

export function BrowserSetupModal({
  open,
  currentBrowser = 'system',
  onSelect,
  onClose,
}: {
  open: boolean;
  currentBrowser?: string;
  onSelect: (browserId: string) => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl bg-surface border border-line p-5 shadow-2xl keycap space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent-text">
              <Globe size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-fg">Choose Preferred Web Browser</h3>
              <p className="text-[11px] text-fg-subtle">
                Select which browser FocusSpace uses to open web applications and external links.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-fg-subtle hover:text-fg hover:bg-hover transition cursor-pointer"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-2 pt-1">
          {BROWSER_OPTIONS.map((opt) => {
            const isSelected = (currentBrowser || 'system') === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onSelect(opt.id);
                  onClose();
                }}
                className={`w-full p-3 rounded-xl border flex items-center justify-between text-left transition cursor-pointer ${
                  isSelected
                    ? 'border-accent bg-accent/10 shadow-sm'
                    : 'border-line bg-surface-2 hover:border-line-strong hover:bg-hover'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="shrink-0">{opt.renderIcon(24)}</div>
                  <div>
                    <div className="text-xs font-semibold text-fg flex items-center gap-1.5">
                      {opt.name}
                      {opt.id === 'system' && (
                        <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-surface border border-line text-fg-subtle font-mono">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-fg-subtle mt-0.5">{opt.description}</div>
                  </div>
                </div>
                {isSelected && <Check size={16} className="text-accent shrink-0 ml-2" />}
              </button>
            );
          })}
        </div>

        <div className="pt-2 border-t border-line flex items-center justify-between text-[11px] text-fg-subtle">
          <span>You can change this anytime in Settings.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-lg border border-line bg-surface-2 text-fg hover:bg-hover font-semibold cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
