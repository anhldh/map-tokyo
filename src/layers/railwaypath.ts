import type { FeatureCollection, Feature, LineString } from "geojson";

/**
 * Pre-computed sampler cho 1 railway: query (lng, lat, bearing) tại
 * distance d (meters) từ đầu line.
 *
 * Polyline được build bằng cách concat các "section" features
 * theo section index.
 */
export interface RailwayPath {
  railwayId: string;
  coords: [number, number][];
  /** cumDist[i] = quãng đường (meters) từ vertex 0 → vertex i */
  cumDist: Float64Array;
  totalLength: number;
}

const EARTH_RADIUS = 6378137;
const DEG_TO_RAD = Math.PI / 180;

function haversine(a: [number, number], b: [number, number]): number {
  const lat1 = a[1] * DEG_TO_RAD;
  const lat2 = b[1] * DEG_TO_RAD;
  const dLat = (b[1] - a[1]) * DEG_TO_RAD;
  const dLng = (b[0] - a[0]) * DEG_TO_RAD;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(h));
}

function bearingDeg(a: [number, number], b: [number, number]): number {
  const lat1 = a[1] * DEG_TO_RAD;
  const lat2 = b[1] * DEG_TO_RAD;
  const dLng = (b[0] - a[0]) * DEG_TO_RAD;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function buildCumDist(coords: [number, number][]): Float64Array {
  const cumDist = new Float64Array(coords.length);
  for (let i = 1; i < coords.length; i++) {
    cumDist[i] = cumDist[i - 1] + haversine(coords[i - 1], coords[i]);
  }
  return cumDist;
}

// ============================================================================
// Properties shape của features.json (Mini Tokyo)
// ============================================================================

interface RailwayFeatureProps {
  id: string;
  /** "Tokyu.Meguro.8" — railway ID + section index */
  section: string;
  /** Section type: 0 = main overground, 2 = main underground (1 chắc là branch/connector) */
  type: number;
  /** Polyline được pre-render cho 1 zoom level cụ thể */
  zoom: number;
  altitude: number;
  color?: string;
  width?: number;
}

/**
 * Parse "Tokyu.Meguro.8" → { railwayId: "Tokyu.Meguro", index: 8 }
 * Section field cuối cùng là số → index. Còn lại là railway ID.
 */
function parseSection(
  section: string,
): { railwayId: string; index: number } | null {
  const lastDot = section.lastIndexOf(".");
  if (lastDot < 0) return null;
  const indexStr = section.slice(lastDot + 1);
  const index = Number(indexStr);
  if (!Number.isInteger(index)) return null;
  return { railwayId: section.slice(0, lastDot), index };
}

// ============================================================================
// Build map
// ============================================================================

export interface BuildPathMapOptions {
  /** Zoom level dùng để build polyline. Default: 18 (chi tiết nhất) */
  zoom?: number;
  /**
   * Có dùng cả underground sections (type 2) không.
   * Default: true — vì train chạy qua cả tunnel.
   */
  includeUnderground?: boolean;
}

/**
 * Build map từ FeatureCollection. Mỗi railway có thể chia thành nhiều
 * sections — sẽ được concat theo section index thành 1 polyline duy nhất.
 */
export function buildRailwayPathMap(
  features: FeatureCollection,
  options: BuildPathMapOptions = {},
): Map<string, RailwayPath> {
  const { zoom = 18, includeUnderground = true } = options;

  // Group features theo railway ID
  // Group features theo railway ID, dedup theo section (mỗi section chỉ giữ 1 feature)
  const byRailway = new Map<
    string,
    { index: number; coords: [number, number][] }[]
  >();
  const seenSections = new Map<string, number>(); // section → type đã pick

  for (const f of features.features) {
    if (f.geometry?.type !== "LineString") continue;
    const props = f.properties as Partial<RailwayFeatureProps> | null;
    if (!props?.section) continue;

    if (props.zoom !== zoom) continue;
    if (props.type !== 0 && !(includeUnderground && props.type === 2)) continue;

    // Nếu section đã có rồi → skip (tránh nối duplicate giữa OG và UG version)
    // Ưu tiên type 0 (overground) vì thường là feature chính
    const existingType = seenSections.get(props.section);
    if (existingType !== undefined) {
      // Nếu đã pick type 0 → bỏ type 2; nếu đã pick type 2 → ưu tiên type 0 thay thế
      if (existingType === 0 || props.type === 2) continue;
      // existingType === 2 và props.type === 0 → replace
      const parsed = parseSection(props.section);
      if (!parsed) continue;
      const arr = byRailway.get(parsed.railwayId);
      if (arr) {
        const idx = arr.findIndex((s) => s.index === parsed.index);
        if (idx >= 0) {
          arr[idx] = {
            index: parsed.index,
            coords: f.geometry.coordinates.map(
              (c) => [c[0], c[1]] as [number, number],
            ),
          };
        }
      }
      seenSections.set(props.section, 0);
      continue;
    }

    const parsed = parseSection(props.section);
    if (!parsed) continue;

    const coords = f.geometry.coordinates.map(
      (c) => [c[0], c[1]] as [number, number],
    );

    const arr = byRailway.get(parsed.railwayId) ?? [];
    arr.push({ index: parsed.index, coords });
    byRailway.set(parsed.railwayId, arr);
    seenSections.set(props.section, props.type ?? 0);
  }

  // Concat sections theo index
  const map = new Map<string, RailwayPath>();
  for (const [railwayId, sections] of byRailway) {
    sections.sort((a, b) => a.index - b.index);

    // Concat. Vertex cuối của section i thường = vertex đầu của section i+1
    // → bỏ vertex đầu của section sau để tránh duplicate
    const merged: [number, number][] = [];
    for (let i = 0; i < sections.length; i++) {
      const segCoords = sections[i].coords;
      if (i === 0) {
        merged.push(...segCoords);
      } else {
        const prev = merged[merged.length - 1];
        const first = segCoords[0];
        const sameAsPrev =
          prev &&
          Math.abs(prev[0] - first[0]) < 1e-9 &&
          Math.abs(prev[1] - first[1]) < 1e-9;
        merged.push(...(sameAsPrev ? segCoords.slice(1) : segCoords));
      }
    }

    if (merged.length < 2) continue;

    const cumDist = buildCumDist(merged);
    map.set(railwayId, {
      railwayId,
      coords: merged,
      cumDist,
      totalLength: cumDist[cumDist.length - 1],
    });
  }

  return map;
}

// ============================================================================
// Sampling
// ============================================================================

export interface PathSample {
  lng: number;
  lat: number;
  /** degrees, 0=North, clockwise */
  bearing: number;
}

export function samplePath(path: RailwayPath, distance: number): PathSample {
  const { coords, cumDist, totalLength } = path;
  const n = coords.length;
  if (n === 0) return { lng: 0, lat: 0, bearing: 0 };
  if (n === 1) return { lng: coords[0][0], lat: coords[0][1], bearing: 0 };

  if (distance <= 0) {
    return {
      lng: coords[0][0],
      lat: coords[0][1],
      bearing: bearingDeg(coords[0], coords[1]),
    };
  }
  if (distance >= totalLength) {
    return {
      lng: coords[n - 1][0],
      lat: coords[n - 1][1],
      bearing: bearingDeg(coords[n - 2], coords[n - 1]),
    };
  }

  // Binary search
  let lo = 0;
  let hi = n - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cumDist[mid] <= distance) lo = mid;
    else hi = mid;
  }

  const segStart = cumDist[lo];
  const segEnd = cumDist[lo + 1];
  const segLen = segEnd - segStart;
  const t = segLen > 0 ? (distance - segStart) / segLen : 0;

  const a = coords[lo];
  const b = coords[lo + 1];
  return {
    lng: a[0] + (b[0] - a[0]) * t,
    lat: a[1] + (b[1] - a[1]) * t,
    bearing: bearingDeg(a, b),
  };
}

/**
 * Tìm distance từ đầu polyline tới điểm gần nhất với stationCoord.
 * Project vuông góc lên các segment, lấy segment có khoảng cách nhỏ nhất.
 */
export function distanceToStation(
  path: RailwayPath,
  stationCoord: [number, number],
): number {
  const { coords, cumDist } = path;
  const n = coords.length;
  if (n === 0) return 0;
  if (n === 1) return 0;

  let bestDistSq = Infinity;
  let bestDist = 0;

  for (let i = 0; i < n - 1; i++) {
    const a = coords[i];
    const b = coords[i + 1];
    const ax = a[0];
    const ay = a[1];
    const bx = b[0];
    const by = b[1];
    const dx = bx - ax;
    const dy = by - ay;
    const segLenSq = dx * dx + dy * dy;
    if (segLenSq < 1e-20) continue;

    // Project stationCoord lên segment AB, clamp t ∈ [0,1]
    let t =
      ((stationCoord[0] - ax) * dx + (stationCoord[1] - ay) * dy) / segLenSq;
    t = Math.max(0, Math.min(1, t));

    const projX = ax + dx * t;
    const projY = ay + dy * t;
    const distSq =
      (projX - stationCoord[0]) ** 2 + (projY - stationCoord[1]) ** 2;

    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      // Distance dọc polyline = cumDist[i] + (đoạn AB) * t
      const segMeters = cumDist[i + 1] - cumDist[i];
      bestDist = cumDist[i] + segMeters * t;
    }
  }

  return bestDist;
}
