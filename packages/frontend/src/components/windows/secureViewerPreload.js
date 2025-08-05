const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('secureViewerAPI', {
  getFileData: () => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('file');
  }
});