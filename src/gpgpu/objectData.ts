import animation from "../utils/animation";
import configs from "../utils/config";
import LinearDataTexture from "./linearDataTexture";

export interface ObjectDataParameters {
  chunkSize: number;
}

export interface InstanceIDs {
  body: number[];
  delayMarker: number[];
  outline: number[];
}

export default class ObjectData {
  uintTexture: LinearDataTexture;
  floatTexture: LinearDataTexture;
  count: number;
  start: number;
  marked?: number;
  tracked?: number;

  constructor(count: number, parameters: ObjectDataParameters) {
    const chunkSize = parameters.chunkSize;

    this.uintTexture = new LinearDataTexture(count * 2, "uint4", chunkSize);
    this.floatTexture = new LinearDataTexture(count * 2, "float4", chunkSize);
    this.count = count;
    this.start = 0;
  }

  add(
    objectType: number,
    routeIndex: number,
    colorIndex: number,
    sectionIndex: number,
    nextSectionIndex: number,
    delay: number,
  ): number | undefined {
    const { uintTexture, floatTexture } = this,
      uintArray = uintTexture.image.data,
      floatArray = floatTexture.image.data;

    for (let i = this.start, ilen = this.count; i < ilen; i++) {
      const offset = i * 8,
        fadeAnimationType = uintArray[offset + 6];

      if (fadeAnimationType === 0) {
        uintArray.set(
          [
            objectType,
            routeIndex,
            colorIndex,
            86400000,
            86400000,
            performance.now(),
            1,
            delay,
          ],
          offset,
        );

        floatArray.set([sectionIndex, nextSectionIndex], offset);
        uintTexture.needsUpdate = true;
        floatTexture.needsUpdate = true;
        this.start = i + 1;
        return i;
      }
    }
    console.log("Error: exceed the max train count");
  }

  update(
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
    const { uintTexture, floatTexture } = this,
      uintArray = uintTexture.image.data,
      floatArray = floatTexture.image.data,
      offset = instanceID * 8;
    uintArray.set([timeOffset, timeOffset + duration], offset + 3);
    floatArray.set(
      [
        sectionIndex,
        nextSectionIndex,
        accelerationTime,
        normalizedAcceleration,
        decelerationTime,
        normalizedDeceleration,
      ],
      offset,
    );
    uintTexture.needsUpdate = true;
    floatTexture.needsUpdate = true;
  }

  remove(instanceID: number): Promise<void> {
    return new Promise((resolve) => {
      const uintTexture = this.uintTexture,
        uintArray = uintTexture.image.data,
        offset = instanceID * 8;

      uintArray.set([performance.now(), 2], offset + 5);
      uintTexture.needsUpdate = true;

      animation.start({
        complete: () => {
          uintArray.set([0, 0], offset + 6);
          uintTexture.needsUpdate = true;
          this.start = Math.min(instanceID, this.start);
          resolve();
        },
        duration: configs.fadeDuration,
      });
    });
  }

  setMarked(id?: number): void {
    this.marked = id;
  }

  setTracked(id?: number): void {
    this.tracked = id;
  }

  getIDs(
    bufferArray: Float32Array,
  ): [InstanceIDs, InstanceIDs, InstanceIDs, InstanceIDs] {
    const uintArray = this.uintTexture.image.data,
      ugCarIDs: InstanceIDs = { body: [], delayMarker: [], outline: [] },
      ogCarIDs: InstanceIDs = { body: [], delayMarker: [], outline: [] },
      aircraftIDs: InstanceIDs = { body: [], delayMarker: [], outline: [] },
      busIDs: InstanceIDs = { body: [], delayMarker: [], outline: [] };

    for (let i = 0, ilen = this.count; i < ilen; i++) {
      const offset = i * 8,
        fadeAnimationType = uintArray[offset + 6];

      if (fadeAnimationType !== 0) {
        const objectType = uintArray[offset],
          delay = uintArray[offset + 7],
          z = bufferArray[i * 4 + 2],
          ids =
            objectType === 0
              ? z < 0
                ? ugCarIDs
                : ogCarIDs
              : objectType === 1
                ? aircraftIDs
                : busIDs;

        ids.body.push(i);
        if (delay === 1) {
          ids.delayMarker.push(i);
        }
        if (i === this.marked || i === this.tracked) {
          ids.outline.push(i);
        }
      }
    }

    // This ensures smooth fade animations
    ugCarIDs.body.sort((a, b) => (a % 256) - (b % 256));
    ogCarIDs.body.sort((a, b) => (a % 256) - (b % 256));

    return [ugCarIDs, ogCarIDs, aircraftIDs, busIDs];
  }

  dispose(): void {
    this.uintTexture.dispose();
    this.floatTexture.dispose();
  }
}
