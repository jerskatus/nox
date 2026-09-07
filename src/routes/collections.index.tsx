import { createFileRoute, Link } from "@tanstack/react-router";
import { COLLECTIONS } from "@/lib/stremio/collections";

export const Route = createFileRoute("/collections/")({
  component: CollectionsIndex,
});

function CollectionsIndex() {
  return (
    <main className="px-4 pb-20 pt-[calc(var(--header-h)+0.75rem)] sm:px-8 lg:px-12">
      <h1 className="text-3xl font-semibold">Collections</h1>
      <p className="mt-2 mb-8 text-muted">Watch universes in order — MCU, Ghibli, Wick, and more.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {COLLECTIONS.map((item) => (
          <Link
            key={item.id}
            to="/collections/$id"
            params={{ id: item.id }}
            className="group overflow-hidden rounded-md bg-elevated outline outline-1 -outline-offset-1 outline-fg/10 touch-manipulation"
          >
            <span className="relative block aspect-wide">
              <img
                src={item.cover}
                alt=""
                className="size-full object-cover transition-transform duration-300 fine-hover:group-hover:scale-105"
              />
              <span className="absolute inset-0 bg-linear-to-t from-bg via-transparent to-transparent" />
              <span className="absolute inset-x-0 bottom-0 p-3">
                <span className="block font-semibold">{item.title}</span>
                <span className="text-sm text-muted">
                  {item.items.length} titles · {item.hint}
                </span>
              </span>
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
