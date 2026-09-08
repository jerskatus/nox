import { Link } from "@tanstack/react-router";
import { ProviderMark } from "@/components/catalog/provider-mark";
import { PROVIDERS } from "@/lib/stremio/providers";

export function ProviderRow() {
  return (
    <section>
      <h2 className="mb-4 px-4 text-base font-semibold tracking-tight sm:px-8 sm:text-lg lg:px-12">Browse by provider</h2>
      <div className="no-scrollbar flex gap-5 overflow-x-auto px-4 sm:px-8 lg:px-12">
        {PROVIDERS.map((provider) => (
          <Link
            key={provider.id}
            to="/provider/$id"
            params={{ id: provider.id }}
            className="flex w-[4.75rem] shrink-0 flex-col items-center gap-2 touch-manipulation"
          >
            <span
              className="relative grid size-[4.5rem] place-items-center overflow-hidden rounded-2xl shadow-lg"
              style={{ backgroundColor: provider.bg }}
            >
              <ProviderMark provider={provider} />
            </span>
            <span className="w-full truncate text-center text-xs text-muted">{provider.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
