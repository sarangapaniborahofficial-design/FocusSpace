import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isTauri, isWeb } from '../runtime';

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

  it('reports false for isTauri() and true for isWeb() in standard web/node environment', () => {
    (globalThis as any).window = {};
    expect(isTauri()).toBe(false);
    expect(isWeb()).toBe(true);
  });

  it('reports true for isTauri() and false for isWeb() when __TAURI_INTERNALS__ is present', () => {
    (globalThis as any).window = { __TAURI_INTERNALS__: { version: '2.0.0' } };
    expect(isTauri()).toBe(true);
    expect(isWeb()).toBe(false);
  });

  it('reports true for isTauri() when __TAURI__ is present', () => {
    (globalThis as any).window = { __TAURI__: {} };
    expect(isTauri()).toBe(true);
    expect(isWeb()).toBe(false);
  });
});
