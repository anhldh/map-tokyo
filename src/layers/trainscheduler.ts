import type { Station } from "@/helpers/loadRailwayData";
import {
  type RailwayPath,
  type PathSample,
  distanceToStation,
  samplePath,
} from "./railwaypath";

// ============================================================================
// Types từ timetable JSON
// ============================================================================

export interface TimetableStop {
  /** station ID */
  s: string;
  /** arrival "HH:MM" (không có ở stop đầu) */
  a?: string;
  /** departure "HH:MM" (không có ở stop cuối) */
  d?: string;
}

export interface TrainTimetable {
  id: string;
  /** train number */
  t: string;
  /** railway ID */
  r: string;
  n: string;
  /** train type */
  y: string;
  /** direction: "Outbound" | "Inbound" hoặc tên cụ thể */
  d: string;
  os: string[];
  ds: string[];
  /** next train timetable IDs (continuation qua railway khác) */
  nt?: string[];
  tt: TimetableStop[];
}

// ============================================================================
// Pre-computed timetable: convert "HH:MM" → seconds since 00:00,
// và tính distance trên railway của từng stop
// ============================================================================

interface PrecomputedStop {
  stationId: string;
  /** seconds since midnight, undefined nếu stop đầu */
  arrivalSec?: number;
  /** seconds since midnight, undefined nếu stop cuối */
  departureSec?: number;
  /** distance từ đầu railway tới ga này (meters) */
  distance: number;
}

export interface PrecomputedTimetable {
  id: string;
  trainNumber: string;
  railwayId: string;
  trainType: string;
  direction: string;
  stops: PrecomputedStop[];
  /** First departure & last arrival — dùng để filter active trains nhanh */
  startSec: number;
  endSec: number;
  /** True nếu các distance giảm dần (train chạy ngược chiều polyline) */
  reversed: boolean;
}

function parseTime(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 3600 + m * 60;
}

/**
 * Pre-compute 1 timetable. Trả về null nếu data không hợp lệ
 * (vd railway không có path, station không tồn tại).
 */
export function precomputeTimetable(
  tt: TrainTimetable,
  pathMap: Map<string, RailwayPath>,
  stationMap: Map<string, Station>,
): PrecomputedTimetable | null {
  const path = pathMap.get(tt.r);
  if (!path) {
    console.warn("[no-path]", tt.r, "tt:", tt.id);
    return null;
  }
  if (tt.tt.length < 2) return null;

  const stops: PrecomputedStop[] = [];
  for (const stop of tt.tt) {
    const station = stationMap.get(stop.s);
    if (!station) {
      console.warn("[no-station]", stop.s, "in", tt.id);
      return null;
    }
    if (!station.coord) {
      console.warn("[no-coord]", stop.s);
      return null;
    }
    stops.push({
      stationId: stop.s,
      arrivalSec: stop.a ? parseTime(stop.a) : undefined,
      departureSec: stop.d ? parseTime(stop.d) : undefined,
      distance: distanceToStation(path, station.coord),
    });
  }

  // Detect reversed: nếu stops đi từ distance lớn → nhỏ
  // Mini Tokyo dùng `direction` field, nhưng safer là tự detect
  let increasing = 0;
  let decreasing = 0;
  for (let i = 1; i < stops.length; i++) {
    if (stops[i].distance > stops[i - 1].distance) increasing++;
    else if (stops[i].distance < stops[i - 1].distance) decreasing++;
  }
  const reversed = decreasing > increasing;

  // Cross-midnight: nếu sau khi parse có time giảm so với time trước,
  // cộng thêm 24h vào tất cả time sau đó.
  let offset = 0;
  let prevSec = -Infinity;
  for (const s of stops) {
    if (s.arrivalSec !== undefined) {
      const t = s.arrivalSec + offset;
      if (t < prevSec) {
        offset += 24 * 3600;
        s.arrivalSec = s.arrivalSec + offset;
      } else {
        s.arrivalSec = t;
      }
      prevSec = s.arrivalSec;
    }
    if (s.departureSec !== undefined) {
      const t = s.departureSec + offset;
      if (t < prevSec) {
        offset += 24 * 3600;
        s.departureSec = s.departureSec + offset;
      } else {
        s.departureSec = t;
      }
      prevSec = s.departureSec;
    }
  }

  const first = stops[0];
  const last = stops[stops.length - 1];
  const startSec = first.departureSec ?? first.arrivalSec ?? 0;
  const endSec = last.arrivalSec ?? last.departureSec ?? 0;

  return {
    id: tt.id,
    trainNumber: tt.t,
    railwayId: tt.r,
    trainType: tt.y,
    direction: tt.d,
    stops,
    startSec,
    endSec,
    reversed,
  };
}

// ============================================================================
// Active train query
// ============================================================================

export interface ActiveTrainState {
  timetableId: string;
  trainNumber: string;
  railwayId: string;
  trainType: string;
  direction: string;
  /** Standing ở ga (đợi xuất phát/đang đậu) */
  standing: boolean;
  /** Sample trên polyline */
  sample: PathSample;
  /** Distance hiện tại từ đầu polyline */
  distance: number;
  /** Index của stop hiện tại (đang đậu) hoặc stop vừa rời */
  segmentIndex: number;
}

/**
 * Tính state của 1 train tại nowSec. Trả về null nếu train chưa hoạt động
 * hoặc đã kết thúc.
 *
 * Easing đơn giản: linear giữa 2 ga. Mini Tokyo có acceleration/deceleration
 * vật lý nhưng linear là đủ mượt cho ~500 train.
 */
export function getTrainStateAt(
  pre: PrecomputedTimetable,
  path: RailwayPath,
  nowSec: number,
): ActiveTrainState | null {
  if (nowSec < pre.startSec || nowSec > pre.endSec) return null;

  const { stops } = pre;

  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];

    // Đang đậu ở ga
    if (
      stop.arrivalSec !== undefined &&
      stop.departureSec !== undefined &&
      nowSec >= stop.arrivalSec &&
      nowSec <= stop.departureSec
    ) {
      return {
        timetableId: pre.id,
        trainNumber: pre.trainNumber,
        railwayId: pre.railwayId,
        trainType: pre.trainType,
        direction: pre.direction,
        standing: true,
        sample: samplePath(path, stop.distance),
        distance: stop.distance,
        segmentIndex: i,
      };
    }

    // Đang chạy giữa stop[i] và stop[i+1]
    const next = stops[i + 1];
    if (!next) break;
    const depSec = stop.departureSec;
    const arrSec = next.arrivalSec;
    if (depSec === undefined || arrSec === undefined) continue;

    if (nowSec >= depSec && nowSec <= arrSec) {
      const segDuration = arrSec - depSec;
      const t = segDuration > 0 ? (nowSec - depSec) / segDuration : 0;
      const distance = stop.distance + (next.distance - stop.distance) * t;

      const sample = samplePath(path, distance);

      // Nếu reversed, flip bearing 180°
      if (pre.reversed) {
        sample.bearing = (sample.bearing + 180) % 360;
      }

      return {
        timetableId: pre.id,
        trainNumber: pre.trainNumber,
        railwayId: pre.railwayId,
        trainType: pre.trainType,
        direction: pre.direction,
        standing: false,
        sample,
        distance,
        segmentIndex: i,
      };
    }
  }

  return null;
}

// ============================================================================
// Scheduler — quản lý toàn bộ timetables, query active trains theo time
// ============================================================================

export class TrainScheduler {
  private precomputed: PrecomputedTimetable[] = [];
  private pathMap: Map<string, RailwayPath>;

  constructor(pathMap: Map<string, RailwayPath>) {
    this.pathMap = pathMap;
  }

  addTimetables(
    timetables: TrainTimetable[],
    stationMap: Map<string, Station>,
  ): void {
    const cal = getCalendarType(); // "Weekday" | "SaturdayHoliday"
    let added = 0,
      byCal = 0,
      byData = 0;

    for (const tt of timetables) {
      // Mini Tokyo ID dạng: "Tokyu.Meguro.123.Weekday" hoặc "...SaturdayHoliday"
      if (!tt.id.endsWith(`.${cal}`) && !tt.id.includes(`.${cal}.`)) {
        byCal++;
        continue;
      }
      const pre = precomputeTimetable(tt, this.pathMap, stationMap);
      if (pre) {
        this.precomputed.push(pre);
        added++;
      } else byData++;
    }
    console.log("[scheduler]", {
      added,
      byCal,
      byData,
      total: timetables.length,
    });
  }

  /** Query toàn bộ active trains tại 1 thời điểm */
  getActiveTrains(nowSec: number): ActiveTrainState[] {
    const result: ActiveTrainState[] = [];
    for (const pre of this.precomputed) {
      // Thử cả nowSec và nowSec + 86400 (cho timetable chạy qua midnight)
      let qt = nowSec;
      if (qt < pre.startSec || qt > pre.endSec) qt = nowSec + 86400;
      if (qt < pre.startSec || qt > pre.endSec) continue;

      const path = this.pathMap.get(pre.railwayId);
      if (!path) continue;
      const state = getTrainStateAt(pre, path, qt);
      if (state) result.push(state);
    }
    return result;
  }

  get size(): number {
    return this.precomputed.length;
  }
}

// ============================================================================
// Time helpers
// ============================================================================

/** Lấy seconds-since-midnight cho thời điểm hiện tại (giờ Tokyo) */
export function getNowSecondsTokyo(): number {
  // Tokyo = UTC+9
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const tokyoMs = utcMs + 9 * 3600 * 1000;
  const tokyo = new Date(tokyoMs);
  return (
    tokyo.getUTCHours() * 3600 +
    tokyo.getUTCMinutes() * 60 +
    tokyo.getUTCSeconds() +
    tokyo.getUTCMilliseconds() / 1000
  );
}

/**
 * Detect calendar type (Weekday | SaturdayHoliday) cho timetable filter.
 * Theo convention của Mini Tokyo / ODPT.
 */
export function getCalendarType(): "Weekday" | "SaturdayHoliday" {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const tokyoMs = utcMs + 9 * 3600 * 1000;
  const tokyo = new Date(tokyoMs);
  const dow = tokyo.getUTCDay();
  return dow === 0 || dow === 6 ? "SaturdayHoliday" : "Weekday";
}
