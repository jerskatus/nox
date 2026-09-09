export function cleanSynopsis(raw?: string | null): string {
  if (!raw) return "";
  const text = raw
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!text) return "";

  const paragraphs = text
    .split(/\n\s*\n/)
    .map((part) => collapseRepeatedBlock(part.trim()))
    .filter(Boolean);

  const unique: string[] = [];
  for (const part of paragraphs) {
    if (unique.some((prev) => sameText(prev, part))) continue;
    unique.push(part);
  }

  return collapseRepeatedBlock(unique.join("\n\n")).trim();
}

export function synopsisFitsHero(text: string) {
  return cleanSynopsis(text).length <= 240;
}

function sameText(a: string, b: string) {
  return normalize(a) === normalize(b);
}

function normalize(value: string) {
  return value.replace(/\s+/g, " ").replace(/[.!?]+$/g, "").trim().toLowerCase();
}

function collapseRepeatedBlock(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length < 24) return compact;

  const spaced = splitInHalf(compact, true);
  if (spaced) return spaced;
  const glued = splitInHalf(compact, false);
  if (glued) return glued;

  const sentences = compact.split(/(?<=[.!?])\s+/).filter(Boolean);
  const out: string[] = [];
  for (const sentence of sentences) {
    if (out.length && sameText(out[out.length - 1]!, sentence)) continue;
    out.push(sentence);
  }
  if (out.length >= 2 && out.length % 2 === 0) {
    const half = out.length / 2;
    const left = out.slice(0, half).join(" ");
    const right = out.slice(half).join(" ");
    if (sameText(left, right)) return left;
  }
  return out.join(" ");
}

function splitInHalf(text: string, requireSpace: boolean): string | null {
  const n = text.length;
  const half = Math.floor(n / 2);
  if (requireSpace) {
    if (text[half] !== " " && text[half - 1] !== " ") return null;
    const left = text.slice(0, half).trim();
    const right = text.slice(half).trim();
    return sameText(left, right) ? left : null;
  }
  const left = text.slice(0, half).trim();
  const right = text.slice(half).trim();
  return sameText(left, right) ? left : null;
}
