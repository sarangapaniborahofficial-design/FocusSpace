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

// Dimensions: 320x76 (collapsed) and 320x290 (expanded) + 12px shadow canvas padding
const HUD_WIDTH = 332;
const HUD_COLLAPSED_HEIGHT = 88;
const HUD_EXPANDED_HEIGHT = 302;

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

function getBackupDir() {
  return path.join(app.getPath('userData'), 'Backups');
}

function getAppUrl(query = '') {
  if (isDev) {
    return `http://localhost:5173/${query}`;
  }
  return `app://focusspace/index.html${query}`;
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
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false, // Keep Pomodoro & BroadcastChannel running at full speed when minimized to tray
    },
  });

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
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  // Pin above all standard desktop apps and IDEs
  hudWindow.setAlwaysOnTop(true, 'screen-saver');
  hudWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

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

app.whenReady().then(() => {
  // Serve bundled dist/ files via app://focusspace/ with COOP/COEP headers for WASM threads
  protocol.handle('app', async (request) => {
    const url = new URL(request.url);
    let relPath = decodeURIComponent(url.pathname);
    if (relPath === '/' || relPath === '') relPath = '/index.html';

    const distPath = path.join(__dirname, '../dist', relPath);
    const response = await net.fetch(pathToFileURL(distPath).toString());

    const headers = new Headers(response.headers);
    headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
    headers.set('Cross-Origin-Resource-Policy', 'same-origin');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
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
      mainWindow.show();
      mainWindow.focus();
    }
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

  // --- 3. Native URI & App Launcher ---
  ipcMain.handle('shell:open-external', async (_, { url }) => {
    const parsed = new URL(url);
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      throw new Error(`Disallowed URI protocol: ${parsed.protocol}`);
    }
    await shell.openExternal(url);
    return { opened: true };
  });

  // --- 4. Conflict-Free Global Hotkeys ---
  globalShortcut.register('CommandOrControl+Alt+Space', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  globalShortcut.register('CommandOrControl+Alt+H', () => {
    if (!hudWindow) return;
    if (hudWindow.isVisible()) hudWindow.hide();
    else {
      hudWindow.show();
      hudWindow.setAlwaysOnTop(true, 'screen-saver');
    }
  });

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
