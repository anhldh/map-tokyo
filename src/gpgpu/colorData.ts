import { colorToRGBArray } from "../helpers/helpers";
import LinearDataTexture from "./linearDataTexture";

export interface ColorDataParameters {
  chunkSize: number;
}

export interface ColorDataGroupData {
  id: string | number;
  color: string | string[];
}

export default class ColorData {
  texture: LinearDataTexture;
  groups: Map<number, { ids: (string | number)[] }>;
  groupCount: number;
  freeIndices: number[];
  lookup: Map<string | number, { index: number }>;

  constructor(parameters: ColorDataParameters) {
    const chunkSize = parameters.chunkSize;

    this.texture = new LinearDataTexture(0, "ubyte4", chunkSize);
    this.groups = new Map();
    this.groupCount = 0;
    this.freeIndices = [];
    this.lookup = new Map();
  }

  addGroup(data: ColorDataGroupData[]): number {
    const { freeIndices, lookup } = this,
      ids: (string | number)[] = [],
      items: { index: number; color: string | string[] }[] = [],
      offset = this.texture.size / 4;
    let count = 0;

    for (const { id, color } of data) {
      let index: number;

      if (freeIndices.length > 0) {
        index = freeIndices.pop()!;
      } else {
        index = offset + count;
        count += 1;
      }
      ids.push(id);
      lookup.set(id, { index });
      items.push({ index, color });
    }

    this.groups.set(this.groupCount, { ids });

    const texture = new LinearDataTexture(this.texture, count * 4);

    this.texture.dispose();
    this.texture = texture;

    const array = texture.image.data;

    for (const { index, color } of items) {
      const colors = Array.isArray(color) ? color : [color];

      array.set(
        [
          ...colorToRGBArray(colors[0]),
          255,
          ...colorToRGBArray(colors[1] || colors[0]),
          255,
          ...colorToRGBArray(colors[2] || colors[0]),
          255,
          ...colorToRGBArray(colors[3] || "#00ff00"),
          255,
        ],
        index * 16,
      );
    }

    texture.needsUpdate = true;

    return this.groupCount++;
  }

  removeGroup(groupIndex: number): void {
    const { groups, freeIndices, lookup } = this,
      ids = groups.get(groupIndex)!.ids;

    groups.delete(groupIndex);

    for (const id of ids) {
      freeIndices.push(lookup.get(id)!.index);
      lookup.delete(id);
    }
  }

  getIndex(id: string | number): number {
    return this.lookup.get(id)!.index;
  }

  dispose(): void {
    this.texture.dispose();
  }
}
