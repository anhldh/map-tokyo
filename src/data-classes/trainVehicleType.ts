export interface TrainVehicleTypeParams {
  id: string;
  /** Vehicle color. If it is an array, the elements indicate the side upper, side middle, side lower, and front/back in order. */
  color: string | string[];
}

export default class TrainVehicleType {
  /** Train vehicle ID. */
  id: string;

  /**
   * Train vehicle color. If it is an array, the elements indicate the side upper,
   * side middle, side lower, and front/back in order.
   */
  color: string | string[];

  constructor(params: TrainVehicleTypeParams) {
    this.id = params.id;
    this.color = params.color;
  }
}
