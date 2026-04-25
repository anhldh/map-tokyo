import mapboxgl from "mapbox-gl";

const LIVECAM_URL = "https://mini-tokyo.appspot.com/livecam";
const REFRESH_INTERVAL = 5 * 60 * 1000;

const MARKER_STYLE = `
.livecam-marker {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(220, 38, 38, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s ease;
}

.livecam-marker:hover {
  background: rgba(220, 38, 38, 1);
}

.livecam-marker.active {
  background: #5eead4;
}

.livecam-marker.active svg {
  fill: #0f172a;
}

.livecam-hover-popup .mapboxgl-popup-content {
  padding: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  overflow: hidden;
}
  .livecam-hover-popup .mapboxgl-popup-tip {
  display: none;
}

.livecam-popup-inner {
  width: 240px;
}

.livecam-popup-inner img {
  width: 100%;
  height: 135px;
  object-fit: cover;
  display: block;
}

.livecam-popup-title {
  padding: 10px 14px;
  color: rgba(255, 255, 255, 0.95);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.2px;
}

`;

let styleInjected = false;
function injectStyle() {
  if (styleInjected) return;
  const tag = document.createElement("style");
  tag.textContent = MARKER_STYLE;
  document.head.appendChild(tag);
  styleInjected = true;
}

export interface LivecamData {
  id: string;
  name: Record<string, string>;
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
  thumbnail: string;
  html: string;
}

interface CameraEntry {
  data: LivecamData;
  marker: mapboxgl.Marker;
  hoverPopup?: mapboxgl.Popup;
}

interface CameraView {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
}

export interface LivecamPluginOptions {
  lang?: string;
  onCameraOpen?: (camera: LivecamData) => void;
  onCameraClose?: () => void;
}

export class LivecamPlugin {
  private map: mapboxgl.Map | null = null;
  private cameras = new Map<string, CameraEntry>();
  private refreshTimer: number | null = null;
  private enabled = false;
  private lang: string;
  private onCameraOpen?: (camera: LivecamData) => void;
  private onCameraClose?: () => void;

  private activeCameraId: string | null = null;
  private savedView: CameraView | null = null;

  constructor(options?: LivecamPluginOptions) {
    this.lang = options?.lang ?? "en";
    this.onCameraOpen = options?.onCameraOpen;
    this.onCameraClose = options?.onCameraClose;
  }

  enable(map: mapboxgl.Map) {
    if (this.enabled) return;
    this.map = map;
    this.enabled = true;
    injectStyle();
    this.fetchAndUpdate();
    this.refreshTimer = window.setInterval(
      () => this.fetchAndUpdate(),
      REFRESH_INTERVAL,
    );
  }

  disable() {
    if (!this.enabled) return;

    if (this.refreshTimer !== null) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }

    for (const entry of this.cameras.values()) {
      entry.hoverPopup?.remove();
      entry.marker.remove();
    }
    this.cameras.clear();

    // Nếu đang có active camera → trigger close callback
    if (this.activeCameraId) {
      this.activeCameraId = null;
      this.savedView = null; // không restore khi user tắt cả layer
      this.onCameraClose?.();
    }

    this.enabled = false;
    this.map = null;
  }

  /** Gọi từ React khi modal đóng — restore camera view */
  closeActive() {
    if (this.activeCameraId) {
      const entry = this.cameras.get(this.activeCameraId);
      entry?.marker.getElement().classList.remove("active");
      this.activeCameraId = null;
    }

    // Restore view nếu có
    if (this.savedView && this.map) {
      this.map.flyTo({
        ...this.savedView,
        duration: 1200,
      });
      this.savedView = null;
    }

    this.onCameraClose?.();
  }

  setLang(lang: string) {
    this.lang = lang;
  }

  private async fetchAndUpdate() {
    try {
      const res = await fetch(LIVECAM_URL);
      const data: LivecamData[] = await res.json();
      this.updateCameras(data);
    } catch (err) {
      console.error("Failed to fetch livecams:", err);
    }
  }

  private updateCameras(data: LivecamData[]) {
    const map = this.map;
    if (!map) return;

    const seen = new Set<string>();

    for (const item of data) {
      seen.add(item.id);
      const existing = this.cameras.get(item.id);

      if (existing) {
        existing.data = item;
        existing.marker.setLngLat(item.center);
        continue;
      }

      const el = this.createMarkerElement();
      const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat(item.center)
        .addTo(map);

      const entry: CameraEntry = { data: item, marker };

      el.addEventListener("mouseenter", () => this.showHoverPopup(entry));
      el.addEventListener("mouseleave", () => this.hideHoverPopup(entry));
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        this.openCamera(entry);
      });

      this.cameras.set(item.id, entry);
    }

    for (const [id, entry] of this.cameras) {
      if (!seen.has(id)) {
        entry.hoverPopup?.remove();
        entry.marker.remove();
        if (this.activeCameraId === id) this.closeActive();
        this.cameras.delete(id);
      }
    }
  }

  private createMarkerElement(): HTMLDivElement {
    const el = document.createElement("div");
    el.className = "livecam-marker";
    el.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
        <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
      </svg>
    `;
    return el;
  }

  private openCamera(entry: CameraEntry) {
    const map = this.map;
    if (!map) return;

    // Nếu đang active 1 cam khác → bỏ active của nó
    if (this.activeCameraId && this.activeCameraId !== entry.data.id) {
      const prev = this.cameras.get(this.activeCameraId);
      prev?.marker.getElement().classList.remove("active");
    } else if (!this.activeCameraId) {
      // Lần đầu mở: lưu vị trí hiện tại để restore sau
      const c = map.getCenter();
      this.savedView = {
        center: [c.lng, c.lat],
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
      };
    }

    const { center, zoom, bearing, pitch } = entry.data;
    map.flyTo({ center, zoom, bearing, pitch, duration: 1200 });

    this.activeCameraId = entry.data.id;
    entry.marker.getElement().classList.add("active");

    // Báo ra ngoài để React render modal
    this.onCameraOpen?.(entry.data);
  }

  private showHoverPopup(entry: CameraEntry) {
    const map = this.map;
    if (!map) return;

    const { name, thumbnail, center } = entry.data;
    const displayName = name[this.lang] ?? name.en;

    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 16,
      className: "livecam-hover-popup",
    })
      .setLngLat(center)
      .setHTML(
        `
        <div class="livecam-popup-inner">
          <img src="${thumbnail}" alt="${displayName}" />
          <div class="livecam-popup-title">${displayName}</div>
        </div>
      `,
      )
      .addTo(map);

    entry.hoverPopup = popup;
  }

  private hideHoverPopup(entry: CameraEntry) {
    entry.hoverPopup?.remove();
    entry.hoverPopup = undefined;
  }
}
