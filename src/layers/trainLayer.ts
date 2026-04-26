import {
  type Map as MapboxMap,
  type CustomLayerInterface,
  MercatorCoordinate,
} from "mapbox-gl";
import {
  Scene,
  Camera,
  WebGLRenderer,
  InstancedMesh,
  BoxGeometry,
  MeshLambertMaterial,
  Color,
  Matrix4,
  Vector3,
  Quaternion,
  Euler,
  DirectionalLight,
  AmbientLight,
  DynamicDrawUsage,
  InstancedBufferAttribute,
} from "three";
import type { TrainScheduler } from "./trainscheduler";
import { getNowSecondsTokyo } from "./trainscheduler";

interface TrainLayerOptions {
  scheduler: TrainScheduler;
  railwayColors: Map<string, string>;
  /** Default: 1000 */
  maxInstances?: number;
  /** [width, height, length] in meters. Default: [3.5, 4, 20] */
  carSize?: [number, number, number];
  /** Default: "#888" */
  defaultColor?: string;
  /** Lift train above ground (meters). Default: 5 */
  altitudeOffset?: number;
  /** Origin lng/lat — train coords được tính relative to this. Default: Tokyo center */
  modelOrigin?: [number, number];
  /** Optional clock function */
  getNowSec?: () => number;
}

interface ModelTransform {
  translateX: number;
  translateY: number;
  translateZ: number;
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  scale: number;
}

export class TrainLayer implements CustomLayerInterface {
  id = "trains-3d";
  type = "custom" as const;
  renderingMode = "3d" as const;

  private map?: MapboxMap;
  private scene!: Scene;
  private camera!: Camera;
  private renderer?: WebGLRenderer;
  private mesh?: InstancedMesh;

  private scheduler: TrainScheduler;
  private railwayColors: Map<string, string>;
  private maxInstances: number;
  private carSize: [number, number, number];
  private defaultColor: string;
  private altitudeOffset: number;
  private modelOrigin: [number, number];
  private getNowSec: () => number;

  private modelTransform!: ModelTransform;
  private originMerc!: MercatorCoordinate;

  // Reusable scratch
  private _matrix = new Matrix4();
  private _pos = new Vector3();
  private _quat = new Quaternion();
  private _scale = new Vector3(1, 1, 1);
  private _euler = new Euler();

  constructor(options: TrainLayerOptions) {
    this.scheduler = options.scheduler;
    this.railwayColors = options.railwayColors;
    this.maxInstances = options.maxInstances ?? 1000;
    this.carSize = options.carSize ?? [3.5, 4, 20];
    this.defaultColor = options.defaultColor ?? "#888888";
    this.altitudeOffset = options.altitudeOffset ?? 5;
    this.modelOrigin = options.modelOrigin ?? [139.7671, 35.6812];
    this.getNowSec = options.getNowSec ?? getNowSecondsTokyo;
  }

  // ============== Mapbox CustomLayerInterface ==============

  onAdd(
    map: MapboxMap,
    gl: WebGL2RenderingContext | WebGLRenderingContext,
  ): void {
    this.map = map;
    this.camera = new Camera();
    this.scene = new Scene();

    // Setup transform một lần (origin cố định)
    this.originMerc = MercatorCoordinate.fromLngLat(this.modelOrigin, 0);
    this.modelTransform = {
      translateX: this.originMerc.x,
      translateY: this.originMerc.y,
      translateZ: this.originMerc.z,
      // -90° quanh X để Three.js Y-up khớp với Mapbox Z-up
      rotateX: Math.PI / 2,
      rotateY: 0,
      rotateZ: 0,
      scale: this.originMerc.meterInMercatorCoordinateUnits(),
    };

    // Lights
    this.scene.add(new AmbientLight(0xffffff, 1.5));

    const dirLight = new DirectionalLight(0xffffff, 1);
    dirLight.position.set(0, 1, 1).normalize();
    this.scene.add(dirLight);

    // Instanced mesh
    const [w, h, l] = this.carSize;
    const geometry = new BoxGeometry(w, h, l);
    geometry.translate(0, h / 2, 0); // box nằm trên đáy

    const material = new MeshLambertMaterial({
      color: 0xffffff,
    });

    const mesh = new InstancedMesh(geometry, material, this.maxInstances);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;

    // Pre-allocate color buffer
    const colorArray = new Float32Array(this.maxInstances * 3);
    mesh.instanceColor = new InstancedBufferAttribute(colorArray, 3);
    mesh.instanceColor.setUsage(DynamicDrawUsage);

    this.mesh = mesh;
    this.scene.add(mesh);

    // Renderer share GL context với Mapbox
    this.renderer = new WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl as WebGL2RenderingContext,
      antialias: true,
    });
    this.renderer.autoClear = false;
  }

  onRemove(): void {
    this.mesh?.geometry.dispose();
    const mat = this.mesh?.material;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else mat?.dispose();
    this.scene?.clear();
  }

  // Mapbox v3 signature: render(gl, matrix) — matrix là Array<number> (16 phần tử)
  render(
    _gl: WebGL2RenderingContext | WebGLRenderingContext,
    matrix: number[],
  ): void {
    if (!this.renderer || !this.mesh || !this.map) return;

    // Update train positions
    this.updateInstances();

    const t = this.modelTransform;
    const rotationX = new Matrix4().makeRotationAxis(
      new Vector3(1, 0, 0),
      t.rotateX,
    );
    const rotationY = new Matrix4().makeRotationAxis(
      new Vector3(0, 1, 0),
      t.rotateY,
    );
    const rotationZ = new Matrix4().makeRotationAxis(
      new Vector3(0, 0, 1),
      t.rotateZ,
    );

    const m = new Matrix4().fromArray(matrix);
    const l = new Matrix4()
      .makeTranslation(t.translateX, t.translateY, t.translateZ)
      .scale(new Vector3(t.scale, -t.scale, t.scale))
      .multiply(rotationX)
      .multiply(rotationY)
      .multiply(rotationZ);

    this.camera.projectionMatrix = m.multiply(l);

    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);

    // Trigger next frame để animation chạy liên tục
    this.map.triggerRepaint();
  }

  // ============== Update logic ==============

  private updateInstances(): void {
    if (!this.mesh) return;

    const nowSec = this.getNowSec();
    const active = this.scheduler.getActiveTrains(nowSec);
    const max = Math.min(active.length, this.maxInstances);

    const tempColor = new Color();
    const colorAttr = this.mesh.instanceColor;
    const colorArray = colorAttr?.array as Float32Array | undefined;
    const scaleM = this.modelTransform.scale;

    for (let i = 0; i < max; i++) {
      const t = active[i];
      const { lng, lat, bearing } = t.sample;

      const merc = MercatorCoordinate.fromLngLat(
        [lng, lat],
        this.altitudeOffset,
      );

      // Train position trong "model space" (đơn vị: meters relative to origin)
      // Sau khi qua scale của modelTransform sẽ thành mercator units đúng
      const dx = (merc.x - this.originMerc.x) / scaleM;
      const dy = (merc.y - this.originMerc.y) / scaleM;
      const dz = merc.z / scaleM;

      // Three.js Y-up: scene X = east, Y = up, Z = south
      // Mercator: X = east, Y = south, Z = up
      // Sau khi rotateX = 90° (Mapbox modelTransform), trục Z của scene
      // được map sang trục Y của mercator (south).
      // → trong scene: setX = dx (east), setY = dz (up), setZ = dy (south=positive)
      this._pos.set(dx, dz, dy);

      // Bearing: Mapbox 0 = North CW.
      // Trong scene của Three.js sau khi đã rotate, Z+ = south, X+ = east.
      // Box mặc định kéo dài theo Z (length axis). Khi bearing=0 (North),
      // train hướng -Z (north). Default box hướng +Z → cần rotate 180°.
      // Bearing CW khi nhìn từ trên xuống = rotate -Y (vì Y-up + right-hand rule)
      const yaw = -(bearing * Math.PI) / 180 + Math.PI;
      this._euler.set(0, yaw, 0);
      this._quat.setFromEuler(this._euler);

      this._matrix.compose(this._pos, this._quat, this._scale);
      this.mesh.setMatrixAt(i, this._matrix);

      if (colorArray) {
        const colorHex =
          this.railwayColors.get(t.railwayId) ?? this.defaultColor;
        tempColor.set(colorHex);
        colorArray[i * 3] = tempColor.r;
        colorArray[i * 3 + 1] = tempColor.g;
        colorArray[i * 3 + 2] = tempColor.b;
      }
    }

    this.mesh.count = max;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (colorAttr) colorAttr.needsUpdate = true;
  }
}
