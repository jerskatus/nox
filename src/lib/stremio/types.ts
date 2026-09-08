export type ContentType =
  | "movie"
  | "series"
  | "channel"
  | "tv"
  | "anime"
  | "Podcasts"
  | "other"
  | string;

export type ManifestResource =
  | string
  | {
      name: string;
      types?: string[];
      idPrefixes?: string[];
    };

export type CatalogExtra = {
  name: string;
  isRequired?: boolean;
  options?: string[];
  optionsLimit?: number;
};

export type ManifestCatalog = {
  type: string;
  id: string;
  name?: string;
  extra?: CatalogExtra[];
  extraSupported?: string[];
  extraRequired?: string[];
  genres?: string[];
};

export type ManifestAddonCatalog = {
  type: string;
  id: string;
  name?: string;
};

export type AddonBehaviorHints = {
  adult?: boolean;
  p2p?: boolean;
  configurable?: boolean;
  configurationRequired?: boolean;
};

export type Manifest = {
  id: string;
  name: string;
  version?: string;
  description?: string;
  logo?: string;
  background?: string;
  contactEmail?: string;
  types: string[];
  resources: ManifestResource[];
  catalogs: ManifestCatalog[];
  addonCatalogs?: ManifestAddonCatalog[];
  idPrefixes?: string[];
  behaviorHints?: AddonBehaviorHints;
};

export type Trailer = {
  source?: string;
  type?: string;
  ytId?: string;
};

export type StreamBehaviorHints = {
  notWebReady?: boolean;
  bingeGroup?: string;
  countryWhitelist?: string[];
  proxyHeaders?: {
    request?: Record<string, string>;
    response?: Record<string, string>;
  };
  videoHash?: string;
  videoSize?: number;
  filename?: string;
};

export type Subtitle = {
  id?: string;
  url: string;
  lang?: string;
  language?: string;
  encoding?: string;
};

export type Stream = {
  name?: string;
  title?: string;
  description?: string;
  url?: string;
  ytId?: string;
  infoHash?: string;
  fileIdx?: number;
  sources?: string[];
  externalUrl?: string;
  subtitles?: Subtitle[];
  behaviorHints?: StreamBehaviorHints;
  addonName?: string;
  addonId?: string;
  transportUrl?: string;
};

export type Video = {
  id: string;
  title?: string;
  name?: string;
  released?: string;
  season?: number;
  episode?: number;
  number?: number;
  thumbnail?: string;
  overview?: string;
  description?: string;
  streams?: Stream[];
};

export type Meta = {
  id: string;
  type: ContentType;
  name: string;
  poster?: string;
  background?: string;
  logo?: string;
  description?: string;
  releaseInfo?: string;
  year?: string | number;
  imdbRating?: string | number;
  runtime?: string;
  genres?: string[];
  genre?: string[];
  director?: string[] | string;
  writer?: string[] | string;
  cast?: string[] | string;
  country?: string[] | string;
  awards?: string;
  imdb_id?: string;
  videos?: Video[];
  trailers?: Trailer[];
  trailerStreams?: Stream[];
  posterShape?: "poster" | "landscape" | "square" | string;
  behaviorHints?: { defaultVideoId?: string; hasScheduledVideos?: boolean };
};

export type MetaPreview = Pick<
  Meta,
  | "id"
  | "type"
  | "name"
  | "poster"
  | "background"
  | "logo"
  | "description"
  | "releaseInfo"
  | "year"
  | "imdbRating"
  | "genres"
  | "genre"
  | "posterShape"
  | "runtime"
>;

export type CatalogResponse = { metas: MetaPreview[] };
export type MetaResponse = { meta: Meta };
export type StreamResponse = { streams: Stream[] };
export type SubtitleResponse = { subtitles: Subtitle[] };

export type AddonDescriptor = {
  transportUrl: string;
  transportName?: string;
  manifest: Manifest;
};

export type AddonCatalogResponse = { addons: AddonDescriptor[] };

export type InstalledAddon = {
  transportUrl: string;
  manifest: Manifest;
  enabled: boolean;
  installedAt: number;
};

export type CatalogRef = {
  transportUrl: string;
  addonName: string;
  addonId: string;
  type: string;
  id: string;
  name: string;
  extra?: CatalogExtra[];
};
