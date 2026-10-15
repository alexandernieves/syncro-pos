const { contextBridge, ipcRenderer } = require('electron');

// What the Syncro panel can ask of the desktop app. The main process checks who is asking.
contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
  isDesktop: true,
  printHtml: (html, paper) => ipcRenderer.invoke('print-html', { html, paper }),
  printerInfo: () => ipcRenderer.invoke('printer-info'),
  onUpdateDownloaded: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('update-downloaded', listener);
    return () => ipcRenderer.removeListener('update-downloaded', listener);
  },
  // Update badge: { state: 'idle' | 'downloading' | 'ready' | 'error', version, percent }
  updateStatus: () => ipcRenderer.invoke('update-status'),
  onUpdateStatus: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('update-status', listener);
    return () => ipcRenderer.removeListener('update-status', listener);
  },
  installUpdate: () => ipcRenderer.send('install-update'),
  checkUpdates: () => ipcRenderer.send('check-updates'),
  // Only for the server setup page
  saveServer: (url) => ipcRenderer.invoke('save-server', url),
  retry: () => ipcRenderer.invoke('retry'),
});
