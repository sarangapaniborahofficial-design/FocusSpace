import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isNativeFilePath, normalizeWebUrl, detectLaunchKind, launchTarget } from '../launcher';
import type { ElectronAPI } from '../runtime';

describe('launcher module', () => {
  describe('isNativeFilePath', () => {
    it('detects Windows absolute paths', () => {
      expect(isNativeFilePath('C:\\Program Files\\App\\app.exe')).toBe(true);
      expect(isNativeFilePath('D:/Games/game.exe')).toBe(true);
      expect(isNativeFilePath('\\\\server\\share\\app.bat')).toBe(true);
    });

    it('detects native executable extensions', () => {
      expect(isNativeFilePath('notepad.exe')).toBe(true);
      expect(isNativeFilePath('shortcut.lnk')).toBe(true);
      expect(isNativeFilePath('script.bat')).toBe(true);
      expect(isNativeFilePath('run.cmd')).toBe(true);
    });

    it('does not treat web urls or custom schemes as native file paths', () => {
      expect(isNativeFilePath('https://google.com')).toBe(false);
      expect(isNativeFilePath('vscode://file/')).toBe(false);
      expect(isNativeFilePath('spotify://')).toBe(false);
    });
  });

  describe('normalizeWebUrl', () => {
    it('adds https to bare domains', () => {
      expect(normalizeWebUrl('linear.app')).toBe('https://linear.app');
      expect(normalizeWebUrl('youtube.com')).toBe('https://youtube.com');
    });

    it('preserves existing protocols', () => {
      expect(normalizeWebUrl('https://example.com')).toBe('https://example.com');
      expect(normalizeWebUrl('http://insecure.org')).toBe('http://insecure.org');
    });

    it('uses http for localhost', () => {
      expect(normalizeWebUrl('localhost:3000')).toBe('http://localhost:3000');
      expect(normalizeWebUrl('127.0.0.1:8080')).toBe('http://127.0.0.1:8080');
    });
  });

  describe('detectLaunchKind', () => {
    it('detects file kind', () => {
      expect(detectLaunchKind('C:\\Windows\\notepad.exe')).toBe('file');
      expect(detectLaunchKind('file:///path/to/doc')).toBe('file');
    });

    it('detects web kind', () => {
      expect(detectLaunchKind('https://github.com')).toBe('web');
      expect(detectLaunchKind('chatgpt.com')).toBe('web');
      expect(detectLaunchKind('localhost:5173')).toBe('web');
    });

    it('detects app kind for custom uri schemes', () => {
      expect(detectLaunchKind('spotify://play')).toBe('app');
      expect(detectLaunchKind('vscode://file/')).toBe('app');
      expect(detectLaunchKind('slack://open')).toBe('app');
    });
  });

  describe('launchTarget', () => {
    const originalWindow = (globalThis as any).window;

    afterEach(() => {
      (globalThis as any).window = originalWindow;
    });

    it('dispatches to api.launchNativeApp when in desktop mode and given an executable', async () => {
      const launchNativeAppMock = vi.fn().mockResolvedValue(true);
      const mockAPI: Partial<ElectronAPI> = {
        isElectron: true,
        launchNativeApp: launchNativeAppMock,
      };

      (globalThis as any).window = {
        ...originalWindow,
        setTimeout: globalThis.setTimeout.bind(globalThis),
        clearTimeout: globalThis.clearTimeout.bind(globalThis),
        electronAPI: mockAPI,
      };

      const res = await launchTarget('C:\\Windows\\notepad.exe', 'Notepad');
      expect(res).toBe(true);
      expect(launchNativeAppMock).toHaveBeenCalledWith('C:\\Windows\\notepad.exe');
    });

    it('dispatches to api.openInBrowser when in desktop mode and given a web url', async () => {
      const openInBrowserMock = vi.fn().mockResolvedValue(true);
      const mockAPI: Partial<ElectronAPI> = {
        isElectron: true,
        openInBrowser: openInBrowserMock,
      };

      (globalThis as any).window = {
        ...originalWindow,
        setTimeout: globalThis.setTimeout.bind(globalThis),
        clearTimeout: globalThis.clearTimeout.bind(globalThis),
        electronAPI: mockAPI,
        localStorage: {
          getItem: vi.fn().mockReturnValue('chrome'),
        },
      };

      const res = await launchTarget('https://github.com', 'GitHub', 'web', 'chrome');
      expect(res).toBe(true);
      expect(openInBrowserMock).toHaveBeenCalledWith('https://github.com', 'chrome');
    });
  });
});
