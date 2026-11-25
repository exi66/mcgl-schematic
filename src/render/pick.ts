// Voxel ray picking (Amanatides–Woo DDA) over the schematic grid.

export interface PickHit {
  x: number;
  y: number;
  z: number;
  /** Side of the block the ray entered through (0 bottom … 5 +X), −1 if the ray started inside. */
  side: number;
}

export function pickVoxel(
  origin: [number, number, number],
  dir: [number, number, number],
  size: [number, number, number],
  solid: (x: number, y: number, z: number) => boolean,
  maxDist = 2000,
): PickHit | null {
  // Clip the ray to the grid box first.
  let tMin = 0;
  let tMax = maxDist;
  for (let a = 0; a < 3; a++) {
    if (Math.abs(dir[a]) < 1e-12) {
      if (origin[a] < 0 || origin[a] > size[a]) return null;
    } else {
      let t0 = (0 - origin[a]) / dir[a];
      let t1 = (size[a] - origin[a]) / dir[a];
      if (t0 > t1) [t0, t1] = [t1, t0];
      tMin = Math.max(tMin, t0);
      tMax = Math.min(tMax, t1);
      if (tMin > tMax) return null;
    }
  }
  const eps = 1e-6;
  const p = [origin[0] + dir[0] * (tMin + eps), origin[1] + dir[1] * (tMin + eps), origin[2] + dir[2] * (tMin + eps)];
  const cell = p.map((v, a) => Math.min(size[a] - 1, Math.max(0, Math.floor(v))));
  const step = dir.map((d) => (d > 0 ? 1 : d < 0 ? -1 : 0));
  const tDelta = dir.map((d) => (d !== 0 ? Math.abs(1 / d) : Infinity));
  const tNext = dir.map((d, a) => {
    if (d > 0) return tMin + (cell[a] + 1 - p[a]) / d;
    if (d < 0) return tMin + (cell[a] - p[a]) / d;
    return Infinity;
  });
  // Entry side for the first cell.
  let side = -1;
  if (tMin > 0) {
    let best = 0;
    for (let a = 0; a < 3; a++) {
      const f = p[a] - cell[a];
      const dist = Math.min(f, 1 - f);
      if (a === 0 || dist < best) {
        best = dist;
        side = entrySide(a, step[a]);
      }
    }
  }
  let t = tMin;
  while (t <= tMax) {
    if (solid(cell[0], cell[1], cell[2])) return { x: cell[0], y: cell[1], z: cell[2], side };
    let a = 0;
    if (tNext[1] < tNext[a]) a = 1;
    if (tNext[2] < tNext[a]) a = 2;
    t = tNext[a];
    cell[a] += step[a];
    if (cell[a] < 0 || cell[a] >= size[a]) return null;
    tNext[a] += tDelta[a];
    side = entrySide(a, step[a]);
  }
  return null;
}

function entrySide(axis: number, step: number): number {
  // Entering while moving +X means we hit the −X side.
  if (axis === 0) return step > 0 ? 4 : 5;
  if (axis === 1) return step > 0 ? 0 : 1;
  return step > 0 ? 2 : 3;
}
