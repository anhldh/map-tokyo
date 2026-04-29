import { AmbientLight, DirectionalLight, LightingEffect } from "@deck.gl/core";
import { Tile3DLayer } from "@deck.gl/geo-layers";
import { MapboxLayer } from "@deck.gl/mapbox";
import SunCalc from "suncalc";

const MODEL_URL = "https://mini-tokyo.appspot.com/plateau-models.geojson";
const GSI_ORTHO_URL =
  "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg";
const PLATEAU_ORTHO_URL =
  "https://api.plateauview.mlit.go.jp/tiles/plateau-ortho-2023/{z}/{x}/{y}.png";

const GSI_ATTR =
  '<a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>';
const PLATEAU_ATTR =
  '<a href="https://www.mlit.go.jp/plateau/">国土交通省Project PLATEAU</a>';

export class PlateauPlugin {
  private map: mapboxgl.Map | null = null;
  private enabled = false;
  private layerCodes = new Set<string>();
  private hiddenMapboxLayers: string[] = [];
  private deckEffectsApplied = false;
  private onLayerAdded?: () => void;

  setOnLayerAdded(cb: () => void) {
    this.onLayerAdded = cb;
  }

  private ambientLight = new AmbientLight({
    color: [255, 255, 255],
    intensity: 3.0,
  });
  private directionalLight = new DirectionalLight({
    color: [255, 255, 255],
    intensity: 9.0,
    direction: [0, 0, -1],
  });

  constructor() {
    this.updateLayers = this.updateLayers.bind(this);
  }

  private lastLightUpdate = 0;

  updateLighting(date: Date) {
    const map = this.map;
    if (!map || !this.enabled || !this.deckEffectsApplied) return;

    // Throttle: chỉ update mỗi phút (đủ smooth, tránh spam)
    const t = date.getTime();
    if (t - this.lastLightUpdate < 60000) return;
    this.lastLightUpdate = t;

    const center = map.getCenter();
    const sun = SunCalc.getPosition(date, center.lat, center.lng);
    const azimuth = Math.PI + sun.azimuth;
    const altitude = -sun.altitude;

    // Tính màu ánh sáng theo độ cao mặt trời
    // altitude > 0: ban ngày, < 0: ban đêm
    const dayness = Math.max(0, Math.min(1, (sun.altitude + 0.1) / 0.5));
    const r = Math.round(255 * (0.3 + 0.7 * dayness));
    const g = Math.round(255 * (0.3 + 0.7 * dayness));
    const b = Math.round(255 * (0.4 + 0.6 * dayness));

    this.ambientLight.color = [r, g, b];
    this.ambientLight.intensity = 1.5 + 1.5 * dayness;

    this.directionalLight.color = [r, g, b];
    this.directionalLight.intensity = 2 + 7 * dayness;
    this.directionalLight.direction = [
      Math.sin(azimuth) * Math.cos(altitude),
      Math.cos(azimuth) * Math.cos(altitude),
      -Math.sin(altitude),
    ];
  }

  enable(map: mapboxgl.Map) {
    if (this.enabled) return;
    this.map = map;
    this.enabled = true;

    this.hideMapboxBuildings();

    // Ortho rasters
    map.addSource("gsi-ortho-src", {
      type: "raster",
      tiles: [GSI_ORTHO_URL],
      tileSize: 256,
      maxzoom: 18,
      minzoom: 2,
      attribution: GSI_ATTR,
    });
    map.addLayer({ id: "gsi-ortho", type: "raster", source: "gsi-ortho-src" });

    map.addSource("plateau-ortho-src", {
      type: "raster",
      tiles: [PLATEAU_ORTHO_URL],
      tileSize: 256,
      maxzoom: 19,
      minzoom: 10,
      attribution: PLATEAU_ATTR,
    });
    map.addLayer({
      id: "plateau-ortho",
      type: "raster",
      source: "plateau-ortho-src",
    });

    // GeoJSON polygon chứa URL tileset của từng quận
    map.addSource("plateau-model-src", {
      type: "geojson",
      data: MODEL_URL,
    });
    map.addLayer({
      id: "plateau-model",
      type: "fill",
      source: "plateau-model-src",
      paint: { "fill-opacity": 0 },
    });

    map.on("move", this.updateLayers);

    // Lần đầu: đợi geojson load xong
    if (map.isSourceLoaded("plateau-model-src")) {
      this.updateLayers();
    } else {
      map.once("idle", this.updateLayers);
    }
  }

  disable() {
    const map = this.map;
    if (!map || !this.enabled) return;

    map.off("move", this.updateLayers);

    for (const code of this.layerCodes) {
      const id = `tile-3d-${code}`;
      if (map.getLayer(id)) map.removeLayer(id);
    }
    this.layerCodes.clear();

    for (const id of ["plateau-model", "plateau-ortho", "gsi-ortho"]) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
    for (const id of [
      "plateau-model-src",
      "plateau-ortho-src",
      "gsi-ortho-src",
    ]) {
      if (map.getSource(id)) map.removeSource(id);
    }

    this.restoreMapboxBuildings();
    this.deckEffectsApplied = false;

    this.enabled = false;
    this.map = null;
  }

  private hideMapboxBuildings() {
    const map = this.map!;
    this.hiddenMapboxLayers = [];
    try {
      map.setConfigProperty("basemap", "show3dObjects", false);
    } catch {
      const style = map.getStyle();
      for (const layer of style?.layers ?? []) {
        if (layer.type === "fill-extrusion") {
          map.setLayoutProperty(layer.id, "visibility", "none");
          this.hiddenMapboxLayers.push(layer.id);
        }
      }
    }
  }

  private restoreMapboxBuildings() {
    const map = this.map!;
    try {
      map.setConfigProperty("basemap", "show3dObjects", true);
    } catch {
      // ignore
    }
    for (const id of this.hiddenMapboxLayers) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "visible");
    }
    this.hiddenMapboxLayers = [];
  }

  private applyDeckEffects() {
    if (this.deckEffectsApplied) return;
    const deck = (this.map as any)?.__deck;
    if (!deck) return;
    deck.props.effects = [
      new LightingEffect({
        ambientLight: this.ambientLight,
        directionalLight: this.directionalLight,
      }),
    ];
    this.deckEffectsApplied = true;
  }

  private updateLayers() {
    const map = this.map;
    if (!map) return;

    const { width, height } = map.getContainer().getBoundingClientRect();
    const features = map.queryRenderedFeatures(
      [width / 2, height / 2] as [number, number],
      { layers: ["plateau-model"] },
    );

    const toRemove = new Set(this.layerCodes);

    for (const f of features) {
      const code = f.properties?.code as string | undefined;
      const url = f.properties?.url as string | undefined;
      if (!code || !url) continue;

      toRemove.delete(code);
      if (this.layerCodes.has(code)) continue;

      const layerId = `tile-3d-${code}`;

      // MapboxLayer wrap Tile3DLayer của deck.gl
      const mapboxLayer = new MapboxLayer({
        id: layerId,
        type: Tile3DLayer,
        data: url,
        loadOptions: {
          tileset: {
            throttleRequests: true,
            maxRequests: 12,
          },
          worker: true,
        },
        opacity: 0.8,
        onTileLoad: (tile: any) => {
          const content = tile.content;
          if (!content) return;

          const zmin = content.batchTableJson?._zmin;
          const origin = content.cartographicOrigin;

          // Căn độ cao theo z-min của batch (theo cách mini-tokyo)
          if (zmin && origin && content.batchTableBinary) {
            const buf = content.batchTableBinary.buffer;
            const len = content.featureTableJson.BATCH_LENGTH;
            const view = new DataView(buf, zmin.byteOffset, len * 8);
            const zMins: number[] = [];
            for (let i = 0; i < len; i++) {
              zMins.push(view.getFloat64(i * 8, true));
            }
            zMins.sort((a, b) => a - b);
            origin.z -= zMins[Math.floor(len / 2)];
          }
          if (origin) origin.z -= 36.6641;

          // Giải phóng bộ nhớ batch table
          content.featureTableBinary = null;
          content.featureTableJson = null;
          content.batchTableBinary = null;
          content.batchTableJson = null;

          // Resize texture cho nhẹ — async, không block scenegraph build
          for (const item of content.gltf?.images || []) {
            const img = item.image;
            if (!img?.width || !img?.height) continue;
            const rw = Math.max(1, img.width / 4);
            const rh = Math.max(1, img.height / 4);
            createImageBitmap(img, {
              resizeWidth: rw,
              resizeHeight: rh,
            }).then((resized) => {
              item.image = resized;
            });
          }
        },
      });

      // addLayer trước layer label/POI để buildings không che chữ
      map.addLayer(mapboxLayer as unknown as mapboxgl.AnyLayer);

      this.layerCodes.add(code);
      this.onLayerAdded?.();

      // Set zoom range — Tile3DLayer tự throttle khi out of range
      try {
        map.setLayerZoomRange(layerId, 13, 24);
      } catch {
        // ignore
      }

      // Apply lighting effect cho deck instance (chỉ 1 lần)
      this.applyDeckEffects();

      this.layerCodes.add(code);
    }

    for (const code of toRemove) {
      const id = `tile-3d-${code}`;
      if (map.getLayer(id)) map.removeLayer(id);
      this.layerCodes.delete(code);
    }
  }
}
