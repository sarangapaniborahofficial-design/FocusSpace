import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isTauri, isWeb, isVoiceEnabled } from '../runtime';

describe('runtime detector', () => {
  const hadWindow = typeof (globalThis as any).window !== 'undefined';
  const originalWindow = (globalThis as any).window;

  afterEach(() => {
    if (hadWindow) {
      (globalThis as any).window = originalWindow;
    } else {
      delete (globalThis as any).window;
    }
  });

  it('reports false for isTauri(), true for isWeb(), and true for isVoiceEnabled() in standard web/node environment', () => {
    (globalThis as any).window = {};
    expect(isTauri()).toBe(false);
    expect(isWeb()).toBe(true);
    expect(isVoiceEnabled()).toBe(true);
  });

  it('reports true for isTauri(), false for isWeb(), and true for isVoiceEnabled() when __TAURI_INTERNALS__ is present', () => {
    (globalThis as any).window = { __TAURI_INTERNALS__: { version: '2.0.0' } };
    expect(isTauri()).toBe(true);
    expect(isWeb()).toBe(false);
    expect(isVoiceEnabled()).toBe(true);
  });

  it('reports true for isTauri() and true for isVoiceEnabled() when __TAURI__ is present', () => {
    (globalThis as any).window = { __TAURI__: {} };
    expect(isTauri()).toBe(true);
    expect(isWeb()).toBe(false);
    expect(isVoiceEnabled()).toBe(true);
  });
});
