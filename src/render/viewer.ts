// three.js scene for a schematic: chunked block meshes, instanced models, ghost blocks, cameras and navigation
// modes (orbit / plan / explore), slicing, floor grid, measuring and picking.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BLOCKS, MODEL_NAMES, variantKey } from '../blocks/pool';
import type { Schematic } from '../schematic/schematic';
import { ExploreControls } from './explore';
import type { GeoArrays } from './geometry';
import { meshRegion, type ModelInstance, type Voxels } from './mesher';
import { buildModelGeometry, modelRotationDeg, parseModel } from './model';
import { CANVAS_FONT, disposeObject, makeGrid, makeMeasureBox, type Cell } from './overlays';
import { pickVoxel, type PickHit } from './pick';
import { makeStubAtlas } from './stubs';
import { AtlasAnimator } from './texfx';

export type NavMode = 'orbit' | 'plan' | 'explore';
export type Axis = 'x' | 'y' | 'z';

export interface SliceState {
  enabled: boolean;
  axis: Axis;
  /** Cut position along the axis (cells ≤ value are shown). */
  value: number;
  /** Only the slice itself, with the previous one as a translucent underlay. */
  isolate: boolean;
}

export interface ViewState {
  slice: SliceState;
  /** Hidden variants ("id:meta" keys, see variantKey). */
  hidden: ReadonlySet<string>;
  /** Highlighted variant key: everything else becomes translucent. */
  highlight: string | null;
}

export interface DisplayState {
  grid: boolean;
  ortho: boolean;
  /** Viewport background colour; null — follow the theme. */
  background: string | null;
  dark: boolean;
  /** Animated textures (fluids, portal, plutonium…), 20 ticks per second like the game. */
  animate: boolean;
  /** Side labels (±X, ±Z) on the floor. */
  labels: boolean;
}

type Visibility = 0 | 1 | 2; // hidden, normal, ghost

const CHUNK = 32;
const GHOST_OPACITY = 0.22;
/** Blocks you can walk through in the explore mode. */
const PASSABLE = new Set(['barrier', 'fluid', 'redstoneWire', 'electricWire', 'torch', 'lever', 'lamp', 'none']);

function loadTexture(url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      url,
      (t) => resolve(pixelTexture(t)),
      undefined,
      () => reject(new Error(`Не загрузилась текстура ${url}`)),
    );
  });
}

function pixelTexture<T extends THREE.Texture>(t: T): T {
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.flipY = false;
  // Like the game: colours and shading stay in gamma space (no sRGB conversion).
  t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

function toGeometry(a: GeoArrays): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(a.positions, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(a.uvs, 2));
  g.setAttribute('color', new THREE.BufferAttribute(a.colors, 3));
  g.setIndex(new THREE.BufferAttribute(a.indices, 1));
  g.computeBoundingSphere();
  return g;
}

interface Materials {
  solid: THREE.Material;
  cutout: THREE.Material;
  translucent: THREE.Material;
  unknown: THREE.Material;
  ghost: THREE.Material;
  ghostUnknown: THREE.Material;
}

interface LoadedModel {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  ghost: THREE.Material;
}

export class Viewer {
  readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly persp: THREE.PerspectiveCamera;
  private readonly orbitOrtho: THREE.OrthographicCamera;
  private readonly plan: THREE.OrthographicCamera;
  private controls?: OrbitControls;
  private explore?: ExploreControls;
  private mode: NavMode = 'orbit';
  private display: DisplayState = {
    grid: true,
    ortho: false,
    background: null,
    dark: false,
    animate: true,
    labels: true,
  };
  /** Frames per second over the last second (for the FPS meter). */
  fps = 0;
  private fpsFrames = 0;
  private fpsStart = 0;
  private animator?: AtlasAnimator;
  private atlasTexture?: THREE.CanvasTexture;
  private animLoop = 0;
  private readonly content = new THREE.Group();
  private grid?: THREE.Group;
  private measureObj?: THREE.Group;
  private selectObj?: THREE.LineSegments;
  private hoverBox?: THREE.LineSegments;
  private materials?: Materials;
  private models = new Map<string, LoadedModel>();
  private ready: Promise<void>;
  private schematic?: Schematic;
  private state?: ViewState;
  private vis?: Uint8Array;
  private frame = 0;
  private loop = 0;
  private lastTime = 0;
  private disposed = false;
  private readonly resizeObserver: ResizeObserver;
  onCameraChange?: () => void;
  onExploreLock?: (locked: boolean) => void;

  constructor(private readonly host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.touchAction = 'none';
    this.persp = new THREE.PerspectiveCamera(60, 1, 0.05, 5000);
    this.orbitOrtho = new THREE.OrthographicCamera(-10, 10, 10, -10, -5000, 5000);
    this.plan = new THREE.OrthographicCamera(-10, 10, 10, -10, -5000, 5000);
    this.scene.add(this.content);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.setupControls();
    this.resize();
    this.ready = this.loadAssets();
  }

  // ── Cameras and navigation ──────────────────────────────────────────────────

  get camera(): THREE.Camera {
    if (this.mode === 'plan') return this.plan;
    if (this.mode === 'orbit' && this.display.ortho) return this.orbitOrtho;
    return this.persp;
  }

  get navMode(): NavMode {
    return this.mode;
  }

  private setupControls(): void {
    this.controls?.dispose();
    this.controls = undefined;
    this.explore?.dispose();
    this.explore = undefined;
    cancelAnimationFrame(this.loop);
    this.loop = 0;
    if (this.mode === 'explore') {
      const ex = new ExploreControls(this.persp, this.renderer.domElement, {
        solid: (x, y, z) => this.isSolid(x, y, z),
        floorY: 0,
      });
      // Mouse look changes only the rotation: redraw right away, not just when the player moves.
      ex.onChange = () => {
        this.requestRender();
        this.onCameraChange?.();
      };
      ex.onLockChange = (l) => this.onExploreLock?.(l);
      this.explore = ex;
      this.lastTime = performance.now();
      const tick = (t: number) => {
        this.loop = requestAnimationFrame(tick);
        const dt = (t - this.lastTime) / 1000;
        this.lastTime = t;
        if (ex.update(dt)) this.requestRender();
      };
      this.loop = requestAnimationFrame(tick);
      return;
    }
    const cam = this.camera as THREE.PerspectiveCamera | THREE.OrthographicCamera;
    const c = new OrbitControls(cam, this.renderer.domElement);
    c.enableDamping = false;
    c.screenSpacePanning = true;
    c.zoomToCursor = true;
    if (this.mode === 'plan') {
      c.enableRotate = false;
      c.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
      c.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
    } else {
      c.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    }
    c.addEventListener('change', () => {
      this.requestRender();
      this.onCameraChange?.();
    });
    this.controls = c;
  }

  /** Temporarily stops orbit/pan (while measuring with the left button). */
  setControlsEnabled(on: boolean): void {
    if (this.controls) this.controls.enabled = on;
  }

  setNavMode(mode: NavMode): void {
    if (mode === this.mode) return;
    const prev = this.mode;
    const prevCam = this.camera;
    const prevTarget = this.controls?.target.clone();
    this.mode = mode;
    if (mode === 'explore') {
      // Start from where the orbit camera looked from.
      this.persp.position.copy(prevCam.position);
      this.persp.quaternion.copy(prevCam.quaternion);
      if (prev === 'plan' && this.schematic) {
        const s = this.schematic;
        this.persp.position.set(-4, s.height + 4, s.length / 2);
        this.persp.lookAt(s.width / 2, 0, s.length / 2);
      }
      this.persp.updateMatrixWorld();
      this.setupControls();
      this.explore!.placeFromCamera();
      this.explore!.lock();
    } else {
      this.setupControls();
      if (mode === 'orbit' && prev === 'explore' && this.schematic) {
        // Keep the explore viewpoint, orbit around the build centre.
        const s = this.schematic;
        this.controls!.target.set(s.width / 2, s.height / 2, s.length / 2);
        this.syncOrthoFromPersp();
        this.controls!.update();
      } else if (mode === 'orbit' && prevTarget) {
        this.controls!.target.copy(prevTarget);
        this.controls!.update();
      } else {
        this.fit();
      }
    }
    this.requestRender();
    this.onCameraChange?.();
  }

  setDisplay(d: DisplayState): void {
    const prev = this.display;
    this.display = d;
    this.renderer.setClearColor(d.background ?? (d.dark ? '#16181d' : '#dfe3ea'), 1);
    if (prev.ortho !== d.ortho && this.mode === 'orbit') {
      if (d.ortho) this.syncOrthoFromPersp();
      else this.syncPerspFromOrtho();
      const target = this.controls?.target.clone();
      this.setupControls();
      if (target) {
        this.controls!.target.copy(target);
        this.controls!.update();
      }
    }
    if (prev.dark !== d.dark || !this.grid) this.rebuildGrid();
    this.applyGridVisibility();
    this.requestRender();
  }

  private syncOrthoFromPersp(): void {
    const target = this.controls?.target ?? new THREE.Vector3();
    const dist = this.persp.position.distanceTo(target);
    const halfH = dist * Math.tan(THREE.MathUtils.degToRad(this.persp.fov / 2));
    const aspect = this.aspect();
    const o = this.orbitOrtho;
    o.position.copy(this.persp.position);
    o.quaternion.copy(this.persp.quaternion);
    o.zoom = 1;
    o.top = halfH;
    o.bottom = -halfH;
    o.left = -halfH * aspect;
    o.right = halfH * aspect;
    o.updateProjectionMatrix();
  }

  private syncPerspFromOrtho(): void {
    const target = this.controls?.target ?? new THREE.Vector3();
    const o = this.orbitOrtho;
    const halfH = (o.top - o.bottom) / 2 / o.zoom;
    const dist = halfH / Math.tan(THREE.MathUtils.degToRad(this.persp.fov / 2));
    const dir = o.position.clone().sub(target).normalize();
    this.persp.position.copy(target).addScaledVector(dir, dist);
    this.persp.lookAt(target);
  }

  /** Rotates the view by 90° around the vertical axis (Q / E). */
  rotateView(dir: 1 | -1): void {
    const c = this.controls;
    if (!c) return;
    const angle = (dir * Math.PI) / 2;
    if (this.mode === 'plan') {
      this.plan.up.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
      this.plan.lookAt(c.target.x, 0, c.target.z);
    } else {
      const cam = this.camera;
      const offset = cam.position
        .clone()
        .sub(c.target)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
      cam.position.copy(c.target).add(offset);
      cam.lookAt(c.target);
    }
    c.update();
    this.requestRender();
    this.onCameraChange?.();
  }

  /** Frames the whole schematic (reset view). */
  fit(): void {
    const s = this.schematic;
    if (!s) return;
    const center = new THREE.Vector3(s.width / 2, s.height / 2, s.length / 2);
    const radius = Math.hypot(s.width, s.height, s.length) / 2;
    const aspect = this.aspect();
    if (this.mode === 'explore') {
      this.persp.position.set(center.x - radius * 1.2, s.height + radius * 0.6, center.z);
      this.persp.lookAt(center);
      this.explore?.placeFromCamera();
    } else if (this.mode === 'plan') {
      // Plan: screen up = −X, screen left = +Z (as on the game map). A rotation, not a mirror.
      this.plan.up.set(-1, 0, 0);
      this.plan.position.set(center.x, s.height + 100, center.z);
      this.plan.lookAt(center.x, 0, center.z);
      const half = Math.max(s.width / 2, s.length / 2 / aspect) * 1.1;
      this.plan.zoom = 1;
      this.plan.top = half;
      this.plan.bottom = -half;
      this.plan.left = -half * aspect;
      this.plan.right = half * aspect;
      this.plan.updateProjectionMatrix();
      this.controls?.target.set(center.x, 0, center.z);
    } else {
      const fovRad = THREE.MathUtils.degToRad(this.persp.fov / 2);
      const dist = (radius / Math.sin(Math.min(fovRad, Math.atan(Math.tan(fovRad) * aspect)))) * 1.02;
      // From the −X side (map "up"), slightly from above.
      const dir = new THREE.Vector3(-1, 0.9, 0.55).normalize();
      this.persp.position.copy(center).addScaledVector(dir, dist);
      this.persp.near = Math.max(0.05, dist / 2000);
      this.persp.far = dist * 20;
      this.persp.updateProjectionMatrix();
      this.persp.lookAt(center);
      this.controls?.target.copy(center);
      if (this.display.ortho) this.syncOrthoFromPersp();
    }
    this.controls?.update();
    this.requestRender();
    this.onCameraChange?.();
  }

  private aspect(): number {
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    return w / h;
  }

  private resize(): void {
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = `${w}px`;
    this.renderer.domElement.style.height = `${h}px`;
    this.persp.aspect = w / h;
    this.persp.updateProjectionMatrix();
    for (const o of [this.orbitOrtho, this.plan]) {
      const halfH = (o.top - o.bottom) / 2;
      o.left = -halfH * (w / h);
      o.right = halfH * (w / h);
      o.updateProjectionMatrix();
    }
    this.requestRender();
    this.onCameraChange?.();
  }

  requestRender(): void {
    if (this.frame || this.disposed) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.renderer.render(this.scene, this.camera);
      this.countFrame();
    });
  }

  private countFrame(): void {
    const now = performance.now();
    if (!this.fpsStart) this.fpsStart = now;
    this.fpsFrames++;
    if (now - this.fpsStart >= 1000) {
      this.fps = Math.round((this.fpsFrames * 1000) / (now - this.fpsStart));
      this.fpsFrames = 0;
      this.fpsStart = now;
    }
  }

  /** Camera position in schematic coordinates (for the explore HUD). */
  cameraPosition(): THREE.Vector3 {
    return this.camera.position.clone();
  }

  exploreLocked(): boolean {
    return this.explore?.isLocked ?? false;
  }

  lockExplore(): void {
    this.explore?.lock();
  }

  exploreState(): { flying: boolean; speed: number } | null {
    return this.explore ? { flying: this.explore.flying, speed: this.explore.flySpeed } : null;
  }

  // ── Assets and meshes ───────────────────────────────────────────────────────

  private async loadAssets(): Promise<void> {
    const base = import.meta.env.BASE_URL;
    // Canvas labels and stub textures use the UI font: wait for it.
    await document.fonts?.load(`bold 48px ${CANVAS_FONT}`).catch(() => undefined);
    const terrain = await this.loadAtlas(`${base}assets/terrain.png`);
    const stub = pixelTexture(new THREE.CanvasTexture(makeStubAtlas()));
    const basic = (p: THREE.MeshBasicMaterialParameters) => new THREE.MeshBasicMaterial({ vertexColors: true, ...p });
    this.materials = {
      solid: basic({ map: terrain, alphaTest: 0.1 }),
      cutout: basic({ map: terrain, alphaTest: 0.5, side: THREE.DoubleSide }),
      translucent: basic({
        map: terrain,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        alphaTest: 0.02,
      }),
      unknown: basic({ map: stub }),
      ghost: basic({
        map: terrain,
        transparent: true,
        opacity: GHOST_OPACITY,
        depthWrite: false,
        side: THREE.DoubleSide,
        alphaTest: 0.02,
      }),
      ghostUnknown: basic({ map: stub, transparent: true, opacity: GHOST_OPACITY, depthWrite: false }),
    };
    await Promise.all(
      MODEL_NAMES.map(async (name) => {
        try {
          const [xml, tex] = await Promise.all([
            // "factory/node-1" → models/factory/node-1/node-1.xml (as the client lays out its models).
            fetch(`${base}assets/models/${name}/${name.split('/').pop()}.xml`).then((r) => {
              if (!r.ok) throw new Error(`${r.status}`);
              return r.text();
            }),
            loadTexture(`${base}assets/models/${name}/${name.split('/').pop()}.png`),
          ]);
          const def = parseModel(name, xml);
          this.models.set(name, {
            geometry: toGeometry(buildModelGeometry(def)),
            material: basic({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide }),
            ghost: basic({
              map: tex,
              transparent: true,
              opacity: GHOST_OPACITY,
              depthWrite: false,
              side: THREE.DoubleSide,
            }),
          });
        } catch (e) {
          console.warn(`Модель ${name} не загрузилась:`, e);
        }
      }),
    );
  }

  /** Loads the atlas into a canvas so animated tiles can be redrawn every tick. */
  private async loadAtlas(url: string): Promise<THREE.Texture> {
    const img = new Image();
    img.src = url;
    await img.decode().catch(() => {
      throw new Error(`Не загрузилась текстура ${url}`);
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    this.animator = new AtlasAnimator(ctx);
    this.atlasTexture = pixelTexture(new THREE.CanvasTexture(canvas));
    this.startAnimation();
    return this.atlasTexture;
  }

  private startAnimation(): void {
    cancelAnimationFrame(this.animLoop);
    const loop = (t: number) => {
      this.animLoop = requestAnimationFrame(loop);
      if (!this.display.animate || !this.schematic || document.hidden) return;
      if (this.animator?.step(t)) {
        this.atlasTexture!.needsUpdate = true;
        this.requestRender();
      }
    };
    this.animLoop = requestAnimationFrame(loop);
  }

  /** Sets a new schematic and frames it. */
  async setSchematic(s: Schematic, state: ViewState): Promise<void> {
    this.schematic = s;
    this.setMeasure(null);
    this.setSelected(null);
    await this.ready;
    this.rebuildGrid();
    await this.update(state);
    this.fit();
  }

  /** Re-meshes for a new view state. */
  async update(state: ViewState): Promise<void> {
    await this.ready;
    if (this.disposed || !this.schematic) return;
    this.state = state;
    this.rebuild();
  }

  private rebuildGrid(): void {
    if (this.grid) {
      this.scene.remove(this.grid);
      disposeObject(this.grid);
      this.grid = undefined;
    }
    if (!this.schematic) return;
    this.grid = makeGrid(this.schematic.width, this.schematic.length, this.display.dark);
    this.scene.add(this.grid);
    this.applyGridVisibility();
    this.requestRender();
  }

  private applyGridVisibility(): void {
    if (!this.grid) return;
    this.grid.getObjectByName('lines')!.visible = this.display.grid;
    this.grid.getObjectByName('labels')!.visible = this.display.labels;
    this.requestRender();
  }

  private computeVisibility(): Uint8Array {
    const s = this.schematic!;
    const st = this.state!;
    const vis = new Uint8Array(s.blocks.length);
    const W = s.width,
      L = s.length;
    const sl = st.slice;
    for (let i = 0; i < s.blocks.length; i++) {
      const id = s.blocks[i];
      if (id === 0) continue;
      const key = variantKey(id, s.data[i]);
      if (st.hidden.has(key)) continue;
      let v: Visibility = 1;
      if (sl.enabled) {
        const x = i % W;
        const z = Math.floor(i / W) % L;
        const y = Math.floor(i / (W * L));
        const c = sl.axis === 'x' ? x : sl.axis === 'y' ? y : z;
        if (sl.isolate) {
          if (c === sl.value) v = 1;
          else if (c === sl.value - 1) v = 2;
          else continue;
        } else if (c > sl.value) continue;
      }
      if (st.highlight !== null && key !== st.highlight) v = 2;
      vis[i] = v;
    }
    return vis;
  }

  private voxels(want: Visibility): Voxels {
    const s = this.schematic!;
    const vis = this.vis!;
    const W = s.width,
      H = s.height,
      L = s.length;
    return {
      id: (x, y, z) => {
        if (x < 0 || y < 0 || z < 0 || x >= W || y >= H || z >= L) return 0;
        const i = (y * L + z) * W + x;
        return vis[i] === want ? s.blocks[i] : 0;
      },
      meta: (x, y, z) => {
        if (x < 0 || y < 0 || z < 0 || x >= W || y >= H || z >= L) return 0;
        return s.data[(y * L + z) * W + x];
      },
    };
  }

  private isSolid(x: number, y: number, z: number): boolean {
    const s = this.schematic;
    const vis = this.vis;
    if (!s || !vis) return false;
    if (x < 0 || y < 0 || z < 0 || x >= s.width || y >= s.height || z >= s.length) return false;
    const i = (y * s.length + z) * s.width + x;
    if (vis[i] !== 1) return false;
    const d = BLOCKS.get(s.blocks[i]);
    return !d || !PASSABLE.has(d.render);
  }

  private clearContent(): void {
    for (const obj of [...this.content.children]) {
      this.content.remove(obj);
      if (obj instanceof THREE.InstancedMesh) obj.dispose();
      else if (obj instanceof THREE.Mesh) obj.geometry.dispose();
    }
  }

  private rebuild(): void {
    const s = this.schematic!;
    const m = this.materials!;
    this.vis = this.computeVisibility();
    this.clearContent();
    const normal = this.voxels(1);
    const ghost = this.voxels(2);
    const instances: { normal: ModelInstance[]; ghost: ModelInstance[] } = { normal: [], ghost: [] };
    const add = (a: GeoArrays, mat: THREE.Material, order: number) => {
      if (a.indices.length === 0) return;
      const mesh = new THREE.Mesh(toGeometry(a), mat);
      mesh.renderOrder = order;
      mesh.matrixAutoUpdate = false;
      this.content.add(mesh);
    };
    for (let cz = 0; cz < s.length; cz += CHUNK)
      for (let cx = 0; cx < s.width; cx += CHUNK) {
        const region = {
          x0: cx,
          y0: 0,
          z0: cz,
          x1: Math.min(s.width, cx + CHUNK),
          y1: s.height,
          z1: Math.min(s.length, cz + CHUNK),
        };
        const a = meshRegion(normal, region);
        add(a.solid, m.solid, 0);
        add(a.unknown, m.unknown, 0);
        add(a.cutout, m.cutout, 1);
        add(a.translucent, m.translucent, 3);
        instances.normal.push(...a.models);
        const b = meshRegion(ghost, region);
        for (const part of [b.solid, b.cutout, b.translucent]) add(part, m.ghost, 4);
        add(b.unknown, m.ghostUnknown, 4);
        instances.ghost.push(...b.models);
      }
    this.addModels(instances.normal, false);
    this.addModels(instances.ghost, true);
    this.requestRender();
  }

  private addModels(list: ModelInstance[], ghost: boolean): void {
    const byModel = new Map<string, ModelInstance[]>();
    for (const inst of list) {
      const arr = byModel.get(inst.model) ?? [];
      arr.push(inst);
      byModel.set(inst.model, arr);
    }
    const mtx = new THREE.Matrix4();
    const rot = new THREE.Matrix4();
    for (const [name, arr] of byModel) {
      const model = this.models.get(name);
      if (!model) continue;
      const mesh = new THREE.InstancedMesh(model.geometry, ghost ? model.ghost : model.material, arr.length);
      arr.forEach((inst, i) => {
        // glTranslate(x + 0.5, y, z + 0.5) then glRotatef(angle, 0, 1, 0).
        rot.makeRotationY(THREE.MathUtils.degToRad(modelRotationDeg(inst.rotation)));
        mtx.makeTranslation(inst.x + 0.5, inst.y, inst.z + 0.5).multiply(rot);
        mesh.setMatrixAt(i, mtx);
      });
      mesh.renderOrder = ghost ? 4 : 1;
      mesh.computeBoundingSphere();
      this.content.add(mesh);
    }
  }

  // ── Picking, hover, selection, measuring ───────────────────────────────────

  /** Visible block under a canvas point (client coordinates); in explore mode — at the screen centre. */
  pick(clientX: number, clientY: number): PickHit | null {
    const s = this.schematic;
    const vis = this.vis;
    if (!s || !vis) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc =
      this.mode === 'explore' && this.exploreLocked()
        ? new THREE.Vector2(0, 0)
        : new THREE.Vector2(
            ((clientX - rect.left) / rect.width) * 2 - 1,
            -((clientY - rect.top) / rect.height) * 2 + 1,
          );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    let o = ray.ray.origin;
    const d = ray.ray.direction;
    // Orthographic rays start at the near plane, possibly inside the build: back them off.
    if ((this.camera as THREE.OrthographicCamera).isOrthographicCamera) o = o.clone().addScaledVector(d, -1000);
    const W = s.width,
      L = s.length;
    return pickVoxel(
      [o.x, o.y, o.z],
      [d.x, d.y, d.z],
      [s.width, s.height, s.length],
      (x, y, z) => vis[(y * L + z) * W + x] === 1,
      5000,
    );
  }

  private outline(color: number, size = 1.004): THREE.LineSegments {
    const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(size, size, size));
    const l = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.9 }),
    );
    l.renderOrder = 10;
    this.scene.add(l);
    return l;
  }

  setHover(pos: Cell | null): void {
    this.hoverBox ??= this.outline(0xffffff);
    this.hoverBox.visible = pos !== null;
    if (pos) this.hoverBox.position.set(pos.x + 0.5, pos.y + 0.5, pos.z + 0.5);
    this.requestRender();
  }

  setSelected(pos: Cell | null): void {
    this.selectObj ??= this.outline(0x4da3ff, 1.02);
    this.selectObj.visible = pos !== null;
    if (pos) this.selectObj.position.set(pos.x + 0.5, pos.y + 0.5, pos.z + 0.5);
    this.requestRender();
  }

  /** Box between two cells with its dimensions, or null to clear. */
  setMeasure(a: Cell | null, b?: Cell | null): void {
    if (this.measureObj) {
      this.scene.remove(this.measureObj);
      disposeObject(this.measureObj);
      this.measureObj = undefined;
    }
    if (a && b) {
      this.measureObj = makeMeasureBox(a, b);
      this.scene.add(this.measureObj);
    }
    this.requestRender();
  }

  private pluginOverlays = new Map<string, THREE.Object3D>();

  /** A plugin's 3D layer: shows, replaces or (null) removes the object under the plugin's key. */
  setPluginOverlay(key: string, object: THREE.Object3D | null): void {
    const old = this.pluginOverlays.get(key);
    if (old) {
      this.scene.remove(old);
      disposeObject(old);
      this.pluginOverlays.delete(key);
    }
    if (object) {
      this.pluginOverlays.set(key, object);
      this.scene.add(object);
    }
    this.requestRender();
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    cancelAnimationFrame(this.loop);
    cancelAnimationFrame(this.animLoop);
    this.resizeObserver.disconnect();
    this.controls?.dispose();
    this.explore?.dispose();
    this.clearContent();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
