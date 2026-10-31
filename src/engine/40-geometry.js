// Batched static geometry: every primitive is appended to a (material, chunk) bucket and merged
// into one indexed mesh per bucket, which keeps draw calls low enough for phones.
const WORLD_HALF = 275, CHUNKS = 3, CHUNK_SIZE = WORLD_HALF * 2 / CHUNKS;
const _aliasTint = new THREE.Color();
const _v = new THREE.Vector3(), _n = new THREE.Vector3();

class GeoBuilder {
  constructor(lib) {
    this.lib = lib; this.buckets = new Map();
    this.mat = null; this.nmat = new THREE.Matrix3();
    this.tint = [1, 1, 1];
  }
  setTransform(m) { this.mat = m; if (m) this.nmat.getNormalMatrix(m); }
  setTint(c) { this.tint = c ? [c.r, c.g, c.b] : [1, 1, 1]; }
  bucket(key, x, z) {
    const ci = clamp(Math.floor((x + WORLD_HALF) / CHUNK_SIZE), 0, CHUNKS - 1);
    const cj = clamp(Math.floor((z + WORLD_HALF) / CHUNK_SIZE), 0, CHUNKS - 1);
    const id = key + '|' + ci + '|' + cj;
    let b = this.buckets.get(id);
    if (!b) { b = { key, pos: [], nor: [], uv: [], col: [], win: key === 'glass' ? [] : null, idx: [], n: 0 }; this.buckets.set(id, b); }
    return b;
  }
  // Rectangle from origin o, spanning w along unit axis u and h along unit axis v. Normal = u x v.
  // UVs are metres (offset by uv0) divided by the material's tile scale.
  rect(key, o, u, v, w, h, opt = {}) {
    const s = opt.uvScale ?? this.lib.scale(key);
    const u0 = opt.uv0 ? opt.uv0[0] : 0, v0 = opt.uv0 ? opt.uv0[1] : 0;
    const p = [
      [o[0], o[1], o[2]],
      [o[0] + u[0] * w, o[1] + u[1] * w, o[2] + u[2] * w],
      [o[0] + u[0] * w + v[0] * h, o[1] + u[1] * w + v[1] * h, o[2] + u[2] * w + v[2] * h],
      [o[0] + v[0] * h, o[1] + v[1] * h, o[2] + v[2] * h],
    ];
    const uv = opt.uv || [u0 / s, v0 / s, (u0 + w) / s, v0 / s, (u0 + w) / s, (v0 + h) / s, u0 / s, (v0 + h) / s];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    this.poly(key, p, n, uv, opt.ao, opt.win, opt.tint);
  }
  tri(key, a, b, c, uv, tint) {
    const n = new THREE.Vector3().subVectors(new THREE.Vector3(...b), new THREE.Vector3(...a))
      .cross(new THREE.Vector3().subVectors(new THREE.Vector3(...c), new THREE.Vector3(...a))).normalize();
    this.poly(key, [a, b, c], [n.x, n.y, n.z], uv, null, null, tint);
  }
  poly(key, pts, n, uv, ao, win, tint) {
    const m = this.mat, alias = MAT_DEFS[key]?.alias;
    if (alias) {
      const t0 = tint ? (tint.isColor ? [tint.r, tint.g, tint.b] : tint) : this.tint;
      _aliasTint.set(MAT_DEFS[key].tint ?? 0xffffff);
      tint = [t0[0] * _aliasTint.r, t0[1] * _aliasTint.g, t0[2] * _aliasTint.b];
      key = alias;
    }
    let fx = pts[0][0], fz = pts[0][2];
    if (m) { _v.set(fx, pts[0][1], fz).applyMatrix4(m); fx = _v.x; fz = _v.z; }
    const b = this.bucket(key, fx, fz);
    _n.set(n[0], n[1], n[2]); if (m) _n.applyMatrix3(this.nmat); _n.normalize();
    const t = tint ? (tint.isColor ? [tint.r, tint.g, tint.b] : tint) : this.tint, base = b.n;
    for (let i = 0; i < pts.length; i++) {
      _v.set(pts[i][0], pts[i][1], pts[i][2]); if (m) _v.applyMatrix4(m);
      b.pos.push(_v.x, _v.y, _v.z); b.nor.push(_n.x, _n.y, _n.z);
      b.uv.push(uv[i * 2], uv[i * 2 + 1]);
      const a = ao ? ao[i] : 1;
      b.col.push(t[0] * a, t[1] * a, t[2] * a);
      if (b.win) b.win.push(win ? win[0] : 0, win ? win[1] : 1, win ? win[2] : 1, win ? win[3] : 0);
    }
    if (pts.length === 4) b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    else for (let i = 1; i < pts.length - 1; i++) b.idx.push(base, base + i, base + i + 1);
    b.n += pts.length;
  }
  // Axis-aligned box (in the current transform). faces: string of letters to include (px nx py ny pz nz -> 'XxYyZz').
  box(key, cx, cy, cz, sx, sy, sz, opt = {}) {
    const f = opt.faces || 'XxYyZz', hx = sx / 2, hz = sz / 2, y0 = cy, y1 = cy + sy;
    const ao = opt.aoBottom != null ? [opt.aoBottom, opt.aoBottom, 1, 1] : null;
    const o = { ...opt, ao };
    if (f.includes('Z')) this.rect(key, [cx - hx, y0, cz + hz], [1, 0, 0], [0, 1, 0], sx, sy, { ...o, uv0: [cx - hx, y0] });
    if (f.includes('z')) this.rect(key, [cx + hx, y0, cz - hz], [-1, 0, 0], [0, 1, 0], sx, sy, { ...o, uv0: [-(cx + hx), y0] });
    if (f.includes('X')) this.rect(key, [cx + hx, y0, cz + hz], [0, 0, -1], [0, 1, 0], sz, sy, { ...o, uv0: [-(cz + hz), y0] });
    if (f.includes('x')) this.rect(key, [cx - hx, y0, cz - hz], [0, 0, 1], [0, 1, 0], sz, sy, { ...o, uv0: [cz - hz, y0] });
    if (f.includes('Y')) this.rect(key, [cx - hx, y1, cz + hz], [1, 0, 0], [0, 0, -1], sx, sz, { ...opt, uv0: [cx - hx, -(cz + hz)] });
    if (f.includes('y')) this.rect(key, [cx - hx, y0, cz - hz], [1, 0, 0], [0, 0, 1], sx, sz, { ...opt, uv0: [cx - hx, cz - hz] });
  }
  // Tapered vertical cylinder (poles, trunks, bollards) with metre UVs around the circumference.
  cylinder(key, x, y, z, r0, r1, h, seg = 8, opt = {}) {
    const s = opt.uvScale ?? this.lib.scale(key), circ = TAU * Math.max(r0, r1);
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * TAU, a1 = (i + 1) / seg * TAU;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      const p = [[x + c0 * r0, y, z + s0 * r0], [x + c1 * r0, y, z + s1 * r0], [x + c1 * r1, y + h, z + s1 * r1], [x + c0 * r1, y + h, z + s0 * r1]];
      const am = (a0 + a1) / 2, u0 = i / seg * circ / s, u1 = (i + 1) / seg * circ / s;
      this.poly(key, p.reverse(), [Math.cos(am), 0, Math.sin(am)], [u0, h / s, u1, h / s, u1, 0, u0, 0], opt.ao ? [1, 1, opt.ao, opt.ao] : null, null, opt.tint);
    }
    if (opt.cap) {
      const pts = [];
      for (let i = seg - 1; i >= 0; i--) { const a = i / seg * TAU; pts.push([x + Math.cos(a) * r1, y + h, z + Math.sin(a) * r1]); }
      this.poly(key, pts, [0, 1, 0], pts.flatMap(p => [p[0] / s, p[2] / s]), null, null, opt.tint);
    }
  }
  finish(scene) {
    // Materials with little geometry are merged across chunks: fewer draw calls beats finer culling.
    const totals = {};
    for (const b of this.buckets.values()) totals[b.key] = (totals[b.key] || 0) + b.n;
    const merged = new Map();
    for (const [id, b] of this.buckets) {
      if (totals[b.key] > 24000) { merged.set(id, b); continue; }
      const m = merged.get(b.key);
      if (!m) { merged.set(b.key, b); continue; }
      for (const k of ['pos', 'nor', 'uv', 'col']) for (const v of b[k]) m[k].push(v);
      if (m.win) for (const v of b.win) m.win.push(v);
      for (const i of b.idx) m.idx.push(i + m.n);
      m.n += b.n;
    }
    this.buckets = merged;
    const meshes = [];
    for (const b of this.buckets.values()) {
      if (!b.n) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
      if (b.win) g.setAttribute('aWin', new THREE.Float32BufferAttribute(b.win, 4));
      g.setIndex(b.n > 65535 ? new THREE.Uint32BufferAttribute(b.idx, 1) : new THREE.Uint16BufferAttribute(b.idx, 1));
      g.computeBoundingSphere(); g.computeBoundingBox();
      const material = this.lib.get(b.key);
      const mesh = new THREE.Mesh(g, material);
      mesh.castShadow = material.userData.cast; mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      scene.add(mesh); meshes.push(mesh);
    }
    this.buckets.clear();
    return meshes;
  }
}

// Spatial hash over axis-aligned boxes {x, z, w, d}. Same semantics as the original obstacle list.
class CollisionGrid {
  constructor(cell = 8) { this.cell = cell; this.cells = new Map(); this.list = []; this.stamp = 0; }
  key(i, j) { return i * 4096 + j; }
  add(x, z, w, d, tag) {
    const o = { x, z, w, d, tag, mark: 0 }; this.list.push(o);
    const c = this.cell;
    for (let i = Math.floor((x - w / 2) / c); i <= Math.floor((x + w / 2) / c); i++)
      for (let j = Math.floor((z - d / 2) / c); j <= Math.floor((z + d / 2) / c); j++) {
        const k = this.key(i, j); let a = this.cells.get(k); if (!a) this.cells.set(k, a = []); a.push(o);
      }
    return o;
  }
  collides(x, z, r = 0.55) {
    const c = this.cell;
    for (let i = Math.floor((x - r) / c); i <= Math.floor((x + r) / c); i++)
      for (let j = Math.floor((z - r) / c); j <= Math.floor((z + r) / c); j++) {
        const a = this.cells.get(this.key(i, j)); if (!a) continue;
        for (const o of a) if (Math.abs(x - o.x) < o.w / 2 + r && Math.abs(z - o.z) < o.d / 2 + r) return true;
      }
    return false;
  }
}

// Street geometry rules shared by the builder, ground height and props.
const ROAD = { spacing: 55, count: 4, half: 5.5, kerb: 0.3, reserve: 9.5, kerbH: 0.14, corner: 3.2, plaza: 34 };
function nearestLine(v) { const i = clamp(Math.round(v / ROAD.spacing), -ROAD.count, ROAD.count); return { i, d: v - i * ROAD.spacing }; }
// True where the surface is carriageway (y = 0): straight roads plus rounded kerb returns, minus the pedestrian plaza.
function isCarriageway(x, z) {
  if (Math.abs(x) > 226.5 + 30 || Math.abs(z) > 226.5 + 30) return false;
  if (Math.hypot(x, z) < ROAD.plaza) return false;
  const lx = nearestLine(x), lz = nearestLine(z);
  const ax = Math.abs(lx.d), az = Math.abs(lz.d), H = ROAD.half, R = ROAD.corner;
  if (ax < H || az < H) return true;
  if (ax < H + R && az < H + R) return Math.hypot(ax - (H + R), az - (H + R)) > R;
  return false;
}
function groundHeight(x, z) { return isCarriageway(x, z) ? 0 : ROAD.kerbH; }
