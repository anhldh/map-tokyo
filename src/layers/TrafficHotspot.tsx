// src/components/ui/TrafficHotspots.tsx
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { useLayersStore } from "@/stores/layersStore";
import { ChevronRight, AlertTriangle } from "lucide-react";

interface Hotspot {
  id: string;
  lng: number;
  lat: number;
  severeCount: number;
  heavyCount: number;
  score: number;
  name?: string;
}

const GRID = 0.005; // ~500m
const TOP_N = 10;
const DEBOUNCE_MS = 500;

export function TrafficHotspots({ map }: { map: mapboxgl.Map | null }) {
  const enabled = useLayersStore((s) => s.enabled.has("jam"));

  if (!enabled || !map) return null;

  return <TrafficHotspotsInner map={map} />;
}

function TrafficHotspotsInner({ map }: { map: mapboxgl.Map }) {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const nameCacheRef = useRef<Map<string, string>>(new Map());
  const debounceRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const compute = async () => {
      const features = map.querySourceFeatures("mapbox-traffic", {
        sourceLayer: "traffic",
      });

      const buckets = new Map<
        string,
        { severe: number; heavy: number; lng: number; lat: number; n: number }
      >();

      for (const f of features) {
        const c = f.properties?.congestion;
        if (c !== "severe" && c !== "heavy") continue;

        const geom = f.geometry;
        let coord: [number, number] | null = null;
        if (geom.type === "LineString") {
          const mid = geom.coordinates[Math.floor(geom.coordinates.length / 2)];
          coord = [mid[0], mid[1]];
        } else if (geom.type === "MultiLineString") {
          const line = geom.coordinates[0];
          const mid = line[Math.floor(line.length / 2)];
          coord = [mid[0], mid[1]];
        }
        if (!coord) continue;

        const key = `${Math.round(coord[0] / GRID)}:${Math.round(coord[1] / GRID)}`;
        const b = buckets.get(key) ?? {
          severe: 0,
          heavy: 0,
          lng: 0,
          lat: 0,
          n: 0,
        };
        if (c === "severe") b.severe++;
        else b.heavy++;
        b.lng += coord[0];
        b.lat += coord[1];
        b.n++;
        buckets.set(key, b);
      }

      const list: Hotspot[] = [];
      for (const [id, b] of buckets) {
        list.push({
          id,
          lng: b.lng / b.n,
          lat: b.lat / b.n,
          severeCount: b.severe,
          heavyCount: b.heavy,
          score: b.severe * 3 + b.heavy,
        });
      }
      list.sort((a, b) => b.score - a.score);
      const top = list.slice(0, TOP_N);

      const initial = top.map((h) => ({
        ...h,
        name: nameCacheRef.current.get(h.id),
      }));
      setHotspots(initial);

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      const toFetch = top.filter((h) => !nameCacheRef.current.has(h.id));
      if (toFetch.length === 0) return;

      const results = await Promise.all(
        toFetch.map(async (h) => {
          try {
            const url =
              `https://api.mapbox.com/geocoding/v5/mapbox.places/${h.lng},${h.lat}.json?` +
              `access_token=${mapboxgl.accessToken}&` +
              `language=vi,ja,en&` +
              `types=neighborhood,locality,place&limit=1`;
            const res = await fetch(url, { signal: ac.signal });
            const data = await res.json();
            const feat = data.features?.[0];
            const name = feat?.text ?? feat?.place_name?.split(",")[0] ?? null;
            return { id: h.id, name };
          } catch {
            return { id: h.id, name: null };
          }
        }),
      );

      if (ac.signal.aborted) return;

      for (const r of results) {
        if (r.name) nameCacheRef.current.set(r.id, r.name);
      }

      setHotspots((prev) =>
        prev.map((h) => ({
          ...h,
          name: nameCacheRef.current.get(h.id) ?? h.name,
        })),
      );
    };

    const scheduled = () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(compute, DEBOUNCE_MS);
    };

    compute();
    map.on("moveend", scheduled);
    map.on("sourcedata", scheduled);

    return () => {
      map.off("moveend", scheduled);
      map.off("sourcedata", scheduled);
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, [map]);

  if (hotspots.length === 0) return null;

  const flyTo = (h: Hotspot) => {
    map.flyTo({ center: [h.lng, h.lat], zoom: 16, duration: 1200 });
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 80,
        right: 16,
        width: 300,
        background: "rgba(15,15,25,0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
        color: "#fff",
        zIndex: 5,
        maxHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
      }}
    >
      <div
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <AlertTriangle size={16} style={{ color: "#FF6E40" }} />
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: 0.3 }}>
          ĐIỂM NÓNG TẮC ĐƯỜNG
        </span>
      </div>

      <div
        style={{
          overflowY: "auto",
          flex: 1,
          minHeight: 0,
          scrollbarColor: "rgba(255,255,255,0.1) transparent",
        }}
      >
        {hotspots.map((h, i) => (
          <button
            key={h.id}
            onClick={() => flyTo(h)}
            style={{
              width: "100%",
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: "transparent",
              border: "none",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
              color: "#fff",
              cursor: "pointer",
              textAlign: "left",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.05)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: i < 3 ? "#FF1744" : "#FF6E40",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
                flexShrink: 0,
                boxShadow: i < 3 ? "0 0 12px rgba(255,23,68,0.5)" : "none",
              }}
            >
              {i + 1}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {h.name ?? (
                  <span style={{ opacity: 0.5 }}>
                    {h.lat.toFixed(3)}, {h.lng.toFixed(3)}
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: 11,
                  opacity: 0.65,
                  marginTop: 2,
                  display: "flex",
                  gap: 10,
                }}
              >
                {h.severeCount > 0 && (
                  <span style={{ color: "#FF1744" }}>
                    ● {h.severeCount} cứng
                  </span>
                )}
                {h.heavyCount > 0 && (
                  <span style={{ color: "#FF6E40" }}>
                    ● {h.heavyCount} nặng
                  </span>
                )}
              </div>
            </div>
            <ChevronRight size={14} style={{ opacity: 0.4, flexShrink: 0 }} />
          </button>
        ))}
      </div>
    </div>
  );
}
