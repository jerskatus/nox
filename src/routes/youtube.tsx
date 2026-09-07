import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ExternalLink, Play, Search as SearchIcon, Youtube } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { GoogleAccountCard } from "@/components/google-connect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KeyboardToggle, OnscreenKeyboard } from "@/components/ui/onscreen-keyboard";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchRecommended } from "@/lib/google-youtube";
import {
  fetchYoutube,
  isYtTab,
  ytEmbed,
  ytThumb,
  YT_TABS,
  type YtTabId,
  type YtVideo,
} from "@/lib/youtube";
import { googleLive, useGoogleStore } from "@/stores/google";
import { cn } from "@/lib/utils";

type Search = { q?: string; v?: string; tab?: YtTabId };

export const Route = createFileRoute("/youtube")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    q: typeof s.q === "string" ? s.q : "",
    v: typeof s.v === "string" && /^[a-zA-Z0-9_-]{11}$/.test(s.v) ? s.v : undefined,
    tab: typeof s.tab === "string" && isYtTab(s.tab) ? s.tab : undefined,
  }),
  component: YoutubePage,
});

function YoutubePage() {
  const { q = "", v, tab } = Route.useSearch();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(q);
  const [keysOpen, setKeysOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const google = useGoogleStore();
  const connected = googleLive(google);
  const activeTab: YtTabId = tab ?? (connected ? "recommended" : "trending");
  const wantsRec = !q.trim() && activeTab === "recommended";

  useEffect(() => {
    setDraft(q);
  }, [q]);

  const query = useQuery({
    queryKey: ["youtube", "v2", q, activeTab],
    enabled: !wantsRec,
    queryFn: () => fetchYoutube({ data: { q: q.trim() || undefined, tab: q.trim() ? undefined : activeTab } }),
    staleTime: 120_000,
  });

  const recQuery = useQuery({
    queryKey: ["youtube", "recommended", google.accessToken],
    enabled: wantsRec && connected && Boolean(google.accessToken),
    queryFn: () => fetchRecommended(google.accessToken!),
    staleTime: 120_000,
  });

  const videos = wantsRec ? (recQuery.data ?? []) : (query.data?.videos ?? []);
  const loading = wantsRec ? recQuery.isLoading : query.isLoading;
  const recError = recQuery.error instanceof Error ? recQuery.error.message : null;
  const playing = videos.find((item) => item.id === v);
  const related = useMemo(() => {
    if (!v) return videos;
    const rest = videos.filter((item) => item.id !== v);
    return rest.length > 0 ? rest : videos;
  }, [videos, v]);

  function go(next: { q?: string; v?: string; tab?: YtTabId }) {
    const nextQ = next.q !== undefined ? next.q : q;
    void navigate({
      to: "/youtube",
      search: {
        q: nextQ,
        v: next.v,
        tab: nextQ.trim() ? undefined : (next.tab ?? activeTab),
      },
    });
  }

  return (
    <main className="px-4 pb-16 pt-[calc(var(--header-h)+0.75rem)] sm:px-8 lg:px-12">
      <form
        className="sticky top-[var(--header-h)] z-30 mb-4 flex items-center gap-2 bg-bg py-3"
        onSubmit={(e) => {
          e.preventDefault();
          go({ q: draft.trim(), v });
        }}
      >
        <Youtube className="hidden size-7 shrink-0 text-accent sm:block" />
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input
            ref={inputRef}
            type="search"
            enterKeyHint="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search YouTube"
            className="h-12 pr-12 pl-10 text-base"
            autoComplete="off"
            inputMode={keysOpen ? "none" : "search"}
            aria-label="Search YouTube"
            suppressHydrationWarning
          />
          <KeyboardToggle open={keysOpen} onClick={() => setKeysOpen((v) => !v)} />
        </div>
        <Button type="submit" variant="play" className="h-12 shrink-0 px-5">
          Search
        </Button>
      </form>

      <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto pb-1">
        {YT_TABS.map((item) => {
          const on = !q.trim() && activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setDraft("");
                go({ q: "", tab: item.id, v });
              }}
              className={cn(
                "h-10 shrink-0 rounded-full px-4 text-sm font-semibold touch-manipulation",
                on ? "bg-fg text-bg" : "bg-elevated text-muted hover:text-fg",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {v ? (
        <section className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(18rem,1fr)] lg:items-start">
          <div>
            <div className="relative overflow-hidden rounded-md bg-elevated outline outline-1 -outline-offset-1 outline-fg/10 aspect-wide">
              <iframe
                key={v}
                title={playing?.title ?? "YouTube"}
                className="absolute inset-0 size-full"
                src={ytEmbed(v)}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
            <div className="mt-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-lg font-semibold sm:text-xl">{playing?.title ?? "Now playing"}</h1>
                <p className="mt-1 text-sm text-muted">
                  {[playing?.channel, playing?.views, playing?.published].filter(Boolean).join(" · ")}
                </p>
              </div>
              <a
                href={`https://www.youtube.com/watch?v=${v}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm text-muted hover:text-fg"
              >
                <ExternalLink className="size-4" />
                YouTube
              </a>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold tracking-wide text-subtle uppercase">Up next</h2>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
              : related.slice(0, 12).map((item) => (
                  <VideoRow key={item.id} video={item} active={item.id === v} onPlay={() => go({ v: item.id })} />
                ))}
          </div>
        </section>
      ) : null}

      <h2 className="mb-3 text-lg font-semibold">
        {q.trim() ? `Results for “${q.trim()}”` : YT_TABS.find((item) => item.id === activeTab)?.label}
      </h2>
      {wantsRec && !connected ? (
        <div className="mx-auto max-w-md">
          <GoogleAccountCard compact />
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-wide w-full rounded-md" />
          ))}
        </div>
      ) : recError && wantsRec ? (
        <p className="py-16 text-center text-muted">{recError}</p>
      ) : videos.length === 0 ? (
        <p className="py-16 text-center text-muted">
          {wantsRec
            ? "No videos from your subscriptions yet. Subscribe on YouTube, then refresh."
            : "YouTube didn’t return videos for that search. Try another query."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-x-3 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {videos.map((item) => (
            <VideoCard key={item.id} video={item} onPlay={() => go({ v: item.id })} />
          ))}
        </div>
      )}
      {keysOpen ? (
        <OnscreenKeyboard
          value={draft}
          onChange={setDraft}
          onSubmit={() => go({ q: draft.trim(), v })}
          onClose={() => setKeysOpen(false)}
          inputRef={inputRef}
        />
      ) : null}
    </main>
  );
}

function VideoCard({ video, onPlay }: { video: YtVideo; onPlay: () => void }) {
  return (
    <button type="button" onClick={onPlay} className="group w-full min-w-0 text-left touch-manipulation">
      <div className="relative overflow-hidden rounded-md bg-elevated outline outline-1 -outline-offset-1 outline-fg/10 aspect-wide">
        <img
          src={ytThumb(video.id)}
          alt=""
          className="size-full object-cover transition-transform duration-300 ease-out fine-hover:group-hover:scale-105"
          loading="lazy"
        />
        <span className="absolute inset-0 grid place-items-center opacity-0 transition-opacity fine-hover:group-hover:opacity-100">
          <span className="grid size-12 place-items-center rounded-full bg-fg text-bg">
            <Play className="ml-px size-5 fill-current" />
          </span>
        </span>
        {video.live ? (
          <span className="absolute top-2 left-2 rounded-xs bg-accent px-1.5 py-0.5 text-2xs font-bold tracking-wide text-fg uppercase">
            Live
          </span>
        ) : video.duration ? (
          <span className="absolute right-2 bottom-2 rounded-xs bg-bg/85 px-1.5 py-0.5 text-2xs font-semibold tabular-nums text-fg">
            {video.duration}
          </span>
        ) : null}
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-semibold">{video.title}</p>
      <p className="mt-0.5 truncate text-xs text-muted">
        {[video.channel, video.views].filter(Boolean).join(" · ")}
      </p>
    </button>
  );
}

function VideoRow({ video, active, onPlay }: { video: YtVideo; active?: boolean; onPlay: () => void }) {
  return (
    <button
      type="button"
      onClick={onPlay}
      className={cn(
        "flex gap-3 rounded-md p-1.5 text-left touch-manipulation hover:bg-elevated",
        active && "bg-elevated",
      )}
    >
      <span className="relative w-36 shrink-0 overflow-hidden rounded-sm bg-elevated aspect-wide">
        <img src={ytThumb(video.id)} alt="" className="size-full object-cover" loading="lazy" />
        {video.duration ? (
          <span className="absolute right-1 bottom-1 rounded-xs bg-bg/85 px-1 text-2xs font-semibold tabular-nums">
            {video.duration}
          </span>
        ) : null}
      </span>
      <span className="min-w-0 py-0.5">
        <span className="line-clamp-2 text-sm font-semibold">{video.title}</span>
        <span className="mt-1 block truncate text-2xs text-muted">{video.channel}</span>
        {video.views ? <span className="block truncate text-2xs text-subtle">{video.views}</span> : null}
      </span>
    </button>
  );
}
