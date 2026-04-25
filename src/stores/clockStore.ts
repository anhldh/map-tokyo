// src/stores/clockStore.ts
import { create } from "zustand";

export type LightPreset = "dawn" | "day" | "dusk" | "night";

interface ClockState {
  now: Date;
  lightPreset: LightPreset;
  tick: () => void;
}

function getLightPreset(date: Date): LightPreset {
  const h = date.getHours();
  if (h >= 5 && h < 7) return "dawn";
  if (h >= 7 && h < 17) return "day";
  if (h >= 17 && h < 19) return "dusk";
  return "night";
}

export const useClockStore = create<ClockState>((set) => ({
  now: new Date(),
  lightPreset: getLightPreset(new Date()),
  tick: () =>
    set(() => {
      const now = new Date();
      return { now, lightPreset: getLightPreset(now) };
    }),
}));

// Auto tick mỗi giây — gọi 1 lần ở app entry
let tickerStarted = false;
export function startClockTicker() {
  if (tickerStarted) return;
  tickerStarted = true;
  setInterval(() => useClockStore.getState().tick(), 1000);
}
