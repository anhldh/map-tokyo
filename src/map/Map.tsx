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

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

const RAILWAY_ZOOM_LEVELS = [13, 14, 15, 16, 17, 18] as const;
const RAILWAY_SUFFIXES = ["og", "ug"] as const;

interface MapProps {
  onMapLoad?: (map: mapboxgl.Map) => void;
}

export default function Map({ onMapLoad }: MapProps) {
  // ============== Refs ==============
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const plateauRef = useRef<PlateauPlugin | null>(null);
  const livecamRef = useRef<LivecamPlugin | null>(null);
  const precipitationRef = useRef<PrecipitationPlugin | null>(null);
  const styleLoadedRef = useRef(false);

  // ============== State ==============
  const [config] = useState<MapConfig>(INITIAL_CONFIG);
  const [activeCamera, setActiveCamera] = useState<LivecamData | null>(null);

  // ============== Store subscriptions ==============
  const plateauEnabled = useLayersStore((s) => s.enabled.has("plateau"));
  const livecamEnabled = useLayersStore((s) => s.enabled.has("live-cameras"));
  const lightPreset = useClockStore((s) => s.lightPreset);
  const precipitationEnabled = useLayersStore((s) =>
    s.enabled.has("precipitation"),
  );

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

    // Khởi tạo plugins (chưa enable)
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

    // Style load: setup config, terrain, railways, rồi mới apply layer states
    map.on("style.load", async () => {
      // Light preset & basemap config
      map.setConfigProperty(
        "basemap",
        "lightPreset",
        useClockStore.getState().lightPreset,
      );
      (Object.entries(config) as [keyof MapConfig, any][]).forEach(
        ([key, value]) => map.setConfigProperty("basemap", key, value),
      );

      // Terrain
      map.addSource("mapbox-dem", {
        type: "raster-dem",
        url: "mapbox://mapbox.mapbox-terrain-dem-v1",
        tileSize: 512,
        maxzoom: 14,
      });
      map.setTerrain({ source: "mapbox-dem", exaggeration: 1.2 });

      onMapLoad?.(map);

      // Railways
      try {
        const { railways, stations, features } = await loadRailwayData();
        addRailwayLayers({ map, features, slot: "top" });
        addStationLayers({ map, stations, railways, slot: "top" });
      } catch (err) {
        console.error("Failed to load map data:", err);
      }

      styleLoadedRef.current = true;

      // Apply layer states đã có sẵn trong store (user toggle từ trước khi map load)
      const enabledLayers = useLayersStore.getState().enabled;
      if (enabledLayers.has("plateau")) {
        plateauRef.current?.enable(map);
      }
      if (enabledLayers.has("live-cameras")) {
        livecamRef.current?.enable(map);
      }
      if (enabledLayers.has("precipitation")) {
        precipitationRef.current?.enable(map);
      }
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
    // setActiveCamera sẽ tự được gọi qua onCameraClose callback
  }, [livecamEnabled]);

  // Precipitation toggle
  useEffect(() => {
    const map = mapRef.current;
    const plugin = precipitationRef.current;
    if (!map || !plugin || !styleLoadedRef.current) return;

    if (precipitationEnabled) plugin.enable(map);
    else plugin.disable();
  }, [precipitationEnabled]);

  // Effect cho theme khi lightPreset đổi:
  useEffect(() => {
    precipitationRef.current?.setTheme(
      lightPreset === "day" ? "light" : "dark",
    );
  }, [lightPreset]);

  // ============== Modal handlers ==============
  const handleModalClose = useCallback(() => {
    livecamRef.current?.closeActive();
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
      <LivecamModal
        camera={activeCamera}
        lang="en"
        onClose={handleModalClose}
      />
    </div>
  );
}
