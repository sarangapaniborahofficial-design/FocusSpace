import { useSyncExternalStore } from 'react';
import { toast } from './toast';

export interface PipHUDState {
  isOpen: boolean;
  isExpanded: boolean;
  isSupported: boolean;
  pipWindow: Window | null;
}

class PipHUDManager {
  private pipWindow: Window | null = null;
  private isExpanded: boolean = false;
  private observer: MutationObserver | null = null;
  private listeners: Set<() => void> = new Set();
  private snapshot: PipHUDState;

  constructor() {
    this.snapshot = {
      isOpen: false,
      isExpanded: false,
      isSupported: this.isSupported(),
      pipWindow: null,
    };
  }

  isSupported(): boolean {
    return typeof window !== 'undefined' && 'documentPictureInPicture' in window;
  }

  getState(): PipHUDState {
    return this.snapshot;
  }

  private updateSnapshot() {
    const nextIsOpen = this.pipWindow !== null && !this.pipWindow.closed;
    const nextIsSupported = this.isSupported();
    if (
      this.snapshot.isOpen === nextIsOpen &&
      this.snapshot.isExpanded === this.isExpanded &&
      this.snapshot.isSupported === nextIsSupported &&
      this.snapshot.pipWindow === this.pipWindow
    ) {
      return;
    }
    this.snapshot = {
      isOpen: nextIsOpen,
      isExpanded: this.isExpanded,
      isSupported: nextIsSupported,
      pipWindow: this.pipWindow,
    };
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(l => l());
  }

  async open(expanded = false): Promise<boolean> {
    if (!this.isSupported()) {
      toast('Always-on-Top Floating HUD requires a modern Chromium browser (Chrome, Edge, Brave, Arc).', 'info', { duration: 5000 });
      return false;
    }

    if (this.pipWindow && !this.pipWindow.closed) {
      this.pipWindow.focus();
      if (this.isExpanded !== expanded) {
        this.setExpanded(expanded);
      }
      return true;
    }

    try {
      this.isExpanded = expanded;
      const width = expanded ? 320 : 300;
      const height = expanded ? 260 : 84;

      const pip = await (window as any).documentPictureInPicture.requestWindow({
        width,
        height,
      });

      this.pipWindow = pip;

      // Copy stylesheets from main window
      this.copyStyles(pip);

      // Sync theme & font
      this.syncTheme(pip);
      this.startThemeObserver(pip);

      // Window closing cleanup
      pip.addEventListener('pagehide', () => {
        this.cleanup();
      });

      this.updateSnapshot();
      return true;
    } catch (err: any) {
      console.warn('Could not open Document PiP window:', err);
      toast('Could not open Always-on-Top Floating HUD.', 'error');
      this.cleanup();
      return false;
    }
  }

  close() {
    if (this.pipWindow && !this.pipWindow.closed) {
      this.pipWindow.close();
    }
    this.cleanup();
  }

  setExpanded(expanded: boolean) {
    if (this.isExpanded === expanded) return;
    this.isExpanded = expanded;
    if (this.pipWindow && !this.pipWindow.closed) {
      try {
        const targetW = expanded ? 320 : 300;
        const targetH = expanded ? 260 : 84;
        this.pipWindow.resizeTo(targetW, targetH);
      } catch {
        /* resize may be constrained by OS */
      }
    }
    this.updateSnapshot();
  }

  toggleExpanded() {
    this.setExpanded(!this.isExpanded);
  }

  private copyStyles(targetWindow: Window) {
    const targetDoc = targetWindow.document;

    // Reset default margin/padding
    targetDoc.body.style.margin = '0';
    targetDoc.body.style.padding = '0';
    targetDoc.body.style.overflow = 'hidden';
    targetDoc.body.style.background = 'var(--c-canvas, #040404)';
    targetDoc.body.style.userSelect = 'none';

    // Clone all stylesheets
    Array.from(document.styleSheets).forEach((sheet) => {
      try {
        const rules = Array.from(sheet.cssRules)
          .map((r) => r.cssText)
          .join('\n');
        const style = targetDoc.createElement('style');
        style.textContent = rules;
        targetDoc.head.appendChild(style);
      } catch {
        // Cross-origin fallback
        if (sheet.href) {
          const link = targetDoc.createElement('link');
          link.rel = 'stylesheet';
          link.href = sheet.href;
          targetDoc.head.appendChild(link);
        }
      }
    });
  }

  private syncTheme(targetWindow: Window) {
    const mainHtml = document.documentElement;
    const targetHtml = targetWindow.document.documentElement;
    const currentTheme = mainHtml.getAttribute('data-theme') || 'solaris';
    targetHtml.setAttribute('data-theme', currentTheme);
    targetHtml.className = mainHtml.className;
    targetWindow.document.body.style.background = 'var(--c-canvas)';
  }

  private startThemeObserver(targetWindow: Window) {
    if (this.observer) this.observer.disconnect();

    this.observer = new MutationObserver(() => {
      if (this.pipWindow && !this.pipWindow.closed) {
        this.syncTheme(this.pipWindow);
      }
    });

    this.observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class'],
    });
  }

  private cleanup() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.pipWindow = null;
    this.updateSnapshot();
  }
}

export const pipHUD = new PipHUDManager();

export function usePipHUD(): PipHUDState {
  return useSyncExternalStore(
    onStoreChange => pipHUD.subscribe(onStoreChange),
    () => pipHUD.getState()
  );
}
