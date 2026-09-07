import { Link } from "@tanstack/react-router";
import { Play } from "lucide-react";
import { useState } from "react";
import { progressRatio, type ProgressItem } from "@/stores/library";
import { encodeId } from "@/lib/utils";

function episodeLabel(item: ProgressItem) {
  if (item.season && (item.episode || item.episode === 0)) {
    return `S${item.season} E${item.episode}${item.episodeName ? ` · ${item.episodeName}` : ""}`;
  }
  return item.episodeName ?? null;
}

export function ContinueRow({ items }: { items: ProgressItem[] }) {
  if (items.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 px-4 text-lg font-semibold sm:px-8 lg:px-12">Continue</h2>
      <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 sm:gap-4 sm:px-8 lg:px-12">
        {items.map((item) => (
          <ContinueCard key={`${item.type}:${item.id}:${item.videoId}`} item={item} />
        ))}
      </div>
    </section>
  );
}

function ContinueCard({ item }: { item: ProgressItem }) {
  const [failed, setFailed] = useState(false);
  const ratio = progressRatio(item);
  const episode = episodeLabel(item);
  const src = item.background || item.poster;

  return (
    <Link
      to="/watch/$type/$id"
      params={{ type: item.type, id: encodeId(item.id) }}
      search={{ video: item.videoId === item.id ? undefined : item.videoId, auto: "1" }}
      className="group relative w-56 shrink-0 overflow-hidden rounded-md bg-elevated touch-manipulation sm:w-72 lg:w-80"
    >
      <div className="aspect-wide">
        {src && !failed ? (
          <img
            src={src}
            alt=""
            className="size-full object-cover transition-transform duration-300 ease-out fine-hover:group-hover:scale-105"
            loading="lazy"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="flex size-full items-end bg-elevated p-3">
            <span className="line-clamp-2 text-sm font-semibold">{item.name}</span>
          </div>
        )}
      </div>
      <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-bg via-bg/20 to-transparent" />
      <span className="absolute top-2 left-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
        Continue
      </span>
      <div className="absolute inset-0 grid place-items-center opacity-100 transition-opacity fine-hover:opacity-0 fine-hover:group-hover:opacity-100">
        <span className="grid size-12 place-items-center rounded-full bg-fg text-bg shadow-lg">
          <Play className="size-5 fill-current" />
        </span>
      </div>
      <div className="absolute inset-x-0 bottom-0 p-2.5 sm:p-3">
        <p className="truncate text-sm font-semibold text-fg">{item.name}</p>
        {episode ? <p className="truncate text-[11px] text-muted">{episode}</p> : null}
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-fg/20">
          <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(ratio * 100)}%` }} />
        </div>
      </div>
    </Link>
  );
}
