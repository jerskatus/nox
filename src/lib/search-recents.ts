export type SearchRecent = { q: string; mode: "smart" | "title" };

const KEY = "nox-search-recents";
const MAX = 8;

function valid(item: unknown): item is SearchRecent {
  if (!item || typeof item !== "object") return false;
  const row = item as SearchRecent;
  return typeof row.q === "string" && row.q.trim().length >= 2 && (row.mode === "smart" || row.mode === "title");
}

export function readSearchRecents(): SearchRecent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(valid).slice(0, MAX);
  } catch {
    return [];
  }
}

export function pushSearchRecent(entry: SearchRecent): SearchRecent[] {
  const q = entry.q.trim();
  if (q.length < 2) return readSearchRecents();
  const next = [
    { q, mode: entry.mode },
    ...readSearchRecents().filter((item) => item.q.toLowerCase() !== q.toLowerCase()),
  ].slice(0, MAX);
  window.localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function removeSearchRecent(q: string): SearchRecent[] {
  const key = q.trim().toLowerCase();
  const next = readSearchRecents().filter((item) => item.q.toLowerCase() !== key);
  window.localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function clearSearchRecents(): SearchRecent[] {
  window.localStorage.removeItem(KEY);
  return [];
}
