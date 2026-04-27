import { create } from "zustand";
import {
  computeEffectiveLevel,
  type FloodScenario,
} from "@/helpers/floodModel";

interface FloodState {
  level: number; // raw input từ slider
  scenario: FloodScenario;
  setLevel: (level: number) => void;
  setScenario: (scenario: FloodScenario) => void;
  // Computed
  getEffectiveLevel: () => number;
}

export const useFloodStore = create<FloodState>((set, get) => ({
  level: 0,
  scenario: "realistic",
  setLevel: (level) => set({ level }),
  setScenario: (scenario) => set({ scenario }),
  getEffectiveLevel: () => computeEffectiveLevel(get().level, get().scenario),
}));
