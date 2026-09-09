import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  detectAudioCodec,
  spokenFlagsFromText,
  spokenFrom,
  streamFlags,
  streamScore,
} from "./stream-rank.ts";
import type { Stream } from "./types.ts";

function stream(title: string, extra: Partial<Stream> = {}): Stream {
  return { title, name: extra.name ?? "Torrentio TB", ...extra };
}

describe("spoken flags", () => {
  it("keeps dual-audio EN+IT as two flags", () => {
    const flags = spokenFlagsFromText("1080p Dual Audio [EN+IT] AAC Cached");
    assert.deepEqual(
      flags.map((f) => f.code),
      ["gb", "it"],
    );
  });

  it("does not treat a subtitle-flag dump as a dozen audio tracks", () => {
    const dump =
      "1080p Dual audio Cached 🇬🇧 🇯🇵 🇸🇬 🇫🇷 🇩🇪 🇳🇱 🇵🇱 🇨🇿 🇭🇺 🇩🇰 🇸🇪 🇳🇴 🇹🇷 🇮🇱 🇮🇩 🇲🇾 🇹🇭";
    const flags = spokenFlagsFromText(dump);
    assert.ok(flags.length <= 3, `got ${flags.map((f) => f.code).join(",")}`);
    assert.ok(flags.some((f) => f.code === "gb"));
  });

  it("ignores English words like 'in the' and movie titles", () => {
    assert.equal(spokenFlagsFromText("The Italian Job 2003 1080p BluRay").length, 0);
    assert.equal(spokenFrom("Cast Away in the Pacific 1080p"), "unknown");
  });

  it("reads plus-grouped languages and caps long packs", () => {
    const pair = spokenFlagsFromText("EN+IT+RU Dual Audio");
    assert.deepEqual(
      pair.map((f) => f.code),
      ["gb", "it", "ru"],
    );
    const pack = spokenFlagsFromText("[EN+IT+RU+JP+FR+DE+NL+PL+CZ]");
    assert.ok(pack.length <= 3);
    assert.ok(pack.some((f) => f.code === "gb"));
  });
});

describe("audio codecs", () => {
  it("detects cinema codecs the Windows app can play", () => {
    assert.equal(detectAudioCodec("1080p BluRay Atmos TrueHD")?.label, "Atmos");
    assert.equal(detectAudioCodec("2160p DTS-HD MA 7.1")?.label, "DTS-HD");
    assert.equal(detectAudioCodec("1080p DTS 5.1")?.label, "DTS");
    assert.equal(detectAudioCodec("1080p EAC3 DD+")?.label, "DD+");
    assert.equal(detectAudioCodec("720p AC3 5.1")?.label, "AC3");
    assert.equal(detectAudioCodec("1080p AAC 2.0")?.label, "AAC");
  });

  it("keeps cinema streams in the ranking instead of burying them", () => {
    const aac = stream("1080p English AAC Cached", { url: "https://cdn.example/a.mp4" });
    const atmos = stream("1080p English Atmos TrueHD Cached", { url: "https://cdn.example/b.mp4" });
    Object.assign(aac, { description: "[TB+] cached" });
    Object.assign(atmos, { description: "[TB+] cached" });
    assert.equal(streamFlags(atmos).audioCodec?.label, "Atmos");
    assert.equal(streamFlags(atmos).cinemaAudio, true);
    const webGap = streamScore(aac) - streamScore(atmos);
    assert.ok(webGap < 2000, `cinema should still appear in best sources, gap was ${webGap}`);
    assert.ok(streamScore(atmos, { desktop: true }) > streamScore(atmos));
  });
});
