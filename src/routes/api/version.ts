import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/version")({
  server: {
    handlers: {
      GET: async () => {
        const id =
          process.env.VERCEL_DEPLOYMENT_ID ||
          process.env.VERCEL_GIT_COMMIT_SHA ||
          process.env.VITE_PUBLIC_HOSTNAME ||
          "dev";
        return Response.json(
          {
            id,
            env: process.env.VERCEL_ENV ?? "development",
            url: process.env.VERCEL_PROJECT_PRODUCTION_URL ?? null,
          },
          { headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
