import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import { PosterSkeleton } from "@/components/ui/skeleton";
import type { MetaPreview } from "@/lib/stremio/types";
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
      <div className="mb-2 flex items-baseline justify-between gap-3 px-4 sm:mb-3 sm:px-8 lg:px-12">
        <h2 className="text-lg font-semibold">{title}</h2>
        {viewAll ? (
          <Link {...viewAll} className="shrink-0 text-sm text-muted touch-manipulation">
            View all →
          </Link>
        ) : null}
      </div>
      <div className="relative">
        <div
          ref={scroller}
          className="no-scrollbar flex gap-1 overflow-x-auto px-4 sm:gap-1.5 sm:px-8 lg:px-12"
        >
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <PosterSkeleton key={i} />)
            : items.map((item) => <PosterCard key={`${item.type}:${item.id}`} item={item} />)}
          {!loading && items.length === 0 ? (
            <p className="py-10 text-sm text-muted">{empty ?? "Nothing in this row yet."}</p>
          ) : null}
        </div>
        {hover && items.length > 4 ? (
          <>
            <button
              type="button"
              aria-label="Scroll left"
              className="absolute top-0 bottom-0 left-0 hidden w-10 items-center justify-center bg-bg/50 hover:bg-bg/70 md:flex"
              onClick={() => scroll(-1)}
            >
              <ChevronLeft className="size-8" />
            </button>
            <button
              type="button"
              aria-label="Scroll right"
              className="absolute top-0 bottom-0 right-0 hidden w-10 items-center justify-center bg-bg/50 hover:bg-bg/70 md:flex"
              onClick={() => scroll(1)}
            >
              <ChevronRight className="size-8" />
            </button>
          </>
        ) : null}
      </div>
    </section>
  );
}
