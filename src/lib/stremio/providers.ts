export type Provider = {
  id: string;
  name: string;
  catalogId: string;
  bg: string;
  logo: string;
  bleed?: boolean;
};

export const PROVIDERS: Provider[] = [
  { id: "nfx", name: "Netflix", catalogId: "nfx", bg: "#141414", logo: "/providers/netflix.svg", bleed: true },
  { id: "amp", name: "Prime Video", catalogId: "amp", bg: "#f4f4f4", logo: "/providers/prime.svg" },
  { id: "dnp", name: "Disney+", catalogId: "dnp", bg: "#113ccf", logo: "/providers/disneyplus.svg" },
  { id: "atp", name: "Apple TV+", catalogId: "atp", bg: "#000000", logo: "/providers/appletv.svg" },
  { id: "hbm", name: "HBO Max", catalogId: "hbm", bg: "#12071f", logo: "/providers/hbomax.svg" },
  { id: "hlu", name: "Hulu", catalogId: "hlu", bg: "#0b0b0b", logo: "/providers/hulu.svg" },
  { id: "pmp", name: "Paramount+", catalogId: "pmp", bg: "#0064ff", logo: "/providers/paramount.svg" },
  { id: "pcp", name: "Peacock", catalogId: "pcp", bg: "#000000", logo: "/providers/peacock.svg" },
  { id: "cru", name: "Crunchyroll", catalogId: "cru", bg: "#ff6400", logo: "/providers/crunchyroll.svg" },
  { id: "stz", name: "Starz", catalogId: "stz", bg: "#000000", logo: "/providers/starz.svg" },
  { id: "mbi", name: "Mubi", catalogId: "mbi", bg: "#ffffff", logo: "/providers/mubi.svg" },
  { id: "shd", name: "Shudder", catalogId: "shd", bg: "#1a0000", logo: "/providers/shudder.svg" },
  { id: "bbo", name: "BritBox", catalogId: "bbo", bg: "#002f6c", logo: "/providers/britbox.svg" },
  { id: "dpe", name: "Discovery+", catalogId: "dpe", bg: "#0777f0", logo: "/providers/discovery.svg" },
  { id: "cts", name: "Curiosity", catalogId: "cts", bg: "#e8a317", logo: "/providers/curiosity.svg" },
  { id: "sst", name: "SkyShowtime", catalogId: "sst", bg: "#6c2bd9", logo: "/providers/skyshowtime.svg" },
];

export function providerById(id: string) {
  return PROVIDERS.find((p) => p.id === id) ?? null;
}
