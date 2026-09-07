import type { MetaPreview } from "@/lib/stremio/types";

export type FilterSort =
  | "popular"
  | "newest"
  | "oldest"
  | "rating"
  | "az"
  | "longest"
  | "shortest";
export type FilterRuntime = "short" | "feature" | "epic";
export type FilterKind = "" | "movie" | "series";

export type CatalogFilters = {
  genre: string;
  yearFrom: string;
  yearTo: string;
  rating: string;
  runtime: string;
  sort: FilterSort;
  kind: FilterKind;
};

export const DEFAULT_FILTERS: CatalogFilters = {
  genre: "",
  yearFrom: "",
  yearTo: "",
  rating: "",
  runtime: "",
  sort: "popular",
  kind: "",
};

export const MOVIE_GENRES = [
  "Action",
  "Adventure",
  "Animation",
  "Biography",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "Film-Noir",
  "History",
  "Horror",
  "Music",
  "Musical",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Sport",
  "Thriller",
  "War",
  "Western",
] as const;

export const SERIES_GENRES = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "Horror",
  "Mystery",
  "Reality",
  "Romance",
  "Sci-Fi",
  "Thriller",
  "War",
  "Western",
] as const;

export const KIND_PRESETS: { id: FilterKind; label: string }[] = [
  { id: "", label: "All" },
  { id: "movie", label: "Movies" },
  { id: "series", label: "Shows" },
];

const NOW = new Date().getFullYear();
/** Decade presets use the calendar end of the decade (2029), which is ahead of "now". */
export const YEAR_MAX = Math.max(NOW + 2, 2039);

export const YEAR_PRESETS: { id: string; label: string; from: number; to: number }[] = [
  { id: "new", label: "New", from: NOW - 1, to: NOW },
  { id: "5y", label: "5 yrs", from: NOW - 4, to: NOW },
  { id: "10y", label: "10 yrs", from: NOW - 9, to: NOW },
  { id: String(NOW), label: String(NOW), from: NOW, to: NOW },
  { id: String(NOW - 1), label: String(NOW - 1), from: NOW - 1, to: NOW - 1 },
  { id: String(NOW - 2), label: String(NOW - 2), from: NOW - 2, to: NOW - 2 },
  { id: "2020s", label: "2020s", from: 2020, to: 2029 },
  { id: "2010s", label: "2010s", from: 2010, to: 2019 },
  { id: "2000s", label: "2000s", from: 2000, to: 2009 },
  { id: "90s", label: "90s", from: 1990, to: 1999 },
  { id: "80s", label: "80s", from: 1980, to: 1989 },
  { id: "70s", label: "70s", from: 1970, to: 1979 },
  { id: "60s", label: "60s", from: 1960, to: 1969 },
  { id: "classic", label: "Classic", from: 1888, to: 1959 },
];

export const YEAR_OPTIONS = Array.from({ length: YEAR_MAX - 1919 }, (_, i) => YEAR_MAX - i);

export const RATING_PRESETS = [
  { id: "6", label: "6.0+" },
  { id: "6.5", label: "6.5+" },
  { id: "7", label: "7.0+" },
  { id: "7.5", label: "7.5+" },
  { id: "8", label: "8.0+" },
  { id: "8.5", label: "8.5+" },
  { id: "9", label: "9.0+" },
] as const;

export const RUNTIME_PRESETS: { id: FilterRuntime; label: string; hint: string }[] = [
  { id: "short", label: "Short", hint: "Under 90 min" },
  { id: "feature", label: "Feature", hint: "90–150 min" },
  { id: "epic", label: "Epic", hint: "Over 150 min" },
];

export const SORT_PRESETS: { id: FilterSort; label: string }[] = [
  { id: "popular", label: "Popular" },
  { id: "newest", label: "Newest" },
  { id: "oldest", label: "Oldest" },
  { id: "rating", label: "IMDb" },
  { id: "longest", label: "Longest" },
  { id: "shortest", label: "Shortest" },
  { id: "az", label: "A–Z" },
];

const SORTS: FilterSort[] = ["popular", "newest", "oldest", "rating", "az", "longest", "shortest"];

function isYear(value: unknown): value is string {
  if (typeof value !== "string" && typeof value !== "number") return false;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1888 && n <= YEAR_MAX;
}

function isRating(value: unknown): value is string {
  if (typeof value !== "string" && typeof value !== "number") return false;
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 && n <= 10;
}

export function parseCatalogFilters(s: Record<string, unknown>): CatalogFilters {
  const sort = s.sort;
  return {
    genre: typeof s.genre === "string" ? s.genre : "",
    yearFrom: isYear(s.yearFrom) ? String(s.yearFrom) : "",
    yearTo: isYear(s.yearTo) ? String(s.yearTo) : "",
    rating: isRating(s.rating) ? String(s.rating) : "",
    runtime:
      s.runtime === "short" || s.runtime === "feature" || s.runtime === "epic" ? s.runtime : "",
    sort: SORTS.includes(sort as FilterSort) ? (sort as FilterSort) : "popular",
    kind: s.kind === "movie" || s.kind === "series" ? s.kind : "",
  };
}

export type CatalogFilterSearch = {
  genre?: string;
  yearFrom?: number;
  yearTo?: number;
  rating?: number;
  runtime?: string;
  sort?: string;
  kind?: string;
};

export function catalogFiltersSearch(f: CatalogFilters): CatalogFilterSearch {
  const search: CatalogFilterSearch = {};
  if (f.genre) search.genre = f.genre;
  if (f.yearFrom) search.yearFrom = Number(f.yearFrom);
  if (f.yearTo) search.yearTo = Number(f.yearTo);
  if (f.rating) search.rating = Number(f.rating);
  if (f.runtime) search.runtime = f.runtime;
  if (f.sort && f.sort !== "popular") search.sort = f.sort;
  if (f.kind) search.kind = f.kind;
  return search;
}

export function catalogFiltersActive(f: CatalogFilters) {
  return Boolean(
    f.genre || f.yearFrom || f.yearTo || f.rating || f.runtime || f.kind || f.sort !== "popular",
  );
}

export function catalogFiltersNeedPool(f: CatalogFilters) {
  return Boolean(f.yearFrom || f.yearTo || f.rating || f.runtime || (f.sort && f.sort !== "popular"));
}

/** Newest → oldest years covered by the filter. Empty if no year is set. */
export function yearsFromFilters(filters: CatalogFilters): number[] {
  if (!filters.yearFrom && !filters.yearTo) return [];
  const from = Number(filters.yearFrom || filters.yearTo);
  const to = Number(filters.yearTo || filters.yearFrom);
  if (!Number.isInteger(from) || !Number.isInteger(to)) return [];
  const lo = Math.max(1888, Math.min(from, to));
  const hi = Math.min(YEAR_MAX, Math.max(from, to));
  const years: number[] = [];
  for (let y = hi; y >= lo; y--) years.push(y);
  return years;
}

export function yearCatalogPageCount(yearCount: number, pages: number) {
  if (yearCount <= 0) return Math.max(1, pages);
  if (yearCount === 1) return Math.max(12, pages);
  if (yearCount <= 3) return Math.max(6, pages);
  if (yearCount <= 12) return Math.max(4, pages);
  return Math.max(2, pages);
}

export function matchingYearPreset(yearFrom: string, yearTo: string) {
  if (!yearFrom && !yearTo) return "";
  const a = Number(yearFrom);
  const b = Number(yearTo);
  return YEAR_PRESETS.find((p) => p.from === a && p.to === b)?.id ?? "";
}

function yearsOf(item: MetaPreview): number[] {
  const extra = item as MetaPreview & { released?: string };
  const raw = `${item.year ?? ""} ${item.releaseInfo ?? ""} ${extra.released ?? ""}`;
  const found = [...raw.matchAll(/\b(18|19|20)\d{2}\b/g)]
    .map((m) => Number(m[0]))
    .filter((y) => y >= 1888 && y <= YEAR_MAX);
  return [...new Set(found)].sort((a, b) => a - b);
}

function genresOf(item: MetaPreview): string[] {
  const extra = item as MetaPreview & { genre?: string[] };
  const list = extra.genres?.length ? extra.genres : extra.genre;
  return Array.isArray(list) ? list : [];
}

function ratingOf(item: MetaPreview): number | null {
  const n = typeof item.imdbRating === "number" ? item.imdbRating : Number.parseFloat(String(item.imdbRating ?? ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function popularityOf(item: MetaPreview): number | null {
  const extra = item as MetaPreview & { popularity?: number | Record<string, number> };
  const p = extra.popularity;
  if (typeof p === "number" && Number.isFinite(p) && p > 0) return p;
  if (p && typeof p === "object") {
    const n = Number(p.moviedb ?? p.trakt ?? p.stremio ?? 0);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function runtimeOf(item: MetaPreview): number | null {
  const n = Number.parseInt(String(item.runtime ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function applyCatalogFilters(items: MetaPreview[], filters: CatalogFilters): MetaPreview[] {
  const from = filters.yearFrom ? Number(filters.yearFrom) : null;
  const to = filters.yearTo ? Number(filters.yearTo) : null;
  const minRating = filters.rating ? Number(filters.rating) : null;
  const genre = filters.genre.toLowerCase();

  const next = items.filter((item) => {
    if (filters.kind === "movie" && item.type !== "movie") return false;
    if (filters.kind === "series" && item.type !== "series" && item.type !== "tv") return false;
    if (genre) {
      const hit = genresOf(item).some((g) => g.toLowerCase() === genre);
      if (!hit) return false;
    }
    if (from !== null || to !== null) {
      const years = yearsOf(item);
      if (years.length === 0) return false;
      const start = Math.min(...years);
      const end = Math.max(...years);
      const lo = from ?? 0;
      const hi = to ?? YEAR_MAX;
      if (end < lo || start > hi) return false;
    }
    if (minRating !== null) {
      const rating = ratingOf(item);
      if (rating === null || rating < minRating) return false;
    }
    if (filters.runtime) {
      const mins = runtimeOf(item);
      if (mins === null) return false;
      if (filters.runtime === "short" && mins >= 90) return false;
      if (filters.runtime === "feature" && (mins < 90 || mins > 150)) return false;
      if (filters.runtime === "epic" && mins <= 150) return false;
    }
    return true;
  });

  const sorted = next.slice();
  if (filters.sort === "newest" || filters.sort === "oldest") {
    const yearCache = new Map<string, number[]>();
    const years = (item: MetaPreview) => {
      let hit = yearCache.get(item.id);
      if (!hit) {
        hit = yearsOf(item);
        yearCache.set(item.id, hit);
      }
      return hit;
    };
    sorted.sort((a, b) => {
      const ay = years(a);
      const by = years(b);
      if (filters.sort === "newest") return (by[by.length - 1] ?? 0) - (ay[ay.length - 1] ?? 0);
      return (ay[0] ?? 9999) - (by[0] ?? 9999);
    });
  } else if (filters.sort === "rating") {
    sorted.sort((a, b) => (ratingOf(b) ?? -1) - (ratingOf(a) ?? -1));
  } else if (filters.sort === "az") {
    sorted.sort((a, b) => a.name.localeCompare(b.name));
  } else if (filters.sort === "longest" || filters.sort === "shortest") {
    sorted.sort((a, b) => {
      const ar = runtimeOf(a) ?? (filters.sort === "longest" ? -1 : 9999);
      const br = runtimeOf(b) ?? (filters.sort === "longest" ? -1 : 9999);
      return filters.sort === "longest" ? br - ar : ar - br;
    });
  } else if (filters.sort === "popular" && (filters.yearFrom || filters.yearTo)) {
    sorted.sort((a, b) => {
      const pa = popularityOf(a);
      const pb = popularityOf(b);
      if (pa != null && pb != null) return pb - pa;
      if (pa != null) return -1;
      if (pb != null) return 1;
      return (ratingOf(b) ?? -1) - (ratingOf(a) ?? -1);
    });
  }
  return sorted;
}

export function filterSummary(filters: CatalogFilters) {
  const bits: string[] = [];
  if (filters.kind) bits.push(filters.kind === "movie" ? "Movies" : "Shows");
  if (filters.genre) bits.push(filters.genre);
  const preset = matchingYearPreset(filters.yearFrom, filters.yearTo);
  if (preset) {
    bits.push(YEAR_PRESETS.find((p) => p.id === preset)?.label ?? preset);
  } else if (filters.yearFrom || filters.yearTo) {
    bits.push(`${filters.yearFrom || "…"}–${filters.yearTo || "…"}`);
  }
  if (filters.rating) bits.push(`${filters.rating}+`);
  if (filters.runtime) {
    const rt = RUNTIME_PRESETS.find((p) => p.id === filters.runtime);
    if (rt) bits.push(rt.label);
  }
  if (filters.sort !== "popular") {
    const s = SORT_PRESETS.find((p) => p.id === filters.sort);
    if (s) bits.push(s.label);
  }
  return bits;
}
