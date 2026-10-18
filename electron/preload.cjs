const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

  // Vault Disk Snapshots
  writeSnapshot: (filename, payload, secondaryDir) =>
    ipcRenderer.invoke('vault:write-snapshot', { filename, payload, secondaryDir }),
  listSnapshots: () =>
    ipcRenderer.invoke('vault:list-snapshots'),
  readSnapshot: (filename) =>
    ipcRenderer.invoke('vault:read-snapshot', { filename }),
  getBackupDir: () =>
    ipcRenderer.invoke('vault:get-backup-dir'),
  pickDirectory: () =>
    ipcRenderer.invoke('dialog:pick-directory'),

  // Floating HUD Controls
  showHud: (expanded = false) =>
    ipcRenderer.invoke('hud:show', { expanded }),
  hideHud: () =>
    ipcRenderer.invoke('hud:hide'),
  toggleHud: () =>
    ipcRenderer.invoke('hud:toggle'),
  resizeHud: (expanded) =>
    ipcRenderer.invoke('hud:resize', { expanded }),
  isHudVisible: () =>
    ipcRenderer.invoke('hud:is-visible'),
  onQuickCapture: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('hud:quick-capture', handler);
    return () => ipcRenderer.removeListener('hud:quick-capture', handler);
  },

  // Main Window Controls & Power
  showMainWindow: () =>
    ipcRenderer.send('window:show-main'),
  toggleFullscreen: () =>
    ipcRenderer.invoke('window:toggle-fullscreen'),
  isFullscreen: () =>
    ipcRenderer.invoke('window:is-fullscreen'),
  quitApp: () =>
    ipcRenderer.invoke('app:quit'),
  minimizeToTray: () =>
    ipcRenderer.invoke('app:minimize-to-tray'),
  minimizeWindow: () =>
    ipcRenderer.invoke('window:minimize'),
  toggleMaximizeWindow: () =>
    ipcRenderer.invoke('window:toggle-maximize'),
  isWindowMaximized: () =>
    ipcRenderer.invoke('window:is-maximized'),
  closeWindow: () =>
    ipcRenderer.invoke('window:close'),
  setTitleBarTheme: (themeName) =>
    ipcRenderer.invoke('window:set-titlebar-theme', themeName),
  onWindowCloseRequested: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('window:request-close', handler);
    return () => ipcRenderer.removeListener('window:request-close', handler);
  },
  onMaximizeChange: (callback) => {
    const handler = (_event, isMaximized) => callback(isMaximized);
    ipcRenderer.on('window:maximize-changed', handler);
    return () => ipcRenderer.removeListener('window:maximize-changed', handler);
  },
  onMainWindowLifecycle: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('main-window:lifecycle', handler);
    return () => ipcRenderer.removeListener('main-window:lifecycle', handler);
  },

  // External App Launching & File Selection
  openExternal: (url) =>
    ipcRenderer.invoke('shell:open-external', { url }),
  openInBrowser: (url, browser) =>
    ipcRenderer.invoke('shell:open-in-browser', { url, browser }),
  launchNativeApp: (path) =>
    ipcRenderer.invoke('shell:launch-native-app', { path }),
  pickAppFile: () =>
    ipcRenderer.invoke('dialog:pick-app'),

  // System-wide Active Application Usage
  getSystemApps: () =>
    ipcRenderer.invoke('screentime:get-system-apps'),
});
