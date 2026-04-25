import turfBearing from "@turf/bearing";
import centerOfMass from "@turf/center-of-mass";
import turfDistance from "@turf/distance";
import { featureCollection } from "@turf/helpers";
import { getCoord, getCoords } from "@turf/invariant";
import { featureEach } from "@turf/meta";
import type {
  Feature,
  FeatureCollection,
  GeoJSON,
  Geometry,
  LineString,
  Position,
} from "geojson";

/** Distance entry: [distanceTravelled, bearing, slope, pitch] */
export type DistanceEntry = [number, number, number, number];

/** Extended LineString feature with a `distances` property. */
export interface LineStringWithDistances extends Feature<
  LineString,
  Record<string, unknown>
> {
  properties: {
    distances: DistanceEntry[];
    [key: string]: unknown;
  };
}

/**
 * Filter GeoJSON object using a filter function.
 * @param geojson - GeoJSON object
 * @param fn - Filter function that takes feature properties and returns a boolean value
 * @returns Filtered FeatureCollection
 */
export function featureFilter<G extends Geometry, P = Record<string, unknown>>(
  geojson: GeoJSON,
  fn: (properties: P | null) => boolean,
): FeatureCollection<G, P> {
  const features: Feature<G, P>[] = [];

  featureEach(geojson as FeatureCollection<G, P>, (feature) => {
    if (fn(feature.properties)) {
      features.push(feature);
    }
  });
  return featureCollection(features) as FeatureCollection<G, P>;
}

/**
 * Takes LineString and update distances property.
 * @param line - LineString of the railway/airway
 */
export function updateDistances(line: LineStringWithDistances): void {
  const coords = getCoords(line) as Position[],
    distances: DistanceEntry[] = (line.properties.distances = []);
  let travelled = 0,
    nextCoord = coords[0],
    bearing = 0,
    slope = 0,
    pitch = 0;

  for (let i = 0, ilen = coords.length; i < ilen - 1; i++) {
    const currCoord = nextCoord;

    nextCoord = coords[i + 1];

    const distance = turfDistance(currCoord, nextCoord);

    bearing = turfBearing(currCoord, nextCoord);
    slope = ((nextCoord[2] ?? 0) - (currCoord[2] ?? 0)) / distance;
    pitch = Math.atan(slope / 1000);

    distances.push([travelled, bearing, slope, pitch]);
    travelled += distance;
  }

  distances.push([travelled, bearing, slope, pitch]);
}

/**
 * Takes GeoJSON object and returns the altitude of the first point.
 * @param geojson - GeoJSON object
 * @returns Altitude of the first point
 */
export function getAltitude(geojson: GeoJSON): number {
  return (getCoords(geojson as any) as Position[][])[0][0][2];
}

/**
 * Takes GeoJSON object and returns the coordinates of its center of mass.
 * @param geojson - GeoJSON object
 * @returns Coordinates of the center of mass [lng, lat]
 */
export function getCenterCoord(geojson: GeoJSON): Position {
  return getCoord(centerOfMass(geojson as FeatureCollection));
}

export function emptyFeatureCollection(): FeatureCollection {
  return featureCollection([]);
}
