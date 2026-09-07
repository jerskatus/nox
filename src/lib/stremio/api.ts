import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const UrlInput = z.object({ url: z.string().min(8).max(4000) });
const UrlsInput = z.object({ urls: z.array(z.string().min(8).max(4000)).max(24) });

export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

export type AddonFetchResult =
  | { url: string; ok: true; data: Json }
  | { url: string; ok: false; error: string };

export const fetchAddonJson = createServerFn({ method: "POST" })
  .validator((input: unknown) => UrlInput.parse(input))
  .handler(async ({ data }): Promise<Json> => {
    const { proxyAddonJson } = await import("./proxy.server");
    return (await proxyAddonJson(data.url)) as Json;
  });

export const fetchAddonJsonMany = createServerFn({ method: "POST" })
  .validator((input: unknown) => UrlsInput.parse(input))
  .handler(async ({ data }): Promise<AddonFetchResult[]> => {
    const { proxyAddonJson } = await import("./proxy.server");
    const unique = [...new Set(data.urls)].slice(0, 24);
    return Promise.all(
      unique.map(async (url): Promise<AddonFetchResult> => {
        try {
          return { url, ok: true, data: (await proxyAddonJson(url)) as Json };
        } catch (error) {
          return {
            url,
            ok: false,
            error: error instanceof Error ? error.message : "Failed to fetch addon",
          };
        }
      }),
    );
  });

export const fetchAddonText = createServerFn({ method: "POST" })
  .validator((input: unknown) => UrlInput.parse(input))
  .handler(async ({ data }): Promise<string> => {
    const { proxyAddonText } = await import("./proxy.server");
    return proxyAddonText(data.url);
  });
