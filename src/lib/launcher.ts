import { toast } from './toast';
import { isTauri } from './runtime';
import type { LaunchKind, LaunchLink } from '../types';

export const APP_PRESETS: { label: string; url: string; icon: string; kind: LaunchKind }[] = [
  { label: 'Spotify', url: 'spotify://', icon: 'music', kind: 'app' },
  { label: 'YouTube', url: 'https://youtube.com', icon: 'youtube', kind: 'web' },
  { label: 'Discord', url: 'discord://', icon: 'discord', kind: 'app' },
  { label: 'Antigravity', url: 'antigravity://open', icon: 'sparkles', kind: 'app' },
  { label: 'VS Code', url: 'vscode://file/', icon: 'code', kind: 'app' },
  { label: 'Cursor', url: 'cursor://file/', icon: 'terminal', kind: 'app' },
  { label: 'Obsidian', url: 'obsidian://open', icon: 'book', kind: 'app' },
  { label: 'GitHub', url: 'https://github.com', icon: 'globe', kind: 'web' },
  { label: 'Figma', url: 'https://figma.com', icon: 'globe', kind: 'app' },
  { label: 'Slack', url: 'slack://open', icon: 'discord', kind: 'app' },
  { label: 'Local Dev (5173)', url: 'http://localhost:5173', icon: 'globe', kind: 'web' },
];

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
  if (trimmed.startsWith('file://')) return 'file';
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.includes('.com') ||
    trimmed.includes('.org') ||
    trimmed.includes('.net') ||
    trimmed.includes('.io') ||
    trimmed.includes('.app') ||
    trimmed.includes('.dev') ||
    trimmed.includes('youtube') ||
    trimmed.includes('github') ||
    trimmed.includes('localhost')
  ) {
    return 'web';
  }
  return 'app';
}

/**
 * Triggers launch of a web link or native desktop URI scheme (vscode://, cursor://, obsidian://, etc.)
 */
export async function launchTarget(url: string, label?: string, explicitKind?: LaunchKind): Promise<boolean> {
  const target = url.trim();
  if (!target) return false;

  const kind = detectLaunchKind(target, explicitKind);

  try {
    toast(`Launching ${label || target}…`, 'info');

    // In native Tauri desktop app, use native OS launcher
    if (isTauri()) {
      const finalTarget = kind === 'web'
        ? normalizeWebUrl(target)
        : kind === 'file' && target.startsWith('file://')
          ? target.slice(7)
          : target;

      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('launch_external', { target: finalTarget });
        return true;
      } catch (invokeErr) {
        console.warn('Native launch_external failed, trying plugin-opener fallback:', invokeErr);
        try {
          const { openUrl, openPath } = await import('@tauri-apps/plugin-opener');
          if (kind === 'file') {
            await openPath(finalTarget);
          } else {
            await openUrl(finalTarget);
          }
          return true;
        } catch (openerErr) {
          console.warn('plugin-opener failed:', openerErr);
        }
      }
    }

    if (kind === 'web') {
      const finalUrl = normalizeWebUrl(target);
      const newWin = window.open(finalUrl, '_blank', 'noopener,noreferrer');
      if (!newWin || newWin.closed || typeof newWin.closed === 'undefined') {
        const a = document.createElement('a');
        a.href = finalUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } else {
      // Native desktop URI schemes (vscode://, cursor://, obsidian://, slack://, spotify://)
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
