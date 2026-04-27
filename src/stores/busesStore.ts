// src/stores/busesStore.ts
import { create } from "zustand";
import type { VehiclePosition } from "@/helpers/gtfsRealtime";

interface BusSnapshot {
  position: [number, number];
  bearing?: number;
  /** performance.now() khi nhận được snapshot này */
  receivedAt: number;
  /** Server timestamp (cho debug) */
  serverTime: number;
}

export interface BusState {
  vehicleId: string;
  agencyId: string;
  routeId?: string;
  tripId?: string;
  color: string;
  /** 2 snapshot gần nhất (cũ, mới) để interpolate */
  prev: BusSnapshot | null;
  current: BusSnapshot;
}

interface BusesStore {
  /** Map<vehicleId, BusState> */
  buses: Map<string, BusState>;
  /** Update từ GTFS-RT feed của 1 agency */
  updateFromFeed: (
    agencyId: string,
    color: string,
    vehicles: VehiclePosition[],
  ) => void;
  /** Xóa bus không thấy report trong N giây gần đây */
  pruneStale: (maxAgeMs: number) => void;
}

export const useBusesStore = create<BusesStore>((set, get) => ({
  buses: new Map(),

  updateFromFeed: (agencyId, color, vehicles) => {
    const buses = new Map(get().buses);
    const now = performance.now();

    for (const v of vehicles) {
      // Globally unique key — vehicleId có thể trùng giữa các agency
      const key = `${agencyId}:${v.vehicleId}`;
      const existing = buses.get(key);

      const newSnap: BusSnapshot = {
        position: v.position,
        bearing: v.bearing,
        receivedAt: now,
        serverTime: v.timestamp,
      };

      if (!existing) {
        buses.set(key, {
          vehicleId: v.vehicleId,
          agencyId,
          routeId: v.routeId,
          tripId: v.tripId,
          color,
          prev: null,
          current: newSnap,
        });
      } else if (
        existing.current.serverTime !== newSnap.serverTime ||
        existing.current.position[0] !== newSnap.position[0] ||
        existing.current.position[1] !== newSnap.position[1]
      ) {
        buses.set(key, {
          ...existing,
          routeId: v.routeId ?? existing.routeId,
          tripId: v.tripId ?? existing.tripId,
          prev: existing.current,
          current: newSnap,
        });
      }
    }

    set({ buses });
  },

  pruneStale: (maxAgeMs) => {
    const now = performance.now();
    const buses = new Map(get().buses);
    let changed = false;
    for (const [key, bus] of buses) {
      if (now - bus.current.receivedAt > maxAgeMs) {
        buses.delete(key);
        changed = true;
      }
    }
    if (changed) set({ buses });
  },
}));

/** Tính vị trí interpolate hiện tại của 1 bus */
export function getBusInterpolatedState(
  bus: BusState,
  now: number,
): { position: [number, number]; bearing: number } {
  const { prev, current } = bus;

  if (!prev) {
    return {
      position: current.position,
      bearing: current.bearing ?? 0,
    };
  }

  // Lerp giữa prev → current. Estimate t dựa trên thời gian đã trôi.
  const interval = current.receivedAt - prev.receivedAt;
  if (interval <= 0) {
    return {
      position: current.position,
      bearing: current.bearing ?? 0,
    };
  }

  // Cho phép extrapolate nhẹ (max 1.2x) để không đứng yên khi feed delay
  const elapsed = now - current.receivedAt;
  const t = Math.min(1.2, 1 + elapsed / interval);

  const lng = prev.position[0] + t * (current.position[0] - prev.position[0]);
  const lat = prev.position[1] + t * (current.position[1] - prev.position[1]);

  // Bearing: ưu tiên current, fallback tính từ direction prev→current
  let bearing = current.bearing;
  if (bearing === undefined) {
    const dLng = current.position[0] - prev.position[0];
    const dLat = current.position[1] - prev.position[1];
    if (dLng !== 0 || dLat !== 0) {
      const lat1 = (prev.position[1] * Math.PI) / 180;
      const lat2 = (current.position[1] * Math.PI) / 180;
      const dLngRad = (dLng * Math.PI) / 180;
      const y = Math.sin(dLngRad) * Math.cos(lat2);
      const x =
        Math.cos(lat1) * Math.sin(lat2) -
        Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLngRad);
      bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
    } else {
      bearing = 0;
    }
  }

  return { position: [lng, lat], bearing };
}
