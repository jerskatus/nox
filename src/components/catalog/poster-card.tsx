import { Link } from "@tanstack/react-router";
import { Play } from "lucide-react";
import { useState } from "react";
import type { MetaPreview } from "@/lib/stremio/types";
import { cn, encodeId, formatRating } from "@/lib/utils";

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

export function PosterCard({
  item,
  progress,
  compact,
  className,
}: {
  item: MetaPreview;
  progress?: number;
  compact?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const landscape = item.posterShape === "landscape" || item.posterShape === "square";
  const rating = formatRating(item.imdbRating);
  const href = titlePath(item);

  return (
    <Link
      {...href}
      className={cn(
        "group relative block shrink-0 overflow-hidden rounded-sm bg-elevated touch-manipulation",
        compact
          ? "w-36 sm:w-40"
          : landscape
            ? "w-56 sm:w-72"
            : "w-32 sm:w-40 lg:w-44",
        landscape || compact ? "aspect-wide" : "aspect-poster",
        className,
      )}
    >
      {item.poster && !failed ? (
        <img
          src={item.poster}
          alt=""
          className="size-full object-cover transition-transform duration-300 ease-out fine-hover:group-hover:scale-110"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex size-full items-end bg-elevated p-3">
          <span className="line-clamp-3 text-sm font-semibold">{item.name}</span>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-bg/90 via-transparent to-transparent opacity-100 fine-hover:opacity-0 fine-hover:group-hover:opacity-100" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex translate-y-0 items-end justify-between gap-2 p-2 opacity-100 transition-[opacity,transform] duration-200 fine-hover:translate-y-1 fine-hover:opacity-0 fine-hover:group-hover:translate-y-0 fine-hover:group-hover:opacity-100">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-fg">{item.name}</p>
          <p className="truncate text-[11px] text-muted">
            {[item.year ?? item.releaseInfo, rating ? rating : null].filter(Boolean).join(" · ")}
          </p>
        </div>
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-fg text-bg">
          <Play className="size-3.5 fill-current" />
        </span>
      </div>
      {progress !== undefined && progress > 0.02 && progress < 0.97 ? (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-fg/20">
          <div className="h-full bg-accent" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      ) : null}
    </Link>
  );
}
