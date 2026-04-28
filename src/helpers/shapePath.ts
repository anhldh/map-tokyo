// src/helpers/shapePath.ts
import type { GtfsShape } from "./gtfsStatic";

export interface ShapePath {
  coords: [number, number][];
  /** Cumulative distance (mét) tại mỗi vertex, cùng length với coords */
  distances: number[];
  totalLength: number;
}

export interface ShapePathIndex {
  paths: Map<string, ShapePath>;
}

const EARTH_RADIUS = 6371008.8;

function haversine(a: [number, number], b: [number, number]): number {
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(h));
}

export function buildShapePathIndex(
  shapes: Map<string, GtfsShape>,
): ShapePathIndex {
  const paths = new Map<string, ShapePath>();
  for (const [id, shape] of shapes) {
    if (shape.coords.length < 2) continue;
    const distances: number[] = [0];
    let total = 0;
    for (let i = 1; i < shape.coords.length; i++) {
      total += haversine(shape.coords[i - 1], shape.coords[i]);
      distances.push(total);
    }
    paths.set(id, {
      coords: shape.coords,
      distances,
      totalLength: total,
    });
  }
  return { paths };
}

/** Sample point + bearing tại distance X dọc shape */
export function sampleShapeAtDistance(
  path: ShapePath,
  distance: number,
): { position: [number, number]; bearing: number } {
  const { coords, distances, totalLength } = path;
  const d = Math.max(0, Math.min(distance, totalLength));

  // Binary search: tìm i sao cho distances[i] <= d <= distances[i+1]
  let lo = 0;
  let hi = distances.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (distances[mid] <= d) lo = mid;
    else hi = mid;
  }

  const dA = distances[lo];
  const dB = distances[hi];
  const t = dB === dA ? 0 : (d - dA) / (dB - dA);
  const a = coords[lo];
  const b = coords[hi];
  const lng = a[0] + t * (b[0] - a[0]);
  const lat = a[1] + t * (b[1] - a[1]);

  // Bearing từ A → B
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;

  return { position: [lng, lat], bearing };
}

/**
 * Project 1 stop coord lên shape, trả về cumulative distance.
 * `searchFromIdx` đảm bảo monotonic (stop sau không ở trước stop trước trên shape).
 * Dùng lng/lat space để project — đủ chính xác cho bus.
 */
export function projectStopOnShape(
  stopCoord: [number, number],
  path: ShapePath,
  searchFromIdx: number = 0,
): { distance: number; vertexIdx: number } {
  let bestDistSq = Infinity;
  let bestOffset = 0;
  let bestIdx = searchFromIdx;

  for (let i = searchFromIdx; i < path.coords.length - 1; i++) {
    const a = path.coords[i];
    const b = path.coords[i + 1];
    const abx = b[0] - a[0];
    const aby = b[1] - a[1];
    const apx = stopCoord[0] - a[0];
    const apy = stopCoord[1] - a[1];
    const lenSq = abx * abx + aby * aby;
    let t = lenSq > 0 ? (apx * abx + apy * aby) / lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    const projX = a[0] + t * abx;
    const projY = a[1] + t * aby;
    const dx = stopCoord[0] - projX;
    const dy = stopCoord[1] - projY;
    const distSq = dx * dx + dy * dy;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      const segLen = path.distances[i + 1] - path.distances[i];
      bestOffset = path.distances[i] + segLen * t;
      bestIdx = i;
    }
  }

  return { distance: bestOffset, vertexIdx: bestIdx };
}
