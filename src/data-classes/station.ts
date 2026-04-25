import Poi from "./poi";
import Railway from "./railway";
import RailDirection from "./railDirection";
import { type AddableRegistry, type Registry } from "./types";

export interface StationParams {
  id: string;
  railway?: string;
  /** Station coordinates. These coordinates use longitude, latitude coordinate order. */
  coord?: [number, number];
  title: Record<string, string>;
  utitle?: Record<string, string>;
  thumbnail?: string;
  exit?: string[];
  altitude?: number;
  alternate?: string;
  ascending?: string | null;
  descending?: string | null;
  group?: string;
}

export interface StationRefs {
  railways: Registry<Railway>;
  railDirections: Registry<RailDirection>;
  pois: Registry<Poi>;
  stations: AddableRegistry<Station>;
}

export default class Station {
  /** Station ID. */
  id!: string;

  /** The railway of the station. */
  railway?: Railway;

  /** Station coordinates. These coordinates use longitude, latitude coordinate order. */
  coord?: [number, number];

  /** Multilingual station title. */
  title!: Record<string, string>;

  /** Multilingual unique station title, which is used for station search. */
  utitle?: Record<string, string>;

  /** Thumbnail image URL of the station. */
  thumbnail?: string;

  /** POIs for station exits. */
  exit?: Poi[];

  /** Station altitude. */
  altitude?: number;

  /**
   * If exists, the station is hidden and this specifies the alternate station
   * used for popups and the departure board.
   */
  alternate?: Station;

  /**
   * If exists, this ascending rail direction is used in the departure board
   * instead of railway's default. If null, it doesn't appear in the departure board.
   */
  ascending?: RailDirection | null;

  /**
   * If exists, this descending rail direction is used in the departure board
   * instead of railway's default. If null, it doesn't appear in the departure board.
   */
  descending?: RailDirection | null;

  /** Station group ID. */
  group?: string;

  constructor(params?: StationParams, refs?: StationRefs) {
    if (params && refs) {
      this.update(params, refs);
    }
  }

  update(params: StationParams, refs: StationRefs): void {
    const {
      railway,
      coord,
      utitle,
      thumbnail,
      exit,
      altitude,
      alternate,
      ascending,
      descending,
      group,
    } = params;

    this.id = params.id;

    if (railway) {
      this.railway = refs.railways.get(railway);
    }

    if (coord) {
      this.coord = coord;
    }

    this.title = params.title;

    if (utitle) {
      this.utitle = utitle;
    }

    if (thumbnail) {
      this.thumbnail = thumbnail;
    }

    if (exit) {
      this.exit = exit.map((id) => refs.pois.get(id));
    }

    if (altitude) {
      this.altitude = altitude;
    }

    if (alternate) {
      this.alternate = refs.stations.getOrAdd(alternate);
    }

    if (ascending !== undefined) {
      this.ascending = ascending ? refs.railDirections.get(ascending) : null;
    }

    if (descending !== undefined) {
      this.descending = descending ? refs.railDirections.get(descending) : null;
    }

    if (group) {
      this.group = group;
    }
  }
}
