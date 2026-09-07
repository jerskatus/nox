import type { YtVideo } from "./youtube";
import { googleLive, useGoogleStore } from "@/stores/google";

const YT_SCOPE = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
].join(" ");

type TokenClient = {
  requestAccessToken: (opts?: { prompt?: string }) => void;
};

type Gsi = {
  accounts: {
    oauth2: {
      initTokenClient: (cfg: {
        client_id: string;
        scope: string;
        callback: (resp: { access_token?: string; expires_in?: number; error?: string }) => void;
        error_callback?: (err: { type?: string; message?: string }) => void;
      }) => TokenClient;
      revoke: (token: string, done?: () => void) => void;
    };
  }
};

declare global {
  interface Window {
    google?: Gsi;
  }
}

export function isGoogleClientId(value: string) {
  return /^[\w.-]+\.apps\.googleusercontent\.com$/.test(value.trim());
}

export async function loadGis() {
  if (window.google?.accounts?.oauth2) return;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-nox-gis]");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Could not load Google")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.dataset.noxGis = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Google"));
    document.head.appendChild(script);
  });
}

export async function connectGoogle(clientId: string) {
  if (!isGoogleClientId(clientId)) throw new Error("That doesn’t look like a Google client ID.");
  await loadGis();
  const oauth = window.google?.accounts?.oauth2;
  if (!oauth) throw new Error("Google sign-in isn’t available.");
  const token = await new Promise<{ access_token: string; expires_in: number }>((resolve, reject) => {
    const client = oauth.initTokenClient({
      client_id: clientId.trim(),
      scope: YT_SCOPE,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error || "Google sign-in was cancelled."));
          return;
        }
        resolve({ access_token: resp.access_token, expires_in: resp.expires_in ?? 3600 });
      },
      error_callback: (err) => reject(new Error(err.message || "Google sign-in failed.")),
    });
    client.requestAccessToken({ prompt: "consent" });
  });
  const profile = await fetchProfile(token.access_token);
  useGoogleStore.getState().setSession({
    accessToken: token.access_token,
    expiresAt: Date.now() + token.expires_in * 1000,
    email: profile.email,
    name: profile.name,
    picture: profile.picture,
  });
}

export function disconnectGoogle() {
  const token = useGoogleStore.getState().accessToken;
  const oauth = window.google?.accounts?.oauth2;
  if (token && oauth) oauth.revoke(token);
  useGoogleStore.getState().clearSession();
}

async function fetchProfile(token: string) {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { email: "", name: "", picture: "" };
  const data = (await res.json()) as { email?: string; name?: string; picture?: string };
  return { email: data.email ?? "", name: data.name ?? "", picture: data.picture ?? "" };
}

type YtList<T> = { items?: T[]; error?: { message?: string; status?: string } };

async function yt<T>(token: string, path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
  const data = (await res.json()) as T & { error?: { message?: string } };
  if (res.status === 401) {
    useGoogleStore.getState().clearSession();
    throw new Error("Google session expired. Connect again.");
  }
  if (!res.ok) {
    const message = data.error?.message ?? `YouTube API ${res.status}`;
    throw new Error(message);
  }
  return data;
}

function isoDuration(raw: string | undefined) {
  if (!raw) return undefined;
  const match = raw.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return undefined;
  const h = Number(match[1] ?? 0);
  const m = Number(match[2] ?? 0);
  const s = Number(match[3] ?? 0);
  if (h) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function compactViews(count: string | undefined) {
  const n = Number(count);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M views`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K views`;
  return `${n} views`;
}

function timeAgo(iso: string | undefined) {
  if (!iso) return undefined;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return undefined;
  const mins = Math.max(1, Math.round((Date.now() - then) / 60_000));
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.round(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

export async function fetchRecommended(token: string): Promise<YtVideo[]> {
  if (!token) return [];
  const subs = await yt<YtList<{ snippet?: { resourceId?: { channelId?: string } } }>>(
    token,
    "subscriptions",
    { part: "snippet", mine: "true", maxResults: "50", order: "unread" },
  );
  const channelIds = (subs.items ?? [])
    .map((item) => item.snippet?.resourceId?.channelId)
    .filter((id): id is string => Boolean(id))
    .slice(0, 16);

  const me = await yt<YtList<{ contentDetails?: { relatedPlaylists?: { likes?: string; uploads?: string } } }>>(
    token,
    "channels",
    { part: "contentDetails", mine: "true" },
  );
  const likesId = me.items?.[0]?.contentDetails?.relatedPlaylists?.likes;

  const uploadsByChannel = channelIds.length
    ? await yt<YtList<{ id?: string; contentDetails?: { relatedPlaylists?: { uploads?: string } } }>>(
        token,
        "channels",
        { part: "contentDetails", id: channelIds.join(","), maxResults: "50" },
      )
    : { items: [] };

  const uploadIds = (uploadsByChannel.items ?? [])
    .map((item) => item.contentDetails?.relatedPlaylists?.uploads)
    .filter((id): id is string => Boolean(id))
    .slice(0, 12);

  const playlists = await Promise.all(
    [...uploadIds.map((id) => ({ id, take: 3 })), ...(likesId ? [{ id: likesId, take: 12 }] : [])].map((playlist) =>
      yt<
        YtList<{
          contentDetails?: { videoId?: string; videoPublishedAt?: string };
          snippet?: { title?: string; channelTitle?: string; publishedAt?: string; resourceId?: { videoId?: string } };
        }>
      >(token, "playlistItems", {
        part: "snippet,contentDetails",
        playlistId: playlist.id,
        maxResults: String(playlist.take),
      }).catch(() => ({ items: [] })),
    ),
  );

  const draft: Array<YtVideo & { at: number }> = [];
  const seen = new Set<string>();
  for (const list of playlists) {
    for (const item of list.items ?? []) {
      const id = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const published = item.contentDetails?.videoPublishedAt || item.snippet?.publishedAt;
      draft.push({
        id,
        title: item.snippet?.title || "YouTube video",
        channel: item.snippet?.channelTitle || "YouTube",
        published: timeAgo(published),
        at: published ? new Date(published).getTime() : 0,
      });
    }
  }

  draft.sort((a, b) => b.at - a.at);
  const top = draft.slice(0, 32);
  const ids = top.map((item) => item.id);
  if (ids.length) {
    const details = await yt<
      YtList<{
        id?: string;
        contentDetails?: { duration?: string };
        statistics?: { viewCount?: string };
        snippet?: { liveBroadcastContent?: string };
      }>
    >(token, "videos", {
      part: "contentDetails,statistics,snippet",
      id: ids.join(","),
    }).catch(() => ({ items: [] }));
    const byId = new Map((details.items ?? []).map((item) => [item.id, item]));
    for (const video of top) {
      const extra = byId.get(video.id);
      video.duration = isoDuration(extra?.contentDetails?.duration);
      video.views = compactViews(extra?.statistics?.viewCount);
      video.live = extra?.snippet?.liveBroadcastContent === "live";
    }
  }

  return top.map(({ at: _at, ...video }) => video);
}

export function currentGoogleToken() {
  const state = useGoogleStore.getState();
  return googleLive(state) ? state.accessToken : null;
}
