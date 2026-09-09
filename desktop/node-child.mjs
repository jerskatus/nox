import { fork } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { app } from "electron";

function hintedPaths() {
  const out = [];
  try {
    out.push(app.getPath("exe"));
  } catch {
    /* app not ready */
  }
  if (process.execPath) out.push(process.execPath);
  return [...new Set(out.filter(Boolean))];
}

export function electronBinary() {
  const hinted = hintedPaths();
  for (const path of hinted) {
    if (existsSync(path)) return path;
  }
  for (const path of hinted) {
    const dir = dirname(path);
    if (!dir) continue;
    for (const name of ["Nox.exe", "nox-desktop.exe", "electron.exe"]) {
      const next = join(dir, name);
      if (existsSync(next)) return next;
    }
    try {
      const match = readdirSync(dir).find(
        (file) =>
          /\.exe$/i.test(file) &&
          !/^uninstall/i.test(file) &&
          !/setup/i.test(file) &&
          !/update/i.test(file) &&
          !/elevate/i.test(file),
      );
      if (match) return join(dir, match);
    } catch {
      /* folder missing */
    }
  }
  return hinted[0] || process.execPath;
}

function realCwd(requested) {
  if (requested && existsSync(requested) && !requested.includes("app.asar")) return requested;
  try {
    const exeDir = dirname(app.getPath("exe"));
    if (exeDir && existsSync(exeDir)) return exeDir;
  } catch {
    /* app not ready */
  }
  if (process.resourcesPath && existsSync(process.resourcesPath)) return process.resourcesPath;
  return process.cwd();
}

export function unpackPath(filePath) {
  if (!filePath.includes("app.asar") || filePath.includes("app.asar.unpacked")) return filePath;
  const unpacked = filePath.replace("app.asar", "app.asar.unpacked");
  return existsSync(unpacked) ? unpacked : filePath;
}

/**
 * Run a JS file as Node using this Electron binary.
 * Always attaches an error handler so Windows ENOENT cannot crash the app.
 */
export function runNodeScript(script, opts = {}) {
  const bin = electronBinary();
  const entry = unpackPath(script);
  const env = {
    ...process.env,
    ...(opts.env || {}),
    ELECTRON_RUN_AS_NODE: "1",
  };
  if (!bin || !existsSync(bin)) {
    const error = Object.assign(new Error(`Nox helper is missing (${bin || "no exe"})`), { code: "ENOENT" });
    queueMicrotask(() => opts.onError?.(error));
    return null;
  }
  if (!existsSync(entry)) {
    const error = Object.assign(new Error(`Nox helper script is missing (${entry})`), { code: "ENOENT" });
    queueMicrotask(() => opts.onError?.(error));
    return null;
  }
  const child = fork(entry, opts.args || [], {
    execPath: bin,
    execArgv: [],
    cwd: realCwd(opts.cwd),
    env,
    silent: true,
    windowsHide: true,
  });
  child.on("error", (error) => {
    opts.onError?.(error);
  });
  return child;
}
