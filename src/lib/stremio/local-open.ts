import type { Manifest, Meta, Stream, Subtitle } from "./types";

const BUCKET = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample";
const SINTEL_EN = "https://durian.blender.org/wp-content/content/subtitles/sintel_en.srt";
const SINTEL_ES = "https://durian.blender.org/wp-content/content/subtitles/sintel_es.srt";
const SINTEL_NL = "https://durian.blender.org/wp-content/content/subtitles/sintel_nl.srt";

type OpenTitle = {
  id: string;
  type: "movie" | "series";
  name: string;
  year: string;
  runtime: string;
  genres: string[];
  description: string;
  poster: string;
  background: string;
  streamUrl?: string;
  previewUrl?: string;
  imdbRating: string;
  trailer?: string;
};

const MOVIES: OpenTitle[] = [
  {
    id: "nox:bbb",
    type: "movie",
    name: "Big Buck Bunny",
    year: "2008",
    runtime: "10 min",
    genres: ["Animation", "Comedy", "Short"],
    description:
      "A giant rabbit with a heart bigger than himself rises up against a bullying trio of rodents in this open-source short from the Blender Institute.",
    poster: `${BUCKET}/images/BigBuckBunny.jpg`,
    background: `${BUCKET}/images/BigBuckBunny.jpg`,
    streamUrl: `${BUCKET}/BigBuckBunny.mp4`,
    imdbRating: "6.8",
    trailer: "YE7VzlLtp-4",
  },
  {
    id: "nox:ed",
    type: "movie",
    name: "Elephants Dream",
    year: "2006",
    runtime: "11 min",
    genres: ["Animation", "Fantasy", "Short"],
    description:
      "Two strange characters wander a mechanical world in the first open movie made with Blender — a surreal trip through Proog and Emo's fractured reality.",
    poster: `${BUCKET}/images/ElephantsDream.jpg`,
    background: `${BUCKET}/images/ElephantsDream.jpg`,
    streamUrl: `${BUCKET}/ElephantsDream.mp4`,
    imdbRating: "6.5",
    trailer: "9hadPkDuTrE",
  },
  {
    id: "nox:sintel",
    type: "movie",
    name: "Sintel",
    year: "2010",
    runtime: "15 min",
    genres: ["Animation", "Adventure", "Fantasy"],
    description:
      "A lonely young woman, Sintel, searches for a baby dragon she raised, in a beautifully crafted short that became a landmark of independent CGI.",
    poster: `${BUCKET}/images/Sintel.jpg`,
    background: `${BUCKET}/images/Sintel.jpg`,
    streamUrl: `${BUCKET}/Sintel.mp4`,
    previewUrl: "https://mdn.github.io/shared-assets/videos/sintel-short.webm",
    imdbRating: "7.5",
    trailer: "eRsGyueVLvQ",
  },
  {
    id: "nox:tos",
    type: "movie",
    name: "Tears of Steel",
    year: "2012",
    runtime: "12 min",
    genres: ["Animation", "Sci-Fi", "Short"],
    description:
      "Live-action and CGI collide as a group of warriors and scientists defend Amsterdam from an army of robots they accidentally created.",
    poster: `${BUCKET}/images/TearsOfSteel.jpg`,
    background: `${BUCKET}/images/TearsOfSteel.jpg`,
    streamUrl: `${BUCKET}/TearsOfSteel.mp4`,
    imdbRating: "7.1",
    trailer: "R6MlUcmOul8",
  },
  {
    id: "nox:blazes",
    type: "movie",
    name: "Garden",
    year: "2015",
    runtime: "30 sec",
    genres: ["Short", "Nature"],
    description: "A quiet CC0 garden clip — included so playback always works in the browser.",
    poster: `${BUCKET}/images/ForBiggerBlazes.jpg`,
    background: `${BUCKET}/images/ForBiggerBlazes.jpg`,
    streamUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm",
    imdbRating: "7.0",
  },
  {
    id: "nox:joyrides",
    type: "movie",
    name: "For Bigger Joyrides",
    year: "2015",
    runtime: "15 sec",
    genres: ["Short"],
    description: "Another Chromecast sample, included so the Open Collection always has something to play.",
    poster: `${BUCKET}/images/ForBiggerJoyrides.jpg`,
    background: `${BUCKET}/images/ForBiggerJoyrides.jpg`,
    streamUrl: "https://media.w3.org/2010/05/video/movie_300.webm",
    imdbRating: "7.0",
  },
];

const SERIES_ID = "nox:festival";

const FESTIVAL_EPISODES = [
  { id: "nox:festival:1:1", season: 1, episode: 1, movieId: "nox:bbb" },
  { id: "nox:festival:1:2", season: 1, episode: 2, movieId: "nox:ed" },
  { id: "nox:festival:1:3", season: 1, episode: 3, movieId: "nox:sintel" },
  { id: "nox:festival:1:4", season: 1, episode: 4, movieId: "nox:tos" },
];

export const LOCAL_OPEN_MANIFEST: Manifest = {
  id: "com.nox.open",
  name: "Nox Open Collection",
  version: "1.1.0",
  description: "Free, instantly playable open movies. Always works in the browser.",
  types: ["movie", "series"],
  idPrefixes: ["nox:"],
  resources: ["catalog", "meta", "stream", "subtitles"],
  catalogs: [
    {
      type: "movie",
      id: "open",
      name: "Open Collection",
      extra: [{ name: "search" }],
    },
    {
      type: "series",
      id: "festival",
      name: "Open Film Festival",
    },
  ],
};

function movieMeta(movie: OpenTitle): Meta {
  return {
    id: movie.id,
    type: movie.type,
    name: movie.name,
    poster: movie.poster,
    background: movie.background,
    description: movie.description,
    releaseInfo: movie.year,
    year: movie.year,
    runtime: movie.runtime,
    genres: movie.genres,
    imdbRating: movie.imdbRating,
    posterShape: "landscape",
    trailers: movie.trailer ? [{ source: movie.trailer, type: "Trailer" }] : undefined,
    trailerStreams: movie.trailer ? [{ ytId: movie.trailer, title: `${movie.name} Trailer` }] : undefined,
  };
}

function festivalMeta(): Meta {
  return {
    id: SERIES_ID,
    type: "series",
    name: "Open Film Festival",
    poster: MOVIES[2]!.poster,
    background: MOVIES[2]!.background,
    description:
      "A four-film showcase of Blender open movies — Big Buck Bunny, Elephants Dream, Sintel, and Tears of Steel.",
    releaseInfo: "2006–2012",
    year: "2012",
    genres: ["Animation", "Anthology"],
    imdbRating: "7.2",
    runtime: "12 min",
    posterShape: "landscape",
    trailers: [{ source: "eRsGyueVLvQ", type: "Trailer" }],
    trailerStreams: [{ ytId: "eRsGyueVLvQ", title: "Sintel Trailer" }],
    videos: FESTIVAL_EPISODES.map((ep) => {
      const movie = MOVIES.find((m) => m.id === ep.movieId)!;
      return {
        id: ep.id,
        title: movie.name,
        name: movie.name,
        season: ep.season,
        episode: ep.episode,
        thumbnail: movie.poster,
        overview: movie.description,
        released: `${movie.year}-01-01T00:00:00.000Z`,
      };
    }),
  };
}

function httpStream(title: string, url: string, quality: string, extras?: Partial<Stream>): Stream {
  const { behaviorHints, ...rest } = extras ?? {};
  return {
    name: `Nox Open · ${quality}`,
    title,
    description: `Direct HTTP · ${quality} · plays in the browser`,
    url,
    addonName: "Nox Open Collection",
    addonId: "com.nox.open",
    behaviorHints: { bingeGroup: `nox-open-${quality}`, ...behaviorHints },
    ...rest,
  };
}

function sintelSubtitles(): Subtitle[] {
  return [
    { id: "sintel-en", url: SINTEL_EN, lang: "eng" },
    { id: "sintel-es", url: SINTEL_ES, lang: "spa" },
    { id: "sintel-nl", url: SINTEL_NL, lang: "dut" },
  ];
}

function streamsFor(movie: OpenTitle): Stream[] {
  const streams: Stream[] = [];
  if (movie.streamUrl) {
    const full = httpStream(`${movie.name} · ${movie.runtime}`, movie.streamUrl, "1080p");
    if (movie.id === "nox:sintel") full.subtitles = sintelSubtitles();
    streams.push(full);
  }
  if (movie.previewUrl) {
    streams.push(
      httpStream(`${movie.name} · Preview clip`, movie.previewUrl, "480p", {
        description: "Short preview · WebM · plays in the browser",
      }),
    );
  }
  return streams;
}

function subtitlesFor(id: string): Subtitle[] {
  if (id === "nox:sintel" || id === "nox:festival:1:3") return sintelSubtitles();
  return [];
}

function parseLocalPath(url: string) {
  const path = url.replace(/^local:\/\/nox-open/, "");
  return path;
}

export function handleLocalOpen(url: string): unknown {
  const path = parseLocalPath(url);
  if (path === "/manifest.json" || path === "manifest.json") return LOCAL_OPEN_MANIFEST;

  const catalogMatch = path.match(/^\/catalog\/([^/]+)\/([^/]+?)(?:\/(.*))?\.json$/);
  if (catalogMatch) {
    const type = decodeURIComponent(catalogMatch[1]!);
    const id = decodeURIComponent(catalogMatch[2]!);
    const extraRaw = catalogMatch[3] ? decodeURIComponent(catalogMatch[3]) : "";
    const extra = new URLSearchParams(extraRaw);
    const q = (extra.get("search") ?? "").toLowerCase().trim();
    if (type === "movie" && id === "open") {
      const metas = MOVIES.map(movieMeta).filter(
        (m) => !q || m.name.toLowerCase().includes(q) || m.description?.toLowerCase().includes(q),
      );
      return { metas };
    }
    if (type === "series" && id === "festival") {
      return { metas: q && !festivalMeta().name.toLowerCase().includes(q) ? [] : [festivalMeta()] };
    }
    return { metas: [] };
  }

  const metaMatch = path.match(/^\/meta\/([^/]+)\/(.+)\.json$/);
  if (metaMatch) {
    const id = decodeURIComponent(metaMatch[2]!);
    if (id === SERIES_ID) return { meta: festivalMeta() };
    const movie = MOVIES.find((m) => m.id === id);
    if (movie) return { meta: movieMeta(movie) };
    return { meta: null };
  }

  const streamMatch = path.match(/^\/stream\/([^/]+)\/(.+)\.json$/);
  if (streamMatch) {
    const id = decodeURIComponent(streamMatch[2]!);
    const festival = FESTIVAL_EPISODES.find((e) => e.id === id);
    if (festival) {
      const movie = MOVIES.find((m) => m.id === festival.movieId)!;
      return { streams: streamsFor(movie) };
    }
    const movie = MOVIES.find((m) => m.id === id);
    if (movie) return { streams: streamsFor(movie) };
    return { streams: [] };
  }

  const subMatch = path.match(/^\/subtitles\/([^/]+)\/(.+)\.json$/);
  if (subMatch) {
    const id = decodeURIComponent(subMatch[2]!);
    return { subtitles: subtitlesFor(id) };
  }

  return { metas: [] };
}

export const LOCAL_OPEN_ADDON = {
  transportUrl: "local://nox-open/manifest.json",
  manifest: LOCAL_OPEN_MANIFEST,
  enabled: true,
  installedAt: 0,
};
