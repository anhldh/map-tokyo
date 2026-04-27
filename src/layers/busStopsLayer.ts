// src/layers/busStopsLayer.ts
import type { Map as MapboxMap } from "mapbox-gl";
import type { FeatureCollection, Point } from "geojson";
import type { StopFeatureProps } from "@/helpers/gtfsStops";

const SOURCE_ID = "bus-stops";
const LAYER_DOT = "bus-stops-dot";
const LAYER_LABEL = "bus-stops-label";

// Chỉ bắt đầu render khi đã zoom sát mặt đường (phóng to rất gần)
const MIN_ZOOM = 16;

export interface AddBusStopsLayerOptions {
  map: MapboxMap;
  stops: FeatureCollection<Point, StopFeatureProps>;
  slot?: "bottom" | "middle" | "top";
}

export function addBusStopsLayer(options: AddBusStopsLayerOptions): void {
  const { map, stops, slot = "top" } = options;

  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: stops,
    });
  }

  if (!map.getLayer(LAYER_DOT)) {
    map.addLayer({
      id: LAYER_DOT,
      type: "circle",
      source: SOURCE_ID,
      slot,
      minzoom: MIN_ZOOM,
      paint: {
        "circle-radius": [
          "interpolate",
          ["exponential", 1.5],
          ["zoom"],
          16,
          3, // Bắt đầu hiện ở zoom 16 với kích thước vừa phải
          18,
          6, // Lên zoom 18 thì to rõ nét
          20,
          8, // Lên zoom 20 thì to hẳn ra
        ],
        "circle-color": ["get", "color"],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          16,
          0.8,
          18,
          1.5,
        ],
        "circle-emissive-strength": 1,

        // Từ 16 đến 16.5 sẽ chuyển từ tàng hình sang rõ 100%
        "circle-opacity": ["interpolate", ["linear"], ["zoom"], 16, 0, 16.5, 1],
        "circle-stroke-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          16,
          0,
          16.5,
          1,
        ],
      },
    });
  }

  if (!map.getLayer(LAYER_LABEL)) {
    map.addLayer({
      id: LAYER_LABEL,
      type: "symbol",
      source: SOURCE_ID,
      slot,
      // Cho chữ xuất hiện trễ hơn cái chấm một nhịp (zoom 16.5) cho đỡ rối
      minzoom: 16.5,
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 16.5, 10, 18, 12],
        "text-offset": [0, 0.9],
        "text-anchor": "top",
        "text-optional": true,
        "text-allow-overlap": false,
      },
      paint: {
        "text-color": "#ffffff",
        "text-halo-color": "rgba(0, 0, 0, 0.85)",
        "text-halo-width": 1.5,
        // Fade in cho chữ từ 16.5 đến 17
        "text-opacity": ["interpolate", ["linear"], ["zoom"], 16.5, 0, 17, 1],
      },
    });
  }
}

export function removeBusStopsLayer(map: MapboxMap): void {
  for (const id of [LAYER_LABEL, LAYER_DOT]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
}
