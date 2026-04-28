// src/data/miniTokyoProxy.ts
import type { OdptTrainRealtime } from "./odptRealtime";

const MINI_TOKYO_TID_URL = "https://mini-tokyo.appspot.com/tid";

interface MiniTokyoTidEntry {
  id: string; // "JR-East.Itsukaichi.1148"
  delay: number; // seconds
  carComposition?: number;
}

/**
 * Fetch JR-East (và một số operator khác MiniTokyo có) qua proxy.
 * Format id: "{railway}.{trainNumber}" — railway có thể chứa dấu chấm.
 */
export async function fetchMiniTokyoTid(): Promise<OdptTrainRealtime[]> {
  const res = await fetch(MINI_TOKYO_TID_URL);
  if (!res.ok) {
    throw new Error(`MiniTokyo TID fetch failed: ${res.status}`);
  }
  const data: MiniTokyoTidEntry[] = await res.json();

  return data.map((item) => {
    const lastDot = item.id.lastIndexOf(".");
    const railway = lastDot > 0 ? item.id.slice(0, lastDot) : item.id;
    const trainNumber = lastDot > 0 ? item.id.slice(lastDot + 1) : "";

    return {
      trainNumber,
      railway,
      delay: item.delay ?? 0,
      // Proxy không cung cấp các field này
      fromStation: undefined,
      toStation: undefined,
      trainType: undefined,
      direction: undefined,
      date: new Date().toISOString(),
    };
  });
}
