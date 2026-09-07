import { LOCAL_OPEN_ADDON } from "./local-open";
import type { InstalledAddon, Manifest } from "./types";
import {
  CINEMETA_URL,
  OPENSUBTITLES_URL,
  STREAMING_CATALOGS_URL,
  WATCHHUB_URL,
} from "./urls";

const CINEMETA_MANIFEST: Manifest = {
  id: "com.linvo.cinemeta",
  version: "3.0.14",
  description: "The official addon for movie and series catalogs",
  name: "Cinemeta",
  resources: ["catalog", "meta", "addon_catalog"],
  types: ["movie", "series"],
  idPrefixes: ["tt"],
  addonCatalogs: [
    { type: "all", id: "official", name: "Official" },
    { type: "all", id: "community", name: "Community" },
  ],
  catalogs: [
    {
      type: "movie",
      id: "top",
      name: "Popular",
      extra: [
        {
          name: "genre",
          options: [
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
          ],
        },
        { name: "search" },
        { name: "skip" },
      ],
    },
    {
      type: "series",
      id: "top",
      name: "Popular",
      extra: [
        {
          name: "genre",
          options: [
            "Action",
            "Adventure",
            "Animation",
            "Comedy",
            "Crime",
            "Documentary",
            "Drama",
            "Fantasy",
            "Horror",
            "Mystery",
            "Romance",
            "Sci-Fi",
            "Thriller",
          ],
        },
        { name: "search" },
        { name: "skip" },
      ],
    },
  ],
};

const OPENSUBTITLES_MANIFEST: Manifest = {
  id: "org.stremio.opensubtitlesv3",
  version: "1.0.0",
  name: "OpenSubtitles v3",
  description: "OpenSubtitles.org unofficial add-on",
  resources: ["subtitles"],
  types: ["movie", "series"],
  catalogs: [],
  idPrefixes: ["tt"],
};

const WATCHHUB_MANIFEST: Manifest = {
  id: "org.stremio.watchhub",
  version: "1.0.0",
  name: "WatchHub",
  description: "Find where a title is available to watch.",
  resources: ["stream"],
  types: ["movie", "series"],
  catalogs: [],
  idPrefixes: ["tt"],
};

export const STREAMING_CATALOGS_MANIFEST: Manifest = {
  id: "pw.ers.netflix-catalog",
  version: "0.1.0",
  name: "Streaming Catalogs",
  description: "Trending movies and series on Netflix, Max, Disney+, Prime Video, Apple TV+ and more.",
  resources: ["catalog"],
  types: ["movie", "series"],
  idPrefixes: ["tt"],
  catalogs: [
    { type: "movie", id: "nfx", name: "Netflix" },
    { type: "series", id: "nfx", name: "Netflix" },
    { type: "movie", id: "hbm", name: "Max" },
    { type: "series", id: "hbm", name: "Max" },
    { type: "movie", id: "dnp", name: "Disney+" },
    { type: "series", id: "dnp", name: "Disney+" },
    { type: "movie", id: "amp", name: "Prime Video" },
    { type: "series", id: "amp", name: "Prime Video" },
    { type: "movie", id: "atp", name: "Apple TV+" },
    { type: "series", id: "atp", name: "Apple TV+" },
    { type: "movie", id: "pmp", name: "Paramount+" },
    { type: "series", id: "pmp", name: "Paramount+" },
    { type: "movie", id: "hlu", name: "Hulu" },
    { type: "series", id: "hlu", name: "Hulu" },
    { type: "movie", id: "pcp", name: "Peacock" },
    { type: "series", id: "pcp", name: "Peacock" },
    { type: "movie", id: "cru", name: "Crunchyroll" },
    { type: "series", id: "cru", name: "Crunchyroll" },
    { type: "movie", id: "stz", name: "Starz" },
    { type: "series", id: "stz", name: "Starz" },
  ],
};

function seed(transportUrl: string, manifest: Manifest): InstalledAddon {
  return { transportUrl, manifest, enabled: true, installedAt: 0 };
}

export const DEFAULT_ADDONS: InstalledAddon[] = [
  seed(CINEMETA_URL, CINEMETA_MANIFEST),
  LOCAL_OPEN_ADDON,
  seed(STREAMING_CATALOGS_URL, STREAMING_CATALOGS_MANIFEST),
  seed(OPENSUBTITLES_URL, OPENSUBTITLES_MANIFEST),
  seed(WATCHHUB_URL, WATCHHUB_MANIFEST),
];

export const HOME_ROWS = [
  {
    key: "movies-popular",
    title: "Popular movies",
    transportUrl: CINEMETA_URL,
    type: "movie",
    id: "top",
  },
  {
    key: "series-popular",
    title: "Popular series",
    transportUrl: CINEMETA_URL,
    type: "series",
    id: "top",
  },
  {
    key: "movies-action",
    title: "Action",
    transportUrl: CINEMETA_URL,
    type: "movie",
    id: "top",
    extra: { genre: "Action" },
  },
  {
    key: "movies-comedy",
    title: "Comedy",
    transportUrl: CINEMETA_URL,
    type: "movie",
    id: "top",
    extra: { genre: "Comedy" },
  },
  {
    key: "movies-scifi",
    title: "Sci-Fi",
    transportUrl: CINEMETA_URL,
    type: "movie",
    id: "top",
    extra: { genre: "Sci-Fi" },
  },
  {
    key: "series-drama",
    title: "Drama series",
    transportUrl: CINEMETA_URL,
    type: "series",
    id: "top",
    extra: { genre: "Drama" },
  },
  {
    key: "open-movies",
    title: "Playable now · Open Collection",
    transportUrl: "local://nox-open/manifest.json",
    type: "movie",
    id: "open",
  },
] as const;
