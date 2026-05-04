import type { FeatureCollection, Feature } from "geojson";
import { type LngLat, formatDistance } from "@/stores/measureStore";
import distance from "@turf/distance";
import { point as turfPoint } from "@turf/helpers";

function midpoint(a: LngLat, b: LngLat): LngLat {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function calcDistance(a: LngLat, b: LngLat): number {
  return distance(turfPoint(a), turfPoint(b), { units: "meters" });
}

/** GeoJSON cho điểm + line + label đã chốt */
export function buildMeasureGeoJSON(points: LngLat[]): FeatureCollection {
  const features: Feature[] = [];

  points.forEach((p, i) => {
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: p },
      properties: { kind: "vertex", index: i },
    });
  });

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dist = calcDistance(a, b);

    features.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: [a, b] },
      properties: { kind: "segment" },
    });

    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: midpoint(a, b) },
      properties: {
        kind: "label",
        label: formatDistance(dist),
      },
    });
  }

  return { type: "FeatureCollection", features };
}

/** GeoJSON preview line từ điểm cuối → hover point */
export function buildPreviewGeoJSON(
  points: LngLat[],
  hover: LngLat | null,
): FeatureCollection {
  if (!hover || points.length === 0) {
    return { type: "FeatureCollection", features: [] };
  }
  const last = points[points.length - 1];
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
