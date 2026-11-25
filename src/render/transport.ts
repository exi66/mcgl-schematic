// Transport pipe (212), ported from the game client's renderer (RenderBlocks, render type 130).
// The client keeps the pipe's connections in its tile entity; a schematic has none, so they are derived from
// neighbours with the client's own rule (see pipeConnections). The geometry code below is a line-by-line port
// of the client method; `R` stands in for its RenderBlocks state (current bounds, UV rotation, texture).

/* eslint-disable */
import type { Voxels } from './mesher';
import { faceBottom, faceNegX, faceNegZ, facePosX, facePosZ, faceTop, SHADE, type Bounds, type UvRot } from './faces';
import type { GeoBuilder } from './geometry';

export const TRANSPORT_PIPE = 212;
export const TRANSPORT_NODE = 209;

const DX = [0, 0, 0, 0, -1, 1];
const DY = [-1, 1, 0, 0, 0, 0];
const DZ = [0, 0, -1, 1, 0, 0];
/** Steel block texture: the pipe frame rods. */
const STEEL = 497;

/**
 * Connection bits as the client computes them: bit = side (0 down, 1 up, 2 −Z, 3 +Z, 4 −X, 5 +X).
 * A pipe connects to another pipe or a node; pipes connect if their colours (meta) match or one is a coupling (3).
 * Nodes keep their colour in the tile entity, which a schematic lacks, so a node connects to any pipe.
 */
export function pipeConnections(v: Voxels, x: number, y: number, z: number): number {
  const self = v.id(x, y, z);
  const color = self === TRANSPORT_PIPE ? v.meta(x, y, z) : -1;
  let bits = 0;
  for (let s = 0; s < 6; s++) {
    const nx = x + DX[s], ny = y + DY[s], nz = z + DZ[s];
    const n = v.id(nx, ny, nz);
    if (n !== TRANSPORT_PIPE && n !== TRANSPORT_NODE) continue;
    const other = n === TRANSPORT_PIPE ? v.meta(nx, ny, nz) : -1;
    const ok = color < 0 || other < 0 || color === other || color === 3 || other === 3;
    if (ok) bits |= 1 << s;
  }
  return bits;
}

const FACES = [faceBottom, faceTop, faceNegZ, facePosZ, faceNegX, facePosX] as const;

/** The RenderBlocks state the ported code works with. */
class PipeRenderer {
  b: Bounds = { x0: 0, y0: 0, z0: 0, x1: 1, y1: 1, z1: 1 };
  rot: UvRot = [0, 0, 0, 0, 0, 0];
  tex = STEEL;
  constructor(
    private readonly g: GeoBuilder,
    private readonly v: Voxels,
    private readonly x: number,
    private readonly y: number,
    private readonly z: number,
  ) {}

  bounds(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
    this.b = { x0, y0, z0, x1, y1, z1 };
  }

  /** A single face of the current bounds at a (possibly shifted) block position. */
  face(side: number, x: number, y: number, z: number, tex: number): void {
    const sh = SHADE[side];
    this.g.color(sh, sh, sh);
    FACES[side](this.g, x, y, z, this.b, tex, this.rot[side]);
  }

  /** renderStandardBlock with the current bounds and texture (inset faces always drawn). */
  standard(): void {
    const b = this.b;
    const opaque = (s: number) => {
      const id = this.v.id(this.x + DX[s], this.y + DY[s], this.z + DZ[s]);
      return id !== 0 && id !== TRANSPORT_PIPE && id !== TRANSPORT_NODE && opaqueIds(id);
    };
    const inset = [b.y0 > 0, b.y1 < 1, b.z0 > 0, b.z1 < 1, b.x0 > 0, b.x1 < 1];
    for (let s = 0; s < 6; s++) {
      if (!inset[s] && opaque(s)) continue;
      this.face(s, this.x, this.y, this.z, this.tex);
    }
  }

  /** One of the four frame rods along an axis (client: BlockTransportTube.setRodBounds), steel texture. */
  rod(i: number, dir: number, to: number, from: number): void {
    const p = 1 / 16;
    const a0 = 3 * p, a1 = 4 * p, b0 = 12 * p, b1 = 13 * p;
    const lo = from * p, hi = to * p;
    const axis = dir <= 1 ? 1 : dir <= 3 ? 2 : 0;
    const c = [
      [a0, a1, a0, a1],
      [a0, a1, b0, b1],
      [b0, b1, a0, a1],
      [b0, b1, b0, b1],
    ][i];
    if (axis === 0) this.bounds(lo, c[0], c[2], hi, c[1], c[3]);
    else if (axis === 1) this.bounds(c[0], lo, c[2], c[1], hi, c[3]);
    else this.bounds(c[0], c[2], lo, c[1], c[3], hi);
    this.tex = STEEL;
  }
}

let opaqueIds: (id: number) => boolean = () => true;
/** Set by the mesher: which neighbour blocks are opaque cubes. */
export function setOpaqueTest(f: (id: number) => boolean): void {
  opaqueIds = f;
}

/** Draws a transport pipe at x, y, z. */
export function drawTransportPipe(g: GeoBuilder, v: Voxels, x: number, y: number, z: number): void {
  const R = new PipeRenderer(g, v, x, y, z);
  const var2 = x, var3 = y, var4 = z;
  const var5 = pipeConnections(v, x, y, z);
  const isNode = v.id(x, y, z) === TRANSPORT_NODE;
  // Pipe colour = meta; a node keeps it in its tile entity — drawn black (0).
  const color = isNode ? 0 : v.meta(x, y, z);
  if (isNode) {
    // Node body (simplified: the client also draws type- and direction-specific parts from the tile entity).
    R.bounds(1 / 16, 1 / 16, 1 / 16, 15 / 16, 15 / 16, 15 / 16);
    R.tex = 870;
    R.standard();
  }
  const var7 = (var5 & 32) > 0;
  const var8 = (var5 & 16) > 0;
  const var9 = (var5 & 8) > 0;
  const var10 = (var5 & 4) > 0;
  const var11 = (var5 & 2) > 0;
  const var12 = (var5 & 1) > 0;
  let var26 = false;
  if (var9 && var10) {
     for(let var32 = 0; var32 < 4; ++var32) {
        R.rod(var32, 2, 16.0, 0.0);
        R.standard();
     }
  }

  if (var7 && var8) {
     for(let var33 = 0; var33 < 4; ++var33) {
        R.rod(var33, 4, 16.0, 0.0);
        R.standard();
     }
  }

  if (var11 && var12) {
     for(let var34 = 0; var34 < 4; ++var34) {
        R.rod(var34, 0, 16.0, 0.0);
        R.standard();
     }
  }

  let var35 = (var5 & 3) > 0 && (var5 & 12) > 0 || (var5 & 3) > 0 && (var5 & 48) > 0 || (var5 & 12) > 0 && (var5 & 48) > 0 || var5 == 0;
  if (!var26) {
     for(let var41 = 0; var41 < 4; ++var41) {
        if (var35 || var5 == 2 || var5 == 1 || var41 == 0 && (var5 == 32 || var5 == 8) || var41 == 1 && (var5 == 32 || var5 == 4) || var41 == 2 && (var5 == 16 || var5 == 8) || var41 == 3 && (var5 == 16 || var5 == 4)) {
           R.rod(var41, 1, !var11 ? 12.0 : 16.0, !var12 ? 4.0 : 0.0);
           R.standard();
        }

        if (var35 || var5 == 16 || var5 == 32 || var41 == 0 && (var5 == 2 || var5 == 8) || var41 == 1 && (var5 == 2 || var5 == 4) || var41 == 2 && (var5 == 1 || var5 == 8) || var41 == 3 && (var5 == 1 || var5 == 4)) {
           R.rod(var41, 4, !var7 ? 12.0 : 16.0, !var8 ? 4.0 : 0.0);
           R.standard();
        }

        if (var35 || var5 == 4 || var5 == 8 || var41 == 0 && (var5 == 2 || var5 == 32) || var41 == 2 && (var5 == 2 || var5 == 16) || var41 == 1 && (var5 == 1 || var5 == 32) || var41 == 3 && (var5 == 1 || var5 == 16)) {
           R.rod(var41, 2, !var9 ? 12.0 : 16.0, !var10 ? 4.0 : 0.0);
           R.standard();
        }
     }
  }

  let var42 = 0.25;

  for (let var54 = 0; var54 < 6; var54++) {
     let var56 = 872;
     let var57 = color;
     if (var57 == 1) {
        var56 += 2;
     } else if (var57 == 2) {
        var56 = 727;
     } else if (var57 == 3) {
        var56 += 3;
     } else if (var57 == 4) {
        var56 += 6;
     }

              let var22 = false;
     let var23 = false;
     let var24 = false;
     let var25 = false;
     switch (var54) {
        case 5:
           if (!var35 && var5 != 16) {
              if (!var7 && var12 && var11) {
                 R.bounds(0.0, 0.0, 0.0, 2.0 * var42, 1.0, 2.0 * var42);
                 R.rot[5] = 2;
                 R.face(5, (var2 + var42), var3, (var4 + var42), var56);
                 var24 = var10;
                 var25 = var9;
              } else if (!var7 && var10 && var9) {
                 R.bounds(0.0, 0.0, 0.0, 2.0 * var42, 2.0 * var42, 1.0);
                 R.face(5, (var2 + var42), (var3 + var42), var4, var56);
                 var22 = var11;
                 var23 = var12;
              } else if (var5 == 1 || var5 == 2 || var5 == 4 || var5 == 8) {
                 if (var12) {
                    R.bounds(0.0, 3.0 * var42, 0.0, 2.0 * var42, 1.0, 2.0 * var42);
                    R.face(5, (var2 + var42), (var3 - var42), (var4 + var42), var56);
                    R.bounds(0.0, 0.0, 0.0, 2.0 * var42, 2.0 * var42, 2.0 * var42);
                    R.rot[5] = 2;
                    R.face(5, (var2 + var42), var3, (var4 + var42), var56);
                 } else if (var11) {
                    R.bounds(0.0, 2.0 * var42, 0.0, 2.0 * var42, 3.0 * var42, 2.0 * var42);
                    R.face(5, (var2 + var42), (var3 - var42), (var4 + var42), var56);
                    R.bounds(0.0, 2.0 * var42, 0.0, 2.0 * var42, 4.0 * var42, 2.0 * var42);
                    R.rot[5] = 2;
                    R.face(5, (var2 + var42), var3, (var4 + var42), var56);
                 } else if (var10) {
                    R.bounds(0.0, 2.0 * var42, 0.0, 2.0 * var42, 1.0, 1.0 * var42);
                    R.face(5, (var2 + var42), (var3 - var42), (var4 + 2.0 * var42), var56);
                    R.bounds(0.0, 0.0, 0.0, 2.0 * var42, 2.0 * var42, 2.0 * var42);
                    R.face(5, (var2 + var42), (var3 + var42), var4, var56);
                 } else if (var9) {
                    R.bounds(0.0, 2.0 * var42, var42, 2.0 * var42, 1.0, 2.0 * var42);
                    R.face(5, (var2 + var42), (var3 - var42), var4, var56);
                    R.bounds(0.0, 0.0, 0.0, 2.0 * var42, 2.0 * var42, 2.0 * var42);
                    R.face(5, (var2 + var42), (var3 + var42), (var4 + 2.0 * var42), var56);
                 }
              }
           } else {
              if (!var7) {
                 R.bounds(0.0, 2.0 * var42, 0.0, 2.0 * var42, 1.0, 2.0 * var42);
                 R.face(5, (var2 + var42), (var3 - var42), (var4 + var42), var56);
              }

              var22 = var11;
              var23 = var12;
              var24 = var10;
              var25 = var9;
           }

           R.rot[5] = 0;
           if (var22) {
              R.bounds(0.0, 2.0 * var42, 0.0, 2.0 * var42, 4.0 * var42 - (var42 + 0.0625), 2.0 * var42);
              R.face(5, (var2 + var42), (var3 + var42 + 0.0625), (var4 + var42), var56);
           }

           if (var23) {
              R.bounds(0.0, 2.0 * var42 + var42 + 0.0625, 0.0, 2.0 * var42, 4.0 * var42, 2.0 * var42);
              R.face(5, (var2 + var42), (var3 - (3.0 * var42 + 0.0625)), (var4 + var42), var56);
           }

           if (var24) {
              R.bounds(0.0, 2.0 * var42, 0.0, 2.0 * var42, 4.0 * var42, 2.0 * var42 - (var42 + 0.0625));
              R.face(5, (var2 + var42), (var3 - var42), (var4 + var42 - var42), var56);
           }

           if (var25) {
              R.bounds(0.0, 2.0 * var42, var42 + 0.0625, 2.0 * var42, 4.0 * var42, 2.0 * var42);
              R.face(5, (var2 + var42), (var3 - var42), (var4 + 2.0 * var42), var56);
           }
           break;
        case 4:
           if (!var35 && var5 != 32) {
              if (!var8 && var12 && var11) {
                 R.bounds(0.0, 0.0, 0.0, 2.0 * var42, 1.0, 2.0 * var42);
                 R.rot[4] = 1;
                 R.face(4, (var2 + var42), var3, (var4 + var42), var56);
                 var24 = var10;
                 var25 = var9;
              } else if (!var8 && var10 && var9) {
                 R.bounds(0.0, 0.0, 0.0, 2.0 * var42, 2.0 * var42, 1.0);
                 R.face(4, (var2 + var42), (var3 + var42), var4, var56);
                 var22 = var11;
                 var23 = var12;
              } else if (var5 == 1 || var5 == 2 || var5 == 4 || var5 == 8) {
                 if (var12) {
                    R.bounds(0.0, 3.0 * var42, 0.0, 2.0 * var42, 1.0, 2.0 * var42);
                    R.face(4, (var2 + var42), (var3 - var42), (var4 + var42), var56);
                    R.bounds(0.0, 0.0, 0.0, 2.0 * var42, 2.0 * var42, 2.0 * var42);
                    R.rot[4] = 1;
                    R.face(4, (var2 + var42), var3, (var4 + var42), var56);
                 } else if (var11) {
                    R.bounds(0.0, 2.0 * var42, 0.0, 2.0 * var42, 3.0 * var42, 2.0 * var42);
                    R.face(4, (var2 + var42), (var3 - var42), (var4 + var42), var56);
                    R.bounds(0.0, 2.0 * var42, 0.0, 2.0 * var42, 4.0 * var42, 2.0 * var42);
                    R.rot[4] = 1;
                    R.face(4, (var2 + var42), var3, (var4 + var42), var56);
                 } else if (var10) {
                    R.bounds(0.0, 2.0 * var42, var42, 2.0 * var42, 1.0, 2.0 * var42);
                    R.face(4, (var2 + var42), (var3 - var42), (var4 + var42), var56);
                    R.bounds(0.0, 0.0, 0.0, 2.0 * var42, 2.0 * var42, 2.0 * var42);
                    R.face(4, (var2 + var42), (var3 + var42), var4, var56);
                 } else if (var9) {
                    R.bounds(0.0, 2.0 * var42, 0.0, 2.0 * var42, 1.0, 1.0 * var42);
                    R.face(4, (var2 + var42), (var3 - var42), (var4 + 1.0 * var42), var56);
                    R.bounds(0.0, 0.0, 0.0, 2.0 * var42, 2.0 * var42, 2.0 * var42);
                    R.face(4, (var2 + var42), (var3 + var42), (var4 + 2.0 * var42), var56);
                 }
              }
           } else {
              if (!var8) {
                 R.bounds(0.0, 2.0 * var42, 0.0, 2.0 * var42, 1.0, 2.0 * var42);
                 R.face(4, (var2 + var42), (var3 - var42), (var4 + var42), var56);
              }

              var22 = var11;
              var23 = var12;
              var24 = var10;
              var25 = var9;
           }

           R.rot[4] = 0;
           if (var22) {
              R.bounds(0.0, 2.0 * var42, 0.0, 2.0 * var42, 4.0 * var42 - (var42 + 0.0625), 2.0 * var42);
              R.face(4, (var2 + var42), (var3 + var42 + 0.0625), (var4 + var42), var56);
           }

           if (var23) {
              R.bounds(0.0, 2.0 * var42 + var42 + 0.0625, 0.0, 2.0 * var42, 4.0 * var42, 2.0 * var42);
              R.face(4, (var2 + var42), (var3 - (3.0 * var42 + 0.0625)), (var4 + var42), var56);
           }

           if (var24) {
              R.bounds(0.0, 2.0 * var42, var42 + 0.0625, 2.0 * var42, 4.0 * var42, 2.0 * var42);
              R.face(4, (var2 + var42), (var3 - var42), (var4 + var42 - (2.0 * var42 + 0.0625)), var56);
           }

           if (var25) {
              R.bounds(0.0, 2.0 * var42, 0.0, 2.0 * var42, 4.0 * var42, 1.0 * var42 - 0.0625);
              R.face(4, (var2 + var42), (var3 - var42), (var4 + 3.0 * var42 + 0.0625), var56);
           }
           break;
        case 3:
           if (!var35 && var5 != 4) {
              if (!var9 && var12 && var11) {
                 R.bounds(0.0, 0.0, 0.0, 2.0 * var42, 1.0, 2.0 * var42);
                 R.rot[3] = 1;
                 R.face(3, (var2 + var42), var3, (var4 + var42), var56);
                 var24 = var8;
                 var25 = var7;
              } else if (!var9 && var8 && var7) {
                 R.bounds(0.0, 0.0, 0.0, 1.0, 2.0 * var42, 2.0 * var42);
                 R.face(3, var2, (var3 + var42), (var4 + var42), var56);
                 var22 = var11;
                 var23 = var12;
              } else if (var5 == 1 || var5 == 2 || var5 == 16 || var5 == 32) {
                 if (var12) {
                    R.bounds(0.0, 3.0 * var42, 0.0, 2.0 * var42, 1.0, 2.0 * var42);
                    R.face(3, (var2 + var42), (var3 - var42), (var4 + var42), var56);
                    R.bounds(0.0, 2.0 * var42, 0.0, 2.0 * var42, 4.0 * var42, 2.0 * var42);
                    R.rot[3] = 1;
                    R.face(3, (var2 + var42), (var3 - 2.0 * var42), (var4 + var42), var56);
                 } else if (var11) {
                    R.bounds(0.0, 2.0 * var42, 0.0, 2.0 * var42, 3.0 * var42, 2.0 * var42);
                    R.face(3, (var2 + var42), (var3 - var42), (var4 + var42), var56);
                    R.bounds(0.0, 2.0 * var42, 0.0, 2.0 * var42, 4.0 * var42, 2.0 * var42);
                    R.rot[3] = 1;
                    R.face(3, (var2 + var42), var3, (var4 + var42), var56);
                 } else if (var8) {
                    R.bounds(var42, 2.0 * var42, 0.0, 2.0 * var42, 1.0, 2.0 * var42);
                    R.face(3, (var2 + var42), (var3 - var42), (var4 + var42), var56);
                    R.bounds(0.0, 0.0, 0.0, 2.0 * var42, 2.0 * var42, 2.0 * var42);
                    R.face(3, var2, (var3 + var42), (var4 + var42), var56);
                 } else if (var7) {
                    R.bounds(0.0, 2.0 * var42, 0.0, var42, 1.0, 2.0 * var42);
                    R.face(3, (var2 + var42), (var3 - var42), (var4 + var42), var56);
                    R.bounds(0.0, 0.0, 0.0, 2.0 * var42, 2.0 * var42, 2.0 * var42);
                    R.face(3, (var2 + 2.0 * var42), (var3 + var42), (var4 + var42), var56);
                 }
              }
           } else {
              if (!var9) {
                 R.bounds(0.0, 2.0 * var42, 0.0, 2.0 * var42, 1.0, 2.0 * var42);
                 R.face(3, (var2 + var42), (var3 - var42), (var4 + var42), var56);
              }

              var22 = var11;
              var23 = var12;
              var24 = var8;
              var25 = var7;
           }

           R.rot[3] = 0;
           if (var22) {
              R.bounds(0.0, 2.0 * var42, 0.0, 2.0 * var42, 4.0 * var42 - (var42 + 0.0625), 2.0 * var42);
              R.face(3, (var2 + var42), (var3 + var42 + 0.0625), (var4 + var42), var56);
           }

           if (var23) {
              R.bounds(0.0, 2.0 * var42 + var42 + 0.0625, 0.0, 2.0 * var42, 4.0 * var42, 2.0 * var42);
              R.face(3, (var2 + var42), (var3 - (3.0 * var42 + 0.0625)), (var4 + var42), var56);
           }

           if (var24) {
              R.bounds(var42 + 0.0625, 2.0 * var42, 0.0, 2.0 * var42, 4.0 * var42, 2.0 * var42);
              R.face(3, (var2 - (var42 + 0.0625)), (var3 - var42), (var4 + var42), var56);
           }

           if (var25) {
              R.bounds(0.0, 2.0 * var42, 0.0, var42 - 0.0625, 4.0 * var42, 2.0 * var42);
              R.face(3, (var2 + 3.0 * var42 + 0.0625), (var3 - var42), (var4 + var42), var56);
           }
           break;
        case 2:
           if (!var35 && var5 != 8) {
              if (!var10 && var12 && var11) {
                 R.bounds(0.0, 0.0, 0.0, 2.0 * var42, 1.0, 2.0 * var42);
                 R.rot[2] = 2;
                 R.face(2, (var2 + var42), var3, (var4 + var42), var56);
                 var24 = var8;
                 var25 = var7;
              } else if (!var10 && var8 && var7) {
                 R.bounds(0.0, 0.0, 0.0, 1.0, 2.0 * var42, 2.0 * var42);
                 R.face(2, var2, (var3 + var42), (var4 + var42), var56);
                 var22 = var11;
                 var23 = var12;
              } else if (var5 == 1 || var5 == 2 || var5 == 16 || var5 == 32) {
                 if (var12) {
                    R.bounds(0.0, 3.0 * var42, 0.0, 2.0 * var42, 1.0, 2.0 * var42);
                    R.face(2, (var2 + var42), (var3 - var42), (var4 + var42), var56);
                    R.bounds(0.0, 2.0 * var42, 0.0, 2.0 * var42, 4.0 * var42, 2.0 * var42);
                    R.rot[2] = 2;
                    R.face(2, (var2 + var42), (var3 - 2.0 * var42), (var4 + var42), var56);
                 } else if (var11) {
                    R.bounds(0.0, 2.0 * var42, 0.0, 2.0 * var42, 3.0 * var42, 2.0 * var42);
                    R.face(2, (var2 + var42), (var3 - var42), (var4 + var42), var56);
                    R.bounds(0.0, 2.0 * var42, 0.0, 2.0 * var42, 4.0 * var42, 2.0 * var42);
                    R.rot[2] = 2;
                    R.face(2, (var2 + var42), var3, (var4 + var42), var56);
                 } else if (var8) {
                    R.bounds(0.0, 2.0 * var42, 0.0, var42, 1.0, 2.0 * var42);
                    R.face(2, (var2 + 2.0 * var42), (var3 - var42), (var4 + var42), var56);
                    R.bounds(0.0, 0.0, 0.0, 2.0 * var42, 2.0 * var42, 2.0 * var42);
                    R.face(2, var2, (var3 + var42), (var4 + var42), var56);
                 } else if (var7) {
                    R.bounds(var42, 2.0 * var42, 0.0, 2.0 * var42, 1.0, 2.0 * var42);
                    R.face(2, var2, (var3 - var42), (var4 + var42), var56);
                    R.bounds(0.0, 0.0, 0.0, 2.0 * var42, 2.0 * var42, 2.0 * var42);
                    R.face(2, (var2 + 2.0 * var42), (var3 + var42), (var4 + var42), var56);
                 }
              }
           } else {
              if (!var10) {
                 R.bounds(0.0, 2.0 * var42, 0.0, 2.0 * var42, 1.0, 2.0 * var42);
                 R.face(2, (var2 + var42), (var3 - var42), (var4 + var42), var56);
              }

              var22 = var11;
              var23 = var12;
              var24 = var8;
              var25 = var7;
           }

           R.rot[2] = 0;
           if (var22) {
              R.bounds(0.0, 2.0 * var42, 0.0, 2.0 * var42, 4.0 * var42 - (var42 + 0.0625), 2.0 * var42);
              R.face(2, (var2 + var42), (var3 + var42 + 0.0625), (var4 + var42), var56);
           }

           if (var23) {
              R.bounds(0.0, 2.0 * var42 + var42 + 0.0625, 0.0, 2.0 * var42, 4.0 * var42, 2.0 * var42);
              R.face(2, (var2 + var42), (var3 - (3.0 * var42 + 0.0625)), (var4 + var42), var56);
           }

           if (var24) {
              R.bounds(0.0, 2.0 * var42, 0.0, var42 - 0.0625, 4.0 * var42, 2.0 * var42);
              R.face(2, var2, (var3 - var42), (var4 + var42), var56);
           }

           if (var25) {
              R.bounds(var42 + 0.0625, 2.0 * var42, 0.0, 2.0 * var42, 4.0 * var42, 2.0 * var42);
              R.face(2, (var2 + 2.0 * var42), (var3 - var42), (var4 + var42), var56);
           }
           break;
        case 1:
           if (!var35 && var5 != 1) {
              if (!var11 && var10 && var9) {
                 R.bounds(0.0, 0.0, 0.0, 2.0 * var42, 2.0 * var42, 1.0);
                 R.rot[1] = 1;
                 R.face(1, (var2 + var42), (var3 + var42), var4, var56);
                 var24 = var8;
                 var25 = var7;
              } else if (!var11 && var8 && var7) {
                 R.bounds(0.0, 0.0, 2.0 * var42, 1.0, 2.0 * var42, 1.0);
                 R.face(1, var2, (var3 + var42), (var4 - var42), var56);
                 var22 = var11;
                 var23 = var12;
              } else if (var5 == 4 || var5 == 8 || var5 == 16 || var5 == 32) {
                 if (var10) {
                    R.bounds(0.0, 0.0, var42, 2.0 * var42, 1.0, 2.0 * var42);
                    R.face(1, (var2 + var42), (var3 - var42), (var4 + var42), var56);
                    R.bounds(0.0, 2.0 * var42, 0.0, 2.0 * var42, 4.0 * var42, 2.0 * var42);
                    R.rot[1] = 1;
                    R.face(1, (var2 + var42), (var3 - var42), var4, var56);
                 } else if (var9) {
                    R.bounds(0.0, 0.0, 0.0, 2.0 * var42, var42, var42);
                    R.face(1, (var2 + var42), (var3 + 2.0 * var42), (var4 + var42), var56);
                    R.bounds(0.0, 2.0 * var42, 0.0, 2.0 * var42, 4.0 * var42, 2.0 * var42);
                    R.rot[1] = 1;
                    R.face(1, (var2 + var42), (var3 - var42), (var4 + 2.0 * var42), var56);
                 } else if (var8) {
                    R.bounds(var42, 2.0 * var42, 0.0, 2.0 * var42, 1.0, 2.0 * var42);
                    R.face(1, (var2 + var42), (var3 - var42), (var4 + var42), var56);
                    R.bounds(0.0, 0.0, 2.0 * var42, 2.0 * var42, 2.0 * var42, 1.0);
                    R.face(1, var2, (var3 + var42), (var4 - var42), var56);
                 } else if (var7) {
                    R.bounds(0.0, 2.0 * var42, 0.0, var42, 1.0, 2.0 * var42);
                    R.face(1, (var2 + var42), (var3 - var42), (var4 + var42), var56);
                    R.bounds(0.0, 0.0, 2.0 * var42, 2.0 * var42, 2.0 * var42, 1.0);
                    R.face(1, (var2 + 2.0 * var42), (var3 + var42), (var4 - var42), var56);
                 }
              }
           } else {
              if (!var11) {
                 R.bounds(0.0, 2.0 * var42, 0.0, 2.0 * var42, 1.0, 2.0 * var42);
                 R.face(1, (var2 + var42), (var3 - var42), (var4 + var42), var56);
              }

              var22 = var9;
              var23 = var10;
              var24 = var8;
              var25 = var7;
           }

           R.rot[1] = 0;
           if (var22) {
              R.bounds(0.0, 2.0 * var42, 0.0, 2.0 * var42, 4.0 * var42, var42 - 0.0625);
              R.face(1, (var2 + var42), (var3 - var42), (var4 + 3.0 * var42 + 0.0625), var56);
           }

           if (var23) {
              R.bounds(0.0, 2.0 * var42, var42 + 0.0625, 2.0 * var42, 4.0 * var42, 2.0 * var42);
              R.face(1, (var2 + var42), (var3 - var42), (var4 - (var42 + 0.0625)), var56);
           }

           if (var24) {
              R.bounds(var42 + 0.0625, 2.0 * var42, 0.0, 2.0 * var42, 4.0 * var42, 2.0 * var42);
              R.face(1, (var2 - var42 - 0.0625), (var3 - var42), (var4 + var42), var56);
           }

           if (var25) {
              R.bounds(0.0, 2.0 * var42, 0.0, var42 - 0.0625, 4.0 * var42, 2.0 * var42);
              R.face(1, (var2 + 3.0 * var42 + 0.0625), (var3 - var42), (var4 + var42), var56);
           }
           break;
        case 0:
           if (!var35 && var5 != 2) {
              if (!var12 && var10 && var9) {
                 R.bounds(0.0, 0.0, 0.0, 2.0 * var42, 2.0 * var42, 1.0);
                 R.rot[0] = 2;
                 R.face(0, (var2 + var42), (var3 + var42), var4, var56);
                 var24 = var8;
                 var25 = var7;
              } else if (!var12 && var8 && var7) {
                 R.bounds(0.0, 0.0, 2.0 * var42, 1.0, 2.0 * var42, 1.0);
                 R.face(0, var2, (var3 + var42), (var4 - var42), var56);
                 var22 = var11;
                 var23 = var12;
              } else if (var5 == 4 || var5 == 8 || var5 == 16 || var5 == 32) {
                 if (var10) {
                    R.bounds(0.0, 0.0, var42, 2.0 * var42, 1.0, 2.0 * var42);
                    R.face(0, (var2 + var42), (var3 + var42), (var4 + var42), var56);
                    R.bounds(0.0, 2.0 * var42, 0.0, 2.0 * var42, 4.0 * var42, 2.0 * var42);
                    R.rot[0] = 2;
                    R.face(0, (var2 + var42), (var3 - var42), var4, var56);
                 } else if (var9) {
                    R.bounds(0.0, 0.0, 0.0, 2.0 * var42, var42, var42);
                    R.face(0, (var2 + var42), (var3 + var42), (var4 + var42), var56);
                    R.bounds(0.0, 2.0 * var42, 0.0, 2.0 * var42, 4.0 * var42, 2.0 * var42);
                    R.rot[0] = 2;
                    R.face(0, (var2 + var42), (var3 - var42), (var4 + 2.0 * var42), var56);
                 } else if (var8) {
                    R.bounds(var42, 2.0 * var42, 0.0, 2.0 * var42, 1.0, 2.0 * var42);
                    R.face(0, (var2 + var42), (var3 - var42), (var4 + var42), var56);
                    R.bounds(0.0, 0.0, 2.0 * var42, 2.0 * var42, 2.0 * var42, 1.0);
                    R.face(0, var2, (var3 + var42), (var4 - var42), var56);
                 } else if (var7) {
                    R.bounds(0.0, 2.0 * var42, 0.0, var42, 1.0, 2.0 * var42);
                    R.face(0, (var2 + var42), (var3 - var42), (var4 + var42), var56);
                    R.bounds(0.0, 0.0, 2.0 * var42, 2.0 * var42, 2.0 * var42, 1.0);
                    R.face(0, (var2 + 2.0 * var42), (var3 + var42), (var4 - var42), var56);
                 }
              }
           } else {
              if (!var12) {
                 R.bounds(0.0, 2.0 * var42, 0.0, 2.0 * var42, 1.0, 2.0 * var42);
                 R.face(0, (var2 + var42), (var3 - var42), (var4 + var42), var56);
              }

              var22 = var9;
              var23 = var10;
              var24 = var8;
              var25 = var7;
           }

           R.rot[0] = 0;
           if (var22) {
              R.bounds(0.0, 2.0 * var42, 0.0, 2.0 * var42, 4.0 * var42, var42 - 0.0625);
              R.face(0, (var2 + var42), (var3 - var42), (var4 + 3.0 * var42 + 0.0625), var56);
           }

           if (var23) {
              R.bounds(0.0, 2.0 * var42, var42 + 0.0625, 2.0 * var42, 4.0 * var42, 2.0 * var42);
              R.face(0, (var2 + var42), (var3 - var42), (var4 - (var42 + 0.0625)), var56);
           }

           if (var24) {
              R.bounds(var42 + 0.0625, 2.0 * var42, 0.0, 2.0 * var42, 4.0 * var42, 2.0 * var42);
              R.face(0, (var2 - var42 - 0.0625), (var3 - var42), (var4 + var42), var56);
           }

           if (var25) {
              R.bounds(0.0, 2.0 * var42, 0.0, var42 - 0.0625, 4.0 * var42, 2.0 * var42);
              R.face(0, (var2 + 3.0 * var42 + 0.0625), (var3 - var42), (var4 + var42), var56);
           }
     }
  }
}
