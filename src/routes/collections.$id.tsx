import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PosterGrid } from "@/components/catalog/poster-card";
import { getCollection } from "@/lib/stremio/collections";
import { loadJsonMany } from "@/lib/stremio/client";
import type { MetaPreview } from "@/lib/stremio/types";
import { CINEMETA_URL, resourceUrl } from "@/lib/stremio/urls";

export const Route = createFileRoute("/collections/$id")({
  component: CollectionPage,
});

function CollectionPage() {
  const { id } = Route.useParams();
  const collection = getCollection(id);
  if (!collection) throw notFound();

  const query = useQuery({
    queryKey: ["collection", collection.id],
    queryFn: async () => {
      const urls = collection.items.map((item) => resourceUrl(CINEMETA_URL, "meta", item.type, item.id));
      const results = await loadJsonMany(urls);
      const byId = new Map<string, MetaPreview>();
      for (const result of results) {
        if (!result.ok) continue;
        const meta = (result.data as { meta?: MetaPreview } | null)?.meta;
        if (meta?.id) byId.set(meta.id, meta);
      }
      return collection.items.map((item) => {
        const meta = byId.get(item.id);
        return (
          meta ?? {
            id: item.id,
            type: item.type,
            name: item.name,
            poster: `https://images.metahub.space/poster/medium/${item.id}/img`,
          }
        );
      });
    },
    staleTime: 600_000,
  });

  return (
    <main className="px-4 pb-20 pt-[calc(var(--header-h)+0.75rem)] sm:px-8 lg:px-12">
      <p className="mb-2 text-sm">
        <Link to="/collections" className="text-muted hover:text-fg">
          Collections
        </Link>
        <span className="text-subtle"> / {collection.title}</span>
      </p>
      <h1 className="text-3xl font-semibold">{collection.title}</h1>
      <p className="mt-2 mb-8 text-muted">
        {collection.hint} · {collection.items.length} titles
      </p>
      <PosterGrid items={query.data ?? []} loading={query.isLoading} />
    </main>
  );
}
