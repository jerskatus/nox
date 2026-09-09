import { app, BrowserWindow, Menu, shell, session, ipcMain, dialog } from "electron";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createEngine, registerPrivilegedSchemes } from "./engine.mjs";
import { hasLocalCatalog, startCatalog, stopCatalog } from "./catalog.mjs";
import { attachUpdater, checkForUpdates, installUpdate } from "./updater.mjs";
import { attachPersist } from "./persist.mjs";
import { createVlc } from "./vlc.mjs";

const root = dirname(fileURLToPath(import.meta.url));
registerPrivilegedSchemes();

const CHECK_MS = 4 * 60 * 60 * 1000;

/** @type {BrowserWindow | null} */
let win = null;
/** @type {{ url: string, port: number, child: import("node:child_process").ChildProcess } | null} */
let catalog = null;
let startUrl = "";

function remoteOverride() {
  const fromEnv = process.env.NOX_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  try {
    const raw = JSON.parse(readFileSync(join(root, "config.json"), "utf8"));
    if (typeof raw.url === "string" && /^https?:\/\//.test(raw.url)) {
      return raw.url.replace(/\/$/, "");
    }
  } catch {
    /* bundled default is local */
  }
  return "";
}

function boundsPath() {
  return join(app.getPath("userData"), "window.json");
}

function loadBounds() {
  try {
    const raw = JSON.parse(readFileSync(boundsPath(), "utf8"));
    if (raw && typeof raw.width === "number" && typeof raw.height === "number") return raw;
  } catch {
    /* first launch */
  }
  return { width: 1440, height: 900 };
}

function saveBounds() {
  if (!win || win.isDestroyed()) return;
  const bounds = win.getBounds();
  writeFileSync(
    boundsPath(),
    JSON.stringify({ ...bounds, isMaximized: win.isMaximized() }),
  );
}

function isAppUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "file:") return true;
    if (parsed.protocol === "noxmedia:") return true;
    if (!startUrl) return false;
    return parsed.origin === new URL(startUrl).origin;
  } catch {
    return false;
  }
}

function openExternal(url) {
  if (!url) return;
  if (url.startsWith("magnet:") || url.startsWith("stremio:") || url.startsWith("http")) {
    void shell.openExternal(url);
  }
}

function attachWindow(next) {
  win = next;
  next.on("close", saveBounds);
  next.on("closed", () => {
    if (win === next) win = null;
  });

  next.webContents.setWindowOpenHandler(({ url }) => {
    if (isAppUrl(url)) return { action: "allow" };
    openExternal(url);
    return { action: "deny" };
  });

  next.webContents.on("will-navigate", (event, url) => {
    if (isAppUrl(url)) return;
    event.preventDefault();
    openExternal(url);
  });

  next.webContents.on("did-fail-load", (_event, code, _desc, url, isMain) => {
    if (!isMain || code === -3) return;
    if (url.startsWith("file:")) return;
    next.loadFile(join(root, "offline.html"));
  });
}

function createWindow() {
  const stored = loadBounds();
  const transparent = process.platform === "win32";
  const next = new BrowserWindow({
    width: stored.width,
    height: stored.height,
    x: stored.x,
    y: stored.y,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: transparent ? "#00000000" : "#000000",
    transparent,
    autoHideMenuBar: true,
    title: "Nox",
    icon: existsSync(join(root, "icon.png")) ? join(root, "icon.png") : undefined,
    webPreferences: {
      preload: join(root, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      autoplayPolicy: "no-user-gesture-required",
    },
  });
  if (stored.isMaximized) next.maximize();
  attachWindow(next);
  vlc.attach(next, (payload) => {
    if (!win || win.isDestroyed()) return;
    win.webContents.send("nox:vlc-event", payload);
  });
  if (startUrl) {
    void next.loadURL(startUrl, { extraHeaders: "Cache-Control: no-cache\n" });
  } else {
    void next.loadFile(join(root, "offline.html"));
  }
}

function installMenu() {
  const template = [
    ...(process.platform === "darwin"
      ? [{ role: "appMenu" }]
      : [
          {
            label: "File",
            submenu: [{ role: "quit" }],
          },
        ]),
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { type: "separator" },
        { role: "togglefullscreen" },
        { type: "separator" },
        {
          label: "Home",
          click: () => {
            if (win && !win.isDestroyed() && startUrl) void win.loadURL(startUrl);
          },
        },
      ],
    },
    {
      label: "Nox",
      submenu: [
        {
          label: "Check for updates…",
          click: () => void checkForUpdates({ silent: false }),
        },
        {
          label: "Install update and restart",
          click: () => installUpdate(),
        },
      ],
    },
    {
      role: "help",
      submenu: [
        {
          label: "Open in browser",
          click: () => {
            if (startUrl) openExternal(startUrl);
          },
        },
        {
          label: "Downloads",
          click: () => openExternal("https://github.com/jerskatus/nox/releases/latest"),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function bootCatalog() {
  const override = remoteOverride();
  if (override) {
    startUrl = override;
    return;
  }
  if (!hasLocalCatalog()) {
    throw new Error("This copy of Nox is missing its built-in catalog.");
  }
  catalog = await startCatalog();
  startUrl = catalog.url;
}

app.setName("Nox");
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
app.commandLine.appendSwitch("lang", "en-US");
if (process.platform === "win32") {
  app.commandLine.appendSwitch("disable-gpu-compositing");
}

process.on("uncaughtException", (error) => {
  const code = error && typeof error === "object" && "code" in error ? error.code : "";
  const text = error instanceof Error ? error.message : String(error);
  if (code === "ENOENT" || /spawn .*ENOENT/i.test(text)) {
    console.error("[nox] spawn failed", error);
    return;
  }
  dialog.showErrorBox("Nox", text || "Nox hit an unexpected error.");
});

const engine = createEngine();
const vlc = createVlc();

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  app.whenReady().then(async () => {
    engine.attach();
    attachPersist();
    attachUpdater();
    ipcMain.handle("nox:info", () => ({
      version: app.getVersion(),
      hasEngine: engine.available || vlc.available,
      hasVlc: vlc.available,
      standalone: Boolean(catalog) || hasLocalCatalog(),
    }));
    ipcMain.handle("nox:probe", (_event, url) => engine.probe(String(url ?? "")));
    ipcMain.handle("nox:play", (_event, opts) => {
      void vlc.stop();
      return engine.play({
        url: String(opts?.url ?? ""),
        startAt: Number(opts?.startAt) || 0,
        audio: Number.isFinite(Number(opts?.audio)) ? Math.max(0, Math.floor(Number(opts.audio))) : 0,
        transcode: opts?.transcode !== false,
      });
    });
    ipcMain.handle("nox:stop", () => {
      engine.stop();
      void vlc.stop();
    });
    ipcMain.handle("nox:vlc-play", (_event, opts) => {
      engine.stop();
      return vlc.play(opts ?? {});
    });
    ipcMain.handle("nox:vlc-pause", () => vlc.pause());
    ipcMain.handle("nox:vlc-resume", () => vlc.resume());
    ipcMain.handle("nox:vlc-stop", () => vlc.stop());
    ipcMain.handle("nox:vlc-seek", (_event, ms) => vlc.seek(ms));
    ipcMain.handle("nox:vlc-volume", (_event, opts) => vlc.setVolume(opts?.volume, opts?.mute));
    ipcMain.handle("nox:vlc-rate", (_event, rate) => vlc.setRate(rate));
    ipcMain.handle("nox:vlc-audio", (_event, track) => vlc.setAudio(track));
    ipcMain.handle("nox:vlc-fit", (_event, opts) => vlc.setFit(opts?.fit, opts?.width, opts?.height));
    ipcMain.handle("nox:vlc-bounds", (_event, bounds) => vlc.setBounds(bounds));
    ipcMain.handle("nox:update-check", () => checkForUpdates({ silent: false }));
    ipcMain.handle("nox:update-install", () => {
      installUpdate();
    });
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
      callback(permission === "media" || permission === "fullscreen" || permission === "notifications");
    });
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
      const headers = { ...details.requestHeaders };
      const ua = headers["User-Agent"] ?? headers["user-agent"] ?? "";
      if (ua && !/NoxDesktop/.test(ua)) {
        headers["User-Agent"] = `${ua} NoxDesktop/${app.getVersion()}`;
      }
      callback({ requestHeaders: headers });
    });
    installMenu();
    try {
      await bootCatalog();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nox could not start.";
      dialog.showErrorBox("Nox", message);
    }
    createWindow();
    setTimeout(() => void checkForUpdates({ silent: true }), 8000);
    setInterval(() => void checkForUpdates({ silent: true }), CHECK_MS);
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("before-quit", () => {
    stopCatalog(catalog);
    catalog = null;
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
