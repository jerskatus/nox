import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import { PosterSkeleton } from "@/components/ui/skeleton";
import type { MetaPreview } from "@/lib/stremio/types";
import { cn } from "@/lib/utils";
import { PosterCard } from "./poster-card";

export function CatalogRow({
  title,
  items,
  loading,
  empty,
  viewAll,
}: {
  title: string;
  items: MetaPreview[];
  loading?: boolean;
  empty?: string;
  viewAll?: { to: "/browse/$type"; params: { type: string } } | { to: "/provider/$id"; params: { id: string } };
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);

  function scroll(dir: -1 | 1) {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.85, 900), behavior: "smooth" });
  }

  return (
    <section className="relative" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div className="mb-3 flex items-baseline justify-between gap-3 px-4 sm:mb-4 sm:px-8 lg:px-12">
        <h2 className="text-base font-semibold tracking-tight sm:text-lg">{title}</h2>
        {viewAll ? (
          <Link {...viewAll} className="shrink-0 text-sm text-muted touch-manipulation hover:text-fg">
            View all
          </Link>
        ) : null}
      </div>
      <div className="relative">
        <div
          ref={scroller}
          className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3 sm:gap-3 sm:px-8 lg:px-12"
        >
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <PosterSkeleton key={i} />)
            : items.map((item) => <PosterCard key={`${item.type}:${item.id}`} item={item} />)}
          {!loading && items.length === 0 ? (
            <p className="py-10 text-sm text-muted">{empty ?? "Nothing in this row yet."}</p>
          ) : null}
        </div>
        {items.length > 4 ? (
          <>
            <div className="row-edge-left hidden sm:block" />
            <div className="row-edge-right hidden sm:block" />
          </>
        ) : null}
        {hover && items.length > 4 ? (
          <>
            <button
              type="button"
              aria-label="Scroll left"
              className={cn(
                "absolute top-1/2 left-2 z-20 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-bg/80 text-fg shadow-[var(--shadow-border)] hover:bg-elevated md:flex",
              )}
              onClick={() => scroll(-1)}
            >
              <ChevronLeft className="size-6" />
            </button>
            <button
              type="button"
              aria-label="Scroll right"
              className="absolute top-1/2 right-2 z-20 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-bg/80 text-fg shadow-[var(--shadow-border)] hover:bg-elevated md:flex"
              onClick={() => scroll(1)}
            >
              <ChevronRight className="size-6" />
            </button>
          </>
        ) : null}
      </div>
    </section>
  );
}
