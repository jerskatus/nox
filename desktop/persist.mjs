import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { app, ipcMain } from "electron";

function persistPath() {
  return join(app.getPath("userData"), "persist.json");
}

function load() {
  try {
    const raw = JSON.parse(readFileSync(persistPath(), "utf8"));
    if (raw && typeof raw === "object") return raw;
  } catch {
    /* first run */
  }
  return {};
}

function save(data) {
  const target = persistPath();
  mkdirSync(dirname(target), { recursive: true });
  const tmp = `${target}.tmp`;
  writeFileSync(tmp, JSON.stringify(data));
  renameSync(tmp, target);
}

let queue = Promise.resolve();

function withFile(fn) {
  const job = queue.then(() => fn(load()));
  queue = job.catch(() => undefined);
  return job;
}

export function attachPersist() {
  ipcMain.handle("nox:persist-get", (_event, key) => {
    const name = String(key ?? "");
    if (!name) return null;
    const data = load();
    const value = data[name];
    return typeof value === "string" ? value : null;
  });
  ipcMain.handle("nox:persist-set", (_event, key, value) =>
    withFile((data) => {
      const name = String(key ?? "");
      if (!name) return false;
      data[name] = String(value ?? "");
      save(data);
      return true;
    }),
  );
  ipcMain.handle("nox:persist-remove", (_event, key) =>
    withFile((data) => {
      const name = String(key ?? "");
      if (!name) return false;
      delete data[name];
      save(data);
      return true;
    }),
  );
}

export function persistFileExists() {
  return existsSync(persistPath());
}
