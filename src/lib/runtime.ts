/**
 * FocusSpace Runtime Environment Detector
 *
 * Distinguishes between native Tauri desktop shell and browser / PWA environments.
 * Tauri injects `window.__TAURI_INTERNALS__` (or `window.__TAURI__`) into the webview.
 *
 * All native features must route through this check to maintain full web/PWA/Android fallback.
 */

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
    __TAURI__?: unknown;
  }
}

/**
 * Returns true if running inside the native Tauri desktop environment.
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);
}

/**
 * Returns true if running as a browser web application or PWA.
 */
export function isWeb(): boolean {
  return !isTauri();
}
