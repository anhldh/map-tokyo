import * as THREE from "three";
import type { Map as MapboxMap } from "mapbox-gl";
import mapboxgl from "mapbox-gl";
import type { FeatureCollection } from "geojson";

import { createThreeLayer } from "./ThreeLayer";
import { getActiveTrains, type ActiveTrain } from "@/animation/trainPositions";
import { buildRailwayPathIndex } from "@/animation/railwayPath";
import type { Railway, Station } from "@/helpers/loadRailwayData";
import type { TrainTimetable, CalendarType } from "@/helpers/timetable";
import { useClockStore } from "@/stores/clockStore";
import {
  makeRealtimeKey,
  useTrainsRealtimeStore,
} from "@/stores/trainsRealtimeStore";

const LAYER_ID = "trains-3d";
const MAX_TRAINS = 8000; // bumped cho GTFS sau này

const CAR_LENGTH = 150;
const CAR_WIDTH = 60;
const CAR_HEIGHT = 60;
const EARTH_RADIUS = 6371008.8;

// Inline Mercator (web mercator). Không tạo object.
function lngToMercX(lng: number): number {
  return (lng + 180) / 360;
}
function latToMercY(lat: number): number {
  const sin = Math.sin((lat * Math.PI) / 180);
  return 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
}

export interface TrainPickResult {
  // ... giữ nguyên như cũ
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
  segmentProgress: number;
  schedule: {
    stationId: string;
    arrival?: number;
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

  const stationsById = new Map(stations.map((s) => [s.id, s]));
  const railwayById = new Map(railways.map((r) => [r.id, r]));
  const pathIndex = buildRailwayPathIndex(features, stationsById);

  // Origin Mercator → mét
  const originMerc = mapboxgl.MercatorCoordinate.fromLngLat(origin, 0);
  const meterPerMercUnit = 1 / originMerc.meterInMercatorCoordinateUnits();
  const originMercX = originMerc.x;
  const originMercY = originMerc.y;

  // GPU buffers
  const instanceData = new Float32Array(MAX_TRAINS * 3); // x, z, bearing
  const instanceColors = new Float32Array(MAX_TRAINS * 3); // r, g, b

  let mesh: THREE.InstancedMesh | null = null;
  let instancePosAttr: THREE.InstancedBufferAttribute | null = null;
  let instanceColorAttr: THREE.InstancedBufferAttribute | null = null;
  let lastActive: ActiveTrain[] = [];

  // Reuse helper
  const tmpColor = new THREE.Color();

  const colorCache = new Map<string, [number, number, number]>();
  const getRailwayColorRGB = (railwayId: string): [number, number, number] => {
    let c = colorCache.get(railwayId);
    if (!c) {
      const railway = railwayById.get(railwayId);
      tmpColor.set(railway?.color ?? "#ffffff");
      c = [tmpColor.r, tmpColor.g, tmpColor.b];
      colorCache.set(railwayId, c);
    }
    return c;
  };

  const layer = createThreeLayer({
    id: LAYER_ID,
    origin,

    onInit({ scene }) {
      const geometry = new THREE.BoxGeometry(CAR_WIDTH, CAR_HEIGHT, CAR_LENGTH);
      geometry.translate(0, CAR_HEIGHT / 2, 0);

      // Custom attributes
      instancePosAttr = new THREE.InstancedBufferAttribute(instanceData, 3);
      instancePosAttr.setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute("instancePos", instancePosAttr);

      instanceColorAttr = new THREE.InstancedBufferAttribute(instanceColors, 3);
      instanceColorAttr.setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute("instanceColor", instanceColorAttr);

      // Custom shader material — vertex shader tự xoay/translate theo instancePos
      const material = new THREE.ShaderMaterial({
        vertexShader: `
          attribute vec3 instancePos;   // x, z, bearing(rad)
          attribute vec3 instanceColor;
          varying vec3 vColor;

          void main() {
            // Xoay quanh trục Y
            float c = cos(instancePos.z);
            float s = sin(instancePos.z);
            vec3 pos = position;
            float rx = pos.x * c + pos.z * s;
            float rz = -pos.x * s + pos.z * c;
            pos.x = rx;
            pos.z = rz;

            // Translate
            pos.x += instancePos.x;
            pos.z += instancePos.y;

            vColor = instanceColor;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vColor;
          void main() {
            gl_FragColor = vec4(vColor, 1.0);
          }
        `,
      });

      // InstancedMesh chỉ dùng để control count, matrix không quan trọng
      mesh = new THREE.InstancedMesh(geometry, material, MAX_TRAINS);
      mesh.count = 0;
      mesh.frustumCulled = false;
      scene.add(mesh);
    },

    // onRender() {
    //   if (!mesh || !instancePosAttr || !instanceColorAttr) return;

    //   const calendar = getCurrentCalendar();
    //   const timetables = timetablesByCalendar[calendar];
    //   if (!timetables) {
    //     mesh.count = 0;
    //     return;
    //   }

    //   // Chỉ dùng realtime delay khi KHÔNG ở simulation mode
    //   const clock = useClockStore.getState();
    //   const isSimulating = clock.frozen || clock.offsetMs !== 0;
    //   const realtimeEntries = isSimulating
    //     ? null
    //     : useTrainsRealtimeStore.getState().entries;

    //   const currentSeconds = getCurrentSeconds();

    //   const active = getActiveTrains(
    //     timetables,
    //     currentSeconds,
    //     stationsById,
    //     pathIndex,
    //     // Truyền delay lookup vào — nếu null thì getActiveTrains coi delay = 0
    //     realtimeEntries
    //       ? (railway, trainNumber) => {
    //           const key = makeRealtimeKey(railway, trainNumber);
    //           return realtimeEntries.get(key)?.delay ?? 0;
    //         }
    //       : undefined,
    //   );

    //   lastActive = active;

    //   //  Frustum culling theo viewport
    //   const bounds = map.getBounds();
    //   if (!bounds) {
    //     mesh.count = 0;
    //     return;
    //   }
    //   const minLng = bounds.getWest();
    //   const maxLng = bounds.getEast();
    //   const minLat = bounds.getSouth();
    //   const maxLat = bounds.getNorth();
    //   // Padding để tàu không pop in/out ở edge khi pan
    //   const padLng = (maxLng - minLng) * 0.1;
    //   const padLat = (maxLat - minLat) * 0.1;

    //   let writeIdx = 0;
    //   for (let i = 0; i < active.length && writeIdx < MAX_TRAINS; i++) {
    //     const train = active[i];
    //     const lng = train.position[0];
    //     const lat = train.position[1];

    //     // Cull
    //     if (
    //       lng < minLng - padLng ||
    //       lng > maxLng + padLng ||
    //       lat < minLat - padLat ||
    //       lat > maxLat + padLat
    //     ) {
    //       continue;
    //     }

    //     const mx = lngToMercX(lng);
    //     const my = latToMercY(lat);
    //     const x = (mx - originMercX) * meterPerMercUnit;
    //     const z = (my - originMercY) * meterPerMercUnit;

    //     const bi = writeIdx * 3;
    //     instanceData[bi] = x;
    //     instanceData[bi + 1] = z;
    //     instanceData[bi + 2] = -(train.bearing * Math.PI) / 180;

    //     const [r, g, b] = getRailwayColorRGB(train.timetable.railway);
    //     instanceColors[bi] = r;
    //     instanceColors[bi + 1] = g;
    //     instanceColors[bi + 2] = b;

    //     writeIdx++;
    //   }

    //   mesh.count = writeIdx;
    //   instancePosAttr.addUpdateRange(0, writeIdx * 3);
    //   instancePosAttr.needsUpdate = true;
    //   instanceColorAttr.addUpdateRange(0, writeIdx * 3);
    //   instanceColorAttr.needsUpdate = true;
    // },
    onRender() {
      if (!mesh || !instancePosAttr || !instanceColorAttr) return;

      const calendar = getCurrentCalendar();
      const timetables = timetablesByCalendar[calendar];
      if (!timetables) {
        mesh.count = 0;
        return;
      }

      const clock = useClockStore.getState();
      const isSimulating = clock.frozen || clock.offsetMs !== 0;
      const realtimeEntries = isSimulating
        ? null
        : useTrainsRealtimeStore.getState().entries;

      const currentSeconds = getCurrentSeconds();

      const active = getActiveTrains(
        timetables,
        currentSeconds,
        stationsById,
        pathIndex,
        realtimeEntries
          ? (railway, trainNumber) => {
              const key = makeRealtimeKey(railway, trainNumber);
              return realtimeEntries.get(key)?.delay ?? 0;
            }
          : undefined,
      );

      lastActive = active;

      const count = Math.min(active.length, MAX_TRAINS);
      for (let i = 0; i < count; i++) {
        const train = active[i];
        const mx = lngToMercX(train.position[0]);
        const my = latToMercY(train.position[1]);
        const x = (mx - originMercX) * meterPerMercUnit;
        const z = (my - originMercY) * meterPerMercUnit;

        const bi = i * 3;
        instanceData[bi] = x;
        instanceData[bi + 1] = z;
        instanceData[bi + 2] = -(train.bearing * Math.PI) / 180;

        const [r, g, b] = getRailwayColorRGB(train.timetable.railway);
        instanceColors[bi] = r;
        instanceColors[bi + 1] = g;
        instanceColors[bi + 2] = b;
      }

      mesh.count = count;
      instancePosAttr.addUpdateRange(0, count * 3);
      instancePosAttr.needsUpdate = true;
      instanceColorAttr.addUpdateRange(0, count * 3);
      instanceColorAttr.needsUpdate = true;
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
        /* empty */
      }
    },

    pickAt({ x, y }) {
      // ... giữ nguyên logic cũ
      if (!mesh) return null;
      let lngLat: mapboxgl.LngLat;
      try {
        if (!map.getCanvas()) return null;
        lngLat = map.unproject([x, y]);
      } catch {
        return null;
      }

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
