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
];

export function providerById(id: string) {
  return PROVIDERS.find((p) => p.id === id) ?? null;
}
