import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { persistBacking } from "./persist-storage.ts";

describe("persistBacking", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    const localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => store.clear(),
      key: (index: number) => [...store.keys()][index] ?? null,
      get length() {
        return store.size;
      },
    };
    Object.defineProperty(globalThis, "window", {
      value: { localStorage },
      configurable: true,
      writable: true,
    });
  });

  it("reads and writes localStorage when the desktop bridge is missing", async () => {
    persistBacking.setItem("nox-addons", '{"state":{"addons":[1]}}');
    assert.equal(await persistBacking.getItem("nox-addons"), '{"state":{"addons":[1]}}');
    persistBacking.removeItem("nox-addons");
    assert.equal(await persistBacking.getItem("nox-addons"), null);
  });

  it("prefers the desktop disk copy over localStorage", async () => {
    persistBacking.setItem("nox-settings", '{"state":{"theme":"nox"}}');
    (window as unknown as { noxDesktop: { persistGet: (key: string) => Promise<string | null> } }).noxDesktop = {
      persistGet: async (key: string) => (key === "nox-settings" ? '{"state":{"theme":"ember"}}' : null),
    };
    assert.equal(await persistBacking.getItem("nox-settings"), '{"state":{"theme":"ember"}}');
    assert.equal(window.localStorage.getItem("nox-settings"), '{"state":{"theme":"ember"}}');
  });
});
