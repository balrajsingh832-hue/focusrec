const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getSources: () => ipcRenderer.invoke('get-sources'),
  getSavePath: (filename) => ipcRenderer.invoke('get-save-path', filename),
  saveVideo: (data) => ipcRenderer.invoke('save-video', data),
  showOverlay: () => ipcRenderer.send('show-overlay'),
  hideOverlay: () => ipcRenderer.send('hide-overlay'),
  updateCursor: (pos) => ipcRenderer.send('update-cursor', pos),
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
  onCursorPos: (cb) => ipcRenderer.on('cursor-pos', (e, pos) => cb(pos)),
  onOverlayShow: (cb) => ipcRenderer.on('overlay-show', cb),
  onOverlayHide: (cb) => ipcRenderer.on('overlay-hide', cb),
});
