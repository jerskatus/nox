import { createFileRoute, Link } from "@tanstack/react-router";
import { PosterGrid } from "@/components/catalog/poster-card";
import { useLibraryStore } from "@/stores/library";

export const Route = createFileRoute("/list")({
  component: ListPage,
});

function ListPage() {
  const list = useLibraryStore((s) => s.list);

  return (
    <main className="px-4 pb-16 pt-[calc(var(--header-h)+0.75rem)] sm:px-8 lg:px-12">
      <h1 className="mb-6 text-3xl font-semibold">My list</h1>
      {list.length === 0 ? (
        <div className="rounded-lg bg-surface p-10 text-center">
          <p className="text-lg font-medium">Your list is empty</p>
          <p className="mt-2 text-sm text-muted">Save titles from a detail page to find them here.</p>
          <Link to="/" className="mt-4 inline-block text-sm underline">
            Browse the board
          </Link>
        </div>
      ) : (
        <PosterGrid items={list} />
      )}
    </main>
  );
}
