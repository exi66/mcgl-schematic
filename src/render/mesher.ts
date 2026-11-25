// Builds block geometry for a voxel grid, following how the game client renders each block kind.
// Pure TS (no three.js) so it can run in a worker and be tested.

import { BLOCKS, ELECTRIC_CONNECT, REDSTONE_PROVIDERS, TUBE_CONNECT, type BlockDef, type Side } from '../blocks/pool';
import { tileX, tileY } from './atlas';
import {
  box,
  drawBox,
  faceBottom,
  faceNegX,
  faceNegZ,
  facePosX,
  facePosZ,
  faceTop,
  FULL,
  NO_ROT,
  SHADE,
  type Bounds,
  type UvRot,
} from './faces';
import { GeoBuilder, type GeoArrays } from './geometry';
import { drawTransportPipe, setOpaqueTest } from './transport';

/** Voxel access; returns 0 for air, out of bounds and hidden blocks. */
export interface Voxels {
  id(x: number, y: number, z: number): number;
  meta(x: number, y: number, z: number): number;
}

export interface ModelInstance {
  model: string;
  x: number;
  y: number;
  z: number;
  /** Metadata that picks the model rotation (0 — none). */
  rotation: number;
}

export interface MeshOutput {
  solid: GeoArrays;
  cutout: GeoArrays;
  translucent: GeoArrays;
  /** Blocks outside the pool: cubes textured from the stub atlas (slot = id). */
  unknown: GeoArrays;
  models: ModelInstance[];
}

/** Region [x0,x1)×[y0,y1)×[z0,z1) to mesh. */
export interface Region {
  x0: number;
  y0: number;
  z0: number;
  x1: number;
  y1: number;
  z1: number;
}

const A = 512;
/** Glass-like blocks: faces between two blocks of the same id are not drawn. */
const CULL_SAME = new Set([20, 79, 135, 154, 229, 248]);
/** Non-solid materials (fluids treat them as empty when computing surface heights). */
const NON_SOLID = new Set([0, 55, 69, 75, 76, 93, 94, 138, 170]);
/** Metal material: the superconductor with meta 1..3 connects only to these. */
const METAL = new Set([42, 131, 158, 159, 161, 172, 178, 179]);

function isOpaque(id: number): boolean {
  if (id === 0) return false;
  const d = BLOCKS.get(id);
  return d ? d.opaque : true; // unknown blocks are drawn as full cubes
}

setOpaqueTest(isOpaque);

function fluidOf(id: number): string | undefined {
  return BLOCKS.get(id)?.fluid;
}

export function meshRegion(v: Voxels, r: Region): MeshOutput {
  const solid = new GeoBuilder(0.25 / 512);
  const cutout = new GeoBuilder(0.25 / 512);
  const translucent = new GeoBuilder(0.25 / 512);
  const unknown = new GeoBuilder(0.25 / 512);
  const models: ModelInstance[] = [];
  const ctx: Ctx = { v, solid, cutout, translucent };

  for (let y = r.y0; y < r.y1; y++)
    for (let z = r.z0; z < r.z1; z++)
      for (let x = r.x0; x < r.x1; x++) {
        const id = v.id(x, y, z);
        if (id === 0) continue;
        const d = BLOCKS.get(id);
        if (!d) {
          drawUnknown(unknown, v, x, y, z, id);
          continue;
        }
        const meta = v.meta(x, y, z);
        const g = d.pass === 'solid' ? solid : d.pass === 'cutout' ? cutout : translucent;
        switch (d.render) {
          case 'cube':
          case 'fieldCube':
            drawCube(ctx, g, d, x, y, z, meta);
            break;
          case 'model': {
            const m = d.model?.(meta);
            if (m) models.push({ model: m, x, y, z, rotation: d.rotateModel ? meta : 0 });
            else drawCube(ctx, g, d, x, y, z, meta);
            break;
          }
          case 'fluid':
            drawFluid(ctx, g, d, x, y, z, meta);
            break;
          case 'redstoneWire':
            drawWire(ctx, g, d, x, y, z, meta, false);
            break;
          case 'electricWire':
            drawWire(ctx, g, d, x, y, z, meta, true);
            break;
          case 'torch':
            drawTorch(g, d, x, y, z, meta);
            break;
          case 'lever':
            drawLever(ctx, g, d, x, y, z, meta);
            break;
          case 'repeater':
            drawRepeater(g, d, x, y, z, meta);
            break;
          case 'piston':
            drawPiston(ctx, g, d, x, y, z, meta);
            break;
          case 'superconductor':
            drawSuperconductor(ctx, g, d, x, y, z, meta);
            break;
          case 'lamp':
            drawLamp(ctx, g, d, x, y, z, meta);
            break;
          case 'none':
            break;
          case 'transport':
            drawTransportPipe(g, v, x, y, z);
            break;
          case 'cauldron':
            drawCauldron(ctx, g, d, x, y, z, meta);
            break;
          case 'barrier': {
            // Thin along X unless there is a barrier on the X axis (then thin along Z), all faces drawn.
            const alongX = v.id(x - 1, y, z) === id || v.id(x + 1, y, z) === id;
            const b = alongX ? box(0, 0, 0.375, 1, 1, 0.625) : box(0.375, 0, 0, 0.625, 1, 1);
            drawBounded(ctx, g, d, x, y, z, meta, b, NO_ROT, true);
            break;
          }
          case 'tube':
            drawTube(ctx, g, d, x, y, z, meta);
            break;
        }
      }
  return {
    solid: solid.build(),
    cutout: cutout.build(),
    translucent: translucent.build(),
    unknown: unknown.build(),
    models,
  };
}

interface Ctx {
  v: Voxels;
  solid: GeoBuilder;
  cutout: GeoBuilder;
  translucent: GeoBuilder;
}

const DX = [0, 0, 0, 0, -1, 1];
const DY = [-1, 1, 0, 0, 0, 0];
const DZ = [0, 0, -1, 1, 0, 0];

/** Default shouldSideBeRendered: inset faces always, otherwise only next to a non-opaque block. */
function sideVisible(v: Voxels, x: number, y: number, z: number, s: number, b: Bounds, selfId: number): boolean {
  if (s === 0 && b.y0 > 0) return true;
  if (s === 1 && b.y1 < 1) return true;
  if (s === 2 && b.z0 > 0) return true;
  if (s === 3 && b.z1 < 1) return true;
  if (s === 4 && b.x0 > 0) return true;
  if (s === 5 && b.x1 < 1) return true;
  const n = v.id(x + DX[s], y + DY[s], z + DZ[s]);
  if (CULL_SAME.has(selfId) && n === selfId) return false;
  return !isOpaque(n);
}

function drawCube(c: Ctx, g: GeoBuilder, d: BlockDef, x: number, y: number, z: number, meta: number): void {
  drawBox(
    g,
    x,
    y,
    z,
    FULL,
    (s) => d.tex(s as Side, meta),
    (s) => sideVisible(c.v, x, y, z, s, FULL, d.id),
  );
}

function drawBounded(
  c: Ctx,
  g: GeoBuilder,
  d: BlockDef,
  x: number,
  y: number,
  z: number,
  meta: number,
  b: Bounds,
  rot: UvRot = NO_ROT,
  all = false,
): void {
  drawBox(
    g,
    x,
    y,
    z,
    b,
    (s) => d.tex(s as Side, meta),
    all ? () => true : (s) => sideVisible(c.v, x, y, z, s, b, d.id),
    rot,
  );
}

// ── Unknown blocks ───────────────────────────────────────────────────────────

function drawUnknown(g: GeoBuilder, v: Voxels, x: number, y: number, z: number, id: number): void {
  // Stub atlas: 16×16 tiles of 32 px; tile index = id. UVs are 0..1 over that atlas.
  const u0 = (id % 16) / 16;
  const v0 = Math.floor(id / 16) / 16;
  const u1 = u0 + 1 / 16;
  const v1 = v0 + 1 / 16;
  const shade = [0.5, 1, 0.8, 0.8, 0.6, 0.6];
  for (let s = 0; s < 6; s++) {
    if (isOpaque(v.id(x + DX[s], y + DY[s], z + DZ[s]))) continue;
    g.color(shade[s], shade[s], shade[s]);
    const X0 = x,
      X1 = x + 1,
      Y0 = y,
      Y1 = y + 1,
      Z0 = z,
      Z1 = z + 1;
    switch (s) {
      case 0:
        g.vertex(X0, Y0, Z1, u0, v1);
        g.vertex(X0, Y0, Z0, u0, v0);
        g.vertex(X1, Y0, Z0, u1, v0);
        g.vertex(X1, Y0, Z1, u1, v1);
        break;
      case 1:
        g.vertex(X1, Y1, Z1, u1, v1);
        g.vertex(X1, Y1, Z0, u1, v0);
        g.vertex(X0, Y1, Z0, u0, v0);
        g.vertex(X0, Y1, Z1, u0, v1);
        break;
      case 2:
        g.vertex(X0, Y1, Z0, u1, v0);
        g.vertex(X1, Y1, Z0, u0, v0);
        g.vertex(X1, Y0, Z0, u0, v1);
        g.vertex(X0, Y0, Z0, u1, v1);
        break;
      case 3:
        g.vertex(X0, Y1, Z1, u0, v0);
        g.vertex(X0, Y0, Z1, u0, v1);
        g.vertex(X1, Y0, Z1, u1, v1);
        g.vertex(X1, Y1, Z1, u1, v0);
        break;
      case 4:
        g.vertex(X0, Y1, Z1, u1, v0);
        g.vertex(X0, Y1, Z0, u0, v0);
        g.vertex(X0, Y0, Z0, u0, v1);
        g.vertex(X0, Y0, Z1, u1, v1);
        break;
      case 5:
        g.vertex(X1, Y0, Z1, u0, v1);
        g.vertex(X1, Y0, Z0, u1, v1);
        g.vertex(X1, Y1, Z0, u1, v0);
        g.vertex(X1, Y1, Z1, u0, v0);
        break;
    }
  }
}

// ── Fluids ───────────────────────────────────────────────────────────────────

/** Surface height at a block corner (x, z are the corner's +X/+Z block), as the client averages it. */
function fluidCornerHeight(v: Voxels, x: number, y: number, z: number, kind: string): number {
  let count = 0;
  let sum = 0;
  for (let i = 0; i < 4; i++) {
    const bx = x - (i & 1);
    const bz = z - ((i >> 1) & 1);
    if (fluidOf(v.id(bx, y + 1, bz)) === kind) return 1;
    const id = v.id(bx, y, bz);
    if (fluidOf(id) === kind) {
      const m = v.meta(bx, y, bz);
      if (m >= 8 || m === 0) {
        sum += fluidPercent(m) * 10;
        count += 10;
      }
      sum += fluidPercent(m);
      count++;
    } else if (NON_SOLID.has(id) || fluidOf(id) !== undefined) {
      sum += 1;
      count++;
    }
  }
  return 1 - sum / count;
}

/** Share of the block above the surface: (level + 1) / 9, level ≥ 8 counts as 0. */
export function fluidPercent(meta: number): number {
  return ((meta >= 8 ? 0 : meta) + 1) / 9;
}

function effectiveDecay(v: Voxels, x: number, y: number, z: number, kind: string): number {
  if (fluidOf(v.id(x, y, z)) !== kind) return -1;
  const m = v.meta(x, y, z);
  return m >= 8 ? 0 : m;
}

/** Horizontal flow vector from level differences with the 4 neighbours. */
export function flowVector(v: Voxels, x: number, y: number, z: number, kind: string): [number, number] {
  let fx = 0;
  let fz = 0;
  const own = effectiveDecay(v, x, y, z, kind);
  for (let l = 0; l < 4; l++) {
    let nx = x;
    let nz = z;
    if (l === 0) nx--;
    if (l === 1) nz--;
    if (l === 2) nx++;
    if (l === 3) nz++;
    let n = effectiveDecay(v, nx, y, nz, kind);
    if (n < 0) {
      const nid = v.id(nx, y, nz);
      if (NON_SOLID.has(nid)) {
        n = effectiveDecay(v, nx, y - 1, nz, kind);
        if (n >= 0) {
          const k = n - (own - 8);
          fx += (nx - x) * k;
          fz += (nz - z) * k;
        }
      }
    } else {
      const k = n - own;
      fx += (nx - x) * k;
      fz += (nz - z) * k;
    }
  }
  const len = Math.hypot(fx, fz);
  return len < 1e-4 ? [0, 0] : [fx / len, fz / len];
}

function fluidSideVisible(v: Voxels, x: number, y: number, z: number, s: number, kind: string): boolean {
  const n = v.id(x + DX[s], y + DY[s], z + DZ[s]);
  if (fluidOf(n) === kind) return false;
  if (n === 79) return false;
  if (s === 1) return true;
  return !isOpaque(n);
}

function drawFluid(c: Ctx, g: GeoBuilder, d: BlockDef, x: number, y: number, z: number, meta: number): void {
  const v = c.v;
  const kind = d.fluid!;
  const top = fluidSideVisible(v, x, y, z, 1, kind);
  const bottom = fluidSideVisible(v, x, y, z, 0, kind);
  const sides = [2, 3, 4, 5].map((s) => fluidSideVisible(v, x, y, z, s, kind));
  if (!top && !bottom && !sides.some(Boolean)) return;

  const h00 = fluidCornerHeight(v, x, y, z, kind);
  const h01 = fluidCornerHeight(v, x, y, z + 1, kind);
  const h11 = fluidCornerHeight(v, x + 1, y, z + 1, kind);
  const h10 = fluidCornerHeight(v, x + 1, y, z, kind);

  if (top) {
    // As the client: still texture centred in its tile; flowing — centred in the 2×2 flowing area and rotated
    // along the flow. The client halves the V offsets (an artefact of its 512-px atlas), kept as is.
    const [fx, fz] = flowVector(v, x, y, z, kind);
    const flowing = fx !== 0 || fz !== 0;
    const tex = d.tex(flowing ? 2 : 1, meta);
    const angle = flowing ? Math.atan2(fz, fx) - Math.PI / 2 : 0;
    const half = flowing ? 16 : 8;
    const cu = (tileX(tex) + half) / A;
    const cv = (tileY(tex) + half) / A;
    const s = (Math.sin(angle) * 8) / A;
    const co = (Math.cos(angle) * 8) / A;
    const s2 = s / 2;
    const co2 = co / 2;
    g.color(1, 1, 1);
    g.vertex(x, y + h00, z, cu - co - s, cv - co2 + s2);
    g.vertex(x, y + h01, z + 1, cu - co + s, cv + co2 + s2);
    g.vertex(x + 1, y + h11, z + 1, cu + co + s, cv + co2 - s2);
    g.vertex(x + 1, y + h10, z, cu + co - s, cv - co2 - s2);
  }
  if (bottom) {
    g.color(0.5, 0.5, 0.5);
    faceBottom(g, x, y, z, FULL, d.tex(0, meta), 0);
  }
  for (let i = 0; i < 4; i++) {
    if (!sides[i]) continue;
    const tex = d.tex((i + 2) as Side, meta);
    const U = tileX(tex);
    const V = tileY(tex);
    let ha: number, hb: number, xa: number, xb: number, za: number, zb: number;
    if (i === 0) {
      ha = h00;
      hb = h10;
      xa = x;
      xb = x + 1;
      za = z;
      zb = z;
    } else if (i === 1) {
      ha = h11;
      hb = h01;
      xa = x + 1;
      xb = x;
      za = z + 1;
      zb = z + 1;
    } else if (i === 2) {
      ha = h01;
      hb = h00;
      xa = x;
      xb = x;
      za = z + 1;
      zb = z;
    } else {
      ha = h10;
      hb = h11;
      xa = x + 1;
      xb = x + 1;
      za = z;
      zb = z + 1;
    }
    const u0 = U / A;
    const u1 = (U + 16 - 0.01) / A;
    const va = (V + (1 - ha) * 16) / A;
    const vb = (V + (1 - hb) * 16) / A;
    const v1 = (V + 16 - 0.01) / A;
    const sh = i < 2 ? 0.8 : 0.6;
    g.color(sh, sh, sh);
    g.vertex(xa, y + ha, za, u0, va);
    g.vertex(xb, y + hb, zb, u1, vb);
    g.vertex(xb, y, zb, u1, v1);
    g.vertex(xa, y, za, u0, v1);
  }
}

// ── Wires ────────────────────────────────────────────────────────────────────

/** isNormalCube: wires climb onto such blocks and are blocked by them from above. */
function normalCube(v: Voxels, x: number, y: number, z: number): boolean {
  return isOpaque(v.id(x, y, z));
}

function redstoneConnects(v: Voxels, x: number, y: number, z: number, dir: number): boolean {
  const id = v.id(x, y, z);
  if (id === 0) return false;
  if (REDSTONE_PROVIDERS.has(id)) return true;
  if (id === 93 || id === 94) {
    // A repeater connects on one side only, as in the game; dir −1 (climbing) never matches.
    return dir === [2, 3, 0, 1][v.meta(x, y, z) & 3];
  }
  return false;
}

function electricConnects(v: Voxels, x: number, y: number, z: number): boolean {
  return ELECTRIC_CONNECT.has(v.id(x, y, z));
}

function drawWire(
  c: Ctx,
  g: GeoBuilder,
  d: BlockDef,
  x: number,
  y: number,
  z: number,
  meta: number,
  electric: boolean,
): void {
  const v = c.v;
  const self = d.id;
  const conn = (cx: number, cy: number, cz: number, dir: number) =>
    electric ? electricConnects(v, cx, cy, cz) : redstoneConnects(v, cx, cy, cz, dir) || v.id(cx, cy, cz) === self;

  const p = meta / 15;
  let rr = p * 0.6 + 0.4;
  if (meta === 0) rr = electric ? 0.1 : 0.3;
  const gg = Math.max(0, p * p * 0.7 - 0.5);
  const bb = Math.max(0, p * p * 0.6 - 0.7);
  const tint: [number, number, number] = electric ? [bb, gg, rr] : [rr, gg, bb];

  const tex = d.tex(1, meta);
  const U = tileX(tex);
  const V = tileY(tex);
  let u15 = U / A,
    u17 = (U + 15.99) / A,
    v19 = V / A,
    v21 = (V + 15.99) / A;

  let w = conn(x - 1, y, z, 1) || (!normalCube(v, x - 1, y, z) && conn(x - 1, y - 1, z, -1));
  let e = conn(x + 1, y, z, 3) || (!normalCube(v, x + 1, y, z) && conn(x + 1, y - 1, z, -1));
  let n = conn(x, y, z - 1, 2) || (!normalCube(v, x, y, z - 1) && conn(x, y - 1, z - 1, -1));
  let s = conn(x, y, z + 1, 0) || (!normalCube(v, x, y, z + 1) && conn(x, y - 1, z + 1, -1));
  if (!normalCube(v, x, y + 1, z)) {
    if (normalCube(v, x - 1, y, z) && conn(x - 1, y + 1, z, -1)) w = true;
    if (normalCube(v, x + 1, y, z) && conn(x + 1, y + 1, z, -1)) e = true;
    if (normalCube(v, x, y, z - 1) && conn(x, y + 1, z - 1, -1)) n = true;
    if (normalCube(v, x, y, z + 1) && conn(x, y + 1, z + 1, -1)) s = true;
  }

  let x0 = x,
    x1 = x + 1,
    z0 = z,
    z1 = z + 1;
  let shape = 0;
  if ((w || e) && !n && !s) shape = 1;
  if ((n || s) && !e && !w) shape = 2;
  if (shape !== 0) {
    u15 = (U + 16) / A;
    u17 = (U + 16 + 15.99) / A;
  }
  const off = 0.03125; // overlay tile is one row below
  const yy = y + 0.015625;
  const quad = (o: number) => {
    if (shape === 2) {
      g.vertex(x1, yy, z1, u17, v21 + o);
      g.vertex(x1, yy, z0, u15, v21 + o);
      g.vertex(x0, yy, z0, u15, v19 + o);
      g.vertex(x0, yy, z1, u17, v19 + o);
    } else {
      g.vertex(x1, yy, z1, u17, v21 + o);
      g.vertex(x1, yy, z0, u17, v19 + o);
      g.vertex(x0, yy, z0, u15, v19 + o);
      g.vertex(x0, yy, z1, u15, v21 + o);
    }
  };
  if (shape === 0 && (w || e || n || s)) {
    if (!w) {
      x0 += 0.3125;
      u15 += 0.009765625;
    }
    if (!e) {
      x1 -= 0.3125;
      u17 -= 0.009765625;
    }
    if (!n) {
      z0 += 0.3125;
      v19 += 0.009765625;
    }
    if (!s) {
      z1 -= 0.3125;
      v21 -= 0.009765625;
    }
  }
  g.color(...tint);
  quad(0);
  g.color(1, 1, 1);
  quad(off);

  // Wire climbing up the side of a block.
  if (!normalCube(v, x, y + 1, z)) {
    const lu0 = (U + 16) / A,
      lu1 = (U + 16 + 15.99) / A,
      lv0 = V / A,
      lv1 = (V + 15.99) / A;
    const top = y + 1 + 0.021875;
    const wall = (pts: [number, number, number, number, number][]) => {
      for (const o of [0, off]) {
        if (o === 0) g.color(...tint);
        else g.color(1, 1, 1);
        for (const [px, py, pz, pu, pv] of pts) g.vertex(px, py, pz, pu, pv + o);
      }
    };
    const climb = (cx: number, cz: number) => normalCube(v, cx, y, cz) && v.id(cx, y + 1, cz) === self;
    if (climb(x - 1, z)) {
      const X = x + 0.015625;
      wall([
        [X, top, z + 1, lu1, lv0],
        [X, y, z + 1, lu0, lv0],
        [X, y, z, lu0, lv1],
        [X, top, z, lu1, lv1],
      ]);
    }
    if (climb(x + 1, z)) {
      const X = x + 1 - 0.015625;
      wall([
        [X, y, z + 1, lu0, lv1],
        [X, top, z + 1, lu1, lv1],
        [X, top, z, lu1, lv0],
        [X, y, z, lu0, lv0],
      ]);
    }
    if (climb(x, z - 1)) {
      const Z = z + 0.015625;
      wall([
        [x + 1, y, Z, lu0, lv1],
        [x + 1, top, Z, lu1, lv1],
        [x, top, Z, lu1, lv0],
        [x, y, Z, lu0, lv0],
      ]);
    }
    if (climb(x, z + 1)) {
      const Z = z + 1 - 0.015625;
      wall([
        [x + 1, top, Z, lu1, lv0],
        [x + 1, y, Z, lu0, lv0],
        [x, y, Z, lu0, lv1],
        [x, top, Z, lu1, lv1],
      ]);
    }
  }
}

// ── Torch, lever, repeater ───────────────────────────────────────────────────

/** Torch geometry tilted by (dx, dz), as the client draws it. */
function torchAt(g: GeoBuilder, tex: number, x: number, y: number, z: number, dx: number, dz: number): void {
  const U = tileX(tex);
  const V = tileY(tex);
  const u16 = U / A,
    u17 = (U + 15.99) / A,
    v18 = V / A,
    v19 = (V + 15.99) / A;
  const u20 = u16 + 7 / A,
    v22 = v18 + 6 / A;
  const u24 = u16 + 9 / A,
    v26 = v18 + 8 / A;
  x += 0.5;
  z += 0.5;
  const x28 = x - 0.5,
    x30 = x + 0.5,
    z32 = z - 0.5,
    z34 = z + 0.5;
  const w = 0.0625;
  const h = 0.625;
  g.color(1, 1, 1);
  // Top cap.
  g.vertex(x + dx * (1 - h) - w, y + h, z + dz * (1 - h) - w, u20, v22);
  g.vertex(x + dx * (1 - h) - w, y + h, z + dz * (1 - h) + w, u20, v26);
  g.vertex(x + dx * (1 - h) + w, y + h, z + dz * (1 - h) + w, u24, v26);
  g.vertex(x + dx * (1 - h) + w, y + h, z + dz * (1 - h) - w, u24, v22);
  // Four sides.
  g.vertex(x - w, y + 1, z32, u16, v18);
  g.vertex(x - w + dx, y, z32 + dz, u16, v19);
  g.vertex(x - w + dx, y, z34 + dz, u17, v19);
  g.vertex(x - w, y + 1, z34, u17, v18);
  g.vertex(x + w, y + 1, z34, u16, v18);
  g.vertex(x + dx + w, y, z34 + dz, u16, v19);
  g.vertex(x + dx + w, y, z32 + dz, u17, v19);
  g.vertex(x + w, y + 1, z32, u17, v18);
  g.vertex(x28, y + 1, z + w, u16, v18);
  g.vertex(x28 + dx, y, z + w + dz, u16, v19);
  g.vertex(x30 + dx, y, z + w + dz, u17, v19);
  g.vertex(x30, y + 1, z + w, u17, v18);
  g.vertex(x30, y + 1, z - w, u16, v18);
  g.vertex(x30 + dx, y, z - w + dz, u16, v19);
  g.vertex(x28 + dx, y, z - w + dz, u17, v19);
  g.vertex(x28, y + 1, z - w, u17, v18);
}

function drawTorch(g: GeoBuilder, d: BlockDef, x: number, y: number, z: number, meta: number): void {
  const tex = d.tex(0, meta);
  const t = 0.4;
  const o = 0.5 - t;
  const lift = 0.2;
  if (meta === 1) torchAt(g, tex, x - o, y + lift, z, -t, 0);
  else if (meta === 2) torchAt(g, tex, x + o, y + lift, z, t, 0);
  else if (meta === 3) torchAt(g, tex, x, y + lift, z - o, 0, -t);
  else if (meta === 4) torchAt(g, tex, x, y + lift, z + o, 0, t);
  else torchAt(g, tex, x, y, z, 0, 0);
}

function rotX(p: number[], a: number): void {
  const c = Math.cos(a),
    s = Math.sin(a);
  const y = p[1] * c + p[2] * s;
  const z = p[2] * c - p[1] * s;
  p[1] = y;
  p[2] = z;
}

function rotY(p: number[], a: number): void {
  const c = Math.cos(a),
    s = Math.sin(a);
  const x = p[0] * c + p[2] * s;
  const z = p[2] * c - p[0] * s;
  p[0] = x;
  p[2] = z;
}

function drawLever(c: Ctx, g: GeoBuilder, d: BlockDef, x: number, y: number, z: number, meta: number): void {
  const dir = meta & 7;
  const on = (meta & 8) !== 0;
  const a = 0.25,
    b = 0.1875,
    h = 0.1875;
  let base: Bounds | undefined;
  if (dir === 7) base = box(0.5 - b, 1 - h, 0.5 - a, 0.5 + b, 1, 0.5 + a);
  else if (dir === 5) base = box(0.5 - b, 0, 0.5 - a, 0.5 + b, h, 0.5 + a);
  else if (dir === 6) base = box(0.5 - a, 0, 0.5 - b, 0.5 + a, h, 0.5 + b);
  else if (dir === 4) base = box(0.5 - b, 0.5 - a, 1 - h, 0.5 + b, 0.5 + a, 1);
  else if (dir === 3) base = box(0.5 - b, 0.5 - a, 0, 0.5 + b, 0.5 + a, h);
  else if (dir === 2) base = box(1 - h, 0.5 - a, 0.5 - b, 1, 0.5 + a, 0.5 + b);
  else if (dir === 1) base = box(0, 0.5 - a, 0.5 - b, h, 0.5 + a, 0.5 + b);
  // The base uses the cobblestone texture.
  if (base)
    drawBox(
      g,
      x,
      y,
      z,
      base,
      () => 16,
      (s) => sideVisible(c.v, x, y, z, s, base!, d.id),
    );

  const tex = d.tex(0, meta);
  const U = tileX(tex);
  const V = tileY(tex);
  const w = 0.0625,
    hh = 0.625;
  const pts = [
    [-w, 0, -w],
    [w, 0, -w],
    [w, 0, w],
    [-w, 0, w],
    [-w, hh, -w],
    [w, hh, -w],
    [w, hh, w],
    [-w, hh, w],
  ];
  for (const p of pts) {
    if (on) {
      p[2] -= 0.0625;
      rotX(p, 0.6981317);
    } else {
      p[2] += 0.0625;
      rotX(p, -0.6981317);
    }
    if (dir === 6) rotY(p, Math.PI / 2);
    if (dir === 7) {
      rotX(p, Math.PI);
      p[0] += x + 0.5;
      p[1] += y + 1 - 0.125;
      p[2] += z + 0.5;
    } else if (dir < 5) {
      p[1] -= 0.375;
      rotX(p, Math.PI / 2);
      if (dir === 4) rotY(p, 0);
      if (dir === 3) rotY(p, Math.PI);
      if (dir === 2) rotY(p, Math.PI / 2);
      if (dir === 1) rotY(p, -Math.PI / 2);
      p[0] += x + 0.5;
      p[1] += y + 0.5;
      p[2] += z + 0.5;
    } else {
      p[0] += x + 0.5;
      p[1] += y + 0.125;
      p[2] += z + 0.5;
    }
  }
  const faces = [
    [0, 1, 2, 3],
    [7, 6, 5, 4],
    [1, 0, 4, 5],
    [2, 1, 5, 6],
    [3, 2, 6, 7],
    [0, 3, 7, 4],
  ];
  g.color(1, 1, 1);
  faces.forEach((f, i) => {
    const u0 = (U + 7) / A,
      u1 = (U + 9 - 0.01) / A;
    const v0 = (V + 6) / A;
    const v1 = (i === 0 ? V + 8 - 0.01 : V + 16 - 0.01) / A;
    const [p0, p1, p2, p3] = f.map((k) => pts[k]);
    g.vertex(p0[0], p0[1], p0[2], u0, v1);
    g.vertex(p1[0], p1[1], p1[2], u1, v1);
    g.vertex(p2[0], p2[1], p2[2], u1, v0);
    g.vertex(p3[0], p3[1], p3[2], u0, v0);
  });
}

const REPEATER_DELAY = [-0.0625, 0.0625, 0.1875, 0.3125];

function drawRepeater(g: GeoBuilder, d: BlockDef, x: number, y: number, z: number, meta: number): void {
  const dir = meta & 3;
  const delay = (meta >> 2) & 3;
  const slab = box(0, 0, 0, 1, 0.125, 1);
  // Base slab without the top (the top is drawn rotated below).
  drawBox(
    g,
    x,
    y,
    z,
    slab,
    (s) => d.tex(s as Side, meta),
    (s) => s !== 1,
  );

  const dy = -0.1875;
  let t1x = 0,
    t1z = 0,
    t2x = 0,
    t2z = 0;
  if (dir === 0) {
    t2z = -0.3125;
    t1z = REPEATER_DELAY[delay];
  } else if (dir === 1) {
    t2x = 0.3125;
    t1x = -REPEATER_DELAY[delay];
  } else if (dir === 2) {
    t2z = 0.3125;
    t1z = -REPEATER_DELAY[delay];
  } else {
    t2x = -0.3125;
    t1x = REPEATER_DELAY[delay];
  }
  const torchTex = d.tex(0, meta);
  torchAt(g, torchTex, x + t1x, y + dy, z + t1z, 0, 0);
  torchAt(g, torchTex, x + t2x, y + dy, z + t2z, 0, 0);

  const tex = d.tex(1, meta);
  const U = tileX(tex);
  const V = tileY(tex);
  const u0 = U / A,
    u1 = (U + 15.99) / A,
    v0 = V / A,
    v1 = (V + 15.99) / A;
  let a1 = x + 1,
    a2 = x + 1,
    a3 = x,
    a4 = x;
  let b1 = z,
    b2 = z + 1,
    b3 = z + 1,
    b4 = z;
  if (dir === 2) {
    a1 = a2 = x;
    a3 = a4 = x + 1;
    b1 = b4 = z + 1;
    b2 = b3 = z;
  } else if (dir === 3) {
    a1 = a4 = x;
    a2 = a3 = x + 1;
    b1 = b2 = z;
    b3 = b4 = z + 1;
  } else if (dir === 1) {
    a1 = a4 = x + 1;
    a2 = a3 = x;
    b1 = b2 = z + 1;
    b3 = b4 = z;
  }
  const yy = y + 0.125;
  g.color(1, 1, 1);
  g.vertex(a4, yy, b4, u0, v0);
  g.vertex(a3, yy, b3, u0, v1);
  g.vertex(a2, yy, b2, u1, v1);
  g.vertex(a1, yy, b1, u1, v0);
}

// ── Piston ───────────────────────────────────────────────────────────────────

function drawPiston(c: Ctx, g: GeoBuilder, d: BlockDef, x: number, y: number, z: number, meta: number): void {
  const facing = meta & 7;
  const extended = (meta & 8) !== 0;
  // UV rotation per side: [bottom, top, −Z, +Z, −X, +X].
  const rot: UvRot = [0, 0, 0, 0, 0, 0];
  switch (facing) {
    case 0:
      rot[2] = rot[3] = rot[4] = rot[5] = 3;
      break;
    case 2:
      rot[5] = 1;
      rot[4] = 2;
      break;
    case 3:
      rot[5] = 2;
      rot[4] = 1;
      rot[1] = 3;
      rot[0] = 3;
      break;
    case 4:
      rot[2] = 1;
      rot[3] = 2;
      rot[1] = 2;
      rot[0] = 1;
      break;
    case 5:
      rot[2] = 2;
      rot[3] = 1;
      rot[1] = 1;
      rot[0] = 2;
      break;
  }
  let b = FULL;
  if (extended) {
    b =
      [
        box(0, 0.25, 0, 1, 1, 1),
        box(0, 0, 0, 1, 0.75, 1),
        box(0, 0, 0.25, 1, 1, 1),
        box(0, 0, 0, 1, 1, 0.75),
        box(0.25, 0, 0, 1, 1, 1),
        box(0, 0, 0, 0.75, 1, 1),
      ][facing] ?? FULL;
  }
  drawBounded(c, g, d, x, y, z, meta, b, rot);
  if (extended && facing <= 5) drawPistonHead(c, g, d, x + DX[facing], y + DY[facing], z + DZ[facing], meta, rot);
}

/** Head of an extended piston in the cell it faces: a 4-px plate and a rod back into the base. */
function drawPistonHead(
  c: Ctx,
  g: GeoBuilder,
  d: BlockDef,
  x: number,
  y: number,
  z: number,
  meta: number,
  rot: UvRot,
): void {
  const n = c.v.id(x, y, z);
  if (n !== 0 && n !== 34) return;
  const facing = meta & 7;
  const front = d.id === 29 ? 106 : 107;
  const plateTex = (s: number) => (s === facing ? front : s === [1, 0, 3, 2, 5, 4][facing] ? front : 108);
  const q = 0.25;
  const plate = [
    box(0, 0, 0, 1, q, 1),
    box(0, 1 - q, 0, 1, 1, 1),
    box(0, 0, 0, 1, 1, q),
    box(0, 0, 1 - q, 1, 1, 1),
    box(0, 0, 0, q, 1, 1),
    box(1 - q, 0, 0, 1, 1, 1),
  ][facing];
  const a = 0.375,
    b = 0.625;
  // The rod runs from the plate back through this cell and a quarter into the base.
  const rod = [
    box(a, q, a, b, 1.25, b),
    box(a, -0.25, a, b, 1 - q, b),
    box(a, a, q, b, b, 1.25),
    box(a, a, -0.25, b, b, 1 - q),
    box(q, a, a, 1.25, b, b),
    box(-0.25, a, a, 1 - q, b, b),
  ][facing];
  drawBox(g, x, y, z, plate, plateTex, () => true, rot);
  drawBox(
    g,
    x,
    y,
    z,
    rod,
    () => 108,
    (s) => s !== facing && s !== [1, 0, 3, 2, 5, 4][facing],
    rot,
  );
}

// ── Superconductor: core + connectors ────────────────────────────────────────

function drawSuperconductor(c: Ctx, g: GeoBuilder, d: BlockDef, x: number, y: number, z: number, meta: number): void {
  const v = c.v;
  const p = 0.0625;
  const inset = p * (meta === 0 ? 5 : 6);
  const a = p * 7 - p / 2;
  const b = 1 - a;
  const mid = p * 8;
  const connects = (nx: number, ny: number, nz: number) => {
    const id = v.id(nx, ny, nz);
    if (id === 0) return false;
    if (meta >= 1 && meta <= 3) return METAL.has(id);
    return id === d.id || (isOpaque(id) && BLOCKS.get(id)?.render === 'cube') || !BLOCKS.has(id);
  };
  const boxes: Bounds[] = [box(inset, inset, inset, 1 - inset, 1 - inset, 1 - inset)];
  if (connects(x, y - 1, z)) boxes.push(box(a, 0, a, b, mid, b));
  if (connects(x, y + 1, z)) boxes.push(box(a, mid, a, b, 1, b));
  if (connects(x + 1, y, z)) boxes.push(box(mid, a, a, 1, b, b));
  if (connects(x - 1, y, z)) boxes.push(box(0, a, a, mid, b, b));
  if (connects(x, y, z + 1)) boxes.push(box(a, a, mid, b, b, 1));
  if (connects(x, y, z - 1)) boxes.push(box(a, a, 0, b, b, mid));
  for (const bx of boxes) drawBounded(c, g, d, x, y, z, meta, bx, NO_ROT, true);
}

// ── Lamp (138): thin light strips that join with neighbouring lamps ─────────

function drawLamp(c: Ctx, g: GeoBuilder, d: BlockDef, x: number, y: number, z: number, meta: number): void {
  const boxes = lampBoxes(c.v, x, y, z, meta, d.id);
  for (const b of boxes) drawBounded(c, g, d, x, y, z, meta, b);
}

export function lampBoxes(v: Voxels, x: number, y: number, z: number, m: number, self: number): Bounds[] {
  const lo = 0.001,
    hi = 0.999,
    t = 0.12;
  const c0 = 0.5 - t / 2,
    c1 = 0.5 + t / 2;
  const metaAt = (ax: number, ay: number, az: number) => v.meta(ax, ay, az);
  const same = (ax: number, ay: number, az: number, mm: number): boolean => {
    if (v.id(ax, ay, az) !== self) return false;
    const n = metaAt(ax, ay, az);
    if (mm <= 1 && mm !== n) return false;
    if (mm <= 1 && n > 1) return false;
    if (mm > 1 && n <= 1) return false;
    // The client also has a clause (3,2 && 4,5) that is always true; omitted.
    return (mm !== 2 || n !== 3) && (mm !== 5 || n !== 4);
  };
  const flat = (ax: number, ay: number, az: number, mm: number) =>
    (same(ax - 1, ay, az, mm) && mm !== 4 && mm !== 5) ||
    (same(ax + 1, ay, az, mm) && mm !== 4 && mm !== 5) ||
    (same(ax, ay, az - 1, mm) && mm !== 2 && mm !== 3) ||
    (same(ax, ay, az + 1, mm) && mm !== 2 && mm !== 3);
  const vert = (ax: number, ay: number, az: number, dirY: number, mm: number): boolean => {
    if (v.id(ax, ay, az) !== self) return false;
    const n = metaAt(ax, ay, az);
    if (mm > 1 && n <= 1 && flat(ax, ay, az, n)) return false;
    if (mm === 0 && dirY > 0 && n <= 1) return false;
    if (mm === 1 && dirY < 0 && n <= 1) return false;
    return mm <= 1 || n <= 1 || mm === n;
  };

  const out: Bounds[] = [];
  const up = vert(x, y + 1, z, -1, m);
  const down = vert(x, y - 1, z, 1, m);
  const wX = same(x - 1, y, z, m);
  const eX = same(x + 1, y, z, m);
  const sZ = same(x, y, z + 1, m);
  const nZ = same(x, y, z - 1, m);

  // Main strip (method A in the client): returns whether to add corner pieces.
  let main: Bounds | undefined;
  let corners = true;
  let below = 0;
  if (m === 0) {
    if (down && !wX && !eX) below = metaAt(x, y - 1, z);
    if (sZ && nZ) main = box(c0, hi - t, lo, c1, hi, hi);
    else if (wX && eX) main = box(lo, hi - t, c0, hi, hi, c1);
    else if (!sZ && !nZ)
      main = below !== 2 && below !== 3 ? box(lo, hi - t, c0, hi, hi, c1) : box(c0, hi - t, lo, c1, hi, hi);
    else if (eX) {
      corners = false;
      main = box(c0, hi - t, c0, hi, hi, c1);
    } else if (wX) {
      corners = false;
      main = box(lo, hi - t, c0, c1, hi, c1);
    } else main = box(c0, hi - t, lo, c1, hi, hi);
  } else if (m === 1) {
    if (up && !wX && !eX) below = metaAt(x, y + 1, z);
    if (sZ && nZ) main = box(c0, lo, lo, c1, t, hi);
    else if (wX && eX) main = box(lo, lo, c0, hi, t, c1);
    else if (!sZ && !nZ) main = below !== 2 && below !== 3 ? box(lo, lo, c0, hi, t, c1) : box(c0, lo, lo, c1, t, hi);
    else if (eX) {
      corners = false;
      main = box(c0, lo, c0, hi, t, c1);
    } else if (wX) {
      corners = false;
      main = box(lo, lo, c0, c1, t, c1);
    } else main = box(c0, lo, lo, c1, t, hi);
  } else if (m === 2 || m === 3) {
    const zz0 = m === 2 ? hi - t : lo;
    const zz1 = m === 2 ? hi : t;
    if (wX && eX) main = box(lo, c0, zz0, hi, c1, zz1);
    else if (down && up) main = box(c0, lo, zz0, c1, hi, zz1);
    else if (wX && (down || up)) {
      corners = false;
      main = box(lo, c0, zz0, c1, c1, zz1);
    } else if (eX && (down || up)) {
      corners = false;
      main = box(c0, c0, zz0, hi, c1, zz1);
    } else if (!wX && !eX) main = box(c0, lo, zz0, c1, hi, zz1);
    else main = box(lo, c0, zz0, hi, c1, zz1);
  } else if (m === 4 || m === 5) {
    const xx0 = m === 4 ? hi - t : lo;
    const xx1 = m === 4 ? hi : t;
    if (nZ && sZ) main = box(xx0, c0, lo, xx1, c1, hi);
    else if (down && up) main = box(xx0, lo, c0, xx1, hi, c1);
    else if (nZ && (down || up)) {
      corners = false;
      main = box(xx0, c0, lo, xx1, c1, c1);
    } else if (sZ && (down || up)) {
      corners = false;
      main = box(xx0, c0, c0, xx1, c1, hi);
    } else if (!nZ && !sZ) main = box(xx0, lo, c0, xx1, hi, c1);
    else main = box(xx0, c0, lo, xx1, c1, hi);
  }
  if (main) out.push(main);

  if (corners) {
    // Joints where a strip turns onto an adjacent face.
    let k = 0;
    if (m === 0 || m === 1) {
      const vy = m === 0 ? y - 1 : y + 1;
      const vOk = m === 0 ? down : up;
      const yLo = m === 0 ? lo : t;
      const yHi = m === 0 ? hi - t : hi;
      if (vOk && !wX && !eX) k = metaAt(x, vy, z);
      const pick = (kk: number) => {
        if (kk === 2 && !sZ) out.push(box(c0, yLo, hi - t, c1, yHi, hi));
        else if (kk === 3 && !nZ) out.push(box(c0, yLo, lo, c1, yHi, t));
        else return false;
        return true;
      };
      if ((nZ || sZ) && (!sZ || !nZ) && (!wX || !eX)) {
        if (vOk) pick(metaAt(x, vy, z));
      } else if (!pick(k) && vOk) {
        const kk = metaAt(x, vy, z);
        if (kk === 4 && !eX) out.push(box(hi - t, yLo, c0, hi, yHi, c1));
        else if (kk === 5 && !wX) out.push(box(lo, yLo, c0, t, yHi, c1));
      }
    } else if (m === 2 || m === 3) {
      const nz = m === 2 ? z - 1 : z + 1;
      const has = m === 2 ? nZ : sZ;
      if ((wX || eX) && has) {
        const kk = metaAt(x, y, nz);
        if (kk === 5) out.push(box(lo, c0, lo, t, c1, hi));
        else if (kk === 4) out.push(box(hi - t, c0, lo, hi, c1, hi));
      }
    } else if (m === 4 || m === 5) {
      const nx = m === 4 ? x - 1 : x + 1;
      const has = m === 4 ? wX : eX;
      if ((nZ || sZ) && has) {
        const kk = metaAt(nx, y, z);
        if (kk === 2) out.push(box(lo, c0, hi - t, hi, c1, hi));
        else if (kk === 3) out.push(box(lo, c0, lo, hi, c1, t));
      }
    }
  } else {
    // Stub towards the neighbouring lamp where the strip ends in an L-turn.
    const is = (ax: number, ay: number, az: number) => v.id(ax, ay, az) === self;
    let cap: Bounds | undefined;
    if (m === 0) {
      if (is(x, y, z + 1)) cap = box(c0, hi - t, c1, c1, hi, hi);
      else if (is(x, y, z - 1)) cap = box(c0, hi - t, lo, c1, hi, c1);
    } else if (m === 1) {
      if (is(x, y, z + 1)) cap = box(c0, lo, c1, c1, t, hi);
      else if (is(x, y, z - 1)) cap = box(c0, lo, lo, c1, t, c1);
    } else if (m === 2) {
      if (is(x, y + 1, z)) cap = box(c0, c1, hi - t, c1, hi, hi);
      else if (is(x, y - 1, z)) cap = box(c0, lo, hi - t, c1, c0, hi);
    } else if (m === 3) {
      if (is(x, y + 1, z)) cap = box(c0, c1, lo, c1, hi, t);
      else if (is(x, y - 1, z)) cap = box(c0, lo, lo, c1, c0, t);
    } else if (m === 4) {
      if (is(x, y + 1, z)) cap = box(hi - t, c1, c0, hi, hi, c1);
      else if (is(x, y - 1, z)) cap = box(hi - t, lo, c0, hi, c0, c1);
    } else if (m === 5) {
      if (is(x, y + 1, z)) cap = box(lo, c1, c0, t, hi, c1);
      else if (is(x, y - 1, z)) cap = box(lo, lo, c0, t, c0, c1);
    }
    if (cap) out.push(cap);
  }
  return out;
}

// ── Cauldron (211), as the client draws the vanilla cauldron ─────────────────

function drawCauldron(c: Ctx, g: GeoBuilder, d: BlockDef, x: number, y: number, z: number, meta: number): void {
  drawCube(c, g, d, x, y, z, meta);
  const wall = 154;
  const floor = 139;
  const t = 0.125;
  g.color(SHADE[5], SHADE[5], SHADE[5]);
  facePosX(g, x - 1 + t, y, z, FULL, wall, 0);
  g.color(SHADE[4], SHADE[4], SHADE[4]);
  faceNegX(g, x + 1 - t, y, z, FULL, wall, 0);
  g.color(SHADE[3], SHADE[3], SHADE[3]);
  facePosZ(g, x, y, z - 1 + t, FULL, wall, 0);
  g.color(SHADE[2], SHADE[2], SHADE[2]);
  faceNegZ(g, x, y, z + 1 - t, FULL, wall, 0);
  g.color(SHADE[1], SHADE[1], SHADE[1]);
  faceTop(g, x, y - 1 + 0.25, z, FULL, floor, 0);
  g.color(SHADE[0], SHADE[0], SHADE[0]);
  faceBottom(g, x, y + 1 - 0.75, z, FULL, floor, 0);
}

// ── Tube (172) ───────────────────────────────────────────────────────────────

function drawTube(c: Ctx, g: GeoBuilder, d: BlockDef, x: number, y: number, z: number, meta: number): void {
  const v = c.v;
  const con = (nx: number, ny: number, nz: number) => TUBE_CONNECT.has(v.id(nx, ny, nz));
  const down = con(x, y - 1, z);
  const up = con(x, y + 1, z);
  const px = con(x + 1, y, z);
  const nx = con(x - 1, y, z);
  const pz = con(x, y, z + 1);
  const nz = con(x, y, z - 1);
  const r0 = 0.1875,
    r1 = 0.8125,
    p0 = 0.25,
    p1 = 0.75;
  const draw = (b: Bounds, rot: UvRot = NO_ROT) => drawBounded(c, g, d, x, y, z, meta, b, rot, true);
  // UV rotation exactly as the client sets it for open pipe ends (only one face per axis).
  const rotX: UvRot = [0, 0, 1, 0, 0, 0]; // pipe along X
  const rotZ: UvRot = [0, 0, 0, 0, 0, 1]; // pipe along Z
  if (px && nx) {
    draw(box(0, p0, p0, 1, p1, p1));
    draw(box(0, r0, r0, 0.1, r1, r1));
    draw(box(0.9, r0, r0, 1, r1, r1));
  } else if (pz && nz) {
    draw(box(p0, p0, 0, p1, p1, 1));
    draw(box(r0, r0, 0, r1, r1, 0.1));
    draw(box(r0, r0, 0.9, r1, r1, 1));
  } else if (down && up) {
    draw(box(p0, 0, p0, p1, 1, p1));
    draw(box(r0, 0, r0, r1, 0.1, r1));
    draw(box(r0, 0.9, r0, r1, 1, r1));
  } else {
    let n = 0;
    if (px) {
      draw(box(p0, p0, p0, 1, p1, p1), rotX);
      draw(box(0.9, r0, r0, 1, r1, r1), rotX);
      n++;
    }
    if (nx) {
      draw(box(0, p0, p0, p1, p1, p1), rotX);
      draw(box(0, r0, r0, 0.1, r1, r1), rotX);
      n++;
    }
    if (n >= 2) return;
    if (pz) {
      draw(box(p0, p0, p0, p1, p1, 1), rotZ);
      draw(box(r0, r0, 0.9, r1, r1, 1), rotZ);
      n++;
    }
    if (n >= 2) return;
    if (nz) {
      draw(box(p0, p0, 0, p1, p1, p1), rotZ);
      draw(box(r0, r0, 0, r1, r1, 0.1), rotZ);
      n++;
    }
    if (n >= 2) return;
    if (down) {
      draw(box(p0, 0, p0, p1, p1, p1));
      draw(box(r0, 0, r0, r1, 0.1, r1));
      n++;
    }
    if (n >= 2) return;
    if (up) {
      draw(box(p0, p0, p0, p1, 1, p1));
      draw(box(r0, 0.9, r0, r1, 1, r1));
      n++;
    }
    if (n === 0) draw(box(p0, p0, p0, p1, p1, p1));
  }
}
