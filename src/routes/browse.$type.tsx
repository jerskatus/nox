import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PosterGrid } from "@/components/catalog/poster-card";
import { fetchCatalog } from "@/lib/stremio/client";
import { CINEMETA_URL, enabledCatalogs } from "@/lib/stremio/urls";
import { cn } from "@/lib/utils";
import { useAddonStore } from "@/stores/addons";

export const Route = createFileRoute("/browse/$type")({
  beforeLoad: ({ params }) => {
    if (params.type === "channel") throw redirect({ to: "/youtube" });
  },
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
  const addons = useAddonStore((s) => s.addons);
  const catalogs = useMemo(
    () => enabledCatalogs(addons).filter((c) => c.type === type),
    [addons, type],
  );
  const [catalogKey, setCatalogKey] = useState<string | null>(null);
  const [genre, setGenre] = useState<string>("");
  const [skip, setSkip] = useState(0);

  const selected =
    catalogs.find((c) => `${c.transportUrl}:${c.id}` === catalogKey) ?? catalogs[0];

  const genreOptions =
    selected?.extra?.find((e) => e.name === "genre")?.options ??
    (type === "movie" || type === "series"
      ? ["Action", "Comedy", "Drama", "Horror", "Sci-Fi", "Thriller", "Animation", "Documentary"]
      : []);

  const query = useQuery({
    queryKey: ["browse", selected?.transportUrl, selected?.type, selected?.id, genre, skip],
    enabled: Boolean(selected),
    queryFn: () =>
      fetchCatalog(selected!.transportUrl, selected!.type, selected!.id, {
        genre: genre || undefined,
        skip: skip || undefined,
      }),
  });

  const fallback = useQuery({
    queryKey: ["browse-fallback", type],
    enabled: catalogs.length === 0,
    queryFn: () => fetchCatalog(CINEMETA_URL, type, "top"),
  });

  const items = (catalogs.length > 0 ? query.data : fallback.data) ?? [];
  const loading = catalogs.length > 0 ? query.isLoading : fallback.isLoading;

  return (
    <main className="px-4 pb-16 pt-[calc(var(--header-h)+0.75rem)] sm:px-8 lg:px-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Browse</p>
          <h1 className="text-3xl font-semibold">{TYPE_LABEL[type] ?? type}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {genreOptions.length > 0 ? (
            <select
              value={genre}
              onChange={(e) => {
                setGenre(e.target.value);
                setSkip(0);
              }}
              className="h-10 rounded-md border border-border bg-elevated px-3 text-sm"
              aria-label="Genre"
            >
              <option value="">All genres</option>
              {genreOptions.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          ) : null}
          {catalogs.length > 1 ? (
            <select
              value={selected ? `${selected.transportUrl}:${selected.id}` : ""}
              onChange={(e) => {
                setCatalogKey(e.target.value);
                setSkip(0);
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
          <PosterGrid items={items} loading={loading} />
          <div className="mt-8 flex justify-center gap-3">
            <button
              type="button"
              className={cn("h-10 rounded-md border border-border px-4 text-sm", skip === 0 && "opacity-40")}
              disabled={skip === 0}
              onClick={() => setSkip((s) => Math.max(0, s - 50))}
            >
              Previous
            </button>
            <button
              type="button"
              className="h-10 rounded-md border border-border px-4 text-sm"
              onClick={() => setSkip((s) => s + 50)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </main>
  );
}
