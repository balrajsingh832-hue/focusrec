const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  getSources: () => ipcRenderer.invoke('get-sources'),
  getSavePath: (f) => ipcRenderer.invoke('get-save-path', f),
  saveVideo: (d) => ipcRenderer.invoke('save-video', d),
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
});
