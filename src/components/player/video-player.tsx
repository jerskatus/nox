import {
  ArrowLeft,
  Captions,
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
import { cn, formatTime } from "@/lib/utils";

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
  onPlaybackError?: () => void;
  extra?: ReactNode;
};

type SyncState = "idle" | "listening" | "tap" | "done";

export function VideoPlayer({
  src,
  kind,
  title,
  subtitle,
  poster,
  startAt = 0,
  subtitles = [],
  preferredLang,
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
  onPlaybackError,
  extra,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | null>(null);
  const graphRef = useRef<{ ctx: AudioContext; analyser: AnalyserNode } | null>(null);
  const syncing = useRef(false);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [fs, setFs] = useState(false);
  const [controls, setControls] = useState(true);
  const [waiting, setWaiting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rate, setRate] = useState(defaultRate);
  const [captionsOpen, setCaptionsOpen] = useState(false);
  const [selectedSub, setSelectedSub] = useState<Subtitle | null>(() =>
    captionsDefault ? preferSubtitle(subtitles, preferredLang) : null,
  );
  const [cues, setCues] = useState<Cue[]>([]);
  const [offset, setOffset] = useState(0);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [syncMessage, setSyncMessage] = useState("");
  const [tapCue, setTapCue] = useState<Cue | null>(null);
  const [skippedIntro, setSkippedIntro] = useState(false);
  const [holdNext, setHoldNext] = useState(false);
  const nextLock = useRef(false);
  const started = useRef(false);
  const startAtRef = useRef(startAt);
  const waitingRef = useRef(waiting);
  waitingRef.current = waiting;
  const freezeControls = captionsOpen || syncState === "listening" || syncState === "tap";
  const subKey = subtitles.map((s) => s.url).join("|");

  const bumpControls = useCallback(() => {
    setControls(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    if (freezeControls) return;
    hideTimer.current = window.setTimeout(() => {
      const video = videoRef.current;
      if (!video || video.paused || video.ended || waitingRef.current) return;
      setControls(false);
    }, 3200);
  }, [freezeControls]);

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
    video.currentTime = Math.min(to, Math.max(0, (video.duration || to) - 1));
    setSkippedIntro(true);
    onIntroSkip?.(to);
  }, [skipIntros, skippedIntro, time, duration, introSkipTo, onIntroSkip]);

  useEffect(() => {
    setSelectedSub(captionsDefault ? preferSubtitle(subtitles, preferredLang) : null);
    setOffset(0);
    setSyncState("idle");
  }, [subKey, subtitles, preferredLang, captionsDefault]);

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
    const video = videoRef.current;
    if (!video) return;
    setError(null);
    setWaiting(true);
    started.current = false;
    let cancelled = false;
    const holder: { hls: { destroy: () => void } | null } = { hls: null };

    if (kind === "hls") {
      void import("hls.js").then(({ default: Hls }) => {
        if (cancelled || !videoRef.current) return;
        if (Hls.isSupported()) {
          const instance = new Hls({ enableWorker: true, maxBufferLength: 30 });
          instance.loadSource(src);
          instance.attachMedia(videoRef.current);
          instance.on(Hls.Events.ERROR, (_e, data) => {
            if (data.fatal) setError("This stream could not be played.");
          });
          holder.hls = instance;
        } else {
          video.src = src;
        }
      });
    } else {
      video.src = src;
    }

    const onReady = () => {
      if (!started.current && startAtRef.current > 1) {
        video.currentTime = startAtRef.current;
        started.current = true;
      }
      void video.play().catch(() => setPlaying(false));
    };
    video.addEventListener("loadedmetadata", onReady);
    return () => {
      cancelled = true;
      video.removeEventListener("loadedmetadata", onReady);
      holder.hls?.destroy();
      video.removeAttribute("src");
      video.load();
      if (graphRef.current) {
        void graphRef.current.ctx.close().catch(() => undefined);
        graphRef.current = null;
      }
    };
  }, [src, kind]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
    video.volume = volume;
    video.muted = muted;
  }, [rate, volume, muted]);

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
          if (video.paused) void video.play();
          else video.pause();
          break;
        case "ArrowLeft":
        case "j":
          event.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 10);
          break;
        case "ArrowRight":
        case "l":
          event.preventDefault();
          video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
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
          break;
        case "f":
          event.preventDefault();
          toggleFs();
          break;
        case "m":
          event.preventDefault();
          setMuted((v) => !v);
          break;
        case "Escape":
          if (captionsOpen || syncState !== "idle") {
            setCaptionsOpen(false);
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
  }, [bumpControls, onBack, captionsOpen, syncState]);

  function toggleFs() {
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void wrap.requestFullscreen();
  }

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  }

  function onSurfacePointer(event: PointerEvent<HTMLDivElement>) {
    bumpControls();
    if (event.pointerType === "mouse" && event.type === "pointermove") return;
    if (event.type !== "pointerup") return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (freezeControls) return;
    togglePlay();
  }

  function ensureAnalyser(video: HTMLVideoElement) {
    if (graphRef.current) return graphRef.current;
    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaElementSource(video);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyser.connect(ctx.destination);
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
    setCaptionsOpen(true);
    setSyncState("listening");
    setSyncMessage("Listening to the stream…");
    bumpControls();

    const next = upcomingCue(cues, video.currentTime, offset);
    if (next && next.start - (video.currentTime + offset) > 10) {
      video.currentTime = Math.max(0, next.start - 1.6);
    }
    if (video.paused) void video.play().catch(() => undefined);

    const graph = ensureAnalyser(video);
    if (graph?.ctx.state === "suspended") await graph.ctx.resume().catch(() => undefined);

    const raw: Array<{ t: number; rms: number }> = [];
    const startedAt = performance.now();
    while (performance.now() - startedAt < 8000 && syncing.current) {
      raw.push({ t: video.currentTime, rms: graph ? readRms(graph.analyser) : 0 });
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
      const cue = upcomingCue(cues, video.currentTime, offset);
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
    const next = Math.round((tapCue.start - video.currentTime) * 20) / 20;
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
    video.currentTime = Math.min(to, Math.max(0, (video.duration || to) - 1));
    setSkippedIntro(true);
    onIntroSkip?.(to);
    bumpControls();
  }

  function goNext() {
    if (!onNext || nextLock.current) return;
    nextLock.current = true;
    onNext();
  }

  return (
    <div
      ref={wrapRef}
      className="relative h-dvh w-full overflow-hidden bg-bg touch-manipulation"
      onPointerMove={onSurfacePointer}
      onPointerUp={onSurfacePointer}
    >
      <video
        ref={videoRef}
        className="size-full object-contain"
        poster={poster}
        playsInline
        autoPlay
        onPlay={() => {
          setPlaying(true);
          setWaiting(false);
        }}
        onPause={() => {
          setPlaying(false);
          setControls(true);
        }}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onTimeUpdate={() => {
          const video = videoRef.current;
          if (!video) return;
          setTime(video.currentTime);
          onProgress(video.currentTime, video.duration || 0);
        }}
        onDurationChange={() => setDuration(videoRef.current?.duration || 0)}
        onEnded={() => {
          onEnded?.();
          if (autoplayNext && onNext && !holdNext && !nextLock.current) {
            nextLock.current = true;
            onNext();
          }
        }}
        onError={() => {
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
            <Button variant="ghost" onClick={onBack}>
              Go back
            </Button>
          </div>
        </div>
      ) : null}

      {shown ? (
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 z-20 flex justify-center px-6 text-center transition-[bottom] duration-200",
            controls ? "bottom-28 sm:bottom-32" : "bottom-10",
          )}
        >
          <p className="max-w-3xl rounded-sm bg-bg/70 px-4 py-2 text-lg font-medium leading-snug text-fg shadow-lg sm:text-xl">
            {shown.text}
          </p>
        </div>
      ) : null}

      {showSkipIntro ? (
        <div className="absolute right-4 bottom-28 z-40 sm:right-6 sm:bottom-32" onPointerUp={(e) => e.stopPropagation()}>
          <Button variant="ghost" className="h-11 rounded-md bg-fg/20 px-5 backdrop-blur-sm" onClick={skipIntro}>
            Skip intro
          </Button>
        </div>
      ) : null}

      {showSkipCredits && !showCountdown ? (
        <div className="absolute right-4 bottom-28 z-40 sm:right-6 sm:bottom-32" onPointerUp={(e) => e.stopPropagation()}>
          <Button variant="ghost" className="h-11 rounded-md bg-fg/20 px-5 backdrop-blur-sm" onClick={goNext}>
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
          onPointerUp={(e) => e.stopPropagation()}
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
          "pointer-events-none absolute inset-0 bg-linear-to-t from-bg via-transparent to-bg/50 transition-opacity duration-200",
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
        onPointerUp={(e) => e.stopPropagation()}
      >
        {captionsOpen ? (
          <div className="mb-2 max-h-56 overflow-y-auto rounded-md bg-surface/95 p-3">
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
                  "h-9 rounded-sm px-3 text-sm",
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
                    "h-9 rounded-sm px-3 text-sm",
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
                onClick={() => setOffset((v) => Math.round((v - 0.5) * 20) / 20)}
                disabled={!selectedSub}
              >
                −0.5s
              </Button>
              <Button variant="accent" size="sm" onClick={() => void runSync()} disabled={!selectedSub || cues.length === 0}>
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
            </div>
            <p className="mt-2 text-xs text-subtle">Listens to the audio and lines the text up. G / H nudges 0.1s.</p>
          </div>
        ) : null}

        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={time}
          aria-label="Seek"
          className="h-2 w-full cursor-pointer appearance-none bg-fg/20 accent-accent"
          onChange={(e) => {
            const next = Number(e.target.value);
            const video = videoRef.current;
            if (video) video.currentTime = next;
            setTime(next);
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
              const video = videoRef.current;
              if (video) video.currentTime = Math.max(0, video.currentTime - 10);
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
              const video = videoRef.current;
              if (video) video.currentTime = Math.min(duration, video.currentTime + 10);
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
              setMuted((v) => !v);
              bumpControls();
            }}
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted || volume === 0 ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
          </Button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            aria-label="Volume"
            className="hidden h-2 w-24 cursor-pointer appearance-none bg-fg/20 accent-fg sm:block"
            onChange={(e) => {
              const v = Number(e.target.value);
              setVolume(v);
              setMuted(v === 0);
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
              onClick={() => {
                setCaptionsOpen(true);
                void runSync();
              }}
            >
              Sync subtitles
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn("bg-transparent", captionsOpen && "bg-fg/20")}
            aria-label="Subtitles"
            onClick={() => {
              setCaptionsOpen((v) => !v);
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
  return (
    <div className="relative h-dvh w-full bg-bg">
      <iframe
        title={title}
        className="relative z-0 size-full"
        src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(ytId)}?autoplay=1&rel=0`}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
      />
      <div className="pointer-events-none absolute top-0 inset-x-0 z-10 h-24 bg-linear-to-b from-bg/80 to-transparent" />
      <div className="absolute top-0 inset-x-0 z-20 flex items-center gap-3 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
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
