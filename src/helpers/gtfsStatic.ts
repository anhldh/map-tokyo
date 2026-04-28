// src/data/gtfsStatic.ts
import JSZip from "jszip";
import {
  buildShapePathIndex,
  projectStopOnShape,
  type ShapePathIndex,
} from "./shapePath";

export interface BusTimetable {
  tripId: string;
  routeId: string;
  shapeId?: string;
  serviceId?: string;
  stops: string[];
  /** Seconds since midnight; -1 nếu thiếu data */
  arrivals: number[];
  departures: number[];
  /** Cumulative distance trên shape tại mỗi stop (mét); -1 nếu không tính được */
  stopOffsets: number[];
  /** First valid time across arrivals/departures */
  start: number;
  end: number;
}

export interface GtfsRoute {
  id: string;
  shortName?: string;
  longName?: string;
  color?: string;
  textColor?: string;
}

export interface GtfsStop {
  id: string;
  name: string;
  coord: [number, number];
}

export interface GtfsShape {
  id: string;
  /** Polyline tọa độ [lng, lat] đã sort theo shape_pt_sequence */
  coords: [number, number][];
}

export interface GtfsTrip {
  id: string;
  routeId: string;
  shapeId?: string;
  headsign?: string;
}

export interface GtfsStaticData {
  routes: Map<string, GtfsRoute>;
  stops: Map<string, GtfsStop>;
  shapes: Map<string, GtfsShape>;
  trips: Map<string, GtfsTrip>;

  busTimetables: BusTimetable[]; // ← thêm
  shapePathIndex: ShapePathIndex;
  /** Operator color override từ config */
  operatorColor: string;
}

export interface GtfsSourceConfig {
  gtfsUrl: string;
  vehiclePositionUrl: string;
  color: string;
  /** Tên gọi để debug, key trong store */
  agencyId: string;
}

export const GTFS_SOURCES: GtfsSourceConfig[] = [
  {
    agencyId: "Toei",
    gtfsUrl:
      "https://api-public.odpt.org/api/v4/files/Toei/data/ToeiBus-GTFS.zip",
    vehiclePositionUrl:
      "https://api-public.odpt.org/api/v4/gtfs/realtime/ToeiBus",
    color: "#9FC105",
  },
  {
    agencyId: "Yokohama",
    gtfsUrl:
      "https://api.odpt.org/api/v4/files/YokohamaMunicipal/data/YokohamaMunicipal-Bus-GTFS.zip",
    vehiclePositionUrl:
      "https://api.odpt.org/api/v4/gtfs/realtime/YokohamaMunicipalBus_vehicle",
    color: "#1B1464",
  },
  {
    agencyId: "Keisei",
    gtfsUrl:
      "https://api-public.odpt.org/api/v4/files/odpt/KeiseiTransitBus/AllLines.zip?date=current",
    vehiclePositionUrl:
      "https://api-public.odpt.org/api/v4/gtfs/realtime/odpt_KeiseiTransitBus_AllLines_vehicle",
    color: "#C73734",
  },
];

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      row[headers[i]] = values[i] ?? "";
    }
    return row;
  });
}

// Đơn giản, không hỗ trợ comma trong quoted string nested - đủ cho GTFS
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuote = !inQuote;
    } else if (c === "," && !inQuote) {
      result.push(current);
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current);
  return result;
}

function parseGtfsTime(s: string): number {
  if (!s) return -1;
  const parts = s.split(":");
  if (parts.length !== 3) return -1;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const sec = parseInt(parts[2], 10);
  if (isNaN(h) || isNaN(m) || isNaN(sec)) return -1;
  return h * 3600 + m * 60 + sec;
}

export async function loadGtfsStatic(
  source: GtfsSourceConfig,
): Promise<GtfsStaticData> {
  const res = await fetch(source.gtfsUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${source.gtfsUrl}: ${res.status}`);
  }
  const buffer = await res.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);

  const readFile = async (name: string): Promise<string> => {
    const file = zip.file(name);
    if (!file) throw new Error(`${name} missing in GTFS zip`);
    return file.async("string");
  };

  // ← thêm stop_times vào danh sách parallel fetch
  const [routesText, stopsText, shapesText, tripsText, stopTimesText] =
    await Promise.all([
      readFile("routes.txt"),
      readFile("stops.txt"),
      readFile("shapes.txt").catch(() => ""),
      readFile("trips.txt"),
      readFile("stop_times.txt").catch(() => ""),
    ]);

  // === Routes (giữ nguyên) ===
  const routes = new Map<string, GtfsRoute>();
  for (const r of parseCsv(routesText)) {
    routes.set(r.route_id, {
      id: r.route_id,
      shortName: r.route_short_name || undefined,
      longName: r.route_long_name || undefined,
      color: r.route_color ? `#${r.route_color}` : undefined,
      textColor: r.route_text_color ? `#${r.route_text_color}` : undefined,
    });
  }

  // === Stops (giữ nguyên) ===
  const stops = new Map<string, GtfsStop>();
  for (const s of parseCsv(stopsText)) {
    if (!s.stop_lat || !s.stop_lon) continue;
    stops.set(s.stop_id, {
      id: s.stop_id,
      name: s.stop_name,
      coord: [parseFloat(s.stop_lon), parseFloat(s.stop_lat)],
    });
  }

  // === Shapes (giữ nguyên) ===
  const shapes = new Map<string, GtfsShape>();
  if (shapesText) {
    const shapeRows = parseCsv(shapesText);
    const grouped = new Map<
      string,
      { seq: number; coord: [number, number] }[]
    >();
    for (const row of shapeRows) {
      const id = row.shape_id;
      const seq = parseInt(row.shape_pt_sequence, 10);
      const lng = parseFloat(row.shape_pt_lon);
      const lat = parseFloat(row.shape_pt_lat);
      if (!id || isNaN(seq) || isNaN(lng) || isNaN(lat)) continue;
      let arr = grouped.get(id);
      if (!arr) {
        arr = [];
        grouped.set(id, arr);
      }
      arr.push({ seq, coord: [lng, lat] });
    }
    for (const [id, arr] of grouped) {
      arr.sort((a, b) => a.seq - b.seq);
      shapes.set(id, { id, coords: arr.map((p) => p.coord) });
    }
  }

  // === Trips — sửa để giữ thêm serviceId ===
  const trips = new Map<string, GtfsTrip>();
  for (const t of parseCsv(tripsText)) {
    trips.set(t.trip_id, {
      id: t.trip_id,
      routeId: t.route_id,
      shapeId: t.shape_id || undefined,
      headsign: t.trip_headsign || undefined,
      // serviceId: t.service_id || undefined, // ← thêm vào GtfsTrip nếu cần
    });
  }

  // === Build shape path index ===
  const shapePathIndex = buildShapePathIndex(shapes);

  // === Parse stop_times → group by trip_id ===
  type StopTimeRow = {
    sequence: number;
    stopId: string;
    arrival: number;
    departure: number;
  };
  const stopTimesByTrip = new Map<string, StopTimeRow[]>();

  if (stopTimesText) {
    for (const row of parseCsv(stopTimesText)) {
      const tripId = row.trip_id;
      if (!tripId) continue;
      const sequence = parseInt(row.stop_sequence, 10);
      if (isNaN(sequence)) continue;
      const arrival = parseGtfsTime(row.arrival_time);
      const departure = parseGtfsTime(row.departure_time);
      let arr = stopTimesByTrip.get(tripId);
      if (!arr) {
        arr = [];
        stopTimesByTrip.set(tripId, arr);
      }
      arr.push({
        sequence,
        stopId: row.stop_id,
        arrival,
        departure,
      });
    }
  }

  // === Build BusTimetable per trip ===
  const busTimetables: BusTimetable[] = [];
  for (const [tripId, rows] of stopTimesByTrip) {
    const trip = trips.get(tripId);
    if (!trip) continue;

    rows.sort((a, b) => a.sequence - b.sequence);

    const stopIds = rows.map((r) => r.stopId);
    const arrivals = rows.map((r) => r.arrival);
    const departures = rows.map((r) => r.departure);

    // Compute stop offsets on shape (monotonic search)
    const stopOffsets: number[] = new Array(stopIds.length).fill(-1);
    if (trip.shapeId) {
      const path = shapePathIndex.paths.get(trip.shapeId);
      if (path) {
        let searchFromIdx = 0;
        for (let i = 0; i < stopIds.length; i++) {
          const stop = stops.get(stopIds[i]);
          if (!stop) continue;
          const { distance, vertexIdx } = projectStopOnShape(
            stop.coord,
            path,
            searchFromIdx,
          );
          stopOffsets[i] = distance;
          searchFromIdx = vertexIdx;
        }
      }
    }

    // Compute start/end (skip -1)
    let start = Infinity;
    let end = -Infinity;
    for (const t of arrivals) {
      if (t >= 0) {
        if (t < start) start = t;
        if (t > end) end = t;
      }
    }
    for (const t of departures) {
      if (t >= 0) {
        if (t < start) start = t;
        if (t > end) end = t;
      }
    }
    if (!isFinite(start)) continue; // không có time hợp lệ → skip trip

    busTimetables.push({
      tripId,
      routeId: trip.routeId,
      shapeId: trip.shapeId,
      stops: stopIds,
      arrivals,
      departures,
      stopOffsets,
      start,
      end,
    });
  }

  return {
    routes,
    stops,
    shapes,
    trips,
    busTimetables,
    shapePathIndex,
    operatorColor: source.color,
  };
}
