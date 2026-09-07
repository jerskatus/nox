import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type YtVideo = {
  id: string;
  title: string;
  channel: string;
  duration?: string;
  views?: string;
  published?: string;
  live?: boolean;
};

export const YT_TABS = [
  { id: "recommended", label: "Recommended", query: "" },
  { id: "trending", label: "Trending", query: "official trailer" },
  { id: "music", label: "Music", query: "official music video" },
  { id: "gaming", label: "Gaming", query: "gaming highlights" },
  { id: "news", label: "News", query: "world news today" },
  { id: "sports", label: "Sports", query: "sports highlights" },
  { id: "movies", label: "Movies", query: "official trailer" },
  { id: "live", label: "Live", query: "live stream" },
  { id: "tech", label: "Tech", query: "tech review" },
] as const;

export type YtTabId = (typeof YT_TABS)[number]["id"];

export function isYtTab(value: string | undefined): value is YtTabId {
  return Boolean(value && YT_TABS.some((tab) => tab.id === value));
}

export function ytThumb(id: string, size: "wide" | "hq" = "wide") {
  return size === "hq"
    ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
    : `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
}

export function ytEmbed(id: string, autoplay = true) {
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
    autoplay: autoplay ? "1" : "0",
  });
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?${params.toString()}`;
}

const ID_RE = /^[a-zA-Z0-9_-]{11}$/;
const cache = new Map<string, { at: number; videos: YtVideo[] }>();
const TTL_MS = 8 * 60_000;

function runsText(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const rec = value as { simpleText?: string; runs?: Array<{ text?: string }> };
  if (rec.simpleText) return rec.simpleText;
  return (rec.runs ?? []).map((run) => run.text ?? "").join("");
}

function walkVideos(node: unknown, out: YtVideo[]) {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const child of node) walkVideos(child, out);
    return;
  }
  if (typeof node !== "object") return;
  const rec = node as Record<string, unknown>;
  const renderer =
    (rec.videoRenderer as Record<string, unknown> | undefined) ??
    (rec.gridVideoRenderer as Record<string, unknown> | undefined) ??
    (rec.compactVideoRenderer as Record<string, unknown> | undefined) ??
    (rec.playlistVideoRenderer as Record<string, unknown> | undefined);
  if (renderer && typeof renderer.videoId === "string" && ID_RE.test(renderer.videoId)) {
    const badges = JSON.stringify(renderer.badges ?? renderer.thumbnailOverlays ?? "");
    const live = /LIVE|liveBroadcast/i.test(badges);
    const views = runsText(renderer.shortViewCountText) || runsText(renderer.viewCountText);
    out.push({
      id: renderer.videoId,
      title: runsText(renderer.title) || "YouTube video",
      channel: runsText(renderer.ownerText) || runsText(renderer.shortBylineText) || "YouTube",
      duration: runsText(renderer.lengthText) || undefined,
      views: views || undefined,
      published: runsText(renderer.publishedTimeText) || undefined,
      live,
    });
  }
  for (const child of Object.values(rec)) walkVideos(child, out);
}

function uniqueVideos(list: YtVideo[]) {
  const seen = new Set<string>();
  const out: YtVideo[] = [];
  for (const video of list) {
    if (seen.has(video.id)) continue;
    seen.add(video.id);
    out.push(video);
  }
  return out;
}

function parseInitialData(html: string): unknown | null {
  const match =
    html.match(/ytInitialData\s*=\s*(\{.+?\});\s*<\/script>/s) ??
    html.match(/var\s+ytInitialData\s*=\s*(\{.+?\});/s);
  if (!match?.[1]) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

async function fetchYoutubeHtml(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        Cookie: "CONSENT=YES+1; SOCS=CAISNQgDEitib3FfaWRlbnRpdHlmcm9udGVuZHVpc2VydmVyXzIwMjQwNjA0LjA3X3AxGgJlbiACGgYIgA",
      },
    });
    if (!res.ok) throw new Error(`YouTube returned ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function searchYoutubeHtml(query: string): Promise<YtVideo[]> {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=en&gl=US&sp=EgIQAQ%3D%3D`;
  const html = await fetchYoutubeHtml(url);
  const data = parseInitialData(html);
  const found: YtVideo[] = [];
  walkVideos(data, found);
  return uniqueVideos(found).slice(0, 32);
}

const Input = z.object({
  q: z.string().max(180).optional(),
  tab: z.string().max(32).optional(),
});

function interleave(groups: YtVideo[][]) {
  const out: YtVideo[] = [];
  const seen = new Set<string>();
  const max = Math.max(0, ...groups.map((g) => g.length));
  for (let i = 0; i < max; i++) {
    for (const group of groups) {
      const video = group[i];
      if (!video || seen.has(video.id)) continue;
      seen.add(video.id);
      out.push(video);
    }
  }
  return out.slice(0, 32);
}

export const fetchYoutube = createServerFn({ method: "POST" })
  .validator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<{ videos: YtVideo[]; query: string }> => {
    if (data.tab === "recommended") return { videos: [], query: "recommended" };
    const tab = YT_TABS.find((item) => item.id === data.tab);
    const query = (data.q?.trim() || tab?.query || "official trailer").slice(0, 180);
    const key = `${data.q?.trim() ? "q" : data.tab ?? "trending"}:${query.toLowerCase()}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return { videos: hit.videos, query };

    let videos: YtVideo[];
    if (!data.q?.trim() && (data.tab === "trending" || !data.tab)) {
      const groups = await Promise.all([
        searchYoutubeHtml("official trailer"),
        searchYoutubeHtml("official music video"),
        searchYoutubeHtml("viral videos"),
        searchYoutubeHtml("gaming highlights"),
      ]);
      videos = interleave(groups);
    } else {
      videos = await searchYoutubeHtml(query);
    }

    if (cache.size > 40) {
      const first = cache.keys().next().value;
      if (first) cache.delete(first);
    }
    cache.set(key, { at: Date.now(), videos });
    return { videos, query };
  });
