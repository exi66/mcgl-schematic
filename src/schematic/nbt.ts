// Minimal NBT reader (big-endian, all tag types). Pure TS, no dependencies.

export type NbtValue =
  | number
  | bigint
  | string
  | Int8Array
  | Int32Array
  | BigInt64Array
  | NbtValue[]
  | NbtCompound;

export interface NbtCompound {
  [key: string]: NbtValue;
}

export const TAG = {
  End: 0,
  Byte: 1,
  Short: 2,
  Int: 3,
  Long: 4,
  Float: 5,
  Double: 6,
  ByteArray: 7,
  String: 8,
  List: 9,
  Compound: 10,
  IntArray: 11,
  LongArray: 12,
} as const;

export class NbtError extends Error {}

class Reader {
  private pos = 0;
  private readonly view: DataView;
  private readonly bytes: Uint8Array;
  private readonly decoder = new TextDecoder('utf-8');

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  private need(n: number): void {
    if (this.pos + n > this.bytes.length) throw new NbtError('Неожиданный конец NBT');
  }

  u8(): number {
    this.need(1);
    return this.view.getUint8(this.pos++);
  }
  i8(): number {
    this.need(1);
    return this.view.getInt8(this.pos++);
  }
  i16(): number {
    this.need(2);
    const v = this.view.getInt16(this.pos);
    this.pos += 2;
    return v;
  }
  u16(): number {
    this.need(2);
    const v = this.view.getUint16(this.pos);
    this.pos += 2;
    return v;
  }
  i32(): number {
    this.need(4);
    const v = this.view.getInt32(this.pos);
    this.pos += 4;
    return v;
  }
  i64(): bigint {
    this.need(8);
    const v = this.view.getBigInt64(this.pos);
    this.pos += 8;
    return v;
  }
  f32(): number {
    this.need(4);
    const v = this.view.getFloat32(this.pos);
    this.pos += 4;
    return v;
  }
  f64(): number {
    this.need(8);
    const v = this.view.getFloat64(this.pos);
    this.pos += 8;
    return v;
  }
  str(): string {
    const len = this.u16();
    this.need(len);
    const s = this.decoder.decode(this.bytes.subarray(this.pos, this.pos + len));
    this.pos += len;
    return s;
  }
  byteArray(): Int8Array {
    const len = this.i32();
    if (len < 0) throw new NbtError('Отрицательная длина массива');
    this.need(len);
    const out = new Int8Array(this.bytes.buffer, this.bytes.byteOffset + this.pos, len).slice();
    this.pos += len;
    return out;
  }

  payload(tag: number, depth: number): NbtValue {
    if (depth > 512) throw new NbtError('Слишком глубокая вложенность NBT');
    switch (tag) {
      case TAG.Byte:
        return this.i8();
      case TAG.Short:
        return this.i16();
      case TAG.Int:
        return this.i32();
      case TAG.Long:
        return this.i64();
      case TAG.Float:
        return this.f32();
      case TAG.Double:
        return this.f64();
      case TAG.ByteArray:
        return this.byteArray();
      case TAG.String:
        return this.str();
      case TAG.List: {
        const itemTag = this.u8();
        const len = this.i32();
        const list: NbtValue[] = [];
        for (let i = 0; i < len; i++) list.push(this.payload(itemTag, depth + 1));
        return list;
      }
      case TAG.Compound: {
        const obj: NbtCompound = {};
        for (;;) {
          const t = this.u8();
          if (t === TAG.End) break;
          const name = this.str();
          obj[name] = this.payload(t, depth + 1);
        }
        return obj;
      }
      case TAG.IntArray: {
        const len = this.i32();
        const arr = new Int32Array(len);
        for (let i = 0; i < len; i++) arr[i] = this.i32();
        return arr;
      }
      case TAG.LongArray: {
        const len = this.i32();
        const arr = new BigInt64Array(len);
        for (let i = 0; i < len; i++) arr[i] = this.i64();
        return arr;
      }
      default:
        throw new NbtError(`Неизвестный тег NBT: ${tag}`);
    }
  }
}

/** Reads an uncompressed NBT document. Returns the root name and compound. */
export function readNbt(bytes: Uint8Array): { name: string; root: NbtCompound } {
  const r = new Reader(bytes);
  const tag = r.u8();
  if (tag !== TAG.Compound) throw new NbtError('Корень NBT — не compound');
  const name = r.str();
  const root = r.payload(TAG.Compound, 0) as NbtCompound;
  return { name, root };
}

export function isGzip(bytes: Uint8Array): boolean {
  return bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

export async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
