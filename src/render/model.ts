// Block models from public/assets/models/<name>/<name>.xml (the game's model format).
// A model is a tree of boxes. Each node: position (blocks), orientation (quaternion), offset (box centre,
// blocks), size (pixels), scale, and a UV unwrap of 6 faces on the model texture (texwidth × texheight).
// Static pose only (animations are ignored).

import { GeoBuilder, type GeoArrays } from './geometry';

interface XmlEl {
  name: string;
  attrs: Record<string, string>;
  children: XmlEl[];
}

/** Tiny XML parser: elements and attributes only (enough for the model format). */
export function parseXml(text: string): XmlEl {
  const root: XmlEl = { name: '#root', attrs: {}, children: [] };
  const stack: XmlEl[] = [root];
  const re =
    /<(\/?)([A-Za-z_][\w.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|<\?[\s\S]*?\?>|<!--[\s\S]*?-->/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (!m[2]) continue; // declaration or comment
    const [, closing, name, attrText, selfClosing] = m;
    if (closing) {
      while (stack.length > 1 && stack.pop()!.name !== name);
      continue;
    }
    const attrs: Record<string, string> = {};
    for (const a of attrText.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[a[1]] = a[2] ?? a[3] ?? '';
    const el: XmlEl = { name, attrs, children: [] };
    stack[stack.length - 1].children.push(el);
    if (!selfClosing) stack.push(el);
  }
  return root;
}

type V3 = [number, number, number];

interface UvCorner {
  u: number;
  v: number;
}
type FaceUv = [UvCorner, UvCorner, UvCorner, UvCorner];

export interface ModelNode {
  id: number;
  position: V3;
  offset: V3;
  scale: V3;
  orientation: [number, number, number, number]; // w, x, y, z
  size: V3;
  faces: FaceUv[]; // num0..num5
  children: ModelNode[];
}

export interface ModelDef {
  name: string;
  texWidth: number;
  texHeight: number;
  noCullFace: boolean;
  alpha: boolean;
  nodes: ModelNode[];
}

const num = (s: string | undefined, d = 0) => (s === undefined ? d : Number.parseFloat(s));

function vec(el: XmlEl | undefined, d: number): V3 {
  if (!el) return [d, d, d];
  return [num(el.attrs.x, d), num(el.attrs.y, d), num(el.attrs.z, d)];
}

/** UV corners of a face rectangle, as the client computes them (transform: rotation/flip bits). */
export function unwrapCorners(
  x: number,
  y: number,
  w: number,
  h: number,
  tw: number,
  th: number,
  transform: number,
): FaceUv {
  let c0: [number, number], c1: [number, number], c2: [number, number], c3: [number, number];
  if (transform === 0) {
    c0 = [(x + w) / tw, (y + h) / th];
    c1 = [(x + w) / tw, y / th];
    c2 = [x / tw, y / th];
    c3 = [x / tw, (y + h) / th];
  } else {
    const kind = transform & 7;
    const flipA = (transform & 8) !== 0;
    const flipB = (transform & 16) !== 0;
    let a = 0;
    let b = 0;
    let u0: number, v0: number, u1: number, v1: number;
    if (kind === 1) {
      if (flipB) a = h;
      if (flipA) b = w;
      u0 = x - h + a;
      v0 = y - b;
      u1 = x + a;
      v1 = y + w - b;
    } else if (kind === 2) {
      if (flipA) a = w;
      if (flipB) b = h;
      u0 = x - w + a;
      v0 = y - h + b;
      u1 = x + a;
      v1 = y + b;
    } else if (kind === 4) {
      if (flipB) a = h;
      if (flipA) b = w;
      u0 = x - a;
      v0 = y - w + b;
      u1 = x + h - a;
      v1 = y + b;
    } else {
      if (flipA) a = w;
      if (flipB) b = h;
      u0 = x - a;
      v0 = y - b;
      u1 = x + w - a;
      v1 = y + h - b;
    }
    u0 /= tw;
    u1 /= tw;
    v0 /= th;
    v1 /= th;
    if (kind === 1) {
      c0 = [u0, v1];
      c1 = [u1, v1];
      c2 = [u1, v0];
      c3 = [u0, v0];
    } else if (kind === 2) {
      c0 = [u0, v0];
      c1 = [u0, v1];
      c2 = [u1, v1];
      c3 = [u1, v0];
    } else if (kind === 4) {
      c0 = [u1, v0];
      c1 = [u0, v0];
      c2 = [u0, v1];
      c3 = [u1, v1];
    } else {
      c0 = [u1, v1];
      c1 = [u1, v0];
      c2 = [u0, v0];
      c3 = [u0, v1];
    }
    if (flipA) [c0, c1, c2, c3] = [c3, c2, c1, c0];
    if (flipB) [c0, c1, c2, c3] = [c1, c0, c3, c2];
  }
  return [c0, c1, c2, c3].map(([u, v]) => ({ u, v })) as FaceUv;
}

function parseNode(el: XmlEl, tw: number, th: number): ModelNode {
  const child = (n: string) => el.children.find((c) => c.name.toLowerCase() === n);
  const o = child('orientation');
  const size = vec(child('size'), 0);
  const node: ModelNode = {
    id: Number.parseInt(el.attrs.id ?? '0', 10),
    position: vec(child('position'), 0),
    offset: vec(child('offset'), 0),
    scale: vec(child('scale'), 1),
    orientation: o ? [num(o.attrs.w, 1), num(o.attrs.x), num(o.attrs.y), num(o.attrs.z)] : [1, 0, 0, 0],
    size,
    faces: [],
    children: [],
  };
  const unwrap = child('unwrap');
  // Face rectangle dimensions: num0/num1 X×Y, num2/num4 Z×Y, num3/num5 X×Z.
  const dims: [number, number][] = [
    [size[0], size[1]],
    [size[0], size[1]],
    [size[2], size[1]],
    [size[0], size[2]],
    [size[2], size[1]],
    [size[0], size[2]],
  ];
  for (let i = 0; i < 6; i++) {
    const f = unwrap?.children.find((c) => c.name.toLowerCase() === `num${i}`);
    if (f) {
      node.faces.push(
        unwrapCorners(num(f.attrs.x), num(f.attrs.y), dims[i][0], dims[i][1], tw, th, num(f.attrs.transform)),
      );
    } else {
      node.faces.push([
        { u: 0, v: 0 },
        { u: 0, v: 0 },
        { u: 0, v: 0 },
        { u: 0, v: 0 },
      ]);
    }
  }
  for (const c of el.children) if (c.name.toLowerCase() === 'node') node.children.push(parseNode(c, tw, th));
  return node;
}

export function parseModel(name: string, xml: string): ModelDef {
  const doc = parseXml(xml);
  const model = doc.children.find((c) => c.name === 'model');
  if (!model) throw new Error(`Модель ${name}: нет элемента <model>`);
  const tw = num(model.attrs.texwidth, 64);
  const th = num(model.attrs.texheight, 64);
  const flag = (k: string) => model.attrs[k] === 'true';
  return {
    name,
    texWidth: tw,
    texHeight: th,
    noCullFace: flag('nocullface'),
    alpha: flag('alpha'),
    nodes: model.children.filter((c) => c.name.toLowerCase() === 'node').map((c) => parseNode(c, tw, th)),
  };
}

// ── Geometry ─────────────────────────────────────────────────────────────────

type M4 = number[]; // column-major 4×4

const ident = (): M4 => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function mul(a: M4, b: M4): M4 {
  const r = new Array<number>(16).fill(0);
  for (let c = 0; c < 4; c++)
    for (let row = 0; row < 4; row++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + row] * b[c * 4 + k];
      r[c * 4 + row] = s;
    }
  return r;
}

function translate(m: M4, v: V3): M4 {
  return mul(m, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, v[0], v[1], v[2], 1]);
}

/** Rotation matrix exactly as the client builds it from the node quaternion (column-major). */
function quatMatrix([w, qx, qy, qz]: [number, number, number, number]): M4 {
  const k = 2;
  const v11 = -qx * k;
  const v12 = -qy * k;
  const v13 = qz * k;
  const v5 = -qx * v11;
  const v8 = -qx * v12;
  const v9 = -qx * v13;
  const v6 = -qy * v12;
  const v7 = -qy * v13;
  const v10 = qz * v13;
  const v2 = w * v11;
  const v3 = w * v12;
  const v4 = w * v13;
  return [
    1 - (v6 + v10),
    v8 - v4,
    v9 + v3,
    0,
    v8 + v4,
    1 - (v5 + v10),
    v7 - v2,
    0,
    v9 - v3,
    v7 + v2,
    1 - (v5 + v6),
    0,
    0,
    0,
    0,
    1,
  ];
}

function apply(m: M4, p: V3): V3 {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

function swapCorners(f: FaceUv, a: boolean, b: boolean): FaceUv {
  let r = f;
  if (a) r = [r[3], r[2], r[1], r[0]];
  if (b) r = [r[1], r[0], r[3], r[2]];
  return r;
}

/**
 * Model geometry in block space: origin at the bottom centre of the block, +Y up.
 * UVs are relative to the model texture (v grows downward).
 */
export function buildModelGeometry(def: ModelDef): GeoArrays {
  const g = new GeoBuilder(0.25 / Math.max(def.texWidth, def.texHeight));
  const walk = (node: ModelNode, parent: M4) => {
    let m = translate(parent, node.position);
    m = mul(m, quatMatrix(node.orientation));
    const c = node.offset;
    const hx = ((node.size[0] / 16) * Math.abs(node.scale[0])) / 2;
    const hy = ((node.size[1] / 16) * Math.abs(node.scale[1])) / 2;
    const hz = ((node.size[2] / 16) * Math.abs(node.scale[2])) / 2;
    const nx = node.scale[0] < 0,
      ny = node.scale[1] < 0,
      nz = node.scale[2] < 0;
    const F = node.faces;
    const quads: [FaceUv, V3[]][] = [
      // +Z
      [
        swapCorners(F[nz ? 1 : 0], nx, ny),
        [
          [hx, -hy, hz],
          [hx, hy, hz],
          [-hx, hy, hz],
          [-hx, -hy, hz],
        ],
      ],
      // −Z
      [
        swapCorners(F[nz ? 0 : 1], nx, ny),
        [
          [-hx, -hy, -hz],
          [-hx, hy, -hz],
          [hx, hy, -hz],
          [hx, -hy, -hz],
        ],
      ],
      // +X
      [
        swapCorners(F[nx ? 4 : 2], nz, ny),
        [
          [hx, -hy, -hz],
          [hx, hy, -hz],
          [hx, hy, hz],
          [hx, -hy, hz],
        ],
      ],
      // −Y
      [
        swapCorners(F[ny ? 5 : 3], nx, nz),
        [
          [hx, -hy, -hz],
          [hx, -hy, hz],
          [-hx, -hy, hz],
          [-hx, -hy, -hz],
        ],
      ],
      // −X
      [
        swapCorners(F[nx ? 2 : 4], nz, ny),
        [
          [-hx, -hy, hz],
          [-hx, hy, hz],
          [-hx, hy, -hz],
          [-hx, -hy, -hz],
        ],
      ],
      // +Y
      [
        swapCorners(F[ny ? 3 : 5], nx, nz),
        [
          [hx, hy, hz],
          [hx, hy, -hz],
          [-hx, hy, -hz],
          [-hx, hy, hz],
        ],
      ],
    ];
    for (const [uv, pts] of quads) {
      const w = pts.map((p) => apply(m, [p[0] + c[0], p[1] + c[1], p[2] + c[2]]));
      g.color(...shadeFor(w));
      for (let i = 0; i < 4; i++) g.vertex(w[i][0], w[i][1], w[i][2], uv[i].u, uv[i].v);
    }
    if (node.children.length) {
      const cm = translate(m, c);
      for (const ch of node.children) walk(ch, cm);
    }
  };
  for (const n of def.nodes) walk(n, ident());
  return g.build();
}

/** Face shade from its normal, blending the game's per-axis shades. */
function shadeFor(p: V3[]): [number, number, number] {
  const ax = p[1][0] - p[0][0],
    ay = p[1][1] - p[0][1],
    az = p[1][2] - p[0][2];
  const bx = p[2][0] - p[0][0],
    by = p[2][1] - p[0][1],
    bz = p[2][2] - p[0][2];
  let nx = ay * bz - az * by,
    ny = az * bx - ax * bz,
    nz = ax * by - ay * bx;
  const len = Math.hypot(nx, ny, nz) || 1;
  nx /= len;
  ny /= len;
  nz /= len;
  const s = nx * nx * 0.6 + nz * nz * 0.8 + ny * ny * (ny > 0 ? 1 : 0.5);
  return [s, s, s];
}

/** Model rotation around Y (degrees) by block metadata, as the client applies it. */
export function modelRotationDeg(meta: number): number {
  switch (meta) {
    case 2:
      return -180;
    case 4:
      return -90;
    case 5:
      return 90;
    default:
      return 0;
  }
}
