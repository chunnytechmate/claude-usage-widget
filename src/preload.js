'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlay', {
  onUsage: (cb) => ipcRenderer.on('usage-update', (_e, data) => cb(data)),
  refresh: () => ipcRenderer.send('refresh'),
  hide: () => ipcRenderer.send('hide-app'),
  quit: () => ipcRenderer.send('close-app'),
  getConfig: () => ipcRenderer.invoke('get-config'),
  setSize: (w, h) => ipcRenderer.send('set-size', { w, h }),
  setCollapsed: (b) => ipcRenderer.send('set-collapsed', b),
});
