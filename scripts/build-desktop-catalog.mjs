#!/usr/bin/env node
/**
 * Production catalog for the Windows/mac/Linux app: Nitro node-server build
 * copied into desktop/app so Electron can boot it on 127.0.0.1.
 */
import { spawn } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dest = join(root, "desktop", "app");
const output = join(root, ".output");

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env: { ...process.env, ...env },
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) reject(new Error(`${command} ${signal}`));
      else if (code) reject(new Error(`${command} exited ${code}`));
      else resolve();
    });
  });
}

await run(process.execPath, [
  join(root, "scripts", "with-app-env.mjs"),
  join(root, "node_modules", "vite", "bin", "vite.js"),
  "build",
], {
  NITRO_PRESET: "node-server",
});

if (!existsSync(join(output, "server", "index.mjs")) && !existsSync(join(output, "server", "index.js"))) {
  throw new Error("Desktop catalog build did not produce .output/server");
}

rmSync(dest, { recursive: true, force: true });
cpSync(output, dest, { recursive: true });
console.log(`[desktop] catalog copied to ${dest}`);
