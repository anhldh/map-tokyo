// src/components/map/mapConfig.ts
export const INITIAL_VIEW = {
  center: [139.7671, 35.6812] as [number, number],
  zoom: 14,
  pitch: 60,
  bearing: -30,
};

export interface MapConfig {
  showPlaceLabels: boolean;
  showRoadLabels: boolean;
  showPointOfInterestLabels: boolean;
  showTransitLabels: boolean;
  show3dObjects: boolean;
  // lightPreset: "day" | "dusk" | "dawn" | "night";
}

export const INITIAL_CONFIG: MapConfig = {
  showPlaceLabels: false,
  showRoadLabels: false,
  showPointOfInterestLabels: false,
  showTransitLabels: false,
  show3dObjects: true,
  // lightPreset: "day",
};
