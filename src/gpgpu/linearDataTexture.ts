import {
  DataTexture,
  FloatType,
  RGBAFormat,
  RGBAIntegerFormat,
  RGFormat,
  UnsignedByteType,
  UnsignedIntType,
  type TextureDataType,
  type PixelFormat,
} from "three";

interface TextureProps {
  TypedArray: typeof Uint8Array | typeof Uint32Array | typeof Float32Array;
  format: PixelFormat;
  type: TextureDataType;
  unit: number;
}

const PROPS: Record<string, TextureProps> = {
  ubyte4: {
    TypedArray: Uint8Array,
    format: RGBAFormat,
    type: UnsignedByteType,
    unit: 4,
  },
  uint4: {
    TypedArray: Uint32Array,
    format: RGBAIntegerFormat,
    type: UnsignedIntType,
    unit: 4,
  },
  float4: {
    TypedArray: Float32Array,
    format: RGBAFormat,
    type: FloatType,
    unit: 4,
  },
  float2: {
    TypedArray: Float32Array,
    format: RGFormat,
    type: FloatType,
    unit: 2,
  },
};

type TypedArrayInstance = Uint8Array | Uint32Array | Float32Array;

export default class LinearDataTexture extends DataTexture {
  // Removed override image to avoid accessor conflict

  constructor(
    textureOrSize: number | LinearDataTexture,
    textureTypeOrIncreaseOrOffset: string | number,
    chunkSizeOrDecrease?: number,
  ) {
    if (typeof textureOrSize === "number") {
      // Create a new texture
      const size = textureOrSize;
      const textureType = textureTypeOrIncreaseOrOffset as string;
      const chunkSize = chunkSizeOrDecrease as number;
      const { TypedArray, format, type, unit } = PROPS[textureType];
      const chunkCount = Math.ceil(size / chunkSize);
      const array = new TypedArray(chunkSize * chunkCount * unit);

      super(array, chunkSize, chunkCount, format, type);

      Object.assign(this.userData, { size, TypedArray, unit });
      this.needsUpdate = true;
    } else if (chunkSizeOrDecrease === undefined) {
      // Create an expanded texture
      const texture = textureOrSize;
      const increase = textureTypeOrIncreaseOrOffset as number;
      const { image, userData, format, type } = texture;
      const { data, width: chunkSize } = image;
      const {
        size: currentSize,
        TypedArray,
        unit,
      } = userData as {
        size: number;
        TypedArray:
          | typeof Uint8Array
          | typeof Uint32Array
          | typeof Float32Array;
        unit: number;
      };
      const size = currentSize + increase;
      const chunkCount = Math.ceil(size / chunkSize);
      let array: TypedArrayInstance;

      if (chunkCount === image.height) {
        array = data as TypedArrayInstance;
      } else {
        array = new TypedArray(chunkSize * chunkCount * unit);
        array.set(data);
      }

      super(array, chunkSize, chunkCount, format as PixelFormat, type as TextureDataType);

      Object.assign(this.userData, { size, TypedArray, unit });
      this.needsUpdate = true;
    } else {
      // Created a shrinked texture
      const texture = textureOrSize;
      const offset = textureTypeOrIncreaseOrOffset as number;
      const decrease = chunkSizeOrDecrease;
      const { image, userData, format, type } = texture;
      const { data, width: chunkSize } = image;
      const {
        size: currentSize,
        TypedArray,
        unit,
      } = userData as {
        size: number;
        TypedArray:
          | typeof Uint8Array
          | typeof Uint32Array
          | typeof Float32Array;
        unit: number;
      };
      const size = currentSize - decrease;
      const chunkCount = Math.ceil(size / chunkSize);
      let array: TypedArrayInstance;

      if (chunkCount === image.height) {
        array = data as TypedArrayInstance;
      } else {
        array = new TypedArray(chunkSize * chunkCount * unit);
        array.set(data.subarray(0, offset * unit));
        array.set(
          data.subarray((offset + decrease) * unit, currentSize * unit),
          offset * unit,
        );
      }

      super(array, chunkSize, chunkCount, format as PixelFormat, type as TextureDataType);

      Object.assign(this.userData, { size, TypedArray, unit });
      this.needsUpdate = true;
    }
  }

  get size(): number {
    return this.userData.size;
  }
}
