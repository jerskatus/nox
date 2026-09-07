import { create } from "zustand";
import { persist } from "zustand/middleware";

type GoogleState = {
  clientId: string;
  accessToken: string | null;
  expiresAt: number;
  email: string;
  name: string;
  picture: string;
  setClientId: (clientId: string) => void;
  setSession: (session: {
    accessToken: string;
    expiresAt: number;
    email?: string;
    name?: string;
    picture?: string;
  }) => void;
  clearSession: () => void;
};

export const useGoogleStore = create<GoogleState>()(
  persist(
    (set) => ({
      clientId: "",
      accessToken: null,
      expiresAt: 0,
      email: "",
      name: "",
      picture: "",
      setClientId: (clientId) => set({ clientId: clientId.trim() }),
      setSession: (session) =>
        set({
          accessToken: session.accessToken,
          expiresAt: session.expiresAt,
          email: session.email ?? "",
          name: session.name ?? "",
          picture: session.picture ?? "",
        }),
      clearSession: () => set({ accessToken: null, expiresAt: 0, email: "", name: "", picture: "" }),
    }),
    {
      name: "nox-google",
      skipHydration: true,
      partialize: (state) => ({
        clientId: state.clientId,
        accessToken: state.accessToken,
        expiresAt: state.expiresAt,
        email: state.email,
        name: state.name,
        picture: state.picture,
      }),
    },
  ),
);

export function googleLive(state: Pick<GoogleState, "accessToken" | "expiresAt">) {
  return Boolean(state.accessToken && state.expiresAt > Date.now() + 15_000);
}

export function googleClientId(state: Pick<GoogleState, "clientId">) {
  const fromStore = state.clientId.trim();
  if (fromStore) return fromStore;
  const fromEnv = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ?? "";
  return fromEnv;
}
