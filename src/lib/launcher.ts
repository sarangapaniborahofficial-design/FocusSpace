import { toast } from './toast';
import { getElectronAPI } from './runtime';
import type { LaunchKind } from '../types';

export const APP_PRESETS: { label: string; url: string; icon: string; kind: LaunchKind }[] = [
  { label: 'Spotify', url: 'spotify://', icon: 'spotify', kind: 'app' },
  { label: 'YouTube', url: 'https://youtube.com', icon: 'youtube', kind: 'web' },
  { label: 'Discord', url: 'discord://', icon: 'discord', kind: 'app' },
  { label: 'VS Code', url: 'vscode://file/', icon: 'code', kind: 'app' },
  { label: 'Cursor', url: 'cursor://file/', icon: 'cursor', kind: 'app' },
  { label: 'Obsidian', url: 'obsidian://open', icon: 'obsidian', kind: 'app' },
  { label: 'GitHub', url: 'https://github.com', icon: 'github', kind: 'web' },
  { label: 'Figma', url: 'https://figma.com', icon: 'figma', kind: 'app' },
  { label: 'Slack', url: 'slack://open', icon: 'slack', kind: 'app' },
  { label: 'Notion', url: 'https://notion.so', icon: 'notion', kind: 'web' },
  { label: 'ChatGPT', url: 'https://chatgpt.com', icon: 'chatgpt', kind: 'web' },
  { label: 'Claude', url: 'https://claude.ai', icon: 'claude', kind: 'web' },
];

export function isNativeFilePath(target: string): boolean {
  const trimmed = target.trim();
  return (
    /^[a-zA-Z]:[\\\/]/.test(trimmed) ||
    trimmed.startsWith('\\\\') ||
    trimmed.toLowerCase().endsWith('.exe') ||
    trimmed.toLowerCase().endsWith('.lnk') ||
    trimmed.toLowerCase().endsWith('.bat') ||
    trimmed.toLowerCase().endsWith('.cmd')
  );
}

export function normalizeWebUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith('localhost') || trimmed.startsWith('127.0.0.1')) {
    return `http://${trimmed}`;
  }
  return `https://${trimmed}`;
}

export function detectLaunchKind(url: string, explicitKind?: LaunchKind): LaunchKind {
  if (explicitKind) return explicitKind;
  const trimmed = url.trim().toLowerCase();
  if (trimmed.startsWith('file://') || isNativeFilePath(url)) return 'file';
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.includes('.com') ||
    trimmed.includes('.org') ||
    trimmed.includes('.net') ||
    trimmed.includes('.io') ||
    trimmed.includes('.app') ||
    trimmed.includes('.dev') ||
    trimmed.includes('.ai') ||
    trimmed.includes('youtube') ||
    trimmed.includes('github') ||
    trimmed.includes('localhost')
  ) {
    return 'web';
  }
  return 'app';
}

/**
 * Triggers launch of a web link, native Windows file/exe, or desktop URI scheme.
 */
export async function launchTarget(
  url: string,
  label?: string,
  explicitKind?: LaunchKind,
  explicitBrowser?: string
): Promise<boolean> {
  const target = url.trim();
  if (!target) return false;

  const kind = detectLaunchKind(target, explicitKind);

  try {
    toast(`Launching ${label || target}…`, 'info');

    // In native Electron desktop app
    const api = getElectronAPI();
    if (api) {
      // 1. Native Executables or File paths
      if (kind === 'file' || isNativeFilePath(target)) {
        const filePath = target.startsWith('file://') ? target.slice(7) : target;
        try {
          await api.launchNativeApp(filePath);
          return true;
        } catch (err) {
          console.error('launchNativeApp failed:', err);
          toast(`Could not launch native application: ${label || filePath}`, 'error');
          return false;
        }
      }

      // 2. Web URLs in user's preferred browser
      if (kind === 'web') {
        const finalUrl = normalizeWebUrl(target);
        const preferredBrowser =
          explicitBrowser || localStorage.getItem('focusspace-default-browser') || 'system';
        try {
          await api.openInBrowser(finalUrl, preferredBrowser);
          return true;
        } catch (err) {
          console.warn('openInBrowser failed, falling back to openExternal:', err);
          await api.openExternal(finalUrl);
          return true;
        }
      }

      // 3. Desktop URI Schemes (vscode://, spotify://, discord://, etc.)
      try {
        await api.openExternal(target);
        return true;
      } catch (err) {
        console.warn('Electron openExternal failed:', err);
      }
    }

    // Web / Browser fallback
    if (kind === 'web') {
      const finalUrl = normalizeWebUrl(target);
      window.open(finalUrl, '_blank', 'noopener,noreferrer');
    } else {
      const a = document.createElement('a');
      a.href = target;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    return true;
  } catch (err) {
    console.error('Failed to launch URL scheme:', err);
    toast('Could not open workspace link', 'error');
    return false;
  }
}
