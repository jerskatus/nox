import { isHttpUrl, normalizeIso, parseVlcTrackName, vlcFitArgs, vlcPlaybackReady } from "../desktop/vlc-tracks.mjs";

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const english = parseVlcTrackName("Track 2 - [English] Dolby TrueHD 7.1", 2);
assert(english?.lang === "en", `english lang ${english?.lang}`);
assert(english?.cinema === true, "truehd should be cinema");
assert(english?.codec.includes("truehd") || english?.codec === "truehd", `codec ${english?.codec}`);

const italian = parseVlcTrackName("Italiano - Dolby Digital", 1);
assert(italian?.lang === "it", `italian lang ${italian?.lang}`);

const disabled = parseVlcTrackName("Disable", -1);
assert(disabled === null, "disable track should be skipped");

const iso = parseVlcTrackName("[ENG] AAC Stereo", 0);
assert(iso?.lang === "en", `iso lang ${iso?.lang}`);

assert(normalizeIso("eng") === "en", "eng");
assert(normalizeIso("jpn") === "ja", "jpn");
assert(isHttpUrl("https://example.com/a.mkv") === true, "https");
assert(isHttpUrl("file:///tmp/a.mkv") === false, "file");

const fit = vlcFitArgs("stretch", 1920, 1080);
assert(fit.aspect === "1920:1080", `stretch aspect ${fit.aspect}`);
const fill = vlcFitArgs("fill", 1920, 800);
assert(fill.crop === "1920:800", `fill crop ${fill.crop}`);
const zoom = vlcFitArgs("zoom", 100, 100);
assert(zoom.scale === 1.34, `zoom ${zoom.scale}`);

assert(vlcPlaybackReady({ state: 3, playing: true, time: 0 }) === true, "playing state");
assert(vlcPlaybackReady({ state: 2, playing: false, time: 0 }, 200) === false, "buffering too soon");
assert(vlcPlaybackReady({ state: 2, playing: true, time: 400 }, 900) === true, "buffering with progress");
assert(vlcPlaybackReady({ state: 1, playing: false, time: 0 }, 5000) === false, "still opening");

console.log("vlc-tracks tests passed");
