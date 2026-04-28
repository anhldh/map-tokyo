// src/helpers/gtfsPoller.ts
import { GTFS_SOURCES, type GtfsSourceConfig } from "./gtfsStatic";
import { fetchVehiclePositions } from "./gtfsRealtime";
import { useBusesStore } from "@/stores/busesStore";

const POLL_INTERVAL_MS = 10_000;
const STALE_TIMEOUT_MS = 5 * 60_000; // bus mất tích > 5 phút thì xoá

export interface GtfsPollerOptions {
  consumerKey: string;
  sources?: GtfsSourceConfig[];
}

export function startGtfsPoller(options: GtfsPollerOptions) {
  const { consumerKey, sources = GTFS_SOURCES } = options;

  let stopped = false;
  const timers: number[] = [];

  const pollOne = async (source: GtfsSourceConfig) => {
    if (stopped) return;
    try {
      const vehicles = await fetchVehiclePositions(
        source.vehiclePositionUrl,
        consumerKey,
      );
      useBusesStore
        .getState()
        .updateFromFeed(source.agencyId, source.color, vehicles);
    } catch (err) {
      console.warn(`[gtfs] ${source.agencyId} poll failed:`, err);
    }
  };

  // Stagger initial polls để không hammer server
  sources.forEach((source, i) => {
    setTimeout(() => pollOne(source), i * 1000);
    const timer = window.setInterval(() => pollOne(source), POLL_INTERVAL_MS);
    timers.push(timer);
  });

  // Prune stale mỗi phút
  const pruneTimer = window.setInterval(() => {
    useBusesStore.getState().pruneStale(STALE_TIMEOUT_MS);
  }, 60_000);
  timers.push(pruneTimer);

  return {
    stop: () => {
      stopped = true;
      timers.forEach((t) => clearInterval(t));
    },
  };
}
