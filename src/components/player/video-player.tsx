import {
  ArrowLeft,
  AudioLines,
  Captions,
  Check,
  Maximize,
  Minimize,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { type PointerEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { desktopHasEngine, type DesktopAudioTrack } from "@/lib/desktop";
import { isEnglishLabel } from "@/lib/stremio/stream-rank";
import { loadSubtitleFile } from "@/lib/stremio/client";
import {
  type Cue,
  activeCue,
  correlateOffset,
  formatOffset,
  parseSubtitleFile,
  preferSubtitle,
  subtitleLabel,
  upcomingCue,
} from "@/lib/stremio/subtitles";
import type { Stream, Subtitle } from "@/lib/stremio/types";
import { cn, formatTime, unlockMediaPlayback } from "@/lib/utils";
import { useSettingsStore, type SubtitleBox, type SubtitlePos, type SubtitleSize } from "@/stores/settings";

type Props = {
  src: string;
  kind: "http" | "hls";
  title: string;
  subtitle?: string;
  poster?: string;
  startAt?: number;
  subtitles?: Subtitle[];
  preferredLang?: string | null;
  isEpisode?: boolean;
  introSkipTo?: number;
  autoplayNext?: boolean;
  skipIntros?: boolean;
  defaultRate?: number;
  captionsDefault?: boolean;
  onBack: () => void;
  onProgress: (position: number, duration: number) => void;
  onEnded?: () => void;
  nextLabel?: string;
  onNext?: () => void;
  onIntroSkip?: (to: number) => void;
  onSubtitleChange?: (lang: string | null) => void;
  preferredAudioLang?: string | null;
  onAudioChange?: (lang: string | null) => void;
  onPlaybackError?: () => void;
  onSilentAudio?: () => void;
  onStable?: () => void;
  statusNote?: string | null;
  extra?: ReactNode;
};

type AudioChoice = {
  id: string;
  index: number;
  name: string;
  lang: string;
  codec: string;
  channels: string;
  isDefault: boolean;
  source: "hls" | "native" | "engine";
  cinema?: boolean;
};

type SyncState = "idle" | "listening" | "tap" | "done";

/** Set true after the user clicks Play with sound so the next source can autoplay. */
let playArmed = false;

export function VideoPlayer({
  src,
  kind,
  title,
  subtitle,
  poster,
  startAt = 0,
  subtitles = [],
  preferredLang,
  preferredAudioLang,
  isEpisode,
  introSkipTo,
  autoplayNext = true,
  skipIntros = false,
  defaultRate = 1,
  captionsDefault = true,
  onBack,
  onProgress,
  onEnded,
  nextLabel,
  onNext,
  onIntroSkip,
  onSubtitleChange,
  onAudioChange,
  onPlaybackError,
  onSilentAudio,
  onStable,
  statusNote,
  extra,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | null>(null);
  const graphRef = useRef<{ ctx: AudioContext; analyser: AnalyserNode } | null>(null);
  const syncing = useRef(false);
  const [playing, setPlaying] = useState(true);
  const volume = useSettingsStore((s) => s.volume);
  const [playerMuted, setPlayerMuted] = useState(false);
  const playerMutedRef = useRef(false);
  playerMutedRef.current = playerMuted;
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [fs, setFs] = useState(false);
  const [controls, setControls] = useState(true);
  const [waiting, setWaiting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rate, setRate] = useState(defaultRate);
  const [captionsOpen, setCaptionsOpen] = useState(false);
  const [audioOpen, setAudioOpen] = useState(false);
  const [audioTracks, setAudioTracks] = useState<AudioChoice[]>([]);
  const [selectedAudio, setSelectedAudio] = useState(0);
  const [usingEngine, setUsingEngine] = useState(false);
  const [engineNote, setEngineNote] = useState<string | null>(null);
  const userPickedAudio = useRef(false);
  const preferredAudioRef = useRef(preferredAudioLang);
  preferredAudioRef.current = preferredAudioLang;
  const lastAudioLang = useRef(preferredAudioLang || "eng");
  const [selectedSub, setSelectedSub] = useState<Subtitle | null>(() =>
    captionsDefault ? preferSubtitle(subtitles, preferredLang) : null,
  );
  const [secondSub, setSecondSub] = useState<Subtitle | null>(null);
  const [cues, setCues] = useState<Cue[]>([]);
  const [secondCues, setSecondCues] = useState<Cue[]>([]);
  const [offset, setOffset] = useState(0);
  const subtitleSize = useSettingsStore((s) => s.subtitleSize);
  const subtitleBox = useSettingsStore((s) => s.subtitleBox);
  const subtitlePos = useSettingsStore((s) => s.subtitlePos);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [syncMessage, setSyncMessage] = useState("");
  const [tapCue, setTapCue] = useState<Cue | null>(null);
  const [skippedIntro, setSkippedIntro] = useState(false);
  const [holdNext, setHoldNext] = useState(false);
  const nextLock = useRef(false);
  const started = useRef(false);
  const startAtRef = useRef(startAt);
  const waitingRef = useRef(waiting);
  const pendingSound = useRef(false);
  const hlsRef = useRef<{
    destroy: () => void;
    audioTrack: number;
    audioTracks: Array<{
      default?: boolean;
      name?: string;
      lang?: string;
      audioCodec?: string;
      channels?: string;
    }>;
    swapAudioCodec: () => void;
    recoverMediaError: () => void;
  } | null>(null);
  const engineOffsetRef = useRef(0);
  const engineDurationRef = useRef(0);
  const engineAudioRef = useRef(0);
  const engineActiveRef = useRef(false);
  const engineSwapRef = useRef(false);
  const engineGenRef = useRef(0);
  const engineSeekTimer = useRef<number | null>(null);
  const engineRestartRef = useRef<(startAt: number) => void>(() => undefined);
  const silentTries = useRef(0);
  waitingRef.current = waiting;
  const freezeControls = captionsOpen || audioOpen || syncState !== "idle";
  const freezeRef = useRef(freezeControls);
  freezeRef.current = freezeControls;
  const subKey = subtitles.map((s) => s.url).join("|");
  const [needsSound, setNeedsSound] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(!playArmed);

  const bumpControls = useCallback(() => {
    setControls(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    if (freezeRef.current) return;
    hideTimer.current = window.setTimeout(() => {
      const video = videoRef.current;
      if (!video || video.paused || video.ended || waitingRef.current || freezeRef.current) return;
      setControls(false);
    }, 3200);
  }, []);

  useEffect(() => {
    if (!freezeControls) return;
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    setControls(true);
  }, [freezeControls]);

  const unlockSound = useCallback(() => {
    unlockMediaPlayback();
    playArmed = true;
    const video = videoRef.current;
    const settings = useSettingsStore.getState();
    if (settings.volume === 0) settings.setVolume(1);
    const volume = useSettingsStore.getState().volume || 1;
    setPlayerMuted(false);
    playerMutedRef.current = false;
    if (video) {
      video.defaultMuted = false;
      video.muted = false;
      video.volume = volume;
      void video.play().catch(() => {
        setNeedsGesture(true);
        setPlaying(false);
      });
    }
    pendingSound.current = false;
    setNeedsSound(false);
    setNeedsGesture(false);
  }, []);

  const mediaTime = useCallback(() => {
    const video = videoRef.current;
    if (!video) return engineOffsetRef.current;
    if (engineActiveRef.current) {
      const local = Number.isFinite(video.currentTime) ? video.currentTime : 0;
      return engineOffsetRef.current + local;
    }
    return video.currentTime;
  }, []);

  const seekMedia = useCallback((absolute: number, immediate = false) => {
    const video = videoRef.current;
    const cap =
      engineDurationRef.current ||
      (video && Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0);
    const next = Math.max(0, cap > 0 ? Math.min(absolute, Math.max(0, cap - 0.35)) : absolute);
    setTime(next);
    if (!engineActiveRef.current) {
      if (video && Number.isFinite(next)) video.currentTime = next;
      return;
    }
    if (engineSeekTimer.current) window.clearTimeout(engineSeekTimer.current);
    const fire = () => {
      engineSeekTimer.current = null;
      engineRestartRef.current(next);
    };
    if (immediate) fire();
    else engineSeekTimer.current = window.setTimeout(fire, 280);
  }, []);

  const selectAudioTrack = useCallback(
    (index: number) => {
      userPickedAudio.current = true;
      const choice = audioTracks.find((t) => t.index === index) ?? audioTracks[index];
      const lang = choice?.lang || choice?.name || null;
      if (lang) lastAudioLang.current = lang;
      setSelectedAudio(choice?.index ?? index);
      onAudioChange?.(lang);
      bumpControls();
      if (engineActiveRef.current) {
        engineAudioRef.current = choice?.index ?? index;
        seekMedia(mediaTime(), true);
        return;
      }
      const hls = hlsRef.current;
      if (hls && hls.audioTracks.length > 0) {
        hls.audioTrack = choice?.index ?? index;
      } else {
        const list = nativeAudioList(videoRef.current);
        if (list.length > 0) enableNativeTrack(list, choice?.index ?? index);
      }
    },
    [audioTracks, onAudioChange, bumpControls, seekMedia, mediaTime],
  );

  function noteSilentPlayback(video: HTMLVideoElement) {
    if (playerMutedRef.current) {
      pendingSound.current = false;
      setNeedsSound(false);
      return;
    }
    if (video.muted) {
      video.muted = false;
      video.volume = useSettingsStore.getState().volume || 1;
    }
    if (video.muted || video.volume === 0) {
      pendingSound.current = true;
      setNeedsSound(true);
    } else {
      pendingSound.current = false;
      setNeedsSound(false);
    }
  }

  useEffect(() => {
    startAtRef.current = startAt;
  }, [startAt]);

  useEffect(() => {
    setRate(defaultRate);
  }, [defaultRate]);

  useEffect(() => {
    if (!skipIntros || skippedIntro) return;
    if (time < 4) return;
    const end = introSkipTo && introSkipTo > 20 ? introSkipTo : 90;
    if (time > Math.min(end, 100)) return;
    if (duration > 0 && duration <= 240) return;
    const video = videoRef.current;
    if (!video) return;
    const to = introSkipTo && introSkipTo > 20 ? introSkipTo : 85;
    seekMedia(Math.min(to, Math.max(0, (duration || to) - 1)), true);
    setSkippedIntro(true);
    onIntroSkip?.(to);
  }, [skipIntros, skippedIntro, time, duration, introSkipTo, onIntroSkip, seekMedia]);

  useEffect(() => {
    setSelectedSub(captionsDefault ? preferSubtitle(subtitles, preferredLang) : null);
    setOffset(0);
    setSyncState("idle");
    syncing.current = false;
  }, [subKey]);

  useEffect(() => {
    if (!selectedSub?.url) {
      setCues([]);
      return;
    }
    let cancelled = false;
    void loadSubtitleFile(selectedSub.url)
      .then((text) => {
        if (cancelled) return;
        setCues(parseSubtitleFile(text));
      })
      .catch(() => {
        if (!cancelled) setCues([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSub?.url]);

  useEffect(() => {
    if (!secondSub?.url || secondSub.url === selectedSub?.url) {
      setSecondCues([]);
      return;
    }
    let cancelled = false;
    void loadSubtitleFile(secondSub.url)
      .then((text) => {
        if (!cancelled) setSecondCues(parseSubtitleFile(text));
      })
      .catch(() => {
        if (!cancelled) setSecondCues([]);
      });
    return () => {
      cancelled = true;
    };
  }, [secondSub?.url, selectedSub?.url]);

  useEffect(() => {
    const s = useSettingsStore.getState();
    if (s.muted) s.setMuted(false);
    if (s.volume === 0) s.setVolume(1);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setError(null);
    setWaiting(true);
    setNeedsSound(false);
    setNeedsGesture(false);
    setUsingEngine(false);
    setEngineNote(null);
    pendingSound.current = false;
    started.current = false;
    silentTries.current = 0;
    userPickedAudio.current = false;
    lastAudioLang.current = preferredAudioRef.current || "eng";
    setAudioTracks([]);
    setSelectedAudio(0);
    setAudioOpen(false);
    hlsRef.current = null;
    engineActiveRef.current = false;
    engineOffsetRef.current = 0;
    engineDurationRef.current = 0;
    engineAudioRef.current = 0;
    engineSwapRef.current = false;
    engineGenRef.current += 1;
    if (engineSeekTimer.current) {
      window.clearTimeout(engineSeekTimer.current);
      engineSeekTimer.current = null;
    }
    let cancelled = false;
    const holder: { hls: { destroy: () => void } | null } = { hls: null };
    if (desktopHasEngine()) playArmed = true;

    const attemptPlay = async () => {
      if (cancelled) return;
      video.defaultMuted = false;
      video.muted = playerMutedRef.current;
      video.volume = useSettingsStore.getState().volume || 1;
      if (engineActiveRef.current) {
        started.current = true;
      } else if (!started.current && startAtRef.current > 1) {
        try {
          video.currentTime = startAtRef.current;
        } catch {
          /* not seekable yet */
        }
        started.current = true;
      }
      setWaiting(false);
      engineSwapRef.current = false;
      if (!playArmed) {
        setNeedsGesture(true);
        setPlaying(false);
        setControls(true);
        return;
      }
      try {
        video.muted = false;
        await video.play();
        noteSilentPlayback(video);
      } catch {
        setPlaying(false);
        setNeedsGesture(true);
        setControls(true);
      }
    };

    const loadBrowser = () => {
      if (cancelled) return;
      engineActiveRef.current = false;
      setUsingEngine(false);
      if (kind === "hls") {
        void import("hls.js").then(({ default: Hls }) => {
          if (cancelled || !videoRef.current) return;
          const el = videoRef.current;
          if (Hls.isSupported()) {
            const instance = new Hls({
              enableWorker: false,
              maxBufferLength: 30,
              maxMaxBufferLength: 60,
              startFragPrefetch: true,
              useMediaCapabilities: false,
              audioPreference: { lang: "en" },
            });
            const pickAudio = () => {
              const tracks = mapHlsTracks(instance.audioTracks);
              const list = tracks.length ? tracks : originalTrack();
              setAudioTracks(list);
              if (!tracks.length) {
                setSelectedAudio(0);
                return;
              }
              const remembered = lastAudioLang.current || preferredAudioRef.current || "eng";
              if (userPickedAudio.current) {
                const match = matchAudioIndex(tracks, remembered);
                const next = match >= 0 ? match : Math.max(0, instance.audioTrack);
                if (instance.audioTrack !== next) instance.audioTrack = next;
                setSelectedAudio(next);
                return;
              }
              const best = pickBestAudioIndex(tracks, remembered);
              if (instance.audioTrack !== best) instance.audioTrack = best;
              setSelectedAudio(best);
            };
            instance.on(Hls.Events.MANIFEST_PARSED, () => {
              pickAudio();
              void attemptPlay();
            });
            instance.on(Hls.Events.AUDIO_TRACKS_UPDATED, pickAudio);
            instance.on(Hls.Events.AUDIO_TRACK_SWITCHED, () => {
              setSelectedAudio(Math.max(0, instance.audioTrack));
            });
            instance.on(Hls.Events.ERROR, (_e, data) => {
              if (
                data.details === Hls.ErrorDetails.BUFFER_ADD_CODEC_ERROR ||
                data.details === Hls.ErrorDetails.BUFFER_INCOMPATIBLE_CODECS_ERROR
              ) {
                instance.swapAudioCodec();
                instance.recoverMediaError();
                return;
              }
              if (!data.fatal) return;
              if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                instance.swapAudioCodec();
                instance.recoverMediaError();
                return;
              }
              setError("This stream could not be played.");
              onPlaybackError?.();
            });
            instance.loadSource(src);
            instance.attachMedia(el);
            holder.hls = instance;
            hlsRef.current = instance;
          } else {
            el.src = src;
          }
        });
      } else {
        video.src = src;
      }
    };

    const loadEngine = async () => {
      const api = window.noxDesktop;
      if (!api?.play || !api.probe) {
        loadBrowser();
        return;
      }
      setEngineNote("Preparing cinema audio…");
      const gen = engineGenRef.current;
      try {
        const info = await api.probe(src);
        if (cancelled || gen !== engineGenRef.current) return;
        const tracks = mapEngineTracks(info.tracks);
        if (info.duration > 0) {
          engineDurationRef.current = info.duration;
          setDuration(info.duration);
        }
        const list = tracks.length ? tracks : [{ ...originalTrack()[0]!, source: "engine" as const }];
        setAudioTracks(list);
        const remembered = lastAudioLang.current || preferredAudioRef.current || "eng";
        const picked = list[pickBestAudioIndex(list, remembered)] ?? list[0]!;
        engineAudioRef.current = picked.index;
        setSelectedAudio(picked.index);
        const startAt = startAtRef.current > 1 ? startAtRef.current : 0;
        engineOffsetRef.current = startAt;
        setTime(startAt);
        const result = await api.play({
          url: src,
          startAt,
          audio: picked.index,
          transcode: true,
        });
        if (cancelled || gen !== engineGenRef.current) return;
        engineActiveRef.current = true;
        setUsingEngine(true);
        const cinema = list.some((t) => t.cinema || isCinemaAudio(t));
        setEngineNote(cinema ? "Cinema audio · playing as AAC stereo" : null);
        if (cinema) {
          window.setTimeout(() => {
            if (!cancelled) setEngineNote(null);
          }, 3500);
        }
        engineSwapRef.current = true;
        video.src = result.src;
      } catch {
        if (cancelled || gen !== engineGenRef.current) return;
        setEngineNote(null);
        engineActiveRef.current = false;
        setUsingEngine(false);
        loadBrowser();
      }
    };

    engineRestartRef.current = (startAt: number) => {
      void (async () => {
        const api = window.noxDesktop;
        if (!api?.play || cancelled || !engineActiveRef.current) return;
        const gen = ++engineGenRef.current;
        engineSwapRef.current = true;
        engineOffsetRef.current = Math.max(0, startAt);
        setTime(engineOffsetRef.current);
        setWaiting(true);
        try {
          const result = await api.play({
            url: src,
            startAt: engineOffsetRef.current,
            audio: engineAudioRef.current,
            transcode: true,
          });
          if (cancelled || gen !== engineGenRef.current) return;
          video.src = result.src;
        } catch {
          engineSwapRef.current = false;
          if (!cancelled && gen === engineGenRef.current) {
            setError("Playback failed. Try another stream.");
            onPlaybackError?.();
          }
        }
      })();
    };

    if (desktopHasEngine()) void loadEngine();
    else loadBrowser();

    const syncNativeAudio = () => {
      if (cancelled) return;
      if (engineActiveRef.current) return;
      if (hlsRef.current && hlsRef.current.audioTracks.length > 0) return;
      const list = nativeAudioList(video);
      if (!list.length) {
        setAudioTracks(originalTrack());
        setSelectedAudio(0);
        return;
      }
      const mapped = mapNativeTracks(list);
      setAudioTracks(mapped);
      const remembered = lastAudioLang.current || preferredAudioRef.current || "eng";
      if (userPickedAudio.current) {
        const match = matchAudioIndex(mapped, remembered);
        const index = match >= 0 ? match : mapped.findIndex((t) => list[t.index]?.enabled);
        if (index >= 0) {
          enableNativeTrack(list, mapped[index]!.index);
          setSelectedAudio(mapped[index]!.index);
        }
        return;
      }
      const best = pickBestAudioIndex(mapped, remembered);
      enableNativeTrack(list, mapped[best]?.index ?? 0);
      setSelectedAudio(mapped[best]?.index ?? 0);
    };

    video.addEventListener("loadedmetadata", attemptPlay);
    video.addEventListener("loadedmetadata", syncNativeAudio);
    video.addEventListener("loadeddata", () => {
      if (!cancelled) setWaiting(false);
      syncNativeAudio();
    });
    const nativeList = nativeAudioList(video);
    nativeList.addEventListener?.("addtrack", syncNativeAudio);
    nativeList.addEventListener?.("change", syncNativeAudio);
    nativeList.addEventListener?.("removetrack", syncNativeAudio);
    return () => {
      cancelled = true;
      engineSwapRef.current = true;
      engineActiveRef.current = false;
      engineRestartRef.current = () => undefined;
      if (engineSeekTimer.current) {
        window.clearTimeout(engineSeekTimer.current);
        engineSeekTimer.current = null;
      }
      video.removeEventListener("loadedmetadata", attemptPlay);
      video.removeEventListener("loadedmetadata", syncNativeAudio);
      nativeList.removeEventListener?.("addtrack", syncNativeAudio);
      nativeList.removeEventListener?.("change", syncNativeAudio);
      nativeList.removeEventListener?.("removetrack", syncNativeAudio);
      holder.hls?.destroy();
      hlsRef.current = null;
      video.removeAttribute("src");
      video.load();
      void window.noxDesktop?.stop?.();
      if (graphRef.current) {
        void graphRef.current.ctx.close().catch(() => undefined);
        graphRef.current = null;
      }
    };
  }, [src, kind]);

  useEffect(() => {
    if (!waiting || error) return;
    const timer = window.setTimeout(() => {
      const video = videoRef.current;
      if (!video || video.paused || video.ended) return;
      if (!waitingRef.current) return;
      setError("This stream stalled.");
      onPlaybackError?.();
    }, usingEngine ? 22_000 : 12_000);
    return () => window.clearTimeout(timer);
  }, [waiting, error, src, onPlaybackError, usingEngine]);

  useEffect(() => {
    if (error || waiting) return;
    const timer = window.setTimeout(() => onStable?.(), 12_000);
    return () => window.clearTimeout(timer);
  }, [src, error, waiting, onStable]);

  useEffect(() => {
    if (error || waiting) return;
    silentTries.current = 0;
    const timer = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused || video.ended) return;
      if (playerMutedRef.current) return;
      if (video.muted) {
        video.muted = false;
        video.volume = useSettingsStore.getState().volume || 1;
      }
      const bytes = audioDecodedBytes(video);
      if (bytes == null) return;
      if (bytes > 0) {
        window.clearInterval(timer);
        return;
      }
      if (video.currentTime < 1.5) return;
      if (userPickedAudio.current) return;
      silentTries.current += 1;
      const hls = hlsRef.current;
      if (!engineActiveRef.current && silentTries.current === 1 && hls) {
        try {
          hls.swapAudioCodec();
          hls.recoverMediaError();
        } catch {
          /* continue */
        }
        return;
      }
      if (!engineActiveRef.current && silentTries.current === 2 && hls && hls.audioTracks.length > 1) {
        const tracks = mapHlsTracks(hls.audioTracks);
        const english = pickBestAudioIndex(tracks, "eng");
        const englishTrack = tracks[english];
        if (
          english !== hls.audioTrack &&
          (isEnglishLabel(englishTrack?.lang) || isEnglishLabel(englishTrack?.name))
        ) {
          hls.audioTrack = english;
        } else {
          hls.audioTrack = (hls.audioTrack + 1) % hls.audioTracks.length;
        }
        return;
      }
      if (silentTries.current >= 3) {
        window.clearInterval(timer);
        if (onSilentAudio) onSilentAudio();
        else onPlaybackError?.();
      }
    }, 900);
    return () => window.clearInterval(timer);
  }, [src, error, waiting, onSilentAudio, onPlaybackError]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
    video.volume = volume <= 0 ? 1 : volume;
    video.muted = playerMuted;
    if (!playerMuted) video.defaultMuted = false;
  }, [rate, volume, playerMuted]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      if (graphRef.current?.ctx.state === "suspended") void graphRef.current.ctx.resume();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const video = videoRef.current;
      if (!video) return;
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      bumpControls();
      switch (event.key) {
        case " ":
        case "k":
          event.preventDefault();
          if (pendingSound.current || needsGesture || video.muted) {
            unlockSound();
            if (!video.paused) break;
          }
          if (video.paused) void video.play();
          else video.pause();
          break;
        case "ArrowLeft":
        case "j":
          event.preventDefault();
          seekMedia(mediaTime() - 10, true);
          break;
        case "ArrowRight":
        case "l":
          event.preventDefault();
          seekMedia(mediaTime() + 10, true);
          break;
        case "g":
          event.preventDefault();
          setOffset((v) => Math.round((v - 0.1) * 20) / 20);
          break;
        case "h":
          event.preventDefault();
          setOffset((v) => Math.round((v + 0.1) * 20) / 20);
          break;
        case "c":
          event.preventDefault();
          setCaptionsOpen((v) => !v);
          setAudioOpen(false);
          break;
        case "a":
          event.preventDefault();
          setAudioOpen((v) => !v);
          setCaptionsOpen(false);
          break;
        case "[":
          event.preventDefault();
          if (audioTracks.length > 1) {
            const i = Math.max(0, audioTracks.findIndex((t) => t.index === selectedAudio));
            const next = audioTracks[(i - 1 + audioTracks.length) % audioTracks.length]!;
            selectAudioTrack(next.index);
          }
          break;
        case "]":
          event.preventDefault();
          if (audioTracks.length > 1) {
            const i = Math.max(0, audioTracks.findIndex((t) => t.index === selectedAudio));
            const next = audioTracks[(i + 1) % audioTracks.length]!;
            selectAudioTrack(next.index);
          }
          break;
        case "f":
          event.preventDefault();
          toggleFs();
          break;
        case "m":
          event.preventDefault();
          if (pendingSound.current || video.muted || playerMuted) unlockSound();
          else {
            setPlayerMuted(true);
            video.muted = true;
          }
          break;
        case "Escape":
          if (captionsOpen || audioOpen || syncState !== "idle") {
            setCaptionsOpen(false);
            setAudioOpen(false);
            setSyncState("idle");
            break;
          }
          onBack();
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    bumpControls,
    onBack,
    captionsOpen,
    audioOpen,
    syncState,
    unlockSound,
    needsGesture,
    playerMuted,
    audioTracks,
    selectedAudio,
    selectAudioTrack,
    seekMedia,
    mediaTime,
  ]);

  function toggleFs() {
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void wrap.requestFullscreen();
  }

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (pendingSound.current || needsGesture || video.muted) {
      unlockSound();
      if (!video.paused && !needsGesture) return;
    }
    if (video.paused) void video.play();
    else video.pause();
  }

  function onSurfacePointer(event: PointerEvent<HTMLDivElement>) {
    bumpControls();
    if (event.pointerType === "mouse" && event.type === "pointermove") return;
    if (event.type !== "pointerup") return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (freezeRef.current) return;
    togglePlay();
  }

  function ensureAnalyser(video: HTMLVideoElement) {
    if (graphRef.current) {
      if (graphRef.current.ctx.state === "suspended") void graphRef.current.ctx.resume();
      return graphRef.current;
    }
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      if (ctx.state === "suspended") void ctx.resume();
      const media = video as HTMLVideoElement & {
        captureStream?: () => MediaStream;
        mozCaptureStream?: () => MediaStream;
      };
      const stream = media.captureStream?.() ?? media.mozCaptureStream?.();
      if (!stream) return null;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      graphRef.current = { ctx, analyser };
      return graphRef.current;
    } catch {
      return null;
    }
  }

  function readRms(analyser: AnalyserNode) {
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i]! - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / data.length);
  }

  async function runSync() {
    const video = videoRef.current;
    if (!video || cues.length === 0 || syncing.current) return;
    syncing.current = true;
    freezeRef.current = true;
    setAudioOpen(false);
    setCaptionsOpen(false);
    setSyncState("listening");
    setSyncMessage("Listening to the stream…");
    bumpControls();

    const now = () => mediaTime();
    const next = upcomingCue(cues, now(), offset);
    if (next && next.start - (now() + offset) > 10) {
      seekMedia(Math.max(0, next.start - 1.6), true);
    }
    if (video.paused) void video.play().catch(() => undefined);

    const graph = ensureAnalyser(video);
    if (graph?.ctx.state === "suspended") await graph.ctx.resume().catch(() => undefined);

    const raw: Array<{ t: number; rms: number }> = [];
    const startedAt = performance.now();
    while (performance.now() - startedAt < 8000 && syncing.current) {
      raw.push({ t: now(), rms: graph ? readRms(graph.analyser) : 0 });
      await new Promise((r) => window.setTimeout(r, 40));
    }

    const mean = raw.reduce((a, s) => a + s.rms, 0) / Math.max(raw.length, 1);
    const samples = raw.map((s) => ({ t: s.t, voiced: s.rms > mean * 1.35 + 0.01 }));
    const voicedCount = samples.filter((s) => s.voiced).length;
    const result = voicedCount >= 8 ? correlateOffset(samples, cues) : null;

    if (result) {
      setOffset(result.offset);
      setSyncState("done");
      setSyncMessage(`Synced · ${formatOffset(result.offset)}`);
      window.setTimeout(() => setSyncState("idle"), 2200);
    } else {
      const cue = upcomingCue(cues, now(), offset);
      setTapCue(cue);
      setSyncState("tap");
      setSyncMessage("Tap when you hear this line");
    }
    syncing.current = false;
    bumpControls();
  }

  function confirmTap() {
    const video = videoRef.current;
    if (!video || !tapCue) return;
    const next = Math.round((tapCue.start - mediaTime()) * 20) / 20;
    setOffset(next);
    setSyncState("done");
    setSyncMessage(`Synced · ${formatOffset(next)}`);
    window.setTimeout(() => setSyncState("idle"), 2200);
  }

  useEffect(() => {
    const onFs = () => setFs(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const shown = activeCue(cues, time, offset);
  const secondLine = secondCues.length > 0 ? activeCue(secondCues, time, offset) : null;
  const remaining = duration > 0 ? Math.max(0, duration - time) : 0;
  const introEnd = introSkipTo && introSkipTo > 20 ? introSkipTo : 90;
  const showSkipIntro =
    !skippedIntro && time >= 4 && time <= Math.min(introEnd, 100) && (duration === 0 || duration > 240);
  const showSkipCredits = Boolean(onNext) && duration > 480 && remaining > 15 && remaining <= 45 && !holdNext;
  const showCountdown =
    Boolean(onNext) && autoplayNext && !holdNext && duration > 180 && remaining > 0.35 && remaining <= 15;

  function skipIntro() {
    const video = videoRef.current;
    if (!video) return;
    const to = introSkipTo && introSkipTo > 20 ? introSkipTo : 85;
    seekMedia(Math.min(to, Math.max(0, (duration || to) - 1)), true);
    setSkippedIntro(true);
    onIntroSkip?.(to);
    bumpControls();
  }

  function goNext() {
    if (!onNext || nextLock.current) return;
    nextLock.current = true;
    onNext();
  }

  const currentAudio = audioTracks.find((t) => t.index === selectedAudio) ?? audioTracks[0];
  const cinemaSelected = currentAudio ? isCinemaAudio(currentAudio) : false;
  const banner = statusNote || engineNote;

  return (
    <div
      ref={wrapRef}
      data-player="1"
      className="relative h-dvh w-full overflow-hidden bg-bg touch-manipulation"
      onPointerMove={onSurfacePointer}
      onPointerUp={onSurfacePointer}
    >
      <video
        ref={videoRef}
        className="size-full object-contain"
        poster={poster}
        playsInline
        preload="auto"
        onPlay={() => {
          setPlaying(true);
          setWaiting(false);
        }}
        onPause={() => {
          setPlaying(false);
          setControls(true);
        }}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => {
          setWaiting(false);
          const video = videoRef.current;
          if (!video) return;
          if (!playerMutedRef.current) {
            video.muted = false;
            video.volume = useSettingsStore.getState().volume || 1;
          }
          noteSilentPlayback(video);
        }}
        onTimeUpdate={() => {
          const video = videoRef.current;
          if (!video) return;
          if (!playerMutedRef.current && video.muted) {
            video.muted = false;
            pendingSound.current = true;
            setNeedsSound(true);
          }
          const t = mediaTime();
          const d =
            engineActiveRef.current && engineDurationRef.current > 0
              ? engineDurationRef.current
              : video.duration && Number.isFinite(video.duration)
                ? video.duration
                : duration;
          setTime(t);
          if (d) setDuration(d);
          onProgress(t, d || 0);
        }}
        onDurationChange={() => {
          if (engineActiveRef.current && engineDurationRef.current > 0) {
            setDuration(engineDurationRef.current);
            return;
          }
          const next = videoRef.current?.duration || 0;
          if (Number.isFinite(next) && next > 0) setDuration(next);
        }}
        onEnded={() => {
          if (engineActiveRef.current && engineDurationRef.current > 0) {
            const t = mediaTime();
            if (t < engineDurationRef.current - 1.5) return;
          }
          onEnded?.();
          if (autoplayNext && onNext && !holdNext && !nextLock.current) {
            nextLock.current = true;
            onNext();
          }
        }}
        onError={() => {
          if (engineSwapRef.current) return;
          setError("Playback failed. Try another stream.");
          setPlaying(false);
          setControls(true);
          onPlaybackError?.();
        }}
      />

      {waiting && !error ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="size-12 animate-spin rounded-full border-2 border-fg/20 border-t-accent" />
        </div>
      ) : null}

      {error ? (
        <div className="pointer-events-none absolute inset-x-0 top-24 z-20 flex justify-center px-4">
          <div className="pointer-events-auto rounded-lg bg-surface/95 px-5 py-4 text-center shadow-xl">
            <p className="mb-3 text-lg font-semibold">{error}</p>
            <p className="mb-3 text-sm text-muted">Trying the next source…</p>
            <Button variant="ghost" onClick={onBack}>
              Go back
            </Button>
          </div>
        </div>
      ) : banner ? (
        <div className="pointer-events-none absolute inset-x-0 top-24 z-20 flex justify-center px-4">
          <p className="rounded-md bg-surface/95 px-4 py-2 text-sm font-medium shadow-xl">{banner}</p>
        </div>
      ) : null}

      {needsSound || needsGesture ? (
        <button
          type="button"
          className="absolute inset-0 z-50 grid place-items-center bg-bg/70"
          onClick={(e) => {
            e.stopPropagation();
            unlockSound();
          }}
        >
          <span className="flex items-center gap-3 rounded-full bg-fg px-8 py-4 text-lg font-semibold text-bg shadow-xl">
            <Play className="ml-0.5 size-6 fill-current" />
            Play with sound
          </span>
        </button>
      ) : null}

      {shown || secondLine ? (
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 z-20 flex justify-center px-6 text-center transition-[bottom] duration-200",
            subtitlePos === "high"
              ? "bottom-1/3"
              : subtitlePos === "mid"
                ? "bottom-36"
                : controls
                  ? "bottom-28 sm:bottom-32"
                  : "bottom-10",
          )}
        >
          <div className="max-w-3xl">
            {shown ? (
              <p className={cn(subSizeClass(subtitleSize), subBoxClass(subtitleBox), "font-medium leading-snug text-fg")}>
                {shown.text}
              </p>
            ) : null}
            {secondLine ? (
              <p
                className={cn(
                  subSizeClass(subtitleSize === "xl" ? "l" : subtitleSize === "l" ? "m" : "s"),
                  subBoxClass(subtitleBox),
                  "mt-1 font-medium leading-snug text-fg/90",
                )}
              >
                {secondLine.text}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {showSkipIntro ? (
        <div className="absolute right-4 bottom-28 z-40 sm:right-6 sm:bottom-32" onPointerUp={(e) => e.stopPropagation()}>
          <Button variant="ghost" className="h-11 rounded-full bg-fg/20 px-5 backdrop-blur-sm" onClick={skipIntro}>
            Skip intro
          </Button>
        </div>
      ) : null}

      {showSkipCredits && !showCountdown ? (
        <div className="absolute right-4 bottom-28 z-40 sm:right-6 sm:bottom-32" onPointerUp={(e) => e.stopPropagation()}>
          <Button variant="ghost" className="h-11 rounded-full bg-fg/20 px-5 backdrop-blur-sm" onClick={goNext}>
            Skip credits
          </Button>
        </div>
      ) : null}

      {showCountdown ? (
        <div
          className="absolute right-4 bottom-28 z-40 w-72 rounded-lg bg-surface/95 p-4 shadow-xl sm:right-6 sm:bottom-32"
          onPointerUp={(e) => e.stopPropagation()}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Next episode</p>
          <p className="mt-1 truncate font-semibold">{nextLabel ?? "Up next"}</p>
          <p className="mt-1 text-sm text-muted">Playing in {Math.max(1, Math.ceil(remaining))}s</p>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-elevated">
            <div
              className="h-full bg-accent transition-[width] duration-200"
              style={{ width: `${Math.min(100, ((15 - remaining) / 15) * 100)}%` }}
            />
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="play" size="sm" className="flex-1" onClick={goNext}>
              Play now
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setHoldNext(true)}>
              Not now
            </Button>
          </div>
        </div>
      ) : null}

      {syncState === "listening" || syncState === "tap" || syncState === "done" ? (
        <div
          className="absolute inset-x-0 top-1/3 z-40 flex justify-center px-4"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-md rounded-lg bg-surface/95 p-4 text-center shadow-xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">Sync subtitles</p>
            <p className="mt-2 text-lg font-medium">{syncMessage}</p>
            {syncState === "listening" ? (
              <div className="mx-auto mt-4 h-1 overflow-hidden rounded-full bg-elevated">
                <div className="h-full w-1/2 animate-pulse bg-accent" />
              </div>
            ) : null}
            {syncState === "tap" && tapCue ? (
              <>
                <p className="mt-3 text-base text-fg">“{tapCue.text}”</p>
                <Button className="mt-4 w-full" variant="play" onClick={confirmTap}>
                  I hear this line
                </Button>
              </>
            ) : null}
            {syncState !== "done" ? (
              <Button
                className="mt-3"
                variant="ghost"
                onClick={() => {
                  syncing.current = false;
                  setSyncState("idle");
                }}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-36 bg-linear-to-b from-bg/90 to-transparent transition-opacity duration-200",
          controls ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-linear-to-t from-bg via-bg/70 to-transparent transition-opacity duration-200",
          controls ? "opacity-100" : "opacity-0",
        )}
      />

      <div
        className={cn(
          "absolute inset-x-0 top-0 z-30 flex items-center gap-3 p-4 pt-[max(1rem,env(safe-area-inset-top))] transition-opacity duration-200 sm:p-6",
          controls || freezeControls ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        onPointerUp={(e) => e.stopPropagation()}
      >
        <Button variant="ghost" size="icon" className="bg-transparent" onClick={onBack} aria-label="Back">
          <ArrowLeft className="size-6" />
        </Button>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold sm:text-lg">{title}</p>
          {subtitle ? <p className="truncate text-sm text-muted">{subtitle}</p> : null}
        </div>
        <div className="ml-auto flex items-center gap-1">{extra}</div>
      </div>

      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-30 space-y-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] transition-opacity duration-200 sm:p-6",
          controls || freezeControls ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      >
        {audioOpen ? (
          <div className="mb-3 max-h-72 overflow-y-auto rounded-lg bg-surface/95 p-3 shadow-xl ring-1 ring-fg/10 sm:max-w-md">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Audio</p>
              {audioTracks.length > 1 ? (
                <p className="text-xs text-muted">{audioTracks.length} tracks</p>
              ) : null}
            </div>
            {audioTracks.length === 0 ? (
              <p className="text-sm text-muted">This source has a single soundtrack.</p>
            ) : (
              <div className="grid gap-1">
                {audioTracks.map((track) => {
                  const on = selectedAudio === track.index;
                  const cinema = isCinemaAudio(track);
                  return (
                    <button
                      type="button"
                      key={track.id}
                      onClick={() => selectAudioTrack(track.index)}
                      className={cn(
                        "flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-left",
                        on ? "bg-fg text-bg" : "bg-elevated text-fg",
                      )}
                    >
                      <span className="grid size-5 shrink-0 place-items-center">
                        {on ? <Check className="size-4" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{audioTrackTitle(track)}</span>
                        <span className={cn("block truncate text-xs", on ? "text-bg/70" : "text-muted")}>
                          {audioTrackMeta(track, usingEngine)}
                        </span>
                      </span>
                      {cinema && !usingEngine ? (
                        <span className={cn("shrink-0 text-2xs font-semibold uppercase tracking-wide", on ? "text-bg/70" : "text-subtle")}>
                          May be silent
                        </span>
                      ) : null}
                      {cinema && usingEngine ? (
                        <span className={cn("shrink-0 text-2xs font-semibold uppercase tracking-wide", on ? "text-bg/70" : "text-subtle")}>
                          Converted
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
            {usingEngine ? (
              <p className="mt-2 text-xs text-muted">
                Atmos, DTS, and AC3 play here as AAC stereo. Changing tracks restarts from this position.
              </p>
            ) : cinemaSelected ? (
              <p className="mt-2 text-xs text-muted">
                Atmos, DTS, and AC3 often stay silent in the browser. Pick AAC or Stereo if this source has one.
              </p>
            ) : (
              <p className="mt-2 text-xs text-subtle">English is picked first. A opens this menu. [ and ] cycle tracks.</p>
            )}
          </div>
        ) : null}
        {captionsOpen ? (
          <div className="mb-3 max-h-80 overflow-y-auto rounded-lg bg-surface/95 p-3 shadow-xl ring-1 ring-fg/10 sm:max-w-lg">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Subtitles</p>
              <p className="text-xs text-muted">{formatOffset(offset)}</p>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedSub(null);
                  onSubtitleChange?.(null);
                }}
                className={cn(
                  "h-11 rounded-full px-3 text-sm",
                  !selectedSub ? "bg-fg text-bg" : "bg-elevated text-muted",
                )}
              >
                Off
              </button>
              {subtitles.map((sub) => (
                <button
                  type="button"
                  key={sub.id ?? sub.url}
                  onClick={() => {
                    setSelectedSub(sub);
                    setOffset(0);
                    onSubtitleChange?.(sub.lang ?? sub.language ?? null);
                  }}
                  className={cn(
                    "h-11 rounded-full px-3 text-sm",
                    selectedSub?.url === sub.url ? "bg-fg text-bg" : "bg-elevated text-muted",
                  )}
                >
                  {subtitleLabel(sub)}
                </button>
              ))}
            </div>
            {subtitles.length === 0 ? (
              <p className="mb-3 text-sm text-muted">
                No subtitle add-ons returned a track. OpenSubtitles is installed by default for IMDb titles.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="muted"
                size="sm"
                onClick={() => setOffset((v) => Math.round((v - 0.1) * 20) / 20)}
                disabled={!selectedSub}
              >
                −0.1s
              </Button>
              <Button
                variant="muted"
                size="sm"
                onClick={() => setOffset((v) => Math.round((v - 0.5) * 20) / 20)}
                disabled={!selectedSub}
              >
                −0.5s
              </Button>
              <Button
                variant="accent"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  void runSync();
                }}
                disabled={!selectedSub || cues.length === 0}
              >
                Sync subtitles
              </Button>
              <Button
                variant="muted"
                size="sm"
                onClick={() => setOffset((v) => Math.round((v + 0.5) * 20) / 20)}
                disabled={!selectedSub}
              >
                +0.5s
              </Button>
              <Button
                variant="muted"
                size="sm"
                onClick={() => setOffset((v) => Math.round((v + 0.1) * 20) / 20)}
                disabled={!selectedSub}
              >
                +0.1s
              </Button>
            </div>
            <div className="mt-3 grid gap-2">
              <StudioRow label="Size">
                {(["s", "m", "l", "xl"] as SubtitleSize[]).map((id) => (
                  <StudioChip key={id} on={subtitleSize === id} onClick={() => useSettingsStore.getState().setSubtitleSize(id)}>
                    {id.toUpperCase()}
                  </StudioChip>
                ))}
              </StudioRow>
              <StudioRow label="Box">
                {(["off", "dim", "solid"] as SubtitleBox[]).map((id) => (
                  <StudioChip key={id} on={subtitleBox === id} onClick={() => useSettingsStore.getState().setSubtitleBox(id)}>
                    {id}
                  </StudioChip>
                ))}
              </StudioRow>
              <StudioRow label="Position">
                {(["low", "mid", "high"] as SubtitlePos[]).map((id) => (
                  <StudioChip key={id} on={subtitlePos === id} onClick={() => useSettingsStore.getState().setSubtitlePos(id)}>
                    {id}
                  </StudioChip>
                ))}
              </StudioRow>
            </div>
            {subtitles.length > 1 ? (
              <div className="mt-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Dual subtitles</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSecondSub(null)}
                    className={cn("h-11 rounded-full px-3 text-sm", !secondSub ? "bg-fg text-bg" : "bg-elevated text-muted")}
                  >
                    Off
                  </button>
                  {subtitles
                    .filter((sub) => sub.url !== selectedSub?.url)
                    .map((sub) => (
                      <button
                        type="button"
                        key={`dual-${sub.id ?? sub.url}`}
                        onClick={() => setSecondSub(sub)}
                        className={cn(
                          "h-11 rounded-full px-3 text-sm",
                          secondSub?.url === sub.url ? "bg-fg text-bg" : "bg-elevated text-muted",
                        )}
                      >
                        {subtitleLabel(sub)}
                      </button>
                    ))}
                </div>
              </div>
            ) : null}
            <p className="mt-2 text-xs text-subtle">Listens to the audio and lines the text up. G / H nudges 0.1s.</p>
          </div>
        ) : null}

        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(time, duration || time)}
          aria-label="Seek"
          className="player-scrubber"
          style={{
            background: `linear-gradient(to right, var(--color-accent) ${duration > 0 ? Math.min(100, (time / duration) * 100) : 0}%, color-mix(in oklab, var(--color-fg) 22%, transparent) ${duration > 0 ? Math.min(100, (time / duration) * 100) : 0}%)`,
          }}
          onChange={(e) => {
            const next = Number(e.target.value);
            seekMedia(next);
            bumpControls();
          }}
        />
        <div className="flex flex-wrap items-center gap-1 sm:gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            className="bg-transparent"
            onClick={() => {
              togglePlay();
              bumpControls();
            }}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause className="size-5 fill-current" /> : <Play className="size-5 fill-current" />}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="bg-transparent"
            onClick={() => {
              seekMedia(mediaTime() - 10, true);
              bumpControls();
            }}
            aria-label="Back 10 seconds"
          >
            <SkipBack className="size-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="bg-transparent"
            onClick={() => {
              seekMedia(mediaTime() + 10, true);
              bumpControls();
            }}
            aria-label="Forward 10 seconds"
          >
            <SkipForward className="size-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="bg-transparent"
            onClick={() => {
              const video = videoRef.current;
              if (needsSound || playerMuted || video?.muted) unlockSound();
              else {
                setPlayerMuted(true);
                if (video) video.muted = true;
              }
              bumpControls();
            }}
            aria-label={playerMuted || needsSound ? "Unmute" : "Mute"}
          >
            {playerMuted || volume === 0 || needsSound ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
          </Button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={playerMuted || needsSound ? 0 : volume}
            aria-label="Volume"
            className="h-2 w-16 cursor-pointer appearance-none bg-fg/20 accent-fg sm:w-24"
            onChange={(e) => {
              const v = Number(e.target.value);
              if (v > 0) unlockSound();
              useSettingsStore.getState().setVolume(v);
              bumpControls();
            }}
          />
          <span className="ml-1 text-xs tabular-nums text-muted sm:text-sm">
            {formatTime(time)} / {formatTime(duration)}
          </span>
          <span className="ml-auto" />
          {cues.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="bg-transparent"
              onClick={(e) => {
                e.stopPropagation();
                void runSync();
              }}
            >
              Sync subtitles
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size={audioTracks.length > 1 ? "sm" : "icon-sm"}
            className={cn("bg-transparent", audioOpen && "bg-fg/15")}
            aria-label={
              currentAudio ? `Audio tracks, ${audioTrackTitle(currentAudio)}` : "Audio tracks"
            }
            onClick={() => {
              setAudioOpen((v) => !v);
              setCaptionsOpen(false);
              bumpControls();
            }}
          >
            <AudioLines className="size-5" />
            {audioTracks.length > 1 ? (
              <span className="hidden text-xs font-semibold uppercase tracking-wide sm:inline">
                {shortAudioLang(currentAudio)}
              </span>
            ) : null}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn("bg-transparent", captionsOpen && "bg-fg/15")}
            aria-label="Subtitles"
            onClick={() => {
              setCaptionsOpen((v) => !v);
              setAudioOpen(false);
              bumpControls();
            }}
          >
            <Captions className="size-5" />
          </Button>
          {onNext ? (
            <Button variant="ghost" size="sm" className="bg-transparent" onClick={onNext}>
              Next{nextLabel ? ` · ${nextLabel}` : ""}
            </Button>
          ) : null}
          <select
            value={rate}
            aria-label="Playback speed"
            className="h-11 rounded-sm bg-transparent text-sm text-fg sm:h-9"
            onChange={(e) => {
              setRate(Number(e.target.value));
              bumpControls();
            }}
          >
            {[0.75, 1, 1.25, 1.5, 2].map((r) => (
              <option key={r} value={r} className="bg-surface">
                {r}x
              </option>
            ))}
          </select>
          <Button variant="ghost" size="icon-sm" className="bg-transparent" onClick={toggleFs} aria-label="Fullscreen">
            {fs ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function subSizeClass(size: SubtitleSize) {
  if (size === "s") return "text-sm sm:text-base";
  if (size === "l") return "text-xl sm:text-2xl";
  if (size === "xl") return "text-2xl sm:text-3xl";
  return "text-lg sm:text-xl";
}

function subBoxClass(box: SubtitleBox) {
  if (box === "off") return "px-1 py-0.5 [text-shadow:0_1px_2px_rgb(0_0_0_/_80%)]";
  if (box === "solid") return "rounded-sm bg-bg px-4 py-2";
  return "rounded-sm bg-bg/70 px-4 py-2 shadow-lg";
}

function audioDecodedBytes(video: HTMLVideoElement) {
  const v = video as HTMLVideoElement & {
    webkitAudioDecodedByteCount?: number;
    mozHasAudio?: boolean;
    audioTracks?: { length: number };
  };
  if (typeof v.webkitAudioDecodedByteCount === "number") return v.webkitAudioDecodedByteCount;
  if (v.audioTracks && v.audioTracks.length === 0) return 0;
  if (v.mozHasAudio === false) return 0;
  return null;
}

type NativeList = {
  length: number;
  [index: number]: { id?: string; label?: string; language?: string; enabled: boolean } | undefined;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
};

function nativeAudioList(video: HTMLVideoElement | null): NativeList {
  if (!video) return { length: 0 };
  return (video as HTMLVideoElement & { audioTracks?: NativeList }).audioTracks ?? { length: 0 };
}

function enableNativeTrack(list: NativeList, index: number) {
  for (let i = 0; i < list.length; i++) {
    const track = list[i];
    if (track) track.enabled = i === index;
  }
}

function originalTrack(): AudioChoice[] {
  return [{ id: "original", index: 0, name: "Original", lang: "", codec: "", channels: "", isDefault: true, source: "hls" }];
}

function mapHlsTracks(
  tracks: Array<{ name?: string; lang?: string; audioCodec?: string; channels?: string; default?: boolean }>,
): AudioChoice[] {
  return tracks.map((t, index) => ({
    id: `hls-${index}-${t.lang ?? t.name ?? ""}`,
    index,
    name: t.name ?? "",
    lang: t.lang ?? "",
    codec: t.audioCodec ?? "",
    channels: t.channels ?? "",
    isDefault: Boolean(t.default),
    source: "hls" as const,
  }));
}

function mapNativeTracks(list: NativeList): AudioChoice[] {
  const out: AudioChoice[] = [];
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    if (!t) continue;
    out.push({
      id: `native-${t.id ?? i}`,
      index: i,
      name: t.label ?? "",
      lang: t.language ?? "",
      codec: "",
      channels: "",
      isDefault: t.enabled,
      source: "native",
    });
  }
  return out;
}

function mapEngineTracks(tracks: DesktopAudioTrack[]): AudioChoice[] {
  return tracks.map((t) => ({
    id: `engine-${t.index}-${t.lang}-${t.codec}`,
    index: t.index,
    name: t.lang || t.codec || `Track ${t.index + 1}`,
    lang: t.lang,
    codec: t.codec,
    channels: t.channels,
    isDefault: Boolean(t.isDefault),
    source: "engine",
    cinema: t.cinema,
  }));
}

function langsMatch(value: string, wanted: string) {
  const a = value.trim().toLowerCase();
  const b = wanted.trim().toLowerCase();
  if (!a || !b) return false;
  return a === b || a.startsWith(b) || b.startsWith(a);
}

function matchAudioIndex(tracks: AudioChoice[], preferred?: string | null) {
  if (!preferred) return -1;
  return tracks.findIndex((t) => langsMatch(t.lang, preferred) || langsMatch(t.name, preferred));
}

function pickBestAudioIndex(tracks: AudioChoice[], preferred?: string | null) {
  let best = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < tracks.length; i++) {
    const score = scoreAudioTrack(tracks[i]!, preferred);
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

function scoreAudioTrack(track: AudioChoice, preferred?: string | null) {
  const blob = `${track.name} ${track.lang} ${track.codec}`.toLowerCase();
  let score = 0;
  if (isEnglishLabel(track.lang) || isEnglishLabel(track.name)) score += 100;
  if (preferred && (langsMatch(track.lang, preferred) || langsMatch(track.name, preferred))) score += 50;
  if (track.source !== "engine" && isCinemaAudio(track)) score -= 20;
  if (/mp4a|aac/.test(blob)) score += 20;
  if (track.channels === "2" || track.channels.startsWith("2.")) score += 4;
  if (track.isDefault) score += 2;
  return score;
}

function isCinemaAudio(track: AudioChoice) {
  if (track.cinema) return true;
  const blob = `${track.name} ${track.lang} ${track.codec}`.toLowerCase();
  return /ac-3|ec-3|ac3|eac3|dts|truehd|atmos/.test(blob);
}

function audioTrackTitle(track: AudioChoice) {
  const lang = displayLang(track.lang);
  const name = track.name.trim();
  if (name && !isGenericAudioName(name)) {
    if (!lang || name.toLowerCase() === lang.toLowerCase() || name.toLowerCase() === track.lang.toLowerCase()) {
      return lang || name;
    }
    return name;
  }
  return lang || (name && !isGenericAudioName(name) ? name : null) || `Track ${track.index + 1}`;
}

function isGenericAudioName(name: string) {
  const n = name.trim().toLowerCase();
  if (!n) return true;
  if (/^stream[_\s-]?\d+$/.test(n)) return true;
  if (/^(audio|default|alternate|und|main)$/.test(n)) return true;
  if (/^audio\s*\d+$/.test(n)) return true;
  return false;
}

function audioTrackMeta(track: AudioChoice, converted = false) {
  const parts = [codecShort(track.codec), channelLabel(track.channels)].filter(Boolean);
  if (track.isDefault && parts.length === 0) parts.push("Default");
  if (converted && isCinemaAudio(track)) parts.push("converted");
  else if (isCinemaAudio(track)) parts.push("cinema mix");
  return parts.join(" · ") || "Soundtrack";
}

function shortAudioLang(track?: AudioChoice) {
  if (!track) return "Audio";
  const code = (track.lang || track.name || "Audio").trim();
  if (!code) return "Audio";
  return code.slice(0, 3).toUpperCase();
}

function channelLabel(channels: string) {
  if (!channels) return null;
  const c = channels.toLowerCase();
  if (c === "2" || c.startsWith("2.")) return "Stereo";
  if (c === "6" || c.startsWith("6") || c.includes("5.1")) return "5.1";
  if (c === "8" || c.startsWith("8") || c.includes("7.1")) return "7.1";
  return `${channels} ch`;
}

function displayLang(code: string) {
  if (!code) return null;
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function codecShort(codec: string) {
  if (!codec) return null;
  const c = codec.toLowerCase();
  if (c.includes("mp4a") || c.includes("aac")) return "AAC";
  if (c.includes("atmos")) return "Atmos";
  if (c.includes("ec-3") || c.includes("eac3")) return "E-AC3";
  if (c.includes("ac-3") || c.includes("ac3")) return "AC3";
  if (c.includes("truehd")) return "TrueHD";
  if (c.includes("dts")) return "DTS";
  if (c.includes("opus")) return "Opus";
  return null;
}

function StudioRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-16 text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
      {children}
    </div>
  );
}

function StudioChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("h-8 rounded-full px-2.5 text-xs font-semibold uppercase tracking-wide", on ? "bg-fg text-bg" : "bg-elevated text-muted")}
    >
      {children}
    </button>
  );
}

export function YouTubePlayer({
  ytId,
  title,
  subtitle,
  onBack,
  extra,
}: {
  ytId: string;
  title: string;
  subtitle?: string;
  onBack: () => void;
  extra?: ReactNode;
}) {
  const [active, setActive] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="relative h-dvh w-full bg-bg">
      {active ? (
        <iframe
          title={title}
          className="relative z-0 size-full"
          src={`https://www.youtube.com/embed/${encodeURIComponent(ytId)}?autoplay=1&mute=0&playsinline=1&rel=0&enablejsapi=1&origin=${encodeURIComponent(origin)}`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      ) : (
        <>
          <img
            src={`https://i.ytimg.com/vi/${encodeURIComponent(ytId)}/hqdefault.jpg`}
            alt=""
            className="size-full object-cover opacity-50"
          />
          <button
            type="button"
            className="absolute inset-0 z-30 grid place-items-center"
            onClick={() => {
              unlockMediaPlayback();
              playArmed = true;
              setActive(true);
            }}
          >
            <span className="flex items-center gap-3 rounded-full bg-fg px-8 py-4 text-lg font-semibold text-bg shadow-xl">
              <Play className="size-6 fill-current" />
              Play with sound
            </span>
          </button>
        </>
      )}
      <div className="pointer-events-none absolute top-0 inset-x-0 z-10 h-24 bg-linear-to-b from-bg/80 to-transparent" />
      <div className="absolute top-0 inset-x-0 z-40 flex items-center gap-3 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <Button variant="ghost" size="icon" className="bg-bg/70" onClick={onBack} aria-label="Back">
          <ArrowLeft className="size-6" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{title}</p>
          {subtitle ? <p className="truncate text-sm text-muted">{subtitle}</p> : null}
        </div>
        {extra}
      </div>
    </div>
  );
}

export function streamKey(stream: Stream) {
  return stream.url || stream.ytId || stream.infoHash || stream.externalUrl || stream.name || "stream";
}
