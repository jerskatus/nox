import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-elevated", className)} />;
}

export function PosterSkeleton({ landscape = false }: { landscape?: boolean }) {
  return (
    <Skeleton className={landscape ? "aspect-wide w-64 shrink-0" : "aspect-poster w-36 shrink-0 sm:w-40"} />
  );
}
