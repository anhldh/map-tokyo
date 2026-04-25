// src/components/map/layers/demoCubes.ts
import * as THREE from "three";
import { createThreeLayer } from "./ThreeLayer";

export function createDemoCubeLayer() {
  const cubes: THREE.Mesh[] = [];

  return createThreeLayer({
    id: "demo-cubes",
    origin: [139.7671, 35.6812], // Tokyo
    onInit: ({ scene }) => {
      const geometry = new THREE.BoxGeometry(50, 50, 50); // cube 50m
      const material = new THREE.MeshStandardMaterial({
        color: 0x5eead4,
        metalness: 0.3,
        roughness: 0.4,
      });

      for (let i = 0; i < 10; i++) {
        const cube = new THREE.Mesh(geometry, material);
        cube.position.set(
          (Math.random() - 0.5) * 500,
          (Math.random() - 0.5) * 500,
          25,
        );
        scene.add(cube);
        cubes.push(cube);
      }
    },
    onRender: (_ctx, elapsed) => {
      // Animation: xoay cube
      cubes.forEach((cube, i) => {
        cube.rotation.z = elapsed * (0.5 + i * 0.1);
      });
    },
  });
}
