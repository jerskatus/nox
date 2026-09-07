import { useRouterState } from "@tanstack/react-router";
import { type ReactNode, useEffect } from "react";
import { Nav } from "./nav";
import { startTvRemote } from "@/lib/tv-remote";
import { useAddonStore } from "@/stores/addons";
import { useGoogleStore } from "@/stores/google";
import { useLibraryStore } from "@/stores/library";
import { isThemeId, useSettingsStore, type ThemeId } from "@/stores/settings";

function applyTheme(theme: ThemeId) {
  if (theme === "nox") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isWatch = pathname.startsWith("/watch");
  const theme = useSettingsStore((s) => s.theme);
  const tvRemote = useSettingsStore((s) => s.tvRemote);

  useEffect(() => {
    void Promise.resolve(useAddonStore.persist.rehydrate()).then(() => {
      useAddonStore.getState().setHydrated(true);
    });
    void Promise.resolve(useLibraryStore.persist.rehydrate());
    void Promise.resolve(useSettingsStore.persist.rehydrate());
    void Promise.resolve(useGoogleStore.persist.rehydrate());
  }, []);

  useEffect(() => {
    applyTheme(isThemeId(theme) ? theme : "nox");
  }, [theme]);

  useEffect(() => {
    if (!tvRemote) return;
    return startTvRemote();
  }, [tvRemote]);

  if (isWatch) return children;

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <Nav />
      <div className="pt-0">{children}</div>
    </div>
  );
}