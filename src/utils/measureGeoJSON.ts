import type { FeatureCollection, Feature } from "geojson";
import {
  type LngLat,
  type Measurement,
  formatDistance,
} from "@/stores/measureStore";
import distance from "@turf/distance";
import { point as turfPoint } from "@turf/helpers";

function midpoint(a: LngLat, b: LngLat): LngLat {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function calcDistance(a: LngLat, b: LngLat): number {
  return distance(turfPoint(a), turfPoint(b), { units: "meters" });
}

/** Build features cho 1 measurement */
function featuresForMeasurement(m: Measurement): Feature[] {
  const features: Feature[] = [];
  const { id, points, closed } = m;

  // Vertices
  points.forEach((p, i) => {
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: p },
      properties: {
        kind: "vertex",
        measurementId: id,
        index: i,
        isFirst: i === 0, // dùng để highlight điểm đầu khi đang vẽ
      },
    });
  });

  // Segments + labels
  const segments: [LngLat, LngLat][] = [];
  for (let i = 1; i < points.length; i++) {
    segments.push([points[i - 1], points[i]]);
  }
  if (closed && points.length >= 3) {
    segments.push([points[points.length - 1], points[0]]);
  }

  segments.forEach(([a, b]) => {
    const dist = calcDistance(a, b);
    features.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: [a, b] },
      properties: { kind: "segment", measurementId: id },
    });
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: midpoint(a, b) },
      properties: {
        kind: "label",
        measurementId: id,
        label: formatDistance(dist),
      },
    });
  });

  // Polygon fill nếu closed
  if (closed && points.length >= 3) {
    features.push({
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [[...points, points[0]]],
      },
      properties: { kind: "fill", measurementId: id },
    });
  }

  return features;
}

export function buildMeasureGeoJSON(
  measurements: Measurement[],
): FeatureCollection {
  const features: Feature[] = [];
  measurements.forEach((m) => {
    features.push(...featuresForMeasurement(m));
  });
  return { type: "FeatureCollection", features };
}

/** Preview line từ điểm cuối của active → hover */
export function buildPreviewGeoJSON(
  activeMeasurement: Measurement | null,
  hover: LngLat | null,
): FeatureCollection {
  if (!activeMeasurement || !hover || activeMeasurement.points.length === 0) {
    return { type: "FeatureCollection", features: [] };
  }
  const last = activeMeasurement.points[activeMeasurement.points.length - 1];
  const dist = calcDistance(last, hover);

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "LineString", coordinates: [last, hover] },
        properties: { kind: "preview" },
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: midpoint(last, hover) },
        properties: {
          kind: "preview-label",
          label: formatDistance(dist),
        },
      },
    ],
  };
}
