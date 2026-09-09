import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { app, protocol, session } from "electron";

const require = createRequire(import.meta.url);
const root = dirname(fileURLToPath(import.meta.url));

const CINEMA = /ac-?3|eac3|e-ac-3|truehd|dts|mlp|atmos|pcm_bluray/i;

export function registerPrivilegedSchemes() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: "noxmedia",
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        bypassCSP: true,
        corsEnabled: true,
      },
    },
  ]);
}

export function parseAudioStreams(stderr) {
  const tracks = [];
  let audioIndex = 0;
  const lines = String(stderr ?? "").split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const match = /Stream #\d+:(\d+)(?:\(([^)]+)\))?:\s*Audio:\s*(.+)/i.exec(lines[i] ?? "");
    if (!match) continue;
    const detail = match[3] ?? "";
    const codec = (detail.split(",")[0] ?? "").trim().split(/\s+/)[0] ?? "";
    const channels =
      detail.match(/7\.1|5\.1(?:\(side\))?|stereo|mono|\d+\s*channels/i)?.[0]?.replace("(side)", "") ?? "";
    let lang = (match[2] ?? "").trim();
    let title = "";
    for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
      const meta = lines[j] ?? "";
      if (/^\s*Stream #/.test(meta)) break;
      const langMeta = /^\s*language\s*:\s*(\S+)/i.exec(meta);
      if (langMeta && !lang) lang = langMeta[1] ?? "";
      const titleMeta = /^\s*title\s*:\s*(.+)/i.exec(meta);
      if (titleMeta) title = (titleMeta[1] ?? "").trim();
    }
    tracks.push({
      index: audioIndex,
      streamIndex: Number(match[1]),
      lang,
      title,
      codec,
      channels: channels.trim(),
      isDefault: /\(default\)/i.test(detail),
      cinema: CINEMA.test(codec) || CINEMA.test(detail),
    });
    audioIndex += 1;
  }
  return tracks;
}

export function parseDuration(stderr) {
  const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) return 0;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

export function pickAudioIndex(tracks, preferredLang) {
  if (!tracks.length) return 0;
  const want = (preferredLang || "eng").trim().toLowerCase();
  const isEn = (value) => {
    const v = `${value ?? ""}`.trim().toLowerCase();
    return v === "en" || v === "eng" || v === "english" || v.startsWith("en-") || v.startsWith("eng");
  };
  const isForeign = (value) => {
    const v = `${value ?? ""}`.trim().toLowerCase();
    if (!v || isEn(v)) return false;
    return /^(ita|it|italian|italiano|spa|es|spanish|fre|fr|fra|french|ger|de|deu|german|hin|hindi|jpn|ja|jap|japanese|kor|ko|korean|por|pt|rus|ru|chi|zho|zh|ara|ar)$/i.test(
      v,
    );
  };
  const score = (t) => {
    const blob = `${t.lang} ${t.title ?? ""} ${t.codec}`;
    let n = 0;
    if (isEn(t.lang) || isEn(t.title)) n += 80;
    if (isForeign(t.lang) || isForeign(t.title)) n -= 70;
    if (want && (t.lang.toLowerCase() === want || t.lang.toLowerCase().startsWith(want))) n += 50;
    if (t.isDefault && isEn(t.lang)) n += 4;
    if (/aac|mp4a|mp3|opus/.test(t.codec.toLowerCase())) n += 8;
    if (isEn(blob)) n += 20;
    return n;
  };
  let best = 0;
  for (let i = 1; i < tracks.length; i++) {
    if (score(tracks[i]) > score(tracks[best])) best = i;
  }
  return best;
}

export function jobIdFromUrl(url) {
  try {
    const parsed = typeof url === "string" ? new URL(url) : url;
    if (parsed.hostname && parsed.hostname !== "v") return parsed.hostname;
    const parts = (parsed.pathname || "").split("/").filter(Boolean);
    if (parsed.hostname === "v") return parts[0] || "";
    if (parts[0] === "v") return parts[1] || "";
    return parts[0] || "";
  } catch {
    return "";
  }
}

function resolveFfmpeg() {
  const names = process.platform === "win32" ? ["ffmpeg.exe", "ffmpeg"] : ["ffmpeg"];
  const candidates = [];
  if (process.resourcesPath) {
    for (const name of names) candidates.push(join(process.resourcesPath, name));
  }
  try {
    let packed = require("ffmpeg-static");
    if (typeof packed === "string") {
      if (packed.includes("app.asar")) packed = packed.replace("app.asar", "app.asar.unpacked");
      candidates.push(packed);
    }
  } catch {
    /* optional */
  }
  for (const name of names) candidates.push(join(root, "node_modules", "ffmpeg-static", name));
  return candidates.find((path) => path && existsSync(path)) ?? null;
}

function assertMediaUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid stream URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only HTTP streams can be converted");
  }
  return parsed.toString();
}

function spawnFfmpeg(bin, args) {
  return spawn(bin, args, {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
}

export function createEngine() {
  let bin = resolveFfmpeg();
  /** @type {Map<string, { url: string, startAt: number, audio: number, transcode: boolean }>} */
  const jobs = new Map();
  /** @type {import('node:child_process').ChildProcess | null} */
  let proc = null;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let killTimer = null;

  function stopProc() {
    if (killTimer) {
      clearTimeout(killTimer);
      killTimer = null;
    }
    if (!proc) return;
    const running = proc;
    proc = null;
    try {
      running.stdout?.destroy();
    } catch {
      /* already closed */
    }
    try {
      running.kill("SIGKILL");
    } catch {
      /* already exited */
    }
  }

  function ffmpegArgs(job) {
    const args = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-nostdin",
      "-reconnect",
      "1",
      "-reconnect_streamed",
      "1",
      "-reconnect_delay_max",
      "5",
      "-rw_timeout",
      "20000000",
      "-probesize",
      "20M",
      "-analyzeduration",
      "20M",
      "-user_agent",
      "Mozilla/5.0 (compatible; NoxDesktop/1.0)",
    ];
    if (job.url.toLowerCase().includes(".m3u8")) {
      args.push("-protocol_whitelist", "file,http,https,tcp,tls,crypto,data,pipe");
      args.push("-allowed_extensions", "ALL");
    }
    if (job.startAt > 0.5) args.push("-ss", job.startAt.toFixed(3));
    args.push("-i", job.url);
    args.push("-map", "0:v:0?");
    args.push("-map", `0:a:${Math.max(0, job.audio)}`);
    if (job.video === "h264") {
      args.push("-c:v", "libx264", "-preset", "ultrafast", "-tune", "zerolatency", "-crf", "23", "-pix_fmt", "yuv420p");
    } else {
      args.push("-c:v", "copy");
    }
    if (job.transcode) {
      args.push("-c:a", "aac", "-ac", "2", "-ar", "48000", "-b:a", "192k");
      args.push("-af", "aresample=async=1:first_pts=0");
    } else {
      args.push("-c:a", "copy");
    }
    args.push("-sn", "-dn");
    args.push("-fflags", "+genpts+discardcorrupt");
    args.push("-avoid_negative_ts", "make_zero");
    args.push("-max_muxing_queue_size", "2048");
    args.push("-movflags", "frag_keyframe+empty_moov+default_base_moof");
    args.push("-f", "mp4", "pipe:1");
    return args;
  }

  async function probe(url) {
    if (!bin) throw new Error("ffmpeg is not installed");
    const target = assertMediaUrl(url);
    const args = [
      "-hide_banner",
      "-probesize",
      "12M",
      "-analyzeduration",
      "12M",
      "-user_agent",
      "Mozilla/5.0 (compatible; NoxDesktop/1.0)",
    ];
    if (target.toLowerCase().includes(".m3u8")) {
      args.push("-protocol_whitelist", "file,http,https,tcp,tls,crypto,data,pipe", "-allowed_extensions", "ALL");
    }
    args.push("-i", target);
    const child = spawnFfmpeg(bin, args);
    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
      if (stderr.length > 80_000) child.kill("SIGKILL");
    });
    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        resolve();
      }, 18_000);
      child.on("close", () => {
        clearTimeout(timer);
        resolve();
      });
    });
    return {
      duration: parseDuration(stderr),
      tracks: parseAudioStreams(stderr),
    };
  }

  function play(opts) {
    if (!bin) throw new Error("ffmpeg is not installed");
    const url = assertMediaUrl(opts.url);
    const startAt = Math.max(0, Number(opts.startAt) || 0);
    const audio = Number.isFinite(Number(opts.audio)) ? Math.max(0, Math.floor(Number(opts.audio))) : 0;
    const transcode = opts.transcode !== false;
    const video = opts.video === "h264" ? "h264" : "copy";
    stopProc();
    jobs.clear();
    const id = randomBytes(12).toString("hex");
    jobs.set(id, { url, startAt, audio, transcode, video });
    return { src: `noxmedia://v/${id}`, transcode, video };
  }

  function stop() {
    stopProc();
    jobs.clear();
  }

  function handle(request) {
    const id = jobIdFromUrl(request.url);
    const job = jobs.get(id);
    if (!job || !bin) return new Response("Not found", { status: 404 });
    stopProc();
    const next = spawnFfmpeg(bin, ffmpegArgs(job));
    proc = next;
    if (!next.stdout) return new Response("Engine error", { status: 500 });
    const body = Readable.toWeb(next.stdout);
    next.stderr?.on("data", () => undefined);
    next.on("exit", () => {
      if (proc === next) proc = null;
    });
    const abort = request.signal;
    if (abort) {
      abort.addEventListener(
        "abort",
        () => {
          killTimer = setTimeout(() => {
            if (proc === next) stopProc();
          }, 500);
        },
        { once: true },
      );
    }
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "video/mp4",
        "cache-control": "no-store",
        "accept-ranges": "none",
      },
    });
  }

  function attach() {
    bin = resolveFfmpeg() || bin;
    session.defaultSession.protocol.handle("noxmedia", (request) => handle(request));
    app.on("before-quit", () => stop());
  }

  return {
    get bin() {
      return bin;
    },
    get available() {
      return Boolean(bin);
    },
    probe,
    play,
    stop,
    attach,
  };
}
