import electronUpdater from "electron-updater";
import { BrowserWindow, dialog, app, shell } from "electron";

const { autoUpdater } = electronUpdater;

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowDowngrade = false;

let checking = false;
let downloaded = false;
let status = "idle";

function send(payload) {
  status = payload.status;
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("nox:update-status", payload);
  }
}

function watching() {
  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  if (!win || win.isDestroyed()) return false;
  try {
    return new URL(win.webContents.getURL()).pathname.startsWith("/watch");
  } catch {
    return false;
  }
}

async function offerInstall() {
  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  if (!win || win.isDestroyed()) return;
  if (watching()) {
    send({ status: "ready", message: "Update ready — it installs when you quit Nox." });
    return;
  }
  const result = await dialog.showMessageBox(win, {
    type: "info",
    title: "Nox update",
    message: "A new version of Nox is ready.",
    detail: "Restart now to install it. If you are in the middle of something, you can wait — it will install the next time you quit.",
    buttons: ["Restart now", "Later"],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  });
  if (result.response === 0) autoUpdater.quitAndInstall(false, true);
}

export function attachUpdater() {
  autoUpdater.setFeedURL({
    provider: "github",
    owner: "jerskatus",
    repo: "nox",
  });
  autoUpdater.on("checking-for-update", () => send({ status: "checking", message: "Checking for updates…" }));
  autoUpdater.on("update-available", (info) => {
    send({ status: "available", version: info.version, message: `Downloading Nox ${info.version}…` });
  });
  autoUpdater.on("update-not-available", () => send({ status: "idle", message: "Nox is up to date." }));
  autoUpdater.on("download-progress", (progress) => {
    send({
      status: "downloading",
      percent: Math.round(progress.percent),
      message: `Downloading update… ${Math.round(progress.percent)}%`,
    });
  });
  autoUpdater.on("update-downloaded", (info) => {
    downloaded = true;
    send({ status: "ready", version: info.version, message: `Nox ${info.version} is ready to install.` });
    void offerInstall();
  });
  autoUpdater.on("error", (error) => {
    checking = false;
    send({ status: "error", message: error instanceof Error ? error.message : "Update check failed." });
  });
}

export async function checkForUpdates({ silent = false } = {}) {
  if (!app.isPackaged) {
    if (!silent) send({ status: "idle", message: "Updates only run from an installed build." });
    return { status: "dev" };
  }
  if (checking) return { status };
  checking = true;
  send({ status: "checking", message: "Checking for updates…" });
  try {
    const result = await autoUpdater.checkForUpdates();
    checking = false;
    if (downloaded) return { status: "ready" };
    if (!result?.updateInfo) return { status: "idle" };
    if (result.updateInfo.version === app.getVersion()) {
      if (!silent) send({ status: "idle", message: "Nox is up to date." });
      return { status: "idle" };
    }
    return { status: "available", version: result.updateInfo.version };
  } catch (error) {
    checking = false;
    const raw = error instanceof Error ? error.message : "Update check failed.";
    const message = /404|not found|Cannot find channel|latest\.yml|HttpError: 404/i.test(raw)
      ? "Nox could not reach the update feed. Download the latest installer from Options if this keeps happening."
      : raw;
    send({ status: "error", message });
    if (!silent) {
      const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      if (win && !win.isDestroyed()) {
        const choice = await dialog.showMessageBox(win, {
          type: "info",
          title: "Check for updates",
          message: "Could not check for updates automatically.",
          detail: "You can download the latest installer from the Nox releases page.",
          buttons: ["Open downloads", "Cancel"],
          defaultId: 0,
          cancelId: 1,
          noLink: true,
        });
        if (choice.response === 0) {
          void shell.openExternal("https://github.com/jerskatus/nox/releases/latest");
        }
      }
    }
    return { status: "error", message };
  }
}

export function installUpdate() {
  if (downloaded) autoUpdater.quitAndInstall(false, true);
}

export function updateStatus() {
  return status;
}
