/** Helpers for files attached to pages. Pure except `downloadBlob`. */

export const MAX_FILE_BYTES = 100 * 1024 * 1024;

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, i);
  return `${value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

const BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif',
  txt: 'text/plain', md: 'text/markdown', markdown: 'text/markdown', csv: 'text/csv', json: 'application/json',
};

/** Browsers sometimes leave `file.type` empty; fall back to the extension. */
export function guessType(name: string, type: string) {
  if (type) return type;
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  return BY_EXTENSION[ext] ?? 'application/octet-stream';
}

export type FileKind = 'pdf' | 'image' | 'text' | 'other';

/**
 * What the app is willing to show inline. HTML and SVG are deliberately "other": rendering them from a
 * blob URL would run their scripts with this app's origin (and access to your data).
 */
export function fileKind(type: string, name = ''): FileKind {
  const t = type.toLowerCase();
  if (t === 'application/pdf') return 'pdf';
  if (/^image\/(png|jpe?g|gif|webp|avif)$/.test(t)) return 'image';
  if (t === 'text/plain' || t === 'text/markdown' || (t === 'application/octet-stream' && /\.(txt|md|markdown)$/i.test(name))) return 'text';
  return 'other';
}

export function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

export async function blobToBase64(blob: Blob) {
  return bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
}

export function base64ToBlob(base64: string, type: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
