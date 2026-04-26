import type { Map as MapboxMap, ExpressionSpecification } from "mapbox-gl";
import type { FeatureCollection, Feature, Point, LineString } from "geojson";
import type { Railway, Station } from "@/helpers/loadRailwayData";
import mapboxgl from "mapbox-gl";

const SOURCE_POINTS = "stations-points";
const SOURCE_LINES = "stations-lines";
const LAYER_SINGLE = "stations-single";
const LAYER_INTERCHANGE = "stations-interchange";
const LAYER_INTERCHANGE_OUTLINE = "stations-interchange-outline";
const LAYER_LABEL = "stations-label";

const POPUP_STYLE = `
.station-popup .mapboxgl-popup-content {
  padding: 0;
  background: rgba(10, 15, 30, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  width: 180px;
}

.station-popup .mapboxgl-popup-tip {
  display: none;
}

.station-popup-thumbnail {
  width: 100%;
  height: 80px;
  object-fit: cover;
  display: block;
}

.station-popup-body {
  padding: 8px 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.station-popup-section-en {
  font-size: 14px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.95);
  line-height: 1.2;
}

.station-popup-section-ja {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 4px;
}

.station-popup-section + .station-popup-section {
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.station-popup-lines {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.station-popup-line-item {
  display: flex;
  align-items: center;
  gap: 7px;
}

.station-popup-line-swatch {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  flex-shrink: 0;
}

.station-popup-line-name {
  font-size: 11px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
}
`;

let popupStyleInjected = false;
function injectPopupStyle(): void {
  if (popupStyleInjected) return;
  const tag = document.createElement("style");
  tag.textContent = POPUP_STYLE;
  document.head.appendChild(tag);
  popupStyleInjected = true;
}

// ---- Style expressions ----

const SINGLE_RADIUS: ExpressionSpecification = [
  "interpolate",
  ["exponential", 1.5],
  ["zoom"],
  10,
  1.3, // (1 * 1.3)
  13,
  5.2, // (4 * 1.3)
  15,
  13, // (10 * 1.3)
  18,
  28.08, // (21.6 * 1.3)
  22,
  40.56, // (31.2 * 1.3)
];

const STROKE_WIDTH: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  10,
  0.65, // (0.5 * 1.3)
  14,
  1.95, // (1.5 * 1.3)
  18,
  6.24, // (4.8 * 1.3)
  22,
  9.36, // (7.2 * 1.3)
];

// ---- Types ----

export type StationGroupsData = string[][][];

interface LineInfo {
  color: string;
  titleEn: string;
  railwayId: string;
}

interface PopupSection {
  titleEn: string;
  titleJa: string;
  lines: LineInfo[];
}

interface StationProperties {
  subGroupKey: string;
  connectedKey: string;
  ids: string;
  color: string;
  lineCount: number;
  interchange: boolean;
  title_en: string;
  title_ja: string;
  thumbnail: string;
  popup_sections: string;
  _kind: "point" | "capsule" | "connector";
  [key: string]: unknown;
}

interface SubGroupAccumulator {
  subGroupKey: string;
  connectedKey: string;
  primaryCoord: [number, number];
  coords: [number, number][];
  ids: string[];
  colors: string[];
  titles: Record<string, string>[];
  railwayIds: string[];
  thumbnail?: string;
}

export interface StationsGeoJSON {
  points: FeatureCollection<Point, StationProperties>;
  lines: FeatureCollection<LineString, StationProperties>;
}

// ---- Geometry helpers ----

function findExtremes(
  coords: [number, number][],
): [[number, number], [number, number]] {
  if (coords.length < 2) return [coords[0], coords[0]];

  let maxDistSq = -1;
  let a: [number, number] = coords[0];
  let b: [number, number] = coords[1];

  for (let i = 0; i < coords.length; i++) {
    for (let j = i + 1; j < coords.length; j++) {
      const dx = coords[i][0] - coords[j][0];
      const dy = coords[i][1] - coords[j][1];
      const distSq = dx * dx + dy * dy;
      if (distSq > maxDistSq) {
        maxDistSq = distSq;
        a = coords[i];
        b = coords[j];
      }
    }
  }
  return [a, b];
}

function centroid(coords: [number, number][]): [number, number] {
  let sumX = 0;
  let sumY = 0;
  for (const c of coords) {
    sumX += c[0];
    sumY += c[1];
  }
  return [sumX / coords.length, sumY / coords.length];
}

// Thuật toán nối chuỗi tất cả các điểm (0=0=0)
function buildPath(coords: [number, number][]): [number, number][] {
  if (coords.length <= 2) return coords;

  const [start, end] = findExtremes(coords);
  const path: [number, number][] = [start];
  const unvisited = coords.filter((c) => c !== start && c !== end);

  let current = start;
  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let minDist = Infinity;
    for (let i = 0; i < unvisited.length; i++) {
      const dx = unvisited[i][0] - current[0];
      const dy = unvisited[i][1] - current[1];
      const distSq = dx * dx + dy * dy;
      if (distSq < minDist) {
        minDist = distSq;
        nearestIdx = i;
      }
    }
    current = unvisited[nearestIdx];
    path.push(current);
    unvisited.splice(nearestIdx, 1);
  }

  path.push(end);
  return path;
}

// ---- Build group lookups ----

interface GroupLookups {
  stationToSubGroup: Map<string, string>;
  subGroupToConnected: Map<string, string>;
}

function buildGroupLookups(stationGroups: StationGroupsData): GroupLookups {
  const stationToSubGroup = new Map<string, string>();
  const subGroupToConnected = new Map<string, string>();

  stationGroups.forEach((connectedGroup, connectedIdx) => {
    const connectedKey = `cg_${connectedIdx}`;
    connectedGroup.forEach((subGroup, subIdx) => {
      if (!subGroup || subGroup.length === 0) return;
      const subGroupKey = `sg_${connectedIdx}_${subIdx}`;
      subGroupToConnected.set(subGroupKey, connectedKey);
      for (const stationId of subGroup) {
        stationToSubGroup.set(stationId, subGroupKey);
      }
    });
  });

  return { stationToSubGroup, subGroupToConnected };
}

// ---- Build GeoJSON ----

export interface BuildStationsOptions {
  stations: Station[];
  railways: Railway[];
  stationGroups?: StationGroupsData;
}

export function buildStationsGeoJSON(
  options: BuildStationsOptions,
): StationsGeoJSON {
  const { stations, railways, stationGroups } = options;

  const railwayColorMap = new Map(railways.map((r) => [r.id, r.color]));
  const railwayTitleMap = new Map(railways.map((r) => [r.id, r.title]));

  const lookups: GroupLookups = stationGroups
    ? buildGroupLookups(stationGroups)
    : { stationToSubGroup: new Map(), subGroupToConnected: new Map() };

  // Dedup station id
  const seenIds = new Set<string>();
  const uniqueStations = stations.filter((s) => {
    if (!s?.id || !s?.coord || !Array.isArray(s.coord)) return false;
    if (seenIds.has(s.id)) return false;
    seenIds.add(s.id);
    return true;
  });

  // Group theo sub-group key
  const subGroups = new Map<string, SubGroupAccumulator>();

  for (const st of uniqueStations) {
    const thumbnail = (st as Station & { thumbnail?: string }).thumbnail;
    const color = railwayColorMap.get(st.railway) ?? "#999";

    const subGroupKey = lookups.stationToSubGroup.get(st.id) ?? `solo_${st.id}`;
    const connectedKey =
      lookups.subGroupToConnected.get(subGroupKey) ?? subGroupKey;

    const existing = subGroups.get(subGroupKey);
    if (existing) {
      existing.ids.push(st.id);
      existing.colors.push(color);
      existing.railwayIds.push(st.railway);
      existing.coords.push(st.coord);
      if (st.title) existing.titles.push(st.title);
      if (!existing.thumbnail && thumbnail) existing.thumbnail = thumbnail;
    } else {
      subGroups.set(subGroupKey, {
        subGroupKey,
        connectedKey,
        primaryCoord: st.coord,
        coords: [st.coord],
        ids: [st.id],
        colors: [color],
        titles: st.title ? [st.title] : [],
        railwayIds: [st.railway],
        thumbnail,
      });
    }
  }

  // Build PopupSection
  const subGroupSections = new Map<string, PopupSection>();
  for (const sg of subGroups.values()) {
    const seenRailways = new Set<string>();
    const lines: LineInfo[] = [];
    for (let i = 0; i < sg.railwayIds.length; i++) {
      const rid = sg.railwayIds[i];
      if (seenRailways.has(rid)) continue;
      seenRailways.add(rid);
      const rTitle = railwayTitleMap.get(rid);
      lines.push({
        color: sg.colors[i],
        titleEn: rTitle?.en ?? rid.split(".").pop() ?? rid,
        railwayId: rid,
      });
    }
    const primaryTitle = sg.titles[0];
    subGroupSections.set(sg.subGroupKey, {
      titleEn: primaryTitle?.en ?? primaryTitle?.ja ?? "",
      titleJa: primaryTitle?.ja ?? "",
      lines,
    });
  }

  // Merge sections
  const connectedSections = new Map<string, PopupSection[]>();
  for (const sg of subGroups.values()) {
    const section = subGroupSections.get(sg.subGroupKey);
    if (!section) continue;

    const arr = connectedSections.get(sg.connectedKey) ?? [];
    const titleKey = section.titleEn.trim().toLowerCase();
    const existing = arr.find(
      (s) => s.titleEn.trim().toLowerCase() === titleKey,
    );

    if (existing) {
      const seenRailways = new Set(existing.lines.map((l) => l.railwayId));
      for (const l of section.lines) {
        if (!seenRailways.has(l.railwayId)) {
          existing.lines.push(l);
          seenRailways.add(l.railwayId);
        }
      }
    } else {
      arr.push({ ...section, lines: [...section.lines] });
    }
    connectedSections.set(sg.connectedKey, arr);
  }

  // Build features
  const pointFeatures: Feature<Point, StationProperties>[] = [];
  const lineFeatures: Feature<LineString, StationProperties>[] = [];

  const buildProperties = (
    sg: SubGroupAccumulator,
    isInterchange: boolean,
    kind: "point" | "capsule" | "connector",
  ): StationProperties => {
    const ownSection = subGroupSections.get(sg.subGroupKey);
    const allSections = connectedSections.get(sg.connectedKey) ?? [];

    const ownTitleKey = ownSection?.titleEn.trim().toLowerCase();
    const ownMerged = allSections.find(
      (s) => s.titleEn.trim().toLowerCase() === ownTitleKey,
    );
    const popupSections: PopupSection[] = ownMerged
      ? [ownMerged, ...allSections.filter((s) => s !== ownMerged)]
      : allSections;

    const primaryTitle = sg.titles[0];
    return {
      subGroupKey: sg.subGroupKey,
      connectedKey: sg.connectedKey,
      ids: sg.ids.join(","),
      color: sg.colors[0] ?? "#999",
      lineCount: ownMerged?.lines.length ?? 0,
      interchange: isInterchange,
      title_en: primaryTitle?.en ?? primaryTitle?.ja ?? "",
      title_ja: primaryTitle?.ja ?? "",
      thumbnail: sg.thumbnail ?? "",
      popup_sections: JSON.stringify(popupSections),
      _kind: kind,
    };
  };

  // 1. Mỗi sub-group → 1 point + (optional) 1 capsule
  for (const sg of subGroups.values()) {
    const sgCoordKeySet = new Set<string>();
    const sgDedupedCoords: [number, number][] = [];
    for (const c of sg.coords) {
      const k = `${c[0].toFixed(6)},${c[1].toFixed(6)}`;
      if (sgCoordKeySet.has(k)) continue;
      sgCoordKeySet.add(k);
      sgDedupedCoords.push(c);
    }

    const isInterchange = sgDedupedCoords.length > 1;
    const labelCoord: [number, number] = isInterchange
      ? centroid(sgDedupedCoords)
      : sg.primaryCoord;

    pointFeatures.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: labelCoord },
      properties: buildProperties(sg, isInterchange, "point"),
    });

    if (isInterchange) {
      const pathCoords = buildPath(sgDedupedCoords);
      lineFeatures.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates: pathCoords },
        properties: buildProperties(sg, true, "capsule"),
      });
    }
  }

  // 2. Connector mảnh nối các sub-group
  const connectedSubGroupCoords = new Map<
    string,
    { coords: [number, number][]; firstSg: SubGroupAccumulator }
  >();

  for (const sg of subGroups.values()) {
    const labelCoord = (() => {
      const seen = new Set<string>();
      const deduped: [number, number][] = [];
      for (const c of sg.coords) {
        const k = `${c[0].toFixed(6)},${c[1].toFixed(6)}`;
        if (seen.has(k)) continue;
        seen.add(k);
        deduped.push(c);
      }
      return deduped.length > 1 ? centroid(deduped) : sg.primaryCoord;
    })();

    const entry = connectedSubGroupCoords.get(sg.connectedKey);
    if (entry) {
      entry.coords.push(labelCoord);
    } else {
      connectedSubGroupCoords.set(sg.connectedKey, {
        coords: [labelCoord],
        firstSg: sg,
      });
    }
  }

  for (const { coords, firstSg } of connectedSubGroupCoords.values()) {
    const seen = new Set<string>();
    const deduped: [number, number][] = [];
    for (const c of coords) {
      const k = `${c[0].toFixed(6)},${c[1].toFixed(6)}`;
      if (seen.has(k)) continue;
      seen.add(k);
      deduped.push(c);
    }
    if (deduped.length < 2) continue;

    const pathCoords = buildPath(deduped);
    lineFeatures.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: pathCoords },
      properties: buildProperties(firstSg, true, "connector"),
    });
  }

  return {
    points: { type: "FeatureCollection", features: pointFeatures },
    lines: { type: "FeatureCollection", features: lineFeatures },
  };
}

// ---- Hover / popup ----

function renderPopupHtml(props: StationProperties): string {
  const sections: PopupSection[] = (() => {
    try {
      return JSON.parse(props.popup_sections) as PopupSection[];
    } catch {
      return [];
    }
  })();
  const thumbnailHtml = props.thumbnail
    ? `<img class="station-popup-thumbnail" src="${props.thumbnail}" alt="${props.title_en}" />`
    : "";

  const sectionsHtml = sections
    .map((section) => {
      const linesHtml = section.lines
        .map(
          (l) => `
          <div class="station-popup-line-item">
            <span class="station-popup-line-swatch" style="background:${l.color}"></span>
            <span class="station-popup-line-name">${l.titleEn}</span>
          </div>`,
        )
        .join("");
      return `
        <div class="station-popup-section">
          <div class="station-popup-section-en">${section.titleEn}</div>
          ${section.titleJa ? `<div class="station-popup-section-ja">${section.titleJa}</div>` : ""}
          <div class="station-popup-lines">${linesHtml}</div>
        </div>`;
    })
    .join("");

  return `
    ${thumbnailHtml}
    <div class="station-popup-body">${sectionsHtml}</div>
  `;
}

function setupStationHover(map: MapboxMap): void {
  const popup = new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false,
    offset: 14,
    className: "station-popup",
    maxWidth: "280px",
  });

  let hoveredFeature: { source: string; id: string | number } | null = null;

  const clearHover = (): void => {
    if (hoveredFeature) {
      map.setFeatureState(hoveredFeature, { hover: false });
      hoveredFeature = null;
    }
  };

  const handleEnter =
    (sourceId: string) =>
    (e: mapboxgl.MapLayerMouseEvent): void => {
      map.getCanvas().style.cursor = "pointer";
      const feature = e.features?.[0];
      if (!feature || feature.id === undefined) return;

      clearHover();
      hoveredFeature = { source: sourceId, id: feature.id };
      map.setFeatureState(hoveredFeature, { hover: true });

      const props = feature.properties as StationProperties;

      let popupCoords: [number, number];
      if (feature.geometry.type === "Point") {
        popupCoords = [
          ...(feature.geometry.coordinates as [number, number]),
        ] as [number, number];
      } else {
        popupCoords = [e.lngLat.lng, e.lngLat.lat];
      }

      popup.setLngLat(popupCoords).setHTML(renderPopupHtml(props)).addTo(map);
    };

  const handleLeave = (): void => {
    map.getCanvas().style.cursor = "";
    popup.remove();
    clearHover();
  };

  map.on("mouseenter", LAYER_SINGLE, handleEnter(SOURCE_POINTS));
  map.on("mouseleave", LAYER_SINGLE, handleLeave);

  map.on("mouseenter", LAYER_INTERCHANGE, handleEnter(SOURCE_LINES));
  map.on("mouseleave", LAYER_INTERCHANGE, handleLeave);
}

// ---- Add / remove layers ----

export interface AddStationLayersOptions {
  map: MapboxMap;
  stations: Station[];
  railways: Railway[];
  stationGroups?: StationGroupsData;
  slot?: "bottom" | "middle" | "top";
}

export function addStationLayers(options: AddStationLayersOptions): void {
  const { map, stations, railways, stationGroups, slot = "middle" } = options;

  injectPopupStyle();
  const { points, lines } = buildStationsGeoJSON({
    stations,
    railways,
    stationGroups,
  });

  // 1. Cập nhật Source an toàn
  const sourcePoints = map.getSource(SOURCE_POINTS) as mapboxgl.GeoJSONSource;
  if (sourcePoints) {
    sourcePoints.setData(points);
  } else {
    map.addSource(SOURCE_POINTS, {
      type: "geojson",
      data: points,
      generateId: true,
    });
  }

  const sourceLines = map.getSource(SOURCE_LINES) as mapboxgl.GeoJSONSource;
  if (sourceLines) {
    sourceLines.setData(lines);
  } else {
    map.addSource(SOURCE_LINES, {
      type: "geojson",
      data: lines,
      generateId: true,
    });
  }

  // --- THỨ TỰ LAYER: LINE NẰM DƯỚI, CIRCLE NẰM TRÊN ---

  // 2. Vẽ viền đen cho đường nối (Dưới cùng)
  // 2. Vẽ viền đen cho đường nối (Dưới cùng)
  if (!map.getLayer(LAYER_INTERCHANGE_OUTLINE)) {
    map.addLayer({
      id: LAYER_INTERCHANGE_OUTLINE,
      type: "line",
      source: SOURCE_LINES,
      slot,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#1a1a1a",
        // ZOOM RA NGOÀI, CASE VÀO TRONG
        "line-width": [
          "interpolate",
          ["exponential", 1.5],
          ["zoom"],
          10,
          ["case", ["==", ["get", "_kind"], "connector"], 2.6, 5.2],
          13,
          ["case", ["==", ["get", "_kind"], "connector"], 10.4, 15.6],
          15,
          ["case", ["==", ["get", "_kind"], "connector"], 23.4, 33.8],
          18,
          ["case", ["==", ["get", "_kind"], "connector"], 52, 72.8],
          22,
          ["case", ["==", ["get", "_kind"], "connector"], 78, 109.2],
        ],
        // Khi hover thì đậm, bình thường thì mờ (0.3)
        "line-opacity": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          1,
          0.3,
        ],
        "line-emissive-strength": 1,
      },
    });
  }

  // 3. Vẽ thân đường nối màu trắng (Đè lên viền đen)
  // 3. Vẽ thân đường nối màu trắng (Đè lên viền đen)
  if (!map.getLayer(LAYER_INTERCHANGE)) {
    map.addLayer({
      id: LAYER_INTERCHANGE,
      type: "line",
      source: SOURCE_LINES,
      slot,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#ffffff",
        // ZOOM RA NGOÀI, CASE VÀO TRONG
        "line-width": [
          "interpolate",
          ["exponential", 1.5],
          ["zoom"],
          10,
          ["case", ["==", ["get", "_kind"], "connector"], 1.3, 3.9],
          13,
          ["case", ["==", ["get", "_kind"], "connector"], 7.8, 13],
          15,
          ["case", ["==", ["get", "_kind"], "connector"], 18.2, 28.6],
          18,
          ["case", ["==", ["get", "_kind"], "connector"], 39, 62.4],
          22,
          ["case", ["==", ["get", "_kind"], "connector"], 59.8, 93.6],
        ],
        // Khi hover thì đậm, bình thường thì trắng mờ (0.5)
        "line-opacity": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          1,
          0.5,
        ],
        "line-emissive-strength": 1,
      },
    });
  }

  // 4. Vẽ vòng tròn nhà ga (Nằm trên cùng)
  if (!map.getLayer(LAYER_SINGLE)) {
    map.addLayer({
      id: LAYER_SINGLE,
      type: "circle",
      source: SOURCE_POINTS,
      slot,
      paint: {
        "circle-radius": SINGLE_RADIUS,
        "circle-color": "#ffffff",
        "circle-stroke-color": ["get", "color"],
        "circle-stroke-width": STROKE_WIDTH,
        "circle-opacity": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          1,
          0.85,
        ],
        "circle-stroke-opacity": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          1,
          0.85,
        ],
        "circle-emissive-strength": 1,
        "circle-pitch-alignment": "map",
      },
    });
  }

  // 5. Label
  if (!map.getLayer(LAYER_LABEL)) {
    map.addLayer({
      id: LAYER_LABEL,
      type: "symbol",
      source: SOURCE_POINTS,
      slot,
      minzoom: 13,
      layout: {
        "text-field": ["get", "title_en"],
        "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
        "text-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          13,
          10,
          16,
          12,
          20,
          14,
        ],
        "text-anchor": "top",
        "text-offset": [0, 0.9],
        "text-padding": 4,
        "text-allow-overlap": false,
        "text-optional": true,
      },
      paint: {
        "text-color": "#ffffff",
        "text-halo-color": "rgba(0, 0, 0, 0.85)",
        "text-halo-width": 1.5,
        "text-emissive-strength": 1,
      },
    });
  }

  setupStationHover(map);
}

export function removeStationLayers(map: MapboxMap): void {
  const layers = [
    LAYER_LABEL,
    LAYER_SINGLE,
    LAYER_INTERCHANGE,
    LAYER_INTERCHANGE_OUTLINE,
  ];
  for (const id of layers) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(SOURCE_POINTS)) map.removeSource(SOURCE_POINTS);
  if (map.getSource(SOURCE_LINES)) map.removeSource(SOURCE_LINES);
}

export const STATION_LAYER_IDS = [
  LAYER_INTERCHANGE_OUTLINE,
  LAYER_INTERCHANGE,
  LAYER_SINGLE,
  LAYER_LABEL,
] as const;
