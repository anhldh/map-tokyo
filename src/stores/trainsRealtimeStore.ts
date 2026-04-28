// src/stores/trainsRealtimeStore.ts
import { create } from "zustand";
import type { OdptTrainRealtime } from "@/data/odptRealtime";

export interface RealtimeTrainEntry {
  delay: number; // seconds
  fromStation?: string;
  toStation?: string;
  /** performance.now() khi nhận snapshot */
  receivedAt: number;
}

interface TrainsRealtimeStore {
  /** Map<key, entry> với key = `${railway}|${trainNumber}` */
  entries: Map<string, RealtimeTrainEntry>;
  hasData: boolean;
  updateFromFeed: (data: OdptTrainRealtime[]) => void;
  pruneStale: (maxAgeMs: number) => void;
}

export function makeRealtimeKey(railway: string, trainNumber: string): string {
  return `${railway}|${trainNumber}`;
}

export const useTrainsRealtimeStore = create<TrainsRealtimeStore>(
  (set, get) => ({
    entries: new Map(),
    hasData: false,

    updateFromFeed: (data) => {
      const now = performance.now();
      const next = new Map(get().entries);

      for (const item of data) {
        const key = makeRealtimeKey(item.railway, item.trainNumber);
        next.set(key, {
          delay: item.delay,
          fromStation: item.fromStation,
          toStation: item.toStation,
          receivedAt: now,
        });
      }

      set({ entries: next, hasData: true });
    },

    pruneStale: (maxAgeMs) => {
      const now = performance.now();
      const next = new Map(get().entries);
      let changed = false;
      for (const [key, entry] of next) {
        if (now - entry.receivedAt > maxAgeMs) {
          next.delete(key);
          changed = true;
        }
      }
      if (changed) set({ entries: next });
    },
  }),
);
