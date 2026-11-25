// Test scene: every block of the pool with its meaningful metadata, a few blocks outside the pool (stubs)
// and small connection demos (wires, tubes, superconductor, lamps, fluid levels).
// Written to test/fixtures/all-blocks.schematic and public/examples/all-blocks.schematic by make-test-schematic.ts.

import { BLOCKS, type BlockDef } from '../src/blocks/pool';

/** Ids outside the pool, drawn as stubs. */
export const UNKNOWN_IDS = [1, 7, 250];

/** Metadata variants worth showing for a block. */
export function variants(d: BlockDef): number[] {
  const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  switch (d.id) {
    case 138: // lamp: attachment side
    case 230: // detector: front side
      return range(0, 5);
    case 29:
    case 33: // piston: facing, + extended
      return [...range(0, 5), 8 | 1, 8 | 2];
    case 69: // lever: attachment, + on
      return [...range(1, 7), 8 | 5];
    case 93:
    case 94: // repeater: direction × delay
      return [0, 1, 2, 3, 4, 8, 12];
    case 75:
    case 76: // torch: attachment
      return range(1, 5);
    case 55:
      return [0, 7, 15];
    case 170:
      return [0, 1];
    case 42: // iron, bronze, copper, tin, hazard ×2, titanium
      return range(0, 6);
    case 34: // piston head: drawn by an extended piston
      return [];
    case 100:
    case 129:
      return range(0, 9);
    case 178:
      return range(0, 2);
    case 179:
    case 158:
    case 172:
      return range(0, 3);
    case 159: // particle source, MEU container, crusher, transmitter, factory parts, draw table, concrete mixer
      return range(0, 12);
    case 61: // furnace: front by meta; 8+ — electric furnace
      return [0, 2, 3, 4, 5, 8, 10, 11, 12, 13];
    case 62:
      return [3, 11];
    case 211: // cauldron, witch cauldron
      return [0, 1];
    case 212: // transport pipe colours
      return [0, 1, 2, 3, 4];
    case 209:
      return [0];
    case 137:
      return [0, 1];
    default:
      return d.render === 'fluid' ? [0, 1, 3, 5, 7, 8] : [0];
  }
}

export interface Scene {
  width: number;
  height: number;
  length: number;
  blocks: Uint8Array;
  data: Uint8Array;
}

export function buildTestScene(): Scene {
  const defs = [...BLOCKS.values()].sort((a, b) => a.id - b.id);
  const catalogRows = defs.length + 1; // + unknown ids
  const demoRows = 8;
  const width = 2 + 2 * 12;
  const height = 5; // the bottom layer is a temporary floor, cut off at the end
  const length = 1 + 2 * (catalogRows + demoRows);
  const blocks = new Uint8Array(width * height * length);
  const data = new Uint8Array(width * height * length);
  const set = (x: number, y: number, z: number, id: number, meta = 0) => {
    if (x < 0 || y < 0 || z < 0 || x >= width || y >= height || z >= length)
      throw new Error(`out of scene: ${x},${y},${z}`);
    const i = (y * length + z) * width + x;
    blocks[i] = id;
    data[i] = meta;
  };

  // Catalog: one row per block, variants along +X (wrapping onto y=2 if more than 12).
  let z = 1;
  for (const d of defs) {
    variants(d).forEach((meta, i) => {
      const x = 1 + 2 * (i % 12);
      const y = 1 + 2 * Math.floor(i / 12);
      set(x, y, z, d.id, meta);
    });
    z += 2;
  }
  UNKNOWN_IDS.forEach((id, i) => set(1 + 2 * i, 1, z, id));
  z += 2;

  // Demo 1: redstone line — torch, wire, repeater, wire, climbing onto a block, lever.
  set(1, 1, z, 76, 5);
  for (let x = 2; x <= 5; x++) set(x, 1, z, 55, 15);
  set(6, 1, z, 94, 1);
  for (let x = 7; x <= 9; x++) set(x, 1, z, 55, 12);
  set(10, 1, z, 4);
  set(10, 2, z, 55, 11);
  set(11, 2, z, 55, 10);
  set(11, 1, z, 4);
  set(12, 1, z, 69, 5);
  set(3, 1, z + 1, 55, 15); // a T-junction
  z += 2;

  // Demo 2: electric grid and water supply — generator, wire, pump, tubes, tank.
  set(1, 1, z, 226);
  set(1, 2, z, 89);
  for (let x = 2; x <= 5; x++) set(x, 1, z, 170, 1);
  set(6, 1, z, 171, 5);
  for (let x = 7; x <= 9; x++) set(x, 1, z, 172, 3);
  set(9, 2, z, 172, 3);
  set(10, 2, z, 172, 3);
  set(11, 2, z, 173, 5);
  set(12, 2, z, 9);
  z += 2;

  // Demo 3: BAK fragment — iron line with superconductor above/below and ice at the ring edge, lamp strip.
  for (let x = 1; x <= 8; x++) {
    set(x, 1, z, 158);
    set(x, 2, z, 42);
    set(x, 3, z, 158);
  }
  set(9, 1, z, 79);
  set(9, 3, z, 79);
  set(10, 2, z, 160);
  set(11, 2, z, 159);
  for (let x = 13; x <= 16; x++) set(x, 3, z, 138, 0);
  z += 2;

  // Demo 4: fluid level ramps (source → level 7) for every fluid kind.
  for (const [i, id] of [8, 10, 97, 143].entries()) {
    for (let m = 0; m <= 7; m++) set(1 + m, 1, z + (i % 2), id, m);
    if (i % 2 === 1) z += 2;
  }

  // Demo 5: falling water (meta 8) onto a pool, and plasma pool 3×3 under a synthesizer with obsidian.
  set(1, 3, z, 9, 0);
  set(1, 2, z, 8, 8);
  set(1, 1, z, 8, 8);
  set(2, 1, z, 8, 1);
  for (let dx = -1; dx <= 1; dx++) for (let dz = 0; dz <= 1; dz++) set(6 + dx, 1, z + dz, 98, 0);
  set(6, 3, z, 131, 1);
  set(5, 3, z, 49);
  set(7, 3, z, 49);
  set(6, 3, z + 1, 49);
  set(10, 1, z, 231);
  set(10, 2, z, 229, 0);
  set(10, 3, z, 229, 1);
  set(12, 1, z, 248);
  set(13, 1, z, 248);
  set(15, 1, z, 135);
  set(15, 2, z, 135);
  for (let x = 17; x <= 19; x++) for (let y = 1; y <= 3; y++) set(x, y, z, 135);
  for (let y = 1; y <= 3; y++) set(16, y, z, 49);
  for (let y = 1; y <= 3; y++) set(20, y, z, 49);
  // Demo 6: transport pipes — straight runs, a corner, a T, a vertical riser, colours meeting at a coupling.
  z += 2;
  for (let x = 1; x <= 5; x++) set(x, 1, z, 212, 0);
  set(5, 1, z + 1, 212, 0);
  set(5, 2, z + 1, 212, 0);
  set(5, 3, z + 1, 212, 0);
  set(3, 1, z + 1, 212, 0);
  set(6, 1, z, 212, 3);
  for (let x = 7; x <= 9; x++) set(x, 1, z, 212, 1);
  set(10, 1, z, 209, 0);
  for (let x = 11; x <= 13; x++) set(x, 1, z, 212, 4);
  for (let x = 15; x <= 17; x++) set(x, 1, z, 212, 2);
  set(1, 1, z + 1, 212, 1); // red next to black: no connection

  // Drop the bottom layer: the viewer draws its own floor grid.
  const layer = width * length;
  return {
    width,
    height: height - 1,
    length,
    blocks: blocks.slice(layer),
    data: data.slice(layer),
  };
}
