// Runs before dev/build: renders icon frames of the animated atlas tiles (plutonium, titanium, energy field,
// bridge, portal/barrier, fluids) with the same effects the viewer animates, and writes them in one row to
// public/assets/fx-icons.png (16 px per tile, order = FX_SLOTS). Deterministic: Math.random is seeded.
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { createEffects, FX_SLOTS, ICON_TICKS } from '../src/render/texfx';

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

Math.random = mulberry32(20261126);

const atlas = PNG.sync.read(readFileSync('public/assets/terrain.png'));
const effects = createEffects({ data: atlas.data, width: atlas.width });
for (let i = 0; i < ICON_TICKS; i++) for (const fx of effects) fx.tick();

const out = new PNG({ width: 16 * FX_SLOTS.length, height: 16 });
FX_SLOTS.forEach((slot, k) => {
  const fx = effects.find((e) => e.slot === slot);
  if (!fx) throw new Error(`No effect for slot ${slot}`);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const src = (y * 16 + x) * 4;
      const dst = (y * out.width + k * 16 + x) * 4;
      for (let c = 0; c < 4; c++) out.data[dst + c] = fx.pixels[src + c];
    }
});
writeFileSync('public/assets/fx-icons.png', PNG.sync.write(out));
console.log(`fx-icons.png: ${FX_SLOTS.length} tiles`);
