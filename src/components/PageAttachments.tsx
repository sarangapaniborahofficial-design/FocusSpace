import { useLiveQuery } from 'dexie-react-hooks';
import { FileImage, FileText, Paperclip, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { db } from '../db/db';
import { downloadBlob, fileKind, formatBytes } from '../lib/files';
import { addFiles, deleteFile, getFileBlob, restoreFile } from '../lib/pages';
import { toast } from '../lib/toast';
import type { PageFile } from '../types';
import { EmptyState } from './ui';

const when = (iso: string) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(iso));
const KIND_LABEL = { pdf: 'PDF', image: 'Image', text: 'Text', other: 'File' } as const;

export function Attachments({ pageId }: { pageId: string }) {
  const files = useLiveQuery(() => db.files.where('pageId').equals(pageId).toArray(), [pageId]);
  const [viewing, setViewing] = useState<PageFile | null>(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const sorted = useMemo(() => [...(files ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [files]);

  const upload = (list: FileList | File[] | null) => {
    const picked = list ? Array.from(list) : [];
    if (picked.length) void addFiles(pageId, picked);
  };
  const onPick = (e: ChangeEvent<HTMLInputElement>) => { upload(e.target.files); e.target.value = ''; };
  const onDrop = (e: DragEvent<HTMLElement>) => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files); };

  const download = async (file: PageFile) => {
    const blob = await getFileBlob(file.id);
    if (blob) downloadBlob(blob, file.name); else toast('That file is no longer stored.', 'error');
  };
  const remove = async (file: PageFile) => {
    const snapshot = await deleteFile(file.id);
    if (snapshot) toast(`Removed “${file.name}”`, 'info', { action: { label: 'Undo', run: () => { void restoreFile(snapshot); } }, duration: 8000 });
  };

  return (
    <section
      aria-labelledby="files-heading" className="mt-8"
      onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragging(true); } }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false); }}
      onDrop={onDrop}
    >
      <div className="flex items-center justify-between mb-3">
        <h2 id="files-heading" className="font-medium flex items-center gap-2"><Paperclip size={15} /> Files {sorted.length > 0 && <span className="text-xs text-fg-subtle font-normal tabular-nums">{sorted.length}</span>}</h2>
        <button onClick={() => input.current?.click()} className="h-8 px-3 rounded-md border border-line text-sm text-fg-soft hover:bg-hover">Add files</button>
        <input ref={input} type="file" multiple onChange={onPick} className="hidden" aria-label="Choose files to attach" />
      </div>

      <div className={`rounded-xl border transition-colors ${dragging ? 'border-line-strong bg-surface-2' : 'border-line bg-surface-2'}${sorted.length ? '' : 'border-dashed'}`}>
        {files === undefined ? (
          <div className="p-4"><div className="skeleton h-12" /></div>
        ) : sorted.length === 0 ? (
          <EmptyState compact icon={Paperclip} title={dragging ? 'Drop to attach' : 'No files yet'} text="Drag PDFs, images or documents here, or use Add files. Everything stays on this device." />
        ) : (
          <ul className="divide-y divide-line">
            {sorted.map(file => {
              const kind = fileKind(file.type, file.name);
              const Icon = kind === 'image' ? FileImage : FileText;
              const previewable = kind !== 'other';
              return (
                <li key={file.id} className="flex items-center gap-3 px-4 py-3 group">
                  <span className="size-9 shrink-0 rounded-lg border border-line bg-surface/60 grid place-items-center text-fg-muted">{kind === 'other' ? <Paperclip size={15} /> : <Icon size={15} />}</span>
                  <button onClick={() => (previewable ? setViewing(file) : void download(file))} className="min-w-0 flex-1 text-left" title={previewable ? 'Preview' : 'Download'}>
                    <div className="text-sm text-fg-soft truncate hover:underline underline-offset-2">{file.name}</div>
                    <div className="text-xs text-fg-subtle mt-0.5">{KIND_LABEL[kind]} · {formatBytes(file.size)} · {when(file.createdAt)}</div>
                  </button>
                  <div className="flex items-center gap-1 shrink-0 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <button onClick={() => void download(file)} className="h-8 px-2.5 rounded-md text-xs text-fg-muted hover:text-fg hover:bg-hover">Download</button>
                    <button onClick={() => void remove(file)} aria-label={`Remove ${file.name}`} title="Remove" className="size-8 grid place-items-center rounded-md text-fg-subtle hover:text-fg-soft hover:bg-hover"><Trash2 size={14} /></button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {viewing && <FileViewer file={viewing} onClose={() => setViewing(null)} onDownload={() => void download(viewing)} />}
    </section>
  );
}

/* ---------- preview ---------- */

const TEXT_PREVIEW_LIMIT = 300_000;

function FileViewer({ file, onClose, onDownload }: { file: PageFile; onClose: () => void; onDownload: () => void }) {
  const kind = fileKind(file.type, file.name);
  const [url, setUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let created: string | null = null;
    (async () => {
      const stored = await getFileBlob(file.id);
      if (cancelled) return;
      if (!stored) { setFailed(true); return; }
      // Files picked without a MIME type are stored untyped; give the viewer the right one.
      const typed = stored.type ? stored : stored.slice(0, stored.size, file.type);
      if (kind === 'text') {
        const raw = await typed.slice(0, TEXT_PREVIEW_LIMIT).text();
        if (!cancelled) setText(typed.size > TEXT_PREVIEW_LIMIT ? `${raw}\n\n… preview truncated, download the file to read the rest.` : raw);
      } else {
        created = URL.createObjectURL(typed);
        if (!cancelled) setUrl(created);
      }
    })().catch(() => { if (!cancelled) setFailed(true); });
    return () => {
      cancelled = true;
      if (created) { const u = created; window.setTimeout(() => URL.revokeObjectURL(u), 60_000); } // a tab opened from the viewer may still need it
    };
  }, [file.id, file.type, kind]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div className="fade-in fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col p-3 sm:p-6" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`Preview of ${file.name}`} onMouseDown={e => e.stopPropagation()} className="pop-in flex-1 min-h-0 flex flex-col rounded-2xl border border-line bg-surface overflow-hidden max-w-6xl w-full mx-auto shadow-2xl">
        <div className="shrink-0 h-14 px-4 flex items-center justify-between gap-3 border-b border-line">
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{file.name}</div>
            <div className="text-xs text-fg-subtle">{formatBytes(file.size)}</div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {url && kind !== 'text' && <a href={url} target="_blank" rel="noopener noreferrer" className="h-8 px-2.5 rounded-md text-xs text-fg-muted hover:text-fg hover:bg-hover grid place-items-center">Open in new tab</a>}
            <button onClick={onDownload} className="h-8 px-2.5 rounded-md text-xs text-fg-muted hover:text-fg hover:bg-hover">Download</button>
            <button onClick={onClose} aria-label="Close preview" className="size-8 grid place-items-center rounded-md text-fg-muted hover:text-fg hover:bg-hover"><X size={17} /></button>
          </div>
        </div>
        <div className="flex-1 min-h-0 bg-surface-2 grid place-items-center overflow-auto">
          {failed ? <p className="text-sm text-fg-muted p-6">This file could not be loaded.</p>
            : kind === 'pdf' && url ? <iframe src={url} title={file.name} className="w-full h-full bg-surface" />
            : kind === 'image' && url ? <img src={url} alt={file.name} className="max-w-full max-h-full object-contain" />
            : kind === 'text' && text !== null ? <pre className="w-full h-full overflow-auto p-5 text-sm leading-relaxed text-fg-soft whitespace-pre-wrap break-words self-start">{text}</pre>
            : <div className="skeleton w-40 h-6" aria-busy="true" />}
        </div>
      </div>
    </div>
  );
}
