import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { List } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { StreamPicker } from "@/components/player/stream-picker";
import { streamKey, VideoPlayer, YouTubePlayer } from "@/components/player/video-player";
import {
  defaultVideoId,
  fetchMeta,
  fetchStreams,
  fetchSubtitles,
  firstPlayableStream,
  isWebPlayable,
  magnetFromStream,
  mergeSubtitles,
  nextVideoId,
  pickRememberedStream,
  rankStreams,
  streamKind,
  videoTitle,
} from "@/lib/stremio/client";
import { streamQuality } from "@/lib/stremio/subtitles";
import { playableStreams, streamFlags } from "@/lib/stremio/stream-rank";
import type { Stream } from "@/lib/stremio/types";
import { useEnabledAddons } from "@/stores/addons";
import { useLibraryStore } from "@/stores/library";
import { useSettingsStore } from "@/stores/settings";
import { decodeId, unlockMediaPlayback } from "@/lib/utils";
import { desktopHasEngine } from "@/lib/desktop";

type Search = { video?: string; auto?: string };

export const Route = createFileRoute("/watch/$type/$id")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    video: typeof s.video === "string" ? s.video : undefined,
    auto: typeof s.auto === "string" ? s.auto : undefined,
  }),
  component: WatchPage,
});

function WatchPage() {
  const { type, id: rawId } = Route.useParams();
  const { video, auto } = Route.useSearch();
  const id = decodeId(rawId);
  const navigate = useNavigate();
  const addons = useEnabledAddons();
  const saveProgress = useLibraryStore((s) => s.saveProgress);
  const markWatched = useLibraryStore((s) => s.markWatched);
  const progressList = useLibraryStore((s) => s.progress);
  const prefs = useLibraryStore((s) => s.prefs);
  const savePref = useLibraryStore((s) => s.savePref);
  const autoplayNext = useSettingsStore((s) => s.autoplayNext);
  const skipIntros = useSettingsStore((s) => s.skipIntros);
  const rememberStream = useSettingsStore((s) => s.rememberStream);
  const playbackRate = useSettingsStore((s) => s.playbackRate);
  const subtitleMode = useSettingsStore((s) => s.subtitles);
  const pref = prefs[id];
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    setDesktop(desktopHasEngine());
  }, []);

  const metaQuery = useQuery({
    queryKey: ["meta", type, id, addons.map((a) => a.transportUrl).join("|")],
    queryFn: () => fetchMeta(addons, type, id),
  });

  const meta = metaQuery.data;
  const videoId = video || (meta ? defaultVideoId(meta) : id);

  const streamQuery = useQuery({
    queryKey: ["streams", type, videoId, addons.map((a) => a.transportUrl).join("|")],
    enabled: Boolean(videoId),
    queryFn: () => fetchStreams(addons, type, videoId),
  });

  const subtitleQuery = useQuery({
    queryKey: ["subtitles", type, videoId, addons.map((a) => a.transportUrl).join("|")],
    enabled: Boolean(videoId),
    queryFn: () => fetchSubtitles(addons, type, videoId),
    staleTime: 300_000,
  });

  const ranked = useMemo(
    () => rankStreams(streamQuery.data ?? [], { desktop }),
    [streamQuery.data, desktop],
  );
  const [picked, setPicked] = useState<string | null>(null);
  const [showList, setShowList] = useState(true);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const failedKeys = useRef(new Set<string>());

  useEffect(() => {
    setPicked(null);
    setShowList(true);
    setStatusNote(null);
    failedKeys.current = new Set();
  }, [videoId]);

  useEffect(() => {
    if (auto !== "1" || streamQuery.isLoading || picked) return;
    const match =
      (rememberStream ? pickRememberedStream(ranked, pref, { desktop }) : null) ?? firstPlayableStream(ranked);
    if (!match) return;
    setPicked(streamKey(match));
    setShowList(false);
  }, [auto, ranked, streamQuery.isLoading, picked, pref, rememberStream, desktop]);

  const selected = ranked.find((s) => streamKey(s) === picked) ?? null;
  const tracks = useMemo(
    () => mergeSubtitles(subtitleQuery.data ?? [], selected?.subtitles),
    [subtitleQuery.data, selected?.subtitles],
  );
  const preferred = pickRememberedStream(ranked, pref, { desktop });

  const episode = meta?.videos?.find((v) => v.id === videoId);
  const nextId = meta ? nextVideoId(meta, videoId) : null;
  const nextEp = meta?.videos?.find((v) => v.id === nextId);
  const stored = progressList.find((p) => p.id === id && p.videoId === videoId);
  const progressRatio = stored && stored.duration > 0 ? stored.position / stored.duration : 0;

  const nextStreamQuery = useQuery({
    queryKey: ["streams", type, nextId, addons.map((a) => a.transportUrl).join("|")],
    enabled: Boolean(nextId),
    queryFn: () => fetchStreams(addons, type, nextId!),
    staleTime: 180_000,
  });
  const nextSubtitlesQuery = useQuery({
    queryKey: ["subtitles", type, nextId, addons.map((a) => a.transportUrl).join("|")],
    enabled: Boolean(nextId) && progressRatio > 0.4,
    queryFn: () => fetchSubtitles(addons, type, nextId!),
    staleTime: 300_000,
  });
  const nextPreloadUrl = useMemo(() => {
    const nextRanked = rankStreams(nextStreamQuery.data ?? [], { desktop });
    const match =
      (rememberStream ? pickRememberedStream(nextRanked, pref, { desktop }) : null) ?? firstPlayableStream(nextRanked);
    return match?.url;
  }, [nextStreamQuery.data, pref, rememberStream, nextSubtitlesQuery.data, desktop]);

  const title = meta?.name ?? "Loading";
  const episodeLabel = episode
    ? `${episode.season ? `S${episode.season} E${episode.episode ?? episode.number}` : ""} ${videoTitle(episode)}`.trim()
    : undefined;

  function goBack() {
    void navigate({ to: "/title/$type/$id", params: { type, id: rawId } });
  }

  function playVideo(nextVideo: string, binge = true) {
    void navigate({
      to: "/watch/$type/$id",
      params: { type, id: rawId },
      search: { video: nextVideo, auto: binge ? "1" : undefined },
    });
  }

  function onProgress(position: number, duration: number) {
    if (!meta) return;
    saveProgress({
      type: meta.type,
      id: meta.id,
      videoId,
      name: meta.name,
      poster: meta.poster,
      background: meta.background,
      season: episode?.season,
      episode: episode?.episode ?? episode?.number,
      episodeName: episode ? videoTitle(episode) : undefined,
      position,
      duration,
      updatedAt: Date.now(),
    });
  }

  function remember(stream: Stream) {
    savePref(id, {
      bingeGroup: stream.behaviorHints?.bingeGroup,
      addonId: stream.addonId,
      addonName: stream.addonName,
      quality: streamQuality(stream) ?? undefined,
      streamKey: streamKey(stream),
    });
  }

  function onPick(stream: Stream) {
    unlockMediaPlayback();
    const kind = streamKind(stream);
    if (kind === "external" && stream.externalUrl) {
      window.open(stream.externalUrl, "_blank", "noreferrer");
      return;
    }
    if (kind === "torrent") {
      const magnet = magnetFromStream(stream);
      if (magnet) window.location.href = magnet;
      return;
    }
    remember(stream);
    setPicked(streamKey(stream));
    setShowList(false);
  }

  function tryNextStream(opts?: { silent?: boolean }) {
    if (picked) failedKeys.current.add(picked);
    let playable = playableStreams(ranked).filter((s) => !failedKeys.current.has(streamKey(s)));
    if (opts?.silent && !desktop) {
      const safe = playable.filter((s) => !streamFlags(s).cinemaAudio);
      if (safe.length) playable = safe;
    }
    const fallback = playable[0];
    if (!fallback) {
      setShowList(true);
      setPicked(null);
      setStatusNote(
        opts?.silent
          ? desktop
            ? "That source still had no sound. Pick another stream."
            : "That source had no sound the browser can play. Pick a stream marked AAC."
          : "Every source failed. Pick another stream.",
      );
      return;
    }
    const flags = streamFlags(fallback);
    const label = [fallback.addonName, streamQuality(fallback), flags.cached ? "Cached" : flags.debrid ? "Debrid" : null]
      .filter(Boolean)
      .join(" · ");
    setStatusNote(opts?.silent ? `No sound on that source. Switching to ${label}` : `Switching to ${label}`);
    setPicked(streamKey(fallback));
    window.setTimeout(() => setStatusNote(null), 4000);
  }

  if (metaQuery.isLoading) {
    return (
      <div className="grid h-dvh place-items-center bg-bg">
        <div className="text-center">
          <div className="mx-auto mb-4 size-12 animate-spin rounded-full border-2 border-fg/20 border-t-accent" />
          <p className="text-lg font-semibold">{title}</p>
          <p className="text-sm text-muted">Loading title…</p>
        </div>
      </div>
    );
  }

  if (showList || !selected) {
    return (
      <StreamPicker
        title={title}
        subtitle={episodeLabel}
        background={meta?.background}
        poster={meta?.poster}
        streams={ranked}
        loading={streamQuery.isLoading}
        selectedKey={picked}
        preferredKey={rememberStream && preferred ? streamKey(preferred) : null}
        addonCount={addons.filter((a) => a.enabled).length}
        onBack={goBack}
        onPick={onPick}
      />
    );
  }

  const kind = streamKind(selected);
  const extra = (
    <Button variant="ghost" size="sm" className="bg-transparent" onClick={() => setShowList(true)}>
      <List className="size-4" />
      Streams
    </Button>
  );

  if (kind === "youtube" && selected.ytId) {
    return (
      <YouTubePlayer
        ytId={selected.ytId}
        title={title}
        subtitle={episodeLabel}
        onBack={goBack}
        extra={extra}
      />
    );
  }

  if ((kind === "http" || kind === "hls") && selected.url && isWebPlayable(selected)) {
    return (
      <>
        <NextEpisodePreload url={nextPreloadUrl} active={progressRatio > 0.5} />
        <VideoPlayer
        key={picked ?? selected.url}
        src={selected.url}
        kind={kind}
        title={title}
        subtitle={episodeLabel}
        poster={meta?.background || meta?.poster}
        startAt={stored && stored.position > 8 ? stored.position : 0}
        subtitles={tracks}
        preferredLang={subtitleMode === "en" ? "eng" : subtitleMode === "last" ? pref?.subtitleLang : undefined}
        preferredAudioLang="eng"
        isEpisode={type === "series" || Boolean(episode)}
        introSkipTo={pref?.introSkipTo}
        autoplayNext={autoplayNext && Boolean(nextId)}
        skipIntros={skipIntros}
        defaultRate={playbackRate}
        captionsDefault={subtitleMode !== "off"}
        onBack={goBack}
        onProgress={onProgress}
        onEnded={() => markWatched(videoId)}
        nextLabel={nextEp ? videoTitle(nextEp) : undefined}
        onNext={nextId ? () => playVideo(nextId) : undefined}
        onIntroSkip={(to) => savePref(id, { introSkipTo: to })}
        onSubtitleChange={(lang) => {
          if (lang) savePref(id, { subtitleLang: lang });
        }}
        onAudioChange={(lang) => {
          if (lang) savePref(id, { audioLang: lang });
        }}
        onPlaybackError={() => tryNextStream()}
        onSilentAudio={() => tryNextStream({ silent: true })}
        onStable={() => remember(selected)}
        statusNote={statusNote}
        extra={extra}
      />
      </>
    );
  }

  return (
    <StreamPicker
      title={title}
      subtitle={episodeLabel}
      background={meta?.background}
      poster={meta?.poster}
      streams={ranked}
      selectedKey={picked}
      preferredKey={preferred ? streamKey(preferred) : null}
      addonCount={addons.filter((a) => a.enabled).length}
      onBack={goBack}
      onPick={onPick}
    />
  );
}

function NextEpisodePreload({ url, active }: { url?: string; active: boolean }) {
  useEffect(() => {
    if (!url || !active) return;
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    video.load();
    return () => {
      video.removeAttribute("src");
      video.load();
    };
  }, [url, active]);
  return null;
}
