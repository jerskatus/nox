import { Link } from "@tanstack/react-router";
import { Check, Info, Play, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MetaPreview } from "@/lib/stremio/types";
import { formatRating } from "@/lib/utils";
import { titlePath, watchPath } from "./poster-card";
import { TitleMeta } from "./title-meta";

export function Hero({
  item,
  inList,
  onToggleList,
  onTrailer,
  resumeVideo,
}: {
  item: MetaPreview;
  inList?: boolean;
  onToggleList?: () => void;
  onTrailer?: () => void;
  resumeVideo?: string;
}) {
  const rating = formatRating(item.imdbRating);
  const play = watchPath(item, resumeVideo, { auto: Boolean(resumeVideo) });
  const info = titlePath(item);

  return (
    <section className="relative h-[min(88svh,46rem)] min-h-[32rem] w-full overflow-hidden">
      {item.background || item.poster ? (
        <img
          src={item.background || item.poster}
          alt=""
          className="absolute inset-0 size-full object-cover object-[center_20%]"
        />
      ) : (
        <div className="absolute inset-0 bg-elevated" />
      )}
      <div className="hero-side pointer-events-none absolute inset-0" />
      <div className="hero-mask pointer-events-none absolute inset-0" />
      <div className="absolute inset-x-0 bottom-0 z-20 px-4 pb-16 pt-28 sm:px-8 sm:pb-24 lg:px-12 lg:pb-28">
        <div className="hero-lockup max-w-xl">
          {item.logo ? (
            <img
              src={item.logo}
              alt={item.name}
              className="mb-4 h-16 w-auto max-w-xs object-contain drop-shadow-md sm:h-24"
            />
          ) : (
            <h1 className="mb-4 font-display text-5xl leading-none tracking-wide text-fg sm:text-7xl">
              {item.name}
            </h1>
          )}
          <TitleMeta
            className="mb-4"
            year={item.year ?? item.releaseInfo}
            rating={rating}
            genres={item.genres ?? []}
          />
          {item.description ? (
            <p className="mb-6 line-clamp-3 max-w-lg text-sm leading-relaxed text-fg/90 sm:text-base">
              {item.description}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Button asChild variant="play" size="lg" className="rounded-full px-8">
              <Link {...play}>
                <Play className="ml-0.5 size-5 fill-current" />
                {resumeVideo ? "Continue" : "Play"}
              </Link>
            </Button>
            {onToggleList ? (
              <Button
                variant="ghost"
                size="lg"
                className="rounded-full"
                onClick={onToggleList}
                aria-label={inList ? "Remove from my list" : "Add to my list"}
              >
                {inList ? <Check className="size-5" /> : <Plus className="size-5" />}
                <span className="hidden sm:inline">{inList ? "On my list" : "My list"}</span>
              </Button>
            ) : null}
            <Button asChild variant="ghost" size="lg" className="rounded-full">
              <Link {...info}>
                <Info className="size-5" />
                <span className="hidden sm:inline">More info</span>
              </Link>
            </Button>
            {onTrailer ? (
              <Button variant="ghost" size="lg" className="rounded-full" onClick={onTrailer}>
                Trailer
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
