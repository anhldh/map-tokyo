// src/layers/busesThreeLayer.ts
import * as THREE from "three";
import type { Map as MapboxMap } from "mapbox-gl";
import mapboxgl from "mapbox-gl";

import { createThreeLayer } from "./ThreeLayer";
import {
  getActiveBuses,
  type ActiveBus,
  type BusDelayLookup,
} from "@/helpers/busPositions";
import type { GtfsStaticData } from "@/helpers/gtfsStatic";
import { useBusVehiclesStore } from "@/stores/busVehiclesStore";

const LAYER_ID = "buses-3d";
const MAX_BUSES = 6000;

const BUS_LENGTH = 100;
const BUS_WIDTH = 40;
const BUS_HEIGHT = 40;
const EARTH_RADIUS = 6371008.8;

function lngToMercX(lng: number) {
  return (lng + 180) / 360;
}
function latToMercY(lat: number) {
  const sin = Math.sin((lat * Math.PI) / 180);
  return 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
}

export interface BusPickResult {
  tripId: string;
  agencyId: string;
  vehicleId?: string;
  color: string;
  position: [number, number];
  bearing: number;
  routeId: string;
  routeShortName?: string;
  routeLongName?: string;
  headsign?: string;
  state: "standing" | "moving";
  segmentIndex: number;
  segmentProgress: number;
  delay: number;
}

export interface AddBusesThreeLayerOptions {
  map: MapboxMap;
  origin: [number, number];
  staticData: Map<string, GtfsStaticData>;
  getCurrentSeconds: () => number;
  /** Optional: lookup delay theo tripId (sẽ wire ở Bước 3) */
  getDelay?: BusDelayLookup;
}

export interface BusesLayerHandle {
  remove: () => void;
  pickAt: (point: { x: number; y: number }) => BusPickResult | null;
}

export function addBusesThreeLayer(
  options: AddBusesThreeLayerOptions,
): BusesLayerHandle {
  const { map, origin, staticData, getCurrentSeconds, getDelay } = options;

  const originMerc = mapboxgl.MercatorCoordinate.fromLngLat(origin, 0);
  const meterPerMercUnit = 1 / originMerc.meterInMercatorCoordinateUnits();
  const originMercX = originMerc.x;
  const originMercY = originMerc.y;

  const instanceData = new Float32Array(MAX_BUSES * 3);
  const instanceColors = new Float32Array(MAX_BUSES * 3);

  const colorCache = new Map<string, [number, number, number]>();
  const tmpColor = new THREE.Color();
  const cachedRGB = (hex: string): [number, number, number] => {
    let c = colorCache.get(hex);
    if (!c) {
      tmpColor.set(hex);
      c = [tmpColor.r, tmpColor.g, tmpColor.b];
      colorCache.set(hex, c);
    }
    return c;
  };

  let mesh: THREE.InstancedMesh | null = null;
  let posAttr: THREE.InstancedBufferAttribute | null = null;
  let colorAttr: THREE.InstancedBufferAttribute | null = null;
  let lastActive: ActiveBus[] = [];

  const layer = createThreeLayer({
    id: LAYER_ID,
    origin,

    onInit({ scene }) {
      const geometry = new THREE.BoxGeometry(BUS_WIDTH, BUS_HEIGHT, BUS_LENGTH);
      geometry.translate(0, BUS_HEIGHT / 2, 0);

      posAttr = new THREE.InstancedBufferAttribute(instanceData, 3);
      posAttr.setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute("instancePos", posAttr);

      colorAttr = new THREE.InstancedBufferAttribute(instanceColors, 3);
      colorAttr.setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute("instanceColor", colorAttr);

      const material = new THREE.ShaderMaterial({
        vertexShader: `
          attribute vec3 instancePos;
          attribute vec3 instanceColor;
          varying vec3 vColor;
          void main() {
            float c = cos(instancePos.z);
            float s = sin(instancePos.z);
            vec3 pos = position;
            float rx = pos.x * c + pos.z * s;
            float rz = -pos.x * s + pos.z * c;
            pos.x = rx;
            pos.z = rz;
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

      mesh = new THREE.InstancedMesh(geometry, material, MAX_BUSES);
      mesh.count = 0;
      mesh.frustumCulled = false;
      scene.add(mesh);
    },

    onRender() {
      if (!mesh || !posAttr || !colorAttr) return;

      const currentSeconds = getCurrentSeconds();
      const active = getActiveBuses(staticData, currentSeconds, getDelay);
      lastActive = active;

      const count = Math.min(active.length, MAX_BUSES);
      for (let i = 0; i < count; i++) {
        const bus = active[i];
        const mx = lngToMercX(bus.position[0]);
        const my = latToMercY(bus.position[1]);
        const x = (mx - originMercX) * meterPerMercUnit;
        const z = (my - originMercY) * meterPerMercUnit;

        const bi = i * 3;
        instanceData[bi] = x;
        instanceData[bi + 1] = z;
        instanceData[bi + 2] = -(bus.bearing * Math.PI) / 180;

        const [r, g, b] = cachedRGB(bus.color);
        instanceColors[bi] = r;
        instanceColors[bi + 1] = g;
        instanceColors[bi + 2] = b;
      }

      mesh.count = count;
      posAttr.addUpdateRange(0, count * 3);
      posAttr.needsUpdate = true;
      colorAttr.addUpdateRange(0, count * 3);
      colorAttr.needsUpdate = true;
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
      if (!mesh) return null;
      let lngLat: mapboxgl.LngLat;
      try {
        if (!map.getCanvas()) return null;
        lngLat = map.unproject([x, y]);
      } catch {
        return null;
      }

      const zoom = map.getZoom();
      const thresholdMeters = Math.max(20, 600 / Math.pow(2, zoom - 12));

      let bestIdx = -1;
      let bestDist = Infinity;
      for (let i = 0; i < lastActive.length; i++) {
        const bus = lastActive[i];
        const d = haversineDistance([lngLat.lng, lngLat.lat], bus.position);
        if (d < thresholdMeters && d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      if (bestIdx === -1) return null;

      const bus = lastActive[bestIdx];
      const data = staticData.get(bus.agencyId);
      const route = data?.routes.get(bus.timetable.routeId);
      const trip = data?.trips.get(bus.timetable.tripId);

      return {
        tripId: bus.timetable.tripId,
        agencyId: bus.agencyId,
        vehicleId: useBusVehiclesStore
          .getState()
          .tripToVehicle.get(bus.timetable.tripId),
        color: bus.color,
        position: bus.position,
        bearing: bus.bearing,
        routeId: bus.timetable.routeId,
        routeShortName: route?.shortName,
        routeLongName: route?.longName,
        headsign: trip?.headsign,
        state: bus.state,
        segmentIndex: bus.segmentIndex,
        segmentProgress: bus.segmentProgress,
        delay: bus.delay,
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
