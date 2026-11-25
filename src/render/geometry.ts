// Growable vertex buffers: position (3), uv (2), colour (3), indices.

export interface GeoArrays {
  positions: Float32Array;
  uvs: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
}

export class GeoBuilder {
  private pos = new Float32Array(1024 * 3);
  private uv = new Float32Array(1024 * 2);
  private col = new Float32Array(1024 * 3);
  private idx = new Uint32Array(1024 * 1.5);
  private nv = 0;
  private ni = 0;
  /** Current vertex colour (shade × tint). */
  r = 1;
  g = 1;
  b = 1;

  /**
   * @param uvInset Pulls each quad's UVs inward by this much at its UV bounds, so nearest-filter sampling
   *   never picks the neighbouring atlas tile at face edges (half a texel of the atlas).
   */
  constructor(private readonly uvInset = 0) {}

  get vertexCount(): number {
    return this.nv;
  }

  color(r: number, g: number, b: number): this {
    this.r = r;
    this.g = g;
    this.b = b;
    return this;
  }

  private grow(): void {
    const v = this.pos.length / 3;
    const nPos = new Float32Array(v * 2 * 3);
    nPos.set(this.pos);
    this.pos = nPos;
    const nUv = new Float32Array(v * 2 * 2);
    nUv.set(this.uv);
    this.uv = nUv;
    const nCol = new Float32Array(v * 2 * 3);
    nCol.set(this.col);
    this.col = nCol;
  }

  vertex(x: number, y: number, z: number, u: number, v: number): void {
    if (this.nv * 3 + 3 > this.pos.length) this.grow();
    const p = this.nv * 3;
    this.pos[p] = x;
    this.pos[p + 1] = y;
    this.pos[p + 2] = z;
    this.col[p] = this.r;
    this.col[p + 1] = this.g;
    this.col[p + 2] = this.b;
    const t = this.nv * 2;
    this.uv[t] = u;
    this.uv[t + 1] = v;
    this.nv++;
    // Every 4 vertices form a quad (0,1,2)(0,2,3).
    if ((this.nv & 3) === 0) {
      if (this.ni + 6 > this.idx.length) {
        const n = new Uint32Array(this.idx.length * 2);
        n.set(this.idx);
        this.idx = n;
      }
      const a = this.nv - 4;
      if (this.uvInset > 0) this.insetQuad(a);
      this.idx[this.ni++] = a;
      this.idx[this.ni++] = a + 1;
      this.idx[this.ni++] = a + 2;
      this.idx[this.ni++] = a;
      this.idx[this.ni++] = a + 2;
      this.idx[this.ni++] = a + 3;
    }
  }

  private insetQuad(a: number): void {
    const uv = this.uv;
    const e = this.uvInset;
    for (let axis = 0; axis < 2; axis++) {
      let lo = Infinity;
      let hi = -Infinity;
      for (let k = 0; k < 4; k++) {
        const v = uv[(a + k) * 2 + axis];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      if (hi - lo <= 2 * e) continue;
      for (let k = 0; k < 4; k++) {
        const i = (a + k) * 2 + axis;
        if (uv[i] === lo) uv[i] += e;
        else if (uv[i] === hi) uv[i] -= e;
      }
    }
  }

  build(): GeoArrays {
    return {
      positions: this.pos.slice(0, this.nv * 3),
      uvs: this.uv.slice(0, this.nv * 2),
      colors: this.col.slice(0, this.nv * 3),
      indices: this.idx.slice(0, this.ni),
    };
  }
}
