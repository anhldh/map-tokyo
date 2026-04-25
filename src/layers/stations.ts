import type { Map as MapboxMap, ExpressionSpecification } from "mapbox-gl";
import type { FeatureCollection, Feature, Point } from "geojson";
import type { Railway, Station } from "@/helpers/loadRailwayData";
import mapboxgl from "mapbox-gl";

const SOURCE_ID = "stations";
const LAYER_SINGLE = "stations-single";
const LAYER_INTERCHANGE = "stations-interchange";
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
  gap: 3px;
}

.station-popup-en {
  font-size: 14px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.95);
  line-height: 1.2;
}

.station-popup-ja {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 5px;
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
function injectPopupStyle() {
  if (popupStyleInjected) return;
  const tag = document.createElement("style");
  tag.textContent = POPUP_STYLE;
  document.head.appendChild(tag);
  popupStyleInjected = true;
}

// Radius cho single-line stations
const SINGLE_RADIUS: ExpressionSpecification = [
  "interpolate",
  ["exponential", 1.5], // Hoặc bạn có thể đổi thành 2 để zoom mượt hơn với bản đồ
  ["zoom"],
  10,
  1, // Thu nhỏ cực mạnh khi zoom out (trước là 3.6)
  13,
  4, // (trước là 8.4)
  15,
  10, // Bắt đầu to dần lên (trước là 13.2)
  18,
  21.6, // Giữ nguyên kích thước khi zoom in
  22,
  31.2,
];

// Radius cho interchange stations
const INTERCHANGE_RADIUS: ExpressionSpecification = [
  "interpolate",
  ["exponential", 1.5],
  ["zoom"],
  10,
  1.5, // Thu nhỏ cực mạnh (trước là 4.8)
  13,
  5, // (trước là 10.8)
  15,
  13, // (trước là 16.8)
  18,
  26.4, // Giữ nguyên kích thước khi zoom in
  22,
  38.4,
];

// Độ dày viền cũng phải mỏng đi khi zoom out, nếu không viền sẽ nuốt chửng hình tròn
const STROKE_WIDTH: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  10,
  0.5, // Viền cực mỏng ở zoom out (trước là 1.8)
  14,
  1.5, // (trước là 3)
  18,
  4.8, // Giữ nguyên khi zoom in
  22,
  7.2,
];
// ---- Build GeoJSON ----

interface StationGroup {
  coord: [number, number];
  ids: string[];
  colors: string[];
  titles: Record<string, string>[];
}

export function buildStationsGeoJSON(
  stations: Station[],
  railways: Railway[],
): FeatureCollection {
  const railwayColorMap = new Map(railways.map((r) => [r.id, r.color]));
  const railwayTitleMap = new Map(railways.map((r) => [r.id, r.title]));

  const seenIds = new Set<string>();
  const uniqueStations = stations.filter((s) => {
    if (!s?.id || !s?.coord || !Array.isArray(s.coord)) return false;
    if (seenIds.has(s.id)) return false;
    seenIds.add(s.id);
    return true;
  });

  const grouped = new Map<
    string,
    {
      coord: [number, number];
      ids: string[];
      colors: string[];
      titles: Record<string, string>[];
      railwayIds: string[];
      thumbnail?: string;
    }
  >();

  for (const st of uniqueStations) {
    const key = `${st.coord[0].toFixed(4)},${st.coord[1].toFixed(4)}`;
    const color = railwayColorMap.get(st.railway) ?? "#999";
    const existing = grouped.get(key);

    if (existing) {
      existing.ids.push(st.id);
      existing.colors.push(color);
      existing.railwayIds.push(st.railway);
      if (st.title) existing.titles.push(st.title);
      // Lấy thumbnail từ station nào có
      if (!existing.thumbnail && (st as any).thumbnail) {
        existing.thumbnail = (st as any).thumbnail;
      }
    } else {
      grouped.set(key, {
        coord: st.coord,
        ids: [st.id],
        colors: [color],
        titles: st.title ? [st.title] : [],
        railwayIds: [st.railway],
        thumbnail: (st as any).thumbnail,
      });
    }
  }

  const features: Feature<Point>[] = Array.from(grouped.values()).map(
    (group) => {
      const primaryTitle = group.titles[0];

      // Dedup railways (cùng railway có thể xuất hiện 2 lần do nhiều platform)
      const seenRailways = new Set<string>();
      const uniqueLines: {
        color: string;
        titleEn: string;
        railwayId: string;
      }[] = [];
      for (let i = 0; i < group.railwayIds.length; i++) {
        const rid = group.railwayIds[i];
        if (seenRailways.has(rid)) continue;
        seenRailways.add(rid);
        const rTitle = railwayTitleMap.get(rid);
        uniqueLines.push({
          color: group.colors[i],
          titleEn: rTitle?.en ?? rid.split(".").pop() ?? rid,
          railwayId: rid,
        });
      }

      return {
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: group.coord },
        properties: {
          ids: group.ids.join(","),
          color: group.colors[0] ?? "#999",
          lineCount: uniqueLines.length,
          interchange: uniqueLines.length > 1,
          title_en: primaryTitle?.en ?? primaryTitle?.ja ?? "",
          title_ja: primaryTitle?.ja ?? "",
          thumbnail: group.thumbnail ?? "",
          // Serialize lines thành JSON string vì GeoJSON properties chỉ flat
          lines: JSON.stringify(uniqueLines),
        },
      };
    },
  );

  return { type: "FeatureCollection", features };
}

// ---- Add / remove layers ----

export interface AddStationLayersOptions {
  map: MapboxMap;
  stations: Station[];
  railways: Railway[];
  slot?: "bottom" | "middle" | "top";
}

function setupStationHover(map: MapboxMap) {
  const popup = new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false,
    offset: 14,
    className: "station-popup",
    maxWidth: "280px",
  });

  let hoveredFeatureId: string | number | null = null;

  for (const layerId of [LAYER_SINGLE, LAYER_INTERCHANGE]) {
    map.on("mouseenter", layerId, (e) => {
      map.getCanvas().style.cursor = "pointer";
      const feature = e.features?.[0];
      if (!feature) return;

      // Set hover state
      if (hoveredFeatureId !== null) {
        map.setFeatureState(
          { source: SOURCE_ID, id: hoveredFeatureId },
          { hover: false },
        );
      }
      hoveredFeatureId = feature.id ?? null;
      if (hoveredFeatureId !== null) {
        map.setFeatureState(
          { source: SOURCE_ID, id: hoveredFeatureId },
          { hover: true },
        );
      }

      // Popup
      const props = feature.properties as {
        title_en: string;
        title_ja: string;
        thumbnail: string;
        lines: string;
      };
      const coords = (feature.geometry as any).coordinates as [number, number];
      const lines: { color: string; titleEn: string }[] = (() => {
        try {
          return JSON.parse(props.lines);
        } catch {
          return [];
        }
      })();

      const thumbnailHtml = props.thumbnail
        ? `<img class="station-popup-thumbnail" src="${props.thumbnail}" alt="${props.title_en}" />`
        : "";

      const linesHtml = lines
        .map(
          (l) => `
          <div class="station-popup-line-item">
            <span class="station-popup-line-swatch" style="background:${l.color}"></span>
            <span class="station-popup-line-name">${l.titleEn}</span>
          </div>
        `,
        )
        .join("");

      popup
        .setLngLat(coords)
        .setHTML(
          `
          ${thumbnailHtml}
          <div class="station-popup-body">
            <div class="station-popup-en">${props.title_en}</div>
            <div class="station-popup-ja">${props.title_ja}</div>
            <div class="station-popup-lines">${linesHtml}</div>
          </div>
        `,
        )
        .addTo(map);
    });

    map.on("mouseleave", layerId, () => {
      map.getCanvas().style.cursor = "";
      popup.remove();

      if (hoveredFeatureId !== null) {
        map.setFeatureState(
          { source: SOURCE_ID, id: hoveredFeatureId },
          { hover: false },
        );
        hoveredFeatureId = null;
      }
    });
  }
}

export function addStationLayers(options: AddStationLayersOptions): void {
  const { map, stations, railways, slot = "middle" } = options;

  injectPopupStyle();
  const data = buildStationsGeoJSON(stations, railways);

  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, { type: "geojson", data, generateId: true });
  }

  // Single-line: trắng giữa, viền màu line
  // Layer SINGLE — thêm opacity
  map.addLayer({
    id: LAYER_SINGLE,
    type: "circle",
    source: SOURCE_ID,
    slot,
    filter: ["==", ["get", "interchange"], false],
    paint: {
      "circle-radius": SINGLE_RADIUS,
      "circle-color": "#ffffff",
      "circle-stroke-color": ["get", "color"],
      "circle-stroke-width": STROKE_WIDTH,
      "circle-opacity": [
        "case",
        ["boolean", ["feature-state", "hover"], false],
        1,
        0.5,
      ],
      "circle-stroke-opacity": [
        "case",
        ["boolean", ["feature-state", "hover"], false],
        1,
        0.6,
      ],
      "circle-emissive-strength": 1,
      "circle-pitch-alignment": "map",
    },
  });

  // Layer INTERCHANGE — thêm opacity
  map.addLayer({
    id: LAYER_INTERCHANGE,
    type: "circle",
    source: SOURCE_ID,
    slot,
    filter: ["==", ["get", "interchange"], true],
    paint: {
      "circle-radius": INTERCHANGE_RADIUS,
      "circle-color": ["get", "color"],
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": STROKE_WIDTH,
      "circle-opacity": [
        "case",
        ["boolean", ["feature-state", "hover"], false],
        1,
        0.5,
      ],
      "circle-stroke-opacity": [
        "case",
        ["boolean", ["feature-state", "hover"], false],
        1,
        0.6,
      ],
      "circle-emissive-strength": 1,
      "circle-pitch-alignment": "map",
    },
  });

  // Labels — chỉ hiện khi zoom đủ cao
  map.addLayer({
    id: LAYER_LABEL,
    type: "symbol",
    source: SOURCE_ID,
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

  setupStationHover(map);
}

export function removeStationLayers(map: MapboxMap): void {
  for (const id of [LAYER_SINGLE, LAYER_INTERCHANGE, LAYER_LABEL]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(SOURCE_ID)) {
    map.removeSource(SOURCE_ID);
  }
}

// Export ID list để Map.tsx move layer khi PLATEAU enable
export const STATION_LAYER_IDS = [
  LAYER_SINGLE,
  LAYER_INTERCHANGE,
  LAYER_LABEL,
] as const;
