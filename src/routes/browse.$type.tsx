import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FilterBar } from "@/components/catalog/filter-bar";
import { PosterGrid } from "@/components/catalog/poster-card";
import {
  applyCatalogFilters,
  catalogFiltersNeedPool,
  catalogFiltersSearch,
  MOVIE_GENRES,
  parseCatalogFilters,
  SERIES_GENRES,
  type CatalogFilters,
} from "@/lib/catalog-filter";
import { CATALOG_PAGE_SIZE, fetchCatalogPages } from "@/lib/stremio/client";
import { CINEMETA_URL, enabledCatalogs } from "@/lib/stremio/urls";
import { useAddonStore } from "@/stores/addons";

export const Route = createFileRoute("/browse/$type")({
  beforeLoad: ({ params }) => {
    if (params.type === "channel") throw redirect({ to: "/" });
  },
  validateSearch: (s: Record<string, unknown>) => catalogFiltersSearch(parseCatalogFilters(s)),
  component: BrowsePage,
});

const TYPE_LABEL: Record<string, string> = {
  movie: "Movies",
  series: "TV Shows",
  anime: "Anime",
  tv: "Live TV",
};

function BrowsePage() {
  const { type } = Route.useParams();
  const rawSearch = Route.useSearch();
  const filters = parseCatalogFilters(rawSearch);
  const navigate = useNavigate();
  const addons = useAddonStore((s) => s.addons);
  const catalogs = useMemo(
    () => enabledCatalogs(addons).filter((c) => c.type === type),
    [addons, type],
  );
  const [catalogKey, setCatalogKey] = useState<string | null>(null);
  const [pages, setPages] = useState(1);

  const selected =
    catalogs.find((c) => `${c.transportUrl}:${c.id}` === catalogKey) ?? catalogs[0];

  const genreOptions =
    selected?.extra?.find((e) => e.name === "genre")?.options ??
    (type === "series" ? [...SERIES_GENRES] : [...MOVIE_GENRES]);

  const needPool = catalogFiltersNeedPool(filters);
  const pageCount = Math.max(pages, needPool ? 8 : 1);

  const query = useQuery({
    queryKey: ["browse", selected?.transportUrl, selected?.type, selected?.id, filters.genre, pageCount],
    enabled: Boolean(selected),
    queryFn: () =>
      fetchCatalogPages(
        selected!.transportUrl,
        selected!.type,
        selected!.id,
        { genre: filters.genre || undefined },
        pageCount,
      ),
    staleTime: 120_000,
  });

  const fallback = useQuery({
    queryKey: ["browse-fallback", type, filters.genre, pageCount],
    enabled: catalogs.length === 0 && (type === "movie" || type === "series"),
    queryFn: () =>
      fetchCatalogPages(CINEMETA_URL, type, "top", { genre: filters.genre || undefined }, pageCount),
    staleTime: 120_000,
  });

  const pool = (catalogs.length > 0 ? query.data : fallback.data) ?? [];
  const loading = catalogs.length > 0 ? query.isLoading : fallback.isLoading;
  const items = useMemo(() => applyCatalogFilters(pool, filters), [pool, filters]);
  const canLoadMore = pool.length >= pageCount * CATALOG_PAGE_SIZE - 5;

  function setFilters(next: CatalogFilters) {
    setPages(catalogFiltersNeedPool(next) ? 8 : 1);
    void navigate({
      to: "/browse/$type",
      params: { type },
      search: catalogFiltersSearch(next),
      replace: true,
    });
  }

  return (
    <main className="px-4 pb-16 pt-[calc(var(--header-h)+0.75rem)] sm:px-8 lg:px-12">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Browse</p>
          <h1 className="text-3xl font-semibold">{TYPE_LABEL[type] ?? type}</h1>
        </div>
        {catalogs.length > 1 ? (
          <select
            value={selected ? `${selected.transportUrl}:${selected.id}` : ""}
            onChange={(e) => {
              setCatalogKey(e.target.value);
              setPages(1);
            }}
            className="h-10 max-w-56 rounded-md border border-border bg-elevated px-3 text-sm"
            aria-label="Catalog"
          >
            {catalogs.map((c) => (
              <option key={`${c.transportUrl}:${c.id}`} value={`${c.transportUrl}:${c.id}`}>
                {c.addonName} · {c.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {catalogs.length === 0 && type !== "movie" && type !== "series" ? (
        <div className="rounded-lg bg-surface p-8 text-muted">
          No catalogs for this type yet.{" "}
          <Link to="/addons" className="text-fg underline">
            Install an add-on
          </Link>
          .
        </div>
      ) : (
        <>
          <FilterBar
            value={filters}
            onChange={setFilters}
            genres={genreOptions}
            showRuntime={type === "movie"}
            shown={loading ? undefined : items.length}
            total={loading ? undefined : pool.length}
          />
          <PosterGrid
            items={items}
            loading={loading}
            empty="Nothing matches those filters. Loosen year, rating, or category."
          />
          {canLoadMore && !loading ? (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                className="h-11 rounded-full bg-elevated px-5 text-sm font-semibold touch-manipulation hover:bg-fg/10"
                onClick={() => setPages((p) => p + 2)}
              >
                Load more
              </button>
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}
