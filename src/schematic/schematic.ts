import i18next from 'i18next';
import { gunzip, isGzip, readNbt, type NbtCompound, type NbtValue } from './nbt';

/** MCEdit .schematic contents. Index of a block: (y * length + z) * width + x. */
export interface Schematic {
  width: number; // X
  height: number; // Y
  length: number; // Z
  blocks: Uint8Array; // id 0..255
  data: Uint8Array; // metadata 0..15
  tileEntities: NbtCompound[];
  warnings: string[];
}

export class SchematicError extends Error {}

export function blockIndex(s: Pick<Schematic, 'width' | 'length'>, x: number, y: number, z: number): number {
  return (y * s.length + z) * s.width + x;
}

function num(v: NbtValue | undefined, name: string): number {
  if (typeof v !== 'number') throw new SchematicError(i18next.t('errors.noField', { name }));
  return v;
}

export function schematicFromNbt(root: NbtCompound): Schematic {
  const width = num(root.Width, 'Width');
  const height = num(root.Height, 'Height');
  const length = num(root.Length, 'Length');
  if (width <= 0 || height <= 0 || length <= 0) throw new SchematicError(i18next.t('errors.empty'));
  const total = width * height * length;
  const rawBlocks = root.Blocks;
  const rawData = root.Data;
  if (!(rawBlocks instanceof Int8Array)) throw new SchematicError(i18next.t('errors.noBlocks'));
  if (rawBlocks.length !== total) {
    throw new SchematicError(i18next.t('errors.blocksSize', { size: rawBlocks.length, width, height, length }));
  }
  const warnings: string[] = [];
  const materials = root.Materials;
  if (typeof materials === 'string' && materials !== 'Alpha') {
    warnings.push(i18next.t('warnings.materials', { materials }));
  }
  if (root.AddBlocks !== undefined || root.Add !== undefined) {
    warnings.push(i18next.t('warnings.addBlocks'));
  }
  const blocks = new Uint8Array(rawBlocks.buffer, rawBlocks.byteOffset, rawBlocks.length).slice();
  const data = new Uint8Array(total);
  if (rawData instanceof Int8Array && rawData.length === total) {
    for (let i = 0; i < total; i++) data[i] = rawData[i] & 15;
  } else {
    warnings.push(i18next.t('warnings.noData'));
  }
  const te = Array.isArray(root.TileEntities)
    ? (root.TileEntities.filter(
        (t) => typeof t === 'object' && !Array.isArray(t) && !ArrayBuffer.isView(t),
      ) as NbtCompound[])
    : [];
  return { width, height, length, blocks, data, tileEntities: te, warnings };
}

/** Parses a .schematic file (gzip-compressed or raw NBT). */
export async function parseSchematic(bytes: Uint8Array): Promise<Schematic> {
  let raw = bytes;
  if (isGzip(bytes)) {
    try {
      raw = await gunzip(bytes);
    } catch {
      throw new SchematicError(i18next.t('errors.gzip'));
    }
  }
  let parsed;
  try {
    parsed = readNbt(raw);
  } catch (e) {
    throw new SchematicError(i18next.t('errors.notSchematic', { reason: (e as Error).message }));
  }
  return schematicFromNbt(parsed.root);
}
