import type { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";
import type { Feature, FeatureCollection, Point } from "geojson";
import type { ActiveTrain } from "@/animation/trainPositions";
import type { Railway } from "@/helpers/loadRailwayData";

const SOURCE_ID = "trains";
const LAYER_CIRCLE = "trains-circle";
const LAYER_HALO = "trains-halo";

const EMPTY: FeatureCollection<Point> = {
  type: "FeatureCollection",
  features: [],
};

export interface AddTrainsLayerOptions {
  map: MapboxMap;
  slot?: "bottom" | "middle" | "top";
}

export function addTrainsLayer({
  map,
  slot = "top",
}: AddTrainsLayerOptions): void {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, { type: "geojson", data: EMPTY });
  }

  if (!map.getLayer(LAYER_HALO)) {
    map.addLayer({
      id: LAYER_HALO,
      type: "circle",
      source: SOURCE_ID,
      slot,
      paint: {
        "circle-radius": [
          "interpolate",
          ["exponential", 1.5],
          ["zoom"],
          10,
          4,
          14,
          8,
          18,
          14,
        ],
        "circle-color": ["get", "color"],
        "circle-opacity": 0.35,
        "circle-blur": 0.6,
        "circle-emissive-strength": 1,
      },
    });
  }

  if (!map.getLayer(LAYER_CIRCLE)) {
    map.addLayer({
      id: LAYER_CIRCLE,
      type: "circle",
      source: SOURCE_ID,
      slot,
      paint: {
        "circle-radius": [
          "interpolate",
          ["exponential", 1.5],
          ["zoom"],
          10,
          2.5,
          14,
          4.5,
          18,
          7,
        ],
        "circle-color": ["get", "color"],
        "circle-stroke-color": "#0b0b0b",
        "circle-stroke-width": 1.25,
        "circle-emissive-strength": 1,
      },
    });
  }
}

export function updateTrains(
  map: MapboxMap,
  trains: ActiveTrain[],
  railwayById: Map<string, Railway>,
): void {
  const features: Feature<Point>[] = trains.map((train) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: train.position },
    properties: {
      id: train.timetable.id,
      n: train.timetable.trainNumber,
      r: train.timetable.railway,
      color: railwayById.get(train.timetable.railway)?.color ?? "#ffffff",
      bearing: train.bearing,
      state: train.state,
    },
  }));

  const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
  source?.setData({ type: "FeatureCollection", features });
}

export function removeTrainsLayer(map: MapboxMap): void {
  for (const id of [LAYER_CIRCLE, LAYER_HALO]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
}
