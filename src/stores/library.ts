import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MetaPreview } from "@/lib/stremio/types";

export type ProgressItem = {
  type: string;
  id: string;
  videoId: string;
  name: string;
  poster?: string;
  background?: string;
  season?: number;
  episode?: number;
  episodeName?: string;
  position: number;
  duration: number;
  updatedAt: number;
};

export type PlaybackPref = {
  bingeGroup?: string;
  addonId?: string;
  addonName?: string;
  quality?: string;
  streamKey?: string;
  subtitleLang?: string;
  audioLang?: string;
  introSkipTo?: number;
};

type LibraryState = {
  list: MetaPreview[];
  progress: ProgressItem[];
  watched: string[];
  prefs: Record<string, PlaybackPref>;
  autoplayNext: boolean;
  toggleList: (item: MetaPreview) => void;
  inList: (id: string) => boolean;
  saveProgress: (item: ProgressItem) => void;
  clearProgress: (id: string, videoId?: string) => void;
  markWatched: (videoId: string) => void;
  savePref: (id: string, patch: Partial<PlaybackPref>) => void;
  setAutoplayNext: (value: boolean) => void;
};

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      list: [],
      progress: [],
      watched: [],
      prefs: {},
      autoplayNext: true,
      toggleList: (item) => {
        const exists = get().list.some((entry) => entry.id === item.id);
        set({
          list: exists
            ? get().list.filter((entry) => entry.id !== item.id)
            : [{ ...item }, ...get().list].slice(0, 200),
        });
      },
      inList: (id) => get().list.some((entry) => entry.id === id),
      saveProgress: (item) => {
        const rest = get().progress.filter(
          (entry) => !(entry.id === item.id && entry.videoId === item.videoId),
        );
        set({ progress: [item, ...rest].slice(0, 80) });
      },
      clearProgress: (id, videoId) =>
        set({
          progress: get().progress.filter((entry) =>
            videoId ? !(entry.id === id && entry.videoId === videoId) : entry.id !== id,
          ),
        }),
      markWatched: (videoId) => {
        if (get().watched.includes(videoId)) return;
        set({ watched: [videoId, ...get().watched].slice(0, 400) });
      },
      savePref: (id, patch) => {
        const prev = get().prefs[id] ?? {};
        set({ prefs: { ...get().prefs, [id]: { ...prev, ...patch } } });
      },
      setAutoplayNext: (value) => set({ autoplayNext: value }),
    }),
    {
      name: "nox-library",
      skipHydration: true,
      partialize: (state) => ({
        list: state.list,
        progress: state.progress,
        watched: state.watched,
        prefs: state.prefs,
        autoplayNext: state.autoplayNext,
      }),
    },
  ),
);

export function continueWatching(items: ProgressItem[]) {
  const unfinished = [...items]
    .filter((item) => {
      if (item.position < 5) return false;
      if (!item.duration || item.duration < 20) return true;
      return item.position / item.duration < 0.92;
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const seen = new Set<string>();
  const out: ProgressItem[] = [];
  for (const item of unfinished) {
    const key = `${item.type}:${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function progressRatio(item: Pick<ProgressItem, "position" | "duration">) {
  if (!item.duration || item.duration < 1) return 0;
  return Math.min(1, Math.max(0, item.position / item.duration));
}

export function isWatched(videoId: string, watched: string[], progress: ProgressItem[]) {
  if (watched.includes(videoId)) return true;
  const item = progress.find((entry) => entry.videoId === videoId);
  if (!item) return false;
  return progressRatio(item) >= 0.92;
}

export function progressFor(videoId: string, progress: ProgressItem[]) {
  return progress.find((entry) => entry.videoId === videoId) ?? null;
}
