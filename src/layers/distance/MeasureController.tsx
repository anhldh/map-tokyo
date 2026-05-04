import { useEffect } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { useMeasureStore } from "@/stores/measureStore";
import {
  addMeasureLayers,
  MEASURE_SOURCE_ID,
  MEASURE_PREVIEW_SOURCE_ID,
} from "./measureLayers";
import {
  buildMeasureGeoJSON,
  buildPreviewGeoJSON,
} from "@/utils/measureGeoJSON";

interface Props {
  map: MapboxMap;
}

export function MeasureController({ map }: Props) {
  // Setup layers 1 lần
  useEffect(() => {
    if (!map.isStyleLoaded()) {
      map.once("style.load", () => addMeasureLayers(map));
    } else {
      addMeasureLayers(map);
    }
  }, [map]);

  // Bật/tắt mode → đổi camera + cursor
  useEffect(() => {
    const unsub = useMeasureStore.subscribe((state, prev) => {
      if (state.isActive === prev.isActive) return;

      if (state.isActive) {
        map.easeTo({ pitch: 0, bearing: 0, duration: 500 });
        map.getCanvas().style.cursor = "crosshair";
      } else {
        const snap = prev.cameraSnapshot;
        if (snap) {
          map.easeTo({
            center: snap.center,
            zoom: snap.zoom,
            pitch: snap.pitch,
            bearing: snap.bearing,
            duration: 500,
          });
        }
        map.getCanvas().style.cursor = "";
        // Clear data
        const src = map.getSource(MEASURE_SOURCE_ID);
        const psrc = map.getSource(MEASURE_PREVIEW_SOURCE_ID);
        if (src && "setData" in src) {
          (src as mapboxgl.GeoJSONSource).setData({
            type: "FeatureCollection",
            features: [],
          });
        }
        if (psrc && "setData" in psrc) {
          (psrc as mapboxgl.GeoJSONSource).setData({
            type: "FeatureCollection",
            features: [],
          });
        }
      }
    });
    return unsub;
  }, [map]);

  // Sync points → main source
  useEffect(() => {
    const unsub = useMeasureStore.subscribe((state) => {
      const src = map.getSource(MEASURE_SOURCE_ID) as
        | mapboxgl.GeoJSONSource
        | undefined;
      if (!src) return;
      src.setData(buildMeasureGeoJSON(state.points));
    });
    return unsub;
  }, [map]);

  // Sync hover → preview source
  useEffect(() => {
    const unsub = useMeasureStore.subscribe((state) => {
      const src = map.getSource(MEASURE_PREVIEW_SOURCE_ID) as
        | mapboxgl.GeoJSONSource
        | undefined;
      if (!src) return;
      src.setData(buildPreviewGeoJSON(state.points, state.hoverPoint));
    });
    return unsub;
  }, [map]);

  // Click + mousemove + keyboard
  useEffect(() => {
    const onClick = (e: mapboxgl.MapMouseEvent) => {
      const s = useMeasureStore.getState();
      if (!s.isActive) return;
      // Chặn picking train/bus khi đang đo
      e.preventDefault();
      s.addPoint([e.lngLat.lng, e.lngLat.lat]);
    };

    const onMouseMove = (e: mapboxgl.MapMouseEvent) => {
      const s = useMeasureStore.getState();
      if (!s.isActive) return;
      s.setHoverPoint([e.lngLat.lng, e.lngLat.lat]);
    };

    const onMouseLeave = () => {
      const s = useMeasureStore.getState();
      if (!s.isActive) return;
      s.setHoverPoint(null);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const s = useMeasureStore.getState();
      if (!s.isActive) return;
      if (e.key === "Escape") s.deactivate();
      else if (e.key === "Backspace") s.removeLastPoint();
    };

    map.on("click", onClick);
    map.on("mousemove", onMouseMove);
    map.getCanvas().addEventListener("mouseleave", onMouseLeave);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      map.off("click", onClick);
      map.off("mousemove", onMouseMove);
      map.getCanvas().removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [map]);

  return null;
}
