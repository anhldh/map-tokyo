// src/components/map/useKeyboardNavigation.ts
import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { useMapInteractionStore } from "@/stores/mapInteractionStore";

const MOVE_SPEED = 3; // mét/frame — tune theo cảm giác
const ROTATE_SPEED = 0.05;
const PITCH_SPEED = 0.1;

export function useKeyboardNavigation(map: mapboxgl.Map | null) {
  const enabled = useMapInteractionStore((s) => s.keyboardMode);

  const keysRef = useRef<Set<string>>(new Set());
  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number | null>(null);

  const cameraStateRef = useRef({
    lng: 0,
    lat: 0,
    altitude: 0,
    bearing: 0,
    pitch: 60,
  });

  useEffect(() => {
    if (!map || !enabled) return;

    const canvas = map.getCanvas();

    // Snapshot vị trí camera hiện tại — giữ nguyên altitude
    const currentCamera = map.getFreeCameraOptions();
    const currentLngLat = currentCamera.position?.toLngLat();
    const currentAltitude = currentCamera.position?.toAltitude() ?? 0;

    if (!currentLngLat) return;

    cameraStateRef.current = {
      lng: currentLngLat.lng,
      lat: currentLngLat.lat,
      altitude: currentAltitude,
      bearing: map.getBearing(),
      pitch: map.getPitch(),
    };

    map.dragPan.disable();
    map.dragRotate.disable();
    map.scrollZoom.disable();
    map.doubleClickZoom.disable();
    map.touchZoomRotate.disable();
    map.keyboard.disable();

    canvas.style.cursor = "grab";

    const updateCamera = () => {
      const state = cameraStateRef.current;
      const camera = map.getFreeCameraOptions();
      camera.position = mapboxgl.MercatorCoordinate.fromLngLat(
        [state.lng, state.lat],
        state.altitude,
      );
      camera.setPitchBearing(state.pitch, state.bearing);
      map.setFreeCameraOptions(camera);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      keysRef.current.add(e.key.toLowerCase());
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };

    const handleMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      canvas.style.cursor = "grabbing";
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !lastMouseRef.current) return;

      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;

      const state = cameraStateRef.current;
      state.bearing -= dx * ROTATE_SPEED;
      state.pitch = Math.max(0, Math.min(85, state.pitch + dy * PITCH_SPEED));

      updateCamera();
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      lastMouseRef.current = null;
      canvas.style.cursor = "grab";
    };

    const tick = () => {
      const keys = keysRef.current;
      if (keys.size > 0) {
        const state = cameraStateRef.current;
        const rad = (state.bearing * Math.PI) / 180;

        // Vector trên plane ngang — không xét pitch → giữ nguyên altitude
        const forward = { x: Math.sin(rad), y: Math.cos(rad) };
        const right = { x: Math.cos(rad), y: -Math.sin(rad) };

        const metersPerDegreeLat = 111320;
        const metersPerDegreeLng =
          111320 * Math.cos((state.lat * Math.PI) / 180);

        let dLng = 0;
        let dLat = 0;

        if (keys.has("w") || keys.has("arrowup")) {
          dLng += forward.x;
          dLat += forward.y;
        }
        if (keys.has("s") || keys.has("arrowdown")) {
          dLng -= forward.x;
          dLat -= forward.y;
        }
        if (keys.has("d") || keys.has("arrowright")) {
          dLng += right.x;
          dLat += right.y;
        }
        if (keys.has("a") || keys.has("arrowleft")) {
          dLng -= right.x;
          dLat -= right.y;
        }

        state.lng += (dLng * MOVE_SPEED) / metersPerDegreeLng;
        state.lat += (dLat * MOVE_SPEED) / metersPerDegreeLat;
        // Không đụng altitude — giữ nguyên độ cao

        updateCamera();
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    canvas.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      canvas.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);

      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

      map.dragPan.enable();
      map.dragRotate.enable();
      map.scrollZoom.enable();
      map.doubleClickZoom.enable();
      map.touchZoomRotate.enable();
      map.keyboard.enable();

      canvas.style.cursor = "";
      keysRef.current.clear();
    };
  }, [map, enabled]);
}
