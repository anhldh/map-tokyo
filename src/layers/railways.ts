import type { Map as MapboxMap } from "mapbox-gl";
import type { FeatureCollection } from "geojson";
import type { ExpressionSpecification } from "mapbox-gl";

const SOURCE_ID = "odpt-features";
const ZOOM_LEVELS = [13, 14, 15, 16, 17, 18] as const;

const WIDTH_EXPRESSION: ExpressionSpecification = [
  "interpolate",
  ["exponential", 1.5],
  ["zoom"],
  10,
  ["*", ["coalesce", ["get", "width"], 8], 0.05],
  14,
  ["*", ["coalesce", ["get", "width"], 8], 0.5],
  18,
  ["*", ["coalesce", ["get", "width"], 8], 2.5],
  22,
  ["*", ["coalesce", ["get", "width"], 8], 5],
  24,
  ["*", ["coalesce", ["get", "width"], 8], 8], // thêm mốc mới
];

export interface AddRailwayLayersOptions {
  map: MapboxMap;
  features: FeatureCollection;
  slot?: "bottom" | "middle" | "top";
}

export function addRailwayLayers(options: AddRailwayLayersOptions): void {
  const { map, features, slot = "middle" } = options;

  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: features,
    });
  }

  ZOOM_LEVELS.forEach((zoom, i) => {
    const isFirst = i === 0;
    const isLast = i === ZOOM_LEVELS.length - 1;
    const minzoom = isFirst ? undefined : zoom - 0.5;
    const maxzoom = isLast ? undefined : zoom + 0.5;

    // Overground
    map.addLayer({
      id: `railways-og-${zoom}`,
      type: "line",
      source: SOURCE_ID,
      slot,
      ...(minzoom !== undefined && { minzoom }),
      ...(maxzoom !== undefined && { maxzoom }),
      filter: [
        "all",
        ["==", ["get", "zoom"], zoom],
        ["in", ["get", "type"], ["literal", [0, 2]]],
        [">=", ["coalesce", ["get", "altitude"], 0], 0],
      ],
      paint: {
        "line-color": ["get", "color"],
        "line-width": WIDTH_EXPRESSION,
        "line-emissive-strength": 1,
      },
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
    });

    // Underground
    map.addLayer({
      id: `railways-ug-${zoom}`,
      type: "line",
      source: SOURCE_ID,
      slot,
      ...(minzoom !== undefined && { minzoom }),
      ...(maxzoom !== undefined && { maxzoom }),
      filter: [
        "all",
        ["==", ["get", "zoom"], zoom],
        ["in", ["get", "type"], ["literal", [0, 2]]],
        ["<", ["coalesce", ["get", "altitude"], 0], 0],
      ],
      paint: {
        "line-color": ["get", "color"],
        "line-width": WIDTH_EXPRESSION,
        "line-opacity": 0.5,
        "line-dasharray": [2, 2],
        "line-emissive-strength": 1,
      },
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
    });
  });
}

export function removeRailwayLayers(map: MapboxMap): void {
  for (const zoom of ZOOM_LEVELS) {
    for (const suffix of ["og", "ug"]) {
      const id = `railways-${suffix}-${zoom}`;
      if (map.getLayer(id)) map.removeLayer(id);
    }
  }
  if (map.getSource(SOURCE_ID)) {
    map.removeSource(SOURCE_ID);
  }
}
