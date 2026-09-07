import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-elevated", className)} />;
}

export function PosterSkeleton({
  landscape = false,
  fill = false,
}: {
  landscape?: boolean;
  fill?: boolean;
}) {
  return (
    <Skeleton
      className={cn(
        "rounded-sm",
        landscape ? "aspect-wide" : "aspect-poster",
        fill ? "w-full min-w-0" : landscape ? "w-56 shrink-0 sm:w-72" : "w-28 shrink-0 sm:w-36 md:w-40 lg:w-44",
      )}
    />
  );
}
