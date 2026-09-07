import { ArrowLeft, ExternalLink, Magnet, Play, Puzzle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { streamKind } from "@/lib/stremio/client";
import { streamFlags } from "@/lib/stremio/stream-rank";
import { streamDetailLines, streamQuality, streamSizeLabel } from "@/lib/stremio/subtitles";
import type { Stream } from "@/lib/stremio/types";
import { cn } from "@/lib/utils";
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
  const groups = groupStreams(streams);
  const playable = streams.filter((s) => streamKind(s) === "http" || streamKind(s) === "hls" || streamKind(s) === "youtube");
  const preferred = preferredKey ? streams.find((s) => streamKey(s) === preferredKey) : null;
  const best = playable.slice(0, 8);

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-bg">
      {background || poster ? (
        <img src={background || poster} alt="" className="absolute inset-0 size-full object-cover opacity-40" />
      ) : null}
      <div className="absolute inset-0 bg-linear-to-t from-bg via-bg/85 to-bg/50" />
      <div className="relative mx-auto flex min-h-dvh max-w-3xl flex-col px-4 py-6 sm:px-8">
        <div className="mb-6 flex items-start gap-3">
          <Button variant="ghost" size="icon" className="bg-transparent" onClick={onBack} aria-label="Back">
            <ArrowLeft className="size-6" />
          </Button>
          <div className="min-w-0 pt-1">
            <p className="text-xs uppercase tracking-wide text-muted">Choose a stream</p>
            <h1 className="truncate text-2xl font-semibold">{title}</h1>
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
          <div className="rounded-lg bg-surface p-6">
            <p className="font-semibold">No streams yet</p>
            <p className="mt-2 text-sm text-muted">
              Install a stream add-on from Add-ons — Torrentio, MediaFusion, Comet, AIOStreams, or any Stremio
              manifest URL. Open Collection titles always include a browser-playable file.
            </p>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted">
              {streams.length} source{streams.length === 1 ? "" : "s"} · {playable.length} play in the browser · cached first
            </p>
            {preferred ? (
              <button
                type="button"
                onClick={() => onPick(preferred)}
                className="mb-6 flex w-full items-center justify-between gap-3 rounded-md bg-fg px-4 py-3 text-left text-bg touch-manipulation"
              >
                <span>
                  <span className="block text-xs font-semibold uppercase tracking-wide opacity-70">Last used</span>
                  <span className="font-semibold">
                    {preferred.addonName ?? "Stream"}
                    {streamQuality(preferred) ? ` · ${streamQuality(preferred)}` : ""}
                  </span>
                </span>
                <span className="flex items-center gap-2 font-semibold">
                  <Play className="size-4 fill-current" />
                  Play
                </span>
              </button>
            ) : null}
            <div className="flex flex-col gap-6 pb-16">
              {best.length > 0 ? (
                <section>
                  <div className="mb-2 flex items-center gap-2 px-1">
                    <Zap className="size-4 text-accent" />
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Best sources</h2>
                  </div>
                  <ul className="grid gap-2">
                    {best.map((stream) => (
                      <StreamChoice
                        key={`best-${streamKey(stream)}`}
                        stream={stream}
                        active={selectedKey === streamKey(stream)}
                        preferred={preferredKey === streamKey(stream)}
                        onPick={() => onPick(stream)}
                      />
                    ))}
                  </ul>
                </section>
              ) : null}
              {groups.map((group) => (
                <section key={group.name}>
                  <div className="mb-2 flex items-center gap-2 px-1">
                    <Puzzle className="size-4 text-muted" />
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{group.name}</h2>
                    <span className="text-xs text-subtle">{group.streams.length}</span>
                  </div>
                  <ul className="grid gap-2">
                    {group.streams.map((stream) => (
                      <StreamChoice
                        key={streamKey(stream)}
                        stream={stream}
                        active={selectedKey === streamKey(stream)}
                        preferred={preferredKey === streamKey(stream)}
                        onPick={() => onPick(stream)}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
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
  const label = stream.name || details[0] || "Stream";

  return (
    <li className="min-w-0">
      <button
        type="button"
        onClick={onPick}
        className={cn(
          "flex w-full min-w-0 items-center gap-3 rounded-md border bg-surface px-3 py-3 text-left transition-colors duration-150 touch-manipulation",
          active ? "border-fg/50 bg-elevated" : "border-border hover:bg-elevated",
        )}
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-sm bg-fg text-bg">
          {playable ? (
            <Play className="size-4 fill-current" />
          ) : kind === "external" ? (
            <ExternalLink className="size-4" />
          ) : (
            <Magnet className="size-4" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium">{label}</span>
            {quality ? (
              <span className="rounded-sm bg-elevated px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-fg">
                {quality}
              </span>
            ) : null}
            {flags.cached ? (
              <span className="rounded-sm bg-accent px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-fg">
                Cached
              </span>
            ) : flags.debrid ? (
              <span className="rounded-sm bg-elevated px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                Debrid
              </span>
            ) : null}
            {flags.dolbyVision ? (
              <span className="rounded-sm bg-elevated px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-fg">
                DV
              </span>
            ) : flags.hdr ? (
              <span className="rounded-sm bg-elevated px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-fg">
                HDR
              </span>
            ) : null}
            {flags.hevc || flags.av1 ? (
              <span className="rounded-sm bg-elevated px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                {flags.av1 ? "AV1" : "HEVC"}
              </span>
            ) : null}
            {preferred ? (
              <span className="rounded-sm bg-accent px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-fg">
                Last used
              </span>
            ) : null}
            {size ? <span className="text-xs text-muted">{size}</span> : null}
          </span>
          {details.length > 0 ? (
            <span className="mt-0.5 block truncate text-xs text-muted">{details.join(" · ")}</span>
          ) : stream.addonName ? (
            <span className="mt-0.5 block truncate text-xs text-muted">{kind}</span>
          ) : null}
        </span>
        <span className="shrink-0 rounded-sm bg-elevated px-2 py-1 text-[11px] uppercase tracking-wide text-muted">
          {playable ? "Play" : kind}
        </span>
      </button>
    </li>
  );
}
