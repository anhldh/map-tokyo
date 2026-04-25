import { useEffect, useRef } from "react";
import * as THREE from "three";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { toCreasedNormals } from "three/addons/utils/BufferGeometryUtils.js";
import { TilesRenderer, GlobeControls } from "3d-tiles-renderer";
import { CesiumIonAuthPlugin } from "3d-tiles-renderer/core/plugins";
import {
  GLTFExtensionsPlugin,
  TilesFadePlugin,
  UpdateOnChangePlugin,
} from "3d-tiles-renderer/plugins";
import {
  EffectComposer,
  EffectPass,
  NormalPass,
  RenderPass,
  SMAAEffect,
  DepthPass,
} from "postprocessing";
import {
  CloudsEffect,
  CLOUD_SHAPE_TEXTURE_SIZE,
  CLOUD_SHAPE_DETAIL_TEXTURE_SIZE,
  DEFAULT_LOCAL_WEATHER_URL,
  DEFAULT_SHAPE_URL,
  DEFAULT_SHAPE_DETAIL_URL,
  DEFAULT_TURBULENCE_URL,
} from "@takram/three-clouds";
import {
  AerialPerspectiveEffect,
  PrecomputedTexturesGenerator,
  getSunDirectionECEF,
} from "@takram/three-atmosphere";
import { STBNLoader, DEFAULT_STBN_URL } from "@takram/three-geospatial";
import {
  DitheringEffect,
  LensFlareEffect,
} from "@takram/three-geospatial-effects";
import { CAMERA_FRAME } from "3d-tiles-renderer/src/three/renderer/math/Ellipsoid";

const DEG2RAD = Math.PI / 180;
const TOKYO_LAT = 35.6812;
const TOKYO_LON = 139.8;
const TOKYO_HEIGHT = 500;

export default function TokyoClouds() {
  const containerRef = useRef<HTMLDivElement>(null);
  const hourRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const ION_KEY = import.meta.env.VITE_ION_CESIUM;
    const ASSET_ID = "2275207";

    // Camera + scene + renderer
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      10,
      1e6,
    );
    const scene = new THREE.Scene();

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.toneMappingExposure = 15; // Tăng từ 10 lên 15
    container.appendChild(renderer.domElement);

    // DRACO
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("https://www.gstatic.com/draco/v1/decoders/");
    dracoLoader.setDecoderConfig({ type: "js" });

    // Creased normals
    class TileCreasedNormalsPlugin {
      processTileModel(scene: THREE.Object3D) {
        scene.traverse((mesh: any) => {
          if (mesh.geometry) {
            mesh.geometry = toCreasedNormals(mesh.geometry, 30 * DEG2RAD);
          }
        });
      }
    }

    // Tiles
    const tiles = new TilesRenderer();
    tiles.registerPlugin(
      new CesiumIonAuthPlugin({
        apiToken: ION_KEY,
        assetId: ASSET_ID,
        autoRefreshToken: true,
      }),
    );
    tiles.registerPlugin(new GLTFExtensionsPlugin({ dracoLoader }));
    tiles.registerPlugin(new TileCreasedNormalsPlugin());
    tiles.registerPlugin(new TilesFadePlugin());
    tiles.registerPlugin(new UpdateOnChangePlugin());
    tiles.setCamera(camera);
    tiles.setResolutionFromRenderer(camera, renderer);
    scene.add(tiles.group);

    // Camera tới Tokyo
    tiles.ellipsoid.getObjectFrame(
      TOKYO_LAT * DEG2RAD,
      TOKYO_LON * DEG2RAD,
      TOKYO_HEIGHT,
      -90 * DEG2RAD,
      -10 * DEG2RAD,
      0,
      camera.matrix,
      CAMERA_FRAME,
    );
    camera.matrix.decompose(camera.position, camera.quaternion, camera.scale);

    // Controls
    const controls = new GlobeControls(scene, camera, renderer.domElement);
    controls.setEllipsoid(tiles.ellipsoid, tiles.group);
    controls.enableDamping = true;
    controls.adjustHeight = false;

    const enableAdjustHeight = () => {
      controls.adjustHeight = true;
      renderer.domElement.removeEventListener(
        "pointerdown",
        enableAdjustHeight,
      );
      renderer.domElement.removeEventListener("wheel", enableAdjustHeight);
    };
    renderer.domElement.addEventListener("pointerdown", enableAdjustHeight);
    renderer.domElement.addEventListener("wheel", enableAdjustHeight);

    // Sun
    const sunDirection = new THREE.Vector3();
    const params = { hourUTC: 3 }; // 12PM Tokyo - ban ngày

    // Aerial perspective
    const aerialPerspective = new AerialPerspectiveEffect(camera);
    aerialPerspective.sky = true;
    aerialPerspective.sunLight = true;
    aerialPerspective.skyLight = true;
    // aerialPerspective.sunIrradiance = true;
    // aerialPerspective.skyIrradiance = true;

    // Clouds
    const clouds = new CloudsEffect(camera);
    clouds.coverage = 0.25;
    clouds.localWeatherVelocity.set(0.001, 0);
    clouds.shadow.farScale = 0.25;
    clouds.shadow.maxFar = 1e5;
    clouds.shadow.cascadeCount = 2;
    clouds.shadow.mapSize.set(512, 512);
    clouds.shadow.splitMode = "practical";
    clouds.shadow.splitLambda = 0.71;

    // Sync clouds ↔ atmosphere
    clouds.events.addEventListener("change", (event: any) => {
      if (event.property === "atmosphereOverlay")
        aerialPerspective.overlay = clouds.atmosphereOverlay;
      if (event.property === "atmosphereShadow")
        aerialPerspective.shadow = clouds.atmosphereShadow;
      if (event.property === "atmosphereShadowLength")
        aerialPerspective.shadowLength = clouds.atmosphereShadowLength;
    });

    const updateSunDirection = () => {
      const ms = params.hourUTC * 3600000;
      const date = new Date(Date.UTC(2024, 2, 1) + ms);
      getSunDirectionECEF(date, sunDirection);
      aerialPerspective.sunDirection.copy(sunDirection);
      clouds.sunDirection.copy(sunDirection);
    };

    // === POSTPROCESSING PIPELINE (KEY FIX) ===
    const composer = new EffectComposer(renderer, {
      frameBufferType: THREE.HalfFloatType,
      multisampling: 0,
    });

    // 1. Render scene
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // 2. Normal pass - tạo normalBuffer cho atmosphere
    const normalPass = new NormalPass(scene, camera);
    composer.addPass(normalPass);

    // 3. Wire normal buffer VÀO aerialPerspective (quan trọng!)
    aerialPerspective.normalBuffer = normalPass.texture;

    // 4. Effect pass: clouds + aerial chung 1 pass (share depth/normal)
    const cloudsAerialPass = new EffectPass(camera, clouds, aerialPerspective);
    composer.addPass(cloudsAerialPass);

    // 5. Lens flare
    composer.addPass(new EffectPass(camera, new LensFlareEffect()));

    // 6. AA + dithering
    composer.addPass(new EffectPass(camera, new SMAAEffect()));
    composer.addPass(new EffectPass(camera, new DitheringEffect()));

    // Load textures
    let disposed = false;

    const texturesGenerator = new PrecomputedTexturesGenerator(renderer);
    texturesGenerator.update().then((textures: any) => {
      if (disposed) return;
      Object.assign(aerialPerspective, textures);
      Object.assign(clouds, textures);
    });

    const textureLoader = new THREE.TextureLoader();
    const loadCloudTexture = (url: string, property: string) => {
      textureLoader.load(url, (texture) => {
        if (disposed) return texture.dispose();
        texture.minFilter = THREE.LinearMipMapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.colorSpace = THREE.NoColorSpace;
        texture.needsUpdate = true;
        (clouds as any)[property] = texture;
      });
    };

    loadCloudTexture(DEFAULT_LOCAL_WEATHER_URL, "localWeatherTexture");
    loadCloudTexture(DEFAULT_TURBULENCE_URL, "turbulenceTexture");

    const loadData3D = (url: string, size: number, property: string) => {
      fetch(url)
        .then((r) => r.arrayBuffer())
        .then((buffer) => {
          if (disposed) return;
          const tex = new THREE.Data3DTexture(
            new Uint8Array(buffer),
            size,
            size,
            size,
          );
          tex.format = THREE.RedFormat;
          tex.minFilter = THREE.LinearFilter;
          tex.magFilter = THREE.LinearFilter;
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.RepeatWrapping;
          tex.wrapR = THREE.RepeatWrapping;
          tex.colorSpace = THREE.NoColorSpace;
          tex.needsUpdate = true;
          (clouds as any)[property] = tex;
        });
    };

    loadData3D(DEFAULT_SHAPE_URL, CLOUD_SHAPE_TEXTURE_SIZE, "shapeTexture");
    loadData3D(
      DEFAULT_SHAPE_DETAIL_URL,
      CLOUD_SHAPE_DETAIL_TEXTURE_SIZE,
      "shapeDetailTexture",
    );

    new STBNLoader().load(DEFAULT_STBN_URL, (texture: THREE.Data3DTexture) => {
      if (disposed) return texture.dispose();
      clouds.stbnTexture = texture;
      aerialPerspective.stbnTexture = texture;
    });

    updateSunDirection();

    const onHourChange = (e: Event) => {
      params.hourUTC = parseFloat((e.target as HTMLInputElement).value);
      updateSunDirection();
    };
    hourRef.current?.addEventListener("input", onHourChange);

    // Render loop
    let prevTime = 0;
    let rafId = 0;
    const animate = (time: number) => {
      const dt = (time - prevTime) / 1000;
      prevTime = time;
      controls.update();
      tiles.update();
      composer.render(dt);
      rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);

    // Resize
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      composer.setSize(window.innerWidth, window.innerHeight);
      tiles.setResolutionFromRenderer(camera, renderer);
    };
    window.addEventListener("resize", onResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      hourRef.current?.removeEventListener("input", onHourChange);
      renderer.domElement.removeEventListener(
        "pointerdown",
        enableAdjustHeight,
      );
      renderer.domElement.removeEventListener("wheel", enableAdjustHeight);
      controls.dispose();
      tiles.dispose();
      composer.dispose();
      renderer.dispose();
      dracoLoader.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        background: "#000",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          zIndex: 10,
          color: "#eee",
          background: "rgba(0,0,0,0.4)",
          padding: "8px 12px",
          borderRadius: 6,
          fontFamily: "sans-serif",
          fontSize: 14,
        }}
      >
        <label>
          Time UTC:{" "}
          <input
            ref={hourRef}
            type="range"
            min={0}
            max={24}
            step={0.01}
            defaultValue={3}
            style={{ verticalAlign: "middle", width: 200 }}
          />
        </label>
      </div>
    </div>
  );
}
