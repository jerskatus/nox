import { Link } from "@tanstack/react-router";
import { Play, X } from "lucide-react";
import { useState } from "react";
import { progressRatio, useLibraryStore, type ProgressItem } from "@/stores/library";
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
      <h2 className="mb-3 px-4 text-base font-semibold tracking-tight sm:mb-4 sm:px-8 sm:text-lg lg:px-12">
        Continue
      </h2>
      <div className="relative">
        <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 py-2 sm:gap-4 sm:px-8 lg:px-12">
          {items.map((item) => (
            <ContinueCard key={`${item.type}:${item.id}:${item.videoId}`} item={item} />
          ))}
        </div>
        <div className="row-edge-left hidden sm:block" />
        <div className="row-edge-right hidden sm:block" />
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
    <div className="group relative z-0 w-56 shrink-0 transition-transform duration-200 ease-out fine-hover:hover:z-10 fine-hover:hover:-translate-y-1 sm:w-72 lg:w-80">
      <div className="relative overflow-hidden rounded-lg bg-elevated shadow-[var(--shadow-border)]">
        <Link
          to="/watch/$type/$id"
          params={{ type: item.type, id: encodeId(item.id) }}
          search={{ video: item.videoId === item.id ? undefined : item.videoId, auto: "1" }}
          className="block touch-manipulation"
        >
          <div className="aspect-wide">
            {src && !failed ? (
              <img
                src={src}
                alt=""
                className="size-full object-cover outline outline-1 -outline-offset-1 outline-fg/10 transition-transform duration-200 ease-out fine-hover:group-hover:scale-105"
                loading="lazy"
                onError={() => setFailed(true)}
              />
            ) : (
              <div className="flex size-full items-end bg-elevated p-3">
                <span className="line-clamp-2 text-sm font-semibold">{item.name}</span>
              </div>
            )}
          </div>
          <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-bg via-bg/30 to-transparent" />
          <span className="absolute top-2 left-2 rounded-full bg-accent px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide text-fg">
            Continue
          </span>
          <div className="pointer-events-none absolute inset-0 grid place-items-center opacity-100 transition-opacity duration-200 fine-hover:opacity-0 fine-hover:group-hover:opacity-100">
            <span className="grid size-12 place-items-center rounded-full bg-fg text-bg shadow-lg">
              <Play className="ml-0.5 size-5 fill-current" />
            </span>
          </div>
          <div className="absolute inset-x-0 bottom-0 p-2.5 sm:p-3">
            <p className="truncate text-sm font-semibold text-fg">{item.name}</p>
            {episode ? <p className="truncate text-2xs text-muted">{episode}</p> : null}
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-fg/20">
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(ratio * 100)}%` }} />
            </div>
          </div>
        </Link>
        <button
          type="button"
          aria-label={`Remove ${item.name} from Continue`}
          className="absolute top-1.5 right-1.5 z-20 grid size-11 place-items-center rounded-full bg-bg/80 text-fg shadow-md touch-manipulation hover:bg-bg"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            useLibraryStore.getState().clearProgress(item.id);
          }}
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
