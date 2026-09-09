const LANGS = [
  ["english", "en"],
  ["eng", "en"],
  ["american", "en"],
  ["british", "en"],
  ["italian", "it"],
  ["italiano", "it"],
  ["ita", "it"],
  ["french", "fr"],
  ["francais", "fr"],
  ["français", "fr"],
  ["fre", "fr"],
  ["fra", "fr"],
  ["spanish", "es"],
  ["espanol", "es"],
  ["español", "es"],
  ["spa", "es"],
  ["castilian", "es"],
  ["german", "de"],
  ["deutsch", "de"],
  ["ger", "de"],
  ["deu", "de"],
  ["russian", "ru"],
  ["russkiy", "ru"],
  ["rus", "ru"],
  ["japanese", "ja"],
  ["nihongo", "ja"],
  ["jpn", "ja"],
  ["jap", "ja"],
  ["korean", "ko"],
  ["kor", "ko"],
  ["portuguese", "pt"],
  ["portugues", "pt"],
  ["por", "pt"],
  ["brazilian", "pt"],
  ["polish", "pl"],
  ["pol", "pl"],
  ["hindi", "hi"],
  ["hin", "hi"],
  ["arabic", "ar"],
  ["ara", "ar"],
  ["chinese", "zh"],
  ["mandarin", "zh"],
  ["cantonese", "zh"],
  ["chi", "zh"],
  ["zho", "zh"],
  ["turkish", "tr"],
  ["tur", "tr"],
  ["dutch", "nl"],
  ["nld", "nl"],
  ["hungarian", "hu"],
  ["hun", "hu"],
  ["czech", "cs"],
  ["ces", "cs"],
  ["swedish", "sv"],
  ["svk", "sv"],
  ["norwegian", "no"],
  ["nor", "no"],
  ["finnish", "fi"],
  ["fin", "fi"],
  ["danish", "da"],
  ["dan", "da"],
  ["greek", "el"],
  ["ell", "el"],
  ["hebrew", "he"],
  ["heb", "he"],
  ["thai", "th"],
  ["ukrainian", "uk"],
  ["ukr", "uk"],
  ["romanian", "ro"],
  ["ron", "ro"],
  ["indonesian", "id"],
  ["ind", "id"],
  ["vietnamese", "vi"],
  ["vie", "vi"],
];

const ISO = /\b(en|eng|us|uk|gb|it|ita|fr|fre|fra|es|spa|de|ger|deu|ru|rus|ja|jpn|jp|ko|kor|pt|por|pl|pol|hi|hin|ar|ara|zh|chi|zho|tr|tur|nl|nld|hu|hun|cs|ces|sv|no|nb|fi|da|el|he|th|uk|ukr|ro|id|vi)\b/i;

const CODEC = /\b(truehd|atmos|e-?ac-?3|eac3|ac-?3|ac3|dts-?hd|dts|aac|mp3|opus|flac|pcm|eac-?3)\b/i;
const CHANNELS = /\b(7\.1|5\.1|2\.0|stereo|mono|atmos)\b/i;

export function parseVlcTrackName(name, id = 0) {
  const raw = String(name ?? "").trim();
  const lower = raw.toLowerCase();
  if (!raw || lower === "disable" || lower === "disabled") {
    return null;
  }
  let lang = "";
  for (const [label, code] of LANGS) {
    if (lower.includes(label)) {
      lang = code;
      break;
    }
  }
  if (!lang) {
    const bracket = raw.match(/\[([^\]]+)\]/);
    const blob = `${bracket?.[1] ?? ""} ${raw}`;
    const iso = ISO.exec(blob);
    if (iso) lang = normalizeIso(iso[1] ?? "");
  }
  const codec = (raw.match(CODEC)?.[1] ?? "").toLowerCase();
  const channels = raw.match(CHANNELS)?.[1] ?? "";
  return {
    index: Number(id) || 0,
    id: Number(id) || 0,
    name: raw,
    title: raw,
    lang,
    codec,
    channels,
    cinema: /truehd|atmos|e-?ac-?3|eac3|ac-?3|dts/i.test(raw + codec),
  };
}

export function normalizeIso(code) {
  const v = String(code ?? "").trim().toLowerCase();
  if (v === "eng" || v === "us" || v === "uk" || v === "gb") return "en";
  if (v === "ita") return "it";
  if (v === "fre" || v === "fra") return "fr";
  if (v === "spa") return "es";
  if (v === "ger" || v === "deu") return "de";
  if (v === "rus") return "ru";
  if (v === "jpn" || v === "jp") return "ja";
  if (v === "kor") return "ko";
  if (v === "por") return "pt";
  if (v === "pol") return "pl";
  if (v === "hin") return "hi";
  if (v === "ara") return "ar";
  if (v === "chi" || v === "zho") return "zh";
  if (v === "tur") return "tr";
  if (v === "nld") return "nl";
  return v.slice(0, 3);
}

export function vlcFitArgs(fit, width, height) {
  const w = Math.max(2, Math.round(Number(width) || 16));
  const h = Math.max(2, Math.round(Number(height) || 9));
  const ratio = `${w}:${h}`;
  switch (fit) {
    case "stretch":
      return { aspect: ratio, crop: "", scale: 0 };
    case "fill":
      return { aspect: "", crop: ratio, scale: 0 };
    case "zoom":
      return { aspect: "", crop: "", scale: 1.34 };
    default:
      return { aspect: "", crop: "", scale: 0 };
  }
}

export function vlcPlaybackReady(snap, elapsedMs = 0) {
  const state = Number(snap?.state) || 0;
  const playing = Boolean(snap?.playing);
  const time = Number(snap?.time) || 0;
  if (state === 3 || state === 4) return true;
  if (state === 2 && (playing || time > 0) && elapsedMs >= 800) return true;
  return false;
}

export function isHttpUrl(url) {
  try {
    const parsed = new URL(String(url ?? ""));
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
