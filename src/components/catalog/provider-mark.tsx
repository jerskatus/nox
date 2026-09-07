import type { Provider } from "@/lib/stremio/providers";
import { cn } from "@/lib/utils";

export function ProviderMark({
  provider,
  className,
}: {
  provider: Provider;
  className?: string;
}) {
  return (
    <img
      src={provider.logo}
      alt=""
      className={cn(
        provider.bleed ? "absolute inset-0 size-full object-cover" : "max-h-[70%] max-w-[86%] object-contain",
        className,
      )}
    />
  );
}
