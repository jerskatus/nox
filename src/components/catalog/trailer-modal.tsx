import { Play, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { isNoxDesktop } from "@/lib/desktop";
import { unlockMediaPlayback } from "@/lib/utils";

export function TrailerModal({
  ytId,
  title,
  onClose,
}: {
  ytId: string;
  title: string;
  onClose: () => void;
}) {
  const [active, setActive] = useState(() => isNoxDesktop());
  const origin = typeof window !== "undefined" ? window.location.origin : "";

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
          {active ? (
            <iframe
              title={`${title} trailer`}
              className="absolute inset-0 size-full"
              src={`https://www.youtube.com/embed/${encodeURIComponent(ytId)}?autoplay=1&mute=0&playsinline=1&rel=0&enablejsapi=1&origin=${encodeURIComponent(origin)}`}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          ) : (
            <>
              <img
                src={`https://i.ytimg.com/vi/${encodeURIComponent(ytId)}/hqdefault.jpg`}
                alt=""
                className="absolute inset-0 size-full object-cover opacity-60"
              />
              <button
                type="button"
                className="absolute inset-0 z-10 grid place-items-center"
                onClick={() => {
                  unlockMediaPlayback();
                  setActive(true);
                }}
              >
                <span className="flex items-center gap-3 rounded-full bg-fg px-8 py-4 text-lg font-semibold text-bg shadow-xl">
                  <Play className="size-6 fill-current" />
                  Play with sound
                </span>
              </button>
            </>
          )}
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