const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  onUpdateStatus: (callback) => {
    const cb = (event, data) => callback(data);
    ipcRenderer.on('update_status', cb);
    return () => ipcRenderer.removeListener('update_status', cb);
  },
  onUpdateProgress: (callback) => {
    const cb = (event, data) => callback(data);
    ipcRenderer.on('update_progress', cb);
    return () => ipcRenderer.removeListener('update_progress', cb);
  }
});