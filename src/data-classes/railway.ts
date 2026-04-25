import RailDirection from "./railDirection";
import Station from "./station";
import { type AddableRegistry, type Registry } from "./types";

export interface RailwayParams {
  id: string;
  title: Record<string, string>;
  stations: string[];
  ascending: string;
  descending: string;
  altitude?: number;
  color: string;
  carComposition: number;
  dynamic?: boolean;
}

export interface RailwayRefs {
  railDirections: Registry<RailDirection>;
  stations: AddableRegistry<Station>;
}

export default class Railway {
  /*
    Other properties:

    status;
    text;
    suspended;
  */

  /** Railway ID. */
  id: string;

  /** Multilingual railway title. */
  title: Record<string, string>;

  /** Railway stations. */
  stations: Station[];

  /** Ascending rail direction. */
  ascending: RailDirection;

  /** Descending rail direction. */
  descending: RailDirection;

  /** Railway altitude. */
  altitude?: number;

  /** Railway color. */
  color: string;

  /** Railway car composition. */
  carComposition: number;

  /** If true, trains appear and disappear dynamically based on train information. */
  dynamic?: boolean;

  constructor(params: RailwayParams, refs: RailwayRefs) {
    const { dynamic, altitude } = params;

    this.id = params.id;
    this.title = params.title;
    this.stations = params.stations.map((id) => refs.stations.getOrAdd(id));
    this.ascending = refs.railDirections.get(params.ascending);
    this.descending = refs.railDirections.get(params.descending);

    if (altitude) {
      this.altitude = altitude;
    }

    this.color = params.color;
    this.carComposition = params.carComposition;

    if (dynamic) {
      this.dynamic = dynamic;
    }
  }
}
