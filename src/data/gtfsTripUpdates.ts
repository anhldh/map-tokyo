// src/data/gtfsTripUpdates.ts
import GtfsRealtimeBindings from "gtfs-realtime-bindings";

export interface TripDelay {
  tripId: string;
  /** Delay seconds — dương = chậm, âm = sớm */
  delay: number;
}

/**
 * Fetch trip_updates feed (GTFS-RT protobuf) → { tripId → delay }
 *
 * GTFS-RT trip_update có cấu trúc:
 * - entity[].tripUpdate.trip.tripId
 * - entity[].tripUpdate.delay (top-level delay nếu có)
 * - entity[].tripUpdate.stopTimeUpdate[]: per-stop delay
 *
 * Top-level delay > stopTimeUpdate cuối cùng > 0
 */
export async function fetchTripUpdates(
  url: string,
  consumerKey: string,
): Promise<TripDelay[]> {
  const fullUrl = `${url}?acl:consumerKey=${consumerKey}`;
  const res = await fetch(fullUrl);
  if (!res.ok) {
    throw new Error(`Trip updates fetch failed: ${res.status}`);
  }
  const buffer = await res.arrayBuffer();
  const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
    new Uint8Array(buffer),
  );

  const updates: TripDelay[] = [];
  for (const entity of feed.entity) {
    const tu = entity.tripUpdate;
    if (!tu) continue;
    const tripId = tu.trip?.tripId;
    if (!tripId) continue;

    // Ưu tiên top-level delay
    let delay: number | null =
      tu.delay !== undefined && tu.delay !== null ? Number(tu.delay) : null;

    // Fallback: lấy delay từ stop time update gần nhất (departure > arrival)
    if (delay === null && tu.stopTimeUpdate && tu.stopTimeUpdate.length > 0) {
      // Lấy update cuối cùng có delay info
      for (let i = tu.stopTimeUpdate.length - 1; i >= 0; i--) {
        const stu = tu.stopTimeUpdate[i];
        const d = stu.departure?.delay ?? stu.arrival?.delay;
        if (d !== undefined && d !== null) {
          delay = Number(d);
          break;
        }
      }
    }

    updates.push({
      tripId,
      delay: delay ?? 0,
    });
  }
  return updates;
}
