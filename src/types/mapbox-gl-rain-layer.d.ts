// src/types/mapbox-gl-rain-layer.d.ts
declare module "mapbox-gl-rain-layer" {
  export default class RainLayer {
    constructor(options?: {
      id?: string;
      source?: string;
      scale?: string;
      rainColor?: string;
      snowColor?: string;
      meshOpacity?: number;
      repaint?: boolean;
      [key: string]: any;
    });

    id: string;
    type: string;

    setRainColor(color: string): void;
    setSnowColor(color: string): void;
    setMeshOpacity(opacity: number): void;
    on(event: string, handler: (e: any) => void): void;
    off(event: string, handler: (e: any) => void): void;
    getLegendHTML(): string;
  }
}
