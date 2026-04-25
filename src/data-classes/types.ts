import { getTimeOffset } from "../helpers/helpers";
import Airport from "./airport";
import GtfsStop from "./gtfsStop";
import GtfsTrip from "./gtfsTrip";
import Railway from "./railway";
import RailDirection from "./railDirection";
import Station from "./station";
import TrainType from "./trainType";
import TrainVehicleType from "./trainVehicleType";

/** A generic typed registry / lookup map. */
export interface Registry<T> {
  get(id: string): T;
}

/** A registry that can also lazily add entries. */
export interface AddableRegistry<T> extends Registry<T> {
  getOrAdd(id: string): T;
}

/** Refs bundle shared across data-class constructors that need related objects. */
export interface RailwayRefs {
  railways: Registry<Railway>;
  railDirections: Registry<RailDirection>;
  stations: AddableRegistry<Station>;
}

export interface TrainTimetableRefs extends RailwayRefs {
  trainTypes: Registry<TrainType>;
  trainVehicleTypes: Registry<TrainVehicleType>;
  timetables?: Registry<import("./trainTimetable").default>;
}

export type TrainRefs = TrainTimetableRefs;

export interface StationRefs {
  railways: Registry<Railway>;
  railDirections: Registry<RailDirection>;
  pois: Registry<import("./poi").default>;
  stations: AddableRegistry<Station>;
}

export interface FlightRefs {
  operators: Registry<import("./operator").default>;
  flightStatuses: Registry<import("./flightStatus").default>;
  airports: Registry<Airport>;
}

export interface GtfsTripRefs {
  stops: Registry<GtfsStop>;
  trips: Registry<GtfsTrip>;
}

export interface BusRefs {
  trips: Registry<GtfsTrip>;
}

export { getTimeOffset };
