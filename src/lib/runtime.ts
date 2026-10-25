/**
 * FocusSpace Runtime Environment Detector
 *
 * Distinguishes between native Electron desktop shell and browser / PWA environments.
 * Electron injects `window.electronAPI` into the window via preload.cjs.
 */

import type { SnapLayoutId } from './snapLayouts';

export interface ElectronAPI {
  isElectron: boolean;
  writeSnapshot: (filename: string, payload: string, secondaryDir?: string) => Promise<{ success: boolean; path: string; secondaryPath?: string | null }>;
  listSnapshots: () => Promise<Array<{ filename: string; sizeBytes: number; updatedAt: string }>>;
  readSnapshot: (filename: string) => Promise<string>;
  getBackupDir: () => Promise<string>;
  pickDirectory?: () => Promise<string | null>;
  showHud: (expanded?: boolean) => Promise<boolean>;
  hideHud: () => Promise<boolean>;
  toggleHud: () => Promise<boolean>;
  resizeHud: (expanded: boolean) => Promise<{ width: number; height: number }>;
  isHudVisible: () => Promise<boolean>;
  onQuickCapture?: (callback: (data: { dictate?: boolean }) => void) => () => void;
  showMainWindow: () => void;
  toggleFullscreen: () => Promise<boolean>;
  isFullscreen: () => Promise<boolean>;
  minimizeWindow: () => Promise<boolean>;
  toggleMaximizeWindow: () => Promise<boolean>;
  snapToLayout?: (layout: SnapLayoutId) => Promise<boolean>;
  isWindowMaximized: () => Promise<boolean>;
  closeWindow: () => Promise<boolean>;
  setTitleBarTheme?: (themeName: string) => Promise<void>;
  onWindowCloseRequested?: (callback: () => void) => () => void;
  onMaximizeChange?: (callback: (isMaximized: boolean) => void) => () => void;
  onMainWindowLifecycle?: (callback: (data: { state: 'minimized' | 'restored' | 'closed' }) => void) => () => void;
  quitApp: () => Promise<void>;
  minimizeToTray: () => Promise<boolean>;
  openExternal: (url: string) => Promise<{ opened: boolean }>;
  openInBrowser: (url: string, browser?: string) => Promise<{ opened: boolean; fallback?: boolean }>;
  launchNativeApp: (path: string) => Promise<{ launched: boolean }>;
  pickAppFile: () => Promise<string | null>;
  getSystemApps: () => Promise<SystemAppsResponse>;
  // Sovereign Master Key & AES-256-GCM Vault
  sovereignStatus: () => Promise<SovereignStatus>;
  sovereignInitKey: () => Promise<{ keyHex: string; fingerprint: string }>;
  sovereignImportKey: (keyHex?: string) => Promise<{ success: boolean; fingerprint?: string; error?: string }>;
  sovereignGetKey: () => Promise<{ keyHex: string | null }>;
  sovereignExportKey: () => Promise<{ exported: boolean; path?: string; error?: string }>;
  sovereignEncryptVault: (payloadJson: string) => Promise<{ success: boolean; path: string; sizeBytes: number }>;
  sovereignDecryptVault: () => Promise<{ success: boolean; payloadJson?: string; error?: string }>;
  // Local AI Administrative Agent (Ollama localhost bridge)
  checkLocalAiStatus?: () => Promise<{ available: boolean; models: string[] }>;
  localAiChat?: (payload: { prompt: string; model?: string; systemPrompt?: string }) => Promise<{ response?: string; model?: string; durationMs?: number; error?: string }>;
}

export interface SovereignStatus {
  hasKeyFile: boolean;
  keyFingerprint: string | null;
  keyPath: string;
  hasEncryptedVault: boolean;
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
  isDistraction?: boolean;
  distractionSeconds?: number;
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

/**
 * Checks if local Ollama runtime is available on 127.0.0.1:11434.
 */
export async function checkLocalAiStatus(): Promise<{ available: boolean; models: string[] }> {
  if (typeof window !== 'undefined' && window.electronAPI?.checkLocalAiStatus) {
    try {
      return await window.electronAPI.checkLocalAiStatus();
    } catch {
      return { available: false, models: [] };
    }
  }
  return { available: false, models: [] };
}

/**
 * Sends a prompt to local Ollama runtime via Electron IPC.
 */
export async function queryLocalAi(payload: { prompt: string; model?: string; systemPrompt?: string }): Promise<{ response?: string; model?: string; durationMs?: number; error?: string }> {
  if (typeof window !== 'undefined' && window.electronAPI?.localAiChat) {
    try {
      return await window.electronAPI.localAiChat(payload);
    } catch (err: any) {
      return { error: err.message || 'Failed to communicate with local AI bridge' };
    }
  }
  return { error: 'Electron desktop environment required for localhost Ollama integration' };
}

/**
 * Snaps the native Electron window to a predefined Windows 11 split-view partition.
 */
export async function snapWindowToLayout(layout: SnapLayoutId): Promise<boolean> {
  if (typeof window !== 'undefined' && window.electronAPI?.snapToLayout) {
    try {
      return await window.electronAPI.snapToLayout(layout);
    } catch {
      return false;
    }
  }
  return false;
}


