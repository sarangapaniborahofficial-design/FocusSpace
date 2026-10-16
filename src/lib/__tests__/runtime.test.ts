import { describe, it, expect, afterEach } from 'vitest';
import { isElectron, isDesktop, isTauri, isWeb, isVoiceEnabled, getElectronAPI, ElectronAPI } from '../runtime';

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

  it('reports false for isElectron() and isDesktop(), true for isWeb() in standard web/node environment', () => {
    (globalThis as any).window = {};
    expect(isElectron()).toBe(false);
    expect(isDesktop()).toBe(false);
    expect(isTauri()).toBe(false);
    expect(isWeb()).toBe(true);
    expect(isVoiceEnabled()).toBe(true);
    expect(getElectronAPI()).toBeUndefined();
  });

  it('reports true for isElectron() and isDesktop() when window.electronAPI is present', () => {
    const mockAPI = { isElectron: true } as ElectronAPI;
    (globalThis as any).window = { electronAPI: mockAPI };
    expect(isElectron()).toBe(true);
    expect(isDesktop()).toBe(true);
    expect(isTauri()).toBe(true);
    expect(isWeb()).toBe(false);
    expect(isVoiceEnabled()).toBe(true);
    expect(getElectronAPI()).toBe(mockAPI);
  });
});
