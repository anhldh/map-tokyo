import { R2_BASE } from "@/utils/constants";
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

export type StationGroupsData = string[][][];

export interface RailwayData {
  railways: Railway[];
  stations: Station[];
  features: FeatureCollection;
  stationGroups: StationGroupsData;
}

// ---- Loader ----

export async function loadRailwayData(baseUrl = R2_BASE): Promise<RailwayData> {
  const [railways, stations, features, stationGroups] = await Promise.all([
    fetchJson<Railway[]>(`${baseUrl}/railways.json`),
    fetchJson<Station[]>(`${baseUrl}/stations.json`),
    fetchJson<FeatureCollection>(`${baseUrl}/features.json`),
    fetchJson<StationGroupsData>(`${baseUrl}/station-groups.json`),
  ]);

  return { railways, stations, features, stationGroups };
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load ${url}: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}
