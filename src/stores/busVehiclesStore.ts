// src/stores/busVehiclesStore.ts
import { create } from "zustand";
import type { VehiclePosition } from "@/helpers/gtfsRealtime";

interface BusVehiclesStore {
  /** Set tripId của các trip có vehicle đang report */
  activeTripIds: Set<string>;
  /** Map tripId → vehicleId */
  tripToVehicle: Map<string, string>;
  hasData: boolean;
  updateFromFeed: (vehicles: VehiclePosition[]) => void;
}

export const useBusVehiclesStore = create<BusVehiclesStore>((set) => ({
  activeTripIds: new Set(),
  tripToVehicle: new Map(),
  hasData: false,

  updateFromFeed: (vehicles) => {
    const activeTripIds = new Set<string>();
    const tripToVehicle = new Map<string, string>();
    for (const v of vehicles) {
      if (v.tripId) {
        activeTripIds.add(v.tripId);
        tripToVehicle.set(v.tripId, v.vehicleId);
      }
    }
    set({ activeTripIds, tripToVehicle, hasData: true });
  },
}));
