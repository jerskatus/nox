import { createJSONStorage, type StateStorage } from "zustand/middleware";

const memory = new Map<string, string>();

function desktop() {
  if (typeof window === "undefined") return undefined;
  return window.noxDesktop;
}

export const persistBacking: StateStorage = {
  getItem: (name) => {
    const api = desktop();
    if (api?.persistGet) {
      return api.persistGet(name).then((value) => {
        if (typeof value === "string" && value) {
          try {
            window.localStorage.setItem(name, value);
          } catch {
            /* ignore */
          }
          return value;
        }
        try {
          return window.localStorage.getItem(name);
        } catch {
          return null;
        }
      });
    }
    if (typeof window === "undefined") return memory.get(name) ?? null;
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    if (typeof window === "undefined") {
      memory.set(name, value);
      return;
    }
    try {
      window.localStorage.setItem(name, value);
    } catch {
      /* ignore */
    }
    void desktop()?.persistSet?.(name, value);
  },
  removeItem: (name) => {
    if (typeof window === "undefined") {
      memory.delete(name);
      return;
    }
    try {
      window.localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
    void desktop()?.persistRemove?.(name);
  },
};

export const persistStorage = createJSONStorage(() => persistBacking);
