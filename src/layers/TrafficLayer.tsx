// src/layers/trafficLayer.tsx
import { useEffect, useRef } from "react";
import type {
  Map as MapboxMap,
  ExpressionSpecification,
  FilterSpecification,
} from "mapbox-gl";
import { useLayersStore } from "@/stores/layersStore";
import { useClockStore } from "@/stores/clockStore";

const VECTOR_SOURCE_ID = "mapbox-traffic";
const LINE_CORE_LAYER_ID = "traffic-lines-core";

// Config mong muốn khi jam ON
const JAM_BASEMAP_CONFIG = {
  showPointOfInterestLabels: false,
  showPlaceLabels: false,
  showRoadLabels: true,
  showTransitLabels: false, // bỏ metro để đỡ rối
} as const;

const SNAPSHOT_KEYS = Object.keys(JAM_BASEMAP_CONFIG) as Array<
  keyof typeof JAM_BASEMAP_CONFIG
>;

interface Props {
  map: MapboxMap;
}

const trafficFilter = [
  "in",
  ["get", "congestion"],
  ["literal", ["low", "moderate", "heavy", "severe"]],
] as FilterSpecification;

const DAY_COLORS = [
  "match",
  ["get", "congestion"],
  "low",
  "#3CC96B",
  "moderate",
  "#FF9F0A",
  "heavy",
  "#FF3B30",
  "severe",
  "#8B0000",
  "rgba(0,0,0,0)",
] as ExpressionSpecification;

const NIGHT_COLORS = [
  "match",
  ["get", "congestion"],
  "low",
  "#00E676",
  "moderate",
  "#FFD600",
  "heavy",
  "#FF6E40",
  "severe",
  "#FF1744",
  "rgba(0,0,0,0)",
] as ExpressionSpecification;

const DUSK_COLORS = [
  "match",
  ["get", "congestion"],
  "low",
  "#4ADE80",
  "moderate",
  "#FBBF24",
  "heavy",
  "#F87171",
  "severe",
  "#DC2626",
  "rgba(0,0,0,0)",
] as ExpressionSpecification;

function getColorsForPreset(preset: string): ExpressionSpecification {
  switch (preset) {
    case "night":
      return NIGHT_COLORS;
    case "dawn":
    case "dusk":
      return DUSK_COLORS;
    default:
      return DAY_COLORS;
  }
}

export function TrafficLayer({ map }: Props) {
  const enabled = useLayersStore((s) => s.enabled.has("jam"));
  const lightPreset = useClockStore((s) => s.lightPreset);

  // Snapshot basemap config trước khi override
  const prevConfigRef = useRef<Record<string, any> | null>(null);

  // ============== Setup line layer ==============
  useEffect(() => {
    if (!map) return;

    const setup = () => {
      try {
        if (!map.getSource(VECTOR_SOURCE_ID)) {
          map.addSource(VECTOR_SOURCE_ID, {
            type: "vector",
            url: "mapbox://mapbox.mapbox-traffic-v1",
          });
        }

        const layers = map.getStyle().layers;
        let firstSymbolId: string | undefined;
        for (let i = 0; i < layers.length; i++) {
          if (layers[i].type === "symbol") {
            firstSymbolId = layers[i].id;
            break;
          }
        }

        if (!map.getLayer(LINE_CORE_LAYER_ID)) {
          map.addLayer(
            {
              id: LINE_CORE_LAYER_ID,
              type: "line",
              source: VECTOR_SOURCE_ID,
              "source-layer": "traffic",
              filter: trafficFilter,
              layout: {
                "line-cap": "round",
                "line-join": "round",
                visibility: enabled ? "visible" : "none",
              },
              paint: {
                "line-color": getColorsForPreset(lightPreset),
                "line-width": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  12,
                  1.5,
                  15,
                  5,
                  18,
                  12,
                  22,
                  20,
                ],
                "line-opacity": 1,
                "line-emissive-strength": 1,
              },
            },
            firstSymbolId,
          );
        }
      } catch (e) {
        console.error("[traffic] setup failed:", e);
      }
    };

    if (map.getStyle()) setup();
    else map.once("style.load", setup);
  }, [map]);

  // ============== Update color theo lightPreset ==============
  useEffect(() => {
    if (!map || !map.getLayer(LINE_CORE_LAYER_ID)) return;
    map.setPaintProperty(
      LINE_CORE_LAYER_ID,
      "line-color",
      getColorsForPreset(lightPreset),
    );
  }, [map, lightPreset]);

  // ============== Toggle line visibility + basemap config ==============
  useEffect(() => {
    if (!map) return;

    const apply = () => {
      // 1. Toggle line layer
      const visibility = enabled ? "visible" : "none";
      if (map.getLayer(LINE_CORE_LAYER_ID)) {
        map.setLayoutProperty(LINE_CORE_LAYER_ID, "visibility", visibility);
      }

      // 2. Override / restore basemap config
      try {
        if (enabled) {
          // Snapshot config hiện tại trước khi đổi
          if (!prevConfigRef.current) {
            const snapshot: Record<string, any> = {};
            for (const key of SNAPSHOT_KEYS) {
              snapshot[key] = map.getConfigProperty("basemap", key);
            }
            prevConfigRef.current = snapshot;
          }
          // Apply config "rich"
          for (const [key, value] of Object.entries(JAM_BASEMAP_CONFIG)) {
            map.setConfigProperty("basemap", key, value);
          }
        } else if (prevConfigRef.current) {
          // Restore
          for (const [key, value] of Object.entries(prevConfigRef.current)) {
            map.setConfigProperty("basemap", key, value);
          }
          prevConfigRef.current = null;
        }
      } catch (e) {
        // Chỉ Standard style mới support setConfigProperty
        console.warn("[traffic] basemap config not supported:", e);
      }
    };

    if (map.getStyle()) apply();
    else map.once("style.load", apply);
  }, [map, enabled]);

  return null;
}
