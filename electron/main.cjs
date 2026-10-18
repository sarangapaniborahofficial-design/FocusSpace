const {
  app,
  BrowserWindow,
  ipcMain,
  globalShortcut,
  Tray,
  Menu,
  shell,
  protocol,
  dialog,
  session,
} = require('electron');
const path = require('path');
const fs = require('fs/promises');
const nodeFs = require('fs');

// Global exception guard: prevent native Windows error dialogs on destroyed window references during teardown
process.on('uncaughtException', (err) => {
  if (err && (err.message?.includes('Object has been destroyed') || err.message?.includes('render-process-gone'))) {
    console.warn('[Process Guard] Safely caught destroyed object reference:', err.message);
    return;
  }
  console.error('[Process Guard] Uncaught exception in main process:', err);
});

function showMainWindowSafely() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  } else {
    createMainWindow();
  }
}

function getSavedHudBounds() {
  try {
    const file = path.join(app.getPath('userData'), 'hud-bounds.json');
    if (nodeFs.existsSync(file)) {
      const data = JSON.parse(nodeFs.readFileSync(file, 'utf8'));
      if (typeof data.x === 'number' && typeof data.y === 'number') {
        return { x: data.x, y: data.y };
      }
    }
  } catch {}
  return null;
}

function saveHudBounds(bounds) {
  try {
    const file = path.join(app.getPath('userData'), 'hud-bounds.json');
    nodeFs.writeFileSync(file, JSON.stringify({ x: bounds.x, y: bounds.y }), 'utf8');
  } catch {}
}

// Register 'app://' as a standard, secure, Cross-Origin-Isolated scheme BEFORE app.ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

let mainWindow = null;
let hudWindow = null;
let tray = null;
let systemTrackerProc = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const SAFE_FILENAME_RE = /^focusspace-\d{4}-\d{2}-\d{2}(-\d{6})?\.json$/;
const ALLOWED_PROTOCOLS = new Set([
  'https:',
  'http:',
  'vscode:',
  'cursor:',
  'obsidian:',
  'spotify:',
  'discord:',
  'figma:',
  'notion:',
  'antigravity:',
]);

// Dimensions: 428x76 (collapsed) and 428x428 (expanded) + 12px shadow canvas padding
const HUD_WIDTH = 440;
const HUD_COLLAPSED_HEIGHT = 88;
const HUD_EXPANDED_HEIGHT = 440;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.onnx': 'application/octet-stream',
  '.bin': 'application/octet-stream',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showMainWindowSafely();
  });
}

// Clean shutdown handler: guarantees Windows restart, logoff, or shutdown never hangs
app.on('before-quit', () => {
  app.isQuitting = true;
  if (tray) {
    try {
      tray.destroy();
      tray = null;
    } catch {}
  }
  if (systemTrackerProc) {
    try {
      systemTrackerProc.kill();
      systemTrackerProc = null;
    } catch {}
  }
});

function getBackupDir() {
  return path.join(app.getPath('userData'), 'Backups');
}

function getAppUrl(query = '') {
  if (isDev) {
    return `http://localhost:5173/${query}`;
  }
  return `app://focusspace/index.html${query}`;
}

function applyNavigationLock(webContents) {
  // 1. Deny all window.open() popup requests from untrusted scripts
  webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // 2. Lock navigation strictly to the internal application origin
  webContents.on('will-navigate', (event, targetUrl) => {
    try {
      const parsed = new URL(targetUrl);
      if (isDev && parsed.origin === 'http://localhost:5173') return;
      if (parsed.protocol === 'app:' && parsed.hostname === 'focusspace') return;
    } catch {}
    console.warn('[Security Lock] Blocked unauthorized window navigation to:', targetUrl);
    event.preventDefault();
  });
}

function getTitleBarOverlayOptions(themeName = 'nocturne') {
  const palettes = {
    nocturne: { color: '#0d0c0b', symbolColor: '#f2ece4', height: 44 },
    onyx: { color: '#0a0c0a', symbolColor: '#ededed', height: 44 },
    solaris: { color: '#fffdf9', symbolColor: '#161412', height: 44 },
    bauhaus: { color: '#ffffff', symbolColor: '#0d0f0d', height: 44 },
  };
  return palettes[themeName] || palettes.nocturne;
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    title: 'FocusSpace',
    backgroundColor: '#00000000',
    backgroundMaterial: 'mica',
    icon: path.join(__dirname, '../public/icon-512.png'),
    autoHideMenuBar: true,
    fullscreen: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: getTitleBarOverlayOptions('nocturne'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false, // Keep Pomodoro & BroadcastChannel running at full speed when minimized to tray
    },
  });

  applyNavigationLock(mainWindow.webContents);
  mainWindow.loadURL(getAppUrl());

  // Window state event broadcasting to renderer for responsive UI controls
  mainWindow.on('maximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window:maximize-changed', true);
    }
  });

  mainWindow.on('unmaximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window:maximize-changed', false);
    }
  });

  // Crash Guardrail: If renderer process ever crashes unexpectedly, safely reload instead of showing a black void
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[Process Guard] Main window renderer process exited unexpectedly:', details);
    if (details.reason !== 'clean-exit' && !app.isQuitting) {
      console.log('[Process Guard] Automatically recovering and reloading main window...');
      mainWindow.loadURL(getAppUrl());
    }
  });

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('window:request-close');
      }
    }
  });

  mainWindow.on('minimize', () => {
    if (hudWindow && !hudWindow.isDestroyed()) {
      hudWindow.webContents.send('main-window:lifecycle', { state: 'minimized' });
    }
  });

  mainWindow.on('restore', () => {
    if (hudWindow && !hudWindow.isDestroyed()) {
      hudWindow.webContents.send('main-window:lifecycle', { state: 'restored' });
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (hudWindow && !hudWindow.isDestroyed()) {
      hudWindow.webContents.send('main-window:lifecycle', { state: 'closed' });
    }
  });
}

function createHudWindow() {
  const savedBounds = getSavedHudBounds();
  const windowOpts = {
    width: HUD_WIDTH,
    height: HUD_COLLAPSED_HEIGHT,
    useContentSize: true,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false, // Artboards render their own crisp CSS box-shadows
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  };
  if (savedBounds) {
    windowOpts.x = savedBounds.x;
    windowOpts.y = savedBounds.y;
  }

  hudWindow = new BrowserWindow(windowOpts);

  // Pin above all standard desktop apps and IDEs
  hudWindow.setAlwaysOnTop(true, 'screen-saver');
  hudWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  applyNavigationLock(hudWindow.webContents);
  hudWindow.loadURL(getAppUrl('?window=hud'));

  // Persist HUD coordinates across restarts whenever user finishes dragging window
  hudWindow.on('moved', () => {
    if (hudWindow && !hudWindow.isDestroyed()) {
      const [x, y] = hudWindow.getPosition();
      saveHudBounds({ x, y });
    }
  });

  // Crash Guardrail: If HUD window renderer crashes, safely reload
  hudWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[Process Guard] HUD window renderer process exited unexpectedly:', details);
    if (details.reason !== 'clean-exit' && !app.isQuitting) {
      console.log('[Process Guard] Automatically recovering and reloading HUD window...');
      hudWindow.loadURL(getAppUrl('?window=hud'));
    }
  });

  hudWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      hudWindow.hide();
    }
  });

  hudWindow.on('closed', () => {
    hudWindow = null;
  });
}

function setHudDimensions(expanded) {
  if (!hudWindow || hudWindow.isDestroyed()) return;
  const targetHeight = expanded ? HUD_EXPANDED_HEIGHT : HUD_COLLAPSED_HEIGHT;
  // Unlock resizable briefly so Windows High-DPI WM_GETMINMAXINFO never blocks setContentSize
  hudWindow.setResizable(true);
  hudWindow.setContentSize(HUD_WIDTH, targetHeight, false);
  hudWindow.setResizable(false);
}

function findBrowserExecutables(browserId) {
  const env = process.env;
  const pf = env['ProgramFiles'] || 'C:\\Program Files';
  const pfX86 = env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const localAppData = env['LOCALAPPDATA'] || '';

  const map = {
    chrome: [
      path.join(pf, 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(pfX86, 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(localAppData, 'Google\\Chrome\\Application\\chrome.exe'),
      'chrome.exe',
    ],
    edge: [
      path.join(pfX86, 'Microsoft\\Edge\\Application\\msedge.exe'),
      path.join(pf, 'Microsoft\\Edge\\Application\\msedge.exe'),
      'msedge.exe',
    ],
    brave: [
      path.join(pf, 'BraveSoftware\\Brave-Browser\\Application\\brave.exe'),
      path.join(localAppData, 'BraveSoftware\\Brave-Browser\\Application\\brave.exe'),
      'brave.exe',
    ],
    firefox: [
      path.join(pf, 'Mozilla Firefox\\firefox.exe'),
      path.join(pfX86, 'Mozilla Firefox\\firefox.exe'),
      'firefox.exe',
    ],
  };

  return map[browserId.toLowerCase()] || [];
}

app.whenReady().then(() => {
  // Zero-Network Privacy Guard: Enforces 100% offline data integrity
  // Blocks any unauthorized cloud telemetry, tracking, or network leaks
  if (session && session.defaultSession) {
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      const u = details.url;
      if (
        u.startsWith('app://') ||
        u.startsWith('devtools://') ||
        u.startsWith('chrome-extension://') ||
        (isDev && u.startsWith('http://localhost:5173'))
      ) {
        callback({ cancel: false });
      } else {
        console.warn('[Zero-Network Privacy Guard] Blocked outgoing network request:', u);
        callback({ cancel: true });
      }
    });
  }

  // Serve bundled dist/ files via app://focusspace/ with COOP/COEP headers and path traversal guards
  // Uses Electron's ASAR-aware fs/promises to ensure 100% compatibility with packaged .asar archives
  protocol.handle('app', async (request) => {
    const url = new URL(request.url);
    let relPath = decodeURIComponent(url.pathname);
    if (relPath === '/' || relPath === '') relPath = '/index.html';

    const distDir = path.resolve(__dirname, '../dist');
    let distPath = path.resolve(distDir, '.' + relPath);

    // Normalize for traversal guard
    const normalizedDistDir = path.normalize(distDir);
    const normalizedDistPath = path.normalize(distPath);

    // Path traversal verification: ensure path is strictly inside distDir
    if (
      normalizedDistPath !== normalizedDistDir &&
      !normalizedDistPath.startsWith(normalizedDistDir + path.sep)
    ) {
      console.error('[Security] Attempted path traversal blocked:', relPath);
      return new Response('Access Denied: Path Traversal Detected', { status: 403 });
    }

    try {
      let data;
      let targetPath = distPath;
      let ext = path.extname(distPath).toLowerCase();

      // For .onnx and .wasm files, resolve from app.asar.unpacked if present
      if (ext === '.onnx' || ext === '.wasm') {
        const unpackedPath = distPath.replace('app.asar', 'app.asar.unpacked');
        if (unpackedPath !== distPath && nodeFs.existsSync(unpackedPath)) {
          targetPath = unpackedPath;
        }
      }

      try {
        data = await fs.readFile(targetPath);
      } catch (err) {
        // Fallback to app.asar.unpacked if read failed
        const unpackedFallback = targetPath.replace('app.asar', 'app.asar.unpacked');
        if (unpackedFallback !== targetPath && nodeFs.existsSync(unpackedFallback)) {
          data = await fs.readFile(unpackedFallback);
          targetPath = unpackedFallback;
        } else if (!path.extname(distPath)) {
          // Fallback to index.html for SPA client-side routes without file extensions
          distPath = path.join(distDir, 'index.html');
          data = await fs.readFile(distPath);
        } else {
          throw err;
        }
      }

      ext = path.extname(distPath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      const headers = new Headers();
      headers.set('Content-Type', contentType);
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Cross-Origin-Opener-Policy', 'same-origin');
      headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
      headers.set('Cross-Origin-Resource-Policy', 'same-origin');
      headers.set(
        'Content-Security-Policy',
        "default-src 'self' app:; connect-src 'self' app: data: blob:; script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' app:; style-src 'self' 'unsafe-inline' app:; font-src 'self' app: data:; img-src 'self' app: data: blob:; media-src 'self' app: data: blob:; worker-src 'self' app: blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self';"
      );

      return new Response(data, {
        status: 200,
        headers,
      });
    } catch (err) {
      console.warn('[app:// protocol] Resource not found:', relPath);
      return new Response('Not Found', { status: 404 });
    }
  });

  createMainWindow();
  createHudWindow();

  // --- 1. HUD Window IPC Handlers ---
  ipcMain.handle('hud:show', (_, { expanded = false } = {}) => {
    if (!hudWindow) return false;
    setHudDimensions(Boolean(expanded));
    hudWindow.showInactive();
    hudWindow.setAlwaysOnTop(true, 'screen-saver');
    return true;
  });

  ipcMain.handle('hud:hide', () => {
    if (!hudWindow) return false;
    hudWindow.hide();
    return false;
  });

  ipcMain.handle('hud:toggle', () => {
    if (!hudWindow) return false;
    if (hudWindow.isVisible()) {
      hudWindow.hide();
      return false;
    } else {
      hudWindow.show();
      hudWindow.setAlwaysOnTop(true, 'screen-saver');
      return true;
    }
  });

  ipcMain.handle('hud:resize', (_, { expanded }) => {
    setHudDimensions(Boolean(expanded));
    return { width: HUD_WIDTH, height: expanded ? HUD_EXPANDED_HEIGHT : HUD_COLLAPSED_HEIGHT };
  });

  ipcMain.handle('hud:is-visible', () => {
    return Boolean(hudWindow && hudWindow.isVisible());
  });

  ipcMain.on('window:show-main', () => {
    showMainWindowSafely();
  });

  ipcMain.handle('window:toggle-fullscreen', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return false;
    const next = !mainWindow.isFullScreen();
    mainWindow.setFullScreen(next);
    return next;
  });

  ipcMain.handle('window:is-fullscreen', () => {
    return Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isFullScreen());
  });

  ipcMain.handle('window:minimize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.minimize();
      return true;
    }
    return false;
  });

  ipcMain.handle('window:toggle-maximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
        return false;
      } else {
        mainWindow.maximize();
        return true;
      }
    }
    return false;
  });

  ipcMain.handle('window:is-maximized', () => {
    return Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isMaximized());
  });

  ipcMain.handle('window:close', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      app.isQuitting = true;
      mainWindow.close();
      return true;
    }
    return false;
  });

  ipcMain.handle('window:set-titlebar-theme', (_event, themeName) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    try {
      mainWindow.setTitleBarOverlay(getTitleBarOverlayOptions(themeName));
    } catch {}
  });

  ipcMain.handle('app:quit', () => {
    app.isQuitting = true;
    app.quit();
  });

  ipcMain.handle('app:minimize-to-tray', () => {
    if (mainWindow) {
      mainWindow.hide();
    }
    return true;
  });

  // --- 2. Atomic Disk Vault Mirroring ---
  ipcMain.handle('vault:get-backup-dir', async () => getBackupDir());

  ipcMain.handle('dialog:pick-directory', async () => {
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Secondary Vault Mirror Directory',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (res.canceled || !res.filePaths || res.filePaths.length === 0) return null;
    return res.filePaths[0];
  });

  ipcMain.handle('vault:write-snapshot', async (_, { filename, payload, secondaryDir }) => {
    if (!SAFE_FILENAME_RE.test(filename)) {
      throw new Error(`Invalid snapshot filename: ${filename}`);
    }
    const backupDir = getBackupDir();
    await fs.mkdir(backupDir, { recursive: true });

    const tempPath = path.join(backupDir, `${filename}.tmp`);
    const finalPath = path.join(backupDir, filename);

    await fs.writeFile(tempPath, payload, 'utf8');
    await fs.rename(tempPath, finalPath);

    try {
      const files = (await fs.readdir(backupDir))
        .filter((f) => SAFE_FILENAME_RE.test(f))
        .sort()
        .reverse();

      if (files.length > 14 && files.length > 3) {
        for (const oldFile of files.slice(Math.max(14, 3))) {
          await fs.unlink(path.join(backupDir, oldFile)).catch(() => {});
        }
      }
    } catch (err) {
      console.error('Snapshot retention warning:', err);
    }

    let secondaryPath = null;
    if (secondaryDir && typeof secondaryDir === 'string') {
      try {
        await fs.mkdir(secondaryDir, { recursive: true });
        const secTemp = path.join(secondaryDir, `${filename}.tmp`);
        const secFinal = path.join(secondaryDir, filename);
        await fs.writeFile(secTemp, payload, 'utf8');
        await fs.rename(secTemp, secFinal);
        secondaryPath = secFinal;
      } catch (secErr) {
        console.warn('[Vault Secondary Mirror] Could not write snapshot to secondary dir:', secErr.message);
      }
    }

    return { success: true, path: finalPath, secondaryPath };
  });

  ipcMain.handle('vault:list-snapshots', async () => {
    const backupDir = getBackupDir();
    await fs.mkdir(backupDir, { recursive: true });
    const files = (await fs.readdir(backupDir))
      .filter((f) => SAFE_FILENAME_RE.test(f))
      .sort()
      .reverse();

    const out = [];
    for (const file of files) {
      const stat = await fs.stat(path.join(backupDir, file));
      out.push({ filename: file, sizeBytes: stat.size, updatedAt: stat.mtime.toISOString() });
    }
    return out;
  });

  ipcMain.handle('vault:read-snapshot', async (_, { filename }) => {
    if (!SAFE_FILENAME_RE.test(filename)) {
      throw new Error(`Invalid snapshot filename: ${filename}`);
    }
    return fs.readFile(path.join(getBackupDir(), filename), 'utf8');
  });

  // --- 3. Secure External URI & App Launcher (Zero cmd.exe, Zero Shell Injection) ---
  ipcMain.handle('shell:open-external', async (_, { url }) => {
    if (!url || typeof url !== 'string') {
      throw new Error('Invalid URL provided to shell:open-external');
    }
    const cleanUrl = url.trim();
    if (!cleanUrl) {
      throw new Error('Empty URL provided to shell:open-external');
    }

    // Disallow control characters to prevent argument/header/newline injections
    if (/[\x00-\x1f\x7f]/.test(cleanUrl)) {
      throw new Error('URL contains forbidden control characters');
    }

    let parsed;
    try {
      parsed = new URL(cleanUrl);
    } catch {
      throw new Error(`Malformed URL provided: ${cleanUrl}`);
    }

    const protocol = parsed.protocol.toLowerCase();

    // Absolute prohibition of local file execution and dangerous custom URI schemes
    const FORBIDDEN_SCHEMES = new Set([
      'file:',
      'javascript:',
      'data:',
      'vbscript:',
      'ms-msdt:',
      'search:',
      'search-ms:',
      'shell:',
      'cmd:',
      'powershell:',
      'calculator:',
      'ws:',
      'wss:',
    ]);

    if (FORBIDDEN_SCHEMES.has(protocol)) {
      console.warn('[Security Guard] Blocked prohibited URI scheme execution:', protocol, cleanUrl);
      throw new Error(`Blocked prohibited URI scheme: ${protocol}`);
    }

    if (!ALLOWED_PROTOCOLS.has(protocol)) {
      console.warn('[Security Guard] Disallowed URI protocol attempt:', protocol, cleanUrl);
      throw new Error(`Disallowed URI protocol: ${protocol}. Only HTTP/HTTPS and approved workspace apps allowed.`);
    }

    await shell.openExternal(cleanUrl);
    return { opened: true };
  });

  ipcMain.handle('shell:open-in-browser', async (_, { url, browser }) => {
    if (!url || typeof url !== 'string') {
      throw new Error('Invalid URL');
    }
    // Disallow control characters to prevent argument/header injections
    if (/[\x00-\x1f\x7f]/.test(url)) {
      throw new Error('URL contains forbidden control characters');
    }

    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error('Malformed URL provided');
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Only HTTP/HTTPS protocols allowed for web browser launch, got: ${parsed.protocol}`);
    }

    if (!browser || browser === 'system' || browser === 'default') {
      await shell.openExternal(url);
      return { opened: true };
    }

    // Spawn browser executable directly with shell: false — never through cmd.exe
    const { spawn } = require('child_process');
    const candidates = findBrowserExecutables(browser);

    for (const exePath of candidates) {
      try {
        const child = spawn(exePath, [url], {
          detached: true,
          stdio: 'ignore',
          shell: false,
          windowsHide: false,
        });
        child.unref();
        return { opened: true };
      } catch {
        continue;
      }
    }

    // Safe fallback to OS default browser via Electron native shell
    await shell.openExternal(url);
    return { opened: true, fallback: true };
  });

  ipcMain.handle('shell:launch-native-app', async (_, { path: appPath }) => {
    if (!appPath || typeof appPath !== 'string') {
      throw new Error('Invalid executable path');
    }

    // Strictly disallow shell metacharacters and control characters
    if (/[\x00-\x1f\x7f&|;><^%\r\n]/.test(appPath)) {
      throw new Error('Executable path contains forbidden shell characters');
    }

    const resolved = path.resolve(appPath);
    const ext = path.extname(resolved).toLowerCase();
    const allowedExts = new Set(['.exe', '.lnk', '.bat', '.cmd']);
    if (!allowedExts.has(ext)) {
      throw new Error(`Forbidden file extension for native app: ${ext}`);
    }

    // Verify target file actually exists on local filesystem
    try {
      await fs.stat(resolved);
    } catch {
      throw new Error(`File does not exist on disk: ${resolved}`);
    }

    // If shortcut or script, open safely via Windows ShellExecuteEx without cmd.exe
    if (ext === '.lnk' || ext === '.bat' || ext === '.cmd') {
      await shell.openPath(resolved);
      return { launched: true };
    }

    // Directly spawn native executable without shell: false and dropping arbitrary renderer args
    const { spawn } = require('child_process');
    const child = spawn(resolved, [], {
      detached: true,
      stdio: 'ignore',
      shell: false,
      windowsHide: false,
    });
    child.unref();
    return { launched: true };
  });

  ipcMain.handle('dialog:pick-app', async () => {
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Application Executable or Shortcut',
      properties: ['openFile'],
      filters: [
        { name: 'Executables & Shortcuts (*.exe, *.lnk, *.bat)', extensions: ['exe', 'lnk', 'bat', 'cmd'] },
        { name: 'All Files (*.*)', extensions: ['*'] },
      ],
    });
    if (res.canceled || !res.filePaths || res.filePaths.length === 0) return null;
    return res.filePaths[0];
  });

  // --- 4. Windows System-Wide Application Screen Time Tracker ---
  let currentForegroundApp = 'FocusSpace';
  let currentForegroundTitle = 'FocusSpace';
  let lastForegroundChangeTime = Date.now();
  const appUsageToday = {};

  function categorizeApp(name) {
    const n = (name || '').toLowerCase();
    if (['code', 'cursor', 'devenv', 'idea64', 'pycharm64', 'sublime_text', 'windowsterminal', 'cmd', 'powershell', 'git-bash', 'wt'].includes(n)) {
      return 'Coding & Development';
    }
    if (['focusspace', 'obsidian', 'notion', 'winword', 'excel', 'powerpnt', 'acrord32', 'figma', 'linear', 'todoist'].includes(n)) {
      return 'Productivity & Planning';
    }
    if (['chrome', 'msedge', 'firefox', 'brave', 'opera', 'vivaldi', 'arc', 'floorp', 'zen'].includes(n)) {
      return 'Web & Research';
    }
    if (['discord', 'slack', 'teams', 'telegram', 'whatsapp', 'skype', 'outlook'].includes(n)) {
      return 'Communication';
    }
    if (['spotify', 'vlc', 'netflix', 'steam', 'epicgameslauncher', 'discordcanary'].includes(n)) {
      return 'Media & Audio';
    }
    return 'General Application';
  }

  const DISTRACTION_APPS = new Set([
    'steam',
    'epicgameslauncher',
    'discordcanary',
    'netflix',
    'vlc',
    'tiktok',
    'roblox',
    'riotclientservices',
    'leagueclient',
  ]);

  const DISTRACTION_TITLE_RE = /(youtube|twitter|x\.com|reddit|twitch|instagram|tiktok|facebook|netflix|hulu|disney\+|prime video|9gag|buzzfeed|pinterest|kick\.com)/i;

  function isDistractionApp(procName, title) {
    const p = (procName || '').toLowerCase();
    if (DISTRACTION_APPS.has(p)) return true;
    const t = (title || '').toLowerCase();
    if (DISTRACTION_TITLE_RE.test(t)) return true;
    return false;
  }

  let consecutiveDistractionSeconds = 0;

  function startSystemAppTracker() {
    if (process.platform !== 'win32') return;

    const { spawn } = require('child_process');

    const trackerScript = `
$code = @'
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Diagnostics;

public class Win32Active {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    public static string GetForeground() {
        IntPtr hwnd = GetForegroundWindow();
        if (hwnd == IntPtr.Zero) return "Idle|Idle";
        uint pid = 0;
        GetWindowThreadProcessId(hwnd, out pid);
        if (pid == 0) return "Idle|Idle";
        try {
            Process p = Process.GetProcessById((int)pid);
            string name = p.ProcessName;
            StringBuilder sb = new StringBuilder(256);
            GetWindowText(hwnd, sb, 256);
            string title = sb.ToString().Trim();
            return name + "|" + (string.IsNullOrEmpty(title) ? name : title);
        } catch {
            return "Unknown|Unknown";
        }
    }
}
'@
try { Add-Type -TypeDefinition $code -ErrorAction Stop } catch {}
while ($true) {
    try {
        $res = [Win32Active]::GetForeground()
        [Console]::WriteLine($res)
        [Console]::Out.Flush()
    } catch {}
    Start-Sleep -Seconds 2
}
`;

    try {
      const encodedCommand = Buffer.from(trackerScript, 'utf16le').toString('base64');
      systemTrackerProc = spawn('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-EncodedCommand',
        encodedCommand,
      ], {
        stdio: ['ignore', 'pipe', 'ignore'],
        shell: false,
        windowsHide: true,
      });

      let stdoutBuffer = '';
      systemTrackerProc.stdout.on('data', (chunk) => {
        stdoutBuffer += chunk.toString();
        const lines = stdoutBuffer.split(/\r?\n/);
        stdoutBuffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const [procName, windowTitle] = trimmed.split('|');
          if (!procName) continue;

          const now = Date.now();
          const elapsedSec = Math.round((now - lastForegroundChangeTime) / 1000);
          lastForegroundChangeTime = now;

          if (currentForegroundApp && currentForegroundApp !== 'Idle' && elapsedSec > 0 && elapsedSec < 600) {
            if (!appUsageToday[currentForegroundApp]) {
              appUsageToday[currentForegroundApp] = {
                name: currentForegroundApp,
                seconds: 0,
                title: currentForegroundTitle,
                category: categorizeApp(currentForegroundApp),
              };
            }
            appUsageToday[currentForegroundApp].seconds += elapsedSec;
            if (windowTitle && windowTitle !== currentForegroundApp) {
              appUsageToday[currentForegroundApp].title = windowTitle;
            }

            if (isDistractionApp(currentForegroundApp, currentForegroundTitle)) {
              consecutiveDistractionSeconds += elapsedSec;
            } else {
              consecutiveDistractionSeconds = 0;
            }
          }

          currentForegroundApp = procName;
          currentForegroundTitle = windowTitle || procName;
        }
      });

      systemTrackerProc.on('error', (err) => {
        console.warn('[SystemAppTracker] Process error:', err.message);
      });
    } catch (err) {
      console.warn('[SystemAppTracker] Failed to start:', err.message);
    }
  }

  startSystemAppTracker();

  ipcMain.handle('screentime:get-system-apps', async () => {
    const now = Date.now();
    const elapsedSec = Math.round((now - lastForegroundChangeTime) / 1000);
    if (currentForegroundApp && currentForegroundApp !== 'Idle' && elapsedSec > 0 && elapsedSec < 600) {
      if (!appUsageToday[currentForegroundApp]) {
        appUsageToday[currentForegroundApp] = {
          name: currentForegroundApp,
          seconds: 0,
          title: currentForegroundTitle,
          category: categorizeApp(currentForegroundApp),
        };
      }
      appUsageToday[currentForegroundApp].seconds += elapsedSec;
      if (isDistractionApp(currentForegroundApp, currentForegroundTitle)) {
        consecutiveDistractionSeconds += elapsedSec;
      } else {
        consecutiveDistractionSeconds = 0;
      }
      lastForegroundChangeTime = now;
    }

    const list = Object.values(appUsageToday).map(item => ({
      name: item.name,
      displayName: item.name === 'Code' ? 'Visual Studio Code'
        : item.name === 'chrome' ? 'Google Chrome'
        : item.name === 'msedge' ? 'Microsoft Edge'
        : item.name === 'FocusSpace' ? 'FocusSpace'
        : item.name,
      title: item.title,
      seconds: item.seconds,
      category: item.category,
      isCurrent: (currentForegroundApp || '').toLowerCase() === item.name.toLowerCase(),
    })).sort((a, b) => b.seconds - a.seconds);

    return {
      supported: process.platform === 'win32',
      activeApp: currentForegroundApp,
      activeTitle: currentForegroundTitle,
      isDistraction: isDistractionApp(currentForegroundApp, currentForegroundTitle),
      distractionSeconds: consecutiveDistractionSeconds,
      apps: list,
    };
  });

  // --- 5. Conflict-Free Global Hotkeys ---
  const regSpace = globalShortcut.register('CommandOrControl+Alt+Space', () => {
    if (hudWindow && !hudWindow.isDestroyed()) {
      if (!hudWindow.isVisible()) {
        hudWindow.show();
      }
      setHudDimensions(true);
      hudWindow.focus();
      hudWindow.setAlwaysOnTop(true, 'screen-saver');
      hudWindow.webContents.send('hud:quick-capture', { dictate: true });
    } else {
      showMainWindowSafely();
    }
  });
  if (!regSpace) {
    console.warn('[Hotkeys] Failed to register CommandOrControl+Alt+Space');
  }

  const regHud = globalShortcut.register('CommandOrControl+Alt+H', () => {
    if (!hudWindow || hudWindow.isDestroyed()) return;
    if (hudWindow.isVisible()) {
      hudWindow.hide();
    } else {
      hudWindow.show();
      hudWindow.setAlwaysOnTop(true, 'screen-saver');
    }
  });
  if (!regHud) {
    console.warn('[Hotkeys] Failed to register CommandOrControl+Alt+H');
  }

  const regDash = globalShortcut.register('CommandOrControl+Alt+D', () => {
    showMainWindowSafely();
  });
  if (!regDash) {
    console.warn('[Hotkeys] Failed to register CommandOrControl+Alt+D');
  }

  // --- 5. System Tray ---
  try {
    tray = new Tray(path.join(__dirname, '../public/icon-192.png'));
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Open FocusSpace',
        click: () => {
          showMainWindowSafely();
        },
      },
      {
        label: 'Toggle Floating HUD (Ctrl+Alt+H)',
        click: () => {
          if (!hudWindow || hudWindow.isDestroyed()) return;
          if (hudWindow.isVisible()) hudWindow.hide();
          else hudWindow.show();
        },
      },
      { type: 'separator' },
      {
        label: 'Quit FocusSpace',
        click: () => {
          app.isQuitting = true;
          app.quit();
        },
      },
    ]);
    tray.setToolTip('FocusSpace');
    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => {
      showMainWindowSafely();
    });
  } catch (err) {
    console.error('System tray error:', err);
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
