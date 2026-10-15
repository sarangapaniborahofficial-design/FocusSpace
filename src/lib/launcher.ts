import { toast } from './toast';
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

export function detectLaunchKind(url: string): LaunchKind {
  const trimmed = url.trim().toLowerCase();
  if (trimmed.startsWith('file://')) return 'file';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return 'web';
  return 'app';
}

/**
 * Triggers launch of a web link or native desktop URI scheme (vscode://, cursor://, obsidian://, etc.)
 */
export function launchTarget(url: string, label?: string): boolean {
  const target = url.trim();
  if (!target) return false;

  try {
    toast(`Launching ${label || target}…`, 'info');
    if (target.startsWith('http://') || target.startsWith('https://')) {
      window.open(target, '_blank', 'noopener,noreferrer');
    } else {
      // Native desktop URI schemes (vscode://, cursor://, obsidian://, slack://)
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
