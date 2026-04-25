// src/components/map/layers/ThreeLayer.ts
import * as THREE from "three";
import mapboxgl from "mapbox-gl";

export interface ThreeLayerContext {
  scene: THREE.Scene;
  camera: THREE.Camera;
  renderer: THREE.WebGLRenderer;
  map: mapboxgl.Map;
}

export interface ThreeLayerOptions {
  id: string;
  // Tâm toạ độ (lng, lat) — gốc hệ trục của scene
  origin: [number, number];
  // Callback để thêm object vào scene
  onInit?: (ctx: ThreeLayerContext) => void;
  // Callback chạy mỗi frame (animation)
  onRender?: (ctx: ThreeLayerContext, elapsed: number) => void;
}

export function createThreeLayer(
  options: ThreeLayerOptions,
): mapboxgl.CustomLayerInterface {
  const { id, origin, onInit, onRender } = options;

  // Ma trận chuyển từ local Three coords (mét tại origin) sang Mercator world
  const merc = mapboxgl.MercatorCoordinate.fromLngLat(origin, 0);
  const scale = merc.meterInMercatorCoordinateUnits();

  const originTransform = new THREE.Matrix4()
    .makeTranslation(merc.x, merc.y, merc.z)
    .scale(new THREE.Vector3(scale, -scale, scale)) // Y flip vì Mercator ngược
    .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)); // Z-up → Y-up

  let scene: THREE.Scene;
  let camera: THREE.Camera;
  let renderer: THREE.WebGLRenderer;
  let startTime = 0;
  let mapInstance: mapboxgl.Map;

  return {
    id,
    type: "custom",
    renderingMode: "3d",

    onAdd(map, gl) {
      mapInstance = map;
      scene = new THREE.Scene();
      camera = new THREE.Camera();

      // Ánh sáng cơ bản — có thể override trong onInit
      const ambient = new THREE.AmbientLight(0xffffff, 0.6);
      const dir = new THREE.DirectionalLight(0xffffff, 0.8);
      dir.position.set(0, -70, 100).normalize();
      scene.add(ambient, dir);

      // Dùng chung WebGL context với Mapbox
      renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true,
      });
      renderer.autoClear = false;

      startTime = performance.now();

      onInit?.({ scene, camera, renderer, map });
    },

    render(_gl, matrix) {
      const elapsed = (performance.now() - startTime) / 1000;

      onRender?.({ scene, camera, renderer, map: mapInstance }, elapsed);

      // Matrix projection của Mapbox × transform của origin
      const m = new THREE.Matrix4().fromArray(matrix);
      camera.projectionMatrix = m.multiply(originTransform);

      renderer.resetState();
      renderer.render(scene, camera);

      // Trigger repaint cho frame sau (cần thiết khi có animation)
      mapInstance.triggerRepaint();
    },
  };
}
