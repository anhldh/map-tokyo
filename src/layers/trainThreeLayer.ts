import * as THREE from "three";
import type { Map as MapboxMap } from "mapbox-gl";
import type { FeatureCollection } from "geojson";
import mapboxgl from "mapbox-gl";
import { createThreeLayer } from "./ThreeLayer";
import type { Railway, Station } from "@/helpers/loadRailwayData";
import type { CalendarType, TrainTimetable } from "@/helpers/timetable";
import { getActiveTrains, type ActiveTrain } from "@/animation/trainPositions";
import { buildRailwayPathIndex } from "@/animation/railwayPath";

const LAYER_ID = "trains-3d";
const MAX_TRAINS = 4000;

// Kích thước "toa" tàu theo mét
const CAR_LENGTH = 150;
const CAR_WIDTH = 60;
const CAR_HEIGHT = 60;

const EARTH_RADIUS = 6371008.8;

export interface TrainPickResult {
  trainId: string;
  trainNumber: string;
  railwayId: string;
  railwayTitle?: string;
  railwayColor: string;
  trainType: string;
  direction: string;
  origins?: string[];
  destinations?: string[];
  fromStation: string;
  toStation?: string;
  state: "standing" | "moving";
  position: [number, number];
  segmentIndex: number;
  segmentProgress: number; // 0..1, có ý nghĩa khi state = "moving"
  schedule: {
    stationId: string;
    arrival?: number; // seconds from 00:00
    departure?: number;
  }[];
}

export interface AddTrainsThreeLayerOptions {
  map: MapboxMap;
  origin: [number, number];
  timetablesByCalendar: Record<CalendarType, TrainTimetable[]>;
  stations: Station[];
  railways: Railway[];
  features: FeatureCollection;
  getCurrentSeconds: () => number;
  getCurrentCalendar: () => CalendarType;
}

export interface TrainsLayerHandle {
  remove: () => void;
  pickAt: (point: { x: number; y: number }) => TrainPickResult | null;
}

export function addTrainsThreeLayer(
  options: AddTrainsThreeLayerOptions,
): TrainsLayerHandle {
  const {
    map,
    origin,
    timetablesByCalendar,
    stations,
    railways,
    features,
    getCurrentSeconds,
    getCurrentCalendar,
  } = options;

  // ----- Pre-computed lookup -----
  const stationsById = new Map(stations.map((s) => [s.id, s]));
  const railwayById = new Map(railways.map((r) => [r.id, r]));
  const pathIndex = buildRailwayPathIndex(features, stationsById);

  // Origin Mercator để chuyển lng/lat -> mét trong local frame của ThreeLayer
  const originMerc = mapboxgl.MercatorCoordinate.fromLngLat(origin, 0);
  const meterPerMercUnit = 1 / originMerc.meterInMercatorCoordinateUnits();

  // Reusable, tránh GC pressure mỗi frame
  const dummy = new THREE.Object3D();
  const colorObj = new THREE.Color();

  let mesh: THREE.InstancedMesh | null = null;
  let lastActive: ActiveTrain[] = [];

  // ----- Layer registration -----
  const layer = createThreeLayer({
    id: LAYER_ID,
    origin,

    onInit({ scene }) {
      const geometry = new THREE.BoxGeometry(CAR_WIDTH, CAR_HEIGHT, CAR_LENGTH);
      geometry.translate(0, CAR_HEIGHT / 2, 0); // đáy nằm ở y=0

      const material = new THREE.MeshBasicMaterial({ vertexColors: false });

      mesh = new THREE.InstancedMesh(geometry, material, MAX_TRAINS);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0;
      mesh.frustumCulled = false; // tàu có thể spawn xa origin
      scene.add(mesh);
    },

    onRender() {
      if (!mesh) return;

      const calendar = getCurrentCalendar();
      const timetables = timetablesByCalendar[calendar];
      if (!timetables) {
        mesh.count = 0;
        return;
      }

      const active = getActiveTrains(
        timetables,
        getCurrentSeconds(),
        stationsById,
        pathIndex,
      );
      lastActive = active;

      const count = Math.min(active.length, MAX_TRAINS);

      for (let i = 0; i < count; i++) {
        const train = active[i];

        // lng/lat -> Mercator -> mét trong local frame
        const merc = mapboxgl.MercatorCoordinate.fromLngLat(
          { lng: train.position[0], lat: train.position[1] },
          0,
        );
        const x = (merc.x - originMerc.x) * meterPerMercUnit;
        const z = (merc.y - originMerc.y) * meterPerMercUnit;

        dummy.position.set(x, 0, z);
        dummy.rotation.set(0, -(train.bearing * Math.PI) / 180, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);

        const railway = railwayById.get(train.timetable.railway);
        colorObj.set(railway?.color ?? "#ffffff");
        mesh.setColorAt(i, colorObj);
      }

      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
  });

  map.addLayer(layer);

  return {
    remove() {
      try {
        if (map.getStyle() && map.getLayer(LAYER_ID)) {
          map.removeLayer(LAYER_ID);
        }
      } catch {
        // map đã bị tear down — bỏ qua
      }
    },

    pickAt({ x, y }) {
      if (!mesh) return null;

      let lngLat: mapboxgl.LngLat;
      try {
        if (!map.getCanvas()) return null;
        lngLat = map.unproject([x, y]);
      } catch {
        return null;
      }

      // Threshold scale theo zoom: zoom cao -> threshold nhỏ (click chính xác hơn)
      const zoom = map.getZoom();
      const thresholdMeters = Math.max(30, 800 / Math.pow(2, zoom - 12));

      let bestIdx = -1;
      let bestDist = Infinity;
      for (let i = 0; i < lastActive.length; i++) {
        const train = lastActive[i];
        const d = haversineDistance([lngLat.lng, lngLat.lat], train.position);
        if (d < thresholdMeters && d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      if (bestIdx === -1) return null;

      const train = lastActive[bestIdx];
      const tt = train.timetable;
      const railway = railwayById.get(tt.railway);

      return {
        trainId: tt.trainId,
        trainNumber: tt.trainNumber,
        railwayId: tt.railway,
        railwayTitle: railway?.title?.en ?? railway?.title?.ja,
        railwayColor: railway?.color ?? "#ffffff",
        trainType: tt.trainType,
        direction: tt.direction,
        origins: tt.origins,
        destinations: tt.destinations,
        fromStation: tt.stations[train.segmentIndex],
        toStation: tt.stations[train.segmentIndex + 1],
        state: train.state,
        position: train.position,
        segmentIndex: train.segmentIndex,
        segmentProgress: train.segmentProgress,
        schedule: tt.stations.map((sid, idx) => ({
          stationId: sid,
          arrival: tt.arrivals[idx],
          departure: tt.departures[idx],
        })),
      };
    },
  };
}

function haversineDistance(a: [number, number], b: [number, number]): number {
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(h));
}
