import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ffmpeg = join(dirname(fileURLToPath(import.meta.url)), "../desktop/node_modules/ffmpeg-static/ffmpeg");
if (!existsSync(ffmpeg)) {
  console.log("engine-http skipped (no ffmpeg)");
  process.exit(0);
}

const server = createServer((_req, res) => {
  const child = spawn(
    ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      "testsrc=size=320x240:rate=10",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:sample_rate=48000",
      "-t",
      "1",
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-ac",
      "2",
      "-movflags",
      "frag_keyframe+empty_moov+default_base_moof",
      "-f",
      "mp4",
      "pipe:1",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  res.writeHead(200, { "Content-Type": "video/mp4", "Access-Control-Allow-Origin": "*" });
  child.stdout.pipe(res);
  child.on("exit", () => {
    if (!res.writableEnded) res.end();
  });
});

await new Promise((resolve, reject) => {
  server.listen(0, "127.0.0.1", () => resolve());
  server.once("error", reject);
});
const port = server.address().port;
const res = await fetch(`http://127.0.0.1:${port}/v/test.mp4`);
assert.equal(res.ok, true, `status ${res.status}`);
const buf = Buffer.from(await res.arrayBuffer());
server.close();
assert.ok(buf.length > 800, `tiny body ${buf.length}`);
assert.ok(buf.includes("ftyp") || buf.includes("moof") || buf.includes("mdat"), "not an mp4");
console.log(`engine-http tests passed (${buf.length} bytes)`);
