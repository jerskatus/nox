import { X } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export function TrailerModal({
  ytId,
  title,
  onClose,
}: {
  ytId: string;
  title: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-bg/85 p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-4xl overflow-hidden rounded-lg bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <p className="truncate font-semibold">{title} · Trailer</p>
          <Button variant="ghost" size="icon-sm" className="bg-transparent" onClick={onClose} aria-label="Close trailer">
            <X className="size-5" />
          </Button>
        </div>
        <div className="relative aspect-wide bg-bg">
          <iframe
            title={`${title} trailer`}
            className="absolute inset-0 size-full"
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(ytId)}?autoplay=1&rel=0`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}

export function trailerYoutubeId(item: {
  trailerStreams?: Array<{ ytId?: string }>;
  trailers?: Array<{ source?: string; ytId?: string }>;
}) {
  return item.trailerStreams?.[0]?.ytId ?? item.trailers?.[0]?.source ?? item.trailers?.[0]?.ytId ?? null;
}
