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
  name?: string;
};

export type DesktopUpdateStatus = {
  status: "idle" | "checking" | "available" | "downloading" | "ready" | "error" | "dev";
  version?: string;
  percent?: number;
  message?: string;
};

export type VlcBounds = { x: number; y: number; width: number; height: number };

export type VlcPlayResult = {
  ok?: boolean;
  tracks?: DesktopAudioTrack[];
  length?: number;
  time?: number;
  playing?: boolean;
};

export type VlcEvent = {
  evt?: string;
  playing?: boolean;
  time?: number;
  length?: number;
  buffering?: boolean;
  audio?: number;
  tracks?: DesktopAudioTrack[];
  ended?: boolean;
  error?: string | null;
};

export type NoxDesktop = {
  version: string;
  hasEngine?: boolean;
  hasVlc?: boolean;
  standalone?: boolean;
  probe?: (url: string) => Promise<{ duration: number; tracks: DesktopAudioTrack[] }>;
  play?: (opts: {
    url: string;
    startAt?: number;
    audio?: number;
    transcode?: boolean;
  }) => Promise<{ src: string; transcode: boolean }>;
  stop?: () => Promise<void>;
  vlcPlay?: (opts: {
    url: string;
    startAt?: number;
    volume?: number;
    mute?: boolean;
    rate?: number;
    fit?: string;
    audio?: number;
    bounds?: VlcBounds;
  }) => Promise<VlcPlayResult>;
  vlcPause?: () => Promise<void>;
  vlcResume?: () => Promise<void>;
  vlcStop?: () => Promise<void>;
  vlcSeek?: (ms: number) => Promise<void>;
  vlcVolume?: (opts: { volume: number; mute?: boolean }) => Promise<void>;
  vlcRate?: (rate: number) => Promise<void>;
  vlcAudio?: (track: number) => Promise<void>;
  vlcFit?: (opts: { fit: string; width?: number; height?: number }) => Promise<void>;
  vlcBounds?: (bounds: VlcBounds) => Promise<void>;
  onVlcEvent?: (callback: (payload: VlcEvent) => void) => () => void;
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

export function desktopHasVlc() {
  return Boolean(typeof window !== "undefined" && window.noxDesktop?.hasVlc && window.noxDesktop.vlcPlay);
}

export function desktopIsStandalone() {
  return Boolean(typeof window !== "undefined" && window.noxDesktop?.standalone);
}
