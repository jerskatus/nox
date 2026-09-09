import { execFileSync } from "node:child_process";
import { createWriteStream, cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const desktop = join(root, "..", "desktop");
const dest = join(desktop, "vlc");
const version = process.env.NOX_LIBVLC_VERSION || "3.0.21";
const url = `https://www.nuget.org/api/v2/package/VideoLAN.LibVLC.Windows/${version}`;

function findLib(dir) {
  if (!existsSync(dir)) return null;
  if (existsSync(join(dir, "libvlc.dll")) && existsSync(join(dir, "plugins"))) return dir;
  for (const name of readdirSync(dir)) {
    const next = join(dir, name);
    try {
      if (statSync(next).isDirectory()) {
        const found = findLib(next);
        if (found) return found;
      }
    } catch {
      /* skip */
    }
  }
  return null;
}

async function download(from, to) {
  const response = await fetch(from, { redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new Error(`Could not download libVLC (${response.status})`);
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(to));
}

function extract(archive, out) {
  mkdirSync(out, { recursive: true });
  try {
    execFileSync("tar", ["-xf", archive, "-C", out], { stdio: "pipe" });
    return;
  } catch {
    execFileSync("unzip", ["-o", archive, "-d", out], { stdio: "pipe" });
  }
}

if (existsSync(join(dest, "libvlc.dll")) && existsSync(join(dest, "plugins"))) {
  console.log("libVLC already present");
  process.exit(0);
}

if (process.platform !== "win32" && process.env.NOX_FETCH_LIBVLC !== "1") {
  console.log("Skipping libVLC fetch (Windows-only bundle)");
  process.exit(0);
}

const tmp = join(desktop, ".vlc-fetch");
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
const nupkg = join(tmp, "libvlc.nupkg");

console.log(`Downloading libVLC ${version}…`);
await download(url, nupkg);
extract(nupkg, tmp);

const found =
  findLib(join(tmp, "build", "x64")) ||
  findLib(join(tmp, "build", "win7-x64", "native")) ||
  findLib(tmp);

if (!found) {
  throw new Error("libvlc.dll was not inside the NuGet package");
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(found, dest, { recursive: true });

if (!existsSync(join(dest, "libvlc.dll"))) {
  throw new Error("Failed to copy libVLC into desktop/vlc");
}

rmSync(tmp, { recursive: true, force: true });
console.log(`libVLC ready at ${dest}`);
