import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { app, screen } from "electron";
import { runNodeScript } from "./node-child.mjs";

const root = dirname(fileURLToPath(import.meta.url));

function resolveVlcDir() {
  const candidates = [];
  if (process.resourcesPath) candidates.push(join(process.resourcesPath, "vlc"));
  candidates.push(join(root, "vlc"));
  candidates.push("C:\\Program Files\\VideoLAN\\VLC");
  candidates.push("C:\\Program Files (x86)\\VideoLAN\\VLC");
  return (
    candidates.find((dir) => dir && existsSync(join(dir, process.platform === "win32" ? "libvlc.dll" : "libvlc.so"))) ||
    null
  );
}

function hwndString(win) {
  if (!win || win.isDestroyed()) return "";
  const buf = win.getNativeWindowHandle();
  if (!buf || buf.length < 4) return "";
  if (buf.length >= 8) return buf.readBigUInt64LE(0).toString();
  return String(buf.readUInt32LE(0));
}

function physicalBounds(win, dip) {
  const content = win.getContentBounds();
  const rect = {
    x: Math.round(content.x + (Number(dip?.x) || 0)),
    y: Math.round(content.y + (Number(dip?.y) || 0)),
    width: Math.max(16, Math.round(Number(dip?.width) || content.width)),
    height: Math.max(16, Math.round(Number(dip?.height) || content.height)),
  };
  try {
    const converted = screen.dipToScreenRect(win, rect);
    return { x: converted.x, y: converted.y, w: converted.width, h: converted.height };
  } catch {
    return { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
  }
}

export function createVlc() {
  const dir = resolveVlcDir();
  /** @type {import("electron").BrowserWindow | null} */
  let win = null;
  /** @type {import("node:child_process").ChildProcess | null} */
  let child = null;
  let ready = false;
  let available = false;
  let nextId = 1;
  /** @type {Map<number, { resolve: (v: any) => void, reject: (e: Error) => void }>} */
  const pending = new Map();
  let buffer = "";
  /** @type {(payload: any) => void} */
  let emit = () => undefined;

  function sendLine(payload) {
    if (!child?.stdin?.writable) return Promise.reject(new Error("VLC is not running"));
    const id = payload.id ?? nextId++;
    const line = { ...payload, id };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error("VLC did not answer"));
      }, 22_000);
      pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      child.stdin.write(`${JSON.stringify(line)}\n`);
    });
  }

  function onData(chunk) {
    buffer += String(chunk);
    const parts = buffer.split(/\r?\n/);
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      if (!part.trim()) continue;
      let msg;
      try {
        msg = JSON.parse(part);
      } catch {
        continue;
      }
      if (msg && typeof msg.id === "number" && pending.has(msg.id)) {
        const job = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.ok === false) job?.reject(new Error(msg.error || "VLC error"));
        else job?.resolve(msg);
        continue;
      }
      if (msg?.evt === "ready") {
        ready = true;
        available = Boolean(msg.available);
        continue;
      }
      if (msg?.evt) emit(msg);
    }
  }

  function start() {
    if (child || process.platform !== "win32" || !dir) return;
    child = runNodeScript(join(root, "vlc-host.mjs"), {
      cwd: root,
      env: {
        NOX_VLC_DIR: dir,
      },
      onError: (error) => {
        emit({ evt: "log", message: error instanceof Error ? error.message : String(error) });
        child = null;
        ready = false;
        available = false;
      },
    });
    if (!child) return;
    child.stdout?.on("data", onData);
    child.stderr?.on("data", (chunk) => {
      emit({ evt: "log", message: String(chunk) });
    });
    child.on("exit", () => {
      child = null;
      ready = false;
      available = false;
      for (const job of pending.values()) job.reject(new Error("VLC stopped"));
      pending.clear();
    });
  }

  async function ensure() {
    if (process.platform !== "win32") return false;
    if (!dir) return false;
    start();
    const begin = Date.now();
    while (!ready && Date.now() - begin < 8000) {
      await new Promise((r) => setTimeout(r, 50));
    }
    if (!ready || !available) return false;
    return true;
  }

  async function cmd(payload) {
    const ok = await ensure();
    if (!ok) throw new Error("VLC is not available");
    return sendLine(payload);
  }

  return {
    get available() {
      return Boolean(dir) && process.platform === "win32";
    },
    attach(browserWindow, onEvent) {
      win = browserWindow;
      emit = (payload) => {
        try {
          onEvent?.(payload);
        } catch {
          /* ignore */
        }
      };
      const restack = () => {
        if (!win || win.isDestroyed() || !ready) return;
        void sendLine({
          op: "bounds",
          hwnd: hwndString(win),
          bounds: physicalBounds(win, { x: 0, y: 0, width: win.getContentBounds().width, height: win.getContentBounds().height }),
        }).catch(() => undefined);
      };
      browserWindow.on("move", restack);
      browserWindow.on("resize", restack);
      browserWindow.on("minimize", () => {
        void sendLine({ op: "hide" }).catch(() => undefined);
      });
      browserWindow.on("restore", restack);
      browserWindow.on("blur", () => {
        if (browserWindow.isDestroyed() || browserWindow.isMinimized()) {
          void sendLine({ op: "hide" }).catch(() => undefined);
        }
      });
      browserWindow.on("focus", restack);
      app.on("before-quit", () => {
        try {
          child?.kill();
        } catch {
          /* ignore */
        }
      });
    },
    async play(opts) {
      if (!win || win.isDestroyed()) throw new Error("No window");
      const dip = opts.bounds || {
        x: 0,
        y: 0,
        width: win.getContentBounds().width,
        height: win.getContentBounds().height,
      };
      return cmd({
        op: "play",
        url: String(opts.url ?? ""),
        startAt: Number(opts.startAt) || 0,
        volume: Number(opts.volume) || 1,
        mute: Boolean(opts.mute),
        rate: Number(opts.rate) || 1,
        fit: opts.fit || "fit",
        audio: Number.isFinite(Number(opts.audio)) ? Number(opts.audio) : undefined,
        hwnd: hwndString(win),
        bounds: physicalBounds(win, dip),
      });
    },
    pause: () => cmd({ op: "pause" }),
    resume: () => cmd({ op: "resume" }),
    stop: () => cmd({ op: "stop" }).catch(() => undefined),
    seek: (ms) => cmd({ op: "seek", ms }),
    setVolume: (volume, mute) => cmd({ op: "volume", volume, mute }),
    setRate: (rate) => cmd({ op: "rate", rate }),
    setAudio: (track) => cmd({ op: "audio", track }),
    setFit: (fit, width, height) => cmd({ op: "fit", fit, width, height }),
    setBounds: (bounds) => {
      if (!win || win.isDestroyed()) return Promise.resolve({ ok: true });
      return cmd({
        op: "bounds",
        hwnd: hwndString(win),
        bounds: physicalBounds(win, bounds),
      });
    },
    hide: () => cmd({ op: "hide" }).catch(() => undefined),
    show: () => cmd({ op: "show" }).catch(() => undefined),
  };
}
