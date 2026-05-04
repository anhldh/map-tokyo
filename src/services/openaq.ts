import { openaqFetch } from "./openaqFetcher";

const TOKYO_BBOX = "138.94,35.50,139.92,35.90";
const OPENAQ_BASE = "/api/openaq/v3";

const LOCATIONS_CACHE_KEY = "openaq_tokyo_locations_v1";
const LOCATIONS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24h
const LATEST_CACHE_TTL = 30 * 60 * 1000; // 30 phút

const AIR_PARAMS = new Set(["pm25", "pm10", "no2", "o3", "so2", "co"]);

export interface AQSensor {
  id: number;
  name: string;
  parameter: { id: number; name: string; units: string; displayName?: string };
}
export interface AQLocation {
  id: number;
  name: string;
  coordinates: { latitude: number; longitude: number };
  sensors: AQSensor[];
}
export interface AQLatest {
  datetime: { utc: string; local: string };
  value: number;
  coordinates: { latitude: number; longitude: number };
  sensorsId: number;
  locationsId: number;
}

// ---------- LOCATIONS ----------

async function fetchLocationsFromApi(): Promise<AQLocation[]> {
  const all: AQLocation[] = [];
  const limit = 1000;
  for (let page = 1; page <= 5; page++) {
    const url = `${OPENAQ_BASE}/locations?bbox=${TOKYO_BBOX}&limit=${limit}&page=${page}`;
    const res = await openaqFetch(url);
    if (!res.ok) throw new Error(`OpenAQ locations ${res.status}`);
    const json = await res.json();
    const results = (json.results ?? []) as AQLocation[];
    all.push(...results);
    if (results.length < limit) break;
  }
  return all;
}

export async function fetchTokyoLocations(): Promise<AQLocation[]> {
  try {
    const raw = localStorage.getItem(LOCATIONS_CACHE_KEY);
    if (raw) {
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts < LOCATIONS_CACHE_TTL && Array.isArray(data)) {
        return data as AQLocation[];
      }
    }
  } catch {
    // ignore
  }

  const data = await fetchLocationsFromApi();
  try {
    localStorage.setItem(
      LOCATIONS_CACHE_KEY,
      JSON.stringify({ ts: Date.now(), data }),
    );
  } catch {
    // quota
  }
  return data;
}

// Lọc trạm chỉ có sensor không khí (loại bỏ trạm chỉ đo nhiệt/độ ẩm)
export function filterAirQualityLocations(
  locations: AQLocation[],
): AQLocation[] {
  return locations.filter((l) =>
    (l.sensors ?? []).some((s) => AIR_PARAMS.has(s.parameter.name)),
  );
}

// ---------- LATEST per location ----------

const latestCacheKey = (id: number) => `openaq_latest_${id}_v1`;

export async function fetchLocationLatest(
  locationsId: number,
): Promise<AQLatest[]> {
  // Cache layer
  try {
    const raw = localStorage.getItem(latestCacheKey(locationsId));
    if (raw) {
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts < LATEST_CACHE_TTL && Array.isArray(data)) {
        return data as AQLatest[];
      }
    }
  } catch {
    // ignore
  }

  const url = `${OPENAQ_BASE}/locations/${locationsId}/latest?limit=100`;
  const res = await openaqFetch(url);
  if (!res.ok) throw new Error(`OpenAQ loc-latest ${res.status}`);
  const json = await res.json();
  const data = (json.results ?? []) as AQLatest[];
  try {
    localStorage.setItem(
      latestCacheKey(locationsId),
      JSON.stringify({ ts: Date.now(), data }),
    );
  } catch {
    // quota — không phải vấn đề lớn, chỉ là không cache lần này
  }
  return data;
}

// ---------- AQI helper ----------

const PM25_BREAKPOINTS = [
  { cLow: 0, cHigh: 12, iLow: 0, iHigh: 50, label: "Tốt", color: "#00e400" },
  {
    cLow: 12.1,
    cHigh: 35.4,
    iLow: 51,
    iHigh: 100,
    label: "Trung bình",
    color: "#ffff00",
  },
  {
    cLow: 35.5,
    cHigh: 55.4,
    iLow: 101,
    iHigh: 150,
    label: "Không lành mạnh (SG)",
    color: "#ff7e00",
  },
  {
    cLow: 55.5,
    cHigh: 150.4,
    iLow: 151,
    iHigh: 200,
    label: "Không lành mạnh",
    color: "#ff0000",
  },
  {
    cLow: 150.5,
    cHigh: 250.4,
    iLow: 201,
    iHigh: 300,
    label: "Rất không tốt",
    color: "#8f3f97",
  },
  {
    cLow: 250.5,
    cHigh: 500,
    iLow: 301,
    iHigh: 500,
    label: "Nguy hiểm",
    color: "#7e0023",
  },
] as const;

export function pm25ToAqi(pm25: number): {
  aqi: number;
  label: string;
  color: string;
} {
  if (pm25 < 0 || !Number.isFinite(pm25)) {
    return { aqi: 0, label: "Unknown", color: "#888888" };
  }
  const bp =
    PM25_BREAKPOINTS.find((b) => pm25 >= b.cLow && pm25 <= b.cHigh) ??
    PM25_BREAKPOINTS[PM25_BREAKPOINTS.length - 1];
  const aqi = Math.round(
    ((bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow)) * (pm25 - bp.cLow) + bp.iLow,
  );
  return { aqi, label: bp.label, color: bp.color };
}
