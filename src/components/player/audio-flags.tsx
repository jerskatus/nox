import type { SpokenFlag } from "@/lib/stremio/stream-rank";
import { cn } from "@/lib/utils";

export function FlagMark({
  code,
  label,
  className,
}: {
  code: string;
  label?: string;
  className?: string;
}) {
  const cc = code.toLowerCase() === "uk" ? "gb" : code.toLowerCase();
  if (!/^[a-z]{2}$/.test(cc)) return null;
  return (
    <img
      src={`https://flagcdn.com/w40/${cc}.png`}
      alt={label || cc.toUpperCase()}
      title={label || cc.toUpperCase()}
      className={cn(
        "inline-block h-3.5 w-5 shrink-0 rounded-[2px] object-cover shadow-[0_0_0_1px_rgb(255_255_255/0.14)]",
        className,
      )}
      loading="lazy"
      draggable={false}
    />
  );
}

export function FlagRow({
  flags,
  className,
  max = 3,
}: {
  flags: SpokenFlag[];
  className?: string;
  max?: number;
}) {
  if (flags.length === 0) return null;
  const shown = flags.slice(0, max);
  const extra = flags.length - shown.length;
  const label = flags.map((flag) => flag.label).join(" + ");
  return (
    <span className={cn("inline-flex max-w-full items-center gap-1 overflow-hidden", className)} title={label} aria-label={label}>
      {shown.map((flag) => (
        <FlagMark key={flag.code} code={flag.code} label={flag.label} />
      ))}
      {extra > 0 ? (
        <span className="text-2xs font-semibold tracking-wide text-muted">+{extra}</span>
      ) : null}
    </span>
  );
}
