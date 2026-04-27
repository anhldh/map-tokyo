// src/data/gtfsStatic.ts
import JSZip from "jszip";

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

  const [routesText, stopsText, shapesText, tripsText] = await Promise.all([
    readFile("routes.txt"),
    readFile("stops.txt"),
    readFile("shapes.txt").catch(() => ""),
    readFile("trips.txt"),
  ]);

  // Routes
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

  // Stops
  const stops = new Map<string, GtfsStop>();
  for (const s of parseCsv(stopsText)) {
    if (!s.stop_lat || !s.stop_lon) continue;
    stops.set(s.stop_id, {
      id: s.stop_id,
      name: s.stop_name,
      coord: [parseFloat(s.stop_lon), parseFloat(s.stop_lat)],
    });
  }

  // Shapes (group by shape_id, sort by sequence)
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

  // Trips
  const trips = new Map<string, GtfsTrip>();
  for (const t of parseCsv(tripsText)) {
    trips.set(t.trip_id, {
      id: t.trip_id,
      routeId: t.route_id,
      shapeId: t.shape_id || undefined,
      headsign: t.trip_headsign || undefined,
    });
  }

  return {
    routes,
    stops,
    shapes,
    trips,
    operatorColor: source.color,
  };
}
