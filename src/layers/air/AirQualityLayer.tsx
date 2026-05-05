import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { Global, css } from "@emotion/react";
import {
  fetchTokyoStations,
  fetchStationDetail,
  aqiToColor,
} from "@/services/waqi";
import { useClockStore } from "@/stores/clockStore";

const SOURCE_ID = "air-quality-src";
const LAYER_ID = "air-quality-circles";
const REFRESH_MS = 15 * 60 * 1000;

const popupStyles = css`
  .aq-popup .mapboxgl-popup-content {
    padding: 12px 32px 12px 14px;
    border-radius: 10px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
    font-family:
      system-ui,
      -apple-system,
      sans-serif;
    font-size: 13px;
    min-width: 200px;
    line-height: 1.4;
  }
  .aq-popup .mapboxgl-popup-close-button {
    position: absolute;
    top: 6px;
    right: 8px;
    width: 22px;
    height: 22px;
    font-size: 18px;
    line-height: 1;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: background 0.15s;
  }
  .aq-popup.aq-light .mapboxgl-popup-content {
    background: #ffffff;
    color: #1a1a1a;
  }
  .aq-popup.aq-light .mapboxgl-popup-tip {
    border-top-color: #ffffff;
    border-bottom-color: #ffffff;
  }
  .aq-popup.aq-light .mapboxgl-popup-close-button {
    color: #555;
  }
  .aq-popup.aq-light .mapboxgl-popup-close-button:hover {
    background: rgba(0, 0, 0, 0.08);
    color: #000;
  }
  .aq-popup.aq-light .aq-row-key {
    color: #666;
  }
  .aq-popup.aq-light .aq-row-value {
    color: #111;
  }
  .aq-popup.aq-light .aq-time,
  .aq-popup.aq-light .aq-label-muted {
    color: #777;
  }

  .aq-popup.aq-dark .mapboxgl-popup-content {
    background: #1f1f23;
    color: #eaeaea;
  }
  .aq-popup.aq-dark .mapboxgl-popup-tip {
    border-top-color: #1f1f23;
    border-bottom-color: #1f1f23;
  }
  .aq-popup.aq-dark .mapboxgl-popup-close-button {
    color: #aaa;
  }
  .aq-popup.aq-dark .mapboxgl-popup-close-button:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }
  .aq-popup.aq-dark .aq-row-key {
    color: #bbb;
  }
  .aq-popup.aq-dark .aq-row-value {
    color: #fff;
  }
  .aq-popup.aq-dark .aq-time,
  .aq-popup.aq-dark .aq-label-muted {
    color: #888;
  }

  .aq-popup .aq-title {
    font-weight: 600;
    margin-bottom: 8px;
    padding-right: 4px;
  }
  .aq-popup .aq-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  .aq-popup .aq-dot {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .aq-popup .aq-table {
    border-collapse: collapse;
    width: 100%;
  }
  .aq-popup .aq-row-key {
    padding: 2px 12px 2px 0;
    white-space: nowrap;
  }
  .aq-popup .aq-row-value {
    padding: 2px 0;
    font-weight: 500;
  }
  .aq-popup .aq-time {
    font-size: 11px;
    margin-top: 8px;
  }
`;

interface Props {
  map: mapboxgl.Map | null;
  enabled: boolean;
}

export default function AirQualityLayer({ map, enabled }: Props) {
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const lightPreset = useClockStore((s) => s.lightPreset);
  const popupTheme = lightPreset === "day" ? "aq-light" : "aq-dark";

  useEffect(() => {
    if (!map || !enabled) return;
    let cancelled = false;
    let intervalId: number | null = null;

    const ensureLayer = () => {
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      }
      if (!map.getLayer(LAYER_ID)) {
        map.addLayer({
          id: LAYER_ID,
          type: "circle",
          source: SOURCE_ID,
          slot: "top",
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              8,
              6,
              14,
              14,
              18,
              22,
            ],
            "circle-color": ["get", "color"],
            "circle-opacity": 0.85,
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-opacity": 0.9,
          },
        });
      }
    };

    const load = async () => {
      try {
        const stations = await fetchTokyoStations();
        if (cancelled) return;

        const features: GeoJSON.Feature[] = [];
        for (const s of stations) {
          const aqiNum = Number(s.aqi);
          if (!Number.isFinite(aqiNum)) continue;
          const { color, label } = aqiToColor(aqiNum);
          features.push({
            type: "Feature",
            geometry: { type: "Point", coordinates: [s.lon, s.lat] },
            properties: {
              uid: s.uid,
              stationName: s.station.name,
              time: s.station.time,
              aqi: aqiNum,
              label,
              color,
            },
          });
        }

        ensureLayer();
        const src = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource;
        src.setData({ type: "FeatureCollection", features });
        console.log(`[WAQI] stations=${features.length}`);
      } catch (err) {
        console.error("[WAQI] fetch failed", err);
      }
    };

    const renderPopupHtml = (
      stationName: string,
      aqi: number,
      label: string,
      color: string,
      detailHtml: string,
      timeStr: string,
    ) => `
      <div class="aq-title">${stationName}</div>
      <div class="aq-badge">
        <span class="aq-dot" style="background:${color};"></span>
        <span><strong>AQI ${aqi}</strong> · ${label}</span>
      </div>
      ${detailHtml}
      <div class="aq-time aq-label-muted">${timeStr}</div>
    `;

    const onClick = async (e: mapboxgl.MapMouseEvent) => {
      const fts = map.queryRenderedFeatures(e.point, { layers: [LAYER_ID] });
      const f = fts[0];
      if (!f || f.geometry.type !== "Point") return;
      const p = f.properties as {
        uid: number;
        stationName: string;
        aqi: number;
        label: string;
        color: string;
        time: string;
      };
      const coords = (f.geometry as GeoJSON.Point).coordinates as [
        number,
        number,
      ];

      // Popup tạm với data có sẵn
      popupRef.current?.remove();
      const popup = new mapboxgl.Popup({
        closeButton: true,
        closeOnClick: true,
        offset: 12,
        className: `aq-popup ${popupTheme}`,
      })
        .setLngLat(coords)
        .setHTML(
          renderPopupHtml(
            p.stationName,
            p.aqi,
            p.label,
            p.color,
            `<div class="aq-label-muted" style="margin-bottom:6px;">Loading details...</div>`,
            p.time ? new Date(p.time).toLocaleString() : "",
          ),
        )
        .addTo(map);
      popupRef.current = popup;

      // Lấy detail
      const detail = await fetchStationDetail(p.uid);
      if (cancelled || popupRef.current !== popup) return;
      if (!detail) {
        popup.setHTML(
          renderPopupHtml(
            p.stationName,
            p.aqi,
            p.label,
            p.color,
            `<div class="aq-label-muted">Không lấy được chi tiết</div>`,
            p.time ? new Date(p.time).toLocaleString() : "",
          ),
        );
        return;
      }

      const rows = Object.entries(detail.iaqi)
        .map(
          ([k, { v }]) =>
            `<tr><td class="aq-row-key">${k.toUpperCase()}</td><td class="aq-row-value">${v}</td></tr>`,
        )
        .join("");

      popup.setHTML(
        renderPopupHtml(
          p.stationName,
          p.aqi,
          p.label,
          p.color,
          `<table class="aq-table">${rows}</table>`,
          new Date(detail.time.iso).toLocaleString(),
        ),
      );
    };

    const onEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const onLeave = () => {
      map.getCanvas().style.cursor = "";
    };

    map.on("click", LAYER_ID, onClick);
    map.on("mouseenter", LAYER_ID, onEnter);
    map.on("mouseleave", LAYER_ID, onLeave);

    load();
    intervalId = window.setInterval(load, REFRESH_MS);

    return () => {
      cancelled = true;
      if (intervalId !== null) window.clearInterval(intervalId);
      map.off("click", LAYER_ID, onClick);
      map.off("mouseenter", LAYER_ID, onEnter);
      map.off("mouseleave", LAYER_ID, onLeave);
      popupRef.current?.remove();
      popupRef.current = null;
      if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      map.getCanvas().style.cursor = "";
    };
  }, [map, enabled, popupTheme]);

  return <Global styles={popupStyles} />;
}
