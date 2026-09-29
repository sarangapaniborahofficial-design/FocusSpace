/**
 * Backup file assembly. Files are appended one JSON entry at a time so a backup with many attachments
 * never needs a single giant string.
 */
export function backupParts(payload: object, fileEntries: string[] | null): string[] {
  const head = JSON.stringify(payload, null, 2);
  if (fileEntries === null) return [head];
  const open = head.slice(0, head.lastIndexOf('}')).trimEnd();
  return [`${open},\n  "files": [\n`, fileEntries.join(',\n'), '\n  ]\n}\n'];
}
