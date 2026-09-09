import type { Stream } from "./types";

function blob(stream: Stream) {
  return `${stream.name ?? ""} ${stream.title ?? ""} ${stream.description ?? ""} ${stream.behaviorHints?.filename ?? ""} ${stream.behaviorHints?.bingeGroup ?? ""} ${stream.url ?? ""}`.toLowerCase();
}

function flagBlob(stream: Stream) {
  return `${stream.name ?? ""} ${stream.title ?? ""} ${stream.description ?? ""} ${stream.behaviorHints?.filename ?? ""} ${stream.behaviorHints?.bingeGroup ?? ""}`;
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
const TOKEN_EDGE = String.raw`(?:^|[\s.[(\]_{,+\-|/&])`;
const TOKEN_END = String.raw`(?=$|[\s.\])}_,+\-|/&])`;
const ENGLISH_AUDIO = new RegExp(`${TOKEN_EDGE}(?:english|eng|en-us|en-gb|en|gb|uk)${TOKEN_END}`, "i");
const FOREIGN_CODE = new RegExp(
  `${TOKEN_EDGE}(hin|tam|tel|mal|kan|mar|ben|pan|urd|lat|spa|fre|fra|vfq|vff|vostfr|ger|deu|ita|it|por|pt-br|rus|ru|jpn|jap|kor|chi|zho|ara|tha|vie|pol|tur|dut|nld|swe|nor|dan|fin|hun|cze|gre|heb|rum|ukr|ind|fil|es|fr|de|pt|pl|nl|ja|ko|zh|hi|tr|sv|cs|hu|ro|el|th|vi)${TOKEN_END}`,
  "i",
);
const FOREIGN_NAME =
  "hindi|tamil|telugu|malayalam|kannada|marathi|bengali|punjabi|urdu|spanish|espanol|español|castellano|latino|french|francais|français|german|deutsch|italian|italiano|portuguese|portugues|português|brazilian|russian|japanese|nihongo|korean|chinese|mandarin|cantonese|arabic|thai|vietnamese|polish|turkish|dutch|nederlands|swedish|norwegian|danish|finnish|hungarian|czech|greek|hebrew|romanian|ukrainian|indonesian|filipino|tagalog";
const FOREIGN_NAME_WORD = new RegExp(`\\b(?:${FOREIGN_NAME})\\b`, "i");
const FOREIGN_NAME_TAG = new RegExp(
  `\\b(?:${FOREIGN_NAME})\\b[\\s._-]*(?:1080p|720p|2160p|4k|bluray|web-?dl|webrip|hdtv|dub(?:bed)?|audio)|(?:1080p|720p|2160p|4k|bluray|web-?dl|webrip|hdtv)[\\s._-]*\\b(?:${FOREIGN_NAME})\\b`,
  "i",
);
const DUAL_AUDIO = /\bdual(?:[\s._-]*audio)?\b|\bmulti(?:[\s._-]*(?:audio|lang|language))?\b/i;
const FLAG_RE = /\p{Regional_Indicator}{2}/gu;
const EN_FLAG = new Set(["us", "gb", "au", "ca", "nz", "ie"]);
const FLAG_LANG: Record<string, string> = {
  us: "en",
  gb: "en",
  au: "en",
  ca: "en",
  nz: "en",
  ie: "en",
  it: "it",
  es: "es",
  mx: "es",
  ar: "es",
  fr: "fr",
  de: "de",
  in: "hi",
  jp: "ja",
  kr: "ko",
  br: "pt",
  pt: "pt",
  ru: "ru",
  cn: "zh",
  tw: "zh",
  hk: "zh",
  nl: "nl",
  pl: "pl",
  tr: "tr",
  sa: "ar",
  ae: "ar",
  se: "sv",
  no: "no",
  dk: "da",
  fi: "fi",
  hu: "hu",
  cz: "cs",
  gr: "el",
  il: "he",
  ro: "ro",
  ua: "uk",
  id: "id",
  ph: "tl",
  th: "th",
  vn: "vi",
};

const LANG_CC: Record<string, string> = {
  en: "gb",
  eng: "gb",
  english: "gb",
  gb: "gb",
  uk: "gb",
  us: "us",
  it: "it",
  ita: "it",
  italian: "it",
  italiano: "it",
  es: "es",
  spa: "es",
  spanish: "es",
  latino: "mx",
  lat: "mx",
  castellano: "es",
  espanol: "es",
  español: "es",
  fr: "fr",
  fre: "fr",
  fra: "fr",
  french: "fr",
  francais: "fr",
  français: "fr",
  vostfr: "fr",
  vff: "fr",
  vfq: "ca",
  de: "de",
  ger: "de",
  deu: "de",
  german: "de",
  deutsch: "de",
  hi: "in",
  hin: "in",
  hindi: "in",
  ta: "in",
  tam: "in",
  tamil: "in",
  te: "in",
  tel: "in",
  telugu: "in",
  ml: "in",
  mal: "in",
  malayalam: "in",
  kn: "in",
  kan: "in",
  kannada: "in",
  ja: "jp",
  jpn: "jp",
  jap: "jp",
  japanese: "jp",
  ko: "kr",
  kor: "kr",
  korean: "kr",
  zh: "cn",
  chi: "cn",
  zho: "cn",
  chinese: "cn",
  mandarin: "cn",
  cantonese: "hk",
  pt: "pt",
  por: "pt",
  portuguese: "pt",
  brazilian: "br",
  "pt-br": "br",
  ru: "ru",
  rus: "ru",
  russian: "ru",
  ar: "sa",
  ara: "sa",
  arabic: "sa",
  nl: "nl",
  dut: "nl",
  nld: "nl",
  dutch: "nl",
  nederlands: "nl",
  pl: "pl",
  pol: "pl",
  polish: "pl",
  tr: "tr",
  tur: "tr",
  turkish: "tr",
  sv: "se",
  swe: "se",
  swedish: "se",
  no: "no",
  nor: "no",
  norwegian: "no",
  da: "dk",
  dan: "dk",
  danish: "dk",
  fi: "fi",
  fin: "fi",
  finnish: "fi",
  hu: "hu",
  hun: "hu",
  hungarian: "hu",
  cs: "cz",
  cze: "cz",
  czech: "cz",
  el: "gr",
  gre: "gr",
  greek: "gr",
  he: "il",
  heb: "il",
  hebrew: "il",
  ro: "ro",
  rum: "ro",
  romanian: "ro",
  ua: "ua",
  ukr: "ua",
  ukrainian: "ua",
  id: "id",
  ind: "id",
  indonesian: "id",
  tl: "ph",
  fil: "ph",
  filipino: "ph",
  tagalog: "ph",
  th: "th",
  tha: "th",
  thai: "th",
  vi: "vn",
  vie: "vn",
  vietnamese: "vn",
};

export type SpokenLang = "en" | "foreign" | "dual" | "unknown";

export function isEnglishLabel(value?: string | null) {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  if (!v) return false;
  if (v === "en" || v === "eng" || v === "english" || v === "en-us" || v === "en-gb" || v === "en-au") return true;
  if (v.startsWith("en-") || v.startsWith("eng")) return true;
  return ENGLISH_AUDIO.test(v);
}

export function isForeignLabel(value?: string | null) {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  if (!v || isEnglishLabel(v)) return false;
  if (FOREIGN_CODE.test(v) || FOREIGN_NAME_WORD.test(v)) return true;
  if (v === "it" || v === "ita" || v === "italiano" || v === "italian") return true;
  return false;
}

export function spokenFrom(text: string): SpokenLang {
  const flags = flagCodes(text);
  const flagEn = flags.some((code) => EN_FLAG.has(code));
  const flagForeign = flags.some((code) => !EN_FLAG.has(code));
  const en = ENGLISH_AUDIO.test(text) || flagEn;
  const foreign = FOREIGN_CODE.test(text) || hasForeignName(text) || flagForeign;
  const dual = DUAL_AUDIO.test(text);
  if (dual || (en && foreign)) return "dual";
  if (en) return "en";
  if (foreign) return "foreign";
  return "unknown";
}

function flagCodes(text: string): string[] {
  const codes: string[] = [];
  for (const match of text.matchAll(FLAG_RE)) {
    const flag = match[0];
    const a = flag.codePointAt(0);
    const b = flag.codePointAt(2);
    if (a == null || b == null) continue;
    const c1 = a - 0x1f1e6;
    const c2 = b - 0x1f1e6;
    if (c1 < 0 || c1 > 25 || c2 < 0 || c2 > 25) continue;
    codes.push(String.fromCharCode(97 + c1, 97 + c2));
  }
  return codes;
}

function hasForeignName(text: string) {
  for (const block of text.matchAll(/[\[(]([^)\]]+)[\])]/g)) {
    if (FOREIGN_NAME_WORD.test(block[1] ?? "")) return true;
  }
  const year = text.search(/(?:19|20)\d{2}/);
  if (year >= 0 && FOREIGN_NAME_WORD.test(text.slice(year))) return true;
  return FOREIGN_NAME_TAG.test(text);
}

export function streamSpokenLabel(stream: Stream) {
  const text = blob(stream);
  const spoken = spokenFrom(text);
  if (spoken === "en") return "English";
  if (spoken === "dual") return "Dual audio";
  if (spoken === "foreign") {
    const named = text.match(new RegExp(`\\b(?:${FOREIGN_NAME})\\b`, "i"));
    const coded = text.match(FOREIGN_CODE);
    const flagged = flagCodes(text).find((code) => !EN_FLAG.has(code));
    const raw = (named?.[0] ?? coded?.[1] ?? coded?.[0] ?? flagged ?? FLAG_LANG[flagged ?? ""] ?? "").trim();
    return prettyLang(raw) || "Not English";
  }
  return null;
}

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
  spoken: SpokenLang;
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
    spoken: spokenFrom(text),
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
  if (flags.spoken === "foreign") score -= 20_000;
  else if (flags.spoken === "en") score += 400;
  else if (flags.spoken === "dual") score += 80;
  else score += 70;
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

function prettyLang(raw: string) {
  const key = raw.toLowerCase();
  const names: Record<string, string> = {
    hin: "Hindi",
    hindi: "Hindi",
    tam: "Tamil",
    tamil: "Tamil",
    tel: "Telugu",
    telugu: "Telugu",
    mal: "Malayalam",
    malayalam: "Malayalam",
    kan: "Kannada",
    kannada: "Kannada",
    spa: "Spanish",
    spanish: "Spanish",
    lat: "Latino",
    latino: "Latino",
    castellano: "Spanish",
    espanol: "Spanish",
    español: "Spanish",
    fre: "French",
    fra: "French",
    french: "French",
    francais: "French",
    français: "French",
    vostfr: "French",
    ger: "German",
    deu: "German",
    german: "German",
    deutsch: "German",
    ita: "Italian",
    it: "Italian",
    italian: "Italian",
    italiano: "Italian",
    por: "Portuguese",
    portuguese: "Portuguese",
    brazilian: "Portuguese",
    "pt-br": "Portuguese",
    rus: "Russian",
    ru: "Russian",
    russian: "Russian",
    gb: "English",
    uk: "English",
    us: "English",
    en: "English",
    eng: "English",
    jpn: "Japanese",
    jap: "Japanese",
    japanese: "Japanese",
    kor: "Korean",
    korean: "Korean",
    chi: "Chinese",
    zho: "Chinese",
    chinese: "Chinese",
    ara: "Arabic",
    arabic: "Arabic",
  };
  if (names[key]) return names[key];
  if (!raw) return null;
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

export function countryFlag(code: string) {
  const cc = code.trim().toLowerCase();
  if (!/^[a-z]{2}$/.test(cc)) return "";
  return String.fromCodePoint(0x1f1e6 + cc.charCodeAt(0) - 97, 0x1f1e6 + cc.charCodeAt(1) - 97);
}

export type SpokenFlag = {
  emoji: string;
  code: string;
  label: string;
};

function ccForLang(raw: string) {
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  if (LANG_CC[key]) return LANG_CC[key];
  if (key.length === 2 && (FLAG_LANG[key] || LANG_CC[key])) return LANG_CC[key] ?? key;
  return LANG_CC[key.slice(0, 3)] ?? LANG_CC[key.slice(0, 2)] ?? null;
}

export function spokenFlagsFromText(text: string): SpokenFlag[] {
  const spoken = spokenFrom(text);
  const out: SpokenFlag[] = [];
  const seen = new Set<string>();
  const add = (cc: string | null | undefined) => {
    if (!cc) return;
    const code = (cc === "uk" ? "gb" : cc).toLowerCase();
    if (seen.has(code)) return;
    const emoji = countryFlag(code);
    if (!emoji) return;
    seen.add(code);
    const lang = FLAG_LANG[code] ?? code;
    out.push({ emoji, code, label: prettyLang(lang) || code.toUpperCase() });
  };
  for (const cc of flagCodes(text)) add(cc);
  for (const token of isoLangTokens(text)) add(ccForLang(token));
  const compact = text.replace(/\s+/g, " ").trim();
  const labelLike = compact.length > 0 && compact.length <= 28 && !/\d{3,}/.test(compact);
  if (out.length === 0 && labelLike) {
    if (isEnglishLabel(compact)) add("gb");
    else {
      const named = compact.match(new RegExp(`^(?:${FOREIGN_NAME})$`, "i"));
      const coded = compact.match(FOREIGN_CODE);
      add(ccForLang(named?.[0] ?? coded?.[1] ?? coded?.[0] ?? compact));
    }
    return out;
  }
  if (out.length === 0) {
    if (spoken === "en") add("gb");
    else if (spoken === "foreign" || spoken === "dual") {
      const named = text.match(new RegExp(`\\b(?:${FOREIGN_NAME})\\b`, "i"));
      const coded = text.match(FOREIGN_CODE);
      add(ccForLang(named?.[0] ?? coded?.[1] ?? coded?.[0] ?? ""));
      if (spoken === "dual") add("gb");
    }
  } else if (spoken === "dual" && !out.some((flag) => EN_FLAG.has(flag.code))) {
    add("gb");
  }
  return out;
}

const ISO_LANG_TOKEN = new RegExp(
  `${TOKEN_EDGE}(gb|uk|en|eng|us|au|ca|nz|ie|ru|rus|it|ita|fr|fra|de|deu|es|spa|pt|pl|nl|jp|ja|kr|ko|cn|zh|hi|hin|ar|tr|se|sv|br|mx|cz|hu|ro|ua|gr|il|th|vn|multi)${TOKEN_END}`,
  "gi",
);

function isoLangTokens(text: string) {
  const grouped = [
    ...text.matchAll(/\[([a-z]{2,3}(?:\s*[+/|,]\s*[a-z]{2,3}){1,8})\]/gi),
    ...text.matchAll(/\b([a-z]{2,3}(?:\s*[+/|,]\s*[a-z]{2,3}){1,8})\b/gi),
  ];
  const tokens: string[] = [];
  for (const match of grouped) {
    for (const part of (match[1] ?? "").split(/[+/|,]/)) {
      const token = part.trim();
      if (token) tokens.push(token);
    }
  }
  if (tokens.length > 0) return tokens;
  return [...text.matchAll(ISO_LANG_TOKEN)].map((match) => match[1] ?? match[0] ?? "").filter(Boolean);
}

export function streamSpokenFlags(stream: Stream) {
  return spokenFlagsFromText(flagBlob(stream));
}
