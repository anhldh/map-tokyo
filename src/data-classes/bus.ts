import GtfsTrip from "./gtfsTrip";
import { type Registry } from "./types";

/** GeoJSON-like feature object for the bus route. */
export type RouteFeature = {
  type: string;
  geometry?: Record<string, unknown>;
  properties?: Record<string, unknown> | null;
  [key: string]: unknown;
};

export interface BusParams {
  id: string;
  gtfsId: string;
  trip: string;
  feature: RouteFeature;
  offsets: number[];
  offset: number;
}

export interface BusRefs {
  trips: Registry<GtfsTrip>;
}

export default class Bus {
  /*
    Other properties:

    sectionIndex;
    sectionLength;
    stop;
    departureTime;
    nextDepartureTime;
    instanceID;
    coord;
    altitude;
    bearing;
    _t;
    standing;
    animationID;
  */

  /** Object type. */
  readonly type = "bus" as const;

  /** Bus ID. */
  id: string;

  /** GTFS ID. */
  gtfsId: string;

  /** GTFS trip. */
  trip: GtfsTrip;

  /** Route feature. */
  feature: RouteFeature;

  /** Stop offsets. */
  offsets: number[];

  /** Bus offset. */
  offset: number;

  constructor(params: BusParams, refs: BusRefs) {
    this.id = params.id;
    this.gtfsId = params.gtfsId;
    this.trip = refs.trips.get(params.trip);
    this.feature = params.feature;
    this.offsets = params.offsets;
    this.offset = params.offset;
  }
}
