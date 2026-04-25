export interface RailDirectionParams {
  id: string;
  title: Record<string, string>;
}

export default class RailDirection {
  /** Rail direction ID. */
  id: string;

  /** Multilingual Rail direction title. */
  title: Record<string, string>;

  constructor(params: RailDirectionParams) {
    this.id = params.id;
    this.title = params.title;
  }
}
