import {
  LngLat,
  LngLatBounds,
  type LngLatLike,
  type Map as MapboxMap,
} from "mapbox-gl";
import { parseCSSColor } from "csscolorparser";
import { lerp, luminance, valueOrDefault, type RGBColor } from "./helpers";
import SunCalc from "suncalc";

const HOUR = 3600000;
const RADIAN_TO_DEGREE = 180 / Math.PI;
const BG_LAYER_IDS = ["background", "background-underground"] as const;

/** Internal light color + intensity bundle used in setSunlight. */
interface LightColor {
  r: number;
  g: number;
  b: number;
  /** Intensity in [0, 1]. */
  i: number;
  /** Shadow intensity – directional only. */
  w?: number;
}

/** Sun position expressed in degrees. */
interface SunPosition {
  azimuth: number;
  altitude: number;
}

// ---------------------------------------------------------------------------
// Mapbox internal style type shims (not exported by mapbox-gl's public types)
// ---------------------------------------------------------------------------

interface MapboxStyle {
  _layers: Record<
    string,
    { id: string; type: string; metadata: Record<string, unknown> }
  >;
  _order: string[];
  transition: { duration: number };
  getOwnLayer: (id: string) => {
    paint: {
      get: <T>(key: string) => T;
    };
  };
}

type InternalMap = MapboxMap & { style: MapboxStyle };

// ---------------------------------------------------------------------------

/**
 * Returns the smallest bounding box that contains all the given points.
 * @param coords - Array of LngLatLike objects
 * @returns The bounding box
 */
export function getBounds(coords: LngLatLike[]): LngLatBounds {
  const bounds = new LngLatBounds();

  for (const coord of coords) {
    bounds.extend(coord);
  }
  return bounds;
}

/**
 * Sets the properties in the specified layer that inherits deck.gl's MapboxLayer.
 * @param map - Mapbox's Map object
 * @param id - The ID of the layer
 * @param props - One or more properties to update
 */
export function setLayerProps(
  map: MapboxMap,
  id: string,
  props: Record<string, unknown>,
): void {
  (
    map.getLayer(id) as unknown as {
      setProps: (p: Record<string, unknown>) => void;
    }
  ).setProps(props);
}

/**
 * Returns the sunlight color at a specific time.
 * @param map - Mapbox's Map object
 * @param time - Milliseconds elapsed since January 1, 1970 00:00:00 UTC
 * @returns Color object with r, g, b in range [0, 1]
 */
export function getSunlightColor(map: MapboxMap, time: number): RGBColor {
  const center = map.getCenter(),
    { sunrise, sunset } = SunCalc.getTimes(
      new Date(time),
      center.lat,
      center.lng,
    ),
    sunriseTime = sunrise.getTime(),
    sunsetTime = sunset.getTime();
  let t: number, r: number, g: number, b: number;

  if (time >= sunriseTime - HOUR && time < sunriseTime) {
    // Night to sunrise
    t = (time - sunriseTime) / HOUR + 1;
    r = lerp(0.4, 0.8, t);
    g = lerp(0.4, 0.9, t);
    b = lerp(0.5, 1, t);
  } else if (time >= sunriseTime && time < sunriseTime + HOUR) {
    // Sunrise to day
    t = (time - sunriseTime) / HOUR;
    r = lerp(0.8, 1, t);
    g = lerp(0.9, 1, t);
    b = 1;
  } else if (time >= sunriseTime + HOUR && time < sunsetTime - HOUR) {
    // Day
    r = g = b = 1;
  } else if (time >= sunsetTime - HOUR && time < sunsetTime) {
    // Day to sunset
    t = (time - sunsetTime) / HOUR + 1;
    r = 1;
    g = lerp(1, 0.9, t);
    b = lerp(1, 0.8, t);
  } else if (time >= sunsetTime && time < sunsetTime + HOUR) {
    // Sunset to night
    t = (time - sunsetTime) / HOUR;
    r = lerp(1, 0.4, t);
    g = lerp(0.9, 0.4, t);
    b = lerp(0.8, 0.5, t);
  } else {
    // Night
    r = g = 0.4;
    b = 0.5;
  }
  return { r, g, b };
}

/**
 * Sets the sunlight at a specific time to the map.
 * @param map - Mapbox's Map object
 * @param time - Milliseconds elapsed since January 1, 1970 00:00:00 UTC
 */
export function setSunlight(map: MapboxMap, time: number): void {
  const center = map.getCenter(),
    { sunrise, sunset } = SunCalc.getTimes(
      new Date(time),
      center.lat,
      center.lng,
    ),
    sunriseTime = sunrise.getTime(),
    sunsetTime = sunset.getTime(),
    { azimuth, altitude } = SunCalc.getPosition(
      new Date(time),
      center.lat,
      center.lng,
    ),
    sunAzimuth = 180 + azimuth * RADIAN_TO_DEGREE,
    sunAltitude = 90 - altitude * RADIAN_TO_DEGREE;
  let t: number,
    ambient: LightColor,
    directional: LightColor,
    sun: SunPosition;

  if (time >= sunriseTime - HOUR / 2 && time < sunriseTime) {
    // Night to sunrise
    const sunrisePosition = SunCalc.getPosition(
      new Date(sunriseTime),
      center.lat,
      center.lng,
    );

    t = (time - sunriseTime) / (HOUR / 2) + 1;
    ambient = {
      r: lerp(0, 153, t),
      g: lerp(22, 179, t),
      b: lerp(56, 204, t),
      i: lerp(0.5, 0.65, t),
    };
    directional = { r: 74, g: 74, b: 74, i: lerp(0.5, 0.6, t), w: 0.5 };
    sun = {
      azimuth: lerp(
        210,
        180 + sunrisePosition.azimuth * RADIAN_TO_DEGREE,
        t,
      ),
      altitude: 20,
    };
  } else if (time >= sunriseTime && time < sunriseTime + HOUR) {
    // Sunrise to day
    t = (time - sunriseTime) / HOUR;
    ambient = {
      r: lerp(153, 255, t),
      g: lerp(179, 255, t),
      b: lerp(204, 255, t),
      i: lerp(0.65, 0.7, t),
    };
    directional = {
      r: lerp(254, 255, t),
      g: lerp(202, 255, t),
      b: lerp(139, 255, t),
      i: lerp(0.6, 0.3, t),
      w: 1,
    };
    sun = { azimuth: sunAzimuth, altitude: sunAltitude };
  } else if (time >= sunriseTime + HOUR && time < sunsetTime - HOUR) {
    // Day
    ambient = { r: 255, g: 255, b: 255, i: 0.7 };
    directional = { r: 255, g: 255, b: 255, i: 0.3, w: 1 };
    sun = { azimuth: sunAzimuth, altitude: sunAltitude };
  } else if (time >= sunsetTime - HOUR && time < sunsetTime) {
    // Day to sunset
    t = (time - sunsetTime) / HOUR + 1;
    ambient = {
      r: lerp(255, 204, t),
      g: lerp(255, 179, t),
      b: lerp(255, 153, t),
      i: lerp(0.7, 0.65, t),
    };
    directional = {
      r: lerp(255, 254, t),
      g: lerp(255, 194, t),
      b: lerp(255, 134, t),
      i: lerp(0.3, 0.6, t),
      w: 1,
    };
    sun = { azimuth: sunAzimuth, altitude: sunAltitude };
  } else if (time >= sunsetTime && time < sunsetTime + HOUR / 2) {
    // Sunset to night
    const sunsetPosition = SunCalc.getPosition(
      new Date(sunsetTime),
      center.lat,
      center.lng,
    );

    t = (time - sunsetTime) / (HOUR / 2);
    ambient = {
      r: lerp(204, 0, t),
      g: lerp(179, 22, t),
      b: lerp(153, 56, t),
      i: lerp(0.65, 0.5, t),
    };
    directional = { r: 74, g: 74, b: 74, i: lerp(0.6, 0.5, t), w: 0.5 };
    sun = {
      azimuth: lerp(180 + sunsetPosition.azimuth * RADIAN_TO_DEGREE, 210, t),
      altitude: 20,
    };
  } else {
    // Night
    ambient = { r: 0, g: 22, b: 56, i: 0.5 };
    directional = { r: 74, g: 74, b: 74, i: 0.5, w: 0.5 };
    sun = { azimuth: 210, altitude: 20 };
  }

  map.setLights([
    {
      id: "ambient",
      type: "ambient",
      properties: {
        color: `rgb(${ambient.r}, ${ambient.g}, ${ambient.b})`,
        intensity: ambient.i,
      },
    },
    {
      id: "directional",
      type: "directional",
      properties: {
        direction: ["literal", [sun.azimuth, sun.altitude]],
        color: `rgb(${directional.r}, ${directional.g}, ${directional.b})`,
        intensity: directional.i,
        "cast-shadows": true,
        "shadow-intensity": directional.w,
      },
    },
  ] as Parameters<MapboxMap["setLights"]>[0]);

  map.setPaintProperty("sky", "sky-atmosphere-sun", [sunAzimuth, sunAltitude]);
}

/**
 * Checks if the background color of the map is dark.
 * @param map - Mapbox's Map object
 * @param actual - If true, the result is based on the current background color.
 *     Otherwise, the result is based on the target background color.
 * @returns True if the background color of the map is dark
 */
export function hasDarkBackground(map: MapboxMap, actual: boolean): boolean {
  const internalMap = map as unknown as InternalMap;
  const light = (
    map.getLights() as Array<{
      type: string;
      properties: { color: string; intensity: number };
    }>
  ).filter(({ type }) => type === "ambient")[0];

  const lightColorElements = parseCSSColor(light.properties.color) as
    | [number, number, number, number]
    | null;

  if (!lightColorElements) return false;

  const lightIntensity = light.properties.intensity,
    lr = (lightColorElements[0] / 255) * lightIntensity,
    lg = (lightColorElements[1] / 255) * lightIntensity,
    lb = (lightColorElements[2] / 255) * lightIntensity;

  if (actual) {
    return (
      BG_LAYER_IDS.reduce((acc, id) => {
        const paint = internalMap.style.getOwnLayer(id).paint;
        // Bypass union type incompatibility for internal paint.get()
        const color = (paint as any).get("background-color") as { r: number; g: number; b: number };
        const a = (paint as any).get("background-opacity") as number;
        return (
          acc +
          luminance({
            r: color.r * lr * a,
            g: color.g * lg * a,
            b: color.b * lb * a,
          })
        );
      }, 0) < 0.5
    );
  }

  return (
    BG_LAYER_IDS.reduce((acc, id) => {
      const [r, g, b] = parseCSSColor(
        map.getPaintProperty(id, "background-color") as string,
      ) as [number, number, number, number];
      const a = valueOrDefault(
        map.getPaintProperty(id, "background-opacity") as number | undefined,
        1,
      );
      return (
        acc +
        luminance({ r: r * lr * a, g: g * lg * a, b: b * lb * a })
      );
    }, 0) < 127.5
  );
}

/** A single style opacity entry returned by {@link getStyleOpacities}. */
export interface StyleOpacity {
  id: string;
  key?: string;
  opacity?: number | Array<{ index: number; value: number }>;
  metadata: Record<string, unknown>;
}

/**
 * Returns an array of the style opacity information retrieved from map layers.
 * @param map - Mapbox's Map object
 * @param metadataKey - Metadata key to filter
 * @returns Array of the style opacity objects
 */
export function getStyleOpacities(
  map: MapboxMap,
  metadataKey: string,
): StyleOpacity[] {
  const { _layers, _order } = (map as unknown as InternalMap).style;
  const propMapping: Record<string, unknown> = {
    "background-underground": 1,
    "building-underground-underground": [
      "interpolate",
      ["linear"],
      ["zoom"],
      14.5,
      0,
      15,
      1,
    ],
  };
  const opacities: StyleOpacity[] = [];

  _order
    .map((id) => _layers[id])
    .filter(({ metadata }) => metadata && metadata[metadataKey])
    .forEach(({ id, type, metadata }) => {
      if (type === "custom") {
        opacities.push({ id, metadata });
        return;
      }

      const key = `${type}-opacity`;
      const prop: unknown =
        propMapping[id] ??
        valueOrDefault(
          map.getPaintProperty(id, key as any) as unknown,
          1 as unknown,
        );

      if (!isNaN(prop as number)) {
        opacities.push({ id, key, opacity: prop as number, metadata });
      } else if ((prop as { stops?: unknown[] }).stops) {
        const opacity: Array<{ index: number; value: number }> = [];

        (prop as { stops: [unknown, number][] }).stops.forEach(
          (item, index) => {
            opacity.push({ index, value: item[1] });
          },
        );
        opacities.push({ id, key, opacity, metadata });
      } else if (
        (prop as unknown[])[0] === "case" ||
        (prop as unknown[])[0] === "interpolate"
      ) {
        const opacity: Array<{ index: number; value: number }> = [];
        const arr = prop as unknown[];

        arr.forEach((item, index) => {
          if (
            (index % 2 === 0 || index === arr.length - 1) &&
            !isNaN(item as number)
          ) {
            opacity.push({ index, value: item as number });
          }
        });
        opacities.push({ id, key, opacity, metadata });
      }
    });

  return opacities;
}

/**
 * Sets style opacities based on the style opacity objects and factor.
 * @param map - Mapbox's Map object
 * @param styleOpacities - Array of the style opacity objects
 * @param factorKey - Metadata key (or keys) for the factor to multiply
 */
export function setStyleOpacities(
  map: MapboxMap,
  styleOpacities: StyleOpacity[],
  factorKey: string | string[],
): void {
  const duration = (map as unknown as InternalMap).style.transition.duration;

  for (const { id, key, opacity, metadata } of styleOpacities) {
    let factor: number;

    if (Array.isArray(factorKey)) {
      factor = factorKey.reduce<number | undefined>(
        (value, k) =>
          valueOrDefault(value, metadata[k] as number | undefined),
        undefined,
      ) as number;
    } else {
      factor = metadata[factorKey] as number;
    }

    if (key) {
      let prop: unknown;

      if (Array.isArray(opacity)) {
        prop = map.getPaintProperty(id, key as any);
        for (const { index, value } of opacity) {
          const scaledOpacity = value * factor;

          if ((prop as { stops?: unknown[] }).stops) {
            (prop as { stops: unknown[][] }).stops[index][1] = scaledOpacity;
          } else {
            (prop as unknown[])[index] = scaledOpacity;
          }
        }
      } else {
        prop = (opacity as number) * factor;
      }
      map.setPaintProperty(id, key as any, prop as any);
    } else {
      const start = performance.now(),
        current = valueOrDefault(
          (
            map.getLayer(id) as unknown as {
              props?: { opacity?: number };
            }
          ).props?.opacity,
          1,
        );

      // Workaround for deck.gl's transitions property which doesn't work as expected
      (function repeat() {
        const elapsed = performance.now() - start;

        setLayerProps(map, id, {
          opacity: lerp(current, factor, Math.min(elapsed / duration, 1)),
        });
        if (elapsed < duration) {
          requestAnimationFrame(repeat);
        }
      })();
    }
  }
}

/**
 * Fetches the UTC offset (in minutes) for a given location.
 * @param lngLat - Longitude/latitude of the location
 * @param accessToken - Mapbox access token
 * @returns UTC offset in minutes (negative = west of UTC)
 */
export function fetchTimezoneOffset(
  lngLat: LngLatLike,
  accessToken: string,
): Promise<number> {
  const { lng, lat } = LngLat.convert(lngLat);

  return fetch(
    `https://api.mapbox.com/v4/examples.4ze9z6tv/tilequery/${lng},${lat}.json?radius=22224&limit=1&access_token=${accessToken}`,
  )
    .then((response) => response.json())
    .then(
      ({
        features,
      }: {
        features: Array<{ properties: { TZID: string } }>;
      }) => {
        if (features.length === 0) {
          throw new Error("No timezone feature found");
        }

        const timeZone = features[0].properties.TZID,
          date = new Date(),
          utcDate = new Date(
            date.toLocaleString("en-US", { timeZone: "UTC" }),
          ),
          tzDate = new Date(date.toLocaleString("en-US", { timeZone }));

        return (utcDate.getTime() - tzDate.getTime()) / 60000;
      },
    )
    .catch(() => {
      return -Math.round(lng / 15) * 60;
    });
}
