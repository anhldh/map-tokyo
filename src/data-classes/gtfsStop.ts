export interface GtfsStopParams {
  id: string;
  name: string;
  /** Stop coordinates. These coordinates use longitude, latitude coordinate order. */
  coord: [number, number];
}

export default class GtfsStop {
  /** Stop ID. */
  id: string;

  /** Stop name. */
  name: string;

  /** Stop coordinates. These coordinates use longitude, latitude coordinate order. */
  coord: [number, number];

  constructor(params: GtfsStopParams) {
    this.id = params.id;
    this.name = params.name;
    this.coord = params.coord;
  }
}
