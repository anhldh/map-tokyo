import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
// import type { FeatureCollection, LineString } from "geojson";

import { INITIAL_CONFIG, INITIAL_VIEW, type MapConfig } from "./mapConfig";
import { addRailwayLayers, removeRailwayLayers } from "@/layers/railways";
import { loadRailwayData } from "@/helpers/loadRailwayData";
import { PlateauPlugin } from "@/layers/plateau";
import { LivecamPlugin, type LivecamData } from "@/layers/livecam";
import { useLayersStore } from "@/stores/layersStore";
import { useClockStore } from "@/stores/clockStore";
import { LivecamModal } from "@/components/ui/LivecamModal";
import { PrecipitationPlugin } from "@/layers/precipitation";
import {
  addStationLayers,
  removeStationLayers,
  STATION_LAYER_IDS,
} from "@/layers/stations";
import { StreetViewPanel } from "@/components/ui/StreetViewPanel";
import { useStreetViewStore } from "@/stores/streetViewStore";
import { FloodSimulationPlugin } from "@/layers/flood/FlootLayer";
import { useFloodStore } from "@/stores/floodStore";
import { computeEffectiveLevel } from "@/helpers/floodModel";
import type { TrainsLayerHandle } from "@/layers/trainsThreeLayer";
import { startTrainAnimation } from "@/animation/trainAnimation";
import { loadAllTimetables } from "@/helpers/timetable";
import TrainOverlay from "@/components/ui/TrainOverlay";
import {
  addBusesThreeLayer,
  type BusesLayerHandle,
} from "@/layers/busesThreeLayer";
import { startGtfsPoller } from "@/helpers/gtfsPoller";
import { loadAllGtfsStatic, type GtfsLoadResult } from "@/helpers/gtfsLoader";
import {
  addBusShapesLayer,
  removeBusShapesLayer,
} from "@/layers/busShapesLayer";
import { addBusStopsLayer, removeBusStopsLayer } from "@/layers/busStopsLayer";
import BusOverlay from "@/components/ui/BusOverlay";
import { startOdptTrainsPoller } from "@/data/odptPoller";
import AirQualityLayer from "@/layers/air/AirQualityLayer";
import { PopulationPlugin } from "@/layers/populationPlugin";
import { getStationImportance } from "@/data/populationFake";

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
  const floodRef = useRef<FloodSimulationPlugin | null>(null);
  const styleLoadedRef = useRef(false);
  const trainsRef = useRef<TrainsLayerHandle | null>(null);

  const busesRef = useRef<BusesLayerHandle | null>(null);
  const pollerRef = useRef<{ stop: () => void } | null>(null);

  const gtfsStaticRef = useRef<GtfsLoadResult | null>(null);

  const odptTrainsPollerRef = useRef<{ stop: () => void } | null>(null);

  const railwayDataRef = useRef<any | null>(null);
  const timetablesRef = useRef<any | null>(null);
  const populationRef = useRef<PopulationPlugin | null>(null);

  // ============== State ==============
  const [railwayDataReady, setRailwayDataReady] = useState(false);
  const [config] = useState<MapConfig>(INITIAL_CONFIG);
  const [activeCamera, setActiveCamera] = useState<LivecamData | null>(null);
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);

  const [trainsHandle, setTrainsHandle] = useState<TrainsLayerHandle | null>(
    null,
  );
  const [stationTitles, setStationTitles] = useState<Map<
    string,
    string
  > | null>(null);

  const [busesHandle, setBusesHandle] = useState<BusesLayerHandle | null>(null);

  // ============== Store subscriptions ==============
  const plateauEnabled = useLayersStore((s) => s.enabled.has("plateau"));
  const livecamEnabled = useLayersStore((s) => s.enabled.has("live-cameras"));
  const lightPreset = useClockStore((s) => s.lightPreset);
  const precipitationEnabled = useLayersStore((s) =>
    s.enabled.has("precipitation"),
  );
  const gtfsEnabled = useLayersStore((s) => s.enabled.has("gtfs"));
  const airQualityEnabled = useLayersStore((s) => s.enabled.has("air-quality"));
  const trafficEnabled = useLayersStore((s) => s.enabled.has("traffic"));
  const populationEnabled = useLayersStore((s) => s.enabled.has("population"));
  const svMode = useStreetViewStore((s) => s.mode);
  const setSvPosition = useStreetViewStore((s) => s.setPosition);
  const floodLevel = useFloodStore((s) => s.level);
  const floodScenario = useFloodStore((s) => s.scenario);

  // ============== Helpers ==============
  const getBusCurrentSeconds = () => {
    const state = useClockStore.getState();
    const baseSec =
      state.now.hour() * 3600 + state.now.minute() * 60 + state.now.second();
    if (state.frozen) return baseSec;
    if (state.lastTickAt === 0) return baseSec;
    const elapsedMs = Math.min(performance.now() - state.lastTickAt, 1000);
    return baseSec + elapsedMs / 1000;
  };
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

  const populationPlugin = useMemo(() => new PopulationPlugin(), []);

  // ============== Map initialization ==============
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/standard",
      ...INITIAL_VIEW,
      antialias: true,
    });
    mapRef.current = map;

    plateauRef.current = new PlateauPlugin();
    plateauRef.current.setOnLayerAdded(moveRailwaysToTop);

    livecamRef.current = new LivecamPlugin({
      lang: "en",
      onCameraOpen: (camera) => setActiveCamera(camera),
      onCameraClose: () => setActiveCamera(null),
    });

    populationRef.current = new PopulationPlugin();

    // Đọc lightPreset từ store tại thời điểm init, không từ closure
    const initialLightPreset = useClockStore.getState().lightPreset;
    precipitationRef.current = new PrecipitationPlugin({
      theme: initialLightPreset === "day" ? "light" : "dark",
    });

    floodRef.current = new FloodSimulationPlugin();

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
        const data = await loadRailwayData();
        railwayDataRef.current = data;
        timetablesRef.current = await loadAllTimetables();

        // ODPT poller chạy nền, không tied với toggle
        odptTrainsPollerRef.current = startOdptTrainsPoller({
          consumerKey: import.meta.env.VITE_ODPT_CONSUMER_KEY,
        });

        const titles = new Map<string, string>();
        for (const s of data.stations) {
          titles.set(s.id, s.title?.en ?? s.title?.ja ?? s.id);
        }
        setStationTitles(titles);
        setRailwayDataReady(true);

        const populationStations = data.stations
          .filter((s: any) => Array.isArray(s.coord) && s.coord.length >= 2)
          .map((s: any) => ({
            lon: s.coord[0],
            lat: s.coord[1],
            importance: getStationImportance(s.title?.en ?? s.id),
          }));
        populationRef.current?.setStations(populationStations);
      } catch (err) {
        console.error("Failed to load map data:", err);
      }

      styleLoadedRef.current = true;
      setMapInstance(map);

      const { level: initLevel, scenario: initScenario } =
        useFloodStore.getState();
      floodRef.current?.enable(map);
      floodRef.current?.setLevel(
        computeEffectiveLevel(initLevel, initScenario),
        initLevel > 0,
      );

      const enabledLayers = useLayersStore.getState().enabled;
      if (enabledLayers.has("plateau")) plateauRef.current?.enable(map);
      if (enabledLayers.has("live-cameras")) livecamRef.current?.enable(map);
      if (enabledLayers.has("precipitation"))
        precipitationRef.current?.enable(map);
    });

    return () => {
      // Quan trọng: remove trains TRƯỚC khi map.remove()
      trainsRef.current?.remove();
      trainsRef.current = null;
      setTrainsHandle(null);

      odptTrainsPollerRef.current?.stop();
      odptTrainsPollerRef.current = null;

      plateauRef.current?.disable();
      livecamRef.current?.disable();
      precipitationRef.current?.disable();
      floodRef.current?.disable();
      map.remove();

      // GTFS state
      pollerRef.current?.stop();
      pollerRef.current = null;
      busesRef.current?.remove();
      busesRef.current = null;
      gtfsStaticRef.current = null;

      mapRef.current = null;
      plateauRef.current = null;
      livecamRef.current = null;
      precipitationRef.current = null;
      floodRef.current = null;
      styleLoadedRef.current = false;
      setMapInstance(null);
      setBusesHandle(null);

      // population layer
      populationRef.current?.disable();
      populationRef.current = null;
    };
  }, [onMapLoad, config, moveRailwaysToTop]); // ← chỉ giữ 3 cái stable

  // ============== Traffic toggle (railways + stations + trains) ==============
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoadedRef.current || !railwayDataReady) return;
    const data = railwayDataRef.current;
    const timetables = timetablesRef.current;
    if (!data || !timetables) return;

    if (trafficEnabled) {
      addRailwayLayers({ map, features: data.features, slot: "top" });
      addStationLayers({
        map,
        stations: data.stations,
        railways: data.railways,
        stationGroups: data.stationGroups,
        slot: "top",
      });
      trainsRef.current = startTrainAnimation({
        map,
        timetablesByCalendar: timetables,
        stations: data.stations,
        railways: data.railways,
        features: data.features,
      });
      setTrainsHandle(trainsRef.current);
      moveRailwaysToTop();
    }

    return () => {
      // cleanup khi flip hoặc unmount
      trainsRef.current?.remove();
      trainsRef.current = null;
      setTrainsHandle(null);
      if (mapRef.current) {
        removeStationLayers(mapRef.current);
        removeRailwayLayers(mapRef.current);
      }
    };
  }, [trafficEnabled, railwayDataReady]);
  // ============== Light preset ==============
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoadedRef.current) return;
    try {
      map.setConfigProperty("basemap", "lightPreset", lightPreset);
    } catch {
      // Chỉ Mapbox Standard style mới support
    }
  }, [lightPreset]);

  useEffect(() => {
    precipitationRef.current?.setTheme(
      lightPreset === "day" ? "light" : "dark",
    );
  }, [lightPreset]);

  useEffect(() => {
    if (!styleLoadedRef.current) return;
    const effective = computeEffectiveLevel(floodLevel, floodScenario);
    const active = floodLevel > 0;
    floodRef.current?.setLevel(effective, active);
  }, [floodLevel, floodScenario]);

  // ============== PLATEAU toggle ==============
  useEffect(() => {
    const map = mapRef.current;
    const plugin = plateauRef.current;
    if (!map || !plugin || !styleLoadedRef.current) return;
    if (plateauEnabled) plugin.enable(map);
    else plugin.disable();
  }, [plateauEnabled]);

  // ============== Population toggle ==============
  useEffect(() => {
    const map = mapRef.current;
    const plugin = populationRef.current;
    if (!map || !plugin || !styleLoadedRef.current || !railwayDataReady) return;
    if (populationEnabled) {
      plugin.enable(map, useClockStore.getState().now);
    } else {
      plugin.disable();
    }
  }, [populationEnabled, railwayDataReady]);

  // ============== Population: update theo clock ==============
  useEffect(() => {
    if (!populationEnabled) return;

    let lastUpdateValueMs = 0;
    const THROTTLE_MS = 5 * 60 * 1000; // 5 phút game-time

    // Update ngay lần đầu khi bật
    const initState = useClockStore.getState();
    populationRef.current?.updateTime(initState.now);
    lastUpdateValueMs = initState.now.valueOf();

    let prevFrozenAt = initState.frozenAt?.valueOf() ?? null;
    let prevOffsetMs = initState.offsetMs;

    const unsub = useClockStore.subscribe((state) => {
      const t = state.now.valueOf();
      const curFrozenAt = state.frozenAt?.valueOf() ?? null;

      // Detect "user jumped" — frozenAt thay đổi, hoặc offset thay đổi
      const userJumped =
        curFrozenAt !== prevFrozenAt || state.offsetMs !== prevOffsetMs;

      prevFrozenAt = curFrozenAt;
      prevOffsetMs = state.offsetMs;

      // Update khi: user jump, hoặc realtime đã trôi đủ throttle
      if (userJumped || Math.abs(t - lastUpdateValueMs) >= THROTTLE_MS) {
        lastUpdateValueMs = t;
        populationRef.current?.updateTime(state.now);
      }
    });

    return unsub;
  }, [populationEnabled]);

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

  // ============== Flood: cập nhật mực nước ==============
  useEffect(() => {
    if (!styleLoadedRef.current) return;
    const effective = computeEffectiveLevel(floodLevel, floodScenario);
    const active = floodLevel > 0;
    floodRef.current?.setLevel(effective, active);
  }, [floodLevel, floodScenario]);

  // ============== Flood: cập nhật center theo viewport ==============
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoadedRef.current) return;

    const updateCenter = () => {
      const c = map.getCenter();
      floodRef.current?.setCenter(c.lng, c.lat);
    };
    updateCenter(); // set lần đầu
    map.on("moveend", updateCenter);
    return () => {
      map.off("moveend", updateCenter);
    };
  }, [mapInstance]);

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

  // ============== GTFS toggle ==============
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoadedRef.current) return;

    let cancelled = false;

    const enable = async () => {
      if (!gtfsStaticRef.current) {
        try {
          gtfsStaticRef.current = await loadAllGtfsStatic();
        } catch (err) {
          console.error("[gtfs] static load failed:", err);
          return;
        }
      }
      if (cancelled) return;

      addBusShapesLayer({
        map,
        shapes: gtfsStaticRef.current.shapes,
        slot: "middle",
      });

      addBusStopsLayer({
        map,
        stops: gtfsStaticRef.current.stops,
        slot: "top",
      });

      busesRef.current = addBusesThreeLayer({
        map,
        origin: [139.767, 35.681],
        staticData: gtfsStaticRef.current.staticData,
        getCurrentSeconds: getBusCurrentSeconds,
      });

      setBusesHandle(busesRef.current);

      pollerRef.current = startGtfsPoller({
        consumerKey: import.meta.env.VITE_ODPT_CONSUMER_KEY,
      });
    };

    const disable = () => {
      pollerRef.current?.stop();
      pollerRef.current = null;
      busesRef.current?.remove();
      busesRef.current = null;
      removeBusShapesLayer(map);
      removeBusStopsLayer(map);
      setBusesHandle(null);
    };

    if (gtfsEnabled) {
      enable();
    } else {
      disable();
    }

    return () => {
      cancelled = true;
      // Khi unmount hoặc gtfsEnabled flip: cleanup nếu đang on
      if (gtfsEnabled) disable();
    };
  }, [gtfsEnabled, mapInstance]);

  // ============== Modal handlers ==============
  const handleModalClose = useCallback(() => {
    livecamRef.current?.closeActive();
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

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
      <TrainOverlay
        map={mapInstance}
        trainsHandle={trainsHandle}
        stationTitles={stationTitles ?? undefined}
      />
      <BusOverlay map={mapInstance} busesHandle={busesHandle} />
      <AirQualityLayer map={mapInstance} enabled={airQualityEnabled} />
    </div>
  );
}
