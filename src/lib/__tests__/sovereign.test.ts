import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isKeyfileRequired,
  setKeyfileRequired,
  getLastMirrorTime,
  setLastMirrorTime,
  getSovereignStatus,
  initSovereignKey,
  importSovereignKey,
  getSovereignKeyHex,
  exportSovereignKey,
  mirrorVaultToSovereign,
  restoreFromSovereignVault,
  REQUIRE_KEYFILE_KEY,
  LAST_SOVEREIGN_MIRROR_KEY,
} from '../sovereign';

class MockStorage {
  private store: Record<string, string> = {};
  getItem(key: string) {
    return this.store[key] ?? null;
  }
  setItem(key: string, val: string) {
    this.store[key] = String(val);
  }
  removeItem(key: string) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

describe('Sovereign Master Key & Vault Helpers', () => {
  const originalWindow = (globalThis as any).window;
  const originalLocalStorage = (globalThis as any).localStorage;

  beforeEach(() => {
    const storage = new MockStorage();
    (globalThis as any).localStorage = storage;
    (globalThis as any).window = {
      localStorage: storage,
    };
    vi.restoreAllMocks();
  });

  afterEach(() => {
    (globalThis as any).window = originalWindow;
    (globalThis as any).localStorage = originalLocalStorage;
  });

  describe("Dead-Man's Switch Requirement Flags", () => {
    it('defaults to false when key is not set', () => {
      expect(isKeyfileRequired()).toBe(false);
    });

    it('sets and retrieves require keyfile flag', () => {
      setKeyfileRequired(true);
      expect((globalThis as any).localStorage.getItem(REQUIRE_KEYFILE_KEY)).toBe('true');
      expect(isKeyfileRequired()).toBe(true);

      setKeyfileRequired(false);
      expect((globalThis as any).localStorage.getItem(REQUIRE_KEYFILE_KEY)).toBe('false');
      expect(isKeyfileRequired()).toBe(false);
    });

    it('sets and retrieves last mirror timestamp', () => {
      expect(getLastMirrorTime()).toBeNull();
      const iso = '2026-10-18T20:00:00.000Z';
      setLastMirrorTime(iso);
      expect(getLastMirrorTime()).toBe(iso);
      expect((globalThis as any).localStorage.getItem(LAST_SOVEREIGN_MIRROR_KEY)).toBe(iso);
    });
  });

  describe('Non-Electron Fallbacks', () => {
    it('returns default status when running outside Electron', async () => {
      const status = await getSovereignStatus();
      expect(status.hasKeyFile).toBe(false);
      expect(status.keyFingerprint).toBeNull();
      expect(status.hasEncryptedVault).toBe(false);
      expect(status.keyPath).toContain('.focusspace-sovereign');
    });

    it('throws or fails gracefully when native functions called without Electron', async () => {
      await expect(initSovereignKey()).rejects.toThrow('Electron');

      const importRes = await importSovereignKey('abc');
      expect(importRes.success).toBe(false);

      const keyHex = await getSovereignKeyHex();
      expect(keyHex).toBeNull();

      const exportRes = await exportSovereignKey();
      expect(exportRes.exported).toBe(false);

      const mirrorRes = await mirrorVaultToSovereign();
      expect(mirrorRes.success).toBe(false);

      const restoreRes = await restoreFromSovereignVault();
      expect(restoreRes.success).toBe(false);
    });
  });

  describe('Electron Native Sovereign Bridge', () => {
    it('routes sovereignStatus to window.electronAPI', async () => {
      (globalThis as any).window.electronAPI = {
        isElectron: true,
        sovereignStatus: vi.fn().mockResolvedValue({
          hasKeyFile: true,
          keyFingerprint: 'A1B2-C3D4-E5F6',
          keyPath: 'C:\\Users\\User\\.focusspace-sovereign\\focusspace.sovereign.key',
          hasEncryptedVault: true,
        }),
      };

      const status = await getSovereignStatus();
      expect(status.hasKeyFile).toBe(true);
      expect(status.keyFingerprint).toBe('A1B2-C3D4-E5F6');
      expect(status.hasEncryptedVault).toBe(true);
    });

    it('routes sovereignInitKey to window.electronAPI', async () => {
      const mockKeyHex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      (globalThis as any).window.electronAPI = {
        isElectron: true,
        sovereignInitKey: vi.fn().mockResolvedValue({
          keyHex: mockKeyHex,
          fingerprint: '9876-FEDC-BA01',
        }),
      };

      const res = await initSovereignKey();
      expect(res.keyHex).toBe(mockKeyHex);
      expect(res.fingerprint).toBe('9876-FEDC-BA01');
    });

    it('routes sovereignEncryptVault and updates last mirror timestamp', async () => {
      (globalThis as any).window.electronAPI = {
        isElectron: true,
        sovereignEncryptVault: vi.fn().mockResolvedValue({
          success: true,
          path: 'C:\\Users\\User\\.focusspace-sovereign\\Vault\\latest-vault.fsenc',
          sizeBytes: 1024,
        }),
      };

      const res = await mirrorVaultToSovereign();
      expect(res.success).toBe(true);
      expect(getLastMirrorTime()).not.toBeNull();
    });
  });
});
