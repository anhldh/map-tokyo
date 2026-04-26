import * as THREE from "three";
import mapboxgl from "mapbox-gl";

export class StreetViewMarker3D implements mapboxgl.CustomLayerInterface {
  id = "street-view-marker-3d";
  type = "custom" as const;
  renderingMode = "3d" as const;

  private map: mapboxgl.Map | null = null;
  private camera = new THREE.Camera();
  private scene = new THREE.Scene();
  private renderer: THREE.WebGLRenderer | null = null;
  private group = new THREE.Group();

  // State
  private lngLat: [number, number] = [0, 0];
  private heading = 0; // độ
  private pitch = 0; // độ

  setPosition(lng: number, lat: number) {
    this.lngLat = [lng, lat];
    this.map?.triggerRepaint();
  }

  setPov(heading: number, pitch: number) {
    this.heading = heading;
    this.pitch = pitch;
    this.map?.triggerRepaint();
  }

  onAdd(map: mapboxgl.Map, gl: WebGLRenderingContext) {
    this.map = map;

    // ============== Geometry: open pyramid (không đáy) ==============
    // Tip ở (0,0,0), mở ra phía +Y (sẽ rotate sau cho đúng hướng heading=0 = north)
    const fov = 75; // góc mở (độ)
    const length = 60; // chiều dài cone (mét)
    const halfBase = length * Math.tan((fov / 2) * (Math.PI / 180));

    // 4 góc base — đặt ở Y = length, vuông góc với tia nhìn
    const v0 = [0, 0, 0]; // tip
    const v1 = [-halfBase, length, -halfBase]; // bottom-left
    const v2 = [halfBase, length, -halfBase]; // bottom-right
    const v3 = [halfBase, length, halfBase]; // top-right
    const v4 = [-halfBase, length, halfBase]; // top-left

    // ============== Mặt bên (4 tam giác, KHÔNG có đáy) ==============
    const faceGeom = new THREE.BufferGeometry();
    const faceVerts = new Float32Array([
      ...v0,
      ...v1,
      ...v2, // mặt dưới
      ...v0,
      ...v2,
      ...v3, // mặt phải
      ...v0,
      ...v3,
      ...v4, // mặt trên
      ...v0,
      ...v4,
      ...v1, // mặt trái
    ]);
    faceGeom.setAttribute("position", new THREE.BufferAttribute(faceVerts, 3));
    faceGeom.computeVertexNormals();

    const faceMat = new THREE.MeshBasicMaterial({
      color: 0x4285f4,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const faces = new THREE.Mesh(faceGeom, faceMat);

    // ============== Edges (4 cạnh từ tip ra góc + 4 cạnh viền base) ==============
    const edgeGeom = new THREE.BufferGeometry();
    const edgeVerts = new Float32Array([
      // 4 tia từ tip
      ...v0,
      ...v1,
      ...v0,
      ...v2,
      ...v0,
      ...v3,
      ...v0,
      ...v4,
      // viền base (hình vuông)
      ...v1,
      ...v2,
      ...v2,
      ...v3,
      ...v3,
      ...v4,
      ...v4,
      ...v1,
    ]);
    edgeGeom.setAttribute("position", new THREE.BufferAttribute(edgeVerts, 3));
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0x4285f4,
      transparent: true,
      opacity: 0.9,
    });
    const edges = new THREE.LineSegments(edgeGeom, edgeMat);

    // ============== Chấm tròn ở tip ==============
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(4, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x4285f4 }),
    );
    // Vành trắng quanh sphere cho rõ
    const ring = new THREE.Mesh(
      new THREE.SphereGeometry(5, 16, 16),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.6,
      }),
    );

    this.group.add(faces);
    this.group.add(edges);
    this.group.add(ring);
    this.group.add(sphere);
    this.scene.add(this.group);

    // ============== Renderer ==============
    this.renderer = new THREE.WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl,
      antialias: true,
    });
    this.renderer.autoClear = false;
  }

  render(_gl: WebGLRenderingContext, matrix: number[]) {
    if (!this.map || !this.renderer) return;

    const merc = mapboxgl.MercatorCoordinate.fromLngLat(this.lngLat, 0);
    const scale = merc.meterInMercatorCoordinateUnits();

    // Mapbox world: +X east, +Y north, +Z up (sau khi nhân với matrix)
    // Geometry của ta: tip ở origin, mở ra theo +Y → mặc định nhìn về NORTH
    //
    // heading = 0 → north (đúng default)
    // heading tăng → quay clockwise nhìn từ trên xuống → quanh trục Z, theo chiều âm
    //
    // pitch: dương = ngẩng lên, âm = cúi xuống
    // Quay quanh trục local X (vì geometry mở theo Y)
    const headingRad = -this.heading * (Math.PI / 180);
    const pitchRad = this.pitch * (Math.PI / 180);

    const m = new THREE.Matrix4()
      .makeTranslation(merc.x, merc.y, merc.z)
      .scale(new THREE.Vector3(scale, -scale, scale)) // -Y vì Mapbox flip
      .multiply(new THREE.Matrix4().makeRotationZ(headingRad)) // heading
      .multiply(new THREE.Matrix4().makeRotationX(pitchRad)); // pitch

    const projMatrix = new THREE.Matrix4().fromArray(matrix);
    this.camera.projectionMatrix = projMatrix.multiply(m);

    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    this.map.triggerRepaint();
  }

  onRemove() {
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
    this.scene.clear();
  }
}
