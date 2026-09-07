import { Link } from "@tanstack/react-router";
import { Check, Play, Plus } from "lucide-react";
import { useState } from "react";
import { PosterSkeleton } from "@/components/ui/skeleton";
import type { MetaPreview } from "@/lib/stremio/types";
import { cn, encodeId, formatRating } from "@/lib/utils";
import { useLibraryStore } from "@/stores/library";

export function titlePath(item: Pick<MetaPreview, "type" | "id">) {
  return {
    to: "/title/$type/$id" as const,
    params: { type: item.type, id: encodeId(item.id) },
  };
}

export function watchPath(
  item: Pick<MetaPreview, "type" | "id">,
  video?: string,
  opts?: { auto?: boolean },
) {
  return {
    to: "/watch/$type/$id" as const,
    params: { type: item.type, id: encodeId(item.id) },
    search: { video, auto: opts?.auto ? "1" : undefined },
  };
}

function isLandscapePoster(item: MetaPreview, layout: "row" | "grid") {
  if (layout === "grid") return item.type === "channel" || item.type === "tv";
  return item.posterShape === "landscape" || item.posterShape === "square";
}

export function PosterCard({
  item,
  progress,
  compact,
  layout = "row",
  className,
}: {
  item: MetaPreview;
  progress?: number;
  compact?: boolean;
  layout?: "row" | "grid";
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const landscape = isLandscapePoster(item, layout);
  const rating = formatRating(item.imdbRating);
  const href = titlePath(item);
  const inList = useLibraryStore((s) => s.list.some((entry) => entry.id === item.id));

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-sm bg-elevated outline outline-1 -outline-offset-1 outline-fg/10",
        layout === "grid"
          ? "w-full min-w-0"
          : compact
            ? "w-36 shrink-0 sm:w-40"
            : landscape
              ? "w-56 shrink-0 sm:w-72"
              : "w-28 shrink-0 sm:w-36 md:w-40 lg:w-44",
        landscape ? "aspect-wide" : "aspect-poster",
        className,
      )}
    >
      <Link {...href} className="absolute inset-0 block touch-manipulation">
        {item.poster && !failed ? (
          <img
            src={item.poster}
            alt=""
            className="size-full object-cover transition-transform duration-300 ease-out fine-hover:group-hover:scale-105"
            loading="lazy"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="flex size-full items-end bg-elevated p-3">
            <span className="line-clamp-3 text-sm font-semibold">{item.name}</span>
          </div>
        )}
        {rating ? <ImdbBadge rating={rating} /> : null}
        <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-bg/90 via-transparent to-transparent opacity-100 fine-hover:opacity-0 fine-hover:group-hover:opacity-100" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex translate-y-0 items-end justify-between gap-2 p-2 opacity-100 transition-[opacity,transform] duration-200 fine-hover:translate-y-1 fine-hover:opacity-0 fine-hover:group-hover:translate-y-0 fine-hover:group-hover:opacity-100">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-fg">{item.name}</p>
            {item.year ?? item.releaseInfo ? (
              <p className="truncate text-2xs text-muted">{item.year ?? item.releaseInfo}</p>
            ) : null}
          </div>
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-fg text-bg">
            <Play className="ml-px size-3.5 fill-current" />
          </span>
        </div>
        {progress !== undefined && progress > 0.02 && progress < 0.97 ? (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-fg/20">
            <div className="h-full bg-accent" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        ) : null}
      </Link>
      <button
        type="button"
        aria-label={inList ? `Remove ${item.name} from My list` : `Add ${item.name} to My list`}
        aria-pressed={inList}
        className={cn(
          "absolute top-1 left-1 z-20 grid size-11 place-items-center rounded-full shadow-md touch-manipulation transition-opacity duration-150",
          inList ? "bg-fg text-bg" : "bg-bg/80 text-fg hover:bg-bg",
          "opacity-100 fine-hover:opacity-0 fine-hover:group-hover:opacity-100",
        )}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          useLibraryStore.getState().toggleList(item);
        }}
      >
        {inList ? <Check className="size-4" /> : <Plus className="size-4" />}
      </button>
    </div>
  );
}

function ImdbBadge({ rating }: { rating: string }) {
  return (
    <span className="absolute top-1.5 right-1.5 z-10 flex items-center overflow-hidden rounded-xs shadow-md">
      <span className="bg-imdb px-1 py-0.5 text-2xs font-black leading-none tracking-tight text-imdb-fg">
        IMDb
      </span>
      <span className="bg-bg/85 px-1.5 py-0.5 text-2xs font-semibold tabular-nums leading-none text-fg backdrop-blur-sm">
        {rating}
      </span>
    </span>
  );
}

export function PosterGrid({
  items,
  loading,
  empty,
}: {
  items?: MetaPreview[];
  loading?: boolean;
  empty?: string;
}) {
  return (
    <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 sm:gap-1.5">
      {loading
        ? Array.from({ length: 18 }).map((_, i) => <PosterSkeleton key={i} fill />)
        : items?.map((item) => (
            <PosterCard key={`${item.type}:${item.id}`} item={item} layout="grid" />
          ))}
      {!loading && (!items || items.length === 0) && empty ? (
        <p className="col-span-full py-10 text-center text-sm text-muted">{empty}</p>
      ) : null}
    </div>
  );
}
