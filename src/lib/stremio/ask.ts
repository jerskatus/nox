import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type AskTitle = {
  name: string;
  year?: number;
  type: "movie" | "series";
  why: string;
};

export type AskResult = {
  ok: boolean;
  type?: "movie" | "series";
  chips: string[];
  titles: AskTitle[];
};

const cache = new Map<string, AskResult>();
const MAX_CACHE = 80;

const SYSTEM = `You pick movies and TV shows that match what the user actually wants to watch.

Return JSON only:
{"type":"movie"|"series"|null,"chips":string[],"titles":[{"name":string,"year":number,"type":"movie"|"series","why":string}]}

Rules:
- titles: 8 to 14 real, well-known works whose PLOT matches the request. Famous matches first.
- chips: 2 to 5 short tags (e.g. "road trip", "best friends", "comedy").
- If they named a title, put that first, then similar works.
- Match meaning, not words. "best friends on a road trip" is NOT Friends, Just Friends, or Friends with Benefits.
- Never pad with keyword coincidences (Going Places, Going in Style, The Reunion).
- Prefer the canonical English title people would search on IMDb.
- year is the original release year.`;

export const interpretAsk = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ query: z.string().min(2).max(220) }).parse(input))
  .handler(async ({ data }): Promise<AskResult> => {
    const key = data.query.trim().toLowerCase();
    const hit = cache.get(key);
    if (hit) return hit;

    const apiKey = process.env.XAI_API_KEY?.trim();
    if (!apiKey) return { ok: false, chips: [], titles: [] };

    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "grok-4.5",
          temperature: 0.2,
          max_tokens: 700,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: data.query.trim() },
          ],
        }),
      });
      if (!res.ok) return { ok: false, chips: [], titles: [] };
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const parsed = parseAsk(body.choices?.[0]?.message?.content ?? "");
      if (parsed.titles.length === 0) return { ok: false, chips: [], titles: [] };
      if (cache.size >= MAX_CACHE) {
        const first = cache.keys().next().value;
        if (first) cache.delete(first);
      }
      cache.set(key, parsed);
      return parsed;
    } catch {
      return { ok: false, chips: [], titles: [] };
    }
  });

function parseAsk(raw: string): AskResult {
  const json = raw.trim().replace(/^```json\s*|\s*```$/g, "");
  try {
    const data = JSON.parse(json) as {
      type?: string;
      chips?: unknown;
      titles?: unknown;
    };
    const type = data.type === "series" || data.type === "movie" ? data.type : undefined;
    const chips = Array.isArray(data.chips)
      ? data.chips.filter((c): c is string => typeof c === "string" && c.trim().length > 0).slice(0, 6)
      : [];
    const titles: AskTitle[] = [];
    if (Array.isArray(data.titles)) {
      for (const row of data.titles) {
        if (!row || typeof row !== "object") continue;
        const item = row as Record<string, unknown>;
        const name = typeof item.name === "string" ? item.name.trim() : "";
        if (name.length < 2) continue;
        const t = item.type === "series" ? "series" : "movie";
        const year = typeof item.year === "number" && item.year > 1900 ? item.year : undefined;
        const why = typeof item.why === "string" ? item.why.trim() : "";
        titles.push({ name, year, type: t, why });
      }
    }
    return { ok: titles.length > 0, type, chips, titles: titles.slice(0, 14) };
  } catch {
    return { ok: false, chips: [], titles: [] };
  }
}
