import { getTimeOffset } from '../helpers/helpers';

export type FacilityType = 'stairs' | 'escalator' | 'elevator' | 'ramp';

export interface UptimeEntry {
  open: string;
  close: string;
  calendar?: string;
}

export interface UptimeEntryParsed {
  open: number;
  close: number;
  calendar?: string;
}

export interface PoiParams {
  id: string;
  /** POI coordinate. These coordinates use longitude, latitude coordinate order. */
  coord: [number, number];
  title: Record<string, string>;
  description: Record<string, string>;
  uptime?: UptimeEntry[];
  facilities?: FacilityType[];
}

export default class Poi {
  /** POI ID. */
  id: string;

  /** POI coordinate. These coordinates use longitude, latitude coordinate order. */
  coord: [number, number];

  /** Multilingual POI title. */
  title: Record<string, string>;

  /** Multilingual POI description. */
  description: Record<string, string>;

  /** Hours and days when the facility is open. */
  uptime?: UptimeEntryParsed[];

  /**
   * Types of the facility.
   * 'stairs', 'escalator', 'elevator' and 'ramp' are supported.
   */
  facilities?: FacilityType[];

  constructor(params: PoiParams) {
    const { uptime, facilities } = params;

    this.id = params.id;
    this.coord = params.coord;
    this.title = params.title;
    this.description = params.description;

    if (uptime) {
      this.uptime = uptime.map(({ open, close, calendar }) => {
        const item: UptimeEntryParsed = {
          open: getTimeOffset(open),
          close: getTimeOffset(close),
        };

        if (calendar) {
          item.calendar = calendar;
        }
        return item;
      });
    }

    if (facilities) {
      this.facilities = facilities;
    }
  }
}
