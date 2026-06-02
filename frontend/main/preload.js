const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
  onUpdateDownloaded: (callback) => {
    const listener = (event, value) => callback(value);
    ipcRenderer.on('update-downloaded', listener);
    return () => {
      ipcRenderer.removeListener('update-downloaded', listener);
    };
  },
  installUpdate: () => ipcRenderer.send('install-update')
});
