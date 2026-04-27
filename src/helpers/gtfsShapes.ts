// src/data/gtfsShapes.ts
import type { FeatureCollection, Feature, LineString } from "geojson";
import type { GtfsStaticData, GtfsSourceConfig } from "./gtfsStatic";

export interface ShapeFeatureProps {
  shapeId: string;
  agencyId: string;
  color: string;
  /** Optional: route IDs liên quan đến shape này (qua trips lookup) */
  routeIds?: string[];
}

/**
 * Convert tất cả shapes của 1 GTFS source thành FeatureCollection.
 * Mỗi shape = 1 LineString feature.
 */
export function shapesToGeoJSON(
  data: GtfsStaticData,
  source: GtfsSourceConfig,
): FeatureCollection<LineString, ShapeFeatureProps> {
  // Build shape → routes mapping qua trips
  // (1 shape có thể được nhiều tuyến dùng chung)
  const shapeToRoutes = new Map<string, Set<string>>();
  for (const trip of data.trips.values()) {
    if (!trip.shapeId) continue;
    let set = shapeToRoutes.get(trip.shapeId);
    if (!set) {
      set = new Set();
      shapeToRoutes.set(trip.shapeId, set);
    }
    set.add(trip.routeId);
  }

  const features: Feature<LineString, ShapeFeatureProps>[] = [];
  for (const shape of data.shapes.values()) {
    if (shape.coords.length < 2) continue;
    features.push({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: shape.coords,
      },
      properties: {
        shapeId: shape.id,
        agencyId: source.agencyId,
        color: source.color,
        routeIds: Array.from(shapeToRoutes.get(shape.id) ?? []),
      },
    });
  }

  return { type: "FeatureCollection", features };
}

/** Merge nhiều agency thành 1 FeatureCollection cho 1 source duy nhất */
export function mergeShapeCollections(
  collections: FeatureCollection<LineString, ShapeFeatureProps>[],
): FeatureCollection<LineString, ShapeFeatureProps> {
  return {
    type: "FeatureCollection",
    features: collections.flatMap((c) => c.features),
  };
}
