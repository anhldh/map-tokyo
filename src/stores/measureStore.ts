import { create } from "zustand";
import distance from "@turf/distance";
import { point as turfPoint } from "@turf/helpers";

export type LngLat = [number, number];

export interface Measurement {
  id: string;
  points: LngLat[];
  closed: boolean; // true = polygon kín
  createdAt: number;
}

interface CameraSnapshot {
  center: LngLat;
  zoom: number;
  pitch: number;
  bearing: number;
}

interface MeasureStore {
  isActive: boolean;
  measurements: Measurement[];
  activeId: string | null; // id của measurement đang vẽ
  hoverPoint: LngLat | null;
  cameraSnapshot: CameraSnapshot | null;

  // Selectors
  getActive: () => Measurement | null;
  getDistance: (m: Measurement) => number;

  // Mode
  activate: (snapshot: CameraSnapshot) => void;
  deactivate: () => void;

  // Drawing actions
  addPoint: (p: LngLat) => void;
  closeActive: () => void; // đóng thành polygon (click điểm đầu)
  finishActive: () => void; // chốt là polyline mở (Enter / double-click)
  removeLastPoint: () => void;
  setHoverPoint: (p: LngLat | null) => void;

  // List management
  removeMeasurement: (id: string) => void;
  clearAll: () => void;
}

function calcDistance(a: LngLat, b: LngLat): number {
  return distance(turfPoint(a), turfPoint(b), { units: "meters" });
}

function makeId() {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export const useMeasureStore = create<MeasureStore>((set, get) => ({
  isActive: false,
  measurements: [],
  activeId: null,
  hoverPoint: null,
  cameraSnapshot: null,

  getActive: () => {
    const { measurements, activeId } = get();
    return measurements.find((m) => m.id === activeId) ?? null;
  },

  getDistance: (m) => {
    let total = 0;
    for (let i = 1; i < m.points.length; i++) {
      total += calcDistance(m.points[i - 1], m.points[i]);
    }
    if (m.closed && m.points.length >= 3) {
      total += calcDistance(m.points[m.points.length - 1], m.points[0]);
    }
    return total;
  },

  activate: (snapshot) =>
    set({
      isActive: true,
      cameraSnapshot: snapshot,
      activeId: null,
      hoverPoint: null,
    }),

  deactivate: () =>
    set({
      isActive: false,
      activeId: null,
      hoverPoint: null,
      cameraSnapshot: null,
      // Giữ measurements lại — không xóa
    }),

  addPoint: (p) => {
    const { activeId, measurements } = get();

    // Chưa có active → tạo measurement mới
    if (!activeId) {
      const newM: Measurement = {
        id: makeId(),
        points: [p],
        closed: false,
        createdAt: Date.now(),
      };
      set({
        measurements: [...measurements, newM],
        activeId: newM.id,
      });
      return;
    }

    // Có active → check xem click có trúng điểm đầu không (đóng polygon)
    const active = measurements.find((m) => m.id === activeId);
    if (!active) return;

    if (active.points.length >= 3) {
      const first = active.points[0];
      // Tolerance: ~50m (depend zoom, có thể chỉnh). Đơn giản dùng metric distance.
      const d = calcDistance(first, p);
      if (d < 50) {
        // Close polygon
        set({
          measurements: measurements.map((m) =>
            m.id === activeId ? { ...m, closed: true } : m,
          ),
          activeId: null,
          hoverPoint: null,
        });
        return;
      }
    }

    // Bình thường: append point
    set({
      measurements: measurements.map((m) =>
        m.id === activeId ? { ...m, points: [...m.points, p] } : m,
      ),
    });
  },

  closeActive: () => {
    const { activeId, measurements } = get();
    if (!activeId) return;
    const active = measurements.find((m) => m.id === activeId);
    if (!active || active.points.length < 3) return;
    set({
      measurements: measurements.map((m) =>
        m.id === activeId ? { ...m, closed: true } : m,
      ),
      activeId: null,
      hoverPoint: null,
    });
  },

  finishActive: () => {
    const { activeId, measurements } = get();
    if (!activeId) return;
    const active = measurements.find((m) => m.id === activeId);
    // Cần ít nhất 2 điểm. Nếu chỉ có 1, xóa luôn (không có gì để giữ)
    if (!active || active.points.length < 2) {
      set({
        measurements: measurements.filter((m) => m.id !== activeId),
        activeId: null,
        hoverPoint: null,
      });
      return;
    }
    set({ activeId: null, hoverPoint: null });
  },

  removeLastPoint: () => {
    const { activeId, measurements } = get();
    if (!activeId) return;
    const active = measurements.find((m) => m.id === activeId);
    if (!active) return;

    // Chỉ còn 1 điểm và xóa nốt → bỏ measurement
    if (active.points.length <= 1) {
      set({
        measurements: measurements.filter((m) => m.id !== activeId),
        activeId: null,
      });
      return;
    }
    set({
      measurements: measurements.map((m) =>
        m.id === activeId ? { ...m, points: m.points.slice(0, -1) } : m,
      ),
    });
  },

  setHoverPoint: (p) => set({ hoverPoint: p }),

  removeMeasurement: (id) =>
    set((s) => ({
      measurements: s.measurements.filter((m) => m.id !== id),
      activeId: s.activeId === id ? null : s.activeId,
    })),

  clearAll: () => set({ measurements: [], activeId: null, hoverPoint: null }),
}));

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters.toFixed(0)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}
