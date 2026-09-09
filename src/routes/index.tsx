import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Hero } from "@/components/catalog/hero";
import { ContinueRow } from "@/components/catalog/continue-row";
import { ProviderRow } from "@/components/catalog/provider-row";
import { CatalogRow } from "@/components/catalog/row";
import { CollectionsRow } from "@/components/catalog/collections-row";
import { TrailerModal } from "@/components/catalog/trailer-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchCatalog, fetchMeta, loadJsonMany } from "@/lib/stremio/client";
import { HOME_ROWS } from "@/lib/stremio/defaults";
import type { MetaPreview } from "@/lib/stremio/types";
import { CINEMETA_URL, resourceUrl } from "@/lib/stremio/urls";
import { useEnabledAddons } from "@/stores/addons";
import { continueWatching, useLibraryStore } from "@/stores/library";

type HomeRow = {
  key: string;
  title: string;
  items: MetaPreview[];
};

export const Route = createFileRoute("/")({
  loader: async () => {
    const urls = HOME_ROWS.map((row) =>
      resourceUrl(row.transportUrl, "catalog", row.type, row.id, "extra" in row ? row.extra : undefined),
    );
    const results = await loadJsonMany(urls);
    const rows: HomeRow[] = HOME_ROWS.map((row, index) => {
      const result = results.find((r) => r.url === urls[index]);
      const items = result?.ok ? (((result.data as { metas?: MetaPreview[] }).metas ?? []) as MetaPreview[]) : [];
      return { key: row.key, title: row.title, items };
    });
    return { rows };
  },
  pendingMs: 200,
  pendingComponent: HomePending,
  component: Home,
});

function HomePending() {
  return (
    <main>
      <Skeleton className="h-[min(88svh,46rem)] w-full rounded-none" />
    </main>
  );
}

function pickHeroItems(rows: HomeRow[]) {
  const movies = rows.find((row) => row.key === "movies-popular")?.items ?? [];
  const series = rows.find((row) => row.key === "series-popular")?.items ?? [];
  const seen = new Set<string>();
  const items: MetaPreview[] = [];
  for (const item of [...movies, ...series]) {
    if (!item?.id || seen.has(item.id) || !(item.background || item.poster)) continue;
    seen.add(item.id);
    items.push(item);
    if (items.length >= 8) break;
  }
  return items;
}

function Home() {
  const { rows } = Route.useLoaderData();
  const addons = useEnabledAddons();
  const list = useLibraryStore((s) => s.list);
  const progress = useLibraryStore((s) => s.progress);
  const toggleList = useLibraryStore((s) => s.toggleList);
  const resume = continueWatching(progress);
  const [trailer, setTrailer] = useState<{ title: string; ytId: string } | null>(null);
  const heroItems = useMemo(() => pickHeroItems(rows), [rows]);

  const becauseSeed = resume[0] ?? progress[0];
  const because = useQuery({
    queryKey: ["because", becauseSeed?.id, becauseSeed?.type],
    enabled: Boolean(becauseSeed),
    queryFn: async () => {
      const meta = await fetchMeta(addons, becauseSeed!.type, becauseSeed!.id);
      const genre = meta?.genres?.[0] ?? meta?.genre?.[0];
      if (!genre) return { name: becauseSeed!.name, items: [] as MetaPreview[] };
      const items = await fetchCatalog(CINEMETA_URL, becauseSeed!.type === "series" ? "series" : "movie", "top", {
        genre,
      });
      return {
        name: becauseSeed!.name,
        items: items.filter((item) => item.id !== becauseSeed!.id),
      };
    },
    staleTime: 300_000,
  });

  return (
    <main>
      {heroItems.length > 0 ? (
        <Hero
          items={heroItems}
          inList={(item) => list.some((entry) => entry.id === item.id)}
          onToggleList={toggleList}
          onTrailer={(_item, ytId) => setTrailer({ title: _item.name, ytId })}
          resumeFor={(item) => resume.find((entry) => entry.id === item.id)?.videoId}
        />
      ) : (
        <Skeleton className="h-[60vh] w-full rounded-none" />
      )}

      <div className="relative z-10 -mt-6 flex flex-col gap-10 pb-20 sm:-mt-12 sm:gap-12">
        <ContinueRow items={resume} />
        <ProviderRow />
        <CollectionsRow />

        {list.length > 0 ? <CatalogRow title="My list" items={list} /> : null}

        {because.data && because.data.items.length > 0 ? (
          <CatalogRow title={`Because you watched ${because.data.name}`} items={because.data.items} />
        ) : null}

        {rows.map((row) =>
          row.items.length > 0 ? (
            <CatalogRow
              key={row.key}
              title={row.title}
              items={row.items}
              viewAll={
                row.key === "movies-popular"
                  ? { to: "/browse/$type", params: { type: "movie" } }
                  : row.key === "series-popular"
                    ? { to: "/browse/$type", params: { type: "series" } }
                    : undefined
              }
            />
          ) : null,
        )}
      </div>

      {trailer ? (
        <TrailerModal ytId={trailer.ytId} title={trailer.title} onClose={() => setTrailer(null)} />
      ) : null}
    </main>
  );
}
