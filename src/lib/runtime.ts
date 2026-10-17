/**
 * FocusSpace Runtime Environment Detector
 *
 * Distinguishes between native Electron desktop shell and browser / PWA environments.
 * Electron injects `window.electronAPI` into the window via preload.cjs.
 */

export interface ElectronAPI {
  isElectron: boolean;
  writeSnapshot: (filename: string, payload: string) => Promise<{ success: boolean; path: string }>;
  listSnapshots: () => Promise<Array<{ filename: string; sizeBytes: number; updatedAt: string }>>;
  readSnapshot: (filename: string) => Promise<string>;
  getBackupDir: () => Promise<string>;
  showHud: (expanded?: boolean) => Promise<boolean>;
  hideHud: () => Promise<boolean>;
  toggleHud: () => Promise<boolean>;
  resizeHud: (expanded: boolean) => Promise<{ width: number; height: number }>;
  isHudVisible: () => Promise<boolean>;
  showMainWindow: () => void;
  toggleFullscreen: () => Promise<boolean>;
  isFullscreen: () => Promise<boolean>;
  quitApp: () => Promise<void>;
  minimizeToTray: () => Promise<boolean>;
  openExternal: (url: string) => Promise<{ opened: boolean }>;
  openInBrowser: (url: string, browser?: string) => Promise<{ opened: boolean; fallback?: boolean }>;
  launchNativeApp: (path: string) => Promise<{ launched: boolean }>;
  pickAppFile: () => Promise<string | null>;
  getSystemApps: () => Promise<SystemAppsResponse>;
}

export interface SystemAppUsage {
  name: string;
  displayName: string;
  title?: string;
  seconds: number;
  category: string;
  isCurrent?: boolean;
}

export interface SystemAppsResponse {
  supported: boolean;
  activeApp?: string;
  activeTitle?: string;
  apps: SystemAppUsage[];
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
    __TAURI_INTERNALS__?: unknown;
    __TAURI__?: unknown;
  }
}

/**
 * Returns the Electron API bridge if running in Electron desktop.
 */
export function getElectronAPI(): ElectronAPI | undefined {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI;
  }
  return undefined;
}

/**
 * Returns true if running inside the native Electron desktop environment.
 */
export function isElectron(): boolean {
  return typeof window !== 'undefined' && Boolean(window.electronAPI?.isElectron);
}

/**
 * Returns true if running in native desktop environment.
 */
export function isDesktop(): boolean {
  return isElectron();
}

/**
 * Legacy alias for backwards compatibility across existing components.
 */
export function isTauri(): boolean {
  return isElectron();
}

/**
 * Returns true if running as a browser web application or PWA.
 */
export function isWeb(): boolean {
  return !isDesktop();
}

/**
 * Returns true if voice dictation is enabled for the current runtime environment.
 * FocusSpace includes 100% offline, privacy-first voice dictation across both
 * native desktop and PWA environments.
 */
export function isVoiceEnabled(): boolean {
  return true;
}
