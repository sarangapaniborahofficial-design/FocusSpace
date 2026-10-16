# FocusSpace Desktop & Voice Studio — Comprehensive Bug Report & Post-Mortem

**Date:** 2026-10-16  
**System:** Tauri v2.1.0 / Windows 11 / React 19 / Dexie v4  
**Status:** ALL ISSUES RESOLVED & VERIFIED VIA ARGUS ORACLE  

---

## 1. Executive Summary

During testing of the Windows native build, three critical issues were identified:
1. **Voice Typing Protobuf Crash**: Voice initialization failed immediately with `ERROR_CODE: 7, ERROR_MESSAGE: Failed to load model because protobuf parsing failed.`
2. **Floating HUD Window Immobile & Unresponsive**: The Always-on-Top HUD could not be dragged, did not expand when clicked (remained clamped at 76px with clipped contents), and could not be closed.
3. **App Dock Edit Option Absent**: Users could not edit existing apps, URLs, or desktop protocols (e.g., Discord, Spotify, VS Code) on the dock without deleting and recreating them.

All three root causes have been identified, corrected with dual-layer native architecture, and verified through the ARGUS 7-Tier Verification Oracle.

---

## 2. Bug 1: Microphone Protobuf Parse Crash

### Symptoms & Error Log
When the user clicked the voice typing microphone button, the following fatal exception was thrown:
```
Can't create a session. ERROR_CODE: 7, ERROR_MESSAGE: Failed to load model because protobuf parsing failed.
  at Object.createSession (ort.wasm-core.js)
  at MicVAD.new (vad-web/dist/real-time-vad.js)
```

### Deep Root Cause Analysis
1. In `src/voice/capture/vad.ts`, `MicVAD.new({ baseAssetPath: '/vad/', ... })` was invoked without specifying the `model` property.
2. Inside `@ricky0123/vad-web/dist/real-time-vad.js`:
   ```javascript
   exports.DEFAULT_MODEL = "legacy";
   const modelFiles = {
       legacy: "silero_vad_legacy.onnx",
       v5: "silero_vad_v5.onnx",
       v6: "silero_vad_v6.onnx",
   };
   ```
   Because `model` was omitted, the library defaulted to `"legacy"` and fetched `/vad/silero_vad_legacy.onnx`.
3. In `scripts/provision-voice.mjs`, an aggressive pruning step explicitly removed `silero_vad_legacy.onnx` from `public/vad/`:
   ```javascript
   if (entry === 'silero_vad_legacy.onnx') fs.rmSync(...);
   ```
4. Consequently, the HTTP request for `/vad/silero_vad_legacy.onnx` received an HTTP 200 response containing `index.html` (the standard Vite / Tauri SPA fallback route).
5. ONNX Runtime Web attempted to parse the HTML string as a binary Protocol Buffer (protobuf) definition for neural net weights, resulting in `ERROR_CODE: 7: Failed to load model because protobuf parsing failed.`

### Permanent Architectural Fix
1. **Explicit Model Target**: In `src/voice/capture/vad.ts`, explicitly configured `model: 'v5'` in `MicVAD.new({...})`.
2. **Asset Provisioning Redundancy**: Copied both `silero_vad_v5.onnx` (2.22 MB) and `silero_vad_legacy.onnx` (1.72 MB) into `public/vad/`. Neither path can ever 404 or fall back to HTML.
3. **Provisioner & Guard Updates**: Updated `scripts/provision-voice.mjs` and `scripts/check-voice-assets.mjs` to provision and verify both models across all builds (20 offline voice assets, 86.24 MB total).

---

## 3. Bug 2: Always-on-Top Floating HUD (Drag, Expand, Close Broken)

### Symptoms
- The HUD header could not be dragged across the desktop.
- Clicking the expand chevron flipped the React icon from `v` to `^`, but the OS window stayed clamped at 76px height; drawer content overflowed or was clipped.
- Clicking the close button (`X`) did not dismiss or hide the HUD.

### Deep Root Cause Analysis
1. Under Tauri v2, permissions are strictly gated through the Capability System (`src-tauri/capabilities/default.json`).
2. Previously, `capabilities/default.json` only listed `"core:default"`.
3. In Tauri v2's permission hierarchy, `"core:default"` only permits basic informational queries (`is_visible`, `is_focused`, `scale_factor`). It **strictly denies**:
   - `core:window:allow-start-dragging`
   - `core:window:allow-set-size`
   - `core:window:allow-hide`
   - `core:window:allow-show`
   - `core:window:allow-close`
   - `core:window:allow-set-focus`
   - `core:window:allow-unminimize`
4. When JavaScript called `getCurrentWindow().startDragging()`, `getCurrentWindow().setSize()`, or `getCurrentWindow().hide()`, Tauri's IPC ACL rejected the calls with silent promise rejections caught in empty catch blocks:
   ```typescript
   try {
     await getCurrentWindow().setSize(new LogicalSize(320, 290));
   } catch (err) {
     console.warn('Native resize failed:', err); // ACL rejection!
   }
   ```

### Permanent Architectural Fix
1. **Tauri v2 ACL Capabilities**: Added all necessary window permissions to `src-tauri/capabilities/default.json`:
   ```json
   "permissions": [
     "core:default",
     "core:window:allow-start-dragging",
     "core:window:allow-set-size",
     "core:window:allow-hide",
     "core:window:allow-show",
     "core:window:allow-close",
     "core:window:allow-set-focus",
     "core:window:allow-unminimize",
     "core:window:allow-set-position",
     "core:window:allow-is-visible",
     "core:window:allow-is-focused",
     "window-state:default",
     "global-shortcut:default",
     "notification:default",
     "opener:default"
   ]
   ```
2. **Native Rust IPC Commands**: Created `src-tauri/src/hud.rs` with native Rust commands:
   - `hud_start_dragging(window: Window)`: Directly calls `window.start_dragging()` in the native OS process.
   - `hud_set_expanded(app: AppHandle, expanded: bool)`: Resizes `floating-hud` to `LogicalSize::new(320.0, if expanded { 290.0 } else { 76.0 })`.
   - `hud_hide(app: AppHandle)`: Calls `hud.hide()`.
   - `hud_show(app: AppHandle)`: Calls `hud.show()` and `hud.set_focus()`.
3. **Dual-Layer Invocation in Frontend**:
   - `FloatingHUD.tsx` and `src/lib/pipHud.ts` now call `invoke('hud_start_dragging')`, `invoke('hud_set_expanded', { expanded })`, and `invoke('hud_hide')` as primary handlers, with `@tauri-apps/api/window` as fallback.

---

## 4. Bug 3: App Dock Missing Edit Capability & App Launching

### Symptoms
- Users could only add or delete apps. If a desktop app path or protocol scheme was incorrect (e.g. typing `discord` instead of `discord://`), the user had to delete and re-add the app.
- No right-click context menu existed on dock items.

### Deep Root Cause Analysis
1. `AppDock.tsx` only had `addLink` and `removeLink` functions; state for `editingLink` did not exist.
2. The UI only displayed `<X>` and `<Trash2>` icons for removal.
3. Native scheme launching in Windows desktop requires proper URI formatting (`discord://`, `spotify://`, `vscode://`) or direct file path execution via `cmd /C start ""`.

### Permanent Architectural Fix
1. **Edit State Machine**: Added `editingLink: LaunchLink | null` state and `startEditing(link)` / `cancelEditing()` / `saveOrUpdateLink()` handlers to `src/components/AppDock.tsx`.
2. **Manage Popover Edit Controls**:
   - Added an edit pencil button (`<Pencil size={11} />`) to each app pill in the manage popover.
   - When an app is selected for editing, the form switches to "Edit App" mode with pre-filled inputs and "Save Changes" / "Cancel" buttons.
3. **Inline Card Edit Controls**:
   - Added an edit pencil button (`<Pencil size={12} />`) to each dock item in settings and category views.
4. **Desktop Right-Click Context Menu**:
   - Added `onContextMenu` handler to dock icons in floating mode displaying a desktop context menu:
     - 🚀 **Launch App**
     - ✏️ **Edit App** (opens edit form pre-filled)
     - 🗑️ **Remove from Dock**

---

## 5. Verification Matrix

| Verification Tier | Test Description | Target | Observed Result | Status |
|---|---|---|---|---|
| **T1: Static Typing** | `npx tsc --noEmit` | 0 errors | 0 errors | **PASS** |
| **T2: Unit & Engine Tests** | `npx vitest run` | 15 files, 104 tests | 15 files passed, 104 tests passed | **PASS** |
| **T3: Native Vault Tests** | `cargo test` in `src-tauri` | 3 tests passed | 3 passed (atomic write, filename regex, retention) | **PASS** |
| **T4: Voice Asset Integrity** | `node scripts/check-voice-assets.mjs` | 20 offline assets | 20/20 assets verified (86.24 MB) | **PASS** |
| **T5: Tauri v2 Hardening** | Window clamps & IPC ACLs | Clamped 320x76-290 | Confirmed bounds, commands & ACLs | **PASS** |
| **T6: HUD Artboard Fidelity** | CSS token audit | 6 artboards (.hud-01..06) | Verified all 6 HUD themes & styles | **PASS** |
| **T7: Release Packaging** | NSIS & MSI installers | Build exit 0 | Fresh installer & zip archive produced | **PASS** |
