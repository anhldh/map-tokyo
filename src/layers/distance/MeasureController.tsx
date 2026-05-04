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
  useEffect(() => {
    const setup = () => addMeasureLayers(map);

    if (map.isStyleLoaded()) {
      setup();
    } else {
      map.once("load", setup);
    }
  }, [map]);

  // Camera + cursor on toggle
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
      }
    });
    return unsub;
  }, [map]);

  // Sync main source: rebuild khi measurements thay đổi
  useEffect(() => {
    const update = () => {
      const src = map.getSource(MEASURE_SOURCE_ID) as
        | mapboxgl.GeoJSONSource
        | undefined;
      if (!src) return;
      src.setData(buildMeasureGeoJSON(useMeasureStore.getState().measurements));
    };

    update(); // initial
    const unsub = useMeasureStore.subscribe((state, prev) => {
      if (state.measurements !== prev.measurements) update();
    });
    return unsub;
  }, [map]);

  // Sync preview
  useEffect(() => {
    const update = () => {
      const src = map.getSource(MEASURE_PREVIEW_SOURCE_ID) as
        | mapboxgl.GeoJSONSource
        | undefined;
      if (!src) return;
      const s = useMeasureStore.getState();
      const active = s.getActive();
      src.setData(buildPreviewGeoJSON(active, s.hoverPoint));
    };

    const unsub = useMeasureStore.subscribe((state, prev) => {
      if (
        state.hoverPoint !== prev.hoverPoint ||
        state.activeId !== prev.activeId ||
        state.measurements !== prev.measurements
      ) {
        update();
      }
    });
    return unsub;
  }, [map]);

  // Mouse + keyboard handlers
  useEffect(() => {
    const onClick = (e: mapboxgl.MapMouseEvent) => {
      const s = useMeasureStore.getState();
      if (!s.isActive) return;
      e.preventDefault();
      s.addPoint([e.lngLat.lng, e.lngLat.lat]);
    };

    const onDblClick = (e: mapboxgl.MapMouseEvent) => {
      const s = useMeasureStore.getState();
      if (!s.isActive) return;
      e.preventDefault();
      s.finishActive();
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
      if (e.key === "Escape") {
        if (s.activeId) s.finishActive();
        else s.deactivate();
      } else if (e.key === "Enter") {
        s.finishActive();
      } else if (e.key === "Backspace") {
        s.removeLastPoint();
      }
    };

    map.on("click", onClick);
    map.on("dblclick", onDblClick);
    map.on("mousemove", onMouseMove);
    map.getCanvas().addEventListener("mouseleave", onMouseLeave);
    window.addEventListener("keydown", onKeyDown);

    // Disable double-click zoom khi đang đo
    const onActiveChange = () => {
      const isActive = useMeasureStore.getState().isActive;
      if (isActive) map.doubleClickZoom.disable();
      else map.doubleClickZoom.enable();
    };
    onActiveChange();
    const unsubActive = useMeasureStore.subscribe((state, prev) => {
      if (state.isActive !== prev.isActive) onActiveChange();
    });

    return () => {
      map.off("click", onClick);
      map.off("dblclick", onDblClick);
      map.off("mousemove", onMouseMove);
      map.getCanvas().removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("keydown", onKeyDown);
      unsubActive();
    };
  }, [map]);

  return null;
}
