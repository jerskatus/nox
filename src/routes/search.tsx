import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Sparkles, Search as SearchIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { PosterCard } from "@/components/catalog/poster-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PosterSkeleton } from "@/components/ui/skeleton";
import { ASK_PROMPTS, smartSearch } from "@/lib/stremio/ai-search";
import type { MetaPreview } from "@/lib/stremio/types";
import { useEnabledAddons } from "@/stores/addons";

type Search = { q?: string };

export const Route = createFileRoute("/search")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    q: typeof s.q === "string" ? s.q : "",
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q = "" } = Route.useSearch();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(q);
  const addons = useEnabledAddons();

  useEffect(() => {
    setDraft(q);
  }, [q]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = draft.trim();
      if (next === q.trim()) return;
      void navigate({ to: "/search", search: { q: next }, replace: true });
    }, 380);
    return () => window.clearTimeout(handle);
  }, [draft, q, navigate]);

  function go(next: string) {
    setDraft(next);
    void navigate({ to: "/search", search: { q: next } });
  }

  const query = useQuery({
    queryKey: ["smart-search", q, addons.map((a) => a.transportUrl).join("|")],
    enabled: q.trim().length >= 2,
    queryFn: () => smartSearch(q.trim(), addons),
    staleTime: 60_000,
  });

  const intent = query.data?.intent;
  const items = query.data?.items ?? [];
  const movies = items.filter((item) => item.type === "movie");
  const shows = items.filter((item) => item.type === "series" || item.type === "tv");
  const other = items.filter((item) => item.type !== "movie" && item.type !== "series" && item.type !== "tv");

  return (
    <main className="px-4 pb-16 pt-[calc(var(--header-h)+0.75rem)] sm:px-8 lg:px-12">
      <form
        className="sticky top-[var(--header-h)] z-40 mx-auto mb-6 flex max-w-2xl gap-2 bg-bg py-3"
        onSubmit={(e) => {
          e.preventDefault();
          go(draft.trim());
        }}
      >
        <div className="relative min-w-0 flex-1">
          <Sparkles className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-accent" />
          <Input
            id="app-search"
            type="search"
            enterKeyHint="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask anything — ‘shows like The Bear’, ‘90s romcoms’"
            className="h-12 pl-10 text-base"
            autoFocus
            autoComplete="off"
            aria-label="Search"
          />
        </div>
        <Button type="submit" variant="play" className="h-12 shrink-0 px-5">
          <SearchIcon className="size-4" />
          Search
        </Button>
      </form>

      {!q.trim() ? (
        <div className="mx-auto max-w-2xl">
          <p className="mb-4 text-center text-sm text-muted">
            Ask in plain English. Nox reads the request, then searches every installed catalog.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {ASK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => go(prompt)}
                className="rounded-full border border-border bg-elevated px-3 py-2 text-sm text-fg touch-manipulation hover:border-fg/40"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      ) : q.trim().length < 2 ? (
        <p className="text-center text-muted">Type at least 2 characters.</p>
      ) : (
        <>
          {intent?.chips.length ? (
            <div className="mb-6 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium tracking-wide text-subtle uppercase">Nox understood</span>
              {intent.chips.map((chip) => (
                <span key={chip} className="rounded-full bg-elevated px-3 py-1 text-xs text-muted">
                  {chip}
                </span>
              ))}
            </div>
          ) : null}

          {query.isLoading ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <PosterSkeleton key={i} />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="text-center text-muted">Nothing matched “{q}”. Try a title, a vibe, or “like …”.</p>
          ) : (
            <div className="flex flex-col gap-10">
              {intent?.type || !(movies.length && shows.length) ? (
                <ResultGrid title={intent?.ask ? "Best matches" : "Results"} items={items} />
              ) : (
                <>
                  <ResultGrid title="Movies" items={movies} />
                  <ResultGrid title="TV shows" items={shows} />
                  <ResultGrid title="More" items={other} />
                </>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}

function ResultGrid({ title, items }: { title: string; items: MetaPreview[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 sm:gap-3">
        {items.map((item) => (
          <div key={`${item.type}:${item.id}`} className="min-w-0 [&>a]:w-full [&>a]:max-w-full">
            <PosterCard item={item} className="w-full max-w-full" />
          </div>
        ))}
      </div>
    </section>
  );
}
