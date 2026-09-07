import { Link } from "@tanstack/react-router";
import { COLLECTIONS } from "@/lib/stremio/collections";

export function CollectionsRow() {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-3 px-4 sm:mb-3 sm:px-8 lg:px-12">
        <h2 className="text-lg font-semibold">Collections</h2>
        <Link to="/collections" className="shrink-0 text-sm text-muted touch-manipulation">
          View all →
        </Link>
      </div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 sm:gap-3 sm:px-8 lg:px-12">
        {COLLECTIONS.slice(0, 28).map((item) => (
          <Link
            key={item.id}
            to="/collections/$id"
            params={{ id: item.id }}
            className="group relative w-56 shrink-0 overflow-hidden rounded-md bg-elevated outline outline-1 -outline-offset-1 outline-fg/10 touch-manipulation sm:w-64"
          >
            <span className="block aspect-wide">
              <img
                src={item.cover}
                alt=""
                className="size-full object-cover transition-transform duration-300 fine-hover:group-hover:scale-105"
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
    </section>
  );
}
