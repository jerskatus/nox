import { type AddonFetchResult, type Json, fetchAddonJson, fetchAddonJsonMany, fetchAddonText } from "./api";
import { handleLocalOpen } from "./local-open";
import { rankStreamsByQuality, streamFlags } from "./stream-rank";
import type {
  AddonCatalogResponse,
  AddonDescriptor,
  CatalogResponse,
  InstalledAddon,
  Manifest,
  Meta,
  MetaPreview,
  Stream,
  Subtitle,
} from "./types";
import { addonHasResource, CINEMETA_URL, CINEMETA_YEAR_URL, resourceUrl } from "./urls";

export async function loadJson(url: string): Promise<unknown> {
  if (url.startsWith("local://nox-open/")) return handleLocalOpen(url);
  return fetchAddonJson({ data: { url } });
}

export async function loadJsonMany(urls: string[]): Promise<AddonFetchResult[]> {
  const local = urls.filter((u) => u.startsWith("local://nox-open/"));
  const remote = urls.filter((u) => !u.startsWith("local://nox-open/"));
  const localResults: AddonFetchResult[] = local.map((url) => {
    try {
      return { url, ok: true, data: handleLocalOpen(url) as Json };
    } catch (error) {
      return {
        url,
        ok: false,
        error: error instanceof Error ? error.message : "Failed",
      };
    }
  });
  const remoteResults = remote.length > 0 ? await fetchAddonJsonMany({ data: { urls: remote } }) : [];
  return [...localResults, ...remoteResults];
}

export async function fetchManifest(transportUrl: string): Promise<Manifest> {
  const data = (await loadJson(transportUrl)) as Manifest;
  if (!data?.id || !data?.name) throw new Error("Not a valid Stremio addon manifest");
  return {
    ...data,
    types: data.types ?? [],
    resources: data.resources ?? [],
    catalogs: data.catalogs ?? [],
  };
}

export async function fetchCatalog(
  transportUrl: string,
  type: string,
  id: string,
  extra?: Record<string, string | number | undefined>,
): Promise<MetaPreview[]> {
  const url = resourceUrl(transportUrl, "catalog", type, id, extra);
  const data = (await loadJson(url)) as CatalogResponse;
  return Array.isArray(data?.metas) ? data.metas : [];
}

export const CATALOG_PAGE_SIZE = 50;
const CATALOG_BATCH = 32;

async function loadCatalogUrls(urls: string[]): Promise<MetaPreview[]> {
  const seen = new Set<string>();
  const items: MetaPreview[] = [];
  for (let i = 0; i < urls.length; i += CATALOG_BATCH) {
    const results = await loadJsonMany(urls.slice(i, i + CATALOG_BATCH));
    for (const result of results) {
      if (!result.ok) continue;
      const metas = (result.data as CatalogResponse | null)?.metas;
      if (!Array.isArray(metas)) continue;
      for (const meta of metas) {
        const key = `${meta.type}:${meta.id}`;
        if (!meta?.id || seen.has(key)) continue;
        seen.add(key);
        items.push(meta);
      }
    }
  }
  return items;
}

export async function fetchCatalogPages(
  transportUrl: string,
  type: string,
  id: string,
  extra: Record<string, string | number | undefined> | undefined,
  pageCount: number,
): Promise<MetaPreview[]> {
  const pages = Math.max(1, pageCount);
  const urls = Array.from({ length: pages }, (_, i) => {
    const skip = i * CATALOG_PAGE_SIZE;
    return resourceUrl(transportUrl, "catalog", type, id, {
      ...extra,
      skip: skip || undefined,
    });
  });
  return loadCatalogUrls(urls);
}

/** Cinemeta's `year` catalog takes the year as the required `genre` extra. */
export async function fetchCinemetaYearPages(
  type: string,
  years: number[],
  pagesPerYear: number,
): Promise<MetaPreview[]> {
  const pages = Math.max(1, pagesPerYear);
  const urlsFor = (transport: string) => {
    const urls: string[] = [];
    for (const year of years) {
      for (let i = 0; i < pages; i++) {
        urls.push(
          resourceUrl(transport, "catalog", type, "year", {
            genre: String(year),
            skip: i * CATALOG_PAGE_SIZE || undefined,
          }),
        );
      }
    }
    return urls;
  };
  const items = await loadCatalogUrls(urlsFor(CINEMETA_YEAR_URL));
  if (items.length > 0) return items;
  return loadCatalogUrls(urlsFor(CINEMETA_URL));
}

export async function fetchMeta(
  addons: InstalledAddon[],
  type: string,
  id: string,
): Promise<Meta | null> {
  const candidates = addons.filter(
    (addon) => addon.enabled && addonHasResource(addon.manifest, "meta", type, id),
  );
  if (candidates.length === 0) return null;
  const urls = candidates.map((addon) => resourceUrl(addon.transportUrl, "meta", type, id));
  const results = await loadJsonMany(urls);
  for (const result of results) {
    if (!result.ok) continue;
    const meta = (result.data as { meta?: Meta } | null)?.meta;
    if (meta?.id && meta?.name) return meta;
  }
  return null;
}

export async function fetchStreams(
  addons: InstalledAddon[],
  type: string,
  id: string,
): Promise<Stream[]> {
  const candidates = addons.filter(
    (addon) => addon.enabled && addonHasResource(addon.manifest, "stream", type, id),
  );
  if (candidates.length === 0) return [];
  const urls = candidates.map((addon) => resourceUrl(addon.transportUrl, "stream", type, id));
  const results = await loadJsonMany(urls);
  const streams: Stream[] = [];
  for (const result of results) {
    if (!result.ok) continue;
    const addon = candidates.find((item) => {
      const base = item.transportUrl.replace(/\/manifest\.json$/i, "");
      return result.url.startsWith(base);
    });
    const list = (result.data as { streams?: Stream[] } | null)?.streams;
    if (!Array.isArray(list)) continue;
    for (const stream of list) {
      streams.push({
        ...stream,
        addonName: addon?.manifest.name,
        addonId: addon?.manifest.id,
        transportUrl: addon?.transportUrl,
      });
    }
  }
  return streams;
}

export async function fetchSubtitles(
  addons: InstalledAddon[],
  type: string,
  id: string,
): Promise<Subtitle[]> {
  const candidates = addons.filter(
    (addon) => addon.enabled && addonHasResource(addon.manifest, "subtitles", type, id),
  );
  if (candidates.length === 0) return [];
  const urls = candidates.map((addon) => resourceUrl(addon.transportUrl, "subtitles", type, id));
  const results = await loadJsonMany(urls);
  const out: Subtitle[] = [];
  const seen = new Set<string>();
  for (const result of results) {
    if (!result.ok) continue;
    const list = (result.data as { subtitles?: Subtitle[] } | null)?.subtitles;
    if (!Array.isArray(list)) continue;
    for (const sub of list) {
      if (!sub?.url || seen.has(sub.url)) continue;
      seen.add(sub.url);
      out.push({
        ...sub,
        id: sub.id ?? sub.url,
        lang: sub.lang ?? sub.language,
      });
    }
  }
  return out;
}

export async function loadSubtitleFile(url: string): Promise<string> {
  if (url.startsWith("data:")) {
    const comma = url.indexOf(",");
    return comma >= 0 ? decodeURIComponent(url.slice(comma + 1)) : "";
  }
  return fetchAddonText({ data: { url } });
}

export function mergeSubtitles(fromAddons: Subtitle[], fromStream?: Subtitle[]) {
  const out: Subtitle[] = [];
  const seen = new Set<string>();
  for (const sub of [...(fromStream ?? []), ...fromAddons]) {
    if (!sub?.url || seen.has(sub.url)) continue;
    seen.add(sub.url);
    out.push(sub);
  }
  return out;
}

export async function fetchAddonCatalog(
  transportUrl: string,
  type: string,
  id: string,
): Promise<AddonDescriptor[]> {
  const url = resourceUrl(transportUrl, "addon_catalog", type, id);
  const data = (await loadJson(url)) as AddonCatalogResponse;
  return Array.isArray(data?.addons) ? data.addons : [];
}

export function isWebPlayable(stream: Stream) {
  if (stream.ytId) return true;
  if (stream.url) {
    if (stream.behaviorHints?.notWebReady) return false;
    const url = stream.url.toLowerCase();
    if (url.startsWith("http://") || url.startsWith("https://")) return true;
  }
  return false;
}

export function streamKind(
  stream: Stream,
): "http" | "hls" | "youtube" | "torrent" | "external" | "other" {
  if (stream.ytId) return "youtube";
  if (stream.externalUrl) return "external";
  if (stream.infoHash) return "torrent";
  if (stream.url) {
    if (stream.url.toLowerCase().includes(".m3u8")) return "hls";
    return "http";
  }
  return "other";
}

export function rankStreams(streams: Stream[], opts?: { desktop?: boolean }) {
  return rankStreamsByQuality(streams, opts);
}

export function magnetFromStream(stream: Stream) {
  if (!stream.infoHash) return null;
  const trackers = (stream.sources ?? [])
    .filter((s) => s.startsWith("tracker:"))
    .map((s) => "&tr=" + encodeURIComponent(s.slice("tracker:".length)))
    .join("");
  return `magnet:?xt=urn:btih:${stream.infoHash}${trackers}`;
}

export function videoTitle(video: {
  title?: string;
  name?: string;
  season?: number;
  episode?: number;
}) {
  if (video.title) return video.title;
  if (video.name) return video.name;
  if (video.season && video.episode) return `S${video.season} E${video.episode}`;
  return "Episode";
}

export function defaultVideoId(meta: Meta) {
  if (meta.type === "movie") return meta.id;
  if (meta.behaviorHints?.defaultVideoId) return meta.behaviorHints.defaultVideoId;
  const videos = [...(meta.videos ?? [])].sort((a, b) => {
    const sa = a.season ?? 0;
    const sb = b.season ?? 0;
    if (sa !== sb) {
      if (sa === 0) return 1;
      if (sb === 0) return -1;
      return sa - sb;
    }
    return (a.episode ?? a.number ?? 0) - (b.episode ?? b.number ?? 0);
  });
  return videos[0]?.id ?? meta.id;
}

export function nextVideoId(meta: Meta, currentId: string) {
  const videos = [...(meta.videos ?? [])].sort((a, b) => {
    const sa = a.season ?? 0;
    const sb = b.season ?? 0;
    if (sa !== sb) return sa - sb;
    return (a.episode ?? a.number ?? 0) - (b.episode ?? b.number ?? 0);
  });
  const index = videos.findIndex((v) => v.id === currentId);
  if (index >= 0 && index < videos.length - 1) return videos[index + 1]!.id;
  return null;
}

export type StreamPref = {
  bingeGroup?: string;
  addonId?: string;
  addonName?: string;
  quality?: string;
  streamKey?: string;
};

export function pickRememberedStream(
  streams: Stream[],
  pref?: StreamPref | null,
  opts?: { desktop?: boolean },
) {
  const playable = streams.filter((stream) => {
    if (!isWebPlayable(stream)) return false;
    const kind = streamKind(stream);
    return kind === "http" || kind === "hls" || kind === "youtube";
  });
  if (playable.length === 0) return null;
  const safe = opts?.desktop ? playable : playable.filter((stream) => !streamFlags(stream).cinemaAudio);
  const withEnglish = (list: Stream[]) => list.filter((stream) => streamFlags(stream).spoken !== "foreign");
  const pool = withEnglish(safe.length > 0 ? safe : playable);
  const fallback = safe.length > 0 ? safe : playable;
  const search = pool.length > 0 ? pool : fallback;
  if (pref?.streamKey) {
    const exact = search.find((stream) => streamKeyOf(stream) === pref.streamKey);
    if (exact) return exact;
  }
  if (pref?.bingeGroup) {
    const binge = search.find((stream) => stream.behaviorHints?.bingeGroup === pref.bingeGroup);
    if (binge) return binge;
  }
  if (pref?.addonId && pref.quality) {
    const both = search.find(
      (stream) => stream.addonId === pref.addonId && qualityToken(stream) === pref.quality,
    );
    if (both) return both;
  }
  if (pref?.addonId) {
    const addon = search.find((stream) => stream.addonId === pref.addonId);
    if (addon) return addon;
  }
  if (pref?.addonName) {
    const addon = search.find((stream) => stream.addonName === pref.addonName);
    if (addon) return addon;
  }
  return null;
}

export function firstPlayableStream(streams: Stream[], opts?: { desktop?: boolean }) {
  const playable = streams.filter((stream) => {
    if (!isWebPlayable(stream)) return false;
    const kind = streamKind(stream);
    return kind === "http" || kind === "hls" || kind === "youtube";
  });
  const english = playable.filter((stream) => streamFlags(stream).spoken !== "foreign");
  const pool = english.length > 0 ? english : playable;
  if (!opts?.desktop) {
    const safe = pool.filter((stream) => !streamFlags(stream).cinemaAudio);
    if (safe.length > 0) return safe[0] ?? null;
  }
  return pool[0] ?? null;
}

function streamKeyOf(stream: Stream) {
  return stream.url || stream.ytId || stream.infoHash || stream.externalUrl || stream.name || "stream";
}

function qualityToken(stream: Stream) {
  const text = `${stream.name ?? ""} ${stream.title ?? ""} ${stream.description ?? ""} ${stream.behaviorHints?.filename ?? ""}`;
  const match = text.match(/\b(8k|4k|2160p|1080p|720p|576p|480p|360p|240p)\b/i);
  if (!match) return undefined;
  const value = match[1]!.toUpperCase();
  if (value === "4K" || value === "2160P") return "4K";
  if (value === "8K") return "8K";
  return value.toLowerCase();
}

export function srtToVtt(input: string) {
  const body = input
    .replace(/\r+/g, "")
    .replace(/^\uFEFF/, "")
    .replace(/(\d+:\d+:\d+),(\d+)/g, "$1.$2");
  if (body.trimStart().startsWith("WEBVTT")) return body;
  return "WEBVTT\n\n" + body;
}

export function subtitleLang(sub: Subtitle) {
  return (sub.lang ?? sub.language ?? "und").toString();
}
