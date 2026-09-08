import { cn } from "@/lib/utils";

export function TitleMeta({
  year,
  rating,
  runtime,
  genres = [],
  className,
}: {
  year?: string | number | null;
  rating?: string | null;
  runtime?: string | null;
  genres?: string[];
  className?: string;
}) {
  const chips = genres.filter(Boolean).slice(0, 4);
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {year ? <span className="text-sm font-medium tabular-nums text-fg">{year}</span> : null}
      {rating ? (
        <span className="inline-flex overflow-hidden rounded-sm shadow-[var(--shadow-border)]">
          <span className="bg-imdb px-1.5 py-0.5 text-2xs font-black leading-none tracking-tight text-imdb-fg">
            IMDb
          </span>
          <span className="bg-bg/80 px-1.5 py-0.5 text-2xs font-semibold tabular-nums leading-none text-fg">
            {rating}
          </span>
        </span>
      ) : null}
      {runtime ? <span className="text-sm text-muted">{runtime}</span> : null}
      {chips.map((genre) => (
        <span
          key={genre}
          className="rounded-full bg-fg/10 px-2.5 py-1 text-xs font-medium text-fg"
        >
          {genre}
        </span>
      ))}
    </div>
  );
}
