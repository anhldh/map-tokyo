import { create } from "zustand";
import distance from "@turf/distance";
import { point as turfPoint } from "@turf/helpers";

export type LngLat = [number, number];

interface CameraSnapshot {
  center: LngLat;
  zoom: number;
  pitch: number;
  bearing: number;
}

interface MeasureStore {
  isActive: boolean;
  points: LngLat[];
  hoverPoint: LngLat | null; // vị trí chuột để preview line
  cameraSnapshot: CameraSnapshot | null;

  // Derived
  getSegmentDistances: () => number[]; // mét, giữa các cặp điểm liên tiếp
  getTotalDistance: () => number;

  // Actions
  activate: (snapshot: CameraSnapshot) => void;
  deactivate: () => void;
  addPoint: (p: LngLat) => void;
  removeLastPoint: () => void;
  setHoverPoint: (p: LngLat | null) => void;
  clear: () => void;
}

function calcDistance(a: LngLat, b: LngLat): number {
  return distance(turfPoint(a), turfPoint(b), { units: "meters" });
}

export const useMeasureStore = create<MeasureStore>((set, get) => ({
  isActive: false,
  points: [],
  hoverPoint: null,
  cameraSnapshot: null,

  getSegmentDistances: () => {
    const pts = get().points;
    const result: number[] = [];
    for (let i = 1; i < pts.length; i++) {
      result.push(calcDistance(pts[i - 1], pts[i]));
    }
    return result;
  },

  getTotalDistance: () => {
    return get()
      .getSegmentDistances()
      .reduce((a, b) => a + b, 0);
  },

  activate: (snapshot) => set({ isActive: true, cameraSnapshot: snapshot }),

  deactivate: () =>
    set({
      isActive: false,
      points: [],
      hoverPoint: null,
      cameraSnapshot: null,
    }),

  addPoint: (p) => set((s) => ({ points: [...s.points, p] })),

  removeLastPoint: () => set((s) => ({ points: s.points.slice(0, -1) })),

  setHoverPoint: (p) => set({ hoverPoint: p }),

  clear: () => set({ points: [], hoverPoint: null }),
}));

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters.toFixed(0)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}
