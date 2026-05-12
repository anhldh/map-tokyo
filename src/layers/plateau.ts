import { AmbientLight, DirectionalLight, LightingEffect } from "@deck.gl/core";
import { Tile3DLayer } from "@deck.gl/geo-layers";
import { MapboxLayer } from "@deck.gl/mapbox";
import SunCalc from "suncalc";

const MODEL_URL = "https://mini-tokyo.appspot.com/plateau-models.geojson";
const MOVE_DEBOUNCE_MS = 200;
// BỎ PRELOAD_PADDING — chỉ load đúng quận trong viewport

export class PlateauPlugin {
  private map: mapboxgl.Map | null = null;
  private enabled = false;
  private layerCodes = new Set<string>();
  private hiddenMapboxLayers: string[] = [];
  private deckEffectsApplied = false;
  private onLayerAdded?: () => void;

  private moveTimer: number | null = null;
  private lastLightUpdate = 0;

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
    this.scheduleUpdate = this.scheduleUpdate.bind(this);
  }

  setOnLayerAdded(cb: () => void) {
    this.onLayerAdded = cb;
  }

  enable(map: mapboxgl.Map) {
    if (this.enabled) return;
    this.map = map;
    this.enabled = true;

    this.hideMapboxBuildings();

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

    map.on("move", this.scheduleUpdate);
    map.on("moveend", this.updateLayers);

    if (map.isSourceLoaded("plateau-model-src")) {
      this.updateLayers();
    } else {
      map.once("idle", this.updateLayers);
    }
  }

  disable() {
    const map = this.map;
    if (!map || !this.enabled) return;

    if (this.moveTimer) {
      window.clearTimeout(this.moveTimer);
      this.moveTimer = null;
    }

    map.off("move", this.scheduleUpdate);
    map.off("moveend", this.updateLayers);

    for (const code of this.layerCodes) {
      const id = `tile-3d-${code}`;
      if (map.getLayer(id)) map.removeLayer(id);
    }
    this.layerCodes.clear();

    if (map.getLayer("plateau-model")) map.removeLayer("plateau-model");
    if (map.getSource("plateau-model-src"))
      map.removeSource("plateau-model-src");

    this.restoreMapboxBuildings();
    this.deckEffectsApplied = false;

    this.enabled = false;
    this.map = null;
  }

  updateLighting(date: Date) {
    const map = this.map;
    if (!map || !this.enabled || !this.deckEffectsApplied) return;

    const t = date.getTime();
    if (t - this.lastLightUpdate < 60000) return;
    this.lastLightUpdate = t;

    const center = map.getCenter();
    const sun = SunCalc.getPosition(date, center.lat, center.lng);
    const azimuth = Math.PI + sun.azimuth;
    const altitude = -sun.altitude;

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

  private scheduleUpdate() {
    if (this.moveTimer) return;
    this.moveTimer = window.setTimeout(() => {
      this.moveTimer = null;
      this.updateLayers();
    }, MOVE_DEBOUNCE_MS);
  }

  private updateLayers() {
    const map = this.map;
    if (!map) return;

    const { width, height } = map.getContainer().getBoundingClientRect();

    // QUAY VỀ query point ở center — chỉ load 1 quận tại 1 thời điểm
    // Hoặc query bbox nhưng không padding (chỉ trong viewport thật sự)
    const features = map.queryRenderedFeatures(
      [
        [0, 0],
        [width, height],
      ],
      { layers: ["plateau-model"] },
    );

    const toRemove = new Set(this.layerCodes);

    for (const f of features) {
      const code = f.properties?.code as string | undefined;
      const url = f.properties?.url as string | undefined;
      if (!code || !url) continue;

      toRemove.delete(code);
      if (this.layerCodes.has(code)) continue;

      this.addTile3DLayer(code, url);
    }

    for (const code of toRemove) {
      const id = `tile-3d-${code}`;
      if (map.getLayer(id)) map.removeLayer(id);
      this.layerCodes.delete(code);
    }
  }

  private addTile3DLayer(code: string, url: string) {
    const map = this.map;
    if (!map) return;

    const layerId = `tile-3d-${code}`;

    const mapboxLayer = new MapboxLayer({
      id: layerId,
      type: Tile3DLayer,
      data: url,
      loadOptions: {
        tileset: {
          throttleRequests: true, // GIỮ throttle
          maxRequests: 12, // VỀ lại 12
        },
        worker: true,
      },
      opacity: 0.8,
      onTileLoad: this.handleTileLoad,
    });

    map.addLayer(mapboxLayer as unknown as mapboxgl.AnyLayer);
    this.layerCodes.add(code);
    this.onLayerAdded?.();

    try {
      map.setLayerZoomRange(layerId, 13, 24);
    } catch {
      /* empty */
    }

    this.applyDeckEffects();
  }

  private handleTileLoad = (tile: any) => {
    const content = tile.content;
    if (!content) return;

    const zmin = content.batchTableJson?._zmin;
    const origin = content.cartographicOrigin;

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

    content.featureTableBinary = null;
    content.featureTableJson = null;
    content.batchTableBinary = null;
    content.batchTableJson = null;

    // GIỮ texture resize — quan trọng để không OOM
    for (const item of content.gltf?.images || []) {
      const img = item.image;
      if (!img?.width || !img?.height) continue;
      const rw = Math.max(1, Math.floor(img.width / 4));
      const rh = Math.max(1, Math.floor(img.height / 4));
      createImageBitmap(img, {
        resizeWidth: rw,
        resizeHeight: rh,
      })
        .then((resized) => {
          item.image = resized;
          // Free image cũ
          if (typeof img.close === "function") img.close();
        })
        .catch(() => {});
    }
  };

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
      /* empty */
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
}
