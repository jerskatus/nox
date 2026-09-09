import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { app } from "electron";

const root = dirname(fileURLToPath(import.meta.url));

function catalogDir() {
  if (app.isPackaged) return join(process.resourcesPath, "catalog");
  return join(root, "app");
}

function catalogEntry(dir) {
  const mjs = join(dir, "server", "index.mjs");
  const js = join(dir, "server", "index.js");
  if (existsSync(mjs)) return mjs;
  if (existsSync(js)) return js;
  return null;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
  });
}

async function waitForHttp(url, timeoutMs) {
  const start = Date.now();
  let last = "";
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok || response.status === 404) return;
      last = String(response.status);
    } catch (error) {
      last = error instanceof Error ? error.message : "offline";
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(last || "catalog did not start");
}

export function hasLocalCatalog() {
  return Boolean(catalogEntry(catalogDir()));
}

export async function startCatalog() {
  const dir = catalogDir();
  const entry = catalogEntry(dir);
  if (!entry) throw new Error("Nox catalog is missing from this install.");
  const port = await freePort();
  const child = spawn(process.execPath, [entry], {
    cwd: dir,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      PORT: String(port),
      NITRO_PORT: String(port),
      HOST: "127.0.0.1",
      NITRO_HOST: "127.0.0.1",
      NOX_DATA_DIR: join(app.getPath("userData"), "db"),
      NOX_APP_VERSION: app.getVersion(),
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let stderr = "";
  child.stderr?.on("data", (chunk) => {
    stderr += String(chunk);
    if (stderr.length > 8000) stderr = stderr.slice(-4000);
  });
  child.stdout?.on("data", () => undefined);
  const url = `http://127.0.0.1:${port}`;
  try {
    await waitForHttp(url, 25000);
  } catch (error) {
    try {
      child.kill();
    } catch {
      /* already gone */
    }
    const reason = error instanceof Error ? error.message : "failed";
    throw new Error(stderr.trim() || reason);
  }
  return { url, port, child };
}

export function stopCatalog(job) {
  if (!job?.child || job.child.killed) return;
  try {
    job.child.kill();
  } catch {
    /* already gone */
  }
}
