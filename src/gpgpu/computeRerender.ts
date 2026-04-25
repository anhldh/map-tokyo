import { MercatorCoordinate } from "mapbox-gl";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";
import {
  ClampToEdgeWrapping,
  FloatType,
  GLSL3,
  MathUtils,
  NearestFilter,
  RGBAFormat,
  ShaderMaterial,
  WebGLRenderTarget,
  type WebGLRenderer,
} from "three";
import configs from "../utils/config";
import { clamp, lerp } from "../helpers/helpers";
import { computeVertexShader, computeFragmentShader } from "./shader.ts";
import ObjectData from "./objectData";
import RouteData, { type RouteDataInput } from "./routeData";
import ColorData, { type ColorDataGroupData } from "./colorData";

export interface ComputeParameters {
  chunkSize: number;
  modelOrigin: { x: number; y: number; z: number };
}

export interface InstancePosition {
  coord: [number, number];
  altitude: number;
  bearing: number;
  _t: number;
}

export interface RenderContext {
  renderer: WebGLRenderer & { xr: { enabled: boolean } };
}

export default class ComputeRerender {
  dtObject: ObjectData;
  dtRoute: RouteData;
  dtColor: ColorData;
  modelOrigin: { x: number; y: number; z: number };
  loopCount: number;
  uniforms: {
    zoom: { value: number };
    time: { value: number };
    timeOffset: { value: number };
    opacityGround: { value: number };
    opacityUnderground: { value: number };
    textureObject0: { value: unknown };
    textureObject1: { value: unknown };
    textureRoute0: { value: unknown };
    textureRoute1: { value: unknown };
    textureData0: { value: unknown };
    textureData1: { value: unknown };
  };
  material: ShaderMaterial;
  quad: FullScreenQuad;
  dataVariable: WebGLRenderTarget[];
  marked: number;
  tracked: number;
  currentTextureIndex: number;
  buffer: Float32Array;

  constructor(count: number, parameters: ComputeParameters) {
    const chunkSize = parameters.chunkSize,
      chunkCount = Math.ceil(count / chunkSize),
      dtObject = (this.dtObject = new ObjectData(count, parameters)),
      dtRoute = (this.dtRoute = new RouteData(parameters));

    this.dtColor = new ColorData(parameters);
    this.modelOrigin = parameters.modelOrigin;
    this.loopCount = 0;

    const uniforms = (this.uniforms = {
      zoom: { value: 0 },
      time: { value: performance.now() },
      timeOffset: { value: 0 },
      opacityGround: { value: 0.9 },
      opacityUnderground: { value: 0.225 },
      textureObject0: { value: dtObject.uintTexture },
      textureObject1: { value: dtObject.floatTexture },
      textureRoute0: { value: dtRoute.uintTexture },
      textureRoute1: { value: dtRoute.floatTexture },
      textureData0: { value: null },
      textureData1: { value: null },
    });
    const material = (this.material = new ShaderMaterial({
      uniforms,
      vertexShader: computeVertexShader,
      fragmentShader: computeFragmentShader,
      defines: {
        chunkSize: `${chunkSize}u`,
        loopCount: this.loopCount,
        fadeDuration: configs.fadeDuration,
      },
      glslVersion: GLSL3,
    }));

    this.quad = new FullScreenQuad(material);

    this.dataVariable = [];
    for (let i = 0; i < 2; i++) {
      this.dataVariable[i] = new WebGLRenderTarget(chunkSize, chunkCount, {
        wrapS: ClampToEdgeWrapping,
        wrapT: ClampToEdgeWrapping,
        minFilter: NearestFilter,
        magFilter: NearestFilter,
        format: RGBAFormat,
        type: FloatType,
        depthBuffer: false,
        count: 2,
      });
    }

    this.marked = -1;
    this.tracked = -1;
    this.currentTextureIndex = 0;
    this.buffer = new Float32Array(chunkSize * chunkCount * 4);
  }

  compute(context: RenderContext, zoom: number): unknown[] {
    const { dataVariable, currentTextureIndex: previousTextureIndex } = this,
      currentTextureIndex = (this.currentTextureIndex =
        previousTextureIndex === 0 ? 1 : 0),
      previousDataVariable = dataVariable[previousTextureIndex],
      currentDataVariable = dataVariable[currentTextureIndex],
      uniforms = this.uniforms,
      renderer = context.renderer;

    uniforms.zoom.value = zoom;
    uniforms.time.value = performance.now();
    uniforms.textureData0.value = previousDataVariable.textures[0];
    uniforms.textureData1.value = previousDataVariable.textures[1];

    const currentRenderTarget = renderer.getRenderTarget();
    const currentXrEnabled = renderer.xr.enabled;
    const currentShadowAutoUpdate = renderer.shadowMap.autoUpdate;

    renderer.resetState();

    renderer.xr.enabled = false; // Avoid camera modification
    renderer.shadowMap.autoUpdate = false; // Avoid re-computing shadows
    renderer.setRenderTarget(currentDataVariable);
    this.quad.render(renderer);
    renderer.xr.enabled = currentXrEnabled;
    renderer.shadowMap.autoUpdate = currentShadowAutoUpdate;
    renderer.setRenderTarget(currentRenderTarget);

    renderer.resetState();

    return [...currentDataVariable.textures, this.dtColor.texture];
  }

  addRouteGroup(data: RouteDataInput[]): number {
    const { dtRoute, uniforms, material } = this,
      groupIndex = dtRoute.addGroup(data);

    uniforms.textureRoute0.value = dtRoute.uintTexture;
    uniforms.textureRoute1.value = dtRoute.floatTexture;
    material.defines.loopCount = this.loopCount = dtRoute.loopCount;
    material.needsUpdate = true;

    return groupIndex;
  }

  removeRouteGroup(groupIndex: number): void {
    const dtRoute = this.dtRoute;

    dtRoute.removeGroup(groupIndex);
    this.uniforms.textureRoute1.value = dtRoute.floatTexture;
  }

  getRouteIndex(id: string | number): number {
    return this.dtRoute.getIndex(id);
  }

  addColorGroup(data: ColorDataGroupData[]): number {
    return this.dtColor.addGroup(data);
  }

  removeColorGroup(groupIndex: number): void {
    this.dtColor.removeGroup(groupIndex);
  }

  getColorIndex(id: string | number): number {
    return this.dtColor.getIndex(id);
  }

  addInstance(
    objectType: number,
    routeIndex: number,
    colorIndex: number,
    sectionIndex: number,
    nextSectionIndex: number,
    delay: number,
  ): number | undefined {
    return this.dtObject.add(
      objectType,
      routeIndex,
      colorIndex,
      sectionIndex,
      nextSectionIndex,
      delay,
    );
  }

  updateInstance(
    instanceID: number,
    sectionIndex: number,
    nextSectionIndex: number,
    timeOffset: number,
    duration: number,
    accelerationTime: number,
    normalizedAcceleration: number,
    decelerationTime: number,
    normalizedDeceleration: number,
  ): void {
    this.dtObject.update(
      instanceID,
      sectionIndex,
      nextSectionIndex,
      timeOffset,
      duration,
      accelerationTime,
      normalizedAcceleration,
      decelerationTime,
      normalizedDeceleration,
    );
  }

  removeInstance(instanceID: number): Promise<void> {
    return this.dtObject.remove(instanceID);
  }

  setMarked(id?: number): void {
    this.dtObject.setMarked(id);
  }

  setTracked(id?: number): void {
    this.dtObject.setTracked(id);
  }

  getInstanceIDs(context: RenderContext) {
    const texture = this.dataVariable[this.currentTextureIndex],
      buffer = this.buffer;

    context.renderer.readRenderTargetPixels(
      texture,
      0,
      0,
      texture.width,
      texture.height,
      buffer,
    );
    return this.dtObject.getIDs(buffer);
  }

  getInstancePosition(instanceID: number): InstancePosition {
    const uniforms = this.uniforms,
      zoom = uniforms.zoom.value,
      timeOffset = uniforms.timeOffset.value,
      objectArray0 = this.dtObject.uintTexture.image.data as Uint32Array,
      objectArray1 = this.dtObject.floatTexture.image.data as Float32Array,
      objectType = objectArray0[instanceID * 8],
      routeID = objectArray0[instanceID * 8 + 1],
      startTime = objectArray0[instanceID * 8 + 3],
      endTime = objectArray0[instanceID * 8 + 4],
      sectionIndex = objectArray1[instanceID * 8],
      nextSectionIndex = objectArray1[instanceID * 8 + 1],
      accelerationTime = objectArray1[instanceID * 8 + 2],
      acceleration = objectArray1[instanceID * 8 + 3],
      decelerationTime = objectArray1[instanceID * 8 + 4],
      deceleration = objectArray1[instanceID * 8 + 5],
      routeSubID = objectType === 0 ? zoom - 13 : 0,
      headerindex = routeID + routeSubID,
      routeArray0 = this.dtRoute.uintTexture.image.data as Uint32Array,
      routeArray1 = this.dtRoute.floatTexture.image.data as Float32Array,
      sectionOffset = routeArray0[headerindex * 4 + 2],
      sectionDistance =
        objectType === 2
          ? sectionIndex
          : routeArray1[sectionOffset * 2 + sectionIndex],
      nextSectionDistance =
        objectType === 2
          ? nextSectionIndex
          : routeArray1[sectionOffset * 2 + nextSectionIndex],
      elapsed = clamp(timeOffset - startTime, 0, endTime - startTime),
      left = clamp(endTime - timeOffset, 0, endTime - startTime);
    let t: number;

    if (elapsed < accelerationTime) {
      t = (acceleration / 2) * elapsed * elapsed;
    } else if (left < decelerationTime) {
      t = 1 - (deceleration / 2) * left * left;
    } else {
      t =
        Math.max(
          acceleration * accelerationTime,
          deceleration * decelerationTime,
        ) *
        (elapsed - accelerationTime / 2);
    }

    const distance = lerp(sectionDistance, nextSectionDistance, t),
      routeOffset = routeArray0[headerindex * 4];
    let start = 0,
      end = routeArray0[headerindex * 4 + 1] - 1,
      center: number;

    for (let i = 0; i < this.loopCount; i++) {
      if (start === end - 1) {
        break;
      }
      center = Math.floor((start + end) / 2);
      if (distance < routeArray1[(routeOffset + center * 3) * 2]) {
        end = center;
      } else {
        start = center;
      }
    }

    const nodeOffset = routeOffset + start * 3,
      baseDistance = routeArray1[nodeOffset * 2],
      currentX = routeArray1[nodeOffset * 2 + 1],
      currentY = routeArray1[nodeOffset * 2 + 2],
      currentZ = routeArray1[nodeOffset * 2 + 3],
      rotateZ = routeArray1[nodeOffset * 2 + 4],
      nextDistance = routeArray1[nodeOffset * 2 + 6],
      nextX = routeArray1[nodeOffset * 2 + 7],
      nextY = routeArray1[nodeOffset * 2 + 8],
      nextZ = routeArray1[nodeOffset * 2 + 9],
      a =
        nextDistance !== baseDistance
          ? (distance - baseDistance) / (nextDistance - baseDistance)
          : 0,
      x = lerp(currentX, nextX, a),
      y = lerp(currentY, nextY, a),
      z = lerp(currentZ, nextZ, a),
      modelOrigin = this.modelOrigin,
      coord = new MercatorCoordinate(
        modelOrigin.x + x,
        modelOrigin.y - y,
        modelOrigin.z + z,
      ),
      bearing = MathUtils.radToDeg(-rotateZ);

    return {
      coord: coord.toLngLat().toArray() as [number, number],
      altitude: coord.toAltitude(),
      bearing: bearing + (sectionIndex < nextSectionIndex ? 0 : 180),
      _t: t,
    };
  }

  setOpacity(opacity: { ground: number; underground: number }): void {
    const uniforms = this.uniforms;

    uniforms.opacityGround.value = opacity.ground;
    uniforms.opacityUnderground.value = opacity.underground;
  }

  getOpacity(): { ground: number; underground: number } {
    const uniforms = this.uniforms;

    return {
      ground: uniforms.opacityGround.value,
      underground: uniforms.opacityUnderground.value,
    };
  }

  setTimeOffset(timeOffset: number): void {
    this.uniforms.timeOffset.value = timeOffset;
  }

  dispose(): void {
    this.dtObject.dispose();
    this.dtRoute.dispose();
    this.dtColor.dispose();

    this.quad.dispose();
    this.material.dispose();

    for (let i = 0; i < 2; i++) {
      this.dataVariable[i].dispose();
    }
  }
}
