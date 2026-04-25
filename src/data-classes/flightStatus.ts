export interface FlightStatusParams {
  id: string;
  title: Record<string, string>;
}

export default class FlightStatus {
  /** Flight status ID. */
  id: string;

  /** Flight status title. */
  title: Record<string, string>;

  constructor(params: FlightStatusParams) {
    this.id = params.id;
    this.title = params.title;
  }
}
