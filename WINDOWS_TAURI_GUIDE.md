# FocusSpace: Windows Hardening and Tauri v2 Guide

**For:** the build agent (Antigravity). **Owner:** Sarangapani. **Scope:** make the Windows app solid. The phone app, LAN receiver and QR pairing are deferred and out of scope.
**Baseline:** `FocusSpace_Clean_Codebase_1.zip` (Dexie v4, `backup.ts` present, fonts bundled, dependencies pinned, voice module in `src/voice/`).

---

## 0. Read this first

### Operating rules

1. Work one phase at a time. At every gate, stop and report **measured results** (test counts, installer size, benchmark tables, DevTools findings), then wait for approval.
2. Never claim something is verified unless you ran it. Mark anything unchecked as `UNVERIFIED` in `STATUS.md`.
3. Tauri v2 plugin names, permission strings and config keys change between releases. Check them against the current Tauri v2 docs before using them, and pin exact versions in `package.json` and `Cargo.toml`.
4. No new dependencies beyond the ones named here without asking.
5. Commit small. Commit messages state what was measured.
6. If a gate fails, stop and report the numbers. Do not work around it with a cloud service or the Web Speech API.

### Hard rules (violations are bugs even if the feature works)

- No runtime network calls. The webview loads only bundled assets. External URLs open in the user's default app through the opener allow-list (Phase D).
- No `SpeechRecognition` / `webkitSpeechRecognition` anywhere.
- No telemetry, analytics or crash upload. Logs stay on disk locally.
- Audio is never persisted. Transcripts are not logged.
- **Do not delete `src/lib/backup.ts`.** An older planning document told you to. It is stale: it references files that do not exist and it would remove the only backup engine. Ignore any "Phase 11 dead-file removal" instruction that touches backup code.
- Freeze the Tauri `identifier` (Phase B). Changing it later orphans the user's data.

### Known facts about the current code (verified by reading, do not re-derive)

- Timer state is deadline-based (`endsAt`), so hidden or throttled windows will not make it drift.
- `journalAutoSave.ts`, `pipHud.ts`, `launcher.ts`, `notifications.ts` exist. The task parser is `parseTaskInput` in `src/lib/taskParser.ts`.
- `exportFullBackup()` and `importFullBackup()` cover all 10 Dexie tables. `importFullBackup` **clears every table before restoring**.
- `public/` is about 215 MB because ONNX WASM variants are copied twice and most are unused.

---

## Phase A: Stabilize the web build (before any Rust)

### A1. Backup fidelity

- [ ] Store each file blob's MIME type in the envelope (`fileBlobs[].type`) and restore it. Add a test that a PDF and a PNG round-trip with the same `type` and bytes.
- [ ] Add `schemaVersion` (the Dexie version, currently 4) to the envelope. Importing a file from a **newer** schema must fail with a clear message.
- [ ] Add a small `settings` block to the envelope (currently only the theme key `focusspace-theme`). Restore it on import.
- [ ] Add a pre-restore safety step: before `importFullBackup` clears tables, export the current database and keep it in memory and offer it as a download if the restore throws.
- [ ] Manual restore test on the owner's real data (see Owner tasks). Record counts before and after.

### A2. Voice fixes (voice stays in the PWA for now)

- [ ] **Chunking instead of truncation.** The worker currently cuts audio at 25 s and drops the rest. Replace with: split audio longer than 25 s into chunks of at most 25 s, preferring a split point at the quietest 200 ms window within the last 3 s of each chunk. Transcribe sequentially and join with a single space. Add a unit test for the splitter (pure function).
- [ ] **ONNX loader files.** `scripts/provision-voice.mjs` copies only `.wasm`. Also copy the matching `.mjs` loader. Keep **one** variant (the one transformers.js actually requests; confirm in the Network tab), delete the other three, and serve both transformers.js and the VAD from a single folder (`public/ort/`). Update `wasmPaths` and `onnxWASMBasePath` accordingly.
- [ ] Add `scripts/check-voice-assets.mjs` that fails if any required file is missing after provisioning (model files, tokenizer files, the one wasm, its `.mjs`, `silero_vad_v5.onnx`, worklet bundle). Run it in `postinstall` and in CI.
- [ ] **Real Gate 0.** Extend `BenchPage` to accept a reference transcript per clip and compute word error rate. Record results for the owner's clips (see Owner tasks). Replace the unverified table in `src/voice/README.md` with the measured one. Remove the claim that models are cached in IndexedDB (they are served from `/models/`).
- [ ] **Cross-origin isolation.** Add `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` (or `credentialless`) in `vite.config.ts` for `server` and `preview`. `BenchPage` must report `crossOriginIsolated === true`. Measure real-time factor with 1 thread vs 4 threads and record both.
- [ ] **Hotkey.** Remove `Ctrl+Shift+V` from the global handler in `App.tsx` (it breaks paste-as-plain-text everywhere). Keep `Alt+V`.
- [ ] `VadController.destroy()` only calls `pause()`. Call the VAD instance's own `destroy()` (verify the method name in the installed `@ricky0123/vad-web`) so the microphone is fully released. Verify the browser's mic indicator turns off after stopping.
- [ ] `InputDictationTarget.removeLastInsert()` must check the inserted text is still at the recorded range before deleting; if not, do nothing.

### A3. Housekeeping

- [ ] Make `STATUS.md` accurate: real test count, remove claims you did not measure, fix duplicate numbering.
- [ ] Call `navigator.storage.persist()` at boot and log the result locally.

### Gate A

- `npm test` passes (report the exact count) and `npm run build` succeeds.
- Offline test in DevTools (Network set to Offline, hard reload): app loads, fonts render, voice loads and transcribes a clip, **zero** requests leave the origin and zero 404s.
- Restore round trip preserves counts for all 10 tables and attachment MIME types.
- Gate 0 table with word error rate is committed.

---

## Phase B: Empty Tauri v2 shell (voice off)

### Prerequisites (owner confirms)

Rust stable with the MSVC toolchain, Visual Studio Build Tools (C++ workload), WebView2 runtime (present on Windows 11).

### B1. Scaffold

- [ ] Add `@tauri-apps/cli` as a pinned dev dependency and run `tauri init`. Settings: dev URL `http://localhost:5173`, `frontendDist` pointing at the Vite `dist`, `beforeDevCommand: npm run dev`, `beforeBuildCommand: npm run build:tauri`.
- [ ] `identifier`: `com.focusspace.desktop`. **Freeze it now.** Product name `FocusSpace`.
- [ ] Add `src/lib/runtime.ts` exporting `isTauri()` (check for `__TAURI_INTERNALS__` on `window`). All native code goes through adapters that fall back to the browser behavior when `isTauri()` is false. The Android/PWA path must keep working.

### B2. Build flag

- [ ] Add `build:tauri` (a Vite `--mode tauri` build). In that mode: disable `VitePWA`, do not render `ReloadPrompt`, and do not register a service worker.
- [ ] In that mode, remove `dist/models`, `dist/vad` and `dist/ort` after the build (a small Vite plugin in `closeBundle`) and set the voice feature flag **off**. Voice returns in Phase G.

### B3. Security baseline

- [ ] Strict CSP in `tauri.conf.json`: same-origin for scripts, styles, fonts, images; `connect-src` limited to `'self'` plus the Tauri IPC origins; `worker-src 'self' blob:`; `'wasm-unsafe-eval'` only if needed (it is needed for voice in Phase G). Verify the exact IPC origins in the current docs.
- [ ] Capabilities: start with only what the app needs (core defaults). No `shell` plugin. No broad `fs` scope.
- [ ] Add `tauri-plugin-single-instance` (a second launch focuses the existing window) and `tauri-plugin-window-state` (remember size and position).

### Gate B

- `npm run tauri dev` and `npm run tauri build` both succeed. Report installer size.
- App launches from the installed build; the seeded or restored data **persists across restarts**; fonts render with the network off; all tests still pass.
- DevTools shows no external requests.

---

## Phase C: Data safety (vault mirroring and restore)

### C1. Rust commands (keep them small)

- [ ] `write_vault_snapshot(filename, payload)`, `list_vault_snapshots()`, `read_vault_snapshot(filename)`.
- [ ] Filenames must match `^focusspace-\d{4}-\d{2}-\d{2}(-\d{6})?\.json$`. Reject anything else (no path separators, no `..`). Add `cargo test` cases for path traversal.
- [ ] Atomic writes: write to a temp file in the same folder, flush, then rename. A crash must never leave a half-written newest snapshot.
- [ ] Retention: keep 14 days, but never delete if it would leave fewer than 3 snapshots. Cap payload size and return a clear error beyond it.
- [ ] Default folder: the app data directory (`.../Backups`). Do **not** default to `Documents` (often synced to OneDrive on Windows 11, which would send plaintext to the cloud). Settings shows the current path, lets the owner choose another folder, and warns if the chosen path contains `OneDrive`.

### C2. Scheduling (JS side)

- [ ] Use the existing `exportFullBackup()`. Do not write a separate seven-table export (it would omit `pageLinks`, `files` and `fileBlobs`).
- [ ] Take a snapshot: daily at 11:59 PM through the existing `journalAutoSave` hook, on boot if the newest snapshot is older than 24 hours, and on a manual **Back up now** button. Show the last snapshot time in Settings.

### C3. Restore UI

- [ ] List snapshots with date, size and row counts (parse the envelope header). Restore requires confirmation and **takes a safety snapshot first** (`importFullBackup` clears everything).

### C4. Large attachments

- [ ] Measure snapshot time and size with the owner's real attachments. If a snapshot exceeds the size cap or takes more than a few seconds, report it and propose writing blobs as separate files. Do not implement that without approval.

### Gate C

- Delete all data, restore from a snapshot, row counts equal for all 10 tables.
- Kill the app during a write: the previous snapshot is intact and valid.
- Retention prunes correctly (test with fake dates). `cargo test` passes.

---

## Phase D: Native adapters

- [ ] **Launcher** (`launcher.ts`): when `isTauri()`, open links through the opener plugin. Allow-list schemes in the capability file (`https`, plus the specific custom schemes the dock supports, for example `spotify`, `vscode`). Keep the existing URL sanitization. Browser path unchanged.
- [ ] **Notifications** (`notifications.ts`): when `isTauri()`, use the notification plugin with a permission request flow; otherwise the web `Notification` API.
- [ ] **Tray**: tray icon with menu (Show, Quick add, Quit). Tooltip shows the active timer state.
- [ ] **Close-to-tray**: intercept the main window close so it hides instead of quitting; **Quit** in the tray really exits. First time it happens, show a one-time message so the owner knows where the app went.
- [ ] **Autostart**: opt-in setting only, off by default.

### Gate D

- Start a Pomodoro, hide to tray for 10 minutes, restore: remaining time is correct.
- A notification fires when the timer ends while the window is hidden.
- `spotify://` and `vscode://` links launch the apps; a non-allow-listed scheme is refused.
- Quit from the tray exits the process (check Task Manager).

---

## Phase E: Native floating HUD window

### E1. Cross-window bridge

Add `src/lib/hudBridge.ts` using `BroadcastChannel('focusspace-hud-bus')`. The **main window owns the timer and writes to Dexie**. The HUD window is a view that sends commands.

```ts
type HudStateSync = { type: 'STATE_SYNC'; v: 1; timer: TimerSnapshot; activeTask: TaskSnapshot | null };
type HudAction =
  | { type: 'TOGGLE_TIMER'; v: 1 }
  | { type: 'COMPLETE_SUBTASK'; v: 1; taskId: string; subtaskId: string }
  | { type: 'SAVE_SCRATCHPAD'; v: 1; taskId: string; text: string }
  | { type: 'RESIZE_HUD'; v: 1; expanded: boolean };
```

- [ ] Main window broadcasts `STATE_SYNC` on any timer or active-task change and when a HUD window announces it opened (so a freshly opened HUD gets state immediately).
- [ ] Ignore messages with an unknown `type` or a `v` you do not understand.

### E2. Window

- [ ] Declare the window in `tauri.conf.json` with label `floating-hud`, initially hidden: 320x76, `decorations: false`, `transparent: true`, `alwaysOnTop: true`, `skipTaskbar: true`, no resize. Show and hide it from JS (more reliable than creating it at runtime). Expanded height 290 on the `RESIZE_HUD` action.
- [ ] A dedicated route (`/?window=hud`) renders only the HUD, with no app shell and no Dexie writes.
- [ ] `pipHud.ts` becomes the adapter: `isTauri()` uses the native window; otherwise it keeps Document Picture-in-Picture as today.
- [ ] Use a drag region for moving the window. Remember its position with the window-state plugin. Closing the HUD hides it, it does not destroy it.

### Gate E

- HUD shows correct timer and task state within 1 second of any change in the main window; actions from the HUD apply in the main window.
- Works while the main window is hidden to the tray (**verify**: hidden webviews still run JS, but check timing and that actions are applied).
- Position and expanded state survive restart. Transparency renders correctly on the owner's laptop (integrated graphics).

---

## Phase F: Global hotkeys (configurable, opt-in)

- [ ] Use the global-shortcut plugin. **Do not** use `Ctrl+Shift+M`, `Ctrl+Shift+H` or `Ctrl+Shift+V` (VS Code and browser shortcuts), and **do not** use `Alt+Space` (Windows window menu, PowerToys Run). Suggested defaults: `Ctrl+Alt+Space` quick add, `Ctrl+Alt+H` toggle HUD. Dictation hotkey arrives with Phase G.
- [ ] Settings UI to rebind each shortcut, with an **enable/disable** toggle per shortcut.
- [ ] If registration fails (already taken), show a clear message and leave the shortcut disabled. Never crash.
- [ ] Global dictation means dictating **into FocusSpace**. Typing into other apps is a different feature and out of scope.

### Gate F

- Each shortcut works with FocusSpace unfocused. Rebinding persists. A deliberately conflicting shortcut produces a message, not an error.

---

## Phase G: Voice in the Tauri build

- [ ] **Decide the packaging approach with measured numbers.** Option 1 (recommended for personal use): bundle only the minimal voice pack: `whisper-tiny.en` (about 45 MB with tokenizer files), the single WASM and its `.mjs` (about 14 MB), and the Silero VAD model (about 2 MB), roughly 60 MB. Option 2 (before distributing to others): download on demand into the app data folder with an explicit consent step and a checksum. Report the installer size for Option 1 and let the owner choose.
- [ ] Re-enable the voice flag in the Tauri build. Keep the CSP minimal (`'wasm-unsafe-eval'`, `blob:` workers).
- [ ] **Cross-origin isolation inside Tauri.** Find the supported way to set COOP/COEP response headers in Tauri v2 (check the current docs). If it is not possible, voice runs single-threaded: measure and report the real-time factor.
- [ ] Verify microphone permission behavior in WebView2 (prompt appears, choice persists, denial shows a clear message).
- [ ] Add the global dictation hotkey (configurable, off by default).
- [ ] Re-run the Gate 0 benchmark inside the installed Tauri app and compare against the PWA numbers.

### Gate G

- Dictation works fully offline in the installed app, no external requests, mic indicator turns off after stopping, benchmark table recorded for the Tauri build.

---

## Phase H: Release hardening

- [ ] **Installer**: choose NSIS or MSI. Decide the WebView2 install mode (the embedded bootstrapper lets a machine without the runtime install offline). Report installer size.
- [ ] **Signing**: unsigned installers trigger SmartScreen warnings. For personal use, document the warning and skip. Decide before distributing.
- [ ] **Updates**: no auto-updater yet. Before any release with a Dexie schema bump, a fresh snapshot must exist (less than 24 hours old). Add a boot check that warns if not.
- [ ] **Crash safety**: a React error boundary that shows the error and an **Export backup** button. Local rotating log file only (no upload).
- [ ] **Uninstall behavior**: test whether uninstall removes the app data folder (and therefore the default vault). The first-run flow should nudge the owner to choose a backup folder outside app data and outside OneDrive.

### Test matrix (run on a clean second Windows user profile or a VM)

- [ ] Fresh install, offline, first launch.
- [ ] Restore from a backup made in the old PWA.
- [ ] Sleep and resume with a running Pomodoro; change system time zone or date near 11:59 PM and confirm the boot catch-up.
- [ ] High DPI and a second monitor (HUD placement).
- [ ] Low-RAM behavior with voice on.
- [ ] Rapid launch of a second instance.

---

## Out of scope (do not start)

Phone or Android app, LAN receiver, QR pairing, cloud sync, auto-updater, task capture from voice (taskParser integration with a review dock), macOS and Linux builds, multilingual models.

---

## Owner tasks

1. Record about 15 voice clips in your own voice (3 s, 8 s, 20 s, with names, dates and numbers, plus a few noisy ones) and write the exact reference transcript for each.
2. Run the Phase A restore test on your **real** data: export from the current PWA, import into a fresh browser profile, compare counts, and open a PDF and an image attachment.
3. Confirm Rust (MSVC) and the VS Build Tools are installed before Phase B.
4. Decide the voice packaging option at Phase G (bundle the minimal pack, or download on demand).
5. Paste each gate report to Claude for review before approving the next phase.
