// src/stores/busDelaysStore.ts
import { create } from "zustand";

interface BusDelaysStore {
  /** tripId → delay seconds */
  delays: Map<string, number>;
  hasData: boolean;
  setDelays: (delays: Map<string, number>) => void;
}

export const useBusDelaysStore = create<BusDelaysStore>((set) => ({
  delays: new Map(),
  hasData: false,
  setDelays: (delays) => set({ delays, hasData: true }),
}));
