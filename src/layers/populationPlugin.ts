// src/plugins/populationPlugin.ts
import { HexagonLayer } from "@deck.gl/aggregation-layers";
import { MapboxLayer } from "@deck.gl/mapbox";
import type mapboxgl from "mapbox-gl";
import type { Dayjs } from "dayjs";
import {
  generatePopulation,
  type PopulationPoint,
  type PopulationStation,
} from "@/data/populationFake";

export class PopulationPlugin {
  private map: mapboxgl.Map | null = null;
  private enabled = false;
  private stations: PopulationStation[] = [];
  private layerId = "population-hexagon";
  private currentTime: Dayjs | null = null;

  setStations(stations: PopulationStation[]) {
    this.stations = stations;
    // Nếu đang enabled, re-render với stations mới
    if (this.enabled && this.currentTime) {
      this.renderLayer(this.currentTime);
    }
  }

  enable(map: mapboxgl.Map, time: Dayjs) {
    if (this.enabled) return;
    this.map = map;
    this.enabled = true;
    this.currentTime = time;
    if (this.stations.length > 0) {
      this.renderLayer(time);
    }
  }

  disable() {
    const map = this.map;
    if (!map) return;
    if (map.getLayer(this.layerId)) map.removeLayer(this.layerId);
    this.enabled = false;
    this.map = null;
    this.currentTime = null;
  }

  /** Gọi khi clock thay đổi */
  updateTime(time: Dayjs) {
    if (!this.enabled || !this.map) return;
    this.currentTime = time;
    this.renderLayer(time);
  }

  private renderLayer(time: Dayjs) {
    const map = this.map;
    if (!map || this.stations.length === 0) return;

    const data = generatePopulation(this.stations, time);

    // Recreate layer (HexagonLayer aggregation cần re-build)
    if (map.getLayer(this.layerId)) map.removeLayer(this.layerId);

    // Off-peak / đêm: không có hotspot nào → để map sạch
    if (data.length === 0) return;

    // src/plugins/populationPlugin.ts — chỉ sửa block layer

    // Chỉ thay thế block tạo layer bên trong renderLayer()

    const layer = new MapboxLayer({
      id: this.layerId,
      type: HexagonLayer,
      data,
      getPosition: (d: PopulationPoint) => [d.lon, d.lat],
      getElevationWeight: (d: PopulationPoint) => d.weight,
      getColorWeight: (d: PopulationPoint) => d.weight,
      radius: 200, // Thu nhỏ radius của hex xuống một chút để nhìn rõ các con đường/block phố hơn (tùy chọn)
      elevationScale: 3, // Giảm scale xuống vì giờ point gom rất đặc
      extruded: true,
      pickable: true,
      coverage: 0.85,
      opacity: 0.8,
      colorRange: [
        // Baseline (Vắng / Rải rác)
        [43, 131, 186, 150],
        [171, 221, 164, 180],
        // Mid (Đông vừa)
        [255, 255, 191, 210],
        [253, 174, 97, 230],
        // Hotspot (Kẹt cứng)
        [215, 25, 28, 255],
        [150, 0, 0, 255],
      ],
      // NÂNG DOMAIN LÊN: vì lúc này point gom rất chặt, một hex 200m có thể chứa hàng chục point
      colorDomain: [5, 120],
      elevationDomain: [5, 120],
      upperPercentile: 98, // Lọc bớt 2% các hex quá dị biệt để các hex xung quanh vẫn hiện rõ
      material: { ambient: 0.6, diffuse: 0.6, shininess: 32 },
      transitions: { elevationScale: 800 },
    });

    map.addLayer(layer as unknown as mapboxgl.AnyLayer);
  }
}
