export interface AirportParams {
  id: string;
  title: Record<string, string>;
  direction: 'N' | 'S';
}

export default class Airport {
  /** Airport ID. */
  id: string;

  /** Multilingual airport title. */
  title: Record<string, string>;

  /** Airport direction from Tokyo. 'N' for north or 'S' for south. */
  direction: 'N' | 'S';

  constructor(params: AirportParams) {
    this.id = params.id;
    this.title = params.title;
    this.direction = params.direction;
  }
}
