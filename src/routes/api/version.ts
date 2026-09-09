import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/version")({
  server: {
    handlers: {
      GET: async () => {
        const id =
          process.env.NOX_APP_VERSION ||
          process.env.VERCEL_DEPLOYMENT_ID ||
          process.env.VERCEL_GIT_COMMIT_SHA ||
          process.env.VITE_PUBLIC_HOSTNAME ||
          "dev";
        return Response.json(
          {
            id,
            env: process.env.NOX_APP_VERSION
              ? "desktop"
              : (process.env.VERCEL_ENV ?? "development"),
            url: process.env.VERCEL_PROJECT_PRODUCTION_URL ?? null,
            standalone: Boolean(process.env.NOX_APP_VERSION),
          },
          { headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
