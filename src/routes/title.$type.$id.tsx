import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Info, Play, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { CatalogRow } from "@/components/catalog/row";
import { watchPath } from "@/components/catalog/poster-card";
import { TitleAbout } from "@/components/catalog/title-about";
import { TitleMeta } from "@/components/catalog/title-meta";
import { TrailerModal, trailerYoutubeId } from "@/components/catalog/trailer-modal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { defaultVideoId, fetchCatalog, fetchMeta, videoTitle } from "@/lib/stremio/client";
import { CINEMETA_URL } from "@/lib/stremio/urls";
import type { Meta, Video } from "@/lib/stremio/types";
import { useEnabledAddons } from "@/stores/addons";
import { isWatched, progressFor, progressRatio, useLibraryStore } from "@/stores/library";
import { cn, decodeId, formatRating } from "@/lib/utils";

export const Route = createFileRoute("/title/$type/$id")({
  loader: async ({ params }) => {
    const type = params.type;
    const id = decodeId(params.id);
    if (id.startsWith("tt")) {
      try {
        const meta = await fetchMeta(
          [
            {
              transportUrl: CINEMETA_URL,
              manifest: {
                id: "com.linvo.cinemeta",
                name: "Cinemeta",
                types: ["movie", "series"],
                resources: ["meta"],
                catalogs: [],
                idPrefixes: ["tt"],
              },
              enabled: true,
              installedAt: 0,
            },
          ],
          type,
          id,
        );
        return { meta };
      } catch {
        return { meta: null as Meta | null };
      }
    }
    return { meta: null as Meta | null };
  },
  component: TitlePage,
});

function TitlePage() {
  const { type, id: rawId } = Route.useParams();
  const id = decodeId(rawId);
  const preloaded = Route.useLoaderData().meta;
  const addons = useEnabledAddons();

  const metaQuery = useQuery({
    queryKey: ["meta", type, id, addons.map((a) => a.transportUrl).join("|")],
    queryFn: () => fetchMeta(addons, type, id),
    initialData: preloaded ?? undefined,
    enabled: !preloaded,
  });

  const meta = metaQuery.data ?? preloaded;

  if (metaQuery.isLoading && !meta) {
    return (
      <main className="pt-16">
        <Skeleton className="h-[60vh] w-full rounded-none" />
      </main>
    );
  }

  if (!meta) {
    return (
      <main className="px-6 pt-32 text-center">
        <Info className="mx-auto mb-3 size-8 text-muted" />
        <h1 className="text-2xl font-semibold">Title not found</h1>
        <p className="mt-2 text-muted">No installed add-on returned metadata for this item.</p>
        <Link to="/addons" className="mt-4 inline-block text-sm underline">
          Manage add-ons
        </Link>
      </main>
    );
  }

  return <TitleBody meta={meta} />;
}

function TitleBody({ meta }: { meta: Meta }) {
  const inList = useLibraryStore((s) => s.list.some((e) => e.id === meta.id));
  const toggleList = useLibraryStore((s) => s.toggleList);
  const progress = useLibraryStore((s) => s.progress.find((p) => p.id === meta.id));
  const rating = formatRating(meta.imdbRating);
  const genres = (meta.genres ?? meta.genre ?? []).slice(0, 6);
  const videos = meta.videos ?? [];
  const seasons = useMemo(() => {
    const set = new Set<number>();
    for (const video of videos) {
      if (typeof video.season === "number") set.add(video.season);
    }
    return [...set].sort((a, b) => a - b);
  }, [videos]);
  const [season, setSeason] = useState(() => {
    if (progress?.season) return progress.season;
    return seasons.find((s) => s > 0) ?? seasons[0] ?? 1;
  });
  const episodes = videos
    .filter((v) => (v.season ?? 0) === season)
    .sort((a, b) => (a.episode ?? a.number ?? 0) - (b.episode ?? b.number ?? 0));

  const similar = useQuery({
    queryKey: ["similar", meta.type, meta.genres?.[0]],
    enabled: Boolean(meta.genres?.[0]),
    queryFn: () => fetchCatalog(CINEMETA_URL, meta.type, "top", { genre: meta.genres![0] }),
  });
  const trailer = trailerYoutubeId(meta);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const playId = progress?.videoId ?? defaultVideoId(meta);
  const play = watchPath(meta, playId === meta.id ? undefined : playId, { auto: Boolean(progress) });

  return (
    <main>
      <section className="relative h-[min(88svh,46rem)] min-h-[32rem] overflow-hidden">
        {meta.background || meta.poster ? (
          <img
            src={meta.background || meta.poster}
            alt=""
            className="absolute inset-0 size-full object-cover object-[center_20%]"
          />
        ) : null}
        <div className="hero-side absolute inset-0" />
        <div className="hero-mask absolute inset-0" />
        <div className="relative z-10 flex h-full min-h-[32rem] flex-col justify-end px-4 pb-10 pt-28 sm:px-8 lg:px-12">
          <div className="flex max-w-5xl items-end gap-8">
            {meta.poster ? (
              <div className="hidden w-44 shrink-0 overflow-hidden rounded-lg shadow-[var(--shadow-border)] sm:block lg:w-52">
                <img
                  src={meta.poster}
                  alt=""
                  className="aspect-poster w-full object-cover outline outline-1 -outline-offset-1 outline-fg/10"
                />
              </div>
            ) : null}
            <div className="hero-lockup min-w-0 max-w-2xl flex-1">
              {meta.logo ? (
                <img
                  src={meta.logo}
                  alt={meta.name}
                  className="mb-4 h-16 w-auto max-w-sm object-contain drop-shadow-md sm:h-24"
                />
              ) : (
                <h1 className="mb-4 font-display text-5xl leading-none tracking-wide sm:text-7xl">{meta.name}</h1>
              )}
              <TitleMeta
                className="mb-4"
                year={meta.year ?? meta.releaseInfo}
                rating={rating}
                runtime={meta.runtime}
                genres={genres}
              />
              {meta.description ? (
                <p className="mb-6 line-clamp-3 max-w-xl text-sm leading-relaxed text-fg/90 sm:text-base">
                  {meta.description}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <Button asChild variant="play" size="lg" className="rounded-full px-8">
                  <Link {...play}>
                    <Play className="ml-0.5 size-5 fill-current" />
                    {progress ? "Resume" : "Play"}
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  className="rounded-full"
                  onClick={() =>
                    toggleList({
                      id: meta.id,
                      type: meta.type,
                      name: meta.name,
                      poster: meta.poster,
                      background: meta.background,
                      logo: meta.logo,
                      description: meta.description,
                      year: meta.year,
                      releaseInfo: meta.releaseInfo,
                      imdbRating: meta.imdbRating,
                      genres: meta.genres,
                      posterShape: meta.posterShape,
                      runtime: meta.runtime,
                    })
                  }
                >
                  {inList ? <Check className="size-5" /> : <Plus className="size-5" />}
                  {inList ? "On my list" : "My list"}
                </Button>
                {trailer ? (
                  <Button variant="ghost" size="lg" className="rounded-full" onClick={() => setTrailerOpen(true)}>
                    Trailer
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      <TitleAbout meta={meta} />

      {episodes.length > 0 ? (
        <section className="px-4 py-10 sm:px-8 lg:px-12">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Episodes</h2>
              <SeasonCount episodes={episodes} />
            </div>
            {seasons.length > 1 ? (
              <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Season">
                {seasons.map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="tab"
                    aria-selected={season === s}
                    onClick={() => setSeason(s)}
                    className={cn(
                      "h-11 shrink-0 rounded-full px-4 text-sm font-medium transition-[background-color,color] duration-150",
                      season === s ? "bg-fg text-bg" : "bg-elevated text-muted hover:text-fg",
                    )}
                  >
                    {s === 0 ? "Specials" : `Season ${s}`}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="grid gap-3">
            {episodes.map((episode) => (
              <EpisodeRow key={episode.id} meta={meta} episode={episode} />
            ))}
          </div>
        </section>
      ) : null}

      <div className="pb-16">
        {similar.data && similar.data.length > 0 ? (
          <CatalogRow title="More like this" items={similar.data.filter((item) => item.id !== meta.id)} />
        ) : null}
      </div>
      {trailerOpen && trailer ? (
        <TrailerModal ytId={trailer} title={meta.name} onClose={() => setTrailerOpen(false)} />
      ) : null}
    </main>
  );
}

function SeasonCount({ episodes }: { episodes: Video[] }) {
  const watched = useLibraryStore((s) => s.watched);
  const progress = useLibraryStore((s) => s.progress);
  const done = episodes.filter((episode) => isWatched(episode.id, watched, progress)).length;
  if (episodes.length === 0) return null;
  return (
    <p className="mt-0.5 text-sm text-muted">
      {done === 0 ? `${episodes.length} episodes` : `${done} of ${episodes.length} watched`}
    </p>
  );
}

function EpisodeRow({ meta, episode }: { meta: Meta; episode: Video }) {
  const href = watchPath(meta, episode.id);
  const n = episode.episode ?? episode.number;
  const watchedIds = useLibraryStore((s) => s.watched);
  const progressList = useLibraryStore((s) => s.progress);
  const done = isWatched(episode.id, watchedIds, progressList);
  const stored = progressFor(episode.id, progressList);
  const ratio = stored && !done ? progressRatio(stored) : 0;
  const inProgress = ratio > 0.02 && ratio < 0.92;

  return (
    <Link
      {...href}
      className={cn(
        "group flex gap-3 rounded-lg bg-surface p-2 shadow-[var(--shadow-border)] transition-[background-color] duration-150 touch-manipulation hover:bg-elevated sm:p-3",
        done && "opacity-70",
      )}
    >
      <div className="relative h-24 w-40 shrink-0 overflow-hidden rounded-md sm:h-28 sm:w-52">
        {episode.thumbnail ? (
          <img src={episode.thumbnail} alt="" className="size-full object-cover outline outline-1 -outline-offset-1 outline-fg/10" />
        ) : (
          <div className="grid size-full place-items-center bg-elevated text-2xl text-subtle">{n ?? ""}</div>
        )}
        <span className="absolute inset-0 grid place-items-center bg-bg/35 opacity-100 transition-opacity duration-150 fine-hover:opacity-0 fine-hover:group-hover:opacity-100">
          <span className="grid size-10 place-items-center rounded-full bg-fg text-bg shadow-md">
            <Play className="ml-0.5 size-4 fill-current" />
          </span>
        </span>
        {done ? (
          <span className="absolute top-1.5 left-1.5 grid size-7 place-items-center rounded-full bg-fg text-bg">
            <Check className="size-3.5" />
          </span>
        ) : null}
        {inProgress ? (
          <div className="absolute inset-x-2 bottom-1.5 h-1 overflow-hidden rounded-full bg-fg/20">
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(ratio * 100)}%` }} />
          </div>
        ) : null}
      </div>
      <div className="min-w-0 py-1">
        <p className={cn("truncate font-medium", done && "text-muted")}>
          {n ? `${n}. ` : ""}
          {videoTitle(episode)}
          {inProgress ? <span className="ml-2 text-xs font-semibold text-fg">Resume</span> : null}
        </p>
        <p className="mt-1 line-clamp-2 text-sm text-muted">{episode.overview ?? episode.description ?? ""}</p>
      </div>
    </Link>
  );
}
