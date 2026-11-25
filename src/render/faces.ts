// Block faces as the game client draws them: UVs from block bounds inside a 16-px tile, optional UV rotation
// per face (used by pistons and tubes). Coordinates of UVs are atlas-relative (0..1, v grows downward).

import { tileX, tileY } from './atlas';
import type { GeoBuilder } from './geometry';

export interface Bounds {
  x0: number;
  y0: number;
  z0: number;
  x1: number;
  y1: number;
  z1: number;
}

export const FULL: Bounds = { x0: 0, y0: 0, z0: 0, x1: 1, y1: 1, z1: 1 };

export function box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): Bounds {
  return { x0, y0, z0, x1, y1, z1 };
}

/** UV rotation per side (0 bottom, 1 top, 2 −Z, 3 +Z, 4 −X, 5 +X), values 0..3. */
export type UvRot = [number, number, number, number, number, number];
export const NO_ROT: UvRot = [0, 0, 0, 0, 0, 0];

/** Face shade without lighting: bottom 0.5, top 1, ±Z 0.8, ±X 0.6. */
export const SHADE = [0.5, 1, 0.8, 0.8, 0.6, 0.6] as const;

const A = 512;

export function faceBottom(g: GeoBuilder, x: number, y: number, z: number, b: Bounds, tex: number, r: number): void {
  const U = tileX(tex);
  const V = tileY(tex);
  let u12 = (U + b.x0 * 16) / A;
  let u14 = (U + b.x1 * 16 - 0.01) / A;
  let v16 = (V + b.z0 * 16) / A;
  let v18 = (V + b.z1 * 16 - 0.01) / A;
  let u20 = u14;
  let u22 = u12;
  let v24 = v16;
  let v26 = v18;
  if (r === 2) {
    u12 = (U + b.z0 * 16) / A;
    v16 = (V + 16 - b.x1 * 16) / A;
    u14 = (U + b.z1 * 16) / A;
    v18 = (V + 16 - b.x0 * 16) / A;
    v24 = v16;
    v26 = v18;
    u20 = u12;
    u22 = u14;
    v16 = v18;
    v18 = v24;
  } else if (r === 1) {
    u12 = (U + 16 - b.z1 * 16) / A;
    v16 = (V + b.x0 * 16) / A;
    u14 = (U + 16 - b.z0 * 16) / A;
    v18 = (V + b.x1 * 16) / A;
    u20 = u14;
    u22 = u12;
    u12 = u14;
    u14 = u22;
    v24 = v18;
    v26 = v16;
  } else if (r === 3) {
    u12 = (U + 16 - b.x0 * 16) / A;
    u14 = (U + 16 - b.x1 * 16 - 0.01) / A;
    v16 = (V + 16 - b.z0 * 16) / A;
    v18 = (V + 16 - b.z1 * 16 - 0.01) / A;
    u20 = u14;
    u22 = u12;
    v24 = v16;
    v26 = v18;
  }
  const X0 = x + b.x0, X1 = x + b.x1, Y = y + b.y0, Z0 = z + b.z0, Z1 = z + b.z1;
  g.vertex(X0, Y, Z1, u22, v26);
  g.vertex(X0, Y, Z0, u12, v16);
  g.vertex(X1, Y, Z0, u20, v24);
  g.vertex(X1, Y, Z1, u14, v18);
}

export function faceTop(g: GeoBuilder, x: number, y: number, z: number, b: Bounds, tex: number, r: number): void {
  const U = tileX(tex);
  const V = tileY(tex);
  let u12 = (U + b.x0 * 16) / A;
  let u14 = (U + b.x1 * 16 - 0.01) / A;
  let v16 = (V + b.z0 * 16) / A;
  let v18 = (V + b.z1 * 16 - 0.01) / A;
  let u20 = u14;
  let u22 = u12;
  let v24 = v16;
  let v26 = v18;
  if (r === 1) {
    u12 = (U + b.z0 * 16) / A;
    v16 = (V + 16 - b.x1 * 16) / A;
    u14 = (U + b.z1 * 16) / A;
    v18 = (V + 16 - b.x0 * 16) / A;
    v24 = v16;
    v26 = v18;
    u20 = u12;
    u22 = u14;
    v16 = v18;
    v18 = v24;
  } else if (r === 2) {
    u12 = (U + 16 - b.z1 * 16) / A;
    v16 = (V + b.x0 * 16) / A;
    u14 = (U + 16 - b.z0 * 16) / A;
    v18 = (V + b.x1 * 16) / A;
    u20 = u14;
    u22 = u12;
    u12 = u14;
    u14 = u22;
    v24 = v18;
    v26 = v16;
  } else if (r === 3) {
    u12 = (U + 16 - b.x0 * 16) / A;
    u14 = (U + 16 - b.x1 * 16 - 0.01) / A;
    v16 = (V + 16 - b.z0 * 16) / A;
    v18 = (V + 16 - b.z1 * 16 - 0.01) / A;
    u20 = u14;
    u22 = u12;
    v24 = v16;
    v26 = v18;
  }
  const X0 = x + b.x0, X1 = x + b.x1, Y = y + b.y1, Z0 = z + b.z0, Z1 = z + b.z1;
  g.vertex(X1, Y, Z1, u14, v18);
  g.vertex(X1, Y, Z0, u20, v24);
  g.vertex(X0, Y, Z0, u12, v16);
  g.vertex(X0, Y, Z1, u22, v26);
}

export function faceNegZ(g: GeoBuilder, x: number, y: number, z: number, b: Bounds, tex: number, r: number): void {
  const U = tileX(tex);
  const V = tileY(tex);
  let u12 = (U + b.x0 * 16) / A;
  let u14 = (U + b.x1 * 16 - 0.01) / A;
  let v16 = (V + 16 - b.y1 * 16) / A;
  let v18 = (V + 16 - b.y0 * 16 - 0.01) / A;
  let u43 = u14;
  let u22 = u12;
  let v24 = v16;
  let v26 = v18;
  if (r === 2) {
    u12 = (U + b.y0 * 16) / A;
    v16 = (V + 16 - b.x0 * 16) / A;
    u14 = (U + b.y1 * 16) / A;
    v18 = (V + 16 - b.x1 * 16) / A;
    v24 = v16;
    v26 = v18;
    u43 = u12;
    u22 = u14;
    v16 = v18;
    v18 = v24;
  } else if (r === 1) {
    u12 = (U + 16 - b.y1 * 16) / A;
    v16 = (V + b.x1 * 16 - 0.01) / A;
    u14 = (U + 16 - b.y0 * 16 - 0.01) / A;
    v18 = (V + b.x0 * 16) / A;
    u43 = u14;
    u22 = u12;
    u12 = u14;
    u14 = u22;
    v24 = v18;
    v26 = v16;
  } else if (r === 3) {
    u12 = (U + 16 - b.x0 * 16) / A;
    u14 = (U + 16 - b.x1 * 16 - 0.01) / A;
    v16 = (V + b.y1 * 16) / A;
    v18 = (V + b.y0 * 16 - 0.01) / A;
    u43 = u14;
    u22 = u12;
    v24 = v16;
    v26 = v18;
  }
  const X0 = x + b.x0, X1 = x + b.x1, Y0 = y + b.y0, Y1 = y + b.y1, Z = z + b.z0;
  g.vertex(X0, Y1, Z, u43, v24);
  g.vertex(X1, Y1, Z, u12, v16);
  g.vertex(X1, Y0, Z, u22, v26);
  g.vertex(X0, Y0, Z, u14, v18);
}

export function facePosZ(g: GeoBuilder, x: number, y: number, z: number, b: Bounds, tex: number, r: number): void {
  const U = tileX(tex);
  const V = tileY(tex);
  let u12 = (U + b.x0 * 16) / A;
  let u14 = (U + b.x1 * 16 - 0.01) / A;
  let v16 = (V + 16 - b.y1 * 16) / A;
  let v18 = (V + 16 - b.y0 * 16 - 0.01) / A;
  let u43 = u14;
  let u22 = u12;
  let v24 = v16;
  let v26 = v18;
  if (r === 1) {
    u12 = (U + b.y0 * 16) / A;
    v18 = (V + 16 - b.x0 * 16 - 0.01) / A;
    u14 = (U + b.y1 * 16 - 0.01) / A;
    v16 = (V + 16 - b.x1 * 16) / A;
    v24 = v16;
    v26 = v18;
    u43 = u12;
    u22 = u14;
    v16 = v18;
    v18 = v24;
  } else if (r === 2) {
    u12 = (U + 16 - b.y1 * 16) / A;
    v16 = (V + b.x0 * 16) / A;
    u14 = (U + 16 - b.y0 * 16) / A;
    v18 = (V + b.x1 * 16) / A;
    u43 = u14;
    u22 = u12;
    u12 = u14;
    u14 = u22;
    v24 = v18;
    v26 = v16;
  } else if (r === 3) {
    u12 = (U + 16 - b.x0 * 16) / A;
    u14 = (U + 16 - b.x1 * 16 - 0.01) / A;
    v16 = (V + b.y1 * 16) / A;
    v18 = (V + b.y0 * 16 - 0.01) / A;
    u43 = u14;
    u22 = u12;
    v24 = v16;
    v26 = v18;
  }
  const X0 = x + b.x0, X1 = x + b.x1, Y0 = y + b.y0, Y1 = y + b.y1, Z = z + b.z1;
  g.vertex(X0, Y1, Z, u12, v16);
  g.vertex(X0, Y0, Z, u22, v26);
  g.vertex(X1, Y0, Z, u14, v18);
  g.vertex(X1, Y1, Z, u43, v24);
}

export function faceNegX(g: GeoBuilder, x: number, y: number, z: number, b: Bounds, tex: number, r: number): void {
  const U = tileX(tex);
  const V = tileY(tex);
  let u12 = (U + b.z0 * 16) / A;
  let u14 = (U + b.z1 * 16 - 0.01) / A;
  let v16 = (V + 16 - b.y1 * 16) / A;
  let v18 = (V + 16 - b.y0 * 16 - 0.01) / A;
  let u43 = u14;
  let u22 = u12;
  let v24 = v16;
  let v26 = v18;
  if (r === 1) {
    u12 = (U + b.y0 * 16) / A;
    v16 = (V + 16 - b.z1 * 16 - 0.01) / A;
    u14 = (U + b.y1 * 16 - 0.01) / A;
    v18 = (V + 16 - b.z0 * 16 - 0.01) / A;
    v24 = v16;
    v26 = v18;
    u43 = u12;
    u22 = u14;
    v16 = v18;
    v18 = v24;
  } else if (r === 2) {
    u12 = (U + 16 - b.y1 * 16) / A;
    v16 = (V + b.z0 * 16) / A;
    u14 = (U + 16 - b.y0 * 16) / A;
    v18 = (V + b.z1 * 16) / A;
    u43 = u14;
    u22 = u12;
    u12 = u14;
    u14 = u22;
    v24 = v18;
    v26 = v16;
  } else if (r === 3) {
    u12 = (U + 16 - b.z0 * 16) / A;
    u14 = (U + 16 - b.z1 * 16 - 0.01) / A;
    v16 = (V + b.y1 * 16) / A;
    v18 = (V + b.y0 * 16 - 0.01) / A;
    u43 = u14;
    u22 = u12;
    v24 = v16;
    v26 = v18;
  }
  const X = x + b.x0, Y0 = y + b.y0, Y1 = y + b.y1, Z0 = z + b.z0, Z1 = z + b.z1;
  g.vertex(X, Y1, Z1, u43, v24);
  g.vertex(X, Y1, Z0, u12, v16);
  g.vertex(X, Y0, Z0, u22, v26);
  g.vertex(X, Y0, Z1, u14, v18);
}

export function facePosX(g: GeoBuilder, x: number, y: number, z: number, b: Bounds, tex: number, r: number): void {
  const U = tileX(tex);
  const V = tileY(tex);
  let u12 = (U + b.z0 * 16) / A;
  let u14 = (U + b.z1 * 16 - 0.01) / A;
  let v16 = (V + 16 - b.y1 * 16) / A;
  let v18 = (V + 16 - b.y0 * 16 - 0.01) / A;
  let u43 = u14;
  let u22 = u12;
  let v24 = v16;
  let v26 = v18;
  if (r === 2) {
    u12 = (U + b.y0 * 16) / A;
    v16 = (V + 16 - b.z0 * 16) / A;
    u14 = (U + b.y1 * 16) / A;
    v18 = (V + 16 - b.z1 * 16) / A;
    v24 = v16;
    v26 = v18;
    u43 = u12;
    u22 = u14;
    v16 = v18;
    v18 = v24;
  } else if (r === 1) {
    u12 = (U + 16 - b.y1 * 16) / A;
    v16 = (V + b.z1 * 16 - 0.01) / A;
    u14 = (U + 16 - b.y0 * 16 - 0.01) / A;
    v18 = (V + b.z0 * 16) / A;
    u43 = u14;
    u22 = u12;
    u12 = u14;
    u14 = u22;
    v24 = v18;
    v26 = v16;
  } else if (r === 3) {
    u12 = (U + 16 - b.z0 * 16) / A;
    u14 = (U + 16 - b.z1 * 16 - 0.01) / A;
    v16 = (V + b.y1 * 16) / A;
    v18 = (V + b.y0 * 16 - 0.01) / A;
    u43 = u14;
    u22 = u12;
    v24 = v16;
    v26 = v18;
  }
  const X = x + b.x1, Y0 = y + b.y0, Y1 = y + b.y1, Z0 = z + b.z0, Z1 = z + b.z1;
  g.vertex(X, Y0, Z1, u22, v26);
  g.vertex(X, Y0, Z0, u14, v18);
  g.vertex(X, Y1, Z0, u43, v24);
  g.vertex(X, Y1, Z1, u12, v16);
}

const FACE_FNS = [faceBottom, faceTop, faceNegZ, facePosZ, faceNegX, facePosX] as const;

/**
 * A box with per-side textures, shaded like the game without lighting.
 * `sides[s]` — whether to draw side s; `tex(s)` — texture slot; `rot` — UV rotation per side.
 */
export function drawBox(
  g: GeoBuilder,
  x: number,
  y: number,
  z: number,
  b: Bounds,
  tex: (side: number) => number,
  sides: (side: number) => boolean,
  rot: UvRot = NO_ROT,
  tint: [number, number, number] = [1, 1, 1],
): void {
  for (let s = 0; s < 6; s++) {
    if (!sides(s)) continue;
    const sh = SHADE[s];
    g.color(sh * tint[0], sh * tint[1], sh * tint[2]);
    FACE_FNS[s](g, x, y, z, b, tex(s), rot[s]);
  }
}
