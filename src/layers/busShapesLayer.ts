// src/layers/busShapesLayer.ts
import type { Map as MapboxMap } from "mapbox-gl";
import type { FeatureCollection, LineString } from "geojson";
import type { ShapeFeatureProps } from "@/helpers/gtfsShapes";

const SOURCE_ID = "bus-shapes";
const LAYER_ID = "bus-shapes-line";

export interface AddBusShapesLayerOptions {
  map: MapboxMap;
  shapes: FeatureCollection<LineString, ShapeFeatureProps>;
  slot?: "bottom" | "middle" | "top";
}

export function addBusShapesLayer(options: AddBusShapesLayerOptions): void {
  const { map, shapes, slot = "middle" } = options;

  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: shapes,
    });
  }

  if (!map.getLayer(LAYER_ID)) {
    map.addLayer({
      id: LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      slot,
      paint: {
        "line-color": ["get", "color"],
        "line-width": [
          "interpolate",
          ["exponential", 1.5],
          ["zoom"],
          10,
          0.5,
          14,
          1.5,
          18,
          3,
        ],
        "line-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          10,
          0.3,
          14,
          0.55,
          18,
          0.75,
        ],
        "line-emissive-strength": 1,
      },
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
    });
  }
}

export function removeBusShapesLayer(map: MapboxMap): void {
  if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
}

export function updateBusShapes(
  map: MapboxMap,
  shapes: FeatureCollection<LineString, ShapeFeatureProps>,
): void {
  const source = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
  source?.setData(shapes);
}
