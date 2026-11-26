import { describe, expect, it } from 'vitest';
import { readTile } from '../src/render/texfx';

/** A 512×512 atlas with a distinct value per pixel, and the same atlas scaled up by `k` (each pixel becomes k×k). */
function atlases(k: number) {
  const base = new Uint8ClampedArray(512 * 512 * 4);
  for (let i = 0; i < 512 * 512; i++) {
    base[i * 4] = i % 251;
    base[i * 4 + 1] = (i * 7) % 253;
    base[i * 4 + 2] = Math.floor(i / 512) % 249;
    base[i * 4 + 3] = 255;
  }
  const w = 512 * k;
  const hd = new Uint8ClampedArray(w * w * 4);
  for (let y = 0; y < w; y++)
    for (let x = 0; x < w; x++) {
      const s = (Math.floor(y / k) * 512 + Math.floor(x / k)) * 4;
      hd.set(base.subarray(s, s + 4), (y * w + x) * 4);
    }
  return { base: { data: base, width: 512 }, hd: { data: hd, width: w } };
}

describe('readTile on an HD atlas', () => {
  for (const k of [2, 4]) {
    it(`gives the same 16×16 tile as the standard atlas (×${k})`, () => {
      const { base, hd } = atlases(k);
      for (const slot of [0, 14, 205, 269, 500, 838]) {
        expect(readTile(hd, slot)).toEqual(readTile(base, slot));
      }
    });
  }
});
