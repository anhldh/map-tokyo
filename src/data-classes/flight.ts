import Airport from "./airport";
import FlightStatus from "./flightStatus";
import Operator from "./operator";
import { type Registry } from "./types";
import { getTimeOffset } from "../helpers/helpers";

export interface FlightRawParams {
  id: string;
  /** Flight numbers. */
  n: string[];
  /** Airline operator ID. */
  a: string;
  /** Flight status ID. */
  s?: string;
  /** Departure airport ID. */
  dp?: string;
  /** Destination airport ID. */
  ds?: string;
  /** Actual departure time string (hh:mm). */
  adt?: string;
  /** Estimated departure time string (hh:mm). */
  edt?: string;
  /** Scheduled departure time string (hh:mm). */
  sdt?: string;
  /** Arrival airport ID. */
  ar?: string;
  /** Origin airport ID. */
  or?: string;
  /** Actual arrival time string (hh:mm). */
  aat?: string;
  /** Estimated arrival time string (hh:mm). */
  eat?: string;
  /** Scheduled arrival time string (hh:mm). */
  sat?: string;
}

export interface FlightRefs {
  operators: Registry<Operator>;
  flightStatuses: Registry<FlightStatus>;
  airports: Registry<Airport>;
}

export default class Flight {
  /*
    Other properties:

    runway;
    feature;
    base;
    entry;
    start;
    end;
    maxSpeed;
    acceleration;
    instanceID;
    coord;
    altitude;
    bearing;
    _t;
    standing;
    animationID;
  */

  /** Object type. */
  readonly type = "flight" as const;

  /** Flight ID. */
  id: string;

  /** Flight numbers. */
  n: string[];

  /** Airline. */
  a: Operator;

  /** Flight status. */
  s?: FlightStatus;

  /** Departure airport. */
  dp?: Airport;

  /** Destination airport. */
  ds?: Airport;

  /** Actual departure time offset. */
  adt?: number;

  /** Estimated departure time offset. */
  edt?: number;

  /** Scheduled departure time offset. */
  sdt?: number;

  /** Arrival airport. */
  ar?: Airport;

  /** Origin airport. */
  or?: Airport;

  /** Actual arrival time offset. */
  aat?: number;

  /** Estimated arrival time offset. */
  eat?: number;

  /** Scheduled arrival time offset. */
  sat?: number;

  constructor(params: FlightRawParams, refs: FlightRefs) {
    const { s, dp, ds, adt, edt, sdt, ar, or: orId, aat, eat, sat } = params;

    this.id = params.id;
    this.n = params.n;
    this.a = refs.operators.get(params.a);

    if (s) {
      this.s = refs.flightStatuses.get(s);
    }

    if (dp) {
      this.dp = refs.airports.get(dp);
    }

    if (ds) {
      this.ds = refs.airports.get(ds);
    }

    if (adt) {
      this.adt = getTimeOffset(adt);
    }

    if (edt) {
      this.edt = getTimeOffset(edt);
    }

    if (sdt) {
      this.sdt = getTimeOffset(sdt);
    }

    if (ar) {
      this.ar = refs.airports.get(ar);
    }

    if (orId) {
      this.or = refs.airports.get(orId);
    }

    if (aat) {
      this.aat = getTimeOffset(aat);
    }

    if (eat) {
      this.eat = getTimeOffset(eat);
    }

    if (sat) {
      this.sat = getTimeOffset(sat);
    }
  }

  update(params: Partial<FlightRawParams>, refs: FlightRefs): void {
    const { s, adt, edt, sdt, aat, eat, sat } = params;

    if (s) {
      this.s = refs.flightStatuses.get(s);
    }
    if (adt) {
      this.adt = getTimeOffset(adt);
    }
    if (edt) {
      this.edt = getTimeOffset(edt);
    }
    if (sdt) {
      this.sdt = getTimeOffset(sdt);
    }
    if (aat) {
      this.aat = getTimeOffset(aat);
    }
    if (eat) {
      this.eat = getTimeOffset(eat);
    }
    if (sat) {
      this.sat = getTimeOffset(sat);
    }
  }
}
