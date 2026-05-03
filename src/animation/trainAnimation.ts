import type { Map as MapboxMap } from "mapbox-gl";
import type { FeatureCollection } from "geojson";
import type { Railway, Station } from "@/helpers/loadRailwayData";
import {
  getCalendarType,
  type CalendarType,
  type TrainTimetable,
} from "@/helpers/timetable";
import {
  addTrainsThreeLayer,
  type TrainsLayerHandle,
} from "@/layers/trainsThreeLayer";
import { useClockStore } from "@/stores/clockStore";

export interface TrainAnimationOptions {
  map: MapboxMap;
  timetablesByCalendar: Record<CalendarType, TrainTimetable[]>;
  stations: Station[];
  railways: Railway[];
  features: FeatureCollection;
  getCurrentSeconds?: () => number;
  getCurrentCalendar?: () => CalendarType;
  origin?: [number, number];
}

const defaultGetSeconds = () => {
  const state = useClockStore.getState();
  const baseSec =
    state.now.hour() * 3600 + state.now.minute() * 60 + state.now.second();
  // Bù phần fractional second giữa các tick
  if (state.frozen) return baseSec;
  const elapsedMs = performance.now() - state.lastTickAt;
  return baseSec + elapsedMs / 1000;
};

const defaultGetCalendar = (): CalendarType => {
  const now = useClockStore.getState().now;
  return getCalendarType(now);
};

export function startTrainAnimation(
  opts: TrainAnimationOptions,
): TrainsLayerHandle {
  const {
    map,
    timetablesByCalendar,
    stations,
    railways,
    features,
    getCurrentSeconds = defaultGetSeconds,
    getCurrentCalendar = defaultGetCalendar,
    origin = [139.767, 35.681], // Tokyo Station
  } = opts;

  return addTrainsThreeLayer({
    map,
    origin,
    timetablesByCalendar,
    stations,
    railways,
    features,
    getCurrentSeconds,
    getCurrentCalendar,
  });
}
