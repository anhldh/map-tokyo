// src/services/waqi.ts

const WAQI_BASE = "/api/waqi";

// Tokyo bbox: lat1,lng1,lat2,lng2 (south-west, north-east)
const TOKYO_LATLNG = "35.50,138.94,35.90,139.92";

export interface WaqiMapStation {
  lat: number;
  lon: number;
  uid: number;
  aqi: string; // "-" nếu không có data
  station: { name: string; time: string };
}

export interface WaqiFeedDetail {
  aqi: number;
  idx: number;
  city: { name: string; geo: [number, number]; url?: string };
  iaqi: Record<string, { v: number }>;
  time: { iso: string; s: string; tz?: string };
  attributions?: Array<{ name: string; url?: string }>;
  dominentpol?: string;
}

export async function fetchTokyoStations(): Promise<WaqiMapStation[]> {
  const url = `${WAQI_BASE}/map/bounds/?latlng=${TOKYO_LATLNG}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`WAQI map ${res.status}`);
  const json = await res.json();
  if (json.status !== "ok") throw new Error(`WAQI status: ${json.status}`);
  return (json.data ?? []) as WaqiMapStation[];
}

export async function fetchStationDetail(
  uid: number,
): Promise<WaqiFeedDetail | null> {
  const url = `${WAQI_BASE}/feed/@${uid}/`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  if (json.status !== "ok") return null;
  return json.data as WaqiFeedDetail;
}

// US EPA AQI level → màu + label
export function aqiToColor(aqi: number): { color: string; label: string } {
  if (!Number.isFinite(aqi) || aqi < 0) {
    return { color: "#888888", label: "Unknown" };
  }
  if (aqi <= 50) return { color: "#00e400", label: "Good" };
  if (aqi <= 100) return { color: "#ffff00", label: "Moderate" };
  if (aqi <= 150) return { color: "#ff7e00", label: "Unhealthy (SG)" };
  if (aqi <= 200) return { color: "#ff0000", label: "Unhealthy" };
  if (aqi <= 300) return { color: "#8f3f97", label: "Very Unhealthy" };
  return { color: "#7e0023", label: "Hazardous" };
}
