import { create } from "zustand";

type Mode = "off" | "picking" | "viewing";

interface StreetViewState {
  mode: Mode;
  position: { lng: number; lat: number } | null;
  startPicking: () => void;
  setPosition: (pos: { lng: number; lat: number }) => void;
  close: () => void;
}

export const useStreetViewStore = create<StreetViewState>((set) => ({
  mode: "off",
  position: null,
  startPicking: () => set({ mode: "picking", position: null }),
  setPosition: (pos) => set({ mode: "viewing", position: pos }),
  close: () => set({ mode: "off", position: null }),
}));
