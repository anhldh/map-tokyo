// src/data/gtfsLoader.ts
import {
  GTFS_SOURCES,
  loadGtfsStatic,
  type GtfsStaticData,
  type GtfsSourceConfig,
} from "./gtfsStatic";
import {
  shapesToGeoJSON,
  mergeShapeCollections,
  type ShapeFeatureProps,
} from "./gtfsShapes";
import type { FeatureCollection, LineString, Point } from "geojson";
import {
  mergeStopCollections,
  stopsToGeoJSON,
  type StopFeatureProps,
} from "./gtfsStops";

export interface GtfsLoadResult {
  /** Per-agency static data, để dùng sau (map vehicle → trip → route → color/shape) */
  staticData: Map<string, GtfsStaticData>;
  /** GeoJSON merged của tất cả shape, sẵn sàng add vào map */
  shapes: FeatureCollection<LineString, ShapeFeatureProps>;
  stops: FeatureCollection<Point, StopFeatureProps>;
}

export async function loadAllGtfsStatic(
  sources: GtfsSourceConfig[] = GTFS_SOURCES,
): Promise<GtfsLoadResult> {
  const staticData = new Map<string, GtfsStaticData>();
  const allShapes: FeatureCollection<LineString, ShapeFeatureProps>[] = [];
  const allStops: FeatureCollection<Point, StopFeatureProps>[] = [];

  await Promise.all(
    sources.map(async (source) => {
      try {
        const data = await loadGtfsStatic(source);
        staticData.set(source.agencyId, data);
        allShapes.push(shapesToGeoJSON(data, source));
        allStops.push(stopsToGeoJSON(data, source));
        console.log(
          `[gtfs] ${source.agencyId}: ${data.routes.size} routes, ${data.shapes.size} shapes, ${data.stops.size} stops, ${data.busTimetables.length} trips, ${data.shapePathIndex.paths.size} paths`,
        );
      } catch (err) {
        console.warn(`[gtfs] failed to load ${source.agencyId}:`, err);
      }
    }),
  );

  return {
    staticData,
    shapes: mergeShapeCollections(allShapes),
    stops: mergeStopCollections(allStops),
  };
}
