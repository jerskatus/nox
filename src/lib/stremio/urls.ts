import type { InstalledAddon, Manifest, ManifestResource } from "./types";

export const CINEMETA_URL = "https://v3-cinemeta.strem.io/manifest.json";
export const OPENSUBTITLES_URL = "https://opensubtitles-v3.strem.io/manifest.json";
export const YOUTUBE_URL = "https://v3-channels.strem.io/manifest.json";
export const WATCHHUB_URL = "https://watchhub.strem.io/manifest.json";
export const STREAMING_CATALOGS_URL =
  "https://7a82163c306e-stremio-netflix-catalog-addon.baby-beamup.club/manifest.json";

export function normalizeTransportUrl(raw: string) {
  let url = raw.trim();
  if (!url) return url;
  if (url.startsWith("stremio://")) url = "https://" + url.slice("stremio://".length);
  if (url.startsWith("local://")) return url;
  try {
    const parsed = new URL(url);
    if (!parsed.pathname.endsWith(".json")) {
      parsed.pathname = parsed.pathname.replace(/\/$/, "") + "/manifest.json";
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

export function addonBase(transportUrl: string) {
  return transportUrl.replace(/\/manifest\.json$/i, "").replace(/\/$/, "");
}

export function configureUrl(transportUrl: string) {
  return addonBase(transportUrl) + "/configure";
}

export function resourceUrl(
  transportUrl: string,
  resource: string,
  type: string,
  id: string,
  extra?: Record<string, string | number | undefined>,
) {
  const base = addonBase(transportUrl);
  const encodedId = id
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("%2F");
  const extraEntries = Object.entries(extra ?? {}).filter(
    ([, value]) => value !== undefined && value !== "",
  );
  const extraPath =
    extraEntries.length > 0
      ? "/" +
        extraEntries
          .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
          .join("&")
      : "";
  return `${base}/${resource}/${encodeURIComponent(type)}/${encodedId}${extraPath}.json`;
}

export function resourceName(resource: ManifestResource) {
  return typeof resource === "string" ? resource : resource.name;
}

export function addonHasResource(
  manifest: Manifest,
  name: string,
  type?: string,
  id?: string,
) {
  return manifest.resources.some((resource) => {
    if (resourceName(resource) !== name) return false;
    if (typeof resource === "string") {
      if (type && manifest.types?.length && !manifest.types.includes(type)) return false;
      if (id && manifest.idPrefixes?.length && !manifest.idPrefixes.some((p) => id.startsWith(p))) {
        return false;
      }
      return true;
    }
    if (type && resource.types?.length && !resource.types.includes(type)) return false;
    const prefixes = resource.idPrefixes ?? manifest.idPrefixes;
    if (id && prefixes?.length && !prefixes.some((p) => id.startsWith(p))) return false;
    return true;
  });
}

export function enabledCatalogs(addons: InstalledAddon[]) {
  const catalogs: Array<{
    transportUrl: string;
    addonName: string;
    addonId: string;
    type: string;
    id: string;
    name: string;
    extra?: Manifest["catalogs"][number]["extra"];
  }> = [];
  for (const addon of addons) {
    if (!addon.enabled) continue;
    if (!addonHasResource(addon.manifest, "catalog")) continue;
    for (const catalog of addon.manifest.catalogs ?? []) {
      const required = catalog.extra?.filter((e) => e.isRequired) ?? [];
      const searchOnly = required.length > 0 && required.every((e) => e.name === "search");
      if (searchOnly) continue;
      const missingRequired = required.some(
        (e) => e.name !== "genre" && e.name !== "skip" && e.name !== "search",
      );
      if (missingRequired) continue;
      catalogs.push({
        transportUrl: addon.transportUrl,
        addonName: addon.manifest.name,
        addonId: addon.manifest.id,
        type: catalog.type,
        id: catalog.id,
        name: catalog.name ?? catalog.id,
        extra: catalog.extra,
      });
    }
  }
  return catalogs;
}

export function catalogsWithSearch(addons: InstalledAddon[]) {
  return addons.flatMap((addon) => {
    if (!addon.enabled) return [];
    return (addon.manifest.catalogs ?? [])
      .filter((catalog) => {
        const extras = catalog.extra ?? [];
        const supported = catalog.extraSupported ?? extras.map((e) => e.name);
        return supported.includes("search") || extras.some((e) => e.name === "search");
      })
      .map((catalog) => ({
        transportUrl: addon.transportUrl,
        addonName: addon.manifest.name,
        type: catalog.type,
        id: catalog.id,
        name: catalog.name ?? catalog.id,
      }));
  });
}

export function streamAddonsFor(addons: InstalledAddon[], type: string, id: string) {
  return addons.filter(
    (addon) => addon.enabled && addonHasResource(addon.manifest, "stream", type, id),
  );
}

export function metaAddonsFor(addons: InstalledAddon[], type: string, id: string) {
  return addons.filter(
    (addon) => addon.enabled && addonHasResource(addon.manifest, "meta", type, id),
  );
}

export function subtitleAddonsFor(addons: InstalledAddon[], type: string, id: string) {
  return addons.filter(
    (addon) => addon.enabled && addonHasResource(addon.manifest, "subtitles", type, id),
  );
}

export function addonCatalogsOf(addons: InstalledAddon[]) {
  return addons.flatMap((addon) => {
    if (!addon.enabled) return [];
    return (addon.manifest.addonCatalogs ?? []).map((catalog) => ({
      transportUrl: addon.transportUrl,
      addonName: addon.manifest.name,
      type: catalog.type,
      id: catalog.id,
      name: catalog.name ?? catalog.id,
    }));
  });
}
