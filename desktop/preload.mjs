import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("noxDesktop", {
  version: "1.2.0",
  hasEngine: true,
  standalone: true,
  probe: (url) => ipcRenderer.invoke("nox:probe", url),
  play: (opts) => ipcRenderer.invoke("nox:play", opts),
  stop: () => ipcRenderer.invoke("nox:stop"),
  checkForUpdates: () => ipcRenderer.invoke("nox:update-check"),
  installUpdate: () => ipcRenderer.invoke("nox:update-install"),
  onUpdateStatus: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("nox:update-status", listener);
    return () => ipcRenderer.removeListener("nox:update-status", listener);
  },
});
