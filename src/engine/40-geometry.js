// Batched static geometry: every primitive is appended to a (material, chunk) bucket and merged
// into one indexed mesh per bucket, which keeps draw calls low enough for phones.
// Chunks are 400 m squares over the real-map area; buffers are typed and grow as needed.
const CHUNK_SIZE = 400, CHUNK_X0 = -2400, CHUNK_Z0 = -2000;
const _aliasTint = new THREE.Color();
const _v = new THREE.Vector3(), _n = new THREE.Vector3();
// Distance culling (metres from the camera to the mesh's bounding sphere). Set per quality tier at boot.
const CULL_DIST = { base: 1500, detail: 380, far: 3200, props: 260, trees: 520, cars: 230, people: 160 };
const CULLED = [];
function registerCull(root) { root.traverse(o => { if (o.isMesh && o.userData.cull) { if (o.isInstancedMesh) o.computeBoundingSphere(); else o.geometry.computeBoundingSphere?.(); CULLED.push(o); } }); }
function updateCull(cam, scale = 1) {
  const p = cam.position;
  for (const m of CULLED) {
    if (m.userData.dyn) { m.visible = m.parent && Math.hypot(m.matrixWorld.elements[12] - p.x, m.matrixWorld.elements[14] - p.z) < m.userData.cull * scale; continue; }
    const sp = m.isInstancedMesh ? m.boundingSphere : m.geometry.boundingSphere; if (!sp) continue;
    const c = sp.center, d = Math.hypot(c.x - p.x, c.z - p.z) - sp.radius;
    m.visible = d < m.userData.cull * scale;
  }
}
class FBuf {
  constructor(T = Float32Array, n = 256) { this.T = T; this.a = new T(n); this.n = 0; }
  grow(k) { if (this.n + k <= this.a.length) return; let m = this.a.length * 2; while (m < this.n + k) m *= 2; const b = new this.T(m); b.set(this.a.subarray(0, this.n)); this.a = b; }
  push(...v) { this.grow(v.length); for (const x of v) this.a[this.n++] = x; }
  p2(x, y) { this.grow(2); const a = this.a; a[this.n] = x; a[this.n + 1] = y; this.n += 2; }
  p3(x, y, z) { this.grow(3); const a = this.a; a[this.n] = x; a[this.n + 1] = y; a[this.n + 2] = z; this.n += 3; }
  p4(x, y, z, w) { this.grow(4); const a = this.a; a[this.n] = x; a[this.n + 1] = y; a[this.n + 2] = z; a[this.n + 3] = w; this.n += 4; }
  append(o, add = 0) { this.grow(o.n); if (!add) this.a.set(o.a.subarray(0, o.n), this.n); else for (let i = 0; i < o.n; i++) this.a[this.n + i] = o.a[i] + add; this.n += o.n; }
  view() { return this.a.subarray(0, this.n); }
  get length() { return this.n; }
}

class GeoBuilder {
  constructor(lib) {
    this.lib = lib; this.buckets = new Map();
    this.mat = null; this.nmat = new THREE.Matrix3();
    this.tint = [1, 1, 1];
    this.cls = 'base'; // cull class: 'base' (ground, walls, roofs), 'detail' (windows, fences, kerbs, signs), 'far' (context ring)
  }
  setTransform(m) { this.mat = m; if (m) this.nmat.getNormalMatrix(m); }
  setTint(c) { this.tint = c ? [c.r, c.g, c.b] : [1, 1, 1]; }
  bucket(key, x, z) {
    // Ground, walls and roofs batch into 800 m chunks; small detail into 400 m chunks (culled sooner).
    const far = this.cls === 'far', cs = this.cls === 'base' ? CHUNK_SIZE * 2 : CHUNK_SIZE;
    const ci = far ? 0 : clamp(Math.floor((x - CHUNK_X0) / cs), 0, 15), cj = far ? 0 : clamp(Math.floor((z - CHUNK_Z0) / cs), 0, 15);
    const id = key + '|' + this.cls + '|' + ci + '|' + cj;
    let b = this.buckets.get(id);
    if (!b) { b = { key, cls: this.cls, pos: new FBuf(), nor: new FBuf(), uv: new FBuf(), col: new FBuf(), win: key === 'glass' ? new FBuf() : null, idx: new FBuf(Uint32Array), n: 0 }; this.buckets.set(id, b); }
    return b;
  }
  // Pre-triangulated horizontal mesh (map surface layers): xz pairs + indices, metre UVs, flat normal.
  triangles(key, V, I, y, tint, cx, cz) {
    const b = this.bucket(MAT_DEFS[key]?.alias || key, cx, cz), s = this.lib.scale(key), base = b.n;
    let t = tint || [1, 1, 1];
    if (MAT_DEFS[key]?.alias) { _aliasTint.set(MAT_DEFS[key].tint ?? 0xffffff); t = [t[0] * _aliasTint.r, t[1] * _aliasTint.g, t[2] * _aliasTint.b]; }
    for (let i = 0; i < V.length; i += 2) { b.pos.p3(V[i], y, V[i + 1]); b.nor.p3(0, 1, 0); b.uv.p2(V[i] / s, -V[i + 1] / s); b.col.p3(t[0], t[1], t[2]); }
    // earcut output winds either way; make every triangle face up.
    for (let i = 0; i < I.length; i += 3) {
      const a = I[i], c = I[i + 1], d = I[i + 2];
      const cr = (V[2 * c] - V[2 * a]) * (V[2 * d + 1] - V[2 * a + 1]) - (V[2 * c + 1] - V[2 * a + 1]) * (V[2 * d] - V[2 * a]);
      if (cr < 0) b.idx.p3(base + a, base + c, base + d); else b.idx.p3(base + a, base + d, base + c);
    }
    b.n += V.length / 2;
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
      b.pos.p3(_v.x, _v.y, _v.z); b.nor.p3(_n.x, _n.y, _n.z);
      b.uv.p2(uv[i * 2], uv[i * 2 + 1]);
      const a = ao ? ao[i] : 1;
      b.col.p3(t[0] * a, t[1] * a, t[2] * a);
      if (b.win) b.win.p4(win ? win[0] : 0, win ? win[1] : 1, win ? win[2] : 1, win ? win[3] : 0);
    }
    if (pts.length === 4) { b.idx.p3(base, base + 1, base + 2); b.idx.p3(base, base + 2, base + 3); }
    else for (let i = 1; i < pts.length - 1; i++) b.idx.p3(base, base + i, base + i + 1);
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
      const mk = b.key + '|' + b.cls, m = merged.get(mk);
      if (!m) { merged.set(mk, b); continue; }
      for (const k of ['pos', 'nor', 'uv', 'col']) m[k].append(b[k]);
      if (m.win) m.win.append(b.win);
      m.idx.append(b.idx, m.n);
      m.n += b.n;
    }
    this.buckets = merged;
    const meshes = [];
    for (const b of this.buckets.values()) {
      if (!b.n) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(b.pos.view().slice(), 3));
      g.setAttribute('normal', new THREE.BufferAttribute(b.nor.view().slice(), 3));
      g.setAttribute('uv', new THREE.BufferAttribute(b.uv.view().slice(), 2));
      g.setAttribute('color', new THREE.BufferAttribute(b.col.view().slice(), 3));
      if (b.win) g.setAttribute('aWin', new THREE.BufferAttribute(b.win.view().slice(), 4));
      g.setIndex(b.n > 65535 ? new THREE.BufferAttribute(b.idx.view().slice(), 1) : new THREE.BufferAttribute(Uint16Array.from(b.idx.view()), 1));
      g.computeBoundingSphere(); g.computeBoundingBox();
      const material = this.lib.get(b.key);
      const mesh = new THREE.Mesh(g, material);
      mesh.castShadow = material.userData.cast; mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      mesh.userData.cull = CULL_DIST[b.cls] ?? 1500;
      scene.add(mesh); meshes.push(mesh);
    }
    this.buckets.clear();
    return meshes;
  }
}

// Spatial hash over mixed shapes: boxes, rotated boxes, circles, wall segments and building outlines.
// collides(x, z, r) asks whether a circle of radius r at (x, z) touches anything solid.
class CollisionGrid {
  constructor(cell = 8) { this.cell = cell; this.cells = new Map(); this.list = []; this.stamp = 0; }
  key(i, j) { return i * 4096 + j; }
  insert(o, x0, z0, x1, z1) {
    const c = this.cell; this.list.push(o);
    for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++)
      for (let j = Math.floor(z0 / c); j <= Math.floor(z1 / c); j++) { const k = this.key(i, j); let a = this.cells.get(k); if (!a) this.cells.set(k, a = []); a.push(o); }
    return o;
  }
  add(x, z, w, d, tag) { return this.insert({ t: 0, x, z, w, d, tag, mark: 0 }, x - w / 2, z - d / 2, x + w / 2, z + d / 2); }
  addCircle(x, z, r, tag) { return this.insert({ t: 1, x, z, r, tag, mark: 0 }, x - r, z - r, x + r, z + r); }
  addSeg(ax, az, bx, bz, th, tag) { return this.insert({ t: 2, ax, az, bx, bz, th, tag, mark: 0 }, Math.min(ax, bx) - th, Math.min(az, bz) - th, Math.max(ax, bx) + th, Math.max(az, bz) + th); }
  addOBB(x, z, hw, hd, ang, tag) { const c = Math.cos(ang), s = Math.sin(ang), ex = Math.abs(c * hw) + Math.abs(s * hd), ez = Math.abs(s * hw) + Math.abs(c * hd); return this.insert({ t: 3, x, z, hw, hd, c, s, tag, mark: 0 }, x - ex, z - ez, x + ex, z + ez); }
  addPoly(ring, tag) { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const p of ring) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); } return this.insert({ t: 4, ring, tag, mark: 0, x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0 }, x0, z0, x1, z1); }
  hit(o, x, z, r) {
    switch (o.t) {
      case 0: return Math.abs(x - o.x) < o.w / 2 + r && Math.abs(z - o.z) < o.d / 2 + r;
      case 1: return (x - o.x) ** 2 + (z - o.z) ** 2 < (o.r + r) ** 2;
      case 2: return segDist2(x, z, o.ax, o.az, o.bx, o.bz) < (o.th + r) ** 2;
      case 3: { const dx = x - o.x, dz = z - o.z, u = dx * o.c + dz * o.s, v = -dx * o.s + dz * o.c; return Math.abs(u) < o.hw + r && Math.abs(v) < o.hd + r; }
      default: {
        const R = o.ring; let inside = false;
        for (let i = 0, j = R.length - 1; i < R.length; j = i++) {
          const a = R[i], b = R[j];
          if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
          if (segDist2(x, z, a[0], a[1], b[0], b[1]) < r * r) return true;
        }
        return inside;
      }
    }
  }
  collides(x, z, r = 0.55) {
    const c = this.cell, st = ++this.stamp;
    for (let i = Math.floor((x - r) / c); i <= Math.floor((x + r) / c); i++)
      for (let j = Math.floor((z - r) / c); j <= Math.floor((z + r) / c); j++) {
        const a = this.cells.get(this.key(i, j)); if (!a) continue;
        for (const o of a) { if (o.mark === st) continue; o.mark = st; if (this.hit(o, x, z, r)) return true; }
      }
    return false;
  }
}
function segDist2(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L));
  const ex = px - ax - dx * t, ez = pz - az - dz * t; return ex * ex + ez * ez;
}

// Street geometry rules shared by the builder, ground height and props. NZ kerbs are about 150 mm.
const ROAD = { kerbH: 0.15 };
// Ground classes rasterised by the city at 0.5 m: 0 = land (kerb height), 1 = carriageway, 2 = platform.
const GROUND = { x0: 0, z0: 0, res: 0.5, w: 0, h: 0, d: null, platform: 0.95 };
function groundClass(x, z) {
  if (!GROUND.d) return 0;
  const i = Math.floor((x - GROUND.x0) / GROUND.res), j = Math.floor((z - GROUND.z0) / GROUND.res);
  return i < 0 || j < 0 || i >= GROUND.w || j >= GROUND.h ? 0 : GROUND.d[j * GROUND.w + i];
}
function isCarriageway(x, z) { return groundClass(x, z) === 1; }
function groundHeight(x, z) { const c = groundClass(x, z); return c === 1 ? 0 : c === 2 ? GROUND.platform : ROAD.kerbH; }
