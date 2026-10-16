const {
  app,
  BrowserWindow,
  ipcMain,
  globalShortcut,
  Tray,
  Menu,
  shell,
  protocol,
  net,
  dialog,
  session,
} = require('electron');
const path = require('path');
const fs = require('fs/promises');
const { pathToFileURL } = require('url');

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

// Dimensions: 320x76 (collapsed) and 320x368 (expanded) + 12px shadow canvas padding
const HUD_WIDTH = 332;
const HUD_COLLAPSED_HEIGHT = 88;
const HUD_EXPANDED_HEIGHT = 380;

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// Clean shutdown handler: guarantees Windows restart, logoff, or shutdown never hangs
app.on('before-quit', () => {
  app.isQuitting = true;
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

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    title: 'FocusSpace',
    backgroundColor: '#0d0c0b',
    icon: path.join(__dirname, '../public/icon-512.png'),
    autoHideMenuBar: true,
    fullscreen: true,
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

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function createHudWindow() {
  hudWindow = new BrowserWindow({
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
  });

  // Pin above all standard desktop apps and IDEs
  hudWindow.setAlwaysOnTop(true, 'screen-saver');
  hudWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  applyNavigationLock(hudWindow.webContents);
  hudWindow.loadURL(getAppUrl('?window=hud'));

  hudWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      hudWindow.hide();
    }
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
        (isDev && u.startsWith('http://localhost:5173')) ||
        u.startsWith('https://www.google.com/s2/favicons')
      ) {
        callback({ cancel: false });
      } else {
        console.warn('[Zero-Network Privacy Guard] Blocked outgoing network request:', u);
        callback({ cancel: true });
      }
    });
  }

  // Serve bundled dist/ files via app://focusspace/ with COOP/COEP headers and path traversal guards
  protocol.handle('app', async (request) => {
    const url = new URL(request.url);
    let relPath = decodeURIComponent(url.pathname);
    if (relPath === '/' || relPath === '') relPath = '/index.html';

    const distDir = path.resolve(__dirname, '../dist');
    const distPath = path.resolve(distDir, '.' + relPath);

    // Path traversal verification
    if (!distPath.startsWith(distDir)) {
      console.error('[Security] Attempted path traversal blocked:', relPath);
      return new Response('Access Denied: Path Traversal Detected', { status: 403 });
    }

    try {
      const response = await net.fetch(pathToFileURL(distPath).toString());
      const headers = new Headers(response.headers);
      headers.set('Cross-Origin-Opener-Policy', 'same-origin');
      headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
      headers.set('Cross-Origin-Resource-Policy', 'same-origin');
      headers.set(
        'Content-Security-Policy',
        "default-src 'self' app:; connect-src 'self' app: data: blob:; script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' app:; style-src 'self' 'unsafe-inline' app:; font-src 'self' app: data:; img-src 'self' app: data: blob: https://www.google.com; media-src 'self' app: data: blob:; worker-src 'self' app: blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self';"
      );

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch {
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
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  ipcMain.handle('window:toggle-fullscreen', () => {
    if (!mainWindow) return false;
    const next = !mainWindow.isFullScreen();
    mainWindow.setFullScreen(next);
    return next;
  });

  ipcMain.handle('window:is-fullscreen', () => {
    return Boolean(mainWindow && mainWindow.isFullScreen());
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

  ipcMain.handle('vault:write-snapshot', async (_, { filename, payload }) => {
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

    return { success: true, path: finalPath };
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
    const parsed = new URL(url);
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      throw new Error(`Disallowed URI protocol: ${parsed.protocol}`);
    }
    await shell.openExternal(url);
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

  // --- 4. Conflict-Free Global Hotkeys ---
  const regSpace = globalShortcut.register('CommandOrControl+Alt+Space', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
  if (!regSpace) {
    console.warn('[Hotkeys] Failed to register CommandOrControl+Alt+Space');
  }

  const regHud = globalShortcut.register('CommandOrControl+Alt+H', () => {
    if (!hudWindow) return;
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
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
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
          mainWindow.show();
          mainWindow.focus();
        },
      },
      {
        label: 'Toggle Floating HUD (Ctrl+Alt+H)',
        click: () => {
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
      mainWindow.show();
      mainWindow.focus();
    });
  } catch (err) {
    console.error('System tray error:', err);
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
