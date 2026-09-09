export const DESKTOP_SITE_URL = "https://nox-gamma-one.vercel.app";
export const DESKTOP_RELEASES_URL = "https://github.com/jerskatus/nox/releases/latest";

export type DesktopAudioTrack = {
  index: number;
  lang: string;
  codec: string;
  channels: string;
  isDefault?: boolean;
  cinema?: boolean;
  title?: string;
};

export type DesktopUpdateStatus = {
  status: "idle" | "checking" | "available" | "downloading" | "ready" | "error" | "dev";
  version?: string;
  percent?: number;
  message?: string;
};

export type NoxDesktop = {
  version: string;
  hasEngine?: boolean;
  standalone?: boolean;
  probe?: (url: string) => Promise<{ duration: number; tracks: DesktopAudioTrack[] }>;
  play?: (opts: {
    url: string;
    startAt?: number;
    audio?: number;
    transcode?: boolean;
  }) => Promise<{ src: string; transcode: boolean }>;
  stop?: () => Promise<void>;
  checkForUpdates?: () => Promise<DesktopUpdateStatus>;
  installUpdate?: () => Promise<void>;
  onUpdateStatus?: (callback: (payload: DesktopUpdateStatus) => void) => () => void;
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

export function desktopIsStandalone() {
  return Boolean(typeof window !== "undefined" && window.noxDesktop?.standalone);
}
