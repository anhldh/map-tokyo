// src/layers/AirQualityLayer.tsx (chỉ phần useEffect load)
import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { Global, css } from "@emotion/react";
import {
  fetchTokyoLocations,
  fetchLocationLatest,
  filterAirQualityLocations,
  pm25ToAqi,
  type AQLocation,
  type AQSensor,
} from "@/services/openaq";

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

  /* Light */
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

  /* Dark */
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

  /* Common */
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

const SOURCE_ID = "air-quality-src";
const LAYER_ID = "air-quality-circles";
const POLL_MS = 30 * 60 * 1000;
const CONCURRENCY = 5;

interface ReadingByParam {
  [paramKey: string]: { value: number; unit: string; datetime: string };
}

interface Props {
  map: mapboxgl.Map | null;
  enabled: boolean;
}

export default function AirQualityLayer({ map, enabled }: Props) {
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const handlersRef = useRef<{
    click?: (e: mapboxgl.MapMouseEvent) => void;
    enter?: () => void;
    leave?: () => void;
  }>({});

  useEffect(() => {
    if (!map || !enabled) return;
    let cancelled = false;
    // let intervalId: number | null = null;

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
            "circle-opacity": 0.8,
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-opacity": 0.9,
          },
        });
      }
    };

    const buildFeature = (
      loc: AQLocation,
      readings: ReadingByParam,
    ): GeoJSON.Feature => {
      const pm25 = readings.pm25;
      let color = "#888888";
      let aqi: number | null = null;
      let label = "No PM2.5";
      if (pm25) {
        const r = pm25ToAqi(pm25.value);
        color = r.color;
        aqi = r.aqi;
        label = r.label;
      } else if (readings.pm10) {
        color = "#aaaaaa";
        label = "PM10 only";
      }
      const latestDt = Object.values(readings)
        .map((r) => r.datetime)
        .sort()
        .pop();
      return {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [loc.coordinates.longitude, loc.coordinates.latitude],
        },
        properties: {
          locationName: loc.name,
          locationsId: loc.id,
          color,
          aqi,
          label,
          datetime: latestDt ?? "",
          readings: JSON.stringify(readings),
        },
      };
    };

    const load = async () => {
      try {
        const allLocations = await fetchTokyoLocations();
        if (cancelled) return;

        const locations = filterAirQualityLocations(allLocations);
        console.log(
          `[AirQuality] tokyo total=${allLocations.length}, with air sensors=${locations.length}`,
        );

        const sensorInfo = new Map<number, AQSensor>();
        for (const loc of locations) {
          for (const s of loc.sensors ?? []) sensorInfo.set(s.id, s);
        }

        ensureLayer();
        const src = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource;
        const features: GeoJSON.Feature[] = [];
        let pending = 0;
        let flushTimer: number | null = null;

        // Flush throttle: gom feature mới rồi setData mỗi 200ms
        const scheduleFlush = () => {
          if (flushTimer !== null) return;
          flushTimer = window.setTimeout(() => {
            flushTimer = null;
            if (cancelled) return;
            src.setData({ type: "FeatureCollection", features: [...features] });
          }, 200);
        };

        // Pool worker
        let cursor = 0;
        const worker = async () => {
          while (!cancelled) {
            const i = cursor++;
            if (i >= locations.length) return;
            const loc = locations[i];
            try {
              const latest = await fetchLocationLatest(loc.id);
              if (cancelled) return;
              if (!latest.length) continue;
              const readings: ReadingByParam = {};
              for (const m of latest) {
                const sensor = sensorInfo.get(m.sensorsId);
                if (!sensor) continue;
                if (!Number.isFinite(m.value) || m.value < 0) continue;
                readings[sensor.parameter.name] = {
                  value: m.value,
                  unit: sensor.parameter.units,
                  datetime: m.datetime.local,
                };
              }
              if (!Object.keys(readings).length) continue;
              features.push(buildFeature(loc, readings));
              scheduleFlush();
            } catch (err) {
              console.warn(`[AirQuality] loc ${loc.id} failed`, err);
            }
            pending++;
          }
        };

        await Promise.all(
          Array.from(
            { length: Math.min(CONCURRENCY, locations.length) },
            worker,
          ),
        );
        if (cancelled) return;
        // Flush cuối
        if (flushTimer !== null) window.clearTimeout(flushTimer);
        src.setData({ type: "FeatureCollection", features });
        console.log(
          `[AirQuality] tokyo_locs=${locations.length} with_data=${features.length}`,
        );
      } catch (err) {
        console.error("[AirQuality] fetch failed", err);
      }
    };

    const onClick = (e: mapboxgl.MapMouseEvent) => {
      const fts = map.queryRenderedFeatures(e.point, { layers: [LAYER_ID] });
      const f = fts[0];
      if (!f || f.geometry.type !== "Point") return;
      const p = f.properties as {
        locationName: string;
        color: string;
        aqi: number | null;
        label: string;
        readings: string;
        datetime: string;
      };
      const readings: ReadingByParam = JSON.parse(p.readings);

      const rows = Object.entries(readings)
        .map(
          ([k, v]) =>
            `<tr>
           <td class="aq-row-key">${k.toUpperCase()}</td>
           <td class="aq-row-value">${v.value.toFixed(1)} ${v.unit}</td>
         </tr>`,
        )
        .join("");

      const aqiBadge = p.aqi
        ? `<div class="aq-badge">
         <span class="aq-dot" style="background:${p.color};"></span>
         <span><strong>AQI ${p.aqi}</strong> · ${p.label}</span>
       </div>`
        : `<div class="aq-badge aq-label-muted">${p.label}</div>`;

      const html = `
    <div class="aq-title">${p.locationName}</div>
    ${aqiBadge}
    <table class="aq-table">${rows}</table>
    <div class="aq-time aq-label-muted">
      ${p.datetime ? new Date(p.datetime).toLocaleString() : ""}
    </div>
  `;

      popupRef.current?.remove();
      popupRef.current = new mapboxgl.Popup({
        closeButton: true,
        closeOnClick: true,
        offset: 12,
        className: `aq-popup`,
      })
        .setLngLat(
          (f.geometry as GeoJSON.Point).coordinates as [number, number],
        )
        .setHTML(html)
        .addTo(map);
    };
    const onEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const onLeave = () => {
      map.getCanvas().style.cursor = "";
    };

    handlersRef.current = { click: onClick, enter: onEnter, leave: onLeave };
    map.on("click", LAYER_ID, onClick);
    map.on("mouseenter", LAYER_ID, onEnter);
    map.on("mouseleave", LAYER_ID, onLeave);

    load();
    // intervalId = window.setInterval(load, POLL_MS);

    return () => {
      cancelled = true;
      // if (intervalId !== null) window.clearInterval(intervalId);
      const h = handlersRef.current;
      if (h.click) map.off("click", LAYER_ID, h.click);
      if (h.enter) map.off("mouseenter", LAYER_ID, h.enter);
      if (h.leave) map.off("mouseleave", LAYER_ID, h.leave);
      popupRef.current?.remove();
      popupRef.current = null;
      if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      map.getCanvas().style.cursor = "";
    };
  }, [map, enabled]);

  return <Global styles={popupStyles} />;
}
