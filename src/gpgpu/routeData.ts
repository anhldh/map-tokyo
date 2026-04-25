import { MercatorCoordinate } from "mapbox-gl";
import { MathUtils } from "three";
import LinearDataTexture from "./linearDataTexture";
import type { Position } from "geojson";

export interface RouteDataParameters {
  chunkSize: number;
  modelOrigin: { x: number; y: number; z: number };
}

export interface RouteFeature {
  properties: {
    distances: [number, number, number, number][];
    "station-offsets"?: number[];
    length: number;
    [key: string]: unknown;
  };
  geometry: {
    coordinates: Position[];
  };
}

export interface RouteDataInput {
  id: string | number;
  feature: RouteFeature | RouteFeature[];
}

export default class RouteData {
  modelOrigin: { x: number; y: number; z: number };
  uintTexture: LinearDataTexture;
  floatTexture: LinearDataTexture;
  groups: Map<
    number,
    {
      ids: (string | number)[];
      floatTextureOffset: number;
      floatTextureSize: number;
    }
  >;
  groupCount: number;
  freeIndices: number[];
  freeBundledIndices: number[];
  lookup: Map<string | number, { index: number; bundled: boolean }>;
  loopCount: number;

  constructor(parameters: RouteDataParameters) {
    const chunkSize = parameters.chunkSize;

    this.modelOrigin = parameters.modelOrigin;
    this.uintTexture = new LinearDataTexture(0, "uint4", chunkSize);
    this.floatTexture = new LinearDataTexture(0, "float2", chunkSize);
    this.groups = new Map();
    this.groupCount = 0;
    this.freeIndices = [];
    this.freeBundledIndices = [];
    this.lookup = new Map();
    this.loopCount = 0;
  }

  addGroup(data: RouteDataInput[]): number {
    const { modelOrigin, lookup } = this,
      ids: (string | number)[] = [],
      items: {
        index: number;
        coords: Position[];
        distances: [number, number, number, number][];
        sectionOffsets: number[];
      }[] = [],
      uintTextureOffset = this.uintTexture.size;
    let uintTextureSize = 0,
      floatTextureOffset = this.floatTexture.size,
      floatTextureSize = 0,
      maxCount = 1;

    for (const { id, feature: features } of data) {
      const bundled = Array.isArray(features),
        freeIndices = bundled ? this.freeBundledIndices : this.freeIndices;
      let index: number;

      if (freeIndices.length > 0) {
        index = freeIndices.pop()!;
      } else {
        index = uintTextureOffset + uintTextureSize;
        uintTextureSize += bundled ? (features as RouteFeature[]).length : 1;
      }
      ids.push(id);
      lookup.set(id, { index, bundled });
      const fArr = bundled
        ? (features as RouteFeature[])
        : [features as RouteFeature];
      for (const feature of fArr) {
        const properties = feature.properties,
          coords = feature.geometry.coordinates,
          distances = properties.distances,
          sectionOffsets = properties["station-offsets"] || [
            0,
            properties.length,
          ];

        items.push({ index, coords, distances, sectionOffsets });
        index += 1;
        floatTextureSize +=
          coords.length * 3 + Math.ceil(sectionOffsets.length / 2);
        maxCount = Math.max(maxCount, coords.length);
      }
    }

    this.groups.set(this.groupCount, {
      ids,
      floatTextureOffset,
      floatTextureSize,
    });

    this.loopCount = Math.max(this.loopCount, Math.ceil(Math.log2(maxCount)));

    const uintTexture = new LinearDataTexture(this.uintTexture, uintTextureSize),
      floatTexture = new LinearDataTexture(this.floatTexture, floatTextureSize);

    this.uintTexture.dispose();
    this.floatTexture.dispose();
    this.uintTexture = uintTexture;
    this.floatTexture = floatTexture;

    const uintArray = uintTexture.image.data,
      floatArray = floatTexture.image.data;

    for (const { index, coords, distances, sectionOffsets } of items) {
      uintArray.set(
        [
          floatTextureOffset,
          coords.length,
          floatTextureOffset + coords.length * 3,
        ],
        index * 4,
      );

      for (let i = 0, ilen = coords.length; i < ilen; i++) {
        const coord = coords[i],
          mercatorCoord = MercatorCoordinate.fromLngLat(
            coord as [number, number],
            coord[2] || 0,
          ),
          [distance, bearing, , pitch] = distances[i];

        floatArray.set(
          [
            distance,
            mercatorCoord.x - modelOrigin.x,
            -(mercatorCoord.y - modelOrigin.y),
            mercatorCoord.z - modelOrigin.z,
            MathUtils.degToRad(-bearing),
            pitch,
          ],
          floatTextureOffset * 2 + i * 6,
        );
      }

      floatArray.set(
        sectionOffsets,
        floatTextureOffset * 2 + coords.length * 6,
      );
      floatTextureOffset += Math.ceil(
        coords.length * 3 + sectionOffsets.length / 2,
      );
    }

    uintTexture.needsUpdate = true;
    floatTexture.needsUpdate = true;

    return this.groupCount++;
  }

  removeGroup(groupIndex: number): void {
    const { uintTexture, groups, lookup } = this,
      { ids, floatTextureOffset, floatTextureSize } = groups.get(groupIndex)!,
      uintArray = uintTexture.image.data;

    groups.delete(groupIndex);

    for (const item of groups.values()) {
      if (item.floatTextureOffset >= floatTextureOffset + floatTextureSize) {
        item.floatTextureOffset -= floatTextureSize;
      }
    }

    for (const id of ids) {
      const { index, bundled } = lookup.get(id)!,
        freeIndices = bundled ? this.freeBundledIndices : this.freeIndices;

      freeIndices.push(index);
      lookup.delete(id);
    }

    const floatTexture = new LinearDataTexture(
      this.floatTexture,
      floatTextureOffset,
      floatTextureSize,
    );

    this.floatTexture.dispose();
    this.floatTexture = floatTexture;

    for (let i = 0, ilen = uintTexture.size; i < ilen; i++) {
      const offset = i * 4;

      if (uintArray[offset] >= floatTextureOffset + floatTextureSize) {
        uintArray[offset] -= floatTextureSize;
      }
      if (uintArray[offset + 2] >= floatTextureOffset + floatTextureSize) {
        uintArray[offset + 2] -= floatTextureSize;
      }
    }

    uintTexture.needsUpdate = true;
    floatTexture.needsUpdate = true;
  }

  getIndex(id: string | number): number {
    return this.lookup.get(id)!.index;
  }

  dispose(): void {
    this.uintTexture.dispose();
    this.floatTexture.dispose();
  }
}
