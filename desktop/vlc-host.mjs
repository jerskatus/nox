import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { join } from "node:path";
import readline from "node:readline";
import { isHttpUrl, parseVlcTrackName, vlcFitArgs, vlcPlaybackReady } from "./vlc-tracks.mjs";

const require = createRequire(import.meta.url);

function send(payload) {
  try {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
  } catch {
    /* parent gone */
  }
}

function fail(id, message) {
  send({ id, ok: false, error: String(message ?? "VLC error") });
}

/** @type {any} */
let koffi = null;
try {
  koffi = require("koffi");
} catch (error) {
  send({ evt: "log", message: `koffi missing: ${error instanceof Error ? error.message : error}` });
}

const vlcDir = process.env.NOX_VLC_DIR || "";
const dll = vlcDir ? join(vlcDir, process.platform === "win32" ? "libvlc.dll" : "libvlc.so") : "";

let api = null;
let user32 = null;
let kernel32 = null;
let instance = null;
let player = null;
let hwnd = null;
let electronHwnd = null;
let currentFit = "fit";
let lastBounds = { x: 0, y: 0, w: 1280, h: 720 };
let lastSize = { w: 0, h: 0 };

const WS_POPUP = 0x80000000;
const WS_VISIBLE = 0x10000000;
const WS_CLIPSIBLINGS = 0x04000000;
const WS_EX_NOACTIVATE = 0x08000000;
const WS_EX_TOOLWINDOW = 0x00000080;
const WS_EX_TRANSPARENT = 0x00000020;
const SWP_NOACTIVATE = 0x0010;
const SW_HIDE = 0;
const SW_SHOWNOACTIVATE = 4;
const PM_REMOVE = 0x0001;

function hwndFrom(value) {
  if (value == null || value === "") return null;
  try {
    if (typeof value === "bigint") return value;
    if (typeof value === "number") return BigInt(value);
    const text = String(value);
    if (/^0x/i.test(text)) return BigInt(text);
    return BigInt(text);
  } catch {
    return null;
  }
}

function asPtr(value) {
  if (!koffi || value == null) return null;
  try {
    return koffi.as(value, "void *");
  } catch {
    return value;
  }
}

function bootWin32() {
  if (process.platform !== "win32" || !koffi) return false;
  kernel32 = koffi.load("kernel32.dll");
  user32 = koffi.load("user32.dll");
  kernel32.func("int __stdcall SetDllDirectoryW(str16 lpPathName)");
  kernel32.func("void * __stdcall GetModuleHandleW(void *lpModuleName)");
  user32.func(
    "void * __stdcall CreateWindowExW(uint dwExStyle, str16 lpClassName, str16 lpWindowName, uint dwStyle, int X, int Y, int nWidth, int nHeight, void *hWndParent, void *hMenu, void *hInstance, void *lpParam)",
  );
  user32.func("int __stdcall DestroyWindow(void *hWnd)");
  user32.func("int __stdcall ShowWindow(void *hWnd, int nCmdShow)");
  user32.func(
    "int __stdcall SetWindowPos(void *hWnd, void *hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags)",
  );
  user32.func("int __stdcall MoveWindow(void *hWnd, int X, int Y, int nWidth, int nHeight, int bRepaint)");
  user32.func("int __stdcall PeekMessageW(void *lpMsg, void *hWnd, uint min, uint max, uint remove)");
  user32.func("int __stdcall TranslateMessage(void *lpMsg)");
  user32.func("intptr __stdcall DispatchMessageW(void *lpMsg)");
  user32.func("int __stdcall UpdateWindow(void *hWnd)");
  const setDll = kernel32.func("SetDllDirectoryW");
  if (vlcDir) setDll(vlcDir);
  return true;
}

function bootLibvlc() {
  if (!koffi || !dll || !existsSync(dll)) return false;
  if (vlcDir) process.env.VLC_PLUGIN_PATH = join(vlcDir, "plugins");
  const lib = koffi.load(dll);
  api = {
    libvlc_new: lib.func("void *libvlc_new(int argc, const char **argv)"),
    libvlc_release: lib.func("void libvlc_release(void *p_instance)"),
    libvlc_errmsg: lib.func("str libvlc_errmsg()"),
    libvlc_media_new_location: lib.func("void *libvlc_media_new_location(void *inst, str mrl)"),
    libvlc_media_add_option: lib.func("void libvlc_media_add_option(void *media, str opt)"),
    libvlc_media_release: lib.func("void libvlc_media_release(void *media)"),
    libvlc_media_player_new: lib.func("void *libvlc_media_player_new(void *inst)"),
    libvlc_media_player_set_media: lib.func("void libvlc_media_player_set_media(void *mp, void *media)"),
    libvlc_media_player_release: lib.func("void libvlc_media_player_release(void *mp)"),
    libvlc_media_player_set_hwnd: lib.func("void libvlc_media_player_set_hwnd(void *mp, void *drawable)"),
    libvlc_media_player_play: lib.func("int libvlc_media_player_play(void *mp)"),
    libvlc_media_player_set_pause: lib.func("void libvlc_media_player_set_pause(void *mp, int do_pause)"),
    libvlc_media_player_stop: lib.func("void libvlc_media_player_stop(void *mp)"),
    libvlc_media_player_is_playing: lib.func("int libvlc_media_player_is_playing(void *mp)"),
    libvlc_media_player_get_state: lib.func("int libvlc_media_player_get_state(void *mp)"),
    libvlc_media_player_get_time: lib.func("int64 libvlc_media_player_get_time(void *mp)"),
    libvlc_media_player_set_time: lib.func("int libvlc_media_player_set_time(void *mp, int64 t)"),
    libvlc_media_player_get_length: lib.func("int64 libvlc_media_player_get_length(void *mp)"),
    libvlc_media_player_set_rate: lib.func("int libvlc_media_player_set_rate(void *mp, float rate)"),
    libvlc_video_set_key_input: lib.func("void libvlc_video_set_key_input(void *mp, uint on)"),
    libvlc_video_set_mouse_input: lib.func("void libvlc_video_set_mouse_input(void *mp, uint on)"),
    libvlc_audio_set_volume: lib.func("int libvlc_audio_set_volume(void *mp, int vol)"),
    libvlc_audio_set_mute: lib.func("int libvlc_audio_set_mute(void *mp, int status)"),
    libvlc_audio_set_track: lib.func("int libvlc_audio_set_track(void *mp, int track)"),
    libvlc_audio_get_track: lib.func("int libvlc_audio_get_track(void *mp)"),
    libvlc_audio_get_track_description: lib.func("void *libvlc_audio_get_track_description(void *mp)"),
    libvlc_track_description_list_release: lib.func("void libvlc_track_description_list_release(void *p)"),
    libvlc_video_set_aspect_ratio: lib.func("int libvlc_video_set_aspect_ratio(void *mp, str aspect)"),
    libvlc_video_set_scale: lib.func("void libvlc_video_set_scale(void *mp, float scale)"),
    libvlc_video_set_crop_geometry: lib.func("int libvlc_video_set_crop_geometry(void *mp, str geometry)"),
    libvlc_video_get_size: lib.func("int libvlc_video_get_size(void *mp, uint num, _Out_ uint *px, _Out_ uint *py)"),
  };
  const args = [
    "--intf=dummy",
    "--no-video-title-show",
    "--no-stats",
    "--no-osd",
    "--no-snapshot-preview",
    "--no-sub-autodetect-file",
    "--no-spu",
    "--quiet",
    "--network-caching=4000",
    "--file-caching=3000",
    "--live-caching=3000",
    "--http-reconnect",
    "--audio-language=eng,en,english",
    "--aout=wasapi",
    "--avcodec-hw=any",
    `--plugin-path=${join(vlcDir, "plugins")}`,
  ];
  instance = api.libvlc_new(args.length, args);
  if (!instance) {
    send({ evt: "log", message: `libvlc_new failed: ${api.libvlc_errmsg() || "unknown"}` });
    return false;
  }
  player = api.libvlc_media_player_new(instance);
  if (!player) return false;
  api.libvlc_video_set_key_input(player, 0);
  api.libvlc_video_set_mouse_input(player, 0);
  return true;
}

function ensureSurface() {
  if (hwnd || !user32 || !kernel32) return hwnd;
  const getModule = kernel32.func("GetModuleHandleW");
  const create = user32.func("CreateWindowExW");
  const hInstance = getModule(null);
  const ex = WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW | WS_EX_TRANSPARENT;
  const style = (WS_POPUP | WS_VISIBLE | WS_CLIPSIBLINGS) >>> 0;
  hwnd = create(
    ex,
    "Static",
    "NoxVideo",
    style,
    lastBounds.x,
    lastBounds.y,
    Math.max(16, lastBounds.w),
    Math.max(16, lastBounds.h),
    null,
    null,
    hInstance,
    null,
  );
  if (hwnd && player && api.libvlc_media_player_set_hwnd) {
    api.libvlc_media_player_set_hwnd(player, hwnd);
  }
  return hwnd;
}

function restack() {
  if (!hwnd || !user32) return;
  const show = user32.func("ShowWindow");
  const pos = user32.func("SetWindowPos");
  show(hwnd, SW_SHOWNOACTIVATE);
  const insertAfter = electronHwnd ? asPtr(electronHwnd) : 1; // HWND_BOTTOM if missing
  pos(
    hwnd,
    insertAfter,
    lastBounds.x,
    lastBounds.y,
    Math.max(16, lastBounds.w),
    Math.max(16, lastBounds.h),
    SWP_NOACTIVATE,
  );
}

function hideSurface() {
  if (!hwnd || !user32) return;
  user32.func("ShowWindow")(hwnd, SW_HIDE);
}

function applyFit(fit, width, height) {
  if (!player || !api) return;
  currentFit = fit || currentFit || "fit";
  const w = width || lastBounds.w;
  const h = height || lastBounds.h;
  const mapped = vlcFitArgs(currentFit, w, h);
  try {
    api.libvlc_video_set_aspect_ratio(player, mapped.aspect || null);
    api.libvlc_video_set_crop_geometry(player, mapped.crop || null);
    api.libvlc_video_set_scale(player, mapped.scale);
  } catch {
    /* older libvlc */
  }
}

function readTracks() {
  if (!player || !api || !koffi) return [];
  const head = api.libvlc_audio_get_track_description(player);
  if (!head) return [];
  const Track = koffi.struct("libvlc_track_description_t", {
    i_id: "int",
    psz_name: "str",
    p_next: "void *",
  });
  const tracks = [];
  let node = head;
  let guard = 0;
  while (node && guard++ < 64) {
    try {
      const row = koffi.decode(node, Track);
      const parsed = parseVlcTrackName(row.psz_name, row.i_id);
      if (parsed) tracks.push(parsed);
      node = row.p_next;
    } catch {
      break;
    }
  }
  try {
    api.libvlc_track_description_list_release(head);
  } catch {
    /* ignore */
  }
  return tracks;
}

function snapshot() {
  if (!player || !api) {
    return { playing: false, time: 0, length: 0, state: 0, tracks: [], audio: 0 };
  }
  const state = api.libvlc_media_player_get_state(player);
  const time = Number(api.libvlc_media_player_get_time(player) || 0);
  const length = Number(api.libvlc_media_player_get_length(player) || 0);
  return {
    playing: Boolean(api.libvlc_media_player_is_playing(player)),
    time: time > 0 ? time : 0,
    length: length > 0 ? length : 0,
    state,
    tracks: readTracks(),
    audio: api.libvlc_audio_get_track(player),
  };
}

async function waitForOpen(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const snap = snapshot();
    const elapsed = Date.now() - start;
    if (snap.state === 7) throw new Error(api?.libvlc_errmsg() || "VLC could not open this stream");
    if (snap.state === 6 && elapsed > 2000) throw new Error("Stream ended");
    if (snap.state === 5 && elapsed > 2500) throw new Error("VLC stopped");
    if (vlcPlaybackReady(snap, elapsed)) return snap;
    await new Promise((r) => setTimeout(r, 120));
  }
  const snap = snapshot();
  if (vlcPlaybackReady(snap, timeoutMs)) return snap;
  throw new Error("VLC could not start this stream");
}

function playMedia(opts) {
  if (!isHttpUrl(opts.url)) throw new Error("Only HTTP streams can play in VLC");
  if (!instance || !player) throw new Error("VLC is not available");
  ensureSurface();
  restack();
  const media = api.libvlc_media_new_location(instance, opts.url);
  if (!media) throw new Error(api.libvlc_errmsg() || "VLC could not open the URL");
  const startAt = Math.max(0, Number(opts.startAt) || 0);
  api.libvlc_media_add_option(media, ":http-user-agent=Mozilla/5.0 (compatible; NoxDesktop/1.3.4)");
  api.libvlc_media_add_option(media, ":http-reconnect");
  api.libvlc_media_add_option(media, ":no-sub-autodetect-file");
  if (startAt > 0.4) api.libvlc_media_add_option(media, `:start-time=${startAt.toFixed(3)}`);
  api.libvlc_media_player_set_media(player, media);
  api.libvlc_media_release(media);
  if (hwnd) api.libvlc_media_player_set_hwnd(player, hwnd);
  api.libvlc_video_set_key_input(player, 0);
  api.libvlc_video_set_mouse_input(player, 0);
  const volume = Math.round(Math.max(0, Math.min(1, Number(opts.volume) || 1)) * 100);
  api.libvlc_audio_set_volume(player, volume);
  api.libvlc_audio_set_mute(player, opts.mute ? 1 : 0);
  if (opts.rate) api.libvlc_media_player_set_rate(player, Number(opts.rate) || 1);
  applyFit(opts.fit || currentFit, lastBounds.w, lastBounds.h);
  const code = api.libvlc_media_player_play(player);
  if (code !== 0) throw new Error(api.libvlc_errmsg() || "VLC play failed");
  return waitForOpen(18_000);
}

function stopPlayback() {
  if (player && api) {
    try {
      api.libvlc_media_player_stop(player);
    } catch {
      /* already stopped */
    }
  }
  hideSurface();
}

function dispose() {
  stopPlayback();
  if (player && api) {
    try {
      api.libvlc_media_player_release(player);
    } catch {
      /* ignore */
    }
    player = null;
  }
  if (instance && api) {
    try {
      api.libvlc_release(instance);
    } catch {
      /* ignore */
    }
    instance = null;
  }
  if (hwnd && user32) {
    try {
      user32.func("DestroyWindow")(hwnd);
    } catch {
      /* ignore */
    }
    hwnd = null;
  }
}

const available = Boolean(koffi) && bootWin32() && bootLibvlc();
send({ evt: "ready", available, platform: process.platform });

const msgBuf = koffi ? Buffer.alloc(64) : null;
if (user32 && msgBuf) {
  const peek = user32.func("PeekMessageW");
  const translate = user32.func("TranslateMessage");
  const dispatch = user32.func("DispatchMessageW");
  setInterval(() => {
    try {
      while (peek(msgBuf, null, 0, 0, PM_REMOVE)) {
        translate(msgBuf);
        dispatch(msgBuf);
      }
    } catch {
      /* ignore */
    }
  }, 16);
}

let lastEmit = "";
setInterval(() => {
  if (!player) return;
  const snap = snapshot();
  const ended = snap.state === 6;
  const error = snap.state === 7;
  const payload = {
    evt: "state",
    playing: snap.playing,
    time: snap.time,
    length: snap.length,
    buffering: snap.state === 2,
    audio: snap.audio,
    tracks: snap.tracks,
    ended,
    error: error ? api?.libvlc_errmsg() || "Playback failed" : null,
  };
  const key = `${payload.playing}|${payload.buffering ? 1 : 0}|${Math.round(payload.time / 250)}|${payload.length}|${payload.tracks.length}|${payload.audio}|${ended}|${payload.error || ""}`;
  if (key === lastEmit) return;
  lastEmit = key;
  send(payload);
}, 200);

async function handle(msg) {
  const id = msg.id;
  const op = msg.op;
  try {
    if (op === "info") {
      send({ id, ok: true, available });
      return;
    }
    if (!available) {
      fail(id, "VLC is not available in this copy of Nox");
      return;
    }
    if (op === "play") {
      if (msg.bounds) lastBounds = { ...lastBounds, ...msg.bounds };
      electronHwnd = hwndFrom(msg.hwnd) ?? electronHwnd;
      const snap = await playMedia(msg);
      if (Number.isFinite(Number(msg.audio))) {
        try {
          api.libvlc_audio_set_track(player, Math.floor(Number(msg.audio)));
        } catch {
          /* default */
        }
      }
      send({
        id,
        ok: true,
        tracks: snap.tracks,
        length: snap.length,
        time: snap.time,
        playing: snap.playing,
      });
      return;
    }
    if (op === "pause") {
      api.libvlc_media_player_set_pause(player, 1);
      send({ id, ok: true });
      return;
    }
    if (op === "resume") {
      restack();
      api.libvlc_media_player_set_pause(player, 0);
      send({ id, ok: true });
      return;
    }
    if (op === "stop") {
      stopPlayback();
      send({ id, ok: true });
      return;
    }
    if (op === "seek") {
      api.libvlc_media_player_set_time(player, BigInt(Math.max(0, Math.round(Number(msg.ms) || 0))));
      send({ id, ok: true });
      return;
    }
    if (op === "volume") {
      api.libvlc_audio_set_volume(player, Math.round(Math.max(0, Math.min(1, Number(msg.volume) || 0)) * 100));
      api.libvlc_audio_set_mute(player, msg.mute ? 1 : 0);
      send({ id, ok: true });
      return;
    }
    if (op === "rate") {
      api.libvlc_media_player_set_rate(player, Number(msg.rate) || 1);
      send({ id, ok: true });
      return;
    }
    if (op === "audio") {
      api.libvlc_audio_set_track(player, Math.floor(Number(msg.track)));
      send({ id, ok: true, audio: api.libvlc_audio_get_track(player), tracks: readTracks() });
      return;
    }
    if (op === "fit") {
      applyFit(msg.fit, msg.width, msg.height);
      send({ id, ok: true });
      return;
    }
    if (op === "bounds") {
      if (msg.hwnd) electronHwnd = hwndFrom(msg.hwnd) ?? electronHwnd;
      if (msg.bounds) lastBounds = { ...lastBounds, ...msg.bounds };
      restack();
      send({ id, ok: true });
      return;
    }
    if (op === "hide") {
      hideSurface();
      send({ id, ok: true });
      return;
    }
    if (op === "show") {
      restack();
      send({ id, ok: true });
      return;
    }
    fail(id, `Unknown op ${op}`);
  } catch (error) {
    if (op === "play") {
      try {
        stopPlayback();
      } catch {
        /* ignore */
      }
    }
    fail(id, error instanceof Error ? error.message : error);
  }
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", (line) => {
  const text = String(line || "").trim();
  if (!text) return;
  try {
    void handle(JSON.parse(text));
  } catch (error) {
    send({ evt: "log", message: `bad command: ${error instanceof Error ? error.message : error}` });
  }
});

function shutdown() {
  dispose();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
process.stdin.on("end", shutdown);
