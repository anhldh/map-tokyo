import RainLayer from "mapbox-gl-rain-layer";

export interface PrecipitationPluginOptions {
  /** "light" hoặc "dark" — quyết định màu mưa */
  theme?: "light" | "dark";
}

export class PrecipitationPlugin {
  private map: mapboxgl.Map | null = null;
  private layer: RainLayer | null = null;
  private enabled = false;
  private theme: "light" | "dark";

  constructor(options?: PrecipitationPluginOptions) {
    this.theme = options?.theme ?? "dark";
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handleRefresh = this.handleRefresh.bind(this);
  }

  enable(map: mapboxgl.Map) {
    if (this.enabled) return;
    this.map = map;
    this.enabled = true;

    this.layer = new RainLayer({
      id: "precipitation",
      rainColor: this.theme === "dark" ? "#ccf" : "#00f",
      snowColor: this.theme === "dark" ? "#fff" : "#ccf",
      meshOpacity: 0,
      repaint: false,
    });

    // Cast vì rain-layer type không khớp 100% với CustomLayerInterface
    map.addLayer(this.layer as unknown as mapboxgl.AnyLayer);

    // Refresh khi tab visible lại (radar data có thể đã đổi)
    document.addEventListener("visibilitychange", this.handleVisibilityChange);

    // Listen refresh event của layer (mỗi 5 phút) để update màu nếu theme đổi
    this.layer.on("refresh", this.handleRefresh);
  }

  disable() {
    if (!this.enabled) return;

    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange,
    );

    if (this.layer && this.map) {
      this.layer.off("refresh", this.handleRefresh);
      if (this.map.getLayer("precipitation")) {
        this.map.removeLayer("precipitation");
      }
    }

    this.layer = null;
    this.enabled = false;
    this.map = null;
  }

  /** Cập nhật theme khi clock đổi (day → night) */
  setTheme(theme: "light" | "dark") {
    if (this.theme === theme) return;
    this.theme = theme;
    this.applyColors();
  }

  private applyColors() {
    if (!this.layer) return;
    this.layer.setRainColor(this.theme === "dark" ? "#ccf" : "#00f");
    this.layer.setSnowColor(this.theme === "dark" ? "#fff" : "#ccf");
  }

  private handleRefresh() {
    this.applyColors();
  }

  private handleVisibilityChange() {
    if (document.visibilityState === "visible") {
      this.applyColors();
    }
  }
}
