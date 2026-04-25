export interface OperatorParams {
  id: string;
  title: Record<string, string>;
  color: string;
  tailcolor: string;
}

export default class Operator {
  /** Operator ID. */
  id: string;

  /** Operator title. */
  title: Record<string, string>;

  /** Aircraft body color. */
  color: string;

  /** Aircraft tail wing color. */
  tailcolor: string;

  constructor(params: OperatorParams) {
    this.id = params.id;
    this.title = params.title;
    this.color = params.color;
    this.tailcolor = params.tailcolor;
  }
}
