/** Minimal interface for the `pbf` library's Pbf reader/writer. */
export interface Pbf {
  // Writer methods
  writeStringField(tag: number, value: string): void;
  writeMessage<T>(tag: number, fn: (obj: T, pbf: Pbf) => void, obj: T): void;
  writePackedDouble(tag: number, values: number[]): void;
  writePackedVarint(tag: number, values: number[]): void;
  finish(): Uint8Array;

  // Reader methods
  readFields<T>(
    fn: (tag: number, obj: T, pbf: Pbf) => void,
    init: T,
    end?: number,
  ): T;
  readString(): string;
  readPackedDouble(arr?: number[]): number[];
  readPackedVarint(arr?: number[], isSigned?: boolean): number[];
  readVarint(isSigned?: boolean): number;
  pos: number;
}

export interface GtfsStop {
  id: string;
  name: string;
  coord: number[];
}

export interface GtfsRoute {
  id: string;
  shortName?: string;
  longName?: string;
  color?: string;
  textColor?: string;
  shapes: string[];
}

export interface GtfsTrip {
  id: string;
  route: string;
  shape: string;
  departureTimes: number[];
  stops: string[];
  stopSequences: number[];
  headsigns: string[];
}

export interface GtfsData {
  agency: string;
  stops: GtfsStop[];
  routes: GtfsRoute[];
  trips: GtfsTrip[];
  version: string;
}

export function encode(data: GtfsData, pbf: Pbf): Uint8Array {
  pbf.writeStringField(1, data.agency);
  for (const stop of data.stops) {
    pbf.writeMessage(
      2,
      (obj: GtfsStop, pbf: Pbf) => {
        pbf.writeStringField(1, obj.id);
        pbf.writeStringField(2, obj.name);
        pbf.writePackedDouble(3, obj.coord);
      },
      stop,
    );
  }
  for (const route of data.routes) {
    pbf.writeMessage(
      3,
      (obj: GtfsRoute, pbf: Pbf) => {
        pbf.writeStringField(1, obj.id);
        if (obj.shortName) pbf.writeStringField(2, obj.shortName);
        if (obj.longName) pbf.writeStringField(3, obj.longName);
        if (obj.color) pbf.writeStringField(4, obj.color);
        if (obj.textColor) pbf.writeStringField(5, obj.textColor);
        for (const shape of obj.shapes) {
          pbf.writeStringField(6, shape);
        }
      },
      route,
    );
  }
  for (const trip of data.trips) {
    pbf.writeMessage(
      4,
      (obj: GtfsTrip, pbf: Pbf) => {
        pbf.writeStringField(1, obj.id);
        pbf.writeStringField(2, obj.route);
        pbf.writeStringField(3, obj.shape);
        pbf.writePackedVarint(4, obj.departureTimes);
        for (const stop of obj.stops) {
          pbf.writeStringField(5, stop);
        }
        pbf.writePackedVarint(6, obj.stopSequences);
        for (const headsign of obj.headsigns) {
          pbf.writeStringField(7, headsign);
        }
      },
      trip,
    );
  }
  pbf.writeStringField(5, data.version);
  return pbf.finish();
}

export function decode(pbf: Pbf): GtfsData {
  return pbf.readFields(
    (tag: number, obj: GtfsData, pbf: Pbf) => {
      if (tag === 1) obj.agency = pbf.readString();
      if (tag === 2)
        obj.stops.push(
          pbf.readFields(
            (tag: number, obj: GtfsStop, pbf: Pbf) => {
              if (tag === 1) obj.id = pbf.readString();
              else if (tag === 2) obj.name = pbf.readString();
              else if (tag === 3) obj.coord = pbf.readPackedDouble();
            },
            {} as GtfsStop,
            pbf.readVarint() + pbf.pos,
          ),
        );
      if (tag === 3)
        obj.routes.push(
          pbf.readFields(
            (tag: number, obj: GtfsRoute, pbf: Pbf) => {
              if (tag === 1) obj.id = pbf.readString();
              else if (tag === 2) obj.shortName = pbf.readString();
              else if (tag === 3) obj.longName = pbf.readString();
              else if (tag === 4) obj.color = pbf.readString();
              else if (tag === 5) obj.textColor = pbf.readString();
              else if (tag === 6) obj.shapes.push(pbf.readString());
            },
            { shapes: [] } as unknown as GtfsRoute,
            pbf.readVarint() + pbf.pos,
          ),
        );
      if (tag === 4)
        obj.trips.push(
          pbf.readFields(
            (tag: number, obj: GtfsTrip, pbf: Pbf) => {
              if (tag === 1) obj.id = pbf.readString();
              else if (tag === 2) obj.route = pbf.readString();
              else if (tag === 3) obj.shape = pbf.readString();
              else if (tag === 4)
                pbf.readPackedVarint(obj.departureTimes, true);
              else if (tag === 5) obj.stops.push(pbf.readString());
              else if (tag === 6)
                pbf.readPackedVarint(obj.stopSequences, true);
              else if (tag === 7) obj.headsigns.push(pbf.readString());
            },
            {
              departureTimes: [],
              stops: [],
              stopSequences: [],
              headsigns: [],
            } as unknown as GtfsTrip,
            pbf.readVarint() + pbf.pos,
          ),
        );
      if (tag === 5) obj.version = pbf.readString();
    },
    { stops: [], routes: [], trips: [] } as unknown as GtfsData,
  );
}
