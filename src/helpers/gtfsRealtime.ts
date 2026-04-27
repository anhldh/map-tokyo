// src/data/gtfsRealtime.ts
import GtfsRealtimeBindings from "gtfs-realtime-bindings";

export interface VehiclePosition {
  vehicleId: string;
  tripId?: string;
  routeId?: string;
  position: [number, number];
  bearing?: number;
  speed?: number;
  /** Timestamp (Unix seconds) khi vị trí được report */
  timestamp: number;
}

export async function fetchVehiclePositions(
  url: string,
  consumerKey: string,
): Promise<VehiclePosition[]> {
  const fullUrl = `${url}?acl:consumerKey=${consumerKey}`;
  const res = await fetch(fullUrl);
  if (!res.ok) {
    throw new Error(`GTFS-RT fetch failed: ${res.status}`);
  }
  const buffer = await res.arrayBuffer();
  const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
    new Uint8Array(buffer),
  );

  const vehicles: VehiclePosition[] = [];
  for (const entity of feed.entity) {
    const v = entity.vehicle;
    if (!v?.position) continue;

    vehicles.push({
      vehicleId: v.vehicle?.id ?? entity.id,
      tripId: v.trip?.tripId ?? undefined,
      routeId: v.trip?.routeId ?? undefined,
      position: [v.position.longitude, v.position.latitude],
      bearing: v.position.bearing ?? undefined,
      speed: v.position.speed ?? undefined,
      timestamp: Number(v.timestamp ?? feed.header?.timestamp ?? 0),
    });
  }
  return vehicles;
}
