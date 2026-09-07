import { useRouterState } from "@tanstack/react-router";
import { type ReactNode, useEffect } from "react";
import { Nav } from "./nav";
import { useAddonStore } from "@/stores/addons";
import { useLibraryStore } from "@/stores/library";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isWatch = pathname.startsWith("/watch");

  useEffect(() => {
    void Promise.resolve(useAddonStore.persist.rehydrate()).then(() => {
      useAddonStore.getState().setHydrated(true);
    });
    void Promise.resolve(useLibraryStore.persist.rehydrate());
  }, []);

  if (isWatch) return children;

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <Nav />
      <div className="pt-0">{children}</div>
    </div>
  );
}
