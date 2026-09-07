import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Sparkles, Search as SearchIcon, Type } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { PosterGrid } from "@/components/catalog/poster-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KeyboardToggle, OnscreenKeyboard } from "@/components/ui/onscreen-keyboard";
import { ASK_PROMPTS, runSearch } from "@/lib/stremio/ai-search";
import type { MetaPreview } from "@/lib/stremio/types";
import { cn } from "@/lib/utils";
import { useEnabledAddons } from "@/stores/addons";

type SearchMode = "smart" | "title";
type Search = { q?: string; mode?: SearchMode };

const MODE_KEY = "nox-search-mode";

export const Route = createFileRoute("/search")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    q: typeof s.q === "string" ? s.q : "",
    mode: s.mode === "title" || s.mode === "smart" ? s.mode : undefined,
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q = "", mode: urlMode } = Route.useSearch();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(q);
  const [storedMode, setStoredMode] = useState<SearchMode>("smart");
  const [keysOpen, setKeysOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const addons = useEnabledAddons();
  const mode: SearchMode = urlMode ?? storedMode;

  useEffect(() => {
    const stored = window.localStorage.getItem(MODE_KEY);
    if (stored === "title" || stored === "smart") setStoredMode(stored);
  }, []);

  useEffect(() => {
    setDraft(q);
  }, [q]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = draft.trim();
      if (next === q.trim()) return;
      void navigate({ to: "/search", search: { q: next, mode }, replace: true });
    }, mode === "smart" ? 700 : 380);
    return () => window.clearTimeout(handle);
  }, [draft, q, mode, navigate]);

  function go(next: string, nextMode: SearchMode = mode) {
    setDraft(next);
    window.localStorage.setItem(MODE_KEY, nextMode);
    setStoredMode(nextMode);
    void navigate({ to: "/search", search: { q: next, mode: nextMode } });
  }

  function setMode(next: SearchMode) {
    window.localStorage.setItem(MODE_KEY, next);
    setStoredMode(next);
    void navigate({ to: "/search", search: { q, mode: next }, replace: true });
  }

  const query = useQuery({
    queryKey: ["catalog-search", mode, q, addons.map((a) => a.transportUrl).join("|")],
    enabled: q.trim().length >= 2,
    queryFn: () => runSearch(q.trim(), addons, mode),
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
        className="sticky top-[var(--header-h)] z-40 mx-auto mb-3 flex max-w-2xl gap-2 bg-bg py-3"
        onSubmit={(e) => {
          e.preventDefault();
          go(draft.trim());
        }}
      >
        <div className="relative min-w-0 flex-1">
          {mode === "smart" ? (
            <Sparkles className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-accent" />
          ) : (
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          )}
          <Input
            ref={inputRef}
            id="app-search"
            type="search"
            enterKeyHint="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              mode === "smart"
                ? "Ask anything — ‘shows like The Bear’, ‘90s romcoms’"
                : "Search titles — ‘The Bear’, ‘Dune’"
            }
            className="h-12 pr-12 pl-10 text-base"
            autoFocus
            autoComplete="off"
            inputMode={keysOpen ? "none" : "search"}
            aria-label="Search"
          />
          <KeyboardToggle open={keysOpen} onClick={() => setKeysOpen((v) => !v)} />
        </div>
        <Button type="submit" variant="play" className="h-12 shrink-0 px-5">
          <SearchIcon className="size-4" />
          Search
        </Button>
      </form>

      <div className="mx-auto mb-6 flex max-w-2xl justify-center">
        <div
          role="tablist"
          aria-label="Search mode"
          className="grid w-full max-w-xs grid-cols-2 rounded-full bg-elevated p-1"
        >
          <ModeTab
            active={mode === "title"}
            icon={<Type className="size-3.5" />}
            label="Title"
            onClick={() => setMode("title")}
          />
          <ModeTab
            active={mode === "smart"}
            icon={<Sparkles className="size-3.5" />}
            label="Smart"
            onClick={() => setMode("smart")}
          />
        </div>
      </div>

      {!q.trim() ? (
        <div className="mx-auto max-w-2xl">
          <p className="mb-4 text-center text-sm text-muted">
            {mode === "smart"
              ? "Ask in plain English. Nox reads the request, then searches every installed catalog."
              : "Search by the title as written. No guessing — just name matches."}
          </p>
          {mode === "smart" ? (
            <div className="flex flex-wrap justify-center gap-2">
              {ASK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => go(prompt, "smart")}
                  className="rounded-full border border-border bg-elevated px-3 py-2 text-sm text-fg touch-manipulation hover:border-fg/40"
                >
                  {prompt}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : q.trim().length < 2 ? (
        <p className="text-center text-muted">Type at least 2 characters.</p>
      ) : (
        <>
          {mode === "smart" && intent?.chips.length ? (
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
            <PosterGrid loading />
          ) : items.length === 0 ? (
            <p className="text-center text-muted">
              {mode === "smart"
                ? `Nothing matched “${q}”. Try a title, a vibe, or “like …”.`
                : `No titles named “${q}”. Switch to Smart to search by plot.`}
            </p>
          ) : (
            <div className="flex flex-col gap-10">
              {mode === "title" || intent?.type || !(movies.length && shows.length) ? (
                <ResultGrid title={mode === "smart" ? "Best matches" : "Results"} items={items} />
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
      {keysOpen ? (
        <OnscreenKeyboard
          value={draft}
          onChange={setDraft}
          onSubmit={() => go(draft.trim())}
          onClose={() => setKeysOpen(false)}
          inputRef={inputRef}
        />
      ) : null}
    </main>
  );
}

function ModeTab({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-10 min-h-10 items-center justify-center gap-1.5 rounded-full text-sm font-semibold touch-manipulation transition-colors",
        active ? "bg-fg text-bg" : "text-muted hover:text-fg",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function ResultGrid({ title, items }: { title: string; items: MetaPreview[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <PosterGrid items={items} />
    </section>
  );
}
