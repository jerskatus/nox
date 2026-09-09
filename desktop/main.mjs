import { app, BrowserWindow, Menu, shell, session, ipcMain } from "electron";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createEngine, registerPrivilegedSchemes } from "./engine.mjs";

const root = dirname(fileURLToPath(import.meta.url));
registerPrivilegedSchemes();

const START_URL = readStartUrl();
const origin = new URL(START_URL).origin;
const VERSION_URL = `${origin}/api/version`;
const CHECK_MS = 2 * 60 * 1000;

/** @type {BrowserWindow | null} */
let win = null;
let lastId = "";
let checking = false;

function readStartUrl() {
  const fromEnv = process.env.NOX_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  try {
    const raw = JSON.parse(readFileSync(join(root, "config.json"), "utf8"));
    if (typeof raw.url === "string" && raw.url.startsWith("https://")) {
      return raw.url.replace(/\/$/, "");
    }
  } catch {
    /* bundled default */
  }
  return "https://nox-gamma-one.vercel.app";
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
    return parsed.origin === origin;
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

function watching() {
  if (!win || win.isDestroyed()) return false;
  try {
    return new URL(win.webContents.getURL()).pathname.startsWith("/watch");
  } catch {
    return false;
  }
}

async function remoteVersion() {
  const response = await fetch(VERSION_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(String(response.status));
  const data = (await response.json()) ?? {};
  return typeof data.id === "string" ? data.id : "";
}

async function checkForSiteUpdate() {
  if (!win || win.isDestroyed() || checking) return;
  checking = true;
  try {
    const id = await remoteVersion();
    if (!id) return;
    if (!lastId) {
      lastId = id;
      return;
    }
    if (id === lastId) return;
    lastId = id;
    if (watching()) return;
    win.webContents.reloadIgnoringCache();
  } catch {
    /* offline — the window already shows the catalog or the offline page */
  } finally {
    checking = false;
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
  const next = new BrowserWindow({
    width: stored.width,
    height: stored.height,
    x: stored.x,
    y: stored.y,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: "#000000",
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
  void next.loadURL(START_URL, {
    extraHeaders: "Cache-Control: no-cache\n",
  });
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
          label: "Go to live catalog",
          click: () => {
            if (win && !win.isDestroyed()) void win.loadURL(START_URL);
          },
        },
      ],
    },
    {
      role: "help",
      submenu: [
        {
          label: "Open in browser",
          click: () => openExternal(START_URL),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.setName("Nox");
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
app.commandLine.appendSwitch("lang", "en-US");

const engine = createEngine();

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  app.whenReady().then(() => {
    engine.attach();
    ipcMain.handle("nox:info", () => ({
      version: app.getVersion(),
      hasEngine: engine.available,
    }));
    ipcMain.handle("nox:probe", (_event, url) => engine.probe(String(url ?? "")));
    ipcMain.handle("nox:play", (_event, opts) =>
      engine.play({
        url: String(opts?.url ?? ""),
        startAt: Number(opts?.startAt) || 0,
        audio: Number.isFinite(Number(opts?.audio)) ? Math.max(0, Math.floor(Number(opts.audio))) : 0,
        transcode: opts?.transcode !== false,
      }),
    );
    ipcMain.handle("nox:stop", () => {
      engine.stop();
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
    createWindow();
    void checkForSiteUpdate();
    setInterval(() => void checkForSiteUpdate(), CHECK_MS);
    app.on("browser-window-focus", () => void checkForSiteUpdate());
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
