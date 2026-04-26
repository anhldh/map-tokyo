// src/data/loadRailwayData.ts
import type { TrainTimetable } from "@/layers/trainscheduler";
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

export async function loadRailwayData(baseUrl = "/data"): Promise<RailwayData> {
  const [railways, stations, features, stationGroups] = await Promise.all([
    fetchJson<Railway[]>(`${baseUrl}/railways.json`),
    fetchJson<Station[]>(`${baseUrl}/stations.json`),
    fetchJson<FeatureCollection>(`${baseUrl}/features.json`),
    fetchJson<StationGroupsData>(`${baseUrl}/station-groups.json`),
  ]);

  // const features = await fetch('/data/features.json').then(r => r.json());
  // console.log("Total features:", features.features.length);
  // console.log("Sample feature properties:", features.features[0].properties);

  // // 2. Đếm features cho Tokyu Meguro để xem có duplicate theo zoom không
  // const meguro = features.features.filter(
  //   (f) =>
  //     f.properties?.railway === "Tokyu.Meguro" ||
  //     f.properties?.id === "Tokyu.Meguro",
  // );
  // console.log("Tokyu.Meguro features:", meguro.length);
  // console.log(
  //   "Their properties:",
  //   meguro.map((f) => f.properties),
  // );

  // // 3. Xem train-timetables file
  // const tt = await fetch("/data/train-timetables/tokyu-meguro.json").then((r) =>
  //   r.json(),
  // );
  // console.log("Total timetables:", tt.length);
  // console.log("Sample:", tt[0]);

  // // 4. Xem stations
  // // const stations = await fetch('/data/stations.json').then(r => r.json());
  // const meguroStation = stations.find((s) => s.id === "Tokyu.Meguro.Meguro");
  // console.log("Meguro station:", meguroStation);

  return { railways, stations, features, stationGroups };
}

export async function loadTimetables(
  files: string[],
  baseUrl = "/data/train-timetables",
): Promise<TrainTimetable[]> {
  const all = await Promise.all(
    files.map((f) => fetchJson<TrainTimetable[]>(`${baseUrl}/${f}`)),
  );
  return all.flat();
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load ${url}: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}
