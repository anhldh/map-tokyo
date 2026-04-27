import type { Station } from "@/helpers/loadRailwayData";
import type { TrainTimetable } from "../helpers/timetable";
import { STANDING_DURATION } from "../helpers/timetable";

import { sampleAtDistance, type RailwayPathIndex } from "./railwayPath";

export interface ActiveTrain {
  timetable: TrainTimetable;
  segmentIndex: number;
  segmentProgress: number;
  state: "standing" | "moving";
  position: [number, number];
  bearing: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function getActiveTrains(
  timetables: TrainTimetable[],
  currentSeconds: number,
  stationsById: Map<string, Station>,
  pathIndex: RailwayPathIndex,
): ActiveTrain[] {
  const active: ActiveTrain[] = [];

  for (const tt of timetables) {
    if (currentSeconds < tt.start || currentSeconds > tt.end) continue;

    const path = pathIndex.paths.get(tt.railway);
    const offsets = pathIndex.stationOffsets.get(tt.railway);

    for (let i = 0; i < tt.stations.length; i++) {
      const arr = tt.arrivals[i];
      const dep = tt.departures[i];
      const nextArr = tt.arrivals[i + 1];

      // Standing tại station i
      const standStart =
        arr ?? (dep !== undefined ? dep - STANDING_DURATION : undefined);
      if (
        standStart !== undefined &&
        dep !== undefined &&
        currentSeconds >= standStart &&
        currentSeconds < dep
      ) {
        const stationId = tt.stations[i];
        const station = stationsById.get(stationId);
        if (!station) break;

        // Lấy bearing từ segment kế tiếp (nếu có) cho hộp tàu xoay đúng hướng
        let bearing = 0;
        if (path && offsets) {
          const offA = offsets.get(stationId)?.distance;
          const nextStationId = tt.stations[i + 1];
          const offB = nextStationId
            ? offsets.get(nextStationId)?.distance
            : undefined;
          if (offA !== undefined) {
            const probeOffset =
              offB !== undefined ? offA + Math.sign(offB - offA) * 5 : offA;
            const sample = sampleAtDistance(path, probeOffset);
            bearing = sample.bearing;
            // Nếu chiều ngược (descending), xoay 180
            if (offB !== undefined && offB < offA)
              bearing = (bearing + 180) % 360;
          }
        }

        active.push({
          timetable: tt,
          segmentIndex: i,
          segmentProgress: 0,
          state: "standing",
          position: station.coord,
          bearing,
        });
        break;
      }

      // Đang moving i -> i+1
      if (
        dep !== undefined &&
        nextArr !== undefined &&
        currentSeconds >= dep &&
        currentSeconds < nextArr
      ) {
        const t = (currentSeconds - dep) / (nextArr - dep);
        const stationAId = tt.stations[i];
        const stationBId = tt.stations[i + 1];

        // Snap lên path nếu có dữ liệu
        if (path && offsets) {
          const offA = offsets.get(stationAId)?.distance;
          const offB = offsets.get(stationBId)?.distance;

          if (offA !== undefined && offB !== undefined) {
            // if (Math.random() < 0.001) {
            //   console.log("[seg]", {
            //     railway: tt.railway,
            //     direction: tt.direction,
            //     from: stationAId.split(".").pop(),
            //     to: stationBId.split(".").pop(),
            //     offA: offA.toFixed(0),
            //     offB: offB.toFixed(0),
            //     delta: (offB - offA).toFixed(0),
            //   });
            // }
            const distance = lerp(offA, offB, t);
            const sample = sampleAtDistance(path, distance);
            // Nếu tàu đi chiều giảm offset (descending), bearing phải lật 180
            const bearing =
              offB < offA ? (sample.bearing + 180) % 360 : sample.bearing;

            active.push({
              timetable: tt,
              segmentIndex: i,
              segmentProgress: t,
              state: "moving",
              position: sample.position,
              bearing,
            });
            break;
          }
        }

        // Fallback: lerp thẳng nếu không có path
        const from = stationsById.get(stationAId);
        const to = stationsById.get(stationBId);
        if (!from || !to) break;
        active.push({
          timetable: tt,
          segmentIndex: i,
          segmentProgress: t,
          state: "moving",
          position: [
            lerp(from.coord[0], to.coord[0], t),
            lerp(from.coord[1], to.coord[1], t),
          ],
          bearing: 0,
        });
        break;
      }
    }
  }

  return active;
}
