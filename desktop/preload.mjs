import { contextBridge, ipcRenderer } from "electron";

const win32 = process.platform === "win32";

contextBridge.exposeInMainWorld("noxDesktop", {
  version: "1.3.6",
  hasEngine: true,
  hasVlc: win32,
  standalone: true,
  probe: (url) => ipcRenderer.invoke("nox:probe", url),
  play: (opts) => ipcRenderer.invoke("nox:play", opts),
  stop: () => ipcRenderer.invoke("nox:stop"),
  vlcPlay: win32 ? (opts) => ipcRenderer.invoke("nox:vlc-play", opts) : undefined,
  vlcPause: win32 ? () => ipcRenderer.invoke("nox:vlc-pause") : undefined,
  vlcResume: win32 ? () => ipcRenderer.invoke("nox:vlc-resume") : undefined,
  vlcStop: win32 ? () => ipcRenderer.invoke("nox:vlc-stop") : undefined,
  vlcSeek: win32 ? (ms) => ipcRenderer.invoke("nox:vlc-seek", ms) : undefined,
  vlcVolume: win32 ? (opts) => ipcRenderer.invoke("nox:vlc-volume", opts) : undefined,
  vlcRate: win32 ? (rate) => ipcRenderer.invoke("nox:vlc-rate", rate) : undefined,
  vlcAudio: win32 ? (track) => ipcRenderer.invoke("nox:vlc-audio", track) : undefined,
  vlcFit: win32 ? (opts) => ipcRenderer.invoke("nox:vlc-fit", opts) : undefined,
  vlcBounds: win32 ? (bounds) => ipcRenderer.invoke("nox:vlc-bounds", bounds) : undefined,
  onVlcEvent: win32
    ? (callback) => {
        const listener = (_event, payload) => callback(payload);
        ipcRenderer.on("nox:vlc-event", listener);
        return () => ipcRenderer.removeListener("nox:vlc-event", listener);
      }
    : undefined,
  checkForUpdates: () => ipcRenderer.invoke("nox:update-check"),
  installUpdate: () => ipcRenderer.invoke("nox:update-install"),
  onUpdateStatus: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("nox:update-status", listener);
    return () => ipcRenderer.removeListener("nox:update-status", listener);
  },
  persistGet: (key) => ipcRenderer.invoke("nox:persist-get", key),
  persistSet: (key, value) => ipcRenderer.invoke("nox:persist-set", key, value),
  persistRemove: (key) => ipcRenderer.invoke("nox:persist-remove", key),
});
