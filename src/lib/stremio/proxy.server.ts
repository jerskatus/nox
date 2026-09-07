import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_JSON_BYTES = 8_000_000;
const FETCH_TIMEOUT_MS = 18_000;

function isPrivateIPv4(ip: string) {
  const parts = ip.split(".").map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function isPrivateIP(ip: string) {
  const v = ip.toLowerCase().replace(/^::ffff:/, "");
  if (v === "::1" || v === "0.0.0.0") return true;
  if (v.includes(":")) {
    if (v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")) return true;
  }
  return isPrivateIPv4(v);
}

export async function assertPublicUrl(raw: string) {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("Invalid addon URL");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Only HTTP(S) addon URLs are allowed");
  }
  const host = parsed.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    throw new Error("Local hosts are blocked");
  }
  if (isIP(host)) {
    if (isPrivateIP(host)) throw new Error("Private addresses are blocked");
    return parsed;
  }
  const { address } = await lookup(host);
  if (isPrivateIP(address)) throw new Error("Private addresses are blocked");
  return parsed;
}

export async function proxyAddonJson(rawUrl: string): Promise<unknown> {
  const parsed = await assertPublicUrl(rawUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(parsed.toString(), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "application/json, text/plain, */*",
        "User-Agent": "Mozilla/5.0 (compatible; Nox/1.0; Stremio-compatible)",
      },
    });
    if (res.status === 404) {
      const url = parsed.pathname;
      if (url.includes("/stream/")) return { streams: [] };
      if (url.includes("/subtitles/")) return { subtitles: [] };
      if (url.includes("/catalog/")) return { metas: [] };
      if (url.includes("/meta/")) return { meta: null };
      throw new Error("Addon returned 404");
    }
    if (!res.ok) throw new Error(`Addon returned ${res.status}`);
    const length = Number(res.headers.get("content-length") ?? "0");
    if (length > MAX_JSON_BYTES) throw new Error("Addon response too large");
    const text = await res.text();
    if (text.length > MAX_JSON_BYTES) throw new Error("Addon response too large");
    if (!text.trim()) return {};
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new Error("Addon did not return JSON");
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Addon timed out");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

const MAX_TEXT_BYTES = 1_500_000;

export async function proxyAddonText(rawUrl: string): Promise<string> {
  const parsed = await assertPublicUrl(rawUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(parsed.toString(), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/vtt, text/plain, application/x-subrip, */*",
        "User-Agent": "Mozilla/5.0 (compatible; Nox/1.0; Stremio-compatible)",
      },
    });
    if (!res.ok) throw new Error(`Subtitle file returned ${res.status}`);
    const length = Number(res.headers.get("content-length") ?? "0");
    if (length > MAX_TEXT_BYTES) throw new Error("Subtitle file too large");
    const text = await res.text();
    if (text.length > MAX_TEXT_BYTES) throw new Error("Subtitle file too large");
    return text;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Subtitle download timed out");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
