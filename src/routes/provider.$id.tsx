import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PosterCard } from "@/components/catalog/poster-card";
import { ProviderMark } from "@/components/catalog/provider-mark";
import { PosterSkeleton } from "@/components/ui/skeleton";
import { fetchCatalog } from "@/lib/stremio/client";
import { providerById } from "@/lib/stremio/providers";
import { STREAMING_CATALOGS_URL } from "@/lib/stremio/urls";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/provider/$id")({
  component: ProviderPage,
});

function ProviderPage() {
  const { id } = Route.useParams();
  const provider = providerById(id);
  const [kind, setKind] = useState<"movie" | "series">("movie");

  const query = useQuery({
    queryKey: ["provider", provider?.catalogId, kind],
    enabled: Boolean(provider),
    queryFn: () => fetchCatalog(STREAMING_CATALOGS_URL, kind, provider!.catalogId),
    staleTime: 300_000,
  });

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

  const items = query.data ?? [];

  return (
    <main className="px-4 pb-16 pt-[calc(var(--header-h)+0.75rem)] sm:px-8 lg:px-12">
      <div className="mb-6 flex items-center gap-4">
        <span
          className="relative grid size-14 place-items-center overflow-hidden rounded-2xl ring-1 ring-fg/15"
          style={{ backgroundColor: provider.bg }}
        >
          <ProviderMark provider={provider} />
        </span>
        <div>
          <p className="text-sm text-muted">Browse by provider</p>
          <h1 className="text-3xl font-semibold">{provider.name}</h1>
        </div>
      </div>

      <div className="mb-6 flex gap-2">
        {(["movie", "series"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setKind(tab)}
            className={cn(
              "h-11 rounded-full px-5 text-sm font-semibold touch-manipulation",
              kind === tab ? "bg-fg text-bg" : "bg-elevated text-muted",
            )}
          >
            {tab === "movie" ? "Movies" : "Series"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 sm:gap-3">
        {query.isLoading
          ? Array.from({ length: 12 }).map((_, i) => <PosterSkeleton key={i} />)
          : items.map((item) => (
              <PosterCard key={`${item.type}:${item.id}`} item={item} className="w-full max-w-full" />
            ))}
      </div>
      {!query.isLoading && items.length === 0 ? (
        <p className="mt-10 text-center text-muted">Nothing listed for {provider.name} right now.</p>
      ) : null}
    </main>
  );
}
