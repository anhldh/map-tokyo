export interface GtfsRouteParams {
  id: string;
  shortName?: string;
  longName?: string;
  color?: string;
  textColor?: string;
  shapes: string[];
}

export default class GtfsRoute {
  /** Route ID. */
  id: string;

  /** Route short name. */
  shortName?: string;

  /** Route long name. */
  longName?: string;

  /** Route color. */
  color?: string;

  /** Route text color. */
  textColor?: string;

  /** Route shape IDs. */
  shapes: string[];

  constructor(params: GtfsRouteParams) {
    const { shortName, longName, color, textColor } = params;

    this.id = params.id;

    if (shortName) {
      this.shortName = shortName;
    }

    if (longName) {
      this.longName = longName;
    }

    if (color) {
      this.color = color;
    }

    if (textColor) {
      this.textColor = textColor;
    }

    this.shapes = params.shapes;
  }
}
