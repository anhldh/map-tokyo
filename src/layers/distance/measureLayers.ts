import type { Map as MapboxMap } from "mapbox-gl";

const ACCENT_COLOR = "#14b8a6";

export const MEASURE_SOURCE_ID = "measure-source";
export const MEASURE_PREVIEW_SOURCE_ID = "measure-preview-source";

export function addMeasureLayers(map: MapboxMap) {
  if (map.getSource(MEASURE_SOURCE_ID)) return;

  // Source chính
  map.addSource(MEASURE_SOURCE_ID, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });

  map.addSource(MEASURE_PREVIEW_SOURCE_ID, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });

  // Preview line (dashed, mờ)
  map.addLayer({
    id: "measure-preview-line",
    type: "line",
    source: MEASURE_PREVIEW_SOURCE_ID,
    filter: ["==", ["get", "kind"], "preview"],
    paint: {
      "line-color": ACCENT_COLOR,
      "line-width": 2,
      "line-dasharray": [2, 2],
      "line-opacity": 0.6,
    },
  });

  // Line đã chốt
  map.addLayer({
    id: "measure-line",
    type: "line",
    source: MEASURE_SOURCE_ID,
    filter: ["==", ["get", "kind"], "segment"],
    paint: {
      "line-color": ACCENT_COLOR,
      "line-width": 2.5,
    },
  });

  // Vertex (điểm chấm)
  map.addLayer({
    id: "measure-vertex",
    type: "circle",
    source: MEASURE_SOURCE_ID,
    filter: ["==", ["get", "kind"], "vertex"],
    paint: {
      "circle-radius": 6,
      "circle-color": ACCENT_COLOR,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 2,
    },
  });

  // Label khoảng cách
  map.addLayer({
    id: "measure-label",
    type: "symbol",
    source: MEASURE_SOURCE_ID,
    filter: ["==", ["get", "kind"], "label"],
    layout: {
      "text-field": ["get", "label"],
      "text-size": 12,
      "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
      "text-offset": [0, -1.2],
      "text-anchor": "bottom",
      "text-allow-overlap": true,
    },
    paint: {
      "text-color": "#ffffff",
      "text-halo-color": "#000000",
      "text-halo-width": 1.5,
    },
  });

  // Preview label
  map.addLayer({
    id: "measure-preview-label",
    type: "symbol",
    source: MEASURE_PREVIEW_SOURCE_ID,
    filter: ["==", ["get", "kind"], "preview-label"],
    layout: {
      "text-field": ["get", "label"],
      "text-size": 11,
      "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
      "text-offset": [0, -1.2],
      "text-anchor": "bottom",
      "text-allow-overlap": true,
    },
    paint: {
      "text-color": "#ffffff",
      "text-halo-color": "#000000",
      "text-halo-width": 1.2,
      "text-opacity": 0.8,
    },
  });
}

export function removeMeasureLayers(map: MapboxMap) {
  [
    "measure-preview-line",
    "measure-line",
    "measure-vertex",
    "measure-label",
    "measure-preview-label",
  ].forEach((id) => {
    if (map.getLayer(id)) map.removeLayer(id);
  });
  if (map.getSource(MEASURE_SOURCE_ID)) map.removeSource(MEASURE_SOURCE_ID);
  if (map.getSource(MEASURE_PREVIEW_SOURCE_ID))
    map.removeSource(MEASURE_PREVIEW_SOURCE_ID);
}
