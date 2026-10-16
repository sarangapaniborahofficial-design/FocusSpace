import { useSyncExternalStore } from 'react';
import { toast } from './toast';
import { getElectronAPI, isElectron } from './runtime';
import { hudBridge } from './hudBridge';

export interface PipHUDState {
  isOpen: boolean;
  isExpanded: boolean;
  isSupported: boolean;
  pipWindow: Window | null;
}

class PipHUDManager {
  private pipWindow: Window | null = null;
  private isExpanded: boolean = false;
  private nativeOpen: boolean = false;
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
    if (isElectron()) return true;
    return typeof window !== 'undefined' && 'documentPictureInPicture' in window;
  }

  getState(): PipHUDState {
    return this.snapshot;
  }

  private updateSnapshot() {
    const nextIsOpen = isElectron()
      ? this.nativeOpen
      : (this.pipWindow !== null && !this.pipWindow.closed);
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
      toast('Always-on-Top Floating HUD requires a modern Chromium browser or native desktop app.', 'info', { duration: 5000 });
      return false;
    }

    // Electron native window adapter
    const api = getElectronAPI();
    if (api) {
      try {
        this.isExpanded = expanded;
        await api.showHud(expanded);
        this.nativeOpen = true;
        this.updateSnapshot();
        hudBridge.send({ type: 'RESIZE_HUD', v: 1, expanded });
        return true;
      } catch (err) {
        console.warn('Could not open native floating-hud window:', err);
        toast('Could not open Always-on-Top Floating HUD.', 'error');
        return false;
      }
    }

    // Browser Document Picture-in-Picture adapter
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
    const api = getElectronAPI();
    if (api) {
      void api.hideHud();
      this.nativeOpen = false;
      this.updateSnapshot();
      return;
    }

    if (this.pipWindow && !this.pipWindow.closed) {
      this.pipWindow.close();
    }
    this.cleanup();
  }

  setExpanded(expanded: boolean) {
    if (this.isExpanded === expanded) return;
    this.isExpanded = expanded;

    const api = getElectronAPI();
    if (api) {
      hudBridge.send({ type: 'RESIZE_HUD', v: 1, expanded });
      void api.resizeHud(expanded);
      this.updateSnapshot();
      return;
    }

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

    // Copy style tags & link tags
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach(node => {
      targetDoc.head.appendChild(node.cloneNode(true));
    });

    // Copy inline styles on documentElement/body
    const srcDocEl = document.documentElement;
    const tgtDocEl = targetDoc.documentElement;
    tgtDocEl.className = srcDocEl.className;
    tgtDocEl.dataset.theme = srcDocEl.dataset.theme;

    // Apply transparent base for PiP window frame
    targetDoc.body.style.margin = '0';
    targetDoc.body.style.padding = '0';
    targetDoc.body.style.background = 'transparent';
    targetDoc.body.style.overflow = 'hidden';
  }

  private syncTheme(pipWindow: Window) {
    const currentTheme = document.documentElement.dataset.theme || 'nocturne';
    pipWindow.document.documentElement.dataset.theme = currentTheme;
  }

  private startThemeObserver(pipWindow: Window) {
    this.observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          this.syncTheme(pipWindow);
        }
      });
    });

    this.observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
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
    cb => pipHUD.subscribe(cb),
    () => pipHUD.getState(),
    () => pipHUD.getState()
  );
}
