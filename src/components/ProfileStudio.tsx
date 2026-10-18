import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  User,
  Shield,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Copy,
  Check,
  FolderOpen,
  Download,
  Upload,
  RefreshCw,
  Image as ImageIcon,
  Music,
  Trash2,
  Play,
  Pause,
  Sliders,
  Sparkles,
  Palette,
  Volume2,
  HardDrive,
  Lock,
  Sun,
  Moon,
  LayoutGrid,
} from 'lucide-react';
import { db } from '../db/db';
import { Settings } from './Settings';
import { toast } from '../lib/toast';
import { uid } from '../lib/utils';
import { isElectron, getElectronAPI, type SovereignStatus } from '../lib/runtime';
import {
  getSovereignStatus,
  initSovereignKey,
  importSovereignKey,
  getSovereignKeyHex,
  exportSovereignKey,
  mirrorVaultToSovereign,
  isKeyfileRequired,
  setKeyfileRequired,
  getLastMirrorTime,
} from '../lib/sovereign';
import { ambientSound, useAmbientSound } from '../lib/ambientSound';
import type { LayoutMode } from '../types';

export type StudioTab = 'profile' | 'appearance' | 'audio' | 'workspace';

export const USER_NAME_KEY = 'focusspace-user-name';
export const USER_BIO_KEY = 'focusspace-user-bio';
export const WALLPAPER_BLUR_KEY = 'focusspace-wallpaper-blur';
export const SURFACE_OPACITY_KEY = 'focusspace-surface-opacity';

const THEME_OPTIONS = [
  { id: 'nocturne', name: 'Nocturne Solaris', description: 'Pitch-black dot-matrix, warm stone borders & vermilion orange', dark: true },
  { id: 'onyx', name: 'Swiss Onyx', description: 'Pitch-black architectural grid & acid citron', dark: true },
  { id: 'solaris', name: 'Solaris', description: 'Warm analog paper, vermilion orange & botanical sage', dark: false },
  { id: 'bauhaus', name: 'Swiss Brutal', description: 'High-contrast architectural paper & acid citron', dark: false },
];

export function ProfileStudio({
  theme,
  setTheme,
  layoutMode = 'orbital',
  setLayoutMode,
  defaultTab = 'profile',
  onNavigate,
}: {
  theme: string;
  setTheme: (theme: string) => void;
  layoutMode?: LayoutMode;
  setLayoutMode?: (m: LayoutMode) => void;
  defaultTab?: StudioTab;
  onNavigate?: (view: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<StudioTab>(defaultTab);

  // Profile Information
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem(USER_NAME_KEY) || 'Saran';
    } catch {
      return 'Saran';
    }
  });
  const [bio, setBio] = useState(() => {
    try {
      return localStorage.getItem(USER_BIO_KEY) || 'Deep Work Artisan';
    } catch {
      return 'Deep Work Artisan';
    }
  });

  // Sovereign Security State
  const [sovereignStatus, setSovereignStatus] = useState<SovereignStatus | null>(null);
  const [keyHex, setKeyHex] = useState<string | null>(null);
  const [showKeyHex, setShowKeyHex] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [requireKeyfile, setRequireKeyfileState] = useState(() => isKeyfileRequired());
  const [mirroring, setMirroring] = useState(false);
  const [lastMirror, setLastMirror] = useState<string | null>(() => getLastMirrorTime());

  // Wallpaper & Opacity
  const [blurPx, setBlurPx] = useState<number>(() => {
    try {
      const v = localStorage.getItem(WALLPAPER_BLUR_KEY);
      return v !== null ? Number(v) : 8;
    } catch {
      return 8;
    }
  });
  const [surfaceOpacity, setSurfaceOpacity] = useState<number>(() => {
    try {
      const v = localStorage.getItem(SURFACE_OPACITY_KEY);
      return v !== null ? Number(v) : 95;
    } catch {
      return 95;
    }
  });

  // Live queries for blobs
  const avatarBlobRecord = useLiveQuery(() => db.fileBlobs.get('__profile_avatar__'), []);
  const wallpaperBlobRecord = useLiveQuery(() => db.fileBlobs.get('__custom_wallpaper__'), []);
  const customAudioFiles = useLiveQuery(() => db.files.where('pageId').equals('__custom_audio__').toArray(), []);

  const ambientState = useAmbientSound();
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [wallpaperPreview, setWallpaperPreview] = useState<string | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const wallpaperInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Load avatar preview URL
  useEffect(() => {
    if (avatarBlobRecord?.blob) {
      const url = URL.createObjectURL(avatarBlobRecord.blob);
      setAvatarPreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setAvatarPreview(null);
    }
  }, [avatarBlobRecord]);

  // Load wallpaper preview URL
  useEffect(() => {
    if (wallpaperBlobRecord?.blob) {
      const url = URL.createObjectURL(wallpaperBlobRecord.blob);
      setWallpaperPreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setWallpaperPreview(null);
    }
  }, [wallpaperBlobRecord]);

  // Load sovereign status on mount
  const refreshSovereign = async () => {
    try {
      const st = await getSovereignStatus();
      setSovereignStatus(st);
      if (st.hasKeyFile) {
        const hex = await getSovereignKeyHex();
        setKeyHex(hex);
      } else {
        setKeyHex(null);
      }
    } catch (err) {
      console.warn('Failed to load sovereign status:', err);
    }
  };

  useEffect(() => {
    void refreshSovereign();
  }, []);

  const handleNameChange = (val: string) => {
    setName(val);
    try {
      localStorage.setItem(USER_NAME_KEY, val);
      window.dispatchEvent(new CustomEvent('focusspace:profile-updated', { detail: { name: val } }));
    } catch {}
  };

  const handleBioChange = (val: string) => {
    setBio(val);
    try {
      localStorage.setItem(USER_BIO_KEY, val);
    } catch {}
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await db.fileBlobs.put({ id: '__profile_avatar__', blob: file });
      toast('Profile avatar updated.', 'success');
      window.dispatchEvent(new CustomEvent('focusspace:profile-updated'));
    } catch {
      toast('Failed to upload avatar.', 'error');
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      await db.fileBlobs.delete('__profile_avatar__');
      toast('Profile avatar removed.', 'success');
      window.dispatchEvent(new CustomEvent('focusspace:profile-updated'));
    } catch {
      toast('Failed to remove avatar.', 'error');
    }
  };

  // Sovereign Actions
  const handleInitKey = async () => {
    try {
      const res = await initSovereignKey();
      toast(`Master Key created (Fingerprint: ${res.fingerprint})`, 'success');
      await refreshSovereign();
    } catch (err: any) {
      toast(err?.message || 'Failed to initialize master key', 'error');
    }
  };

  const handleImportKey = async () => {
    try {
      const res = await importSovereignKey();
      if (res.success) {
        toast(`Keyfile imported! Fingerprint: ${res.fingerprint}`, 'success');
        await refreshSovereign();
      } else if (res.error && res.error !== 'Cancelled') {
        toast(res.error, 'error');
      }
    } catch (err: any) {
      toast(err?.message || 'Failed to import key', 'error');
    }
  };

  const handleExportKey = async () => {
    try {
      const res = await exportSovereignKey();
      if (res.exported) {
        toast('Sovereign key exported successfully.', 'success');
      } else if (res.error && res.error !== 'Cancelled') {
        toast(res.error, 'error');
      }
    } catch (err: any) {
      toast(err?.message || 'Failed to export key', 'error');
    }
  };

  const handleCopyKey = () => {
    if (!keyHex) return;
    void navigator.clipboard.writeText(keyHex);
    setCopiedKey(true);
    toast('Master key hex copied to clipboard.', 'success');
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleToggleRequireKeyfile = () => {
    const next = !requireKeyfile;
    setRequireKeyfileState(next);
    setKeyfileRequired(next);
    toast(next ? "Dead-Man's Switch activated: Keyfile required to start." : "Dead-Man's Switch deactivated.", 'success');
  };

  const handleMirrorVault = async () => {
    setMirroring(true);
    try {
      const res = await mirrorVaultToSovereign();
      if (res.success) {
        setLastMirror(new Date().toISOString());
        toast(`Vault encrypted & mirrored atomically! (${(res.sizeBytes! / 1024).toFixed(1)} KB)`, 'success');
      } else {
        toast(res.error || 'Mirror failed.', 'error');
      }
    } catch (err: any) {
      toast(err?.message || 'Failed to mirror vault', 'error');
    } finally {
      setMirroring(false);
    }
  };

  // Wallpaper Actions
  const handleWallpaperUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await db.fileBlobs.put({ id: '__custom_wallpaper__', blob: file });
      toast('Custom workspace wallpaper saved.', 'success');
      window.dispatchEvent(new CustomEvent('focusspace:wallpaper-updated'));
    } catch {
      toast('Failed to save wallpaper.', 'error');
    }
  };

  const handleRemoveWallpaper = async () => {
    try {
      await db.fileBlobs.delete('__custom_wallpaper__');
      toast('Custom wallpaper removed.', 'success');
      window.dispatchEvent(new CustomEvent('focusspace:wallpaper-updated'));
    } catch {
      toast('Failed to remove wallpaper.', 'error');
    }
  };

  const handleBlurChange = (val: number) => {
    setBlurPx(val);
    try {
      localStorage.setItem(WALLPAPER_BLUR_KEY, String(val));
      window.dispatchEvent(new CustomEvent('focusspace:wallpaper-updated'));
    } catch {}
  };

  const handleOpacityChange = (val: number) => {
    setSurfaceOpacity(val);
    try {
      localStorage.setItem(SURFACE_OPACITY_KEY, String(val));
      window.dispatchEvent(new CustomEvent('focusspace:wallpaper-updated'));
    } catch {}
  };

  // Audio Actions
  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    let addedCount = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileId = uid();
      try {
        await db.files.put({
          id: fileId,
          pageId: '__custom_audio__',
          name: file.name.replace(/\.[^/.]+$/, ''),
          size: file.size,
          type: file.type || 'audio/mpeg',
          createdAt: new Date().toISOString(),
        });
        await db.fileBlobs.put({
          id: fileId,
          blob: file,
        });
        addedCount++;
      } catch (err) {
        console.error('Audio track upload error:', err);
      }
    }

    if (addedCount > 0) {
      toast(`Added ${addedCount} custom audio track${addedCount > 1 ? 's' : ''}.`, 'success');
    }
  };

  const handlePlayCustomTrack = async (track: { id: string; name: string }) => {
    if (ambientState.playing && ambientState.track === track.id) {
      ambientSound.stop();
      return;
    }

    try {
      const record = await db.fileBlobs.get(track.id);
      if (!record?.blob) {
        toast('Audio file data missing from local vault.', 'error');
        return;
      }
      ambientSound.playCustomTrack(track.id, track.name, record.blob);
      toast(`Playing "${track.name}"`, 'success');
    } catch (err) {
      toast('Failed to play custom track.', 'error');
    }
  };

  const handleDeleteAudioTrack = async (trackId: string) => {
    if (ambientState.track === trackId) {
      ambientSound.stop();
    }
    try {
      await db.files.delete(trackId);
      await db.fileBlobs.delete(trackId);
      toast('Custom audio track removed.', 'success');
    } catch {
      toast('Failed to delete track.', 'error');
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-surface text-fg select-none">
      {/* Studio Top Navigation Bar */}
      <div className="shrink-0 p-5 sm:p-6 border-b border-line flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-fg flex items-center gap-2.5">
            <User size={22} className="text-accent" />
            <span>Profile & Studio</span>
          </h1>
          <p className="text-xs text-fg-muted mt-1">
            Personalize your artisan workspace, configure custom acoustics, and control sovereign encryption.
          </p>
        </div>

        {/* Tab Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface-2 border border-line overflow-x-auto">
          <button
            onClick={() => setActiveTab('profile')}
            className={`h-8 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition cursor-pointer shrink-0 ${
              activeTab === 'profile'
                ? 'bg-accent text-accent-fg keycap shadow-xs'
                : 'text-fg-muted hover:text-fg hover:bg-hover'
            }`}
          >
            <Shield size={14} />
            <span>Profile & Sovereign Security</span>
          </button>

          <button
            onClick={() => setActiveTab('appearance')}
            className={`h-8 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition cursor-pointer shrink-0 ${
              activeTab === 'appearance'
                ? 'bg-accent text-accent-fg keycap shadow-xs'
                : 'text-fg-muted hover:text-fg hover:bg-hover'
            }`}
          >
            <Palette size={14} />
            <span>Wallpapers & Themes</span>
          </button>

          <button
            onClick={() => setActiveTab('audio')}
            className={`h-8 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition cursor-pointer shrink-0 ${
              activeTab === 'audio'
                ? 'bg-accent text-accent-fg keycap shadow-xs'
                : 'text-fg-muted hover:text-fg hover:bg-hover'
            }`}
          >
            <Music size={14} />
            <span>Custom Ambient Audio</span>
          </button>

          <button
            onClick={() => setActiveTab('workspace')}
            className={`h-8 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition cursor-pointer shrink-0 ${
              activeTab === 'workspace'
                ? 'bg-accent text-accent-fg keycap shadow-xs'
                : 'text-fg-muted hover:text-fg hover:bg-hover'
            }`}
          >
            <Sliders size={14} />
            <span>Workspace Settings & Data</span>
          </button>
        </div>
      </div>

      {/* Studio Tab Content Stage */}
      <div className="flex-1 overflow-y-auto p-5 sm:p-6 min-h-0 space-y-6">
        {/* =================================================================== */}
        {/* TAB 1: PROFILE & SOVEREIGN SECURITY */}
        {/* =================================================================== */}
        {activeTab === 'profile' && (
          <div className="max-w-3xl space-y-6">
            {/* User Profile Card */}
            <div className="rounded-2xl bg-surface-2 border border-line p-5 space-y-4">
              <h2 className="text-sm font-bold text-fg flex items-center gap-2">
                <User size={16} className="text-accent" />
                <span>Identity & Artisan Profile</span>
              </h2>

              <div className="flex flex-col sm:flex-row items-center gap-5">
                {/* Avatar Preview & Actions */}
                <div className="relative shrink-0 flex flex-col items-center gap-2">
                  <div className="size-20 rounded-2xl border-2 border-line bg-surface overflow-hidden grid place-items-center shadow-inner">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt={name} className="size-full object-cover" />
                    ) : (
                      <span className="text-2xl font-bold font-mono text-accent">
                        {(name.trim()[0] || 'U').toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => avatarInputRef.current?.click()}
                      className="h-7 px-2.5 rounded-lg border border-line bg-surface hover:bg-hover text-[11px] font-medium text-fg flex items-center gap-1 cursor-pointer transition"
                    >
                      <Upload size={12} />
                      <span>Upload</span>
                    </button>
                    {avatarPreview && (
                      <button
                        onClick={handleRemoveAvatar}
                        title="Remove custom avatar"
                        className="size-7 rounded-lg border border-line bg-surface hover:bg-hover text-rose-500 grid place-items-center cursor-pointer transition"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Name & Bio Inputs */}
                <div className="flex-1 w-full space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-fg-muted mb-1">Display Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="Your name"
                      className="w-full h-9 px-3 rounded-xl bg-surface border border-line text-xs font-medium text-fg placeholder:text-fg-muted focus:outline-hidden focus:border-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-fg-muted mb-1">Artisan Bio / Focus Motto</label>
                    <input
                      type="text"
                      value={bio}
                      onChange={(e) => handleBioChange(e.target.value)}
                      placeholder="e.g. Deep Work Artisan"
                      className="w-full h-9 px-3 rounded-xl bg-surface border border-line text-xs font-medium text-fg placeholder:text-fg-muted focus:outline-hidden focus:border-accent"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Sovereign Keyfile & AES-256-GCM Vault */}
            <div className="rounded-2xl bg-surface-2 border border-line p-5 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className="text-emerald-500" />
                  <h2 className="text-sm font-bold text-fg">Sovereign Keyfile & Hardware-Grade Vault</h2>
                </div>
                <div className="flex items-center gap-2">
                  {sovereignStatus?.hasKeyFile ? (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-[11px] font-mono font-semibold flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Master Key Active
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500 text-[11px] font-mono font-semibold flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-amber-500" />
                      Keyfile Missing
                    </span>
                  )}
                </div>
              </div>

              <p className="text-xs text-fg-muted leading-relaxed">
                FocusSpace stores your master encryption keyfile independently at{' '}
                <code className="text-[11px] font-mono px-1 py-0.5 rounded bg-surface border border-line text-fg">
                  ~/.focusspace-sovereign/focusspace.sovereign.key
                </code>
                . This directory survives OS uninstalls, ensuring you never lose access to your encrypted local backups.
              </p>

              {/* Fingerprint & Key Display */}
              <div className="p-3.5 rounded-xl bg-surface border border-line space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-fg-muted">Key Fingerprint:</span>
                  <span className="font-mono font-bold text-fg">
                    {sovereignStatus?.keyFingerprint ? `SHA-256: ${sovereignStatus.keyFingerprint}` : '—'}
                  </span>
                </div>

                {keyHex && (
                  <div className="space-y-1.5 pt-2 border-t border-line">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-fg-muted">Master Key Hex (32 bytes):</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowKeyHex(!showKeyHex)}
                          className="text-[11px] text-accent hover:underline cursor-pointer"
                        >
                          {showKeyHex ? 'Hide' : 'Reveal'}
                        </button>
                        <button
                          onClick={handleCopyKey}
                          className="h-6 px-2 rounded-md border border-line bg-surface-2 hover:bg-hover text-[11px] text-fg flex items-center gap-1 cursor-pointer"
                        >
                          {copiedKey ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                          <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>
                    {showKeyHex && (
                      <p className="p-2 rounded-lg bg-surface-2 border border-line font-mono text-[11px] text-fg break-all select-all">
                        {keyHex}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Sovereign Keyfile Management Actions */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {!sovereignStatus?.hasKeyFile ? (
                  <button
                    onClick={handleInitKey}
                    className="h-9 px-3.5 rounded-xl bg-accent text-accent-fg font-semibold keycap text-xs flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <KeyRound size={14} />
                    <span>Generate Sovereign Key</span>
                  </button>
                ) : (
                  <button
                    onClick={handleExportKey}
                    className="h-9 px-3.5 rounded-xl border border-line bg-surface hover:bg-hover text-xs font-medium text-fg flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Download size={14} />
                    <span>Export Keyfile (.key)</span>
                  </button>
                )}

                <button
                  onClick={handleImportKey}
                  className="h-9 px-3.5 rounded-xl border border-line bg-surface hover:bg-hover text-xs font-medium text-fg flex items-center gap-1.5 transition cursor-pointer"
                >
                  <FolderOpen size={14} />
                  <span>Import / Locate Keyfile</span>
                </button>
              </div>

              {/* Dead-Man's Switch Toggle */}
              <div className="pt-3 border-t border-line flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-fg flex items-center gap-1.5">
                    <Lock size={13} className="text-accent" />
                    <span>Require Sovereign Keyfile on Startup (Dead-Man's Switch)</span>
                  </div>
                  <p className="text-[11px] text-fg-muted">
                    When enabled, FocusSpace immediately locks itself on boot if the keyfile is not found on this machine.
                  </p>
                </div>

                <button
                  onClick={handleToggleRequireKeyfile}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                    requireKeyfile ? 'bg-accent' : 'bg-surface border border-line'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white transition-transform ${
                      requireKeyfile ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* 1-Click Sovereign Vault Encryption Mirror */}
              <div className="pt-3 border-t border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-fg flex items-center gap-1.5">
                    <HardDrive size={14} className="text-accent" />
                    <span>Sovereign AES-256-GCM Vault Mirror</span>
                  </div>
                  <p className="text-[11px] text-fg-muted mt-0.5">
                    Last mirrored: {lastMirror ? new Date(lastMirror).toLocaleString() : 'Never'}
                  </p>
                </div>

                <button
                  onClick={handleMirrorVault}
                  disabled={mirroring || !sovereignStatus?.hasKeyFile}
                  className="h-9 px-4 rounded-xl bg-accent text-accent-fg font-semibold keycap text-xs flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <RefreshCw size={13} className={mirroring ? 'animate-spin' : ''} />
                  <span>{mirroring ? 'Encrypting…' : 'Encrypt & Mirror Vault Now'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 2: WALLPAPERS & THEMES */}
        {/* =================================================================== */}
        {activeTab === 'appearance' && (
          <div className="max-w-3xl space-y-6">
            {/* Theme Selector */}
            <div className="rounded-2xl bg-surface-2 border border-line p-5 space-y-4">
              <h2 className="text-sm font-bold text-fg flex items-center gap-2">
                <Palette size={16} className="text-accent" />
                <span>Atmospheric Palette</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {THEME_OPTIONS.map((opt) => {
                  const isActive = theme === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => {
                        setTheme(opt.id);
                        const api = getElectronAPI();
                        if (api?.setTitleBarTheme) void api.setTitleBarTheme(opt.id);
                      }}
                      className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-2 ${
                        isActive
                          ? 'border-accent bg-surface ring-1 ring-accent'
                          : 'border-line bg-surface hover:bg-hover'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {opt.dark ? <Moon size={14} className="text-accent" /> : <Sun size={14} className="text-amber-500" />}
                          <span className="text-xs font-bold text-fg">{opt.name}</span>
                        </div>
                        {isActive && <Check size={14} className="text-accent" />}
                      </div>
                      <p className="text-[11px] text-fg-muted leading-relaxed">{opt.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Workspace Wallpaper */}
            <div className="rounded-2xl bg-surface-2 border border-line p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-fg flex items-center gap-2">
                  <ImageIcon size={16} className="text-accent" />
                  <span>Custom Workspace Wallpaper</span>
                </h2>
                {wallpaperPreview && (
                  <button
                    onClick={handleRemoveWallpaper}
                    className="text-xs text-rose-500 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 size={12} />
                    <span>Remove Wallpaper</span>
                  </button>
                )}
              </div>

              <p className="text-xs text-fg-muted">
                Upload a custom background image. Stored 100% locally in your IndexedDB vault.
              </p>

              {wallpaperPreview ? (
                <div className="relative w-full h-44 rounded-xl border border-line overflow-hidden group">
                  <img src={wallpaperPreview} alt="Workspace Wallpaper" className="size-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => wallpaperInputRef.current?.click()}
                      className="h-8 px-3 rounded-lg bg-surface text-fg text-xs font-medium border border-line flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload size={12} />
                      <span>Replace</span>
                    </button>
                    <button
                      onClick={handleRemoveWallpaper}
                      className="h-8 px-3 rounded-lg bg-rose-500 text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 size={12} />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => wallpaperInputRef.current?.click()}
                  className="w-full h-32 rounded-xl border-2 border-dashed border-line hover:border-accent bg-surface/50 hover:bg-hover flex flex-col items-center justify-center gap-2 text-fg-muted hover:text-fg transition cursor-pointer"
                >
                  <Upload size={20} className="text-accent" />
                  <span className="text-xs font-semibold">Click to upload custom wallpaper image</span>
                  <span className="text-[10px] text-fg-muted">PNG, JPG, WebP supported</span>
                </button>
              )}

              <input
                ref={wallpaperInputRef}
                type="file"
                accept="image/*"
                onChange={handleWallpaperUpload}
                className="hidden"
              />

              {/* Wallpaper Sliders (Blur & Opacity) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-line">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-fg">Backdrop Blur</span>
                    <span className="font-mono text-fg-muted">{blurPx}px</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={24}
                    step={1}
                    value={blurPx}
                    onChange={(e) => handleBlurChange(Number(e.target.value))}
                    className="w-full accent-accent cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-fg">Surface Opacity</span>
                    <span className="font-mono text-fg-muted">{surfaceOpacity}%</span>
                  </div>
                  <input
                    type="range"
                    min={60}
                    max={100}
                    step={2}
                    value={surfaceOpacity}
                    onChange={(e) => handleOpacityChange(Number(e.target.value))}
                    className="w-full accent-accent cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 3: CUSTOM AMBIENT AUDIO */}
        {/* =================================================================== */}
        {activeTab === 'audio' && (
          <div className="max-w-3xl space-y-6">
            <div className="rounded-2xl bg-surface-2 border border-line p-5 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-sm font-bold text-fg flex items-center gap-2">
                    <Music size={16} className="text-accent" />
                    <span>Custom Focus Acoustic Library</span>
                  </h2>
                  <p className="text-xs text-fg-muted mt-0.5">
                    Upload your own music, binaural audio, or drone soundscapes for infinite deep work loops.
                  </p>
                </div>

                <button
                  onClick={() => audioInputRef.current?.click()}
                  className="h-9 px-3.5 rounded-xl bg-accent text-accent-fg font-semibold keycap text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Upload size={14} />
                  <span>Upload Audio Track</span>
                </button>
              </div>

              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*"
                multiple
                onChange={handleAudioUpload}
                className="hidden"
              />

              {/* Track List */}
              <div className="space-y-2 pt-2">
                {customAudioFiles && customAudioFiles.length > 0 ? (
                  customAudioFiles.map((track) => {
                    const isCurrentPlaying = ambientState.playing && ambientState.track === track.id;
                    const sizeMb = ((track.size || 0) / (1024 * 1024)).toFixed(1);
                    return (
                      <div
                        key={track.id}
                        className={`p-3 rounded-xl border transition flex items-center justify-between gap-3 ${
                          isCurrentPlaying
                            ? 'bg-accent/10 border-accent/40'
                            : 'bg-surface border-line hover:bg-hover'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            onClick={() => handlePlayCustomTrack(track)}
                            className={`size-8 rounded-lg grid place-items-center transition cursor-pointer shrink-0 ${
                              isCurrentPlaying
                                ? 'bg-accent text-accent-fg keycap shadow-xs'
                                : 'bg-surface-2 border border-line text-fg hover:bg-hover'
                            }`}
                          >
                            {isCurrentPlaying ? <Pause size={13} /> : <Play size={13} className="ml-0.5" />}
                          </button>

                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-fg truncate">{track.name}</p>
                            <p className="text-[10px] font-mono text-fg-muted">{sizeMb} MB • Loop Enabled</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isCurrentPlaying && (
                            <span className="text-[10px] font-mono font-semibold text-accent flex items-center gap-1">
                              <Volume2 size={12} className="animate-pulse" />
                              <span>Active</span>
                            </span>
                          )}
                          <button
                            onClick={() => handleDeleteAudioTrack(track.id)}
                            className="size-7 rounded-lg border border-line bg-surface hover:bg-hover text-rose-500 grid place-items-center cursor-pointer transition"
                            title="Delete audio track"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center rounded-xl border border-dashed border-line bg-surface/50 text-fg-muted space-y-2">
                    <Music size={24} className="mx-auto text-fg-muted/60" />
                    <p className="text-xs">No custom acoustic tracks uploaded yet.</p>
                    <p className="text-[11px] text-fg-muted">Upload .mp3, .wav, or .ogg focus music to play seamlessly in the Chrono-Atelier.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 4: WORKSPACE SETTINGS & DATA VAULT */}
        {/* =================================================================== */}
        {activeTab === 'workspace' && (
          <div className="max-w-4xl">
            <Settings
              theme={theme}
              setTheme={setTheme}
              layoutMode={layoutMode}
              setLayoutMode={setLayoutMode}
            />
          </div>
        )}
      </div>
    </div>
  );
}
