// // src/data/busDelaysPoller.ts
// import { fetchTripUpdates } from "./gtfsTripUpdates";
// import { GTFS_SOURCES } from "@/helpers/gtfsStatic";
// import { useBusDelaysStore } from "@/stores/busDelaysStore";

// const POLL_INTERVAL_MS = 30_000;

// export interface BusDelaysPollerOptions {
//   consumerKey: string;
// }

// export function startBusDelaysPoller(options: BusDelaysPollerOptions) {
//   const { consumerKey } = options;
//   let stopped = false;
//   const timers: number[] = [];

//   const sourcesWithUpdates = GTFS_SOURCES.filter((s) => s.tripUpdateUrl);

//   const poll = async () => {
//     if (stopped) return;

//     const results = await Promise.allSettled(
//       sourcesWithUpdates.map((s) =>
//         fetchTripUpdates(s.tripUpdateUrl!, consumerKey).then((updates) => ({
//           agencyId: s.agencyId,
//           updates,
//         })),
//       ),
//     );

//     if (stopped) return;

//     const merged = new Map<string, number>();
//     for (const r of results) {
//       if (r.status === "fulfilled") {
//         for (const u of r.value.updates) {
//           merged.set(u.tripId, u.delay);
//         }
//         console.log(
//           `[bus-delays] ${r.value.agencyId}: ${r.value.updates.length} updates`,
//         );
//       } else {
//         console.warn("[bus-delays] fetch failed:", r.reason);
//       }
//     }

//     if (merged.size > 0) {
//       useBusDelaysStore.getState().setDelays(merged);
//     }
//   };

//   poll();
//   timers.push(window.setInterval(poll, POLL_INTERVAL_MS));

//   return {
//     stop: () => {
//       stopped = true;
//       timers.forEach((t) => clearInterval(t));
//     },
//   };
// }
