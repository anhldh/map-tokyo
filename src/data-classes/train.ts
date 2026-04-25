import { valueOrDefault } from "../helpers/helpers";
import TrainTimetable from "./trainTimetable";
import Railway from "./railway";
import RailDirection from "./railDirection";
import Station from "./station";
import TrainType from "./trainType";
import TrainVehicleType from "./trainVehicleType";
import { type Registry } from "./types";

export interface TrainRawParams {
  id: string;
  /** Railway ID (when not from timetable). */
  r?: string;
  /** Train number. */
  n?: string;
  /** TrainType ID (when not from timetable). */
  y?: string;
  /** RailDirection ID (when not from timetable). */
  d?: string;
  /** Origin station IDs (when not from timetable). */
  os?: string[];
  /** Destination station IDs (when not from timetable). */
  ds?: string[];
  /** To-station ID. */
  ts?: string;
  /** From-station ID. */
  fs?: string;
  /** Train names. */
  nm?: Record<string, string>[];
  /** TrainVehicleType ID (when not from timetable). */
  v?: string;
  /** Train ad object. */
  ad?: Record<string, unknown>;
  /** Delay in milliseconds. */
  delay?: number;
  /** Car composition override. */
  carComposition?: number;
}

export interface TrainRefs {
  railways: Registry<Railway>;
  railDirections: Registry<RailDirection>;
  stations: Registry<Station>;
  trainTypes: Registry<TrainType>;
  trainVehicleTypes: Registry<TrainVehicleType>;
}

export default class Train {
  /*
    Other properties:

    timetableIndex;
    sectionIndex;
    sectionLength;
    departureStation;
    departureTime;
    arrivalStation;
    arrivalTime;
    nextDepartureTime;
    instanceID;
    colorGroupIndex;
    coord;
    altitude;
    bearing;
    _t;
    standing;
    animationID;
    popup;
    popupVisible;
  */

  /** Object type. */
  readonly type = "train" as const;

  /** Train ID. */
  id: string;

  /** Railway. */
  r: Railway;

  /** Train number. */
  n?: string;

  /** Train type. */
  y?: TrainType;

  /** Rail direction. */
  d?: RailDirection;

  /** Origin stations. */
  os?: Station[];

  /** Destination stations. */
  ds?: Station[];

  /** To station. */
  ts?: Station;

  /** From station. */
  fs?: Station;

  /** Train timetable (only if constructed from a timetable). */
  timetable?: TrainTimetable;

  /** Train names. */
  nm?: Record<string, string>[];

  /** Train vehicle type. */
  v?: TrainVehicleType;

  /** Train ad. */
  ad?: Record<string, unknown>;

  /** Direction: 1 for ascending, -1 for descending. */
  direction: 1 | -1;

  /** Altitude from the railway. */
  altitude?: number;

  /** Delay in milliseconds. */
  delay?: number;

  /** Car composition. */
  carComposition: number;

  constructor(params: TrainTimetable | TrainRawParams, refs: TrainRefs) {
    const fromTimetable = params instanceof TrainTimetable;

    if (fromTimetable) {
      const p = params as TrainTimetable;
      const { r, y, d, os, ds, nm, v, ad } = p as TrainTimetable & {
        ad?: Record<string, unknown>;
      };

      this.id = p.t;
      this.r = r;
      this.n = p.n;
      this.y = y;
      this.d = d;
      if (os) this.os = os;
      if (ds) this.ds = ds;
      this.timetable = p;
      if (nm) this.nm = nm;
      if (v) this.v = v;
      if (ad) this.ad = ad;
    } else {
      const p = params as TrainRawParams;
      const { r, y, d, os, ds, ts, fs, nm, v, ad, delay, carComposition } = p;

      this.id = p.id;
      this.r = refs.railways.get(r!);
      this.n = p.n;
      this.y = y ? refs.trainTypes.get(y) : undefined;
      this.d = d ? refs.railDirections.get(d) : undefined;
      if (os) this.os = os.map((id) => refs.stations.get(id));
      if (ds) this.ds = ds.map((id) => refs.stations.get(id));
      if (ts) this.ts = refs.stations.get(ts);
      if (fs) this.fs = refs.stations.get(fs);
      if (nm) this.nm = nm;
      if (v) this.v = refs.trainVehicleTypes.get(v);
      if (ad) this.ad = ad;
      if (delay !== undefined && !isNaN(delay)) this.delay = delay;

      const railway = this.r;
      this.carComposition =
        carComposition !== undefined && !isNaN(carComposition)
          ? carComposition
          : railway.carComposition;
    }

    const railway = this.r;
    this.direction = this.d === railway.ascending ? 1 : -1;
    this.altitude = railway.altitude;

    // carComposition for timetable case
    if (fromTimetable) {
      this.carComposition = railway.carComposition;
    }
  }

  update(params: TrainRawParams, refs: TrainRefs): void {
    const { os: _os, ds: _ds } = this,
      { y, os, ds, ts, fs, v, ad, delay, carComposition } = params,
      stations = refs.stations;

    if (y) {
      this.y = refs.trainTypes.get(y);
    }
    if (os) {
      const timetable = this.timetable;

      this.os = os.map((id) => stations.get(id));

      if (_os && os[0] !== _os[0].id && timetable) {
        const s = timetable.stations;

        for (let i = 0, ilen = s.length; i < ilen; i++) {
          if (s[i].id === os[0]) {
            this.timetable = timetable.clone();
            this.timetable.stations.splice(0, i);
            this.timetable.arrivalTimes.splice(0, i + 1, undefined);
            this.timetable.departureTimes.splice(0, i);
            break;
          }
        }
      }
    }
    if (ds) {
      const timetable = this.timetable;

      this.ds = ds.map((id) => stations.get(id));

      if (_ds && ds[0] !== _ds[0].id && timetable) {
        const s = timetable.stations;

        for (let i = 0, ilen = s.length; i < ilen; i++) {
          if (s[i].id === ds[0]) {
            this.timetable = timetable.clone();
            this.timetable.stations.splice(i + 1);
            this.timetable.arrivalTimes.splice(
              i,
              Infinity,
              valueOrDefault(
                this.timetable.arrivalTimes[i],
                this.timetable.departureTimes[i],
              ),
            );
            this.timetable.departureTimes.splice(i, Infinity, undefined);
            break;
          }
        }
      }
    }
    if (ts) {
      this.ts = stations.get(ts);
    }
    if (fs) {
      this.fs = stations.get(fs);
    }
    if (v) {
      this.v = refs.trainVehicleTypes.get(v);
    }
    if (ad) {
      this.ad = ad;
    }
    if (delay !== undefined && !isNaN(delay)) {
      this.delay = delay;
    }
    if (carComposition !== undefined && !isNaN(carComposition)) {
      this.carComposition = carComposition;
    }
  }
}
