import { useSyncExternalStore } from 'react';
import { toast } from './toast';
import { isTauri } from './runtime';
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
    if (isTauri()) return true;
    return typeof window !== 'undefined' && 'documentPictureInPicture' in window;
  }

  getState(): PipHUDState {
    return this.snapshot;
  }

  private updateSnapshot() {
    const nextIsOpen = isTauri()
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

    // Tauri native window adapter
    if (isTauri()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        this.isExpanded = expanded;
        await invoke('hud_set_expanded', { expanded });
        await invoke('hud_show');
        this.nativeOpen = true;
        this.updateSnapshot();
        hudBridge.send({ type: 'RESIZE_HUD', v: 1, expanded });
        return true;
      } catch (err) {
        try {
          const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
          const { LogicalSize } = await import('@tauri-apps/api/dpi');
          const hudWin = await WebviewWindow.getByLabel('floating-hud');
          if (hudWin) {
            this.isExpanded = expanded;
            await hudWin.setSize(new LogicalSize(320, expanded ? 290 : 76));
            await hudWin.show();
            await hudWin.unminimize();
            await hudWin.setFocus();
            this.nativeOpen = true;
            this.updateSnapshot();
            hudBridge.send({ type: 'RESIZE_HUD', v: 1, expanded });
            return true;
          }
        } catch (fallbackErr) {
          console.warn('Could not open native floating-hud window:', fallbackErr);
          toast('Could not open Always-on-Top Floating HUD.', 'error');
          return false;
        }
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
    if (isTauri()) {
      import('@tauri-apps/api/core').then(async ({ invoke }) => {
        try {
          await invoke('hud_hide');
          this.nativeOpen = false;
          this.updateSnapshot();
        } catch {
          const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
          const hudWin = await WebviewWindow.getByLabel('floating-hud');
          if (hudWin) {
            await hudWin.hide();
            this.nativeOpen = false;
            this.updateSnapshot();
          }
        }
      });
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

    if (isTauri()) {
      hudBridge.send({ type: 'RESIZE_HUD', v: 1, expanded });
      import('@tauri-apps/api/core').then(async ({ invoke }) => {
        try {
          await invoke('hud_set_expanded', { expanded });
        } catch {
          const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
          const { LogicalSize } = await import('@tauri-apps/api/dpi');
          const hudWin = await WebviewWindow.getByLabel('floating-hud');
          if (hudWin) {
            await hudWin.setSize(new LogicalSize(320, expanded ? 290 : 76));
          }
        }
      });
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

    targetDoc.body.style.margin = '0';
    targetDoc.body.style.padding = '0';
    targetDoc.body.style.overflow = 'hidden';
    targetDoc.body.style.background = 'var(--c-canvas, #040404)';
    targetDoc.body.style.userSelect = 'none';

    Array.from(document.styleSheets).forEach((sheet) => {
      try {
        const rules = Array.from(sheet.cssRules)
          .map((r) => r.cssText)
          .join('\n');
        const style = targetDoc.createElement('style');
        style.textContent = rules;
        targetDoc.head.appendChild(style);
      } catch {
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
    this.nativeOpen = false;
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
