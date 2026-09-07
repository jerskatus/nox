import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { connectGoogle, disconnectGoogle, isGoogleClientId } from "@/lib/google-youtube";
import { googleClientId, googleLive, useGoogleStore } from "@/stores/google";
import { cn } from "@/lib/utils";

export function GoogleAccountCard({ compact = false }: { compact?: boolean }) {
  const store = useGoogleStore();
  const clientId = googleClientId(store);
  const live = googleLive(store);
  const [draft, setDraft] = useState(store.clientId);
  const [busy, setBusy] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  async function onConnect() {
    const id = (draft.trim() || clientId).trim();
    if (!isGoogleClientId(id)) {
      toast.error("Paste a Google OAuth client ID ending in .apps.googleusercontent.com");
      return;
    }
    useGoogleStore.getState().setClientId(id);
    setBusy(true);
    try {
      await connectGoogle(id);
      toast.success("Google connected");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not connect Google");
    } finally {
      setBusy(false);
    }
  }

  function onDisconnect() {
    disconnectGoogle();
    toast.success("Google disconnected");
  }

  if (compact && live) {
    return (
      <div className="flex items-center gap-3 rounded-md bg-elevated px-3 py-2">
        {store.picture ? (
          <img src={store.picture} alt="" className="size-8 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <span className="grid size-8 place-items-center rounded-full bg-accent text-xs font-bold">G</span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{store.name || "Google"}</p>
          <p className="truncate text-xs text-muted">{store.email}</p>
        </div>
        <Button variant="ghost" size="sm" className="shrink-0" onClick={onDisconnect}>
          Disconnect
        </Button>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="rounded-md bg-elevated px-4 py-5 text-center">
        <p className="text-sm font-semibold">Recommended is personal</p>
        <p className="mt-1 mb-4 text-sm text-muted">
          Connect the Google account you use on YouTube to load your For You feed.
        </p>
        {clientId ? (
          <Button variant="play" onClick={() => void onConnect()} disabled={busy}>
            {busy ? "Connecting…" : "Connect Google"}
          </Button>
        ) : (
          <Button variant="play" asChild>
            <Link to="/options">Set up Google in Options</Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-md bg-surface p-4">
      {live ? (
        <div className="flex items-center gap-3">
          {store.picture ? (
            <img src={store.picture} alt="" className="size-11 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <span className="grid size-11 place-items-center rounded-full bg-accent text-sm font-bold">G</span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{store.name || "Google"}</p>
            <p className="truncate text-sm text-muted">{store.email}</p>
          </div>
          <Button variant="outline" onClick={onDisconnect}>
            Disconnect
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1 text-sm">
            <span className="mb-1.5 block text-muted">Google client ID</span>
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="….apps.googleusercontent.com"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <Button variant="play" className="shrink-0" onClick={() => void onConnect()} disabled={busy}>
            {busy ? "Connecting…" : "Connect Google"}
          </Button>
        </div>
      )}
      <p className={cn("text-xs leading-relaxed text-muted", live && "text-subtle")}>
        Enable <span className="text-fg">YouTube Data API v3</span> in Google Cloud, create a Web OAuth client, and add
        this origin: <span className="text-fg">{origin || "this site"}</span>. Nox then loads Recommended from your
        subscriptions and likes.
      </p>
    </div>
  );
}
