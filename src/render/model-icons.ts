import * as THREE from 'three';
import { buildModelGeometry, parseModel } from './model';

const BASE = import.meta.env.BASE_URL;
const ICON_SIZE = 64;

const cache = new Map<string, string | null>();
const pending = new Map<string, Promise<string | null>>();

let sharedRenderer: THREE.WebGLRenderer | null | undefined;

function getRenderer(): THREE.WebGLRenderer | null {
  if (sharedRenderer !== undefined) return sharedRenderer;
  try {
    const r = new THREE.WebGLRenderer({ alpha: true, antialias: false, preserveDrawingBuffer: true });
    r.setSize(ICON_SIZE, ICON_SIZE, false);
    r.setPixelRatio(1);
    r.setClearColor(0x000000, 0);
    r.outputColorSpace = THREE.LinearSRGBColorSpace;
    sharedRenderer = r;
  } catch (e) {
    console.warn('WebGLRenderer for model icons unavailable:', e);
    sharedRenderer = null;
  }
  return sharedRenderer;
}

function loadTexture(url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      url,
      (t) => {
        t.magFilter = THREE.NearestFilter;
        t.minFilter = THREE.NearestFilter;
        t.generateMipmaps = false;
        t.flipY = false;
        t.colorSpace = THREE.NoColorSpace;
        t.needsUpdate = true;
        resolve(t);
      },
      undefined,
      () => reject(new Error(`Failed to load model texture: ${url}`)),
    );
  });
}

async function renderModelIcon(name: string): Promise<string | null> {
  const renderer = getRenderer();
  if (!renderer) return null;

  const short = name.split('/').pop();
  const [xml, tex] = await Promise.all([
    fetch(`${BASE}assets/models/${name}/${short}.xml`).then((r) => {
      if (!r.ok) throw new Error(`${r.status}`);
      return r.text();
    }),
    loadTexture(`${BASE}assets/models/${name}/${short}.png`),
  ]);

  const def = parseModel(name, xml);
  const arrays = buildModelGeometry(def);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(arrays.positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(arrays.uvs, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(arrays.colors, 3));
  geo.setIndex(new THREE.BufferAttribute(arrays.indices, 1));
  geo.computeBoundingBox();

  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    vertexColors: true,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geo, mat);
  const scene = new THREE.Scene();
  scene.add(mesh);

  const box = geo.boundingBox!;
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);

  const dir = new THREE.Vector3(1, 0.85, 1).normalize();
  const radius = Math.max(size.length() * 0.5, 0.5);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, radius * 10);
  cam.position.copy(center).addScaledVector(dir, radius * 3);
  cam.lookAt(center);
  cam.updateMatrixWorld();

  // Fit the projected bounding box corners into the square icon with 10% padding.
  let maxX = 0;
  let maxY = 0;
  const corner = new THREE.Vector3();
  for (let ix = 0; ix < 2; ix++) {
    for (let iy = 0; iy < 2; iy++) {
      for (let iz = 0; iz < 2; iz++) {
        corner.set(ix ? box.max.x : box.min.x, iy ? box.max.y : box.min.y, iz ? box.max.z : box.min.z);
        corner.applyMatrix4(cam.matrixWorldInverse);
        maxX = Math.max(maxX, Math.abs(corner.x));
        maxY = Math.max(maxY, Math.abs(corner.y));
      }
    }
  }
  const half = Math.max(maxX, maxY, 0.25) * 1.1;
  cam.left = -half;
  cam.right = half;
  cam.top = half;
  cam.bottom = -half;
  cam.updateProjectionMatrix();

  renderer.render(scene, cam);
  const dataUrl = renderer.domElement.toDataURL('image/png');

  geo.dispose();
  mat.dispose();
  tex.dispose();

  return dataUrl;
}

export function peekModelIcon(name: string): string | null | undefined {
  return cache.get(name);
}

export function getModelIcon(name: string): Promise<string | null> {
  if (cache.has(name)) return Promise.resolve(cache.get(name) ?? null);
  let p = pending.get(name);
  if (!p) {
    p = renderModelIcon(name)
      .catch((e) => {
        console.warn(`Model icon ${name} failed:`, e);
        return null;
      })
      .then((url) => {
        cache.set(name, url);
        pending.delete(name);
        return url;
      });
    pending.set(name, p);
  }
  return p;
}
