const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Filesystem
  readDir: (dirPath) => ipcRenderer.invoke('fs:readDir', dirPath),
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('fs:writeFile', filePath, content),
  newFile: (dirPath) => ipcRenderer.invoke('fs:newFile', dirPath),
  renameFile: (oldPath, newPath) => ipcRenderer.invoke('fs:renameFile', oldPath, newPath),
  deleteFile: (filePath) => ipcRenderer.invoke('fs:deleteFile', filePath),
  showConfirm: (message, detail) => ipcRenderer.invoke('dialog:confirm', message, detail),

  // Menu events → renderer
  onMenuEvent: (event, cb) => {
    ipcRenderer.on(event, cb);
    return () => ipcRenderer.removeListener(event, cb);
  },

  // Image paste
  saveImage: (filePath, base64Data, ext) => ipcRenderer.invoke('fs:saveImage', filePath, base64Data, ext),
  cleanImages: (filePath) => ipcRenderer.invoke('fs:cleanImages', filePath),

  // Settings persistence
  getSetting: (key) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),

  // Folder open (can be triggered from renderer button too)
  openFolderDialog: () => ipcRenderer.invoke('dialog:openFolder'),
  onFolderOpened: (cb) => {
    ipcRenderer.on('folder:opened', (_, p) => cb(p));
    return () => ipcRenderer.removeAllListeners('folder:opened');
  },
});
