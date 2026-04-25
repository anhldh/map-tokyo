import { useState, useMemo, useRef, useEffect } from "react";
import {
  TilesPlugin,
  TilesRenderer,
  TilesAttributionOverlay,
  GlobeControls,
} from "3d-tiles-renderer/r3f";
import {
  UpdateOnChangePlugin,
  GLTFExtensionsPlugin,
  TilesFadePlugin,
} from "3d-tiles-renderer/plugins";
import { CesiumIonAuthPlugin } from "3d-tiles-renderer/core/plugins";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { toCreasedNormals } from "three/addons/utils/BufferGeometryUtils.js";
import { Canvas, useThree } from "@react-three/fiber";
import { EffectComposer, ToneMapping } from "@react-three/postprocessing";
import {
  AerialPerspective,
  Atmosphere,
  Sky,
} from "@takram/three-atmosphere/r3f";
import { Clouds } from "@takram/three-clouds/r3f";
import * as THREE from "three";
import { CAMERA_FRAME } from "3d-tiles-renderer/src/three/renderer/math/Ellipsoid";
import { ToneMappingMode } from "postprocessing";

const dracoLoader = new DRACOLoader().setDecoderPath(
  "https://www.gstatic.com/draco/versioned/decoders/1.5.7/",
);

const DEG2RAD = Math.PI / 180;
const TOKYO_LAT = 35.6812;
const TOKYO_LON = 139.8;
const TOKYO_HEIGHT = 500;

// Creased normals plugin (làm buildings sắc nét)
class TileCreasedNormalsPlugin {
  processTileModel(scene: THREE.Object3D) {
    scene.traverse((mesh: any) => {
      if (mesh.geometry) {
        mesh.geometry = toCreasedNormals(mesh.geometry, 30 * DEG2RAD);
      }
    });
  }
}

// Component để đặt camera về Tokyo sau khi tiles sẵn sàng
function CameraToTokyo({ tilesRef }: { tilesRef: React.RefObject<any> }) {
  // const tiles = useTile();
  const { camera } = useThree();
  const placedRef = useRef(false);

  useEffect(() => {
    if (!tilesRef.current || placedRef.current) return;

    const place = () => {
      if (placedRef.current) return;
      tilesRef.current.ellipsoid.getObjectFrame(
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
      placedRef.current = true;
    };

    // Đặt ngay và cũng lắng nghe event nếu chưa sẵn sàng
    place();
    tilesRef.current.addEventListener("load-tileset", place);
    return () => tilesRef.current.removeEventListener("load-tileset", place);
  }, [tilesRef, camera]);

  return null;
}

export default function App() {
  const tilesRef = useRef<any>(null);

  const [hour, setHour] = useState(3); // 12PM Tokyo

  const date = useMemo(() => {
    const h = Math.floor(hour);
    const m = (hour - h) * 60;
    return new Date(Date.UTC(2024, 2, 1, h, m));
  }, [hour]);

  return (
    <>
      {/* Slider UI */}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          zIndex: 10,
          color: "#eee",
          background: "rgba(0,0,0,0.5)",
          padding: "10px 14px",
          borderRadius: 8,
          fontFamily: "sans-serif",
          fontSize: 14,
        }}
      >
        <label style={{ display: "block", marginBottom: 4 }}>
          Time UTC: {hour.toFixed(2)}h — Tokyo: {((hour + 9) % 24).toFixed(2)}h
        </label>
        <input
          type="range"
          min={0}
          max={24}
          step={0.05}
          value={hour}
          onChange={(e) => setHour(parseFloat(e.target.value))}
          style={{ width: 260 }}
        />
      </div>

      <Canvas
        gl={{
          // toneMapping: THREE.AgXToneMapping,
          toneMappingExposure: 10, // Đẩy độ sáng lên giống bản gốc
        }}
        camera={{
          fov: 75,
          near: 10,
          far: 1e6,
          position: [0, 0, 0], // sẽ được CameraToTokyo đặt lại
        }}
        style={{
          position: "absolute",
          inset: 0,
        }}
      >
        <ambientLight intensity={1} color="#4a5f8a" />
        <Atmosphere date={date}>
          <Sky />
          <TilesRenderer ref={tilesRef}>
            <TilesPlugin
              plugin={CesiumIonAuthPlugin}
              args={[
                {
                  apiToken: import.meta.env.VITE_ION_CESIUM,
                  assetId: "2275207",
                  autoRefreshToken: true,
                },
              ]}
            />
            <TilesAttributionOverlay />
            <TilesPlugin
              plugin={GLTFExtensionsPlugin}
              dracoLoader={dracoLoader}
            />
            <TilesPlugin plugin={TileCreasedNormalsPlugin} />
            <TilesPlugin plugin={TilesFadePlugin} />
            <TilesPlugin plugin={UpdateOnChangePlugin} />

            <GlobeControls enableDamping adjustHeight={false} />
            <CameraToTokyo tilesRef={tilesRef} />
          </TilesRenderer>

          <EffectComposer
            enableNormalPass
            multisampling={0}
            frameBufferType={THREE.HalfFloatType}
          >
            <AerialPerspective sunLight skyLight transmittance inscatter />
            <Clouds qualityPreset="high" coverage={0.2} />
            <ToneMapping mode={ToneMappingMode.AGX} />
          </EffectComposer>
        </Atmosphere>
      </Canvas>
    </>
  );
}
