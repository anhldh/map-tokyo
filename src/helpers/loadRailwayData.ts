// src/data/loadRailwayData.ts
import type { FeatureCollection } from "geojson";

// ---- Types ----

/**
 * Một entry trong railways.json — metadata của tuyến đường sắt.
 * Shape theo Mini Tokyo 3D.
 */
export interface Railway {
  id: string; // "JR-East.Yamanote"
  title: Record<string, string>; // { ja, en, fr, ko, "zh-Hans", "zh-Hant" }
  stations: string[]; // station ids theo thứ tự
  ascending?: string; // "OuterLoop" | "Outbound" | ...
  descending?: string; // "InnerLoop" | "Inbound" | ...
  color: string; // "#80C342"
  carComposition?: number; // số toa
  [key: string]: unknown; // cho các field khác không biết trước
}

export interface RailwayData {
  railways: Railway[];
  features: FeatureCollection;
}

// ---- Loader ----

export async function loadRailwayData(baseUrl = "/data"): Promise<RailwayData> {
  const [railways, features] = await Promise.all([
    fetchJson<Railway[]>(`${baseUrl}/railways.json`),
    fetchJson<FeatureCollection>(`${baseUrl}/features.json`),
  ]);
  return { railways, features };
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load ${url}: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}
