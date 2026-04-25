/** Minimal type describing a deck.gl-extended Mapbox map. */
interface DeckExtendedMap {
  __deck?: {
    deckPicker?: unknown;
    pickObject: (opts: { x: number; y: number; layerIds: string[] }) => { object: unknown } | null;
  };
}

/**
 * Picks an object from a deck.gl layer rendered on top of a Mapbox map.
 * @param map - The Mapbox map augmented by deck.gl
 * @param id - The deck.gl layer ID to query
 * @param point - The screen-space point to pick at
 * @returns The picked object, or undefined if nothing was hit
 */
export function pickObject(
  map: DeckExtendedMap,
  id: string,
  point: { x: number; y: number },
): unknown | undefined {
  const deck = map.__deck;

  if (deck?.deckPicker) {
    const info = deck.pickObject({ x: point.x, y: point.y, layerIds: [id] });

    if (info) {
      return info.object;
    }
  }
}
