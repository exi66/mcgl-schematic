import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BLOCKS } from '../src/blocks/pool';
import { parseSchematic } from '../src/schematic/schematic';
import { buildTestScene, UNKNOWN_IDS, variants } from '../scripts/test-scene';

const fixture = (name: string) => new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));

describe('parseSchematic', () => {
  it('reads the generated all-blocks schematic exactly as built', async () => {
    const scene = buildTestScene();
    const s = await parseSchematic(fixture('all-blocks.schematic'));
    expect([s.width, s.height, s.length]).toEqual([scene.width, scene.height, scene.length]);
    expect(s.blocks).toEqual(scene.blocks);
    expect(s.data).toEqual(scene.data);
    expect(s.warnings).toEqual([]);
  });

  it('contains every pool block with all its variants, plus stub ids', async () => {
    const s = await parseSchematic(fixture('all-blocks.schematic'));
    const seen = new Set<string>();
    for (let i = 0; i < s.blocks.length; i++) seen.add(`${s.blocks[i]}:${s.data[i]}`);
    for (const d of BLOCKS.values()) {
      for (const m of variants(d)) expect(seen.has(`${d.id}:${m}`), `${d.id}:${m}`).toBe(true);
    }
    for (const id of UNKNOWN_IDS) {
      expect(BLOCKS.has(id)).toBe(false);
      expect(seen.has(`${id}:0`)).toBe(true);
    }
  });

  it('rejects non-schematic data', async () => {
    await expect(parseSchematic(new Uint8Array([1, 2, 3, 4]))).rejects.toThrow(/схематика/);
  });
});
