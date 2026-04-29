import { fetchOdptTrains } from "./odptRealtime";
import { fetchMiniTokyoTid } from "./miniTokyoProxy";
import { useTrainsRealtimeStore } from "@/stores/trainsRealtimeStore";

const POLL_INTERVAL_MS = 10_000;
const STALE_TIMEOUT_MS = 5 * 60_000;

export interface OdptPollerOptions {
  consumerKey: string;
}

export function startOdptTrainsPoller(options: OdptPollerOptions) {
  const { consumerKey } = options;
  let stopped = false;
  const timers: number[] = [];

  const poll = async () => {
    if (stopped) return;

    // Fetch song song. Settle riêng biệt để 1 nguồn fail không kill nguồn kia.
    const [odptResult, miniTokyoResult] = await Promise.allSettled([
      fetchOdptTrains(consumerKey),
      fetchMiniTokyoTid(),
    ]);

    if (stopped) return;

    const merged = [];

    if (odptResult.status === "fulfilled") {
      merged.push(...odptResult.value);
    } else {
      console.warn("[odpt-trains] ODPT fetch failed:", odptResult.reason);
    }

    if (miniTokyoResult.status === "fulfilled") {
      merged.push(...miniTokyoResult.value);
    } else {
      console.warn(
        "[odpt-trains] MiniTokyo TID failed:",
        miniTokyoResult.reason,
      );
    }

    if (merged.length > 0) {
      useTrainsRealtimeStore.getState().updateFromFeed(merged);
    }
  };

  poll();
  timers.push(window.setInterval(poll, POLL_INTERVAL_MS));
  timers.push(
    window.setInterval(() => {
      useTrainsRealtimeStore.getState().pruneStale(STALE_TIMEOUT_MS);
    }, 60_000),
  );

  return {
    stop: () => {
      stopped = true;
      timers.forEach((t) => clearInterval(t));
    },
  };
}
