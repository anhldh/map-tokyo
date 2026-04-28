// src/helpers/busPositions.ts
import type { BusTimetable, GtfsStaticData } from "./gtfsStatic";
import { sampleShapeAtDistance } from "./shapePath";

export interface ActiveBus {
  timetable: BusTimetable;
  agencyId: string;
  color: string;
  segmentIndex: number;
  segmentProgress: number;
  state: "standing" | "moving";
  position: [number, number];
  bearing: number;
  delay: number;
}

export type BusDelayLookup = (tripId: string) => number;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const SECONDS_PER_DAY = 86400;
const STANDING_DURATION = 10; // bus dừng ngắn hơn train

export function getActiveBuses(
  staticData: Map<string, GtfsStaticData>,
  currentSeconds: number,
  getDelay?: BusDelayLookup,
): ActiveBus[] {
  const active: ActiveBus[] = [];

  for (const [agencyId, data] of staticData) {
    for (const tt of data.busTimetables) {
      const delay = getDelay?.(tt.tripId) ?? 0;
      const scheduledNow = currentSeconds - delay;

      // Thử match cả "ngày này" và "ngày trước" cho service qua nửa đêm
      const result =
        tryActiveAt(tt, scheduledNow, agencyId, data, delay) ??
        tryActiveAt(tt, scheduledNow + SECONDS_PER_DAY, agencyId, data, delay);

      if (result) active.push(result);
    }
  }

  return active;
}

function tryActiveAt(
  tt: BusTimetable,
  currentSeconds: number,
  agencyId: string,
  data: GtfsStaticData,
  delay: number,
): ActiveBus | null {
  if (currentSeconds < tt.start || currentSeconds > tt.end) return null;

  const path = tt.shapeId ? data.shapePathIndex.paths.get(tt.shapeId) : null;

  for (let i = 0; i < tt.stops.length; i++) {
    const arr = tt.arrivals[i];
    const dep = tt.departures[i];
    const nextArr = tt.arrivals[i + 1];

    // === Standing tại stop i ===
    const standStart = arr >= 0 ? arr : dep >= 0 ? dep - STANDING_DURATION : -1;
    if (
      standStart >= 0 &&
      dep >= 0 &&
      currentSeconds >= standStart &&
      currentSeconds < dep
    ) {
      const stop = data.stops.get(tt.stops[i]);
      if (!stop) return null;

      let bearing = 0;
      if (path && tt.stopOffsets[i] >= 0) {
        const offA = tt.stopOffsets[i];
        const offBNext = tt.stopOffsets[i + 1];
        // Probe 5m về phía stop kế để lấy bearing đúng hướng
        const probe =
          offBNext !== undefined && offBNext >= 0
            ? offA + Math.sign(offBNext - offA) * 5
            : offA;
        const sample = sampleShapeAtDistance(path, probe);
        bearing = sample.bearing;
        if (offBNext !== undefined && offBNext >= 0 && offBNext < offA) {
          bearing = (bearing + 180) % 360;
        }
      }

      return {
        timetable: tt,
        agencyId,
        color: data.operatorColor,
        segmentIndex: i,
        segmentProgress: 0,
        state: "standing",
        position: stop.coord,
        bearing,
        delay,
      };
    }

    // === Moving i → i+1 ===
    if (
      dep >= 0 &&
      nextArr >= 0 &&
      currentSeconds >= dep &&
      currentSeconds < nextArr
    ) {
      const t = (currentSeconds - dep) / (nextArr - dep);

      if (path && tt.stopOffsets[i] >= 0 && tt.stopOffsets[i + 1] >= 0) {
        const offA = tt.stopOffsets[i];
        const offB = tt.stopOffsets[i + 1];
        const distance = lerp(offA, offB, t);
        const sample = sampleShapeAtDistance(path, distance);
        const bearing =
          offB < offA ? (sample.bearing + 180) % 360 : sample.bearing;

        return {
          timetable: tt,
          agencyId,
          color: data.operatorColor,
          segmentIndex: i,
          segmentProgress: t,
          state: "moving",
          position: sample.position,
          bearing,
          delay,
        };
      }

      // Fallback: lerp giữa 2 stop nếu không có shape
      const stopA = data.stops.get(tt.stops[i]);
      const stopB = data.stops.get(tt.stops[i + 1]);
      if (!stopA || !stopB) return null;
      return {
        timetable: tt,
        agencyId,
        color: data.operatorColor,
        segmentIndex: i,
        segmentProgress: t,
        state: "moving",
        position: [
          lerp(stopA.coord[0], stopB.coord[0], t),
          lerp(stopA.coord[1], stopB.coord[1], t),
        ],
        bearing: 0,
        delay,
      };
    }
  }

  return null;
}
