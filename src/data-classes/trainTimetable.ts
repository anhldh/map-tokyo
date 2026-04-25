import configs from "../utils/config";
import { getTimeOffset } from "../helpers/helpers";
import Railway from "./railway";
import RailDirection from "./railDirection";
import Station from "./station";
import TrainType from "./trainType";
import TrainVehicleType from "./trainVehicleType";
import { type Registry } from "./types";

export interface TimetableStop {
  /** Station ID. */
  s: string;
  /** Arrival time string (hh:mm). */
  a?: string;
  /** Departure time string (hh:mm). */
  d?: string;
}

export interface TrainTimetableParams {
  id: string;
  /** Train ID. */
  t: string;
  /** Railway ID. */
  r: string;
  /** Train number. */
  n: string;
  /** TrainType ID. */
  y: string;
  /** RailDirection ID. */
  d: string;
  /** Origin station IDs. */
  os?: string[];
  /** Destination station IDs. */
  ds?: string[];
  /** Timetable stops. */
  tt: TimetableStop[];
  /** Train names. */
  nm?: Record<string, string>[];
  /** TrainVehicleType ID. */
  v?: string;
  /** Previous timetable IDs. */
  pt?: string[];
  /** Next timetable IDs. */
  nt?: string[];
}

export interface TrainTimetableRefs {
  railways: Registry<Railway>;
  railDirections: Registry<RailDirection>;
  stations: Registry<Station>;
  trainTypes: Registry<TrainType>;
  trainVehicleTypes: Registry<TrainVehicleType>;
  /** Available only during update phase. */
  timetables?: Registry<TrainTimetable>;
}

export default class TrainTimetable {
  /** Train timetable ID. */
  id!: string;

  /** Train ID. */
  t!: string;

  /** Railway. */
  r!: Railway;

  /** Train number. */
  n!: string;

  /** Train type. */
  y!: TrainType;

  /** Rail direction. */
  d!: RailDirection;

  /** Origin stations. */
  os?: Station[];

  /** Destination stations. */
  ds?: Station[];

  /** Stations where the train stops. */
  stations!: Station[];

  /** Arrival time offset at each stop. */
  arrivalTimes!: (number | undefined)[];

  /** Departure time offset at each stop. */
  departureTimes!: (number | undefined)[];

  /** Train names. */
  nm?: Record<string, string>[];

  /** Train vehicle type. */
  v?: TrainVehicleType;

  /** Previous train timetables. */
  pt?: TrainTimetable[];

  /** Next train timetables. */
  nt?: TrainTimetable[];

  /** Start timestamp offset. */
  start!: number;

  /** End timestamp offset. */
  end!: number;

  constructor(params?: TrainTimetableParams, refs?: TrainTimetableRefs) {
    if (!params || !refs) {
      return;
    }

    const { os, ds, tt, nm, v } = params,
      stations = refs.stations;

    this.id = params.id;
    this.t = params.t;
    this.r = refs.railways.get(params.r);
    this.n = params.n;
    this.y = refs.trainTypes.get(params.y);
    this.d = refs.railDirections.get(params.d);

    if (os) {
      this.os = os.map((id) => stations.get(id));
    }

    if (ds) {
      this.ds = ds.map((id) => stations.get(id));
    }

    this.stations = tt.map(({ s }) => stations.get(s));
    this.arrivalTimes = tt.map(({ a }) => (a ? getTimeOffset(a) : undefined));
    this.departureTimes = tt.map(({ d }) => (d ? getTimeOffset(d) : undefined));

    if (nm) {
      this.nm = nm;
    }

    if (v) {
      this.v = refs.trainVehicleTypes.get(v);
    }

    const timeOffsets = (this.arrivalTimes as (number | undefined)[])
      .concat(this.departureTimes)
      .filter((t): t is number => t !== undefined && !isNaN(t));

    this.start = Math.min(...timeOffsets) - configs.standingDuration;
    this.end = Math.max(...timeOffsets);
  }

  update(params: TrainTimetableParams, refs: TrainTimetableRefs): void {
    const { pt, nt } = params,
      timetables = refs.timetables!,
      standingDuration = configs.standingDuration;

    if (pt) {
      for (const id of pt) {
        const prevTimetable = timetables.get(id);

        if (prevTimetable) {
          const lastIndex = this.stations.length - 1,
            arrivalTime = this.arrivalTimes[lastIndex],
            departureTime = this.departureTimes[lastIndex];

          /** Previous train timetables. */
          this.pt = this.pt || [];
          this.pt.push(prevTimetable);

          if (arrivalTime !== undefined) {
            this.start = Math.min(this.start, arrivalTime - standingDuration);
          } else if (departureTime !== undefined) {
            this.start = Math.min(this.start, departureTime - standingDuration);
          }
        }
      }
    }

    if (nt) {
      for (const id of nt) {
        const nextTimetable = timetables.get(id);

        if (nextTimetable) {
          /** Next train timetables. */
          this.nt = this.nt || [];
          this.nt.push(nextTimetable);
        }
      }
      if (this.nt) {
        this.departureTimes[this.stations.length - 1] =
          this.nt[0].departureTimes[0];
      }
    }
  }

  clone(): TrainTimetable {
    const timetable = new TrainTimetable();

    timetable.id = this.id;
    timetable.t = this.t;
    timetable.r = this.r;
    timetable.n = this.n;
    timetable.y = this.y;
    timetable.d = this.d;
    timetable.os = this.os;
    timetable.ds = this.ds;
    timetable.pt = this.pt;
    timetable.nt = this.nt;
    timetable.stations = this.stations.slice();
    timetable.arrivalTimes = this.arrivalTimes.slice();
    timetable.departureTimes = this.departureTimes.slice();
    timetable.nm = this.nm;
    timetable.v = this.v;
    timetable.start = this.start;
    timetable.end = this.end;
    return timetable;
  }

  getConnectingTrainIds(): string[] {
    const { nt, t } = this;

    return nt
      ? [t].concat(...nt.map((timetable) => timetable.getConnectingTrainIds()))
      : [t];
  }
}
