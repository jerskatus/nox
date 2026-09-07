export const DESKTOP_SITE_URL = "https://nox-gamma-one.vercel.app";
export const DESKTOP_RELEASES_URL = "https://github.com/jerskatus/nox/releases/latest";

export type NoxDesktop = {
  version: string;
};

declare global {
  interface Window {
    noxDesktop?: NoxDesktop;
  }
}

export function isNoxDesktop() {
  return typeof window !== "undefined" && Boolean(window.noxDesktop);
}
