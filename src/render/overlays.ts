// Scene helpers: floor grid with side labels, measured box with dimension labels.

import * as THREE from 'three';

/** UI font of the preset, also used for labels drawn on canvases. */
export const CANVAS_FONT = "'Geist Mono Variable', ui-monospace, monospace";

function textCanvas(text: string, opts: { color: string; bg?: string; font?: string; pad?: number }): HTMLCanvasElement {
  const font = opts.font ?? `bold 48px ${CANVAS_FONT}`;
  const pad = opts.pad ?? 12;
  const c = document.createElement('canvas');
  const g = c.getContext('2d')!;
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + pad * 2;
  const h = 64 + pad;
  c.width = w;
  c.height = h;
  g.font = font;
  if (opts.bg) {
    g.fillStyle = opts.bg;
    g.fillRect(0, 0, w, h);
  }
  g.fillStyle = opts.color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 2);
  return c;
}

function canvasTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 4;
  return t;
}

/** A label standing on the floor that always faces the camera (readable from any side). */
function floorLabel(text: string, color: string, size: number): THREE.Sprite {
  const c = textCanvas(text, { color });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTexture(c), transparent: true, depthWrite: false }));
  s.scale.set((c.width / c.height) * size, size, 1);
  s.center.set(0.5, 0);
  s.renderOrder = 2;
  return s;
}

/** Floor grid under the schematic (y = 0) with a margin and footprint outline (child 'lines'), side labels beyond it (child 'labels'). */
export function makeGrid(width: number, length: number, dark: boolean): THREE.Group {
  const group = new THREE.Group();
  const margin = Math.max(8, Math.round(Math.max(width, length) * 0.25));
  const x0 = -margin, x1 = width + margin, z0 = -margin, z1 = length + margin;
  const minor: number[] = [];
  const major: number[] = [];
  for (let x = x0; x <= x1; x++) (x % 16 === 0 ? major : minor).push(x, 0, z0, x, 0, z1);
  for (let z = z0; z <= z1; z++) (z % 16 === 0 ? major : minor).push(x0, 0, z, x1, 0, z);
  const lineGroup = new THREE.Group();
  lineGroup.name = 'lines';
  const labelGroup = new THREE.Group();
  labelGroup.name = 'labels';
  group.add(lineGroup, labelGroup);
  const lines = (pts: number[], color: number, opacity: number) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const l = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
    l.renderOrder = -1;
    return l;
  };
  const base = dark ? 0xffffff : 0x000000;
  lineGroup.add(lines(minor, base, dark ? 0.08 : 0.1));
  lineGroup.add(lines(major, base, dark ? 0.16 : 0.2));
  const outline = [0, 0, 0, width, 0, 0, width, 0, 0, width, 0, length, width, 0, length, 0, 0, length, 0, 0, length, 0, 0, 0];
  lineGroup.add(lines(outline, dark ? 0x8fb3ea : 0x2b5fb3, 0.9));
  // Side labels a little beyond the footprint.
  const size = Math.max(1.2, Math.min(6, margin * 0.35));
  const off = margin * 0.45;
  const colorX = '#e5484d';
  const colorZ = '#3e8ef0';
  const place = (m: THREE.Object3D, x: number, z: number) => {
    m.position.set(x, 0.01, z);
    labelGroup.add(m);
  };
  place(floorLabel('−X', colorX, size), -off, length / 2);
  place(floorLabel('+X', colorX, size), width + off, length / 2);
  place(floorLabel('−Z', colorZ, size), width / 2, -off);
  place(floorLabel('+Z', colorZ, size), width / 2, length + off);
  group.userData.margin = margin;
  return group;
}

export interface Cell {
  x: number;
  y: number;
  z: number;
}

/** Screen-facing label of constant pixel size with a dark outline (readable on any background). */
function outlinedSprite(text: string): THREE.Sprite {
  const font = `bold 56px ${CANVAS_FONT}`;
  const c = document.createElement('canvas');
  const g = c.getContext('2d')!;
  g.font = font;
  const pad = 16;
  c.width = Math.ceil(g.measureText(text).width) + pad * 2;
  c.height = 56 + pad * 2;
  g.font = font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = 10;
  g.strokeStyle = 'rgba(0,0,0,0.85)';
  g.strokeText(text, c.width / 2, c.height / 2 + 2);
  g.fillStyle = '#ffffff';
  g.fillText(text, c.width / 2, c.height / 2 + 2);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTexture(c), depthTest: false, sizeAttenuation: false }));
  const h = 0.06;
  s.scale.set((c.width / c.height) * h, h, 1);
  s.renderOrder = 20;
  return s;
}

/** Measured box around cells a..b (inclusive): thin white frame, light fill, "W × H × L" in the middle. */
export function makeMeasureBox(a: Cell, b: Cell): THREE.Group {
  const g = new THREE.Group();
  const min = new THREE.Vector3(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.min(a.z, b.z));
  const max = new THREE.Vector3(Math.max(a.x, b.x) + 1, Math.max(a.y, b.y) + 1, Math.max(a.z, b.z) + 1);
  const size = max.clone().sub(min);
  const center = min.clone().add(size.clone().multiplyScalar(0.5));
  const geo = new THREE.BoxGeometry(size.x + 0.02, size.y + 0.02, size.z + 0.02);
  const frame = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 }));
  frame.position.copy(center);
  frame.renderOrder = 19;
  const hidden = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthTest: false }),
  );
  hidden.position.copy(center);
  hidden.renderOrder = 18;
  const fill = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.12, depthWrite: false }));
  fill.position.copy(center);
  fill.renderOrder = 17;
  const label = outlinedSprite(`${size.x} × ${size.y} × ${size.z}`);
  label.position.copy(center);
  g.add(fill, hidden, frame, label);
  g.userData.size = [size.x, size.y, size.z];
  return g;
}

export function disposeObject(o: THREE.Object3D): void {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    m.geometry?.dispose();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      (mat as THREE.MeshBasicMaterial).map?.dispose();
      mat.dispose();
    }
  });
}
