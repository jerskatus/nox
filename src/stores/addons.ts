import { create } from "zustand";
import { persist } from "zustand/middleware";
import { persistStorage } from "@/lib/persist-storage";
import { DEFAULT_ADDONS, STREAMING_CATALOGS_MANIFEST } from "@/lib/stremio/defaults";
import { STREAMING_CATALOGS_URL } from "@/lib/stremio/urls";
import type { InstalledAddon, Manifest } from "@/lib/stremio/types";

type AddonState = {
  hydrated: boolean;
  addons: InstalledAddon[];
  setHydrated: (value: boolean) => void;
  install: (transportUrl: string, manifest: Manifest) => void;
  uninstall: (transportUrl: string) => void;
  toggle: (transportUrl: string) => void;
  replaceManifest: (transportUrl: string, manifest: Manifest) => void;
  reset: () => void;
};

export const useAddonStore = create<AddonState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      addons: DEFAULT_ADDONS,
      setHydrated: (value) => set({ hydrated: value }),
      install: (transportUrl, manifest) => {
        const existing = get().addons.filter((addon) => addon.manifest.id !== manifest.id);
        set({
          addons: [
            {
              transportUrl,
              manifest,
              enabled: true,
              installedAt: Date.now(),
            },
            ...existing,
          ],
        });
      },
      uninstall: (transportUrl) =>
        set({ addons: get().addons.filter((addon) => addon.transportUrl !== transportUrl) }),
      toggle: (transportUrl) =>
        set({
          addons: get().addons.map((addon) =>
            addon.transportUrl === transportUrl ? { ...addon, enabled: !addon.enabled } : addon,
          ),
        }),
      replaceManifest: (transportUrl, manifest) =>
        set({
          addons: get().addons.map((addon) =>
            addon.transportUrl === transportUrl ? { ...addon, manifest } : addon,
          ),
        }),
      reset: () => set({ addons: DEFAULT_ADDONS }),
    }),
    {
      name: "nox-addons",
      skipHydration: true,
      storage: persistStorage,
      partialize: (state) => ({ addons: state.addons }),
      merge: (persisted, current) => {
        const stored = (persisted as { addons?: InstalledAddon[] } | undefined)?.addons;
        if (!stored) return current;
        const migrated = stored
          .filter((addon) => addon.manifest.id !== "com.linvo.stremiochannels")
          .map((addon) =>
            addon.manifest.id === "pw.ers.netflix-catalog"
              ? { ...addon, transportUrl: STREAMING_CATALOGS_URL, manifest: STREAMING_CATALOGS_MANIFEST }
              : addon,
          );
        const have = new Set(migrated.map((addon) => addon.manifest.id));
        const missing = DEFAULT_ADDONS.filter((addon) => !have.has(addon.manifest.id));
        return { ...current, addons: [...migrated, ...missing] };
      },
    },
  ),
);

export function useEnabledAddons() {
  const addons = useAddonStore((s) => s.addons);
  return addons.filter((addon) => addon.enabled);
}
