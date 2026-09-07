import { Link } from "@tanstack/react-router";
import { Play, Youtube } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ytThumb, type YtVideo } from "@/lib/youtube";

export function YoutubeRow({ items, loading }: { items: YtVideo[]; loading?: boolean }) {
  if (!loading && items.length === 0) return null;

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-3 px-4 sm:mb-3 sm:px-8 lg:px-12">
        <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
          <Youtube className="size-5 text-accent" />
          YouTube
        </h2>
        <Link to="/youtube" className="shrink-0 text-sm text-muted touch-manipulation">
          Watch more →
        </Link>
      </div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 sm:gap-3 sm:px-8 lg:px-12">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-wide w-64 shrink-0 rounded-md sm:w-72" />
            ))
          : items.map((video) => <HomeVideoCard key={video.id} video={video} />)}
      </div>
    </section>
  );
}

function HomeVideoCard({ video }: { video: YtVideo }) {
  return (
    <Link
      to="/youtube"
      search={{ v: video.id, tab: "trending" }}
      className="group w-64 shrink-0 text-left touch-manipulation sm:w-72"
    >
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
        {video.duration ? (
          <span className="absolute right-2 bottom-2 rounded-xs bg-bg/85 px-1.5 py-0.5 text-2xs font-semibold tabular-nums text-fg">
            {video.duration}
          </span>
        ) : null}
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-semibold">{video.title}</p>
      <p className="truncate text-xs text-muted">{video.channel}</p>
    </Link>
  );
}
