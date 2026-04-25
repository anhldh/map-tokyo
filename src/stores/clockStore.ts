// // src/stores/clockStore.ts
// import { create } from "zustand";

// export type LightPreset = "dawn" | "day" | "dusk" | "night";

// interface ClockState {
//   now: Date;
//   lightPreset: LightPreset;
//   tick: () => void;
// }

// function getLightPreset(date: Date): LightPreset {
//   const h = date.getHours();
//   if (h >= 5 && h < 7) return "dawn";
//   if (h >= 7 && h < 17) return "day";
//   if (h >= 17 && h < 19) return "dusk";
//   return "night";
// }

// export function isLightTheme(preset: LightPreset): boolean {
//   return preset === "day";
// }

// export const useClockStore = create<ClockState>((set) => ({
//   now: new Date(),
//   lightPreset: getLightPreset(new Date()),
//   tick: () =>
//     set(() => {
//       const now = new Date();
//       return { now, lightPreset: getLightPreset(now) };
//     }),
// }));

// // Auto tick mỗi giây — gọi 1 lần ở app entry
// let tickerStarted = false;
// export function startClockTicker() {
//   if (tickerStarted) return;
//   tickerStarted = true;
//   setInterval(() => useClockStore.getState().tick(), 1000);
// }
import { create } from "zustand";
import dayjs, { type Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

export const TOKYO_TZ = "Asia/Tokyo";

export type LightPreset = "dawn" | "day" | "dusk" | "night";

function getLightPreset(tokyoTime: Dayjs): LightPreset {
  const h = tokyoTime.hour();
  if (h >= 5 && h < 7) return "dawn";
  if (h >= 7 && h < 17) return "day";
  if (h >= 17 && h < 19) return "dusk";
  return "night";
}

export function isLightTheme(preset: LightPreset): boolean {
  return preset === "day";
}

interface ClockState {
  /** Giờ Tokyo dưới dạng Dayjs object */
  now: Dayjs;
  lightPreset: LightPreset;
  tick: () => void;
}

const initialNow = dayjs().tz(TOKYO_TZ);

export const useClockStore = create<ClockState>((set) => ({
  now: initialNow,
  lightPreset: getLightPreset(initialNow),
  tick: () =>
    set(() => {
      const now = dayjs().tz(TOKYO_TZ);
      return { now, lightPreset: getLightPreset(now) };
    }),
}));

let tickerStarted = false;
export function startClockTicker() {
  if (tickerStarted) return;
  tickerStarted = true;
  setInterval(() => useClockStore.getState().tick(), 1000);
}
