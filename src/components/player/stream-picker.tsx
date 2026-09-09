import { ArrowLeft, ExternalLink, Languages, Magnet, Play, Puzzle, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { streamKind } from "@/lib/stremio/client";
import { streamFlags, streamSpokenFlags, streamSpokenLabel } from "@/lib/stremio/stream-rank";
import { FlagRow } from "./audio-flags";
import { streamDetailLines, streamQuality, streamSizeLabel } from "@/lib/stremio/subtitles";
import type { Stream } from "@/lib/stremio/types";
import { cn } from "@/lib/utils";
import { desktopHasEngine } from "@/lib/desktop";
import { streamKey } from "./video-player";

type Props = {
  title: string;
  subtitle?: string;
  background?: string;
  poster?: string;
  streams: Stream[];
  loading?: boolean;
  selectedKey?: string | null;
  preferredKey?: string | null;
  addonCount: number;
  onBack: () => void;
  onPick: (stream: Stream) => void;
};

export function StreamPicker({
  title,
  subtitle,
  background,
  poster,
  streams,
  loading,
  selectedKey,
  preferredKey,
  addonCount,
  onBack,
  onPick,
}: Props) {
  const { english, other } = partitionByAudio(streams);
  const groups = groupStreams(english);
  const otherLangs = groupByLanguage(other);
  const playable = english.filter((s) => streamKind(s) === "http" || streamKind(s) === "hls" || streamKind(s) === "youtube");
  const preferred = preferredKey ? english.find((s) => streamKey(s) === preferredKey) : null;
  const best = playable.slice(0, 8);

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-bg">
      {background || poster ? (
        <img src={background || poster} alt="" className="absolute inset-0 size-full object-cover opacity-40" />
      ) : null}
      <div className="absolute inset-0 bg-linear-to-t from-bg via-bg/88 to-bg/55" />
      <div className="relative mx-auto flex min-h-dvh max-w-3xl flex-col px-4 py-6 sm:px-8">
        <div className="mb-6 flex items-start gap-3">
          <Button variant="ghost" size="icon" className="rounded-full bg-transparent" onClick={onBack} aria-label="Back">
            <ArrowLeft className="size-6" />
          </Button>
          <div className="min-w-0 pt-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Choose a stream</p>
            <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
            {subtitle ? <p className="truncate text-sm text-muted">{subtitle}</p> : null}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24">
            <div className="size-12 animate-spin rounded-full border-2 border-fg/20 border-t-accent" />
            <p className="font-medium">Asking your add-ons for streams…</p>
            <p className="text-sm text-muted">
              {addonCount} add-on{addonCount === 1 ? "" : "s"} queried
            </p>
          </div>
        ) : streams.length === 0 ? (
          <div className="rounded-lg bg-surface p-6 shadow-[var(--shadow-border)]">
            <p className="font-semibold">No streams yet</p>
            <p className="mt-2 text-sm text-muted">
              Install a stream add-on from Add-ons — Torrentio, MediaFusion, Comet, AIOStreams, or any Stremio
              manifest URL. Open Collection titles always include a browser-playable file.
            </p>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted">
              {english.length} English source{english.length === 1 ? "" : "s"}
              {other.length > 0 ? ` · ${other.length} other language${other.length === 1 ? "" : "s"}` : ""}
              {desktopHasEngine() ? " · desktop plays Atmos / DTS / AC3" : " · AAC sound first"}
            </p>
            {preferred ? (
              <button
                type="button"
                onClick={() => onPick(preferred)}
                className="mb-6 flex w-full items-center gap-4 rounded-lg bg-fg px-4 py-3.5 text-left text-bg touch-manipulation"
              >
                <span className="w-16 shrink-0 sm:w-24">
                  <span className="flex items-center gap-1.5">
                    <span className="text-lg font-semibold leading-none tracking-tight tabular-nums sm:text-xl">
                      {streamQuality(preferred) ?? "Play"}
                    </span>
                    <AudioFlags stream={preferred} />
                  </span>
                  <span className="mt-1 block text-2xs font-semibold uppercase tracking-wide opacity-70">Last used</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{preferred.addonName ?? "Stream"}</span>
                  <span className="mt-0.5 block truncate text-xs opacity-70">
                    {streamSoundLine(preferred) || "Play this source again"}
                  </span>
                </span>
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-bg text-fg">
                  <Play className="ml-0.5 size-4 fill-current" />
                </span>
              </button>
            ) : null}
            <div className="flex flex-col gap-6 pb-16">
              <StreamSection
                title="Best sources"
                icon={<Zap className="size-4 text-accent" />}
                streams={best}
                selectedKey={selectedKey}
                preferredKey={preferredKey}
                onPick={onPick}
                keyPrefix="best"
              />
              {groups.map((group) => (
                <StreamSection
                  key={group.name}
                  title={group.name}
                  icon={<Puzzle className="size-4 text-muted" />}
                  count={group.streams.length}
                  streams={group.streams}
                  selectedKey={selectedKey}
                  preferredKey={preferredKey}
                  onPick={onPick}
                />
              ))}
              {otherLangs.length > 0 ? (
                <section>
                  <div className="mb-3 flex items-center gap-2 px-1">
                    <Languages className="size-4 text-muted" />
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Other languages</h2>
                    <span className="text-xs text-subtle">{other.length}</span>
                  </div>
                  <div className="flex flex-col gap-5">
                    {otherLangs.map((group) => (
                      <StreamSection
                        key={group.name}
                        title={group.name}
                        icon={<FlagRow flags={group.flags} />}
                        count={group.streams.length}
                        streams={group.streams}
                        selectedKey={selectedKey}
                        preferredKey={preferredKey}
                        onPick={onPick}
                        nested
                      />
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StreamSection({
  title,
  icon,
  count,
  streams,
  selectedKey,
  preferredKey,
  onPick,
  keyPrefix,
  nested,
}: {
  title: string;
  icon?: ReactNode;
  count?: number;
  streams: Stream[];
  selectedKey?: string | null;
  preferredKey?: string | null;
  onPick: (stream: Stream) => void;
  keyPrefix?: string;
  nested?: boolean;
}) {
  if (streams.length === 0) return null;
  return (
    <section>
      <div className="mb-2 flex items-center gap-2 px-1">
        {icon}
        <h2
          className={
            nested
              ? "text-xs font-semibold uppercase tracking-wide text-subtle"
              : "text-sm font-semibold uppercase tracking-wide text-muted"
          }
        >
          {title}
        </h2>
        {count != null ? <span className="text-xs text-subtle">{count}</span> : null}
      </div>
      <ul className="grid gap-2">
        {streams.map((stream) => (
          <StreamChoice
            key={`${keyPrefix ?? ""}${streamKey(stream)}`}
            stream={stream}
            active={selectedKey === streamKey(stream)}
            preferred={preferredKey === streamKey(stream)}
            onPick={() => onPick(stream)}
          />
        ))}
      </ul>
    </section>
  );
}

function partitionByAudio(streams: Stream[]) {
  const english: Stream[] = [];
  const other: Stream[] = [];
  for (const stream of streams) {
    if (streamFlags(stream).spoken === "foreign") other.push(stream);
    else english.push(stream);
  }
  return { english, other };
}

function groupStreams(streams: Stream[]) {
  const map = new Map<string, Stream[]>();
  for (const stream of streams) {
    const name = stream.addonName || "Other add-ons";
    const list = map.get(name) ?? [];
    list.push(stream);
    map.set(name, list);
  }
  return [...map.entries()].map(([name, list]) => ({ name, streams: list }));
}

function groupByLanguage(streams: Stream[]) {
  const map = new Map<string, Stream[]>();
  for (const stream of streams) {
    const name = streamSpokenLabel(stream) || "Other languages";
    const list = map.get(name) ?? [];
    list.push(stream);
    map.set(name, list);
  }
  return [...map.entries()]
    .map(([name, list]) => ({
      name,
      streams: list,
      flags: streamSpokenFlags(list[0]!),
    }))
    .sort((a, b) => b.streams.length - a.streams.length || a.name.localeCompare(b.name));
}

function streamSoundLine(stream: Stream) {
  const flags = streamFlags(stream);
  const bits = [
    streamSpokenLabel(stream),
    flags.aac ? "AAC" : flags.cinemaAudio ? (flags.atmos ? "Atmos" : "DD") : null,
    flags.cinemaAudio ? (desktopHasEngine() ? "plays in the app" : "silent in browser") : null,
    flags.cached ? "Cached" : flags.debrid ? "Debrid" : null,
    flags.dolbyVision ? "DV" : flags.hdr ? "HDR" : null,
  ].filter(Boolean);
  return bits.join(" · ");
}

function StreamChoice({
  stream,
  active,
  preferred,
  onPick,
}: {
  stream: Stream;
  active: boolean;
  preferred?: boolean;
  onPick: () => void;
}) {
  const kind = streamKind(stream);
  const quality = streamQuality(stream);
  const size = streamSizeLabel(stream);
  const details = streamDetailLines(stream);
  const flags = streamFlags(stream);
  const playable = kind === "http" || kind === "hls" || kind === "youtube";
  const label = stream.addonName || stream.name || details[0] || "Stream";
  const headline = quality ?? (playable ? "Play" : kind === "torrent" ? "Torrent" : kind === "external" ? "Open" : "Stream");
  const sound = streamSoundLine(stream);
  const silent = flags.cinemaAudio && !flags.aac && !desktopHasEngine();

  return (
    <li className="min-w-0">
      <button
        type="button"
        onClick={onPick}
        className={cn(
          "flex w-full min-w-0 items-center gap-3 rounded-lg px-3 py-3 text-left shadow-[var(--shadow-border)] transition-[background-color] duration-150 touch-manipulation sm:gap-4",
          active ? "bg-elevated" : "bg-surface hover:bg-elevated",
        )}
      >
        <span className="w-16 shrink-0 sm:w-24">
          <span className="flex items-center gap-1.5">
            <span className="text-lg font-semibold leading-none tracking-tight tabular-nums sm:text-xl">
              {headline}
            </span>
            <AudioFlags stream={stream} />
          </span>
          {size ? <span className="mt-1 block text-2xs text-muted">{size}</span> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium">{label}</span>
            {preferred ? (
              <span className="rounded-full bg-accent px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide text-fg">
                Last used
              </span>
            ) : null}
          </span>
          <span className={cn("mt-0.5 block truncate text-xs", silent ? "text-subtle" : "text-muted")}>
            {sound || details.slice(0, 2).join(" · ") || kind}
          </span>
        </span>
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-full",
            playable ? "bg-fg text-bg" : "bg-elevated text-fg",
          )}
        >
          {playable ? (
            <Play className="ml-0.5 size-4 fill-current" />
          ) : kind === "external" ? (
            <ExternalLink className="size-4" />
          ) : (
            <Magnet className="size-4" />
          )}
        </span>
      </button>
    </li>
  );
}

function AudioFlags({ stream }: { stream: Stream }) {
  return <FlagRow flags={streamSpokenFlags(stream)} />;
}
