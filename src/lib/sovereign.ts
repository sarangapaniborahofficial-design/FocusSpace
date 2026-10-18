import { getElectronAPI, isElectron, type SovereignStatus } from './runtime';
import { exportFullBackup, importFullBackup, type ImportResult } from './backup';

export const REQUIRE_KEYFILE_KEY = 'focusspace-require-keyfile';
export const LAST_SOVEREIGN_MIRROR_KEY = 'focusspace-last-sovereign-mirror';

export function isKeyfileRequired(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(REQUIRE_KEYFILE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setKeyfileRequired(required: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(REQUIRE_KEYFILE_KEY, String(required));
  } catch {}
}

export function getLastMirrorTime(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(LAST_SOVEREIGN_MIRROR_KEY);
  } catch {
    return null;
  }
}

export function setLastMirrorTime(iso: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LAST_SOVEREIGN_MIRROR_KEY, iso);
  } catch {}
}

export async function getSovereignStatus(): Promise<SovereignStatus> {
  const api = getElectronAPI();
  if (api?.sovereignStatus) {
    return api.sovereignStatus();
  }
  return {
    hasKeyFile: false,
    keyFingerprint: null,
    keyPath: '~/.focusspace-sovereign/focusspace.sovereign.key',
    hasEncryptedVault: false,
  };
}

export async function initSovereignKey(): Promise<{ keyHex: string; fingerprint: string }> {
  const api = getElectronAPI();
  if (!api?.sovereignInitKey) {
    throw new Error('Sovereign Master Key generation requires native Electron runtime.');
  }
  return api.sovereignInitKey();
}

export async function importSovereignKey(keyHex?: string): Promise<{ success: boolean; fingerprint?: string; error?: string }> {
  const api = getElectronAPI();
  if (!api?.sovereignImportKey) {
    return { success: false, error: 'Sovereign key import requires native Electron runtime.' };
  }
  return api.sovereignImportKey(keyHex);
}

export async function getSovereignKeyHex(): Promise<string | null> {
  const api = getElectronAPI();
  if (!api?.sovereignGetKey) return null;
  const res = await api.sovereignGetKey();
  return res.keyHex;
}

export async function exportSovereignKey(): Promise<{ exported: boolean; path?: string; error?: string }> {
  const api = getElectronAPI();
  if (!api?.sovereignExportKey) {
    return { exported: false, error: 'Keyfile export requires native Electron runtime.' };
  }
  return api.sovereignExportKey();
}

/**
 * Encrypts current local workspace and writes latest-vault.fsenc atomically into ~/.focusspace-sovereign/Vault/
 */
export async function mirrorVaultToSovereign(): Promise<{ success: boolean; path?: string; sizeBytes?: number; error?: string }> {
  const api = getElectronAPI();
  if (!api?.sovereignEncryptVault) {
    return { success: false, error: 'Sovereign encryption requires native Electron runtime.' };
  }

  try {
    const payloadJson = await exportFullBackup();
    const res = await api.sovereignEncryptVault(payloadJson);
    if (res.success) {
      setLastMirrorTime(new Date().toISOString());
    }
    return res;
  } catch (err: any) {
    return { success: false, error: err.message || 'Encryption failed' };
  }
}

/**
 * Reads and decrypts latest-vault.fsenc from ~/.focusspace-sovereign/Vault/ and restores database.
 */
export async function restoreFromSovereignVault(): Promise<ImportResult> {
  const api = getElectronAPI();
  if (!api?.sovereignDecryptVault) {
    return {
      success: false,
      imported: { categories: 0, tasks: 0, habits: 0, goals: 0, focusLogs: 0, pages: 0, journalEntries: 0, pageLinks: 0, files: 0, fileBlobs: 0 },
      skipped: {},
      error: 'Sovereign restore requires native Electron desktop runtime.',
    };
  }

  const res = await api.sovereignDecryptVault();
  if (!res.success || !res.payloadJson) {
    return {
      success: false,
      imported: { categories: 0, tasks: 0, habits: 0, goals: 0, focusLogs: 0, pages: 0, journalEntries: 0, pageLinks: 0, files: 0, fileBlobs: 0 },
      skipped: {},
      error: res.error || 'Failed to decrypt sovereign vault backup.',
    };
  }

  return importFullBackup(res.payloadJson);
}
