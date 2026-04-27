import * as THREE from "three";
import mapboxgl from "mapbox-gl";

class FloodLayer implements mapboxgl.CustomLayerInterface {
  id = "flood-water-plane";
  type = "custom" as const;
  renderingMode = "3d" as const;

  private map: mapboxgl.Map | null = null;
  private camera = new THREE.Camera();
  private scene = new THREE.Scene();
  private renderer: THREE.WebGLRenderer | null = null;
  private waterMesh: THREE.Mesh | null = null;
  private animationId: number | null = null;

  // State
  private waterLevel = 0; // có thể âm
  private isActive = false; // tách biệt off vs đang mô phỏng
  private centerLngLat: [number, number] = [139.6917, 35.6895];
  private size = 60000;
  private terrainExaggeration = 1.2;

  /**
   * @param level Mực nước (mét, có thể âm sau offset)
   * @param active true = đang mô phỏng, false = đã tắt slider
   */
  setLevel(level: number, active: boolean) {
    this.waterLevel = level;
    this.isActive = active;
    if (this.waterMesh) {
      this.waterMesh.visible = active;
    }
    this.map?.triggerRepaint();
  }

  setTerrainExaggeration(value: number) {
    this.terrainExaggeration = value;
    this.map?.triggerRepaint();
  }

  setCenter(lng: number, lat: number) {
    this.centerLngLat = [lng, lat];
    this.map?.triggerRepaint();
  }

  onAdd(map: mapboxgl.Map, gl: WebGLRenderingContext) {
    this.map = map;

    const geom = new THREE.PlaneGeometry(this.size, this.size, 1, 1);

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      uniforms: {
        u_time: { value: 0 },
        u_color: { value: new THREE.Color(0x1e6fd9) }, // xanh đục
        u_opacity: { value: 0.55 },
      },
      vertexShader: `
        varying vec2 v_uv;
        void main() {
          v_uv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec2 v_uv;
        uniform float u_time;
        uniform vec3 u_color;
        uniform float u_opacity;

        float wave(vec2 uv, float t) {
          float w1 = sin(uv.x * 80.0 + t * 1.5) * 0.5 + 0.5;
          float w2 = sin(uv.y * 60.0 - t * 1.2) * 0.5 + 0.5;
          return mix(w1, w2, 0.5);
        }

        void main() {
          float w = wave(v_uv, u_time);
          vec3 color = u_color + vec3(w * 0.06);
          gl_FragColor = vec4(color, u_opacity);
        }
      `,
    });

    this.waterMesh = new THREE.Mesh(geom, material);
    this.waterMesh.visible = false;
    this.scene.add(this.waterMesh);

    this.renderer = new THREE.WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl,
      antialias: true,
    });
    this.renderer.autoClear = false;

    // ============== Animation loop riêng — throttled 30fps ==============
    let lastTime = 0;
    const animate = (t: number) => {
      if (this.isActive && this.map && t - lastTime > 33) {
        lastTime = t;
        this.map.triggerRepaint();
      }
      this.animationId = requestAnimationFrame(animate);
    };
    this.animationId = requestAnimationFrame(animate);
  }

  render(_gl: WebGLRenderingContext, matrix: number[]) {
    if (!this.map || !this.renderer || !this.waterMesh) return;
    if (!this.isActive) return; // tắt slider → không vẽ

    const mat = this.waterMesh.material as THREE.ShaderMaterial;
    mat.uniforms.u_time.value = performance.now() / 1000;

    // KHÔNG có visualScaleFactor — dùng đúng waterLevel sau khi đã model hoá
    const merc = mapboxgl.MercatorCoordinate.fromLngLat(
      this.centerLngLat,
      this.waterLevel * this.terrainExaggeration,
    );
    const scale = merc.meterInMercatorCoordinateUnits();

    const m = new THREE.Matrix4()
      .makeTranslation(merc.x, merc.y, merc.z)
      .scale(new THREE.Vector3(scale, -scale, scale));

    const projMatrix = new THREE.Matrix4().fromArray(matrix);
    this.camera.projectionMatrix = projMatrix.multiply(m);

    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    // KHÔNG triggerRepaint ở đây — animation loop xử lý
  }

  onRemove() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.waterMesh?.geometry.dispose();
    (this.waterMesh?.material as THREE.Material)?.dispose();
    this.scene.clear();
  }
}

// ============== Plugin wrapper ==============
export class FloodSimulationPlugin {
  private map: mapboxgl.Map | null = null;
  private layer: FloodLayer | null = null;

  enable(map: mapboxgl.Map) {
    if (this.map) return;
    this.map = map;
    this.layer = new FloodLayer();
    map.addLayer(this.layer);
  }

  /**
   * @param effectiveLevel Mực nước sau khi qua model (có thể âm)
   * @param active true nếu đang mô phỏng (raw > 0)
   */
  setLevel(effectiveLevel: number, active: boolean) {
    this.layer?.setLevel(effectiveLevel, active);
  }

  setCenter(lng: number, lat: number) {
    this.layer?.setCenter(lng, lat);
  }

  disable() {
    if (this.map && this.layer && this.map.getLayer(this.layer.id)) {
      this.map.removeLayer(this.layer.id);
    }
    this.layer = null;
    this.map = null;
  }
}
