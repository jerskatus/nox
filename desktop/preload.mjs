import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("noxDesktop", {
  version: "1.1.0",
  hasEngine: true,
  probe: (url) => ipcRenderer.invoke("nox:probe", url),
  play: (opts) => ipcRenderer.invoke("nox:play", opts),
  stop: () => ipcRenderer.invoke("nox:stop"),
});
