import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FilterBar } from "@/components/catalog/filter-bar";
import { PosterGrid } from "@/components/catalog/poster-card";
import { ProviderMark } from "@/components/catalog/provider-mark";
import {
  applyCatalogFilters,
  catalogFiltersSearch,
  MOVIE_GENRES,
  parseCatalogFilters,
  SERIES_GENRES,
  type CatalogFilters,
} from "@/lib/catalog-filter";
import { fetchCatalog } from "@/lib/stremio/client";
import { providerById } from "@/lib/stremio/providers";
import { STREAMING_CATALOGS_URL } from "@/lib/stremio/urls";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/provider/$id")({
  validateSearch: (s: Record<string, unknown>) => catalogFiltersSearch(parseCatalogFilters(s)),
  component: ProviderPage,
});

function ProviderPage() {
  const { id } = Route.useParams();
  const filters = parseCatalogFilters(Route.useSearch());
  const navigate = useNavigate();
  const provider = providerById(id);
  const [kind, setKind] = useState<"movie" | "series">("movie");

  const query = useQuery({
    queryKey: ["provider", provider?.catalogId, kind],
    enabled: Boolean(provider),
    queryFn: () => fetchCatalog(STREAMING_CATALOGS_URL, kind, provider!.catalogId),
    staleTime: 300_000,
  });

  const pool = query.data ?? [];
  const items = useMemo(() => applyCatalogFilters(pool, filters), [pool, filters]);

  function setFilters(next: CatalogFilters) {
    void navigate({
      to: "/provider/$id",
      params: { id },
      search: catalogFiltersSearch(next),
      replace: true,
    });
  }

  if (!provider) {
    return (
      <main className="px-4 pt-28 text-center">
        <h1 className="text-2xl font-semibold">Unknown provider</h1>
        <Link to="/" className="mt-4 inline-block text-sm underline">
          Back home
        </Link>
      </main>
    );
  }

  return (
    <main className="px-4 pb-16 pt-[calc(var(--header-h)+0.75rem)] sm:px-8 lg:px-12">
      <div className="mb-6 flex items-center gap-4">
        <span
          className="relative grid size-14 place-items-center overflow-hidden rounded-2xl"
          style={{ backgroundColor: provider.bg }}
        >
          <ProviderMark provider={provider} />
        </span>
        <div>
          <p className="text-sm text-muted">Browse by provider</p>
          <h1 className="text-3xl font-semibold">{provider.name}</h1>
        </div>
      </div>

      <div className="mb-5 flex gap-2">
        {(["movie", "series"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              setKind(tab);
              if (tab === "series" && filters.runtime) {
                setFilters({ ...filters, runtime: "" });
              }
            }}
            className={cn(
              "h-11 rounded-full px-5 text-sm font-semibold touch-manipulation",
              kind === tab ? "bg-fg text-bg" : "bg-elevated text-muted",
            )}
          >
            {tab === "movie" ? "Movies" : "Series"}
          </button>
        ))}
      </div>

      <FilterBar
        value={filters}
        onChange={setFilters}
        genres={kind === "series" ? [...SERIES_GENRES] : [...MOVIE_GENRES]}
        showRuntime={kind === "movie"}
        shown={query.isLoading ? undefined : items.length}
        total={query.isLoading ? undefined : pool.length}
      />

      <PosterGrid
        items={items}
        loading={query.isLoading}
        empty={
          pool.length
            ? "Nothing matches those filters."
            : `Nothing listed for ${provider.name} right now.`
        }
      />
    </main>
  );
}
