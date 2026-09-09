import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, Info, Play, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { fetchMeta } from "@/lib/stremio/client";
import type { MetaPreview } from "@/lib/stremio/types";
import { cn, formatRating } from "@/lib/utils";
import { cleanSynopsis } from "@/lib/synopsis";
import { useEnabledAddons } from "@/stores/addons";
import { titlePath, watchPath } from "./poster-card";
import { TitleMeta } from "./title-meta";
import { trailerYoutubeId } from "./trailer-modal";

const HERO_MS = 8500;

export function Hero({
  items,
  inList,
  onToggleList,
  onTrailer,
  resumeFor,
}: {
  items: MetaPreview[];
  inList: (item: MetaPreview) => boolean;
  onToggleList: (item: MetaPreview) => void;
  onTrailer?: (item: MetaPreview, ytId: string) => void;
  resumeFor?: (item: MetaPreview) => string | undefined;
}) {
  const addons = useEnabledAddons();
  const slides = items.filter((item) => item.background || item.poster).slice(0, 8);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  pausedRef.current = paused;
  const countRef = useRef(slides.length);
  countRef.current = slides.length;
  const safeIndex = slides.length ? index % slides.length : 0;
  const item = slides[safeIndex];

  useEffect(() => {
    if (countRef.current < 2) return;
    const timer = window.setInterval(() => {
      if (pausedRef.current) return;
      const total = countRef.current;
      if (total < 2) return;
      setIndex((n) => (n + 1) % total);
    }, HERO_MS);
    return () => window.clearInterval(timer);
  }, []);

  const heroMeta = useQuery({
    queryKey: ["hero-meta", item?.type, item?.id],
    enabled: Boolean(item),
    queryFn: () => fetchMeta(addons, item!.type, item!.id),
    staleTime: 300_000,
  });

  if (!item) return null;
  const shown = heroMeta.data ?? item;
  const rating = formatRating(shown.imdbRating);
  const resumeVideo = resumeFor?.(item);
  const play = watchPath(shown, resumeVideo, { auto: true });
  const info = titlePath(shown);
  const trailerId = heroMeta.data ? trailerYoutubeId(heroMeta.data) : null;
  const synopsis = cleanSynopsis(shown.description);

  return (
    <section
      className="relative h-[min(88svh,46rem)] min-h-[32rem] w-full overflow-hidden"
      data-hero-index={safeIndex}
      data-hero-count={slides.length}
    >
      {slides.map((slide, i) => {
        const src = slide.background || slide.poster;
        if (!src) return null;
        const on = i === safeIndex;
        return (
          <img
            key={slide.id}
            src={src}
            alt=""
            className={cn("hero-slide", on && "hero-slide-on")}
          />
        );
      })}
      <div className="hero-side pointer-events-none absolute inset-0 z-10" />
      <div className="hero-mask pointer-events-none absolute inset-0 z-10" />
      <div className="absolute inset-x-0 bottom-0 z-20 px-4 pb-16 pt-28 sm:px-8 sm:pb-24 lg:px-12 lg:pb-28">
        <div
          className="max-w-xl"
          onPointerEnter={(event) => {
            if (event.pointerType === "mouse") setPaused(true);
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse") setPaused(false);
          }}
        >
        <div key={item.id} className="hero-lockup">
          {shown.logo ? (
            <img
              src={shown.logo}
              alt={shown.name}
              className="mb-4 h-16 w-auto max-w-xs object-contain drop-shadow-md sm:h-24"
            />
          ) : (
            <h1 className="mb-4 font-display text-5xl leading-none tracking-wide text-fg sm:text-7xl">
              {shown.name}
            </h1>
          )}
          <TitleMeta
            className="mb-4"
            year={shown.year ?? shown.releaseInfo}
            rating={rating}
            genres={shown.genres ?? []}
          />
          {synopsis ? (
            <p className="mb-6 line-clamp-3 max-w-lg text-sm leading-relaxed text-fg/90 sm:text-base">
              {synopsis}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Button asChild variant="play" size="lg" className="rounded-full px-8">
              <Link {...play}>
                <Play className="ml-0.5 size-5 fill-current" />
                {resumeVideo ? "Continue" : "Play"}
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="rounded-full"
              onClick={() => onToggleList(item)}
              aria-label={inList(item) ? "Remove from my list" : "Add to my list"}
            >
              {inList(item) ? <Check className="size-5" /> : <Plus className="size-5" />}
              <span className="hidden sm:inline">{inList(item) ? "On my list" : "My list"}</span>
            </Button>
            <Button asChild variant="ghost" size="lg" className="rounded-full">
              <Link {...info}>
                <Info className="size-5" />
                <span className="hidden sm:inline">More info</span>
              </Link>
            </Button>
            {trailerId && onTrailer ? (
              <Button variant="ghost" size="lg" className="rounded-full" onClick={() => onTrailer(shown, trailerId)}>
                Trailer
              </Button>
            ) : null}
          </div>
        </div>
        {slides.length > 1 ? (
          <div className="mt-8 flex max-w-xl items-center gap-1.5" aria-label="Featured titles">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                aria-label={`Show ${slide.name}`}
                aria-current={i === safeIndex}
                className="h-1 min-h-11 min-w-6 flex-1 overflow-hidden rounded-full py-5 touch-manipulation sm:min-h-0 sm:py-0"
                onClick={() => setIndex(i)}
              >
                <span className="block h-1 overflow-hidden rounded-full bg-fg/25">
                  <span
                    className={cn(
                      "block h-full rounded-full bg-fg",
                      i === safeIndex ? "hero-progress" : i < safeIndex ? "w-full" : "w-0",
                      paused && i === safeIndex && "hero-progress-paused",
                    )}
                  />
                </span>
              </button>
            ))}
          </div>
        ) : null}
        </div>
      </div>
    </section>
  );
}
