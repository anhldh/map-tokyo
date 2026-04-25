import { DecodeUTF8, Gunzip } from "fflate";
import configs from "../utils/config";

let touchDevice = false;

if (typeof window !== "undefined") {
  // Browser environment
  window.addEventListener(
    "touchstart",
    () => {
      touchDevice = true;
    },
    { once: true },
  );
}

export function isTouchDevice(): boolean {
  return touchDevice;
}

export function loadJSON<T = unknown>(url: string): Promise<T> {
  return fetch(url).then((response) => {
    if (url.endsWith(".gz")) {
      let stringData = "";
      const reader = response.body!.getReader(),
        utfDecode = new DecodeUTF8((data) => {
          stringData += data;
        }),
        inflate = new Gunzip((data, final) => {
          utfDecode.push(data, final);
        });

      return reader.read().then(function pump({ done, value }): Promise<T> | T {
        if (done) {
          inflate.push(new Uint8Array(0), true);
          return JSON.parse(stringData) as T;
        }
        inflate.push(value!);
        return reader.read().then(pump);
      });
    } else {
      return response.json() as Promise<T>;
    }
  });
}

export function lerp(x: number, y: number, a: number): number {
  return x * (1 - a) + y * a;
}

export function clamp(value: number, lower: number, upper: number): number {
  return Math.min(Math.max(value, lower), upper);
}

export function includes(
  array: string | unknown[],
  value: unknown | unknown[],
): boolean {
  if (!Array.isArray(array) && typeof array !== "string") {
    return false;
  }
  if (!Array.isArray(value)) {
    return (array as unknown[]).indexOf(value) !== -1;
  }
  for (let i = 0, ilen = value.length; i < ilen; i++) {
    if ((array as unknown[]).indexOf(value[i]) === -1) {
      return false;
    }
  }
  return true;
}

export function flat<T>(array: T[][]): T[] {
  return array.reduce((acc, val) => acc.concat(val), [] as T[]);
}

export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\(.*\)|<.*>|〈.*〉|[\u0300-\u036F]/g, "");
}

export function valueOrDefault<T>(value: T | undefined, defaultValue: T): T {
  return value === undefined ? defaultValue : value;
}

export function numberOrDefault(value: number, defaultValue: number): number {
  return isNaN(value) ? defaultValue : value;
}

export function isString(value: unknown): value is string {
  return typeof value === "string" || value instanceof String;
}

export function mergeMaps<K, V>(...maps: Map<K, V>[]): Map<K, V> {
  const result = new Map<K, V>();

  for (const map of maps) {
    for (const [k, v] of map) {
      result.set(k, v);
    }
  }
  return result;
}

/**
 * Returns a time expression based on a time offset.
 * @param timeOffset - The number of milliseconds elapsed since the last 3am
 * @returns Time expression in "hh:mm" format
 */
export function getTimeString(timeOffset: number): string {
  const hours = `0${(Math.floor(timeOffset / 3600000) + 3) % 24}`.slice(-2),
    minutes = `0${Math.floor(timeOffset / 60000) % 60}`.slice(-2);

  return `${hours}:${minutes}`;
}

/**
 * Return a time offset based on a time expression.
 * @param string - Time expression in "hh:mm" format
 * @returns The number of milliseconds elapsed since the last 3am
 */
export function getTimeOffset(string: string): number {
  return (
    (((+string.substring(0, 2) + 21) % 24) * 60 + +string.substring(3, 5)) *
    60000
  );
}

/**
 * Given an array of member function names as strings, replace all of them
 * with bound versions that will always refer to `context` as `this`. This
 * is useful for classes where otherwise event bindings would reassign
 * `this` to the evented object or some other value: this lets you ensure
 * the `this` value always.
 *
 * @param fns - list of member function names
 * @param context - the context value
 */
export function bindAll(fns: string[], context: Record<string, unknown>): void {
  for (const fn of fns) {
    if (!context[fn]) {
      continue;
    }
    context[fn] = (context[fn] as (...args: any[]) => any).bind(context);
  }
}

export function removePrefix(value: string): string;
export function removePrefix(value: string[]): string[];
export function removePrefix(value: unknown): unknown;
export function removePrefix(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(/.*:/, "");
  }
  if (Array.isArray(value)) {
    return value.map(removePrefix);
  }
  return value;
}

export function cleanKeys<T extends Record<string, unknown>>(obj: T): T {
  for (const key of Object.keys(obj)) {
    if (obj[key] === undefined) {
      delete obj[key];
    }
  }
  return obj;
}

export function blink(): number {
  const p = ((performance.now() % 1500) / 1500) * 2;

  return p < 1 ? p : 2 - p;
}

/**
 * Measure the actual frame rate asynchronously
 * @returns A Promise that resolves to the measured frame rate value
 */
export function measureFrameRate(): Promise<number> {
  return new Promise((resolve) => {
    let count = 0;
    const start = performance.now(),
      repeat = () => {
        if (count++ < 60) {
          requestAnimationFrame(repeat);
        } else {
          resolve(1000 / ((performance.now() - start) / 60));
        }
      };
    repeat();
  });
}

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

/**
 * Returns the relative luminance of the color.
 * @param color - Color object that has r, g, b in range [0, 1]
 * @returns Relative luminance
 */
export function luminance(color: RGBColor): number {
  return 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
}

/**
 * Converts a hex color code to RGB array.
 * @param color - Hex color code (e.g. "#ff0000")
 * @returns RGB array [r, g, b]
 */
export function colorToRGBArray(color: string): [number, number, number] {
  const c = parseInt(color.replace("#", ""), 16);

  return [Math.floor(c / 65536) % 256, Math.floor(c / 256) % 256, c % 256];
}

/**
 * Creates an element with the specified attributes and appends it to a container.
 * @param tagName - A string that specifies the type of element to be created
 * @param attributes - The attributes to set
 * @param container - The node to append the element to
 * @returns The new Element
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  attributes: Record<string, unknown>,
  container?: Element | null,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);

  for (const key of Object.keys(attributes)) {
    try {
      (element as unknown as Record<string, unknown>)[key] = attributes[key];
    } catch {
      element.setAttribute(key, String(attributes[key]));
    }
  }
  if (container) {
    container.appendChild(element);
  }
  return element;
}

/**
 * Shows notification message.
 * @param container - Node in which the notification panel is shown
 * @param message - Notification message
 */
export function showNotification(container: Element, message: string): void {
  const element = createElement(
    "div",
    {
      className: "notification",
      innerHTML: message,
    },
    container,
  );

  setTimeout(() => {
    element.style.opacity = "0";
  }, 1000);
  setTimeout(() => {
    container.removeChild(element);
  }, 2000);
}

/**
 * Normalize the given language code to one of the supported codes. The
 * returned value is ISO 639-1 code, but the exception is Chinese
 * (zh-Hans or zh-Hant). Returns undefined if not supported.
 * @param lang - Language code
 * @returns Normalized language code, or undefined if not supported
 */
export function normalizeLang(lang: string): string | undefined {
  const langs = configs.langs.map((code) => code.replace("pt-BR", "pt"));

  if (lang.match(/^zh-(Hant|TW|HK|MO)/)) {
    lang = "zh-Hant";
  } else if (lang.match(/^zh/)) {
    lang = "zh-Hans";
  } else {
    lang = lang.substring(0, 2);
  }
  return includes(langs, lang) ? lang : undefined;
}

/**
 * Returns the language code for user interface. The returned value is
 * ISO 639-1 code, but the exception is Chinese (zh-Hans or zh-Hant).
 * @param lang - Language code to verify
 * @returns Language code for user interface
 */
export function getLang(lang: string): string {
  if (!includes(configs.langs, lang)) {
    const _navigator = window.navigator as Navigator & {
      userLanguage?: string;
      browserLanguage?: string;
    };

    lang =
      (_navigator.languages && _navigator.languages[0]) ||
      _navigator.language ||
      _navigator.userLanguage ||
      _navigator.browserLanguage ||
      "";
  }
  return normalizeLang(lang) || "en";
}
