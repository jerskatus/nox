import { contextBridge } from "electron";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
let version = "1.0.0";
try {
  version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version ?? version;
} catch {
  /* packaged asar still ships package.json next to main */
}

contextBridge.exposeInMainWorld("noxDesktop", {
  version,
});
