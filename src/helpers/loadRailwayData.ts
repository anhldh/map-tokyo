// src/data/loadRailwayData.ts
import type { FeatureCollection } from "geojson";

// ---- Types ----

export interface Railway {
  id: string;
  title: Record<string, string>;
  stations: string[];
  ascending?: string;
  descending?: string;
  color: string;
  carComposition?: number;
  [key: string]: unknown;
}

export interface Station {
  id: string;
  railway: string;
  coord: [number, number];
  title: Record<string, string>;
  thumbnail?: string;
  [key: string]: unknown;
}

export interface RailwayData {
  railways: Railway[];
  stations: Station[];
  features: FeatureCollection;
}

// ---- Loader ----

export async function loadRailwayData(baseUrl = "/data"): Promise<RailwayData> {
  const [railways, stations, features] = await Promise.all([
    fetchJson<Railway[]>(`${baseUrl}/railways.json`),
    fetchJson<Station[]>(`${baseUrl}/stations.json`),
    fetchJson<FeatureCollection>(`${baseUrl}/features.json`),
  ]);

  console.log("loaded:", {
    railways: railways?.length,
    stations: stations?.length, // nếu undefined → file path sai
    features: features?.features?.length,
  });

  return { railways, stations, features };
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load ${url}: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}
