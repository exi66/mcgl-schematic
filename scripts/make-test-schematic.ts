// pnpm make:test-schematic — regenerates the test schematic with all pool blocks.
import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { nbt, writeNbt } from '../src/schematic/nbt-write';
import { TAG } from '../src/schematic/nbt';
import { buildTestScene } from './test-scene';

const s = buildTestScene();
const bytes = writeNbt('Schematic', {
  Width: nbt.short(s.width),
  Height: nbt.short(s.height),
  Length: nbt.short(s.length),
  Materials: nbt.string('Alpha'),
  Blocks: nbt.byteArray(s.blocks),
  Data: nbt.byteArray(s.data),
  Entities: nbt.list(TAG.Compound, []),
  TileEntities: nbt.list(TAG.Compound, []),
});
const gz = gzipSync(bytes);
for (const dir of ['test/fixtures', 'public/examples']) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/all-blocks.schematic`, gz);
}
console.log(`all-blocks.schematic: ${s.width}×${s.height}×${s.length}, ${gz.length} bytes`);
