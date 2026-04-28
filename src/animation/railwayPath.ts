import type { Feature, FeatureCollection, LineString, Position } from "geojson";

interface RailwayPath {
  /** Mảng tọa độ [lng, lat] của polyline */
  coords: Position[];
  /** Khoảng cách tích lũy (mét) từ điểm đầu polyline đến từng vertex */
  cumulativeDist: number[];
  /** Tổng độ dài polyline (mét) */
  totalLength: number;
}

export interface StationOffset {
  /** Khoảng cách (mét) từ điểm đầu polyline đến station này */
  distance: number;
}

export interface RailwayPathIndex {
  paths: Map<string, RailwayPath>;
  /** railwayId -> stationId -> offset trên path */
  stationOffsets: Map<string, Map<string, StationOffset>>;
}

const R = 6371008.8; // bán kính Trái Đất (m)

/** Haversine — chính xác đủ dùng cho phạm vi nội đô */
function haversine(a: Position, b: Position): number {
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function buildPath(coords: Position[]): RailwayPath {
  const cumulative: number[] = [0];
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversine(coords[i - 1], coords[i]);
    cumulative.push(total);
  }
  return { coords, cumulativeDist: cumulative, totalLength: total };
}

/** Tìm khoảng cách dọc theo polyline tới điểm gần nhất với target */
function projectOnPath(path: RailwayPath, target: Position): number {
  let bestDist = Infinity;
  let bestOffset = 0;

  for (let i = 0; i < path.coords.length - 1; i++) {
    const a = path.coords[i];
    const b = path.coords[i + 1];
    const segLen = path.cumulativeDist[i + 1] - path.cumulativeDist[i];
    if (segLen === 0) continue;

    // Project target lên segment a->b trong không gian lng/lat (đủ chính xác cho nội đô)
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const t = Math.max(
      0,
      Math.min(
        1,
        ((target[0] - a[0]) * dx + (target[1] - a[1]) * dy) /
          (dx * dx + dy * dy),
      ),
    );
    const projLng = a[0] + t * dx;
    const projLat = a[1] + t * dy;
    const d = haversine([projLng, projLat], target);

    if (d < bestDist) {
      bestDist = d;
      bestOffset = path.cumulativeDist[i] + t * segLen;
    }
  }

  return bestOffset;
}

/** Sample 1 điểm trên polyline tại offset (mét), trả về [lng, lat, bearing] */
export function sampleAtDistance(
  path: RailwayPath,
  distance: number,
): { position: [number, number]; bearing: number } {
  const d = Math.max(0, Math.min(path.totalLength, distance));

  // Binary search vertex bao quanh d
  let lo = 0;
  let hi = path.cumulativeDist.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (path.cumulativeDist[mid] <= d) lo = mid;
    else hi = mid;
  }

  const segLen = path.cumulativeDist[hi] - path.cumulativeDist[lo];
  const t = segLen > 0 ? (d - path.cumulativeDist[lo]) / segLen : 0;
  const a = path.coords[lo];
  const b = path.coords[hi];

  const lng = a[0] + t * (b[0] - a[0]);
  const lat = a[1] + t * (b[1] - a[1]);

  // Bearing tính từ segment hiện tại
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;

  return { position: [lng, lat], bearing };
}

export function buildRailwayPathIndex(
  features: FeatureCollection,
  stationsById: Map<
    string,
    { id: string; railway: string; coord: [number, number] }
  >,
): RailwayPathIndex {
  const paths = new Map<string, RailwayPath>();

  // Group: railwayId -> sectionIndex -> { coords, zoom }
  // Cần group theo section vì 1 railway có thể có nhiều sections (đoạn 0, 1, 2...)
  // và nhiều zoom level cho cùng 1 section. Pick zoom cao nhất cho mỗi section.
  const sectionsByRailway = new Map<
    string,
    Map<number, { coords: Position[]; zoom: number }>
  >();

  for (const feat of features.features) {
    if (feat.geometry?.type !== "LineString") continue;
    const props = feat.properties ?? {};
    const fullId = props.id as string | undefined;
    if (!fullId) continue;

    // Parse: "ShonanMonorail.ShonanMonorail.og.13.8.0"
    //         └─railway─┘  └─railway─┘ ┴og ┴zoom ┴section ┴variant
    const parts = fullId.split(".");
    if (parts.length < 6) continue;

    // Tìm vị trí "og" hoặc "ug" để xác định ranh giới railwayId
    const ogIdx = parts.findIndex((p) => p === "og" || p === "ug");
    if (ogIdx < 2) continue;

    const railwayId = parts.slice(0, ogIdx).join(".");
    const zoom = Number(parts[ogIdx + 1]);
    const sectionIdx = Number(parts[ogIdx + 2]);
    if (Number.isNaN(zoom) || Number.isNaN(sectionIdx)) continue;

    // Type 0 = above ground, 2 = above ground (parent layer in Mapbox theo code cũ?)
    const type = typeof props.type === "number" ? props.type : 0;
    if (type !== 0 && type !== 2) continue;

    let sections = sectionsByRailway.get(railwayId);
    if (!sections) {
      sections = new Map();
      sectionsByRailway.set(railwayId, sections);
    }

    const existing = sections.get(sectionIdx);
    // Pick zoom cao nhất cho mỗi section
    if (!existing || zoom > existing.zoom) {
      sections.set(sectionIdx, { coords: feat.geometry.coordinates, zoom });
    }
  }

  //   console.log(
  //     "[buildRailwayPathIndex] railways found:",
  //     sectionsByRailway.size,
  //   );
  //   console.log(
  //     "[buildRailwayPathIndex] sample IDs:",
  //     Array.from(sectionsByRailway.keys()).slice(0, 10),
  //   );

  // Merge các sections của mỗi railway thành 1 polyline liên tục
  for (const [railwayId, sections] of sectionsByRailway) {
    // Sort theo sectionIdx để các đoạn nối tiếp đúng thứ tự
    const orderedSegments = Array.from(sections.entries())
      .sort(([a], [b]) => a - b)
      .map(([, v]) => v.coords);

    const merged = mergeSegments(orderedSegments);
    if (merged.length < 2) continue;
    paths.set(railwayId, buildPath(merged));
  }

  // Index station offsets
  const stationOffsets = new Map<string, Map<string, StationOffset>>();
  for (const station of stationsById.values()) {
    const path = paths.get(station.railway);
    if (!path) continue;

    let map = stationOffsets.get(station.railway);
    if (!map) {
      map = new Map();
      stationOffsets.set(station.railway, map);
    }
    map.set(station.id, { distance: projectOnPath(path, station.coord) });
  }

  //   console.log("[buildRailwayPathIndex] paths built:", paths.size);
  //   console.log(
  //     "[buildRailwayPathIndex] sample station offsets:",
  //     Array.from(stationOffsets.entries())
  //       .slice(0, 2)
  //       .map(([rId, m]) => ({
  //         railway: rId,
  //         stations: Array.from(m.entries())
  //           .slice(0, 4)
  //           .map(([sid, o]) => ({
  //             s: sid.split(".").pop(),
  //             d: o.distance.toFixed(0),
  //           })),
  //       })),
  //   );

  return { paths, stationOffsets };
}

/** Nối các LineString segment thành 1 polyline liên tục bằng cách match endpoint */
function mergeSegments(segments: Position[][]): Position[] {
  if (segments.length === 0) return [];
  if (segments.length === 1) return segments[0];

  const remaining = segments.slice();
  const merged = remaining.shift()!.slice();
  const eps = 1e-7; // ~1cm

  const same = (a: Position, b: Position) =>
    Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps;

  let progress = true;
  while (remaining.length > 0 && progress) {
    progress = false;
    for (let i = 0; i < remaining.length; i++) {
      const seg = remaining[i];
      const head = merged[0];
      const tail = merged[merged.length - 1];

      if (same(tail, seg[0])) {
        merged.push(...seg.slice(1));
        remaining.splice(i, 1);
        progress = true;
        break;
      } else if (same(tail, seg[seg.length - 1])) {
        for (let j = seg.length - 2; j >= 0; j--) merged.push(seg[j]);
        remaining.splice(i, 1);
        progress = true;
        break;
      } else if (same(head, seg[seg.length - 1])) {
        merged.unshift(...seg.slice(0, -1));
        remaining.splice(i, 1);
        progress = true;
        break;
      } else if (same(head, seg[0])) {
        for (let j = 1; j < seg.length; j++) merged.unshift(seg[j]);
        remaining.splice(i, 1);
        progress = true;
        break;
      }
    }
  }

  return merged;
}
