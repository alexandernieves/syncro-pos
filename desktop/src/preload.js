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
  // Remote assistance: real mouse and keyboard events, only inside this window
  remoteInput: (event) => ipcRenderer.send('remote-input', event),
  checkUpdates: () => ipcRenderer.send('check-updates'),
  // Face reader bridge running in this app (Gimnasio → Control de acceso)
  gymBridge: {
    get: () => ipcRenderer.invoke('gym-bridge:get'),
    test: (input) => ipcRenderer.invoke('gym-bridge:test', input),
    save: (input) => ipcRenderer.invoke('gym-bridge:save', input),
    stop: () => ipcRenderer.invoke('gym-bridge:stop'),
    resume: () => ipcRenderer.invoke('gym-bridge:resume'),
    onStatus: (callback) => {
      const listener = (_event, value) => callback(value);
      ipcRenderer.on('gym-bridge:status', listener);
      return () => ipcRenderer.removeListener('gym-bridge:status', listener);
    },
  },
  // Only for the server setup page
  saveServer: (url) => ipcRenderer.invoke('save-server', url),
  retry: () => ipcRenderer.invoke('retry'),
});
