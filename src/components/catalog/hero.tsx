import { Link } from "@tanstack/react-router";
import { Check, Info, Play, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MetaPreview } from "@/lib/stremio/types";
import { formatRating } from "@/lib/utils";
import { titlePath, watchPath } from "./poster-card";

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
  const genres = (item.genres ?? []).slice(0, 3).join(" · ");
  const play = watchPath(item, resumeVideo, { auto: Boolean(resumeVideo) });
  const info = titlePath(item);

  return (
    <section className="relative h-[78vw] max-h-[820px] min-h-[480px] w-full overflow-hidden sm:h-[56vw] sm:min-h-[420px]">
      {item.background || item.poster ? (
        <img
          src={item.background || item.poster}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-elevated" />
      )}
      <div className="hero-side pointer-events-none absolute inset-0" />
      <div className="hero-mask pointer-events-none absolute inset-0" />
      <div className="absolute inset-x-0 bottom-0 z-20 px-4 pb-20 pt-16 sm:px-8 sm:pb-28 lg:px-12 lg:pb-32">
        <div className="max-w-xl">
          {item.logo ? (
            <img src={item.logo} alt={item.name} className="mb-4 h-16 w-auto max-w-xs object-contain sm:h-24" />
          ) : (
            <h1 className="mb-3 font-display text-5xl leading-none tracking-wide text-fg sm:text-7xl">
              {item.name}
            </h1>
          )}
          <p className="mb-2 text-sm font-medium text-muted">
            {[item.year ?? item.releaseInfo, rating ? `${rating} IMDb` : null, genres]
              .filter(Boolean)
              .join("  ·  ")}
          </p>
          {item.description ? (
            <p className="mb-6 line-clamp-3 max-w-lg text-sm text-fg/90 sm:text-base">{item.description}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild variant="play" size="lg" className="rounded-full px-8">
              <Link {...play}>
                <Play className="size-5 fill-current" />
                {resumeVideo ? "Continue" : "Play"}
              </Link>
            </Button>
            <div className="flex overflow-hidden rounded-full bg-fg/20 backdrop-blur-sm">
              {onToggleList ? (
                <Button
                  variant="ghost"
                  size="lg"
                  className="rounded-none bg-transparent hover:bg-fg/10"
                  onClick={onToggleList}
                  aria-label={inList ? "Remove from my list" : "Add to my list"}
                >
                  {inList ? <Check className="size-5" /> : <Plus className="size-5" />}
                </Button>
              ) : null}
              <span className="w-px self-stretch bg-fg/20" />
              <Button asChild variant="ghost" size="lg" className="rounded-none bg-transparent hover:bg-fg/10">
                <Link {...info} aria-label="More info">
                  <Info className="size-5" />
                </Link>
              </Button>
            </div>
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
