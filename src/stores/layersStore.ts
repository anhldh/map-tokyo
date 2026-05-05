import { create } from "zustand";

export type LayerId =
  | "traffic"
  | "precipitation"
  //   | "fireworks"
  | "live-cameras"
  | "plateau"
  | "gtfs"
  | "air-quality"
  | "population";

interface LayersState {
  enabled: Set<LayerId>;
  toggle: (id: LayerId) => void;
  setEnabled: (id: LayerId, value: boolean) => void;
  isEnabled: (id: LayerId) => boolean;
}

const DEFAULT_ENABLED: LayerId[] = [
  //   "precipitation",
  //   "fireworks",
  //   "live-cameras",
  "traffic",
];

export const useLayersStore = create<LayersState>((set, get) => ({
  enabled: new Set(DEFAULT_ENABLED),

  toggle: (id) =>
    set((state) => {
      const next = new Set(state.enabled);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { enabled: next };
    }),

  setEnabled: (id, value) =>
    set((state) => {
      const next = new Set(state.enabled);
      if (value) next.add(id);
      else next.delete(id);
      return { enabled: next };
    }),

  isEnabled: (id) => get().enabled.has(id),
}));
