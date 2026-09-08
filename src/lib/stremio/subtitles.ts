import type { Stream, Subtitle } from "./types";

export type Cue = {
  start: number;
  end: number;
  text: string;
};

export function parseTimestamp(raw: string) {
  const token = raw.trim().split(/\s+/)[0] ?? "0";
  const clean = token.replace(",", ".");
  const parts = clean.split(":");
  if (parts.length === 3) {
    return Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]);
  }
  if (parts.length === 2) {
    return Number(parts[0]) * 60 + Number(parts[1]);
  }
  return Number(clean) || 0;
}

export function parseSubtitleFile(input: string): Cue[] {
  const body = input
    .replace(/^\uFEFF/, "")
    .replace(/\r+/g, "")
    .replace(/(\d+:\d+:\d+),(\d+)/g, "$1.$2");
  const blocks = body.split(/\n{2,}/);
  const cues: Cue[] = [];
  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trimEnd()).filter((l) => l.length > 0);
    const timeIndex = lines.findIndex((l) => l.includes("-->"));
    if (timeIndex < 0) continue;
    const [startRaw, endRaw] = lines[timeIndex]!.split("-->");
    if (!startRaw || !endRaw) continue;
    const start = parseTimestamp(startRaw);
    const end = parseTimestamp(endRaw);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    const text = lines
      .slice(timeIndex + 1)
      .join("\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\{[^}]+\}/g, "")
      .trim();
    if (!text) continue;
    cues.push({ start, end, text });
  }
  return cues;
}

export function activeCue(cues: Cue[], time: number, offset: number) {
  const t = time + offset;
  for (const cue of cues) {
    if (t >= cue.start && t < cue.end) return cue;
  }
  return null;
}

export function upcomingCue(cues: Cue[], time: number, offset: number) {
  const t = time + offset;
  const current = activeCue(cues, time, offset);
  if (current) return current;
  return cues.find((cue) => cue.start >= t - 0.15) ?? cues[cues.length - 1] ?? null;
}

export function futureCue(cues: Cue[], time: number, offset: number, minAhead = 4) {
  const t = time + offset + minAhead;
  const soon = cues.filter((cue) => cue.start >= t);
  if (soon.length === 0) return null;
  const readable = (cue: Cue) => cue.text.replace(/\s+/g, " ").trim().length >= 8;
  return soon.find(readable) ?? soon[0] ?? null;
}

export function correlateOffset(
  samples: Array<{ t: number; voiced: boolean }>,
  cues: Cue[],
  range = 8,
  step = 0.05,
): { offset: number; score: number } | null {
  if (samples.length < 20 || cues.length === 0) return null;
  const voiced = samples.filter((s) => s.voiced);
  if (voiced.length < 8) return null;
  let best = { offset: 0, score: Number.NEGATIVE_INFINITY };
  for (let offset = -range; offset <= range + 1e-9; offset += step) {
    let hit = 0;
    let miss = 0;
    for (const sample of samples) {
      const t = sample.t + offset;
      let on = false;
      for (const cue of cues) {
        if (t >= cue.start && t < cue.end) {
          on = true;
          break;
        }
      }
      if (sample.voiced && on) hit += 1;
      else if (sample.voiced && !on) miss += 1;
      else if (!sample.voiced && !on) hit += 0.15;
      else miss += 0.1;
    }
    const score = hit - miss;
    if (score > best.score) best = { offset: Math.round(offset * 20) / 20, score };
  }
  if (!Number.isFinite(best.score) || best.score < voiced.length * 0.12) return null;
  return best;
}

export function formatOffset(seconds: number) {
  if (Math.abs(seconds) < 0.03) return "in sync";
  const sign = seconds > 0 ? "+" : "−";
  return `${sign}${Math.abs(seconds).toFixed(2)}s`;
}

const LANG_NAMES: Record<string, string> = {
  en: "English",
  eng: "English",
  es: "Spanish",
  spa: "Spanish",
  fr: "French",
  fre: "French",
  fra: "French",
  de: "German",
  ger: "German",
  deu: "German",
  it: "Italian",
  ita: "Italian",
  pt: "Portuguese",
  por: "Portuguese",
  pob: "Portuguese (BR)",
  pb: "Portuguese (BR)",
  ru: "Russian",
  rus: "Russian",
  ar: "Arabic",
  ara: "Arabic",
  hi: "Hindi",
  hin: "Hindi",
  ja: "Japanese",
  jpn: "Japanese",
  ko: "Korean",
  kor: "Korean",
  zh: "Chinese",
  zho: "Chinese",
  chi: "Chinese",
  nl: "Dutch",
  dut: "Dutch",
  nld: "Dutch",
  pl: "Polish",
  pol: "Polish",
  tr: "Turkish",
  tur: "Turkish",
  sv: "Swedish",
  swe: "Swedish",
  und: "Unknown",
};

export function subtitleLabel(sub: Subtitle) {
  const code = (sub.lang ?? sub.language ?? "und").toString().toLowerCase();
  return LANG_NAMES[code] ?? code.toUpperCase();
}

export function preferEnglish(subs: Subtitle[]) {
  const rank = (sub: Subtitle) => {
    const code = (sub.lang ?? sub.language ?? "").toString().toLowerCase();
    if (code === "eng" || code === "en") return 2;
    if (code.startsWith("en")) return 1;
    return 0;
  };
  return [...subs].sort((a, b) => rank(b) - rank(a))[0] ?? null;
}

export function preferSubtitle(subs: Subtitle[], lang?: string | null) {
  if (lang) {
    const needle = lang.toLowerCase();
    const match =
      subs.find((sub) => (sub.lang ?? sub.language ?? "").toString().toLowerCase() === needle) ??
      subs.find((sub) =>
        (sub.lang ?? sub.language ?? "").toString().toLowerCase().startsWith(needle.slice(0, 2)),
      );
    if (match) return match;
  }
  return preferEnglish(subs);
}

export function streamQuality(stream: Stream) {
  const text = `${stream.name ?? ""} ${stream.title ?? ""} ${stream.description ?? ""} ${stream.behaviorHints?.filename ?? ""}`;
  const match = text.match(/\b(8k|4k|2160p|1080p|720p|576p|480p|360p|240p)\b/i);
  if (!match) return null;
  const value = match[1]!.toUpperCase();
  if (value === "4K" || value === "2160P") return "4K";
  if (value === "8K") return "8K";
  return value.toLowerCase();
}

export function streamSizeLabel(stream: Stream) {
  const bytes = stream.behaviorHints?.videoSize;
  if (bytes && bytes > 0) {
    if (bytes >= 1_000_000_000) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
    if (bytes >= 1_000_000) return `${Math.round(bytes / 1_048_576)} MB`;
  }
  const text = `${stream.title ?? ""}\n${stream.description ?? ""}`;
  const match = text.match(/(\d+(?:\.\d+)?)\s*(GB|MB)/i);
  return match ? `${match[1]} ${match[2]!.toUpperCase()}` : null;
}

export function streamDetailLines(stream: Stream) {
  const raw = [stream.title, stream.description].filter(Boolean).join("\n");
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const name = stream.name?.trim();
  return lines.filter((line) => line !== name).slice(0, 3);
}
