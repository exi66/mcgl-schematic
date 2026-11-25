// First-person exploration: walk with gravity and block collision, or fly through blocks.
// Pointer lock for mouse look; WASD move, Space jump / up, Shift sneak / down, double Space toggles flying,
// double W sprints, wheel changes flight speed.

import * as THREE from 'three';

const EYE = 1.62;
const HALF_W = 0.3;
const HEIGHT = 1.8;
const GRAVITY = 32;
const JUMP_V = 9;
const WALK = 4.3;
const SPRINT = 5.6;
const SNEAK = 1.3;

export interface ExploreWorld {
  /** Solid block at a cell (walk mode collides with these). */
  solid(x: number, y: number, z: number): boolean;
  /** Floor height for cells outside the schematic (the grid plane). */
  floorY: number;
}

export class ExploreControls {
  yaw = 0; // radians, 0 looks toward −Z
  pitch = 0;
  flying = true;
  flySpeed = 10;
  private readonly pos = new THREE.Vector3(); // feet position
  private vel = new THREE.Vector3();
  private onGround = false;
  private readonly keys = new Set<string>();
  private lastSpace = 0;
  private lastForward = 0;
  private sprint = false;
  private locked = false;
  private readonly cleanup: (() => void)[] = [];
  onChange?: () => void;
  onLockChange?: (locked: boolean) => void;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly dom: HTMLElement,
    private readonly world: ExploreWorld,
  ) {
    const on = <K extends keyof DocumentEventMap>(t: K, f: (e: DocumentEventMap[K]) => void) => {
      document.addEventListener(t, f);
      this.cleanup.push(() => document.removeEventListener(t, f));
    };
    const click = () => {
      if (!this.locked) this.dom.requestPointerLock?.();
    };
    this.dom.addEventListener('click', click);
    this.cleanup.push(() => this.dom.removeEventListener('click', click));
    on('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
      if (!this.locked) this.keys.clear();
      this.onLockChange?.(this.locked);
    });
    on('mousemove', (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * 0.0025;
      this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch - e.movementY * 0.0025));
      this.apply();
    });
    on('keydown', (e) => {
      if (!this.locked) return;
      const k = e.code;
      if (k === 'Space' && !e.repeat) {
        const now = performance.now();
        if (now - this.lastSpace < 300) {
          this.flying = !this.flying;
          this.vel.set(0, 0, 0);
          this.onChange?.();
        } else if (!this.flying && this.onGround) {
          this.vel.y = JUMP_V;
        }
        this.lastSpace = now;
      }
      if (k === 'KeyW' && !e.repeat) {
        const now = performance.now();
        if (now - this.lastForward < 300) this.sprint = true;
        this.lastForward = now;
      }
      this.keys.add(k);
      if (k === 'Space' || k.startsWith('Arrow')) e.preventDefault();
    });
    on('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'KeyW') this.sprint = false;
    });
    const wheel = (e: WheelEvent) => {
      if (!this.locked) return;
      e.preventDefault();
      this.flySpeed = Math.max(2, Math.min(100, this.flySpeed * (e.deltaY > 0 ? 0.85 : 1.18)));
    };
    this.dom.addEventListener('wheel', wheel, { passive: false });
    this.cleanup.push(() => this.dom.removeEventListener('wheel', wheel));
  }

  get isLocked(): boolean {
    return this.locked;
  }

  /** Starts from the current camera pose. */
  placeFromCamera(): void {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    this.yaw = Math.atan2(-dir.x, -dir.z);
    this.pitch = Math.asin(Math.max(-1, Math.min(1, dir.y)));
    this.pos.copy(this.camera.position).y -= EYE;
    this.vel.set(0, 0, 0);
    this.flying = true;
    this.apply();
  }

  lock(): void {
    this.dom.requestPointerLock?.();
  }

  unlock(): void {
    if (document.pointerLockElement === this.dom) document.exitPointerLock();
  }

  private apply(): void {
    this.camera.position.set(this.pos.x, this.pos.y + EYE, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.updateMatrixWorld();
    this.onChange?.();
  }

  /** Advances by dt seconds; returns true if anything moved. */
  update(dt: number): boolean {
    if (!this.locked) return false;
    dt = Math.min(dt, 0.05);
    const k = this.keys;
    const f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const s = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = fwd.multiplyScalar(f).add(right.multiplyScalar(s));
    if (wish.lengthSq() > 0) wish.normalize();
    const before = this.pos.clone();
    if (this.flying) {
      const up = (k.has('Space') ? 1 : 0) - (k.has('ShiftLeft') || k.has('ShiftRight') ? 1 : 0);
      const speed = this.flySpeed * (this.sprint ? 2 : 1);
      this.pos.addScaledVector(wish, speed * dt);
      this.pos.y += up * speed * dt;
    } else {
      const sneak = k.has('ShiftLeft') || k.has('ShiftRight');
      const speed = sneak ? SNEAK : this.sprint ? SPRINT : WALK;
      this.vel.x = wish.x * speed;
      this.vel.z = wish.z * speed;
      this.vel.y -= GRAVITY * dt;
      this.moveAxis(0, this.vel.x * dt, sneak);
      this.moveAxis(2, this.vel.z * dt, sneak);
      this.onGround = false;
      if (!this.moveAxis(1, this.vel.y * dt, false)) {
        if (this.vel.y < 0) this.onGround = true;
        this.vel.y = 0;
      }
    }
    const moved = !before.equals(this.pos);
    if (moved) this.apply();
    return moved;
  }

  private collides(p: THREE.Vector3): boolean {
    if (p.y < this.world.floorY) return true;
    const x0 = Math.floor(p.x - HALF_W),
      x1 = Math.floor(p.x + HALF_W - 1e-6);
    const y0 = Math.floor(p.y),
      y1 = Math.floor(p.y + HEIGHT - 1e-6);
    const z0 = Math.floor(p.z - HALF_W),
      z1 = Math.floor(p.z + HALF_W - 1e-6);
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if (this.world.solid(x, y, z)) return true;
    return false;
  }

  /** Moves along one axis in small steps; returns false if blocked. Sneaking keeps you from walking off edges. */
  private moveAxis(axis: 0 | 1 | 2, delta: number, sneak: boolean): boolean {
    if (delta === 0) return true;
    const steps = Math.ceil(Math.abs(delta) / 0.1);
    const d = delta / steps;
    const p = this.pos.clone();
    for (let i = 0; i < steps; i++) {
      const next = p.clone();
      next.setComponent(axis, p.getComponent(axis) + d);
      if (this.collides(next)) {
        // Step up half blocks and slabs while walking.
        if (axis !== 1) {
          const up = next.clone();
          up.y += 0.55;
          if (this.onGroundAt(p) && !this.collides(up)) {
            p.copy(up);
            continue;
          }
        }
        this.pos.copy(p);
        return false;
      }
      if (sneak && axis !== 1 && this.onGroundAt(p) && !this.onGroundAt(next)) {
        this.pos.copy(p);
        return false;
      }
      p.copy(next);
    }
    this.pos.copy(p);
    return true;
  }

  private onGroundAt(p: THREE.Vector3): boolean {
    const below = p.clone();
    below.y -= 0.05;
    return this.collides(below);
  }

  dispose(): void {
    this.unlock();
    for (const c of this.cleanup) c();
  }
}
