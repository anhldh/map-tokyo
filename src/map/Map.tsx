import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import { INITIAL_CONFIG, INITIAL_VIEW, type MapConfig } from "./mapConfig";
import { addRailwayLayers } from "@/layers/railways";
import { loadRailwayData } from "@/helpers/loadRailwayData";
import { PlateauPlugin } from "@/layers/plateau";
import { LivecamPlugin, type LivecamData } from "@/layers/livecam";
import { useLayersStore } from "@/stores/layersStore";
import { useClockStore } from "@/stores/clockStore";
import { LivecamModal } from "@/components/ui/LivecamModal";
import { PrecipitationPlugin } from "@/layers/precipitation";
import { addStationLayers, STATION_LAYER_IDS } from "@/layers/stations";
import {
  getCalendarType,
  getNowSecondsTokyo,
  TrainScheduler,
  type TrainTimetable,
} from "@/layers/trainscheduler";
import {
  buildRailwayPathMap,
  distanceToStation,
  samplePath,
} from "@/layers/railwaypath";
import { TrainLayer } from "@/layers/trainLayer";
import { StreetViewPanel } from "@/components/ui/StreetViewPanel";
import { useStreetViewStore } from "@/stores/streetViewStore";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

const RAILWAY_ZOOM_LEVELS = [13, 14, 15, 16, 17, 18] as const;
const RAILWAY_SUFFIXES = ["og", "ug"] as const;

interface MapProps {
  onMapLoad?: (map: mapboxgl.Map) => void;
}

export default function MapView({ onMapLoad }: MapProps) {
  // ============== Refs ==============
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const plateauRef = useRef<PlateauPlugin | null>(null);
  const livecamRef = useRef<LivecamPlugin | null>(null);
  const precipitationRef = useRef<PrecipitationPlugin | null>(null);
  const styleLoadedRef = useRef(false);
  const trainLayerRef = useRef<TrainLayer | null>(null);

  // ============== State ==============
  const [config] = useState<MapConfig>(INITIAL_CONFIG);
  const [activeCamera, setActiveCamera] = useState<LivecamData | null>(null);
  // Expose mapbox instance để StreetViewPanel dùng được
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);

  // ============== Store subscriptions ==============
  const plateauEnabled = useLayersStore((s) => s.enabled.has("plateau"));
  const livecamEnabled = useLayersStore((s) => s.enabled.has("live-cameras"));
  const lightPreset = useClockStore((s) => s.lightPreset);
  const precipitationEnabled = useLayersStore((s) =>
    s.enabled.has("precipitation"),
  );

  // Street View store
  const svMode = useStreetViewStore((s) => s.mode);
  const setSvPosition = useStreetViewStore((s) => s.setPosition);

  // ============== Helpers ==============
  const moveRailwaysToTop = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const zoom of RAILWAY_ZOOM_LEVELS) {
      for (const suffix of RAILWAY_SUFFIXES) {
        const id = `railways-${suffix}-${zoom}`;
        if (map.getLayer(id)) map.moveLayer(id);
      }
    }
    for (const id of STATION_LAYER_IDS) {
      if (map.getLayer(id)) map.moveLayer(id);
    }
    if (map.getLayer("precipitation")) {
      map.moveLayer("precipitation");
    }
  }, []);

  // ============== Map initialization (chạy 1 lần) ==============
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/standard",
      ...INITIAL_VIEW,
      antialias: true,
    });
    mapRef.current = map;

    // Khởi tạo plugins
    plateauRef.current = new PlateauPlugin();
    plateauRef.current.setOnLayerAdded(moveRailwaysToTop);

    livecamRef.current = new LivecamPlugin({
      lang: "en",
      onCameraOpen: (camera) => setActiveCamera(camera),
      onCameraClose: () => setActiveCamera(null),
    });

    precipitationRef.current = new PrecipitationPlugin({
      theme: lightPreset === "day" ? "light" : "dark",
    });

    map.on("style.load", async () => {
      map.setConfigProperty(
        "basemap",
        "lightPreset",
        useClockStore.getState().lightPreset,
      );
      (Object.entries(config) as [keyof MapConfig, any][]).forEach(
        ([key, value]) => map.setConfigProperty("basemap", key, value),
      );

      map.addSource("mapbox-dem", {
        type: "raster-dem",
        url: "mapbox://mapbox.mapbox-terrain-dem-v1",
        tileSize: 512,
        maxzoom: 14,
      });
      map.setTerrain({ source: "mapbox-dem", exaggeration: 1.2 });

      onMapLoad?.(map);

      try {
        const { railways, stations, features, stationGroups } =
          await loadRailwayData();
        addRailwayLayers({ map, features, slot: "top" });
        addStationLayers({
          map,
          stations,
          railways,
          stationGroups,
          slot: "top",
        });
      } catch (err) {
        console.error("Failed to load map data:", err);
      }

      styleLoadedRef.current = true;
      // Expose map instance ra cho các component khác (StreetViewPanel)
      setMapInstance(map);

      const enabledLayers = useLayersStore.getState().enabled;
      if (enabledLayers.has("plateau")) plateauRef.current?.enable(map);
      if (enabledLayers.has("live-cameras")) livecamRef.current?.enable(map);
      if (enabledLayers.has("precipitation"))
        precipitationRef.current?.enable(map);
    });

    return () => {
      plateauRef.current?.disable();
      livecamRef.current?.disable();
      precipitationRef.current?.disable();
      map.remove();

      mapRef.current = null;
      plateauRef.current = null;
      livecamRef.current = null;
      styleLoadedRef.current = false;
      setMapInstance(null);
    };
  }, [onMapLoad, config, moveRailwaysToTop, lightPreset]);

  // ============== Light preset (theo giờ) ==============
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoadedRef.current) return;
    try {
      map.setConfigProperty("basemap", "lightPreset", lightPreset);
    } catch {
      // Chỉ Mapbox Standard style mới support
    }
  }, [lightPreset]);

  // ============== PLATEAU toggle ==============
  useEffect(() => {
    const map = mapRef.current;
    const plugin = plateauRef.current;
    if (!map || !plugin || !styleLoadedRef.current) return;

    if (plateauEnabled) plugin.enable(map);
    else plugin.disable();
  }, [plateauEnabled]);

  // ============== Livecam toggle ==============
  useEffect(() => {
    const map = mapRef.current;
    const plugin = livecamRef.current;
    if (!map || !plugin || !styleLoadedRef.current) return;

    if (livecamEnabled) plugin.enable(map);
    else plugin.disable();
  }, [livecamEnabled]);

  // ============== Precipitation toggle ==============
  useEffect(() => {
    const map = mapRef.current;
    const plugin = precipitationRef.current;
    if (!map || !plugin || !styleLoadedRef.current) return;

    if (precipitationEnabled) plugin.enable(map);
    else plugin.disable();
  }, [precipitationEnabled]);

  // ============== Precipitation theme ==============
  useEffect(() => {
    precipitationRef.current?.setTheme(
      lightPreset === "day" ? "light" : "dark",
    );
  }, [lightPreset]);

  // ============== Street View: picking mode ==============
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoadedRef.current) return;

    if (svMode !== "picking") {
      map.getCanvas().style.cursor = "";
      return;
    }

    map.getCanvas().style.cursor = "crosshair";

    const handler = (e: mapboxgl.MapMouseEvent) => {
      setSvPosition({ lng: e.lngLat.lng, lat: e.lngLat.lat });
    };
    map.once("click", handler);

    return () => {
      map.getCanvas().style.cursor = "";
      map.off("click", handler);
    };
  }, [svMode, setSvPosition]);

  // ============== Modal handlers ==============
  const handleModalClose = useCallback(() => {
    livecamRef.current?.closeActive();
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

      {/* Hint khi đang chọn vị trí xem phố */}
      {svMode === "picking" && (
        <div
          style={{
            position: "absolute",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.75)",
            color: "white",
            padding: "8px 16px",
            borderRadius: 8,
            zIndex: 10,
            pointerEvents: "none",
            fontSize: 14,
          }}
        >
          Click vào bản đồ để chọn vị trí xem phố
        </div>
      )}

      <StreetViewPanel mapboxMap={mapInstance} />

      <LivecamModal
        camera={activeCamera}
        lang="en"
        onClose={handleModalClose}
      />
    </div>
  );
}

// ============== Train layer ==============
// const pathMap = buildRailwayPathMap(features);
// const stationMap = new Map(stations.map((s) => [s.id, s]));
// const railwayColors = new Map(railways.map((r) => [r.id, r.color]));

// const manifest = await fetch(
//   "/data/train-timetables/_manifest.json",
// ).then((r) => r.json());
// const all = await Promise.all(
//   manifest.map((f) =>
//     fetch(`/data/train-timetables/${f}`).then((r) => r.json()),
//   ),
// );
// const flat = all.flat();
// console.log("Total timetables:", flat.length);

// // Đếm theo suffix
// const suffixCounts = {};
// for (const t of flat) {
//   const m = t.id.match(/\.([^.]+)$/);
//   const suffix = m ? m[1] : "(none)";
//   suffixCounts[suffix] = (suffixCounts[suffix] ?? 0) + 1;
// }
// console.table(suffixCounts);

// const allTimetables = await Promise.all(
//   manifest.map((f) =>
//     fetch(`/data/train-timetables/${f}`).then(
//       (r) => r.json() as Promise<TrainTimetable[]>,
//     ),
//   ),
// );
// const calendar = getCalendarType();
// const filtered = allTimetables
//   .flat()
//   .filter((t) => t.id.endsWith(`.${calendar}`));

// const scheduler = new TrainScheduler(pathMap);
// scheduler.addTimetables(filtered, stationMap);
// console.log(`🚆 Loaded ${scheduler.size} timetables for ${calendar}`);

// const trainLayer = new TrainLayer({
//   scheduler,
//   railwayColors,
//   maxInstances: 1000,
//   carSize: [20, 30, 100], // to gấp ~5 lần — dễ thấy
//   altitudeOffset: 50, // lift 50m cho dễ thấy
// });
// trainLayerRef.current = trainLayer;
// map.addLayer(trainLayer);
