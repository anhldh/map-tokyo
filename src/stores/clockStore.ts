// import { create } from "zustand";
// import dayjs, { type Dayjs } from "dayjs";
// import utc from "dayjs/plugin/utc";
// import timezone from "dayjs/plugin/timezone";

// dayjs.extend(utc);
// dayjs.extend(timezone);

// export const TOKYO_TZ = "Asia/Tokyo";

// export type LightPreset = "dawn" | "day" | "dusk" | "night";

// function getLightPreset(tokyoTime: Dayjs): LightPreset {
//   const h = tokyoTime.hour();
//   if (h >= 5 && h < 7) return "dawn";
//   if (h >= 7 && h < 17) return "day";
//   if (h >= 17 && h < 19) return "dusk";
//   return "night";
// }

// export function isLightTheme(preset: LightPreset): boolean {
//   return preset === "day";
// }

// interface ClockState {
//   /** Giờ Tokyo dưới dạng Dayjs object */
//   now: Dayjs;
//   lightPreset: LightPreset;
//   tick: () => void;
// }

// const initialNow = dayjs().tz(TOKYO_TZ);

// export const useClockStore = create<ClockState>((set) => ({
//   now: initialNow,
//   lightPreset: getLightPreset(initialNow),
//   tick: () =>
//     set(() => {
//       const now = dayjs().tz(TOKYO_TZ);
//       return { now, lightPreset: getLightPreset(now) };
//     }),
// }));

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
  /** Giờ Tokyo "hiệu lực" — có thể là real-time + offset, hoặc giờ frozen */
  now: Dayjs;
  lightPreset: LightPreset;

  /** Offset (ms) so với giờ real-time. 0 = đang chạy real-time. */
  offsetMs: number;
  /** Nếu true, đồng hồ đứng yên tại `frozenAt`. Nếu false, chạy theo realtime+offset. */
  frozen: boolean;
  frozenAt: Dayjs | null;

  /** Tick định kỳ — chỉ có tác dụng khi không frozen */
  tick: () => void;

  /** Set giờ về 1 thời điểm cụ thể (Tokyo time). Mặc định freeze. */
  setTime: (target: Dayjs, options?: { freeze?: boolean }) => void;

  /** Reset về real-time */
  resetToRealTime: () => void;

  lastTickAt: number;
}

const initialNow = dayjs().tz(TOKYO_TZ);

export const useClockStore = create<ClockState>((set, get) => ({
  now: initialNow,
  lightPreset: getLightPreset(initialNow),
  offsetMs: 0,
  frozen: false,
  frozenAt: null,
  lastTickAt: 0,

  tick: () =>
    set((state) => {
      if (state.frozen) return state;
      const now = dayjs().tz(TOKYO_TZ).add(state.offsetMs, "millisecond");
      return {
        now,
        lightPreset: getLightPreset(now),
        lastTickAt: performance.now(),
      };
    }),

  setTime: (target, options = {}) => {
    const { freeze = true } = options;
    if (freeze) {
      set({
        frozen: true,
        frozenAt: target,
        now: target,
        lightPreset: getLightPreset(target),
      });
    } else {
      // Không freeze: tính offset để realtime + offset = target, rồi tiếp tục chạy
      const realNow = dayjs().tz(TOKYO_TZ);
      const offsetMs = target.valueOf() - realNow.valueOf();
      set({
        frozen: false,
        frozenAt: null,
        offsetMs,
        now: target,
        lightPreset: getLightPreset(target),
      });
    }
  },

  resetToRealTime: () => {
    const now = dayjs().tz(TOKYO_TZ);
    set({
      frozen: false,
      frozenAt: null,
      offsetMs: 0,
      now,
      lightPreset: getLightPreset(now),
    });
  },
}));

let tickerStarted = false;
export function startClockTicker() {
  if (tickerStarted) return;
  tickerStarted = true;
  setInterval(() => useClockStore.getState().tick(), 1000);
}
