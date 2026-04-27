// src/data/gtfsStops.ts
import type { FeatureCollection, Feature, Point } from "geojson";
import type { GtfsStaticData, GtfsSourceConfig } from "./gtfsStatic";

export interface StopFeatureProps {
  stopId: string;
  agencyId: string;
  name: string;
  color: string;
}

export function stopsToGeoJSON(
  data: GtfsStaticData,
  source: GtfsSourceConfig,
): FeatureCollection<Point, StopFeatureProps> {
  const features: Feature<Point, StopFeatureProps>[] = [];
  for (const stop of data.stops.values()) {
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: stop.coord },
      properties: {
        stopId: stop.id,
        agencyId: source.agencyId,
        name: stop.name,
        color: source.color,
      },
    });
  }
  return { type: "FeatureCollection", features };
}

export function mergeStopCollections(
  collections: FeatureCollection<Point, StopFeatureProps>[],
): FeatureCollection<Point, StopFeatureProps> {
  return {
    type: "FeatureCollection",
    features: collections.flatMap((c) => c.features),
  };
}
