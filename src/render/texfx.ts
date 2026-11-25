// Animated atlas tiles, ported from the game client's texture effects (normal, non-HD mode).
// Every game tick (20 per second) each effect produces a 16×16 RGBA frame that is written into its atlas slot(s).

import { tileX, tileY } from './atlas';

export const TICKS_PER_SECOND = 20;

export interface TextureFx {
  /** Atlas slot of the top-left tile. */
  slot: number;
  /** Tiles per side the frame is repeated over (flowing fluids use 2×2). */
  size: 1 | 2;
  /** RGBA, 16×16. */
  pixels: Uint8ClampedArray;
  tick(): void;
}

const N = 16;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const fsin = (v: number) => Math.fround(Math.sin(v));

type Colorize = (v: number, out: Uint8ClampedArray, o: number) => void;

/** Water-like noise (water, plasma, oil): still blurs sideways, flowing blurs along the flow and scrolls. */
class WaterLikeFx implements TextureFx {
  pixels = new Uint8ClampedArray(N * N * 4);
  private a = new Float32Array(256);
  private b = new Float32Array(256);
  private c = new Float32Array(256);
  private d = new Float32Array(256);
  private t = 0;
  constructor(
    readonly slot: number,
    readonly size: 1 | 2,
    private readonly flowing: boolean,
    /** Scroll direction for flowing: +1 water/oil (index − t·16), −1 plasma (index + t·16). */
    private readonly scroll: 1 | -1,
    private readonly color: Colorize,
  ) {}
  tick(): void {
    this.t++;
    const { a, b, c, d } = this;
    for (let x = 0; x < N; x++)
      for (let y = 0; y < N; y++) {
        let s = 0;
        if (this.flowing) for (let j = y - 2; j <= y; j++) s += a[(x & 15) + (j & 15) * 16];
        else for (let i = x - 1; i <= x + 1; i++) s += a[(i & 15) + (y & 15) * 16];
        b[x + y * 16] = s / (this.flowing ? 3.2 : 3.3) + c[x + y * 16] * 0.8;
      }
    for (let i = 0; i < 256; i++) {
      c[i] += d[i] * 0.05;
      if (c[i] < 0) c[i] = 0;
      d[i] -= this.flowing ? 0.3 : 0.1;
      if (Math.random() < (this.flowing ? 0.2 : 0.05)) d[i] = 0.5;
    }
    this.a = b;
    this.b = a;
    for (let i = 0; i < 256; i++) {
      const src = this.flowing ? (i - this.scroll * this.t * 16) & 255 : i;
      this.color(clamp01(this.a[src]), this.pixels, i * 4);
    }
  }
}

const waterColor: Colorize = (v, o, k) => {
  const q = v * v;
  o[k] = 32 + q * 32;
  o[k + 1] = 50 + q * 64;
  o[k + 2] = 255;
  o[k + 3] = 146 + q * 50;
};
const plasmaColor: Colorize = (v, o, k) => {
  const q = v * v;
  o[k] = 255;
  o[k + 1] = 50 + q * 64;
  o[k + 2] = 32 + q * 32;
  o[k + 3] = 50 + q * 64;
};
const oilColor: Colorize = (v, o, k) => {
  const q = v * v;
  const g = 32 + q * 32;
  o[k] = g;
  o[k + 1] = g;
  o[k + 2] = g;
  o[k + 3] = 146 + q * 50;
};

class LavaFx implements TextureFx {
  pixels = new Uint8ClampedArray(N * N * 4);
  private a = new Float32Array(256);
  private b = new Float32Array(256);
  private c = new Float32Array(256);
  private d = new Float32Array(256);
  private t = 0;
  constructor(readonly slot: number, readonly size: 1 | 2, private readonly flowing: boolean) {}
  tick(): void {
    this.t++;
    const { a, b, c, d } = this;
    for (let x = 0; x < N; x++)
      for (let y = 0; y < N; y++) {
        let s = 0;
        const ox = Math.trunc(fsin((y * Math.PI * 2) / 16) * 1.2);
        const oy = Math.trunc(fsin((x * Math.PI * 2) / 16) * 1.2);
        for (let i = x - 1; i <= x + 1; i++) for (let j = y - 1; j <= y + 1; j++) s += a[((i + ox) & 15) + ((j + oy) & 15) * 16];
        const k = x + y * 16;
        b[k] =
          s / 10 +
          ((c[(x & 15) + (y & 15) * 16] + c[((x + 1) & 15) + (y & 15) * 16] + c[((x + 1) & 15) + ((y + 1) & 15) * 16] + c[(x & 15) + ((y + 1) & 15) * 16]) / 4) * 0.8;
        c[k] += d[k] * 0.01;
        if (c[k] < 0) c[k] = 0;
        d[k] -= 0.06;
        if (Math.random() < 0.005) d[k] = 1.5;
      }
    this.a = b;
    this.b = a;
    const p = this.pixels;
    for (let i = 0; i < 256; i++) {
      const src = this.flowing ? (i - Math.trunc(this.t / 3) * 16) & 255 : i;
      const v = clamp01(this.a[src] * 2);
      p[i * 4] = v * 100 + 155;
      p[i * 4 + 1] = v * v * 255;
      p[i * 4 + 2] = v * v * v * v * 128;
      p[i * 4 + 3] = 255;
    }
  }
}

/** java.util.Random (only what the portal needs). */
class JavaRandom {
  private seed: bigint;
  constructor(seed: number) {
    this.seed = (BigInt(seed) ^ 0x5deece66dn) & ((1n << 48n) - 1n);
  }
  private next(bits: number): number {
    this.seed = (this.seed * 0x5deece66dn + 0xbn) & ((1n << 48n) - 1n);
    return Number(this.seed >> BigInt(48 - bits));
  }
  nextFloat(): number {
    return this.next(24) / (1 << 24);
  }
}

class PortalFx implements TextureFx {
  readonly size = 1;
  pixels = new Uint8ClampedArray(N * N * 4);
  private frames: Uint8ClampedArray[] = [];
  private t = 0;
  constructor(readonly slot: number) {
    const rnd = new JavaRandom(100);
    for (let f = 0; f < 32; f++) {
      const fr = new Uint8ClampedArray(1024);
      for (let x = 0; x < 16; x++)
        for (let y = 0; y < 16; y++) {
          let v = 0;
          for (let k = 0; k < 2; k++) {
            const off = k * 8;
            let px = ((x - off) / 16) * 2;
            let py = ((y - off) / 16) * 2;
            if (px < -1) px += 2;
            if (px >= 1) px -= 2;
            if (py < -1) py += 2;
            if (py >= 1) py -= 2;
            const r2 = px * px + py * py;
            let w = Math.atan2(py, px) + ((f / 32) * Math.PI * 2 - r2 * 10 + k * 2) * (k * 2 - 1);
            w = (fsin(w) + 1) / 2;
            w /= r2 + 1;
            v += w * 0.5;
          }
          v += rnd.nextFloat() * 0.1;
          const i = (y * 16 + x) * 4;
          // Values wrap like Java byte casts.
          fr[i] = Math.trunc(v * v * 200 + 55) & 255;
          fr[i + 1] = Math.trunc(v * v * v * v * 255) & 255;
          fr[i + 2] = Math.trunc(v * 100 + 155) & 255;
          fr[i + 3] = Math.trunc(v * 100 + 155) & 255;
        }
      this.frames.push(fr);
    }
  }
  tick(): void {
    this.t++;
    this.pixels.set(this.frames[this.t & 31]);
  }
}

/** Plutonium (500): a bright line sweeping down through a blurred, fading grey field. */
class PlutoniumFx implements TextureFx {
  readonly size = 1;
  pixels = new Uint8ClampedArray(N * N * 4);
  private a = new Float32Array(256);
  private b = new Float32Array(256);
  private t = 0;
  constructor(readonly slot: number) {}
  tick(): void {
    this.t++;
    const row = this.t % 16;
    const cur = this.a;
    for (let x = 1; x < 15; x++) cur[x + row * 16] = 1;
    const next = this.b;
    for (let x = 0; x < 16; x++)
      for (let y = 0; y < 16; y++) {
        let s = 0;
        for (let i = x - 1; i <= x + 1; i++)
          for (let j = y - 1; j <= y + 1; j++) {
            const ii = i < 0 ? 15 : i >= 16 ? 0 : i;
            const jj = j < 0 ? 15 : j >= 16 ? 0 : j;
            s += cur[ii + 16 * jj];
          }
        next[x + y * 16] = 0.9 * (s / 9);
      }
    for (let i = 0; i < 256; i++) {
      const g = Math.min(255, Math.trunc(255 * next[i]));
      this.pixels[i * 4] = g;
      this.pixels[i * 4 + 1] = g;
      this.pixels[i * 4 + 2] = g;
      this.pixels[i * 4 + 3] = 255;
    }
    this.a = next;
    this.b = cur;
  }
}

/** Titanium (838): diagonal light stripes running over the atlas tile. The client swaps red and blue here. */
class TitaniumFx implements TextureFx {
  readonly size = 1;
  pixels = new Uint8ClampedArray(N * N * 4);
  private t = 0;
  constructor(readonly slot: number, private readonly base: Uint8ClampedArray) {}
  tick(): void {
    this.t++;
    for (let x = 0; x < 16; x++)
      for (let y = 0; y < 16; y++) {
        let dark = (16 - x + 16 - y + this.t) % 8 <= 4;
        if (x < 1 || x >= 15 || y < 1 || y >= 15) dark = false;
        const add = dark ? 0 : 25;
        const i = (y * 16 + x) * 4;
        // ARGB int → bytes [b, g, r] in the client.
        this.pixels[i] = Math.min(255, this.base[i + 2] + add);
        this.pixels[i + 1] = Math.min(255, this.base[i + 1] + add);
        this.pixels[i + 2] = Math.min(255, this.base[i] + add);
        this.pixels[i + 3] = 255;
      }
  }
}

/** Energy field (496): white with sparse brighter pixels, scrolling up. */
class EnergyFieldFx implements TextureFx {
  readonly size = 1;
  pixels = new Uint8ClampedArray(N * N * 4);
  constructor(readonly slot: number) {
    for (let i = 0; i < 256; i++) {
      this.pixels.set([255, 255, 255, Math.floor(Math.random() * 14) === 5 ? 128 : 64], i * 4);
    }
  }
  tick(): void {
    const p = this.pixels;
    for (let x = 0; x < 16; x++) {
      const top = p.slice(x * 4, x * 4 + 4);
      for (let y = 0; y < 15; y++) p.copyWithin((y * 16 + x) * 4, ((y + 1) * 16 + x) * 4, ((y + 1) * 16 + x) * 4 + 4);
      p.set(top, (15 * 16 + x) * 4);
    }
  }
}

/** Energy bridge (501): pale blue with pulsing transparency and random sparks. */
class BridgeFx implements TextureFx {
  readonly size = 1;
  pixels = new Uint8ClampedArray(N * N * 4);
  private n = 0;
  private dir = 0;
  private level = 30;
  constructor(readonly slot: number) {
    for (let i = 0; i < 256; i++) this.pixels.set([100, 150, 255, 30], i * 4);
  }
  tick(): void {
    if (++this.n >= 2) {
      this.n = 0;
      const i = Math.floor(Math.random() * 16) * 16 + Math.floor(Math.random() * 16);
      this.pixels[i * 4 + 3] = this.level + 50;
    }
    if (this.dir === 0) {
      if (++this.level >= 64) this.dir = 1;
    } else if (--this.level <= 30) this.dir = 0;
    for (let i = 0; i < 256; i++) {
      const a = this.pixels[i * 4 + 3];
      this.pixels[i * 4 + 3] = a > this.level + 1 ? a - 2 : this.level;
    }
  }
}

/** Slot 502: the energy field frame cut to a circle. */
class FieldCircleFx implements TextureFx {
  readonly size = 1;
  pixels = new Uint8ClampedArray(N * N * 4);
  constructor(readonly slot: number, private readonly src: EnergyFieldFx) {}
  tick(): void {
    for (let x = 0; x < 16; x++)
      for (let y = 0; y < 16; y++) {
        const dx = x - 7, dy = y - 7;
        const i = (y * 16 + x) * 4;
        if (dx * dx + dy * dy < 49) this.pixels.set(this.src.pixels.subarray(i, i + 4), i);
        else this.pixels[i + 3] = 0;
      }
  }
}

/** RGBA pixels of the whole atlas (ImageData in the browser, decoded PNG in build scripts). */
export interface AtlasPixels {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
}

function readTile(img: AtlasPixels, slot: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(N * N * 4);
  const x0 = tileX(slot), y0 = tileY(slot);
  for (let y = 0; y < 16; y++) out.set(img.data.subarray(((y0 + y) * img.width + x0) * 4, ((y0 + y) * img.width + x0 + 16) * 4), y * 64);
  return out;
}

/** All effects of the client, in its registration order. */
/** Top-left slots of all animated tiles, in the order of createEffects (also the order of fx-icons.png). */
export const FX_SLOTS = [205, 269, 237, 301, 270, 302, 500, 496, 501, 14, 206, 238, 502, 838] as const;

/** Ticks run to make the icon frames: ends on the last frame of the 32-frame portal cycle. */
export const ICON_TICKS = 32 * 8 - 1;

export function createEffects(atlas: AtlasPixels): TextureFx[] {
  const field = new EnergyFieldFx(496);
  return [
    new WaterLikeFx(205, 1, false, 1, waterColor),
    new WaterLikeFx(269, 1, false, 1, plasmaColor),
    new LavaFx(237, 1, false),
    new WaterLikeFx(301, 1, false, 1, oilColor),
    new WaterLikeFx(270, 2, true, -1, plasmaColor),
    new WaterLikeFx(302, 2, true, 1, oilColor),
    new PlutoniumFx(500),
    field,
    new BridgeFx(501),
    new PortalFx(14),
    new WaterLikeFx(206, 2, true, 1, waterColor),
    new LavaFx(238, 2, true),
    new FieldCircleFx(502, field),
    new TitaniumFx(838, readTile(atlas, 838)),
  ];
}

/** Drives the effects at 20 ticks per second and writes frames into the atlas image. */
export class AtlasAnimator {
  private readonly effects: TextureFx[];
  private last = 0;
  private acc = 0;
  private readonly tileImg = new ImageData(16, 16);

  constructor(private readonly ctx: CanvasRenderingContext2D) {
    this.effects = createEffects(ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height));
    // Warm up so the first frame is not empty.
    for (let i = 0; i < 40; i++) this.tickAll();
    this.write();
  }

  private tickAll(): void {
    for (const fx of this.effects) fx.tick();
  }

  private write(): void {
    for (const fx of this.effects) {
      this.tileImg.data.set(fx.pixels);
      for (let dy = 0; dy < fx.size; dy++)
        for (let dx = 0; dx < fx.size; dx++) {
          const s = fx.slot + dx + dy * 16;
          this.ctx.putImageData(this.tileImg, tileX(s), tileY(s));
        }
    }
  }

  /** Advances to `now` (ms); returns true if the atlas changed. */
  step(now: number): boolean {
    if (!this.last) {
      this.last = now;
      return false;
    }
    this.acc += Math.min(now - this.last, 250);
    this.last = now;
    const tickMs = 1000 / TICKS_PER_SECOND;
    if (this.acc < tickMs) return false;
    while (this.acc >= tickMs) {
      this.tickAll();
      this.acc -= tickMs;
    }
    this.write();
    return true;
  }
}
