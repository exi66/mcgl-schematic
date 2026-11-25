// Minimal NBT writer with explicit tag types (used to generate test schematics).

import { TAG } from './nbt';

export type Tagged =
  | { t: 'byte' | 'short' | 'int'; v: number }
  | { t: 'string'; v: string }
  | { t: 'byteArray'; v: Uint8Array }
  | { t: 'list'; of: number; v: Tagged[] }
  | { t: 'compound'; v: Record<string, Tagged> };

export const nbt = {
  byte: (v: number): Tagged => ({ t: 'byte', v }),
  short: (v: number): Tagged => ({ t: 'short', v }),
  int: (v: number): Tagged => ({ t: 'int', v }),
  string: (v: string): Tagged => ({ t: 'string', v }),
  byteArray: (v: Uint8Array): Tagged => ({ t: 'byteArray', v }),
  list: (of: number, v: Tagged[]): Tagged => ({ t: 'list', of, v }),
  compound: (v: Record<string, Tagged>): Tagged => ({ t: 'compound', v }),
};

const TAG_ID: Record<Tagged['t'], number> = {
  byte: TAG.Byte,
  short: TAG.Short,
  int: TAG.Int,
  string: TAG.String,
  byteArray: TAG.ByteArray,
  list: TAG.List,
  compound: TAG.Compound,
};

class Writer {
  private buf = new Uint8Array(1024);
  private view = new DataView(this.buf.buffer);
  len = 0;
  private ensure(n: number): void {
    if (this.len + n <= this.buf.length) return;
    let size = this.buf.length * 2;
    while (size < this.len + n) size *= 2;
    const nb = new Uint8Array(size);
    nb.set(this.buf);
    this.buf = nb;
    this.view = new DataView(nb.buffer);
  }
  u8(v: number): void {
    this.ensure(1);
    this.view.setInt8(this.len++, (v << 24) >> 24);
  }
  i16(v: number): void {
    this.ensure(2);
    this.view.setInt16(this.len, v);
    this.len += 2;
  }
  i32(v: number): void {
    this.ensure(4);
    this.view.setInt32(this.len, v);
    this.len += 4;
  }
  bytes(b: Uint8Array): void {
    this.ensure(b.length);
    this.buf.set(b, this.len);
    this.len += b.length;
  }
  str(s: string): void {
    const b = new TextEncoder().encode(s);
    this.i16(b.length);
    this.bytes(b);
  }
  payload(t: Tagged): void {
    switch (t.t) {
      case 'byte':
        return this.u8(t.v);
      case 'short':
        return this.i16(t.v);
      case 'int':
        return this.i32(t.v);
      case 'string':
        return this.str(t.v);
      case 'byteArray':
        this.i32(t.v.length);
        return this.bytes(t.v);
      case 'list':
        this.u8(t.v.length ? TAG_ID[t.v[0].t] : t.of);
        this.i32(t.v.length);
        for (const item of t.v) this.payload(item);
        return;
      case 'compound':
        for (const [k, v] of Object.entries(t.v)) {
          this.u8(TAG_ID[v.t]);
          this.str(k);
          this.payload(v);
        }
        this.u8(TAG.End);
        return;
    }
  }
  result(): Uint8Array {
    return this.buf.slice(0, this.len);
  }
}

/** Serializes a named root compound (uncompressed). */
export function writeNbt(name: string, root: Record<string, Tagged>): Uint8Array {
  const w = new Writer();
  w.u8(TAG.Compound);
  w.str(name);
  w.payload({ t: 'compound', v: root });
  return w.result();
}
