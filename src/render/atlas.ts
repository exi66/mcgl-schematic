// terrain.png is 512×512 with 16-px tiles, laid out as two 16×32 halves:
// slots 0..511 fill the left half row by row, 512..1023 — the right half.

export const ATLAS_SIZE = 512;

/** Pixel x of a texture slot's tile. */
export function tileX(slot: number): number {
  return ((slot % 16) + (slot > 511 ? 16 : 0)) * 16;
}

/** Pixel y of a texture slot's tile. */
export function tileY(slot: number): number {
  return Math.floor((slot % 512) / 16) * 16;
}
