import type { InstalledAddon, MetaPreview } from "./types";
import { interpretAsk, type AskTitle } from "./ask";
import { fetchCatalog, loadJsonMany } from "./client";
import { MOODS, TROPES, anyKeyMatches } from "./search-packs";
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
  "Music",
] as const;

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
  "pulp fiction": ["Reservoir Dogs", "Snatch", "Lock, Stock and Two Smoking Barrels", "Kill Bill"],
  "fight club": ["American Psycho", "Nightcrawler", "Taxi Driver", "Joker"],
  "the matrix": ["Dark City", "Equilibrium", "Inception", "Blade Runner"],
  "mad max": ["John Wick", "The Raid", "Dredd", "Fury Road"],
  "mad max fury road": ["Dredd", "John Wick", "District 9", "Children of Men"],
  "get out": ["Us", "Nope", "The Invisible Man", "Sorry to Bother You"],
  "hereditary": ["Midsommar", "The Witch", "Saint Maud", "The Babadook"],
  "the shining": ["The Exorcist", "Rosemary's Baby", "The Others", "Session 9"],
  "alien": ["The Thing", "Aliens", "Event Horizon", "Life"],
  "jurassic park": ["Jaws", "Kong: Skull Island", "Super 8", "The Lost World"],
  "jaws": ["Jurassic Park", "The Meg", "Deep Blue Sea", "Open Water"],
  "forrest gump": ["The Green Mile", "Cast Away", "Big Fish", "The Curious Case of Benjamin Button"],
  "the notebook": ["A Walk to Remember", "The Best of Me", "Dear John", "PS I Love You"],
  "10 things i hate about you": ["Clueless", "She's All That", "Can't Hardly Wait", "Easy A"],
  clueless: ["10 Things I Hate About You", "Mean Girls", "Easy A", "Legally Blonde"],
  "mean girls": ["Clueless", "Easy A", "Heathers", "Jawbreaker"],
  "notting hill": ["You've Got Mail", "Love Actually", "Four Weddings and a Funeral", "About Time"],
  "love actually": ["Notting Hill", "The Holiday", "Bridget Jones's Diary", "About Time"],
  "superbad": ["Knocked Up", "Pineapple Express", "Project X", "Booksmart"],
  "the hangover": ["Superbad", "Due Date", "Project X", "We're the Millers"],
  "bridesmaids": ["Trainwreck", "Rough Night", "The House Bunny", "Sisters"],
  "legally blonde": ["Clueless", "13 Going on 30", "The Princess Diaries", "Miss Congeniality"],
  "pride and prejudice": ["Sense and Sensibility", "Emma", "Little Women", "Bridgerton"],
  bridgerton: ["Downton Abbey", "Outlander", "Sanditon", "The Buccaneers"],
  "the crown": ["The Queen", "The King's Speech", "The Gilded Age", "Victoria"],
  "sherlock": ["True Detective", "Luther", "Broadchurch", "Endeavour"],
  "peaky blinders": ["Boardwalk Empire", "Gangs of London", "The Gentlemen", "Taboo"],
  "the wire": ["The Shield", "Bosch", "We Own This City", "The Night Of"],
  narcos: ["Sicario", "Traffic", "ZeroZeroZero", "El Chapo"],
  "better call saul": ["Breaking Bad", "The Lincoln Lawyer", "The Night Of", "Michael Clayton"],
  "black mirror": ["The Twilight Zone", "Westworld", "Devs", "Love, Death & Robots"],
  westworld: ["Black Mirror", "Devs", "Ex Machina", "Humans"],
  "the mandalorian": ["Andor", "The Book of Boba Fett", "Ahsoka", "Rogue One"],
  "andor": ["The Mandalorian", "Rogue One", "Children of Men", "Sicario"],
  "the witcher": ["Game of Thrones", "Shadow and Bone", "The Wheel of Time", "Vikings"],
  "house of the dragon": ["Game of Thrones", "The Witcher", "Vikings", "The Last Kingdom"],
  wednesday: ["The Addams Family", "Stranger Things", "Locke & Key", "Chilling Adventures of Sabrina"],
  "squid game": ["Alice in Borderland", "The Platform", "Battle Royale", "Hunger Games"],
  "the hunger games": ["Divergent", "Battle Royale", "The Maze Runner", "Squid Game"],
  "harry potter": ["The Lord of the Rings", "Percy Jackson", "Fantastic Beasts", "The Golden Compass"],
  "lord of the rings": ["The Hobbit", "Harry Potter", "Dune", "Willow"],
  "the hobbit": ["The Lord of the Rings", "Willow", "Eragon", "Narnia"],
  "star wars": ["Dune", "Guardians of the Galaxy", "Serenity", "The Mandalorian"],
  "guardians of the galaxy": ["Thor: Ragnarok", "The Suicide Squad", "Star Wars", "Galaxy Quest"],
  "iron man": ["The Avengers", "Spider-Man", "Black Panther", "Doctor Strange"],
  "spider-man": ["Iron Man", "The Amazing Spider-Man", "Into the Spider-Verse", "Superman"],
  "batman": ["The Dark Knight", "Joker", "The Batman", "Watchmen"],
  "the dark knight": ["Joker", "The Batman", "Zodiac", "Heat"],
  joker: ["Taxi Driver", "The King of Comedy", "Nightcrawler", "The Dark Knight"],
  "whiplash": ["Black Swan", "Birdman", "Sound of Metal", "Tick, Tick... Boom!"],
  "la la": ["Whiplash", "The Greatest Showman", "Tick, Tick... Boom!"],
  oldboy: ["I Saw the Devil", "Sympathy for Mr. Vengeance", "The Handmaiden", "Decision to Leave"],
  "train to busan": ["Peninsula", "World War Z", "28 Days Later", "#Alive"],
  "your name": ["Weathering with You", "Suzume", "A Silent Voice", "Garden of Words"],
  "attack on titan": ["Vinland Saga", "Demon Slayer", "Jujutsu Kaisen", "Tokyo Ghoul"],
  "demon slayer": ["Jujutsu Kaisen", "Attack on Titan", "My Hero Academia", "Chainsaw Man"],
  "studio ghibli": ["Spirited Away", "Howl's Moving Castle", "Princess Mononoke", "Kiki's Delivery Service"],
  "the menu": ["The Bear", "Ready or Not", "Triangle of Sadness", "Fresh"],
  "knives out": ["Glass Onion", "Clue", "Murder on the Orient Express", "See How They Run"],
  "gone girl": ["The Girl on the Train", "Prisoners", "Zodiac", "Sharp Objects"],
  "no country": ["There Will Be Blood", "Hell or High Water", "Wind River", "Sicario"],
  sicario: ["Sicario", "Zero Dark Thirty", "The Town", "Heat"],
  heat: ["Heat", "The Town", "Den of Thieves", "Collateral"],
  "ocean's": ["Ocean's Eleven", "The Italian Job", "Logan Lucky", "Now You See Me"],
  "now you see me": ["Ocean's Eleven", "The Prestige", "Focus", "Trap"],
  "mission impossible": ["James Bond", "The Bourne Identity", "Jack Reacher", "Atomic Blonde"],
  bourne: ["The Bourne Identity", "Mission: Impossible", "Jack Ryan", "Atomic Blonde"],
  "james bond": ["Mission: Impossible", "The Bourne Identity", "Kingsman", "Atomic Blonde"],
  kingsman: ["Kick-Ass", "The Gentlemen", "Matthew Vaughn", "Scott Pilgrim"],
  "die hard": ["Speed", "Olympus Has Fallen", "The Raid", "John Wick"],
  "top gun": ["Days of Thunder", "Ford v Ferrari", "Rush", "Need for Speed"],
  "fast and furious": ["Need for Speed", "Baby Driver", "Drive", "Gone in 60 Seconds"],
  drive: ["Nightcrawler", "Baby Driver", "Only God Forgives", "The Place Beyond the Pines"],
  "baby driver": ["Drive", "Baby Driver", "Edgar Wright", "Scott Pilgrim vs. the World"],
  "shaun of the dead": ["Hot Fuzz", "Zombieland", "What We Do in the Shadows", "Tucker and Dale vs Evil"],
  "hot fuzz": ["Shaun of the Dead", "The World's End", "21 Jump Street", "The Nice Guys"],
  "what we do in the shadows": ["Shaun of the Dead", "Wellington Paranormal", "Our Flag Means Death", "The Office"],
  "parks and rec": ["The Office", "Brooklyn Nine-Nine", "Superstore", "Abbott Elementary"],
  "brooklyn nine-nine": ["The Office", "Parks and Recreation", "Psych", "Chuck"],
  community: ["The Good Place", "Brooklyn Nine-Nine", "Arrested Development", "30 Rock"],
  "the good place": ["Community", "The Good Place", "Upload", "Russian Doll"],
  "arrested development": ["It's Always Sunny in Philadelphia", "30 Rock", "Veep", "Community"],
  "always sunny": ["Arrested Development", "Curb Your Enthusiasm", "What We Do in the Shadows", "Trailer Park Boys"],
  "curb your enthusiasm": ["Seinfeld", "Veep", "The Rehearsal", "It's Always Sunny in Philadelphia"],
  seinfeld: ["Curb Your Enthusiasm", "The Office", "Frasier", "30 Rock"],
  friends: ["How I Met Your Mother", "New Girl", "The Big Bang Theory", "Happy Endings"],
  "how i met your mother": ["Friends", "New Girl", "Happy Endings", "The Big Bang Theory"],
  "new girl": ["Friends", "Happy Endings", "Brooklyn Nine-Nine", "Superstore"],
  "big bang": ["Friends", "How I Met Your Mother", "The IT Crowd", "Silicon Valley"],
  "silicon valley": ["The IT Crowd", "Halt and Catch Fire", "Superstore", "Mythic Quest"],
  "mad men": ["Succession", "The Crown", "Halt and Catch Fire", "The Americans"],
  "the americans": ["Slow Horses", "The Night Manager", "Homeland", "The Spy"],
  "slow horses": ["The Americans", "Tinker Tailor Soldier Spy", "The Night Manager", "Jack Ryan"],
  "mindhunter": ["True Detective", "Zodiac", "Manhunt", "The Night Of"],
  "fargo": ["No Country for Old Men", "Fargo", "Twin Peaks", "True Detective"],
  "twin peaks": ["The X-Files", "True Detective", "Dark", "The Leftovers"],
  "the leftovers": ["The OA", "Station Eleven", "Dark", "The Returned"],
  dark: ["The OA", "1899", "Stranger Things", "The Leftovers"],
  "mr robot": ["Fight Club", "Mr. Robot", "Devs", "Black Mirror"],
  "the walking dead": ["The Last of Us", "28 Days Later", "Train to Busan", "Fear the Walking Dead"],
  "yellowstone": ["1883", "Mayor of Kingstown", "Longmire", "Justified"],
  justified: ["Longmire", "Justified", "Raylan", "No Country for Old Men"],
  "ozark": ["Breaking Bad", "Ozark", "Bloodline", "Animal Kingdom"],
  "animal kingdom": ["Ozark", "Animal Kingdom", "Snowfall", "Mayans M.C."],
  "euphoria": ["Skins", "Thirteen", "The Idol", "We Are Who We Are"],
  skins: ["Euphoria", "Skins", "The End of the F***ing World", "My Mad Fat Diary"],
  "normal people": ["One Day", "Conversations with Friends", "Fleabag", "The Worst Person in the World"],
  fleabag: ["Catastrophe", "I May Destroy You", "The Worst Person in the World", "After Life"],
  "ted lasso": ["Shrinking", "The Good Place", "Abbott Elementary", "Friday Night Lights"],
  "friday night lights": ["Ted Lasso", "Coach Carter", "Remember the Titans", "All American"],
  "the white lotus": ["The Menu", "Triangle of Sadness", "The Resort", "Nine Perfect Strangers"],
  airplane: ["The Naked Gun", "Hot Shots!", "Scary Movie", "Police Academy"],
  "the naked gun": ["Airplane!", "Hot Shots!", "The Pink Panther", "Spy"],
  "dr strangelove": ["Network", "Wag the Dog", "The Death of Stalin", "Don't Look Up"],
  "don't look up": ["Dr. Strangelove", "Idiocracy", "Network", "Wag the Dog"],
  "blazing saddles": ["Airplane!", "The Naked Gun", "Spaceballs", "Robin Hood: Men in Tights"],
  spaceballs: ["Galaxy Quest", "Hot Shots!", "Austin Powers: International Man of Mystery", "The Naked Gun"],
  "austin powers": ["Spy", "Johnny English", "The Naked Gun", "Kingsman: The Secret Service"],
  "this is spinal tap": ["Best in Show", "Walk Hard: The Dewey Cox Story", "Popstar: Never Stop Never Stopping", "A Mighty Wind"],
};

export const ASK_PROMPTS = [
  "Feel-good 90s romcoms",
  "Shows like The Bear",
  "Satire or parody",
  "Eat the rich",
  "Enemies to lovers",
  "Time-loop movies",
  "Dark academia",
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
  if (/\b(funny|hilarious|comedy)\b/.test(lower) && !genres.includes("Comedy")) genres.push("Comedy");
  if (/\b(sad|tearjerker|cry)\b/.test(lower) && !genres.includes("Drama")) genres.push("Drama");
  if (/\b(scary|horror|creepy)\b/.test(lower) && !genres.includes("Horror")) genres.push("Horror");

  const moods: string[] = [];
  const romcom = /\b(romcom|rom-com|romcoms|romantic comedy|romantic comedies)\b/.test(lower);
  for (const mood of MOODS) {
    if (!anyKeyMatches(q, mood.keys) && !(romcom && mood.label === "rom-com")) continue;
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

  const tropesHit = TROPES.some((trope) => anyKeyMatches(q, trope.keys));
  const ask =
    Boolean(like || moods.length || tropesHit || yearFrom || (genres.length && q.split(/\s+/).length >= 3)) ||
    /\b(about|vibe|mood|recommend|something)\b/.test(lower) ||
    q.split(/\s+/).length >= 5;

  const chips: string[] = [];
  if (type === "series") chips.push("TV shows");
  if (type === "movie") chips.push("Movies");
  chips.push(...moods.slice(0, 4));
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

export async function nameSearch(query: string, addons: InstalledAddon[]): Promise<{
  intent: SearchIntent;
  items: RankedTitle[];
}> {
  const q = query.trim();
  const intent: SearchIntent = {
    raw: q,
    ask: false,
    genres: [],
    moods: [],
    terms: [q],
    chips: [],
  };
  const catalogs = catalogsWithSearch(addons)
    .sort((a, b) => Number(b.addonName === "Cinemeta") - Number(a.addonName === "Cinemeta"))
    .slice(0, 8);
  const urls = catalogs.map((catalog) =>
    resourceUrl(catalog.transportUrl, "catalog", catalog.type, catalog.id, { search: q }),
  );
  const results = urls.length ? await loadJsonMany(urls) : [];
  const seen = new Set<string>();
  const pool: MetaPreview[] = [];
  for (const result of results) {
    if (!result.ok) continue;
    const metas = ((result.data as { metas?: MetaPreview[] }).metas ?? []) as MetaPreview[];
    for (const item of metas) {
      if (!item?.id || !item.name) continue;
      const key = `${item.type}:${item.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pool.push(item);
    }
  }

  const needle = q.toLowerCase();
  const items = pool
    .map((item) => {
      const name = item.name.toLowerCase();
      let score = 0;
      const why: string[] = [];
      if (name === needle) {
        score += 140;
        why.push("Exact title");
      } else if (name.startsWith(needle)) {
        score += 90;
        why.push("Title starts with");
      } else if (name.includes(needle)) {
        score += 55;
        why.push("Title match");
      } else {
        const words = needle.split(/\s+/).filter((w) => w.length > 1);
        const hits = words.filter((w) => name.includes(w)).length;
        if (hits === 0) return { ...item, score: 0, why };
        score += hits === words.length ? 32 : hits * 8;
      }
      const rating = Number(item.imdbRating);
      if (!Number.isNaN(rating) && rating > 0) score += rating;
      return { ...item, score, why };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 48);

  return { intent, items };
}

export async function runSearch(
  query: string,
  addons: InstalledAddon[],
  mode: "smart" | "title",
) {
  if (mode === "title") return nameSearch(query, addons);
  return smartSearch(query, addons);
}

export async function smartSearch(query: string, addons: InstalledAddon[]): Promise<{
  intent: SearchIntent;
  items: RankedTitle[];
}> {
  const intent = parseIntent(query);
  const tropes = tropeTitles(intent);

  if (intent.ask || tropes.length) {
    const grok = await interpretAsk({ data: { query } });
    const wanted: AskTitle[] = uniqueWanted([
      ...tropes.slice(0, 12),
      ...(grok.ok ? grok.titles : []),
    ]);
    if (grok.ok) {
      if (grok.type) intent.type = grok.type;
      intent.chips = unique([...grok.chips, ...intent.chips]).slice(0, 8);
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

function uniqueWanted(rows: AskTitle[]): AskTitle[] {
  const seen = new Set<string>();
  const out: AskTitle[] = [];
  for (const row of rows) {
    const key = row.name.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out.slice(0, 16);
}

function tropeTitles(intent: SearchIntent): AskTitle[] {
  const groups: AskTitle[][] = [];
  for (const trope of TROPES) {
    if (!anyKeyMatches(intent.raw, trope.keys)) continue;
    intent.chips = unique([...trope.chips, ...intent.chips]);
    if (trope.kind) intent.type = intent.type ?? trope.kind;
    groups.push(
      trope.titles.map((name) => ({
        name,
        type: trope.kind ?? intent.type ?? "movie",
        why: trope.chips[0] ?? "match",
      })),
    );
  }
  const mixed: AskTitle[] = [];
  let i = 0;
  while (mixed.length < 24) {
    let added = false;
    for (const group of groups) {
      if (i < group.length) {
        mixed.push(group[i]);
        added = true;
      }
    }
    if (!added) break;
    i += 1;
  }
  return uniqueWanted(mixed);
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
