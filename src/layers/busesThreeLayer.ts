// src/layers/busesThreeLayer.ts
import * as THREE from "three";
import type { Map as MapboxMap } from "mapbox-gl";
import mapboxgl from "mapbox-gl";

import { createThreeLayer } from "./ThreeLayer";
import { useBusesStore, getBusInterpolatedState } from "@/stores/busesStore";

const LAYER_ID = "buses-3d";
const MAX_BUSES = 8000;

// Bus nhỏ hơn train
const BUS_LENGTH = 12;
const BUS_WIDTH = 2.5;
const BUS_HEIGHT = 3;

function lngToMercX(lng: number) {
  return (lng + 180) / 360;
}
function latToMercY(lat: number) {
  const sin = Math.sin((lat * Math.PI) / 180);
  return 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
}

export interface AddBusesThreeLayerOptions {
  map: MapboxMap;
  origin: [number, number];
}

export interface BusesLayerHandle {
  remove: () => void;
}

export function addBusesThreeLayer(
  options: AddBusesThreeLayerOptions,
): BusesLayerHandle {
  const { map, origin } = options;

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

      const buses = useBusesStore.getState().buses;
      const now = performance.now();

      const bounds = map.getBounds();
      if (!bounds) {
        mesh.count = 0;
        return;
      }
      const minLng = bounds.getWest();
      const maxLng = bounds.getEast();
      const minLat = bounds.getSouth();
      const maxLat = bounds.getNorth();
      const padLng = (maxLng - minLng) * 0.1;
      const padLat = (maxLat - minLat) * 0.1;

      let writeIdx = 0;
      for (const bus of buses.values()) {
        if (writeIdx >= MAX_BUSES) break;

        const { position, bearing } = getBusInterpolatedState(bus, now);
        const lng = position[0];
        const lat = position[1];

        if (
          lng < minLng - padLng ||
          lng > maxLng + padLng ||
          lat < minLat - padLat ||
          lat > maxLat + padLat
        ) {
          continue;
        }

        const mx = lngToMercX(lng);
        const my = latToMercY(lat);
        const x = (mx - originMercX) * meterPerMercUnit;
        const z = (my - originMercY) * meterPerMercUnit;

        const bi = writeIdx * 3;
        instanceData[bi] = x;
        instanceData[bi + 1] = z;
        instanceData[bi + 2] = -(bearing * Math.PI) / 180;

        const [r, g, b] = cachedRGB(bus.color);
        instanceColors[bi] = r;
        instanceColors[bi + 1] = g;
        instanceColors[bi + 2] = b;

        writeIdx++;
      }

      mesh.count = writeIdx;
      posAttr.needsUpdate = true;
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
  };
}
