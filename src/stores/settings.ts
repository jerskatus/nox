import { create } from "zustand";
import { persist } from "zustand/middleware";

export const THEMES = [
  { id: "nox", label: "Nox", hint: "Classic red", accent: "#e50914", bg: "#000000" },
  { id: "midnight", label: "Midnight", hint: "Ice on navy", accent: "#7aa2ff", bg: "#07090f" },
  { id: "ember", label: "Ember", hint: "Warm cinema", accent: "#ff7a3d", bg: "#0c0908" },
  { id: "ocean", label: "Ocean", hint: "Deep teal", accent: "#2ec4b6", bg: "#05090c" },
  { id: "forest", label: "Forest", hint: "Moss green", accent: "#5dbe7e", bg: "#070b08" },
  { id: "gold", label: "Gold", hint: "Prestige", accent: "#d4af37", bg: "#0a0906" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export type PlaybackRate = 1 | 1.25 | 1.5 | 2;
export type SubtitleMode = "off" | "en" | "last";
export type SearchModePref = "smart" | "title";
export type SubtitleSize = "s" | "m" | "l" | "xl";
export type SubtitleBox = "off" | "dim" | "solid";
export type SubtitlePos = "low" | "mid" | "high";

type SettingsState = {
  theme: ThemeId;
  autoplayNext: boolean;
  skipIntros: boolean;
  rememberStream: boolean;
  playbackRate: PlaybackRate;
  volume: number;
  muted: boolean;
  subtitles: SubtitleMode;
  searchMode: SearchModePref;
  tvRemote: boolean;
  subtitleSize: SubtitleSize;
  subtitleBox: SubtitleBox;
  subtitlePos: SubtitlePos;
  setTheme: (theme: ThemeId) => void;
  setAutoplayNext: (value: boolean) => void;
  setSkipIntros: (value: boolean) => void;
  setRememberStream: (value: boolean) => void;
  setPlaybackRate: (value: PlaybackRate) => void;
  setVolume: (value: number) => void;
  setMuted: (value: boolean) => void;
  setSubtitles: (value: SubtitleMode) => void;
  setSearchMode: (value: SearchModePref) => void;
  setTvRemote: (value: boolean) => void;
  setSubtitleSize: (value: SubtitleSize) => void;
  setSubtitleBox: (value: SubtitleBox) => void;
  setSubtitlePos: (value: SubtitlePos) => void;
};

export function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some((theme) => theme.id === value);
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "nox",
      autoplayNext: true,
      skipIntros: false,
      rememberStream: true,
      playbackRate: 1,
      volume: 1,
      muted: false,
      subtitles: "last",
      searchMode: "smart",
      tvRemote: false,
      subtitleSize: "m",
      subtitleBox: "dim",
      subtitlePos: "low",
      setTheme: (theme) => set({ theme }),
      setAutoplayNext: (autoplayNext) => set({ autoplayNext }),
      setSkipIntros: (skipIntros) => set({ skipIntros }),
      setRememberStream: (rememberStream) => set({ rememberStream }),
      setPlaybackRate: (playbackRate) => set({ playbackRate }),
      setVolume: (volume) => {
        const next = Math.min(1, Math.max(0, volume));
        set({ volume: next, muted: next === 0 });
      },
      setMuted: (muted) =>
        set((state) => ({
          muted,
          volume: !muted && state.volume === 0 ? 1 : state.volume,
        })),
      setSubtitles: (subtitles) => set({ subtitles }),
      setSearchMode: (searchMode) => {
        if (typeof window !== "undefined") window.localStorage.setItem("nox-search-mode", searchMode);
        set({ searchMode });
      },
      setTvRemote: (tvRemote) => set({ tvRemote }),
      setSubtitleSize: (subtitleSize) => set({ subtitleSize }),
      setSubtitleBox: (subtitleBox) => set({ subtitleBox }),
      setSubtitlePos: (subtitlePos) => set({ subtitlePos }),
    }),
    {
      name: "nox-settings",
      skipHydration: true,
      partialize: (state) => ({
        theme: state.theme,
        autoplayNext: state.autoplayNext,
        skipIntros: state.skipIntros,
        rememberStream: state.rememberStream,
        playbackRate: state.playbackRate,
        volume: state.volume,
        muted: state.muted,
        subtitles: state.subtitles,
        searchMode: state.searchMode,
        tvRemote: state.tvRemote,
        subtitleSize: state.subtitleSize,
        subtitleBox: state.subtitleBox,
        subtitlePos: state.subtitlePos,
      }),
    },
  ),
);
