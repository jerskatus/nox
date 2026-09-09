import type { Meta } from "@/lib/stremio/types";
import { cleanSynopsis, synopsisFitsHero } from "@/lib/synopsis";

export function TitleAbout({ meta }: { meta: Meta }) {
  const description = cleanSynopsis(meta.description);
  const showSynopsis = description.length > 0 && !synopsisFitsHero(description);
  const cast = names(meta.cast).slice(0, 12);
  const directors = names(meta.director);
  const writers = names(meta.writer);
  const countries = names(meta.country);
  const genres = [...(meta.genres ?? meta.genre ?? [])].filter(Boolean);
  const videos = meta.videos ?? [];
  const seasonCount = new Set(videos.map((v) => v.season).filter((s): s is number => typeof s === "number" && s > 0)).size;
  const episodeCount = videos.filter((v) => (v.season ?? 0) > 0 || v.episode || v.number).length;
  const series = meta.type === "series";
  const hasCredits = Boolean(
    showSynopsis ||
      cast.length ||
      directors.length ||
      writers.length ||
      genres.length ||
      meta.runtime ||
      countries.length ||
      meta.awards ||
      (series && (seasonCount || episodeCount)),
  );
  if (!hasCredits) return null;

  return (
    <section className="px-4 py-10 sm:px-8 lg:px-12">
      <h2 className="mb-6 text-xl font-semibold tracking-tight">About {meta.name}</h2>
      <div
        className={
          showSynopsis
            ? "grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(16rem,0.85fr)] lg:gap-16"
            : "max-w-xl"
        }
      >
        {showSynopsis ? (
          <p className="max-w-3xl text-base leading-relaxed text-fg/90">{description}</p>
        ) : null}
        <dl className="grid content-start gap-4">
          <AboutRow label="Cast" value={join(cast)} />
          <AboutRow
            label={series ? "Created by" : directors.length > 1 ? "Directors" : "Director"}
            value={join(directors)}
          />
          <AboutRow label={writers.length > 1 ? "Writers" : "Writer"} value={join(writers)} />
          <AboutRow label="Genres" value={join(genres)} />
          {series ? (
            <AboutRow
              label="This show"
              value={[
                seasonCount > 0 ? `${seasonCount} season${seasonCount === 1 ? "" : "s"}` : null,
                episodeCount > 0 ? `${episodeCount} episodes` : null,
                meta.releaseInfo ?? (meta.year ? String(meta.year) : null),
              ]
                .filter(Boolean)
                .join(" · ")}
            />
          ) : (
            <AboutRow
              label="This movie"
              value={[meta.runtime, meta.releaseInfo ?? (meta.year ? String(meta.year) : null)].filter(Boolean).join(" · ")}
            />
          )}
          {series && meta.runtime ? <AboutRow label="Episode length" value={meta.runtime} /> : null}
          <AboutRow label="Country" value={join(countries)} />
          <AboutRow label="Awards" value={meta.awards?.trim() || null} />
        </dl>
      </div>
    </section>
  );
}

function AboutRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-subtle">{label}</dt>
      <dd className="mt-1 text-sm leading-relaxed text-fg">{value}</dd>
    </div>
  );
}

function names(value?: string[] | string) {
  if (!value) return [];
  const list = Array.isArray(value) ? value : value.split(/,|\band\b/i);
  return list.map((item) => item.trim()).filter(Boolean);
}

function join(list: string[]) {
  return list.length ? list.join(", ") : null;
}
