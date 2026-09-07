import type { InstalledAddon, MetaPreview } from "./types";
import { interpretAsk, type AskTitle } from "./ask";
import { fetchCatalog, loadJsonMany } from "./client";
import { catalogsWithSearch, CINEMETA_URL, resourceUrl } from "./urls";

export type SearchIntent = {
  raw: string;
  ask: boolean;
  type?: "movie" | "series";
  genres: string[];
  moods: string[];
  like?: string;
  yearFrom?: number;
  yearTo?: number;
  terms: string[];
  chips: string[];
  requireAll?: string[];
};

export type RankedTitle = MetaPreview & {
  score: number;
  why: string[];
};

const GENRES = [
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
  "History",
  "Horror",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Sport",
  "Thriller",
  "War",
  "Western",
] as const;

const MOODS: { keys: string[]; genres: string[]; label: string }[] = [
  { keys: ["feel-good", "feel good", "cozy", "comfort", "wholesome", "heartwarming", "uplifting"], genres: ["Comedy", "Family", "Romance"], label: "feel-good" },
  { keys: ["dark", "grim", "bleak", "gritty"], genres: ["Drama", "Thriller", "Crime"], label: "dark" },
  { keys: ["mind-bending", "mind bending", "twisty", "cerebral", "trippy"], genres: ["Mystery", "Sci-Fi", "Thriller"], label: "mind-bending" },
  { keys: ["scary", "creepy", "spooky", "horror"], genres: ["Horror"], label: "scary" },
  { keys: ["romcom", "rom-com", "romantic comedy"], genres: ["Romance", "Comedy"], label: "rom-com" },
  { keys: ["heist", "caper"], genres: ["Crime", "Action"], label: "heist" },
  { keys: ["space", "astronaut", "galaxy"], genres: ["Sci-Fi", "Adventure"], label: "space" },
  { keys: ["time travel", "time-travel"], genres: ["Sci-Fi", "Adventure"], label: "time travel" },
  { keys: ["war", "ww2", "wwii"], genres: ["War", "History"], label: "war" },
  { keys: ["true crime"], genres: ["Crime", "Documentary"], label: "true crime" },
  { keys: ["anime"], genres: ["Animation"], label: "anime" },
  { keys: ["kids", "family friendly", "for kids"], genres: ["Family", "Animation"], label: "family" },
  { keys: ["superhero", "marvel", "dc"], genres: ["Action", "Adventure"], label: "superhero" },
  { keys: ["rainy", "rainy-day", "rainy day"], genres: ["Drama", "Romance"], label: "rainy-day" },
  { keys: ["christmas", "holiday", "xmas"], genres: ["Comedy", "Family", "Romance"], label: "holiday" },
  { keys: ["coming of age", "coming-of-age"], genres: ["Drama"], label: "coming of age" },
];

const STOP = new Set([
  "a", "an", "the", "of", "and", "or", "in", "on", "for", "with", "to", "me", "i", "my",
  "want", "wanna", "watch", "watching", "something", "some", "any", "please", "find",
  "looking", "show", "shows", "movie", "movies", "film", "films", "series", "tv",
  "like", "similar", "about", "that", "this", "are", "is", "it", "from", "good",
  "best", "great", "recommend", "recommendation", "recommendations", "suggest",
  "what", "can", "you", "give", "need", "but", "not",
]);

const SIMILAR: Record<string, string[]> = {
  inception: ["Interstellar", "The Prestige", "Shutter Island", "Tenet", "Primer"],
  interstellar: ["Inception", "Arrival", "The Martian", "Gravity", "Contact"],
  "the bear": ["The Menu", "Boiling Point", "Chef", "The Restaurant"],
  "breaking bad": ["Better Call Saul", "Narcos", "Ozark", "The Wire", "Snowfall"],
  "the office": ["Parks and Recreation", "Brooklyn Nine-Nine", "Superstore", "Abbott Elementary"],
  "stranger things": ["Dark", "The Umbrella Academy", "Locke & Key", "Wednesday"],
  dune: ["Blade Runner 2049", "Foundation", "Star Wars", "Arrival"],
  parasite: ["Memories of Murder", "Snowpiercer", "Burning", "The Handmaiden"],
  "john wick": ["The Raid", "Nobody", "Atomic Blonde", "Extraction"],
  "game of thrones": ["House of the Dragon", "The Witcher", "Vikings", "The Last Kingdom"],
  "the boys": ["Invincible", "Watchmen", "Gen V", "Jupiter's Legacy"],
  "true detective": ["Mindhunter", "Zodiac", "Mare of Easttown", "The Night Of"],
  "la la land": ["Whiplash", "The Greatest Showman", "Begin Again"],
  "everything everywhere": ["Swiss Army Man", "Being John Malkovich", "The Matrix"],
  "the last of us": ["The Walking Dead", "Station Eleven", "Sweet Tooth"],
  succession: ["Billions", "Industry", "Mad Men", "Veep"],
  "severance": ["Dark", "The Leftovers", "Mr. Robot", "WandaVision"],
  "the godfather": ["Goodfellas", "Casino", "The Irishman", "Once Upon a Time in America"],
  spirited: ["Howl's Moving Castle", "Princess Mononoke", "My Neighbor Totoro", "Your Name"],
  "spirited away": ["Howl's Moving Castle", "Princess Mononoke", "Nausicaä", "Your Name"],
};

const TROPES: { keys: string[]; titles: string[]; chips: string[] }[] = [
  {
    keys: ["road trip", "roadtrip", "road-trip", "road trip", "on a trip", "cross country", "cross-country"],
    titles: [
      "Road Trip",
      "Thelma & Louise",
      "Dumb and Dumber",
      "Little Miss Sunshine",
      "Superbad",
      "Harold & Kumar Go to White Castle",
      "EuroTrip",
      "Due Date",
      "Planes, Trains and Automobiles",
      "National Lampoon's Vacation",
      "Easy Rider",
      "Sideways",
      "Almost Famous",
      "Stand by Me",
      "We're the Millers",
    ],
    chips: ["road trip", "comedy"],
  },
];

export const ASK_PROMPTS = [
  "Feel-good 90s romcoms",
  "Shows like The Bear",
  "Dark mind-bending sci-fi",
  "Korean thrillers",
  "Cozy rainy-day movies",
  "Heist movies from the 2000s",
];

export function parseIntent(raw: string): SearchIntent {
  const q = raw.trim();
  const lower = ` ${q.toLowerCase()} `;

  let type: "movie" | "series" | undefined;
  const wantsShow = /\b(shows?|series|tv|anime)\b/.test(lower);
  const wantsMovie = /\b(movies?|films?)\b/.test(lower);
  if (wantsShow && !wantsMovie) type = "series";
  if (wantsMovie && !wantsShow) type = "movie";
  if (!type && /\b(romcom|rom-com|romcoms|heist)\b/.test(lower)) type = "movie";

  const genres: string[] = [];
  for (const genre of GENRES) {
    const needle = genre.toLowerCase().replace("-", " ");
    if (lower.includes(` ${needle} `) || lower.includes(` ${genre.toLowerCase()} `)) {
      genres.push(genre);
    }
  }
  if (/\bsci[\s-]?fi\b|science fiction/.test(lower) && !genres.includes("Sci-Fi")) genres.push("Sci-Fi");
  if (/\bk-?drama|korean/.test(lower) && !genres.includes("Drama")) genres.push("Drama");
  if (/\bk-?drama\b/.test(lower)) type = type ?? "series";

  const moods: string[] = [];
  const romcom = /\b(romcom|rom-com|romcoms|romantic comedy|romantic comedies)\b/.test(lower);
  for (const mood of MOODS) {
    if (!mood.keys.some((key) => lower.includes(key)) && !(romcom && mood.label === "rom-com")) continue;
    moods.push(mood.label);
    for (const genre of mood.genres) {
      if (romcom && genre === "Family") continue;
      if (!genres.includes(genre)) genres.push(genre);
    }
  }

  let requireAll: string[] | undefined;
  if (moods.includes("rom-com")) {
    type = type ?? "movie";
    genres.splice(0, genres.length, ...["Romance", "Comedy", ...genres.filter((g) => g !== "Family" && g !== "Romance" && g !== "Comedy")]);
    requireAll = ["Romance", "Comedy"];
  }

  let yearFrom: number | undefined;
  let yearTo: number | undefined;
  const decade = lower.match(/\b(19|20)(\d)0s\b/);
  if (decade) {
    yearFrom = Number(decade[1] + decade[2] + "0");
    yearTo = yearFrom + 9;
  }
  const year = lower.match(/\b((?:19|20)\d{2})\b/);
  if (year && !decade) {
    const n = Number(year[1]);
    yearFrom = n - 1;
    yearTo = n + 1;
  }
  if (/\b(90s|nineties)\b/.test(lower)) {
    yearFrom = 1990;
    yearTo = 1999;
  }
  if (/\b(80s|eighties)\b/.test(lower)) {
    yearFrom = 1980;
    yearTo = 1989;
  }
  if (/\b(2000s|two thousands)\b/.test(lower)) {
    yearFrom = 2000;
    yearTo = 2009;
  }

  let like: string | undefined;
  const likeMatch = q.match(/\b(?:like|similar to)\s+(.+?)(?:\s+but\b|$)/i);
  if (likeMatch?.[1]) {
    like = likeMatch[1]
      .replace(/\b(movies?|films?|shows?|series|tv)\b/gi, "")
      .replace(/[?.!,]+$/g, "")
      .trim();
    if (like.length < 2) like = undefined;
  }

  const terms = q
    .toLowerCase()
    .replace(/[^a-z0-9\s:'-]/g, " ")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 1 && !STOP.has(part));

  const ask =
    Boolean(like || moods.length || yearFrom || (genres.length && q.split(/\s+/).length >= 3)) ||
    /\b(about|vibe|mood|recommend|something)\b/.test(lower) ||
    q.split(/\s+/).length >= 5;

  const chips: string[] = [];
  if (type === "series") chips.push("TV shows");
  if (type === "movie") chips.push("Movies");
  chips.push(...moods);
  chips.push(...genres.slice(0, 3));
  if (yearFrom && yearTo) chips.push(yearFrom === yearTo - 9 ? `${yearFrom}s` : `${yearFrom}–${yearTo}`);
  if (like) chips.push(`like ${like}`);

  return {
    raw: q,
    ask,
    type,
    genres: genres.slice(0, 3),
    moods,
    like,
    yearFrom,
    yearTo,
    terms,
    chips: unique(chips),
    requireAll,
  };
}

export async function smartSearch(query: string, addons: InstalledAddon[]): Promise<{
  intent: SearchIntent;
  items: RankedTitle[];
}> {
  const intent = parseIntent(query);

  if (intent.ask) {
    const grok = await interpretAsk({ data: { query } });
    const wanted: AskTitle[] = grok.ok
      ? grok.titles
      : tropeTitles(intent);
    if (grok.ok) {
      if (grok.type) intent.type = grok.type;
      intent.chips = unique([...grok.chips, ...intent.chips]).slice(0, 8);
    } else if (wanted.length) {
      intent.chips = unique(["road trip", ...intent.chips]);
    }
    if (wanted.length) {
      const resolved = await resolveNamedTitles(wanted, intent);
      if (resolved.length > 0) return { intent, items: resolved };
    }
    // Plot queries must not fall through to raw keyword search (that is how
    // "best friends / road trip" became Friends + Going in Style).
    if (intent.ask && !intent.like) return { intent, items: [] };
  }
  const catalogs = catalogsWithSearch(addons)
    .sort((a, b) => Number(b.addonName === "Cinemeta") - Number(a.addonName === "Cinemeta"))
    .slice(0, 6);
  const types = intent.type ? [intent.type] : ["movie", "series"];

  if (intent.like) {
    const seedRows = await Promise.all(
      types.map((type) => fetchCatalog(CINEMETA_URL, type, "top", { search: intent.like })),
    );
    const flat = seedRows.flat();
    const needle = intent.like.toLowerCase();
    const exact = flat.filter((item) => item.name.toLowerCase() === needle);
    const named = flat
      .filter((item) => item.name.toLowerCase().includes(needle))
      .sort((a, b) => a.name.length - b.name.length);
    const seed = (exact[0] ?? named[0] ?? flat[0]) as MetaPreview | undefined;
    if (seed?.genres?.length) {
      for (const genre of seed.genres) {
        if (!intent.genres.includes(genre) && GENRES.includes(genre as (typeof GENRES)[number])) {
          intent.genres.push(genre);
        }
      }
      intent.genres = intent.genres.slice(0, 3);
      intent.chips = unique([...intent.chips, ...intent.genres]);
    }
  }

  const urls: string[] = [];
  const searchTerms = unique(
    [
      intent.like,
      intent.like ? undefined : moodSearchTerm(intent),
      intent.like ? undefined : intent.terms.filter((t) => !["romcom", "romcoms", "rom-com", "feel-good", "90s", "80s"].includes(t)).slice(0, 3).join(" "),
      ...(intent.like ? similarTitles(intent.like).slice(0, 2) : []),
    ].filter((term): term is string => Boolean(term && term.trim().length >= 2)),
  ).slice(0, 3);

  for (const term of searchTerms) {
    for (const catalog of catalogs) {
      if (intent.type && catalog.type !== intent.type && catalog.type !== "tv") continue;
      urls.push(resourceUrl(catalog.transportUrl, "catalog", catalog.type, catalog.id, { search: term }));
    }
  }

  for (const title of seedTitles(intent)) {
    for (const type of types) {
      urls.push(resourceUrl(CINEMETA_URL, "catalog", type, "top", { search: title }));
    }
  }

  const genreFetches = types.flatMap((type) =>
    intent.genres.slice(0, 2).map((genre) => fetchCatalog(CINEMETA_URL, type, "top", { genre })),
  );

  const [searchResults, ...genreRows] = await Promise.all([
    urls.length ? loadJsonMany(urls) : Promise.resolve([]),
    ...genreFetches,
  ]);

  const pool: MetaPreview[] = [];
  const seen = new Set<string>();

  function add(item: MetaPreview | undefined) {
    if (!item?.id || !item.name) return;
    const key = `${item.type}:${item.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    pool.push(item);
  }

  if (Array.isArray(searchResults)) {
    for (const result of searchResults) {
      if (!result.ok) continue;
      const metas = ((result.data as { metas?: MetaPreview[] }).metas ?? []) as MetaPreview[];
      for (const meta of metas) add(meta);
    }
  }

  for (const row of genreRows) {
    if (!Array.isArray(row)) continue;
    for (const meta of row) add(meta);
  }

  const ranked = pool
    .map((item) => scoreItem(item, intent))
    .filter((item) => {
      if (intent.type && item.type !== intent.type) return false;
      if (intent.yearFrom && intent.yearTo) {
        const year = itemYear(item);
        if (year && (year < intent.yearFrom || year > intent.yearTo)) return false;
      }
      if (intent.moods.includes("rom-com")) {
        const have = (item.genres ?? []).map((g) => g.toLowerCase());
        if (have.some((g) => g === "war" || g === "horror" || g === "documentary")) return false;
      }
      if (intent.requireAll?.length) {
        const have = (item.genres ?? []).map((g) => g.toLowerCase());
        if (have.length > 0 && intent.requireAll.some((need) => !have.includes(need.toLowerCase()))) {
          return false;
        }
      }
      return item.score > 0;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 48);

  return { intent, items: ranked };
}

function scoreItem(item: MetaPreview, intent: SearchIntent): RankedTitle {
  let score = 8;
  const why: string[] = [];
  const name = item.name.toLowerCase();
  const hay = `${name} ${(item.description ?? "").toLowerCase()} ${(item.genres ?? []).join(" ").toLowerCase()}`;
  const year = itemYear(item);
  const genres = item.genres ?? [];

  if (intent.like) {
    const likeName = intent.like.toLowerCase();
    if (name === likeName) {
      score += 110;
      why.push("Exact match");
    } else if (name.startsWith(likeName)) {
      score += 24;
    }
    for (const title of similarTitles(intent.like)) {
      if (name === title.toLowerCase() || name.includes(title.toLowerCase())) {
        score += 42;
        why.push(`Similar to ${intent.like}`);
      }
    }
  }

  for (const term of intent.terms) {
    if (intent.like && intent.like.toLowerCase().includes(term)) continue;
    if (name.includes(term)) score += 18;
    else if (hay.includes(term)) score += 6;
  }

  let genreHits = 0;
  for (const genre of intent.genres) {
    if (genres.some((g) => g.toLowerCase() === genre.toLowerCase())) {
      genreHits += 1;
      score += 16;
    }
  }
  if (intent.requireAll?.length) {
    const have = genres.map((g) => g.toLowerCase());
    const matched = intent.requireAll.filter((need) => have.includes(need.toLowerCase()));
    if (matched.length === intent.requireAll.length) {
      score += 40;
      why.push(intent.requireAll.join(" + "));
    }
  }
  const seeds = seedTitles(intent).map((title) => title.toLowerCase());
  if (seeds.some((seed) => name === seed || name.includes(seed) || seed.includes(name))) score += 70;
  if (genreHits) why.push(intent.genres.slice(0, 2).join(" · "));

  if (intent.yearFrom && intent.yearTo && year) {
    if (year >= intent.yearFrom && year <= intent.yearTo) {
      score += 22;
      why.push(String(year));
    }
  }

  const rating = Number(item.imdbRating);
  if (!Number.isNaN(rating) && rating > 0) score += rating * 1.4;

  if (intent.type && item.type === intent.type) score += 8;

  if (intent.moods.length && genreHits) why.push(...intent.moods.slice(0, 1));

  return { ...item, score, why: unique(why).slice(0, 3) };
}

function moodSearchTerm(intent: SearchIntent) {
  if (intent.moods.includes("rom-com")) return "romantic comedy";
  if (intent.moods.includes("heist")) return "heist";
  if (intent.moods.includes("true crime")) return "true crime";
  return undefined;
}

function seedTitles(intent: SearchIntent) {
  if (!intent.moods.includes("rom-com")) return [];
  if (intent.yearFrom === 1990) {
    return [
      "10 Things I Hate About You",
      "Notting Hill",
      "Clueless",
      "You've Got Mail",
      "The Wedding Singer",
      "Sleepless in Seattle",
      "My Best Friend's Wedding",
      "There's Something About Mary",
      "Pretty Woman",
      "While You Were Sleeping",
      "She's All That",
      "Never Been Kissed",
    ];
  }
  if (intent.yearFrom === 2000) {
    return ["How to Lose a Guy in 10 Days", "13 Going on 30", "Love Actually", "The Proposal"];
  }
  return ["Crazy Rich Asians", "Anyone But You", "Set It Up", "Notting Hill"];
}

function similarTitles(like: string) {
  const key = like.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  const hit = Object.entries(SIMILAR).find(([name]) => key.includes(name) || name.includes(key));
  return hit?.[1] ?? [];
}

function itemYear(item: MetaPreview) {
  const raw = String(item.year ?? item.releaseInfo ?? "");
  const match = raw.match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : null;
}

function unique(items: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.trim();
    if (!key || seen.has(key.toLowerCase())) continue;
    seen.add(key.toLowerCase());
    out.push(key);
  }
  return out;
}

function tropeTitles(intent: SearchIntent): AskTitle[] {
  const q = intent.raw.toLowerCase();
  const out: AskTitle[] = [];
  for (const trope of TROPES) {
    if (!trope.keys.some((key) => q.includes(key))) continue;
    intent.chips = unique([...trope.chips, ...intent.chips]);
    for (const name of trope.titles) {
      out.push({
        name,
        type: intent.type ?? "movie",
        why: trope.chips[0] ?? "match",
      });
    }
  }
  return out.slice(0, 14);
}

async function resolveNamedTitles(wanted: AskTitle[], intent: SearchIntent): Promise<RankedTitle[]> {
  const types = intent.type ? [intent.type] : ["movie", "series"];
  const urls = wanted.flatMap((title) =>
    types
      .filter((type) => !title.type || title.type === type || types.length === 1)
      .slice(0, 1)
      .map((type) => resourceUrl(CINEMETA_URL, "catalog", type, "top", { search: title.name })),
  );
  const results = urls.length ? await loadJsonMany(urls.slice(0, 24)) : [];
  const ranked: RankedTitle[] = [];
  const seen = new Set<string>();

  wanted.forEach((want, index) => {
    const needle = want.name.toLowerCase();
    const year = want.year;
    const pool: MetaPreview[] = [];
    for (const result of results) {
      if (!result.ok) continue;
      const metas = ((result.data as { metas?: MetaPreview[] }).metas ?? []) as MetaPreview[];
      for (const meta of metas) pool.push(meta);
    }
    const match = pickNamed(pool, needle, year);
    if (!match) return;
    const key = `${match.type}:${match.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    ranked.push({
      ...match,
      score: 1000 - index,
      why: want.why ? [want.why] : [],
    });
  });

  return ranked;
}

function pickNamed(pool: MetaPreview[], needle: string, year?: number) {
  const compact = needle.replace(/[^a-z0-9]+/g, " ").trim();
  const scored = pool
    .map((item) => {
      const name = item.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      let score = 0;
      if (name === compact) score += 100;
      else if (name.startsWith(compact)) score += 70;
      else if (compact.startsWith(name) && name.length > 4) score += 50;
      else if (name.includes(compact) && Math.abs(name.length - compact.length) < 12) score += 30;
      else return null;
      const y = itemYear(item);
      if (year && y) {
        if (y === year) score += 20;
        else if (Math.abs(y - year) <= 1) score += 8;
        else if (Math.abs(y - year) > 8) score -= 25;
      }
      return { item, score };
    })
    .filter((row): row is { item: MetaPreview; score: number } => Boolean(row))
    .sort((a, b) => b.score - a.score);
  return scored[0]?.item;
}
