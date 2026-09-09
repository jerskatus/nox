export const DESKTOP_SITE_URL = "https://nox-gamma-one.vercel.app";
export const DESKTOP_RELEASES_URL = "https://github.com/jerskatus/nox/releases/latest";
export const DESKTOP_LATEST_API = "https://api.github.com/repos/jerskatus/nox/releases/latest";

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

export function updateStatusLabel(payload: DesktopUpdateStatus): string {
  if (payload.message?.trim()) return payload.message.trim();
  switch (payload.status) {
    case "checking":
      return "Checking for updates…";
    case "available":
      return payload.version ? `Nox ${payload.version} is available.` : "An update is available.";
    case "downloading":
      return `Downloading update… ${payload.percent ?? 0}%`;
    case "ready":
      return payload.version ? `Nox ${payload.version} is ready to install.` : "Update ready — restart to install.";
    case "error":
      return "Could not check for updates.";
    case "dev":
      return "Updates only run from an installed copy of Nox.";
    default:
      return "";
  }
}

export async function fetchLatestDesktopRelease(): Promise<DesktopUpdateStatus> {
  const res = await fetch(DESKTOP_LATEST_API, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) {
    return { status: "error", message: "Could not reach the update feed." };
  }
  const data = (await res.json()) as { tag_name?: string };
  const version = String(data.tag_name ?? "").replace(/^v/i, "").trim();
  if (!version) {
    return { status: "error", message: "Could not read the latest version." };
  }
  return {
    status: "available",
    version,
    message: `Latest Windows app is Nox ${version}.`,
  };
}

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
    video?: "copy" | "h264";
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
  persistGet?: (key: string) => Promise<string | null>;
  persistSet?: (key: string, value: string) => Promise<void>;
  persistRemove?: (key: string) => Promise<void>;
};

declare global {
  interface Window {
    noxDesktop?: NoxDesktop;
  }
}

export function applyUpdateResult(
  prev: DesktopUpdateStatus,
  result: DesktopUpdateStatus,
): DesktopUpdateStatus {
  const next = { ...prev, ...result };
  if (next.status === "idle" && !result.message) {
    return { ...next, message: "Nox is up to date." };
  }
  return { ...next, message: updateStatusLabel(next) || prev.message };
}

export function isElectronUserAgent(ua: string | undefined | null) {
  const text = String(ua ?? "");
  return /\bElectron\b/i.test(text) || /\bNoxDesktop\b/i.test(text);
}

export function isNoxDesktop() {
  if (typeof window === "undefined") return false;
  if (window.noxDesktop) return true;
  try {
    return isElectronUserAgent(window.navigator?.userAgent);
  } catch {
    return false;
  }
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
