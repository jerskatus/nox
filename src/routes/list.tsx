import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FilterBar } from "@/components/catalog/filter-bar";
import { PosterGrid } from "@/components/catalog/poster-card";
import {
  applyCatalogFilters,
  DEFAULT_FILTERS,
  MOVIE_GENRES,
  SERIES_GENRES,
  type CatalogFilters,
} from "@/lib/catalog-filter";
import { useLibraryStore } from "@/stores/library";

export const Route = createFileRoute("/list")({
  component: ListPage,
});

function ListPage() {
  const list = useLibraryStore((s) => s.list);
  const [filters, setFilters] = useState<CatalogFilters>(DEFAULT_FILTERS);
  const items = useMemo(() => applyCatalogFilters(list, filters), [list, filters]);
  const genres = [...new Set([...MOVIE_GENRES, ...SERIES_GENRES])];

  return (
    <main className="px-4 pb-16 pt-[calc(var(--header-h)+0.75rem)] sm:px-8 lg:px-12">
      <h1 className="mb-6 text-3xl font-semibold">My list</h1>
      {list.length === 0 ? (
        <div className="rounded-lg bg-surface p-10 text-center">
          <p className="text-lg font-medium">Your list is empty</p>
          <p className="mt-2 text-sm text-muted">Tap the plus on any poster, or save from a title page.</p>
          <Link to="/" className="mt-4 inline-block text-sm underline">
            Browse the board
          </Link>
        </div>
      ) : (
        <>
          <FilterBar
            value={filters}
            onChange={setFilters}
            genres={genres}
            showKind
            showRuntime={filters.kind !== "series"}
            shown={items.length}
            total={list.length}
          />
          <PosterGrid items={items} empty="Nothing on your list matches those filters." />
        </>
      )}
    </main>
  );
}
