export interface GtfsTripParams {
  id: string;
  route: string;
  shape: string;
  departureTimes: number[];
  stops: string[];
  stopSequences: number[];
  headsigns: string[];
}

export default class GtfsTrip {
  /** Trip ID. */
  id: string;

  /** Route ID. */
  route: string;

  /** Shape ID. */
  shape: string;

  /** Departure time offset at each stop. */
  departureTimes: number[];

  /** Stops. */
  stops: string[];

  /** Stop sequences. */
  stopSequences: number[];

  /** Headsigns. */
  headsigns: string[];

  constructor(params: GtfsTripParams) {
    this.id = params.id;
    this.route = params.route;
    this.shape = params.shape;
    this.departureTimes = params.departureTimes;
    this.stops = params.stops;
    this.stopSequences = params.stopSequences;
    this.headsigns = params.headsigns;
  }
}
