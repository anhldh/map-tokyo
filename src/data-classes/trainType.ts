export interface TrainTypeParams {
  id: string;
  title: Record<string, string>;
}

export default class TrainType {
  /** Train type ID. */
  id: string;

  /** Multilingual train type title. */
  title: Record<string, string>;

  constructor(params: TrainTypeParams) {
    this.id = params.id;
    this.title = params.title;
  }
}
