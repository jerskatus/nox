import { Link } from "@tanstack/react-router";
import { COLLECTIONS } from "@/lib/stremio/collections";

export function CollectionsRow() {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-3 px-4 sm:mb-4 sm:px-8 lg:px-12">
        <h2 className="text-base font-semibold tracking-tight sm:text-lg">Collections</h2>
        <Link to="/collections" className="shrink-0 text-sm text-muted touch-manipulation hover:text-fg">
          View all
        </Link>
      </div>
      <div className="relative">
        <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 py-2 sm:gap-4 sm:px-8 lg:px-12">
          {COLLECTIONS.slice(0, 28).map((item) => (
            <Link
              key={item.id}
              to="/collections/$id"
              params={{ id: item.id }}
              className="group relative w-56 shrink-0 overflow-hidden rounded-lg bg-elevated shadow-[var(--shadow-border)] transition-transform duration-200 ease-out touch-manipulation fine-hover:hover:-translate-y-1 sm:w-64"
            >
              <span className="block aspect-wide">
                <img
                  src={item.cover}
                  alt=""
                  className="size-full object-cover outline outline-1 -outline-offset-1 outline-fg/10 transition-transform duration-200 fine-hover:group-hover:scale-105"
                  loading="lazy"
                />
              </span>
              <span className="absolute inset-0 bg-linear-to-t from-bg via-bg/30 to-transparent" />
              <span className="absolute inset-x-0 bottom-0 p-3">
                <span className="block truncate font-semibold">{item.title}</span>
                <span className="text-xs text-muted">
                  {item.items.length} titles · {item.hint}
                </span>
              </span>
            </Link>
          ))}
        </div>
        <div className="row-edge-left hidden sm:block" />
        <div className="row-edge-right hidden sm:block" />
      </div>
    </section>
  );
}
