const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

  // Vault Disk Snapshots
  writeSnapshot: (filename, payload) =>
    ipcRenderer.invoke('vault:write-snapshot', { filename, payload }),
  listSnapshots: () =>
    ipcRenderer.invoke('vault:list-snapshots'),
  readSnapshot: (filename) =>
    ipcRenderer.invoke('vault:read-snapshot', { filename }),
  getBackupDir: () =>
    ipcRenderer.invoke('vault:get-backup-dir'),

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

  // External App Launching & File Selection
  openExternal: (url) =>
    ipcRenderer.invoke('shell:open-external', { url }),
  openInBrowser: (url, browser) =>
    ipcRenderer.invoke('shell:open-in-browser', { url, browser }),
  launchNativeApp: (path) =>
    ipcRenderer.invoke('shell:launch-native-app', { path }),
  pickAppFile: () =>
    ipcRenderer.invoke('dialog:pick-app'),
});
