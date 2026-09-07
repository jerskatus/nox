import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/media")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const { assertPublicUrl } = await import("@/lib/stremio/proxy.server");
        const url = new URL(request.url).searchParams.get("url");
        if (!url) return new Response("Missing url", { status: 400 });
        let target: URL;
        try {
          target = await assertPublicUrl(url);
        } catch (error) {
          return new Response(error instanceof Error ? error.message : "Blocked", { status: 400 });
        }
        const headers = new Headers();
        const range = request.headers.get("range");
        if (range) headers.set("range", range);
        headers.set("user-agent", "Mozilla/5.0 (compatible; Nox/1.0)");
        const accept = request.headers.get("accept");
        if (accept) headers.set("accept", accept);

        const upstream = await fetch(target.toString(), {
          method: "GET",
          headers,
          redirect: "follow",
        });

        const out = new Headers();
        for (const key of [
          "content-type",
          "content-length",
          "content-range",
          "accept-ranges",
          "content-disposition",
        ]) {
          const value = upstream.headers.get(key);
          if (value) out.set(key, value);
        }
        out.set("cache-control", "private, max-age=120");
        return new Response(upstream.body, { status: upstream.status, headers: out });
      },
    },
  },
});
