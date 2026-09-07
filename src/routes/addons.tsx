import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Puzzle, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchAddonCatalog, fetchManifest } from "@/lib/stremio/client";
import { CINEMETA_URL, configureUrl, normalizeTransportUrl, resourceName } from "@/lib/stremio/urls";
import type { AddonDescriptor, InstalledAddon, Manifest } from "@/lib/stremio/types";
import { useAddonStore } from "@/stores/addons";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/addons")({
  component: AddonsPage,
});

function AddonsPage() {
  const addons = useAddonStore((s) => s.addons);
  const install = useAddonStore((s) => s.install);
  const uninstall = useAddonStore((s) => s.uninstall);
  const toggle = useAddonStore((s) => s.toggle);
  const reset = useAddonStore((s) => s.reset);
  const [url, setUrl] = useState("");
  const [installing, setInstalling] = useState(false);
  const [tab, setTab] = useState<"installed" | "official" | "community">("installed");
  const [filter, setFilter] = useState("");

  async function onInstall(raw: string) {
    const transportUrl = normalizeTransportUrl(raw);
    if (!transportUrl) {
      toast.error("Paste a Stremio manifest URL");
      return;
    }
    setInstalling(true);
    try {
      const manifest = await fetchManifest(transportUrl);
      install(transportUrl, manifest);
      toast.success(`Installed ${manifest.name}`);
      setUrl("");
      setTab("installed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not install add-on");
    } finally {
      setInstalling(false);
    }
  }

  const official = useQuery({
    queryKey: ["addon-catalog", "official"],
    queryFn: () => fetchAddonCatalog(CINEMETA_URL, "all", "official"),
    enabled: tab === "official",
  });
  const community = useQuery({
    queryKey: ["addon-catalog", "community"],
    queryFn: () => fetchAddonCatalog(CINEMETA_URL, "all", "community"),
    enabled: tab === "community",
  });

  return (
    <main className="px-4 pb-16 pt-[calc(var(--header-h)+0.75rem)] sm:px-8 lg:px-12">
      <div className="mb-8 max-w-3xl">
        <h1 className="text-3xl font-semibold">Add-ons</h1>
        <p className="mt-2 text-muted">
          Nox speaks the Stremio v3 add-on protocol. Paste any manifest URL — including{" "}
          <span className="text-fg">stremio://</span> links and configured debrid endpoints like Torrentio,
          Comet, MediaFusion, or AIOStreams.
        </p>
      </div>

      <form
        className="mb-8 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void onInstall(url);
        }}
      >
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/manifest.json"
          className="sm:flex-1"
        />
        <Button type="submit" variant="accent" disabled={installing}>
          {installing ? "Installing…" : "Install from URL"}
        </Button>
      </form>

      <div className="mb-6 flex flex-wrap gap-2">
        {(["installed", "official", "community"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "h-11 rounded-md px-4 text-sm capitalize touch-manipulation",
              tab === id ? "bg-fg text-bg" : "bg-elevated text-muted",
            )}
          >
            {id}
          </button>
        ))}
        {tab !== "installed" ? (
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter catalog"
            className="ml-auto h-11 max-w-56"
          />
        ) : null}
      </div>

      {tab === "installed" ? (
        <div className="grid gap-3">
          {addons.map((addon) => (
            <InstalledRow
              key={addon.transportUrl}
              addon={addon}
              onToggle={() => toggle(addon.transportUrl)}
              onRemove={() => uninstall(addon.transportUrl)}
            />
          ))}
          <Button variant="outline" className="justify-self-start" onClick={() => reset()}>
            Restore defaults
          </Button>
        </div>
      ) : (
        <CatalogGrid
          loading={tab === "official" ? official.isLoading : community.isLoading}
          items={(tab === "official" ? official.data : community.data) ?? []}
          filter={filter}
          installed={addons}
          onInstall={(transportUrl, manifest) => {
            install(transportUrl, manifest);
            toast.success(`Installed ${manifest.name}`);
          }}
        />
      )}
    </main>
  );
}

function resourceList(manifest: Manifest) {
  return [...new Set(manifest.resources.map(resourceName))];
}

function InstalledRow({
  addon,
  onToggle,
  onRemove,
}: {
  addon: InstalledAddon;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const resources = resourceList(addon.manifest);
  const configurable = addon.manifest.behaviorHints?.configurable;
  return (
    <article className="flex flex-wrap items-center gap-4 rounded-lg bg-surface p-4">
      {addon.manifest.logo ? (
        <img src={addon.manifest.logo} alt="" className="size-12 rounded-md object-cover" />
      ) : (
        <div className="grid size-12 place-items-center rounded-md bg-elevated">
          <Puzzle className="size-5 text-muted" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{addon.manifest.name}</p>
        <p className="truncate text-sm text-muted">{addon.manifest.description}</p>
        <p className="mt-1 text-xs text-subtle">{resources.join(" · ") || "manifest"}</p>
      </div>
      {configurable ? (
        <a href={configureUrl(addon.transportUrl)} target="_blank" rel="noreferrer" className="text-sm underline">
          Configure
        </a>
      ) : null}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={addon.enabled} onChange={onToggle} className="size-5" />
        On
      </label>
      <Button variant="ghost" size="icon-sm" className="bg-transparent" onClick={onRemove} aria-label="Remove">
        <Trash2 className="size-4" />
      </Button>
    </article>
  );
}

function CatalogGrid({
  loading,
  items,
  filter,
  installed,
  onInstall,
}: {
  loading: boolean;
  items: AddonDescriptor[];
  filter: string;
  installed: InstalledAddon[];
  onInstall: (url: string, manifest: Manifest) => void;
}) {
  const q = filter.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      items.filter((item) => {
        const name = item.manifest?.name ?? "";
        const desc = item.manifest?.description ?? "";
        return !q || name.toLowerCase().includes(q) || desc.toLowerCase().includes(q);
      }),
    [items, q],
  );
  const installedIds = new Set(installed.map((a) => a.manifest.id));

  if (loading) {
    return <p className="text-muted">Loading catalog…</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {filtered.map((item) => {
        const already = installedIds.has(item.manifest.id);
        const resources = resourceList(item.manifest);
        return (
          <article key={item.transportUrl} className="flex flex-col rounded-lg bg-surface p-4">
            <div className="mb-3 flex items-center gap-3">
              {item.manifest.logo ? (
                <img src={item.manifest.logo} alt="" className="size-10 rounded-md object-cover" />
              ) : (
                <div className="grid size-10 place-items-center rounded-md bg-elevated">
                  <Puzzle className="size-4" />
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate font-semibold">{item.manifest.name}</p>
                <p className="truncate text-xs text-subtle">{resources.join(" · ")}</p>
              </div>
            </div>
            <p className="mb-4 line-clamp-3 flex-1 text-sm text-muted">{item.manifest.description}</p>
            {already ? (
              <span className="text-sm text-muted">Installed</span>
            ) : item.manifest.behaviorHints?.configurationRequired ? (
              <Button asChild variant="outline" size="sm">
                <a href={configureUrl(item.transportUrl)} target="_blank" rel="noreferrer">
                  Configure
                </a>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => onInstall(item.transportUrl, item.manifest)}
              >
                Install
              </Button>
            )}
          </article>
        );
      })}
    </div>
  );
}
