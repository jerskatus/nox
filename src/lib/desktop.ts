export const DESKTOP_SITE_URL = "https://nox-gamma-one.vercel.app";
export const DESKTOP_RELEASES_URL = "https://github.com/jerskatus/nox/releases/latest";

export type DesktopAudioTrack = {
  index: number;
  lang: string;
  codec: string;
  channels: string;
  isDefault?: boolean;
  cinema?: boolean;
};

export type NoxDesktop = {
  version: string;
  hasEngine?: boolean;
  probe?: (url: string) => Promise<{ duration: number; tracks: DesktopAudioTrack[] }>;
  play?: (opts: {
    url: string;
    startAt?: number;
    audio?: number;
    transcode?: boolean;
  }) => Promise<{ src: string; transcode: boolean }>;
  stop?: () => Promise<void>;
};

declare global {
  interface Window {
    noxDesktop?: NoxDesktop;
  }
}

export function isNoxDesktop() {
  return typeof window !== "undefined" && Boolean(window.noxDesktop);
}

export function desktopHasEngine() {
  return Boolean(typeof window !== "undefined" && window.noxDesktop?.hasEngine && window.noxDesktop.play);
}
