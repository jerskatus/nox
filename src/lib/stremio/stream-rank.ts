import type { Stream } from "./types";

function blob(stream: Stream) {
  return `${stream.name ?? ""} ${stream.title ?? ""} ${stream.description ?? ""} ${stream.behaviorHints?.filename ?? ""} ${stream.url ?? ""}`.toLowerCase();
}

function kindOf(stream: Stream) {
  if (stream.ytId) return "youtube";
  if (stream.externalUrl) return "external";
  if (stream.infoHash) return "torrent";
  if (stream.url) {
    if (stream.url.toLowerCase().includes(".m3u8")) return "hls";
    return "http";
  }
  return "other";
}

function webPlayable(stream: Stream) {
  if (stream.ytId) return true;
  if (stream.url) {
    if (stream.behaviorHints?.notWebReady) return false;
    const url = stream.url.toLowerCase();
    if (url.startsWith("http://") || url.startsWith("https://")) return true;
  }
  return false;
}

const CACHED_MARK =
  /\[(?:rd|ad|pm|dl|tb|oc|ed|ppv)\+\]|\bcached\b|⚡|instant\s*rd|real-debrid\.com|download\.real-debrid|alldebrid\.com|premiumize\.(?:me|net)|torbox\.app|debrid-link|easydebrid|offcloud\.com/i;
const DEBRID_MARK =
  /\[(?:rd|ad|pm|dl|tb|oc|ed)(?:\+|(?:\s|$))\]|\breal.?debrid\b|\balldebrid\b|\bpremiumize\b|\btorbox\b|\bdebrid\b/i;
const CAM_MARK = /\b(?:cam|hdcam|hdts|telesync|telecine|scr|screener|camrip)\b/i;
/** Dolby Atmos / TrueHD / DTS / AC3 — browsers cannot decode these, so picture plays with a silent tab. */
const CINEMA_AUDIO = /\b(?:atmos|truehd|dts(?:-hd)?(?:\s*ma)?|dd[p+]|ddp|e-?ac-?3|eac3|ac-?3)\b/i;
const AAC_AUDIO = /\b(?:aac(?:[.\s-]?lc)?|mp4a|mp3|opus|vorbis|stereo|2\.0|2ch)\b/i;
const AVC_VIDEO = /\b(?:x264|h\.?264|avc)\b/i;

export type StreamFlags = {
  cached: boolean;
  debrid: boolean;
  hdr: boolean;
  dolbyVision: boolean;
  atmos: boolean;
  hevc: boolean;
  av1: boolean;
  cam: boolean;
  cinemaAudio: boolean;
  aac: boolean;
  quality: string | null;
  seeds: number | null;
};

export function streamFlags(stream: Stream): StreamFlags {
  const text = blob(stream);
  const qualityMatch = text.match(/\b(8k|4k|2160p?|1080p|720p|576p|480p|360p|240p)\b/i);
  let quality = qualityMatch ? qualityMatch[1]!.toUpperCase() : null;
  if (quality === "2160" || quality === "2160P" || quality === "4K") quality = "4K";
  if (quality === "8K") quality = "8K";
  if (quality && quality.endsWith("P") && quality !== "4K") quality = quality.toLowerCase();
  const seedsMatch = text.match(/(?:👤|👥|seeders?|seeds)\s*[×x:]?\s*(\d{1,6})/i);
  const cinemaAudio = CINEMA_AUDIO.test(text);
  return {
    cached: CACHED_MARK.test(text),
    debrid: DEBRID_MARK.test(text),
    hdr: /\bhdr(?:10)?\+?\b/.test(text),
    dolbyVision: /\b(?:dolby\s*vision|\bdv\b|dovi)\b/.test(text),
    atmos: /\b(?:atmos|truehd)\b/.test(text),
    hevc: /\b(?:hevc|x265|h\.?265)\b/.test(text),
    av1: /\bav1\b/.test(text),
    cam: CAM_MARK.test(text),
    cinemaAudio,
    aac: !cinemaAudio && AAC_AUDIO.test(text),
    quality,
    seeds: seedsMatch ? Number(seedsMatch[1]) : null,
  };
}

function qualityScore(quality: string | null) {
  switch (quality) {
    case "1080p":
      return 360;
    case "4K":
      return 330;
    case "720p":
      return 210;
    case "8K":
      return 200;
    case "576p":
    case "480p":
      return 80;
    default:
      return 40;
  }
}

function sizeScore(stream: Stream) {
  const bytes = stream.behaviorHints?.videoSize ?? 0;
  if (bytes <= 0) return 0;
  const gb = bytes / 1_073_741_824;
  if (gb < 0.25) return -40;
  if (gb > 30) return -20;
  if (gb >= 1.2 && gb <= 12) return 25;
  return 8;
}

export function streamScore(stream: Stream, opts?: { desktop?: boolean }) {
  const flags = streamFlags(stream);
  const kind = kindOf(stream);
  const text = blob(stream);
  let score = 0;
  if (webPlayable(stream)) score += 5_000;
  if (flags.cached) score += 10_000;
  else if (flags.debrid) score += 3_500;
  if (kind === "http") score += 800;
  else if (kind === "hls") score += 700;
  else if (kind === "youtube") score += 300;
  else if (kind === "external") score += 80;
  else if (kind === "torrent") score += 20;
  score += qualityScore(flags.quality);
  if (flags.cinemaAudio && !opts?.desktop) score -= 12_000;
  else if (flags.aac) score += 500;
  else if (flags.cinemaAudio && opts?.desktop) score += 40;
  if (AVC_VIDEO.test(text)) score += 90;
  if (flags.dolbyVision) score += 10;
  else if (flags.hdr) score += 8;
  if (flags.av1) score += 10;
  else if (flags.hevc) score += 8;
  if (flags.cam) score -= 400;
  if (flags.seeds != null) score += Math.min(80, Math.log10(flags.seeds + 1) * 28);
  score += sizeScore(stream);
  return score;
}

export function rankStreamsByQuality(streams: Stream[], opts?: { desktop?: boolean }) {
  return [...streams].sort((a, b) => streamScore(b, opts) - streamScore(a, opts));
}

export function playableStreams(streams: Stream[]) {
  return streams.filter((stream) => {
    if (!webPlayable(stream)) return false;
    const kind = kindOf(stream);
    return kind === "http" || kind === "hls" || kind === "youtube";
  });
}
