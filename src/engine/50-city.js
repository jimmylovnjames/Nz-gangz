// Real district: Manurewa and Clendon Park, South Auckland, built from OpenStreetMap data (MAPDATA).
// Local metres: x east, z south (north is -z). Ground: carriageway at y = 0, everything else at kerb
// height, with footpaths, driveways, car parks and courts drawn as decals on the land.
const PLAZA = 0;
const BAND = { kerbTop: 0.3, footpath: 1.6 };
const MAP_BOUNDS = { x0: MAPDATA.meta.crop.x0 + 6, x1: MAPDATA.meta.crop.x1 - 6, z0: MAPDATA.meta.crop.z0 + 6, z1: MAPDATA.meta.crop.z1 - 6 };
const BT = { house: 0, shed: 1, garage: 2, shop: 3, mall: 4, bigbox: 5, warehouse: 6, school: 7, church: 8, civic: 9, canopy: 10, apartments: 11, station: 12, fastfood: 13 };
const HOUSE_PAINT = [0xf2efe6, 0xe8e1cf, 0xd7d2c4, 0xc3d0d4, 0xd9cfb2, 0xb8c4b0, 0xe6d3b8, 0xa8b8c4, 0xcfc6b6, 0x9ea89c, 0xf0e6d0, 0xe9e4da];
const BRICK_TINT = [0xffffff, 0xf0d8c0, 0xd8b098, 0xe8dcc8, 0xc89880, 0xfff0dc];
const ROOF_TINT = [0x3a3d40, 0x3a3d40, 0x2c2f33, 0x6e2a22, 0x7a3a2a, 0x5a4232, 0x3f5040, 0x5d6468, 0x8a8f90, 0x4a4f55];
const DOOR_PAINT = [0x8b2a22, 0x2a4a6a, 0x2f5a3a, 0x6a4a2a, 0x222222, 0xe0c060, 0xd8d0c0];
const col = hex => new THREE.Color(hex);
const tintOf = hex => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
let WINDOW_SEED = 1;

// ---------------------------------------------------------------- decoding
function b64(s, T) { const bin = atob(s), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return new T(u8.buffer); }
function dec16(s) { const a = b64(s, Int16Array), f = new Float32Array(a.length); for (let i = 0; i < a.length; i++) f[i] = a[i] / 10; return f; }
function decList(L, T = Uint32Array) { const n = b64(L.n, T), v = dec16(L.v), out = []; let o = 0; for (const c of n) { const pts = []; for (let k = 0; k < c; k++) pts.push([v[2 * (o + k)], v[2 * (o + k) + 1]]); out.push(pts); o += c; } return out; }
const ringArea = r => { let a = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
function pointInRing(p, r) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const a = r[i], b = r[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }

// Sign atlases: one cell per unique text, drawn once on a canvas.
class SignAtlas {
  constructor(entries, cellW = 512, cellH = 64, style = () => ({})) {
    this.cols = 4; this.cellW = cellW; this.cellH = cellH; this.index = new Map();
    const uniq = [...new Set(entries)];
    const rows = Math.ceil(uniq.length / this.cols) || 1;
    let H = 64; while (H < rows * cellH) H *= 2; H = Math.min(H, 4096);
    this.W = cellW * this.cols; this.H = H;
    const c = document.createElement('canvas'); c.width = this.W; c.height = H;
    const g = c.getContext('2d');
    uniq.forEach((text, i) => {
      const x = (i % this.cols) * cellW, y = Math.floor(i / this.cols) * cellH; if (y + cellH > H) return;
      const st = style(text);
      g.fillStyle = st.bg || '#1f4a33'; g.fillRect(x, y, cellW, cellH);
      if (st.stripe) { g.fillStyle = st.stripe; g.fillRect(x, y + cellH - 10, cellW, 10); }
      g.fillStyle = st.fg || '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      let size = st.size || 40; g.font = `bold ${size}px "Arial Narrow", "Roboto Condensed", Arial, sans-serif`;
      while (g.measureText(text).width > cellW - 24 && size > 14) { size -= 2; g.font = `bold ${size}px "Arial Narrow", "Roboto Condensed", Arial, sans-serif`; }
      g.fillText(text, x + cellW / 2, y + cellH / 2 + 2);
      if (st.border) { g.strokeStyle = st.border; g.lineWidth = 4; g.strokeRect(x + 4, y + 4, cellW - 8, cellH - 8); }
      this.index.set(text, i);
    });
    this.tex = new THREE.CanvasTexture(c); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 8;
    this.tex.generateMipmaps = true; this.tex.minFilter = THREE.LinearMipmapLinearFilter;
  }
  uv(text) {
    const i = this.index.get(text) ?? 0, x = (i % this.cols) * this.cellW, y = Math.floor(i / this.cols) * this.cellH;
    const u0 = (x + 2) / this.W, u1 = (x + this.cellW - 2) / this.W, v1 = 1 - (y + 2) / this.H, v0 = 1 - (y + this.cellH - 2) / this.H;
    return [u0, v0, u1, v0, u1, v1, u0, v1];
  }
}
const SIGN_STYLE = {
  bigyellow: { bg: '#f5d000', fg: '#111111', size: 46 }, bigred: { bg: '#d4161c', fg: '#ffffff', size: 46 }, red: { bg: '#b3151b', fg: '#ffffff' }, gold: { bg: '#c8102e', fg: '#ffc72c' },
  darkred: { bg: '#5a0f14', fg: '#f6e7c8' }, green: { bg: '#0f5a32', fg: '#ffffff' }, blue: { bg: '#123f8c', fg: '#ffffff' }, purple: { bg: '#3a1f5a', fg: '#ffffff' },
  mall: { bg: '#f1ece0', fg: '#1d3f73', size: 52, stripe: '#d1342b' }, civic: { bg: '#2a2a2a', fg: '#f3e2b0' }, police: { bg: '#0a2a6a', fg: '#ffffff', stripe: '#ffffff' }, church: { bg: '#f4f1ea', fg: '#3a2a1a' },
};
const LOCAL_SIGN_BG = ['#1d3b5c', '#7a1f1f', '#f2e7c9', '#1f4a33', '#e8b82a', '#222222', '#f4f1ea', '#5a2a5a', '#0f5a6a', '#b4471f', '#c8102e', '#ffffff'];
function signStyle(text, styleKey) {
  if (SIGN_STYLE[styleKey]) return SIGN_STYLE[styleKey];
  let h = 0; for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const bg = LOCAL_SIGN_BG[h % LOCAL_SIGN_BG.length], light = ['#f2e7c9', '#e8b82a', '#f4f1ea', '#ffffff'].includes(bg);
  return { bg, fg: light ? '#1a1a1a' : '#f6f1e2', border: light ? '#00000022' : '#ffffff30' };
}

class City {
  constructor(lib, scene, quality) {
    this.lib = lib; this.scene = scene; this.q = quality;
    this.b = new GeoBuilder(lib);
    this.collision = new CollisionGrid(8);
    this.rng = mulberry32(20261101);
    this.lights = []; this.cars = []; this.trees = []; this.poles = []; this.instances = {};
    this.signs = []; this.houses = []; this.spots = []; this.places = {};
  }
  r(a = 0, b = 1) { return a + (b - a) * this.rng(); }
  pick(arr) { return arr[Math.floor(this.rng() * arr.length)]; }
  inst(kind, p) { (this.instances[kind] = this.instances[kind] || []).push(p); }
  // Seeded per-object randomness so a building looks the same every run.
  hash(i, k = 0) { let h = (i * 374761393 + k * 668265263) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

  async build(progress = () => { }) {
    const M = MAPDATA, kh = ROAD.kerbH;
    this.decode();
    progress(0.05);
    // ---- ground layers
    const LAYER = {
      road: ['asphalt', 0, [0.92, 0.92, 0.92]], grass: ['grass', kh, [1, 1, 1]], kerb: ['kerbTop', kh, [0.95, 0.95, 0.93]], foot: ['path', kh, [1, 1, 1]], paved: ['patch', kh, [0.9, 0.9, 0.9]],
      paved2: ['patch', kh, [1.08, 1.06, 1.04]], drive: ['drive', kh, [1.05, 1.03, 1.0]], path: ['path', kh, [1.02, 1.0, 0.96]], court: ['court', kh, [1, 1, 1]], skate: ['path', kh, [1.12, 1.12, 1.12]],
      pool: ['water', kh, [0.25, 0.75, 0.95]], water: ['water', kh - 0.02, [0.2, 0.3, 0.32]], bark: ['yard', kh, [0.75, 0.55, 0.4]], dirt: ['yard', kh, [0.85, 0.7, 0.55]], rail: ['yard', kh, [0.7, 0.66, 0.62]], platform: ['path', GROUND.platform, [1, 1, 1]],
    };
    for (const [name, tiles] of Object.entries(M.layers)) {
      const L = LAYER[name]; if (!L) continue;
      for (const t of tiles) this.b.triangles(L[0], dec16(t.v), b64(t.i, Uint16Array), L[1], L[2], t.x + 100, t.z + 100);
    }
    this.rasterGround(); progress(0.15); await nextTick();
    this.b.cls = 'detail'; this.kerbs(); this.markings(); this.b.cls = 'base'; progress(0.22); await nextTick();
    // ---- buildings
    const B = this.map.buildings;
    for (let i = 0; i < B.length; i++) { this.building(i); if (i % 900 === 899) { progress(0.22 + 0.45 * i / B.length); await nextTick(); } }
    progress(0.7); await nextTick();
    this.b.cls = 'detail'; this.fences(); progress(0.8); await nextTick();
    this.furniture(); this.b.cls = 'base'; this.platforms(); this.landmarks(); this.b.cls = 'far'; this.farContext(); this.b.cls = 'base';
    this.storySpots();
    progress(1);
  }
  finish() { this.meshes = this.b.finish(this.scene); }

  decode() {
    const M = MAPDATA, m = this.map = {};
    const rings = decList(M.buildings, Uint16Array), type = b64(M.buildings.type, Uint16Array), lv = b64(M.buildings.lv, Uint16Array), fe = b64(M.buildings.fe, Uint16Array), ver = b64(M.buildings.ver, Uint16Array);
    m.buildings = rings.map((ring, i) => {
      if (ringArea(ring) < 0) ring.reverse();
      const c = ring.reduce((s, p) => [s[0] + p[0] / ring.length, s[1] + p[1] / ring.length], [0, 0]);
      return { i, ring, c, type: type[i], levels: lv[i], fe: fe[i] % ring.length, ver: ver[i] / 10, roof: M.buildings.roofs[i], name: M.buildings.names[i] || '', area: Math.abs(ringArea(ring)) };
    });
    // Brand colours for the big boxes come from their sign style (stand-in names, real colour schemes).
    for (const sg of M.signs) if (m.buildings[sg[0]] && sg[4]) m.buildings[sg[0]].brand = m.buildings[sg[0]].brand || sg[4];
    const sh = b64(M.sections.house, Uint16Array), si = b64(M.sections.street.i, Uint16Array);
    m.sections = Array.from(sh, (h, k) => ({ house: h, street: M.sections.street.names[si[k]] }));
    m.roads = decList(M.roads); const rw = b64(M.roads.w, Uint16Array), rc = M.roads.cls.split(',');
    m.roadInfo = m.roads.map((pts, i) => ({ pts, w: rw[i] / 10, cls: rc[i], name: M.roads.names[i] }));
    m.kerb = decList(M.kerb);
    m.frontFences = decList(M.frontFences); m.frontSec = b64(M.frontSec, Uint16Array);
    m.sideFences = decList(M.sideFences); m.schoolFence = decList(M.schoolFence);
    m.osmFences = decList(M.osmFences); m.osmFenceKind = M.osmFences.kind;
    m.letterboxes = dec16(M.letterboxes); m.drives = dec16(M.drives); m.stalls = dec16(M.stalls);
    m.trees = dec16(M.trees.v); m.treeKind = M.trees.k;
    m.poles = dec16(M.poles); m.wires = b64(M.wires, Uint16Array); m.lights = dec16(M.lights);
    m.rails = decList(M.rails); m.platforms = decList(M.platforms, Uint16Array);
    m.far = { b: dec16(M.far.b), big: M.far.big, roads: decList(M.far.roads), rw: b64(M.far.roads.w, Uint16Array) };
  }

  // 0.5 m classification grid for ground height: road triangles -> 1, platforms -> 2.
  rasterGround() {
    const C = MAPDATA.meta.crop, res = 0.5, w = Math.ceil((C.x1 - C.x0) / res), h = Math.ceil((C.z1 - C.z0) / res);
    Object.assign(GROUND, { x0: C.x0, z0: C.z0, res, w, h, d: new Uint8Array(w * h) });
    const fillTri = (ax, az, bx, bz, cx, cz, v) => {
      const toI = x => (x - C.x0) / res - 0.5, toJ = z => (z - C.z0) / res - 0.5;
      const P = [[toI(ax), toJ(az)], [toI(bx), toJ(bz)], [toI(cx), toJ(cz)]].sort((p, q) => p[1] - q[1]);
      const [p0, p1, p2] = P, j0 = Math.max(0, Math.ceil(p0[1])), j1 = Math.min(h - 1, Math.floor(p2[1]));
      const xAt = (a, b, j) => b[1] === a[1] ? a[0] : a[0] + (b[0] - a[0]) * (j - a[1]) / (b[1] - a[1]);
      for (let j = j0; j <= j1; j++) {
        let xa = xAt(p0, p2, j), xb = j < p1[1] ? xAt(p0, p1, j) : xAt(p1, p2, j);
        if (xa > xb) [xa, xb] = [xb, xa];
        const i0 = Math.max(0, Math.ceil(xa)), i1 = Math.min(w - 1, Math.floor(xb));
        for (let i = i0; i <= i1; i++) GROUND.d[j * w + i] = v;
      }
    };
    for (const [name, v] of [['road', 1], ['platform', 2]]) for (const t of MAPDATA.layers[name] || []) {
      const V = dec16(t.v), I = b64(t.i, Uint16Array);
      for (let k = 0; k < I.length; k += 3) fillTri(V[2 * I[k]], V[2 * I[k] + 1], V[2 * I[k + 1]], V[2 * I[k + 1] + 1], V[2 * I[k + 2]], V[2 * I[k + 2] + 1], v);
    }
  }

  // Kerb faces (150 mm) facing the road, plus the concrete dish channel along the gutter.
  kerbs() {
    const kh = ROAD.kerbH;
    for (const ring of this.map.kerb) for (let i = 0; i + 1 < ring.length; i++) {
      const a = ring[i], b = ring[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 0.05) continue;
      const nx = -dz / L, nz = dx / L, mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      const roadIsN = isCarriageway(mx + nx * 0.5, mz + nz * 0.5), s = roadIsN ? 1 : -1;
      const o = roadIsN ? a : b, u = roadIsN ? [dx / L, 0, dz / L] : [-dx / L, 0, -dz / L];
      this.b.rect('kerb', [o[0], 0, o[1]], u, [0, 1, 0], L, kh, { uv0: [i * 0.37, 0], ao: [0.8, 0.8, 1, 1] });
      const ex = nx * s * 0.42, ez = nz * s * 0.42;
      this.b.poly('channel', [[a[0], 0.004, a[1]], [a[0] + ex, 0.004, a[1] + ez], [b[0] + ex, 0.004, b[1] + ez], [b[0], 0.004, b[1]]].map((p, k, arr) => p), [0, 1, 0],
        [a[0] / 1.2, -a[1] / 1.2, (a[0] + ex) / 1.2, -(a[1] + ez) / 1.2, (b[0] + ex) / 1.2, -(b[1] + ez) / 1.2, b[0] / 1.2, -b[1] / 1.2], null, null, [0.92, 0.92, 0.9]);
    }
  }
  flatQuad(key, pts, y, tint) {
    // pts: 4 xz points; order fixed so the face points up.
    const cr = (pts[1][0] - pts[0][0]) * (pts[2][1] - pts[0][1]) - (pts[1][1] - pts[0][1]) * (pts[2][0] - pts[0][0]);
    const p = cr > 0 ? pts.slice().reverse() : pts, s = this.lib.scale(key);
    this.b.poly(key, p.map(q => [q[0], y, q[1]]), [0, 1, 0], p.flatMap(q => [q[0] / s, -q[1] / s]), null, null, tint);
  }
  // Painted lines: dashed white centre lines on collector roads and arterials, lane lines on 4-lane roads, zebras.
  markings() {
    const y = 0.008;
    const dash = (pts, off, on, gap, w) => {
      let carry = 0;
      for (let i = 0; i + 1 < pts.length; i++) {
        const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (!L) continue;
        const t = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], n = [-t[1], t[0]];
        let s = carry;
        while (s < L) {
          const s1 = Math.min(L, s + on);
          const P = k => [a[0] + t[0] * k + n[0] * off, a[1] + t[1] * k + n[1] * off];
          const p0 = P(s), p1 = P(s1);
          this.flatQuad('markWhite', [[p0[0] - n[0] * w, p0[1] - n[1] * w], [p1[0] - n[0] * w, p1[1] - n[1] * w], [p1[0] + n[0] * w, p1[1] + n[1] * w], [p0[0] + n[0] * w, p0[1] + n[1] * w]], y);
          s += on + gap;
        }
        carry = s - L;
      }
    };
    for (const r of this.map.roadInfo) {
      const c = r.cls, round = c.includes('R'), oneway = c.includes('O'), lanes = parseInt(c.replace(/\D/g, '')) || 2;
      if (round || c[0] === 'r' || c[0] === 'l' || c[0] === 'u') continue;
      if (!oneway) dash(r.pts, 0, 3, 7, 0.06);
      if (lanes >= 4 && !oneway) { dash(r.pts, r.w / 4, 3, 7, 0.05); dash(r.pts, -r.w / 4, 3, 7, 0.05); }
      if (oneway && lanes >= 2) dash(r.pts, 0, 3, 7, 0.05);
    }
    // Zebra crossings with belisha beacons; signal crossings get two dashed transverse lines.
    for (const [x, z, dir, w, signal] of MAPDATA.crossings) {
      const t = [Math.cos(dir), Math.sin(dir)], n = [-t[1], t[0]], half = w / 2;
      if (signal) {
        for (const off of [-1.6, 1.6]) for (let s = -half; s < half; s += 0.8) {
          const c0 = [x + t[0] * off + n[0] * s, z + t[1] * off + n[1] * s];
          this.flatQuad('markWhite', [[c0[0] - t[0] * 0.1, c0[1] - t[1] * 0.1], [c0[0] + t[0] * 0.1, c0[1] + t[1] * 0.1], [c0[0] + t[0] * 0.1 + n[0] * 0.5, c0[1] + t[1] * 0.1 + n[1] * 0.5], [c0[0] - t[0] * 0.1 + n[0] * 0.5, c0[1] - t[1] * 0.1 + n[1] * 0.5]], y);
        }
        continue;
      }
      for (let s = -half + 0.3; s < half - 0.3; s += 1.2) {
        const c0 = [x + n[0] * s, z + n[1] * s];
        this.flatQuad('markWhite', [[c0[0] - t[0] * 1.5 - n[0] * 0.3, c0[1] - t[1] * 1.5 - n[1] * 0.3], [c0[0] + t[0] * 1.5 - n[0] * 0.3, c0[1] + t[1] * 1.5 - n[1] * 0.3], [c0[0] + t[0] * 1.5 + n[0] * 0.3, c0[1] + t[1] * 1.5 + n[1] * 0.3], [c0[0] - t[0] * 1.5 + n[0] * 0.3, c0[1] - t[1] * 1.5 + n[1] * 0.3]], y);
      }
      for (const sd of [-1, 1]) { const px = x + n[0] * sd * (half + 0.8), pz = z + n[1] * sd * (half + 0.8); this.inst('zebraPost', { x: px, y: ROAD.kerbH, z: pz }); this.collision.addCircle(px, pz, 0.12, 'pole'); }
    }
  }

  // ---------------------------------------------------------------- buildings
  // Wall along footprint edge a->b (CCW footprint), facing outward. Optional windows and a door.
  wall(key, a, b, y0, y1, tint, u0 = 0) {
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 0.05 || y1 <= y0) return;
    this.b.rect(key, [b[0], y0, b[1]], [-dx / L, 0, -dz / L], [0, 1, 0], L, y1 - y0, { uv0: [u0, y0], tint, ao: [0.78, 0.78, 1, 1] });
  }
  // A window or door panel set slightly proud of the wall: frame rectangle then glass (interior-mapped).
  pane(a, b, s0, s1, y0, y1, frameTint, kind = 0, solid = null) {
    const prev = this.b.cls; this.b.cls = 'detail'; this.paneGeo(a, b, s0, s1, y0, y1, frameTint, kind, solid); this.b.cls = prev;
  }
  paneGeo(a, b, s0, s1, y0, y1, frameTint, kind, solid) {
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), ux = -dx / L, uz = -dz / L, nx = dz / L, nz = -dx / L;
    // Wall coordinates measured from b toward a (matching wall()).
    const at = (s, off) => [b[0] + ux * s + nx * off, b[1] + uz * s + nz * off];
    const f = 0.06, p0 = at(s0 - f, 0.025);
    this.b.rect('alu', [p0[0], y0 - f, p0[1]], [ux, 0, uz], [0, 1, 0], s1 - s0 + 2 * f, y1 - y0 + 2 * f, { tint: frameTint });
    const p1 = at(s0, 0.04);
    if (solid) this.b.rect(solid.key, [p1[0], y0, p1[1]], [ux, 0, uz], [0, 1, 0], s1 - s0, y1 - y0, { tint: solid.tint, uv0: [0, 0] });
    else this.b.rect('glass', [p1[0], y0, p1[1]], [ux, 0, uz], [0, 1, 0], s1 - s0, y1 - y0, { uv: [0, 0, 1, 0, 1, 1, 0, 1], win: [WINDOW_SEED++ * 1.618 % 997, s1 - s0, y1 - y0, kind] });
  }
  cap(ring, y, key, tint) {
    const tris = THREE.ShapeUtils.triangulateShape(ring.map(p => new THREE.Vector2(p[0], p[1])), []), s = this.lib.scale(key);
    for (const t of tris) {
      const P = t.map(k => ring[k]);
      const cr = (P[1][0] - P[0][0]) * (P[2][1] - P[0][1]) - (P[1][1] - P[0][1]) * (P[2][0] - P[0][0]);
      const Q = cr > 0 ? [P[0], P[2], P[1]] : P;
      this.b.poly(key, Q.map(p => [p[0], y, p[1]]), [0, 1, 0], Q.flatMap(p => [p[0] / s, -p[1] / s]), null, null, tint);
    }
  }
  face(key, pts, hint, tint, uvAxes) {
    // pts: [x,y,z][]; normal from the first three, flipped toward `hint`; UVs in metres on the plane.
    const a = new THREE.Vector3(...pts[0]), b = new THREE.Vector3(...pts[1]), c = new THREE.Vector3(...pts[2]);
    const n = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    let P = pts; if (n.dot(hint) < 0) { P = pts.slice().reverse(); n.negate(); }
    const s = this.lib.scale(key), [U, V] = uvAxes;
    this.b.poly(key, P, [n.x, n.y, n.z], P.flatMap(p => [(p[0] * U.x + p[1] * U.y + p[2] * U.z) / s, (p[0] * V.x + p[1] * V.y + p[2] * V.z) / s]), null, null, tint);
  }
  // Hip or gable roof over a rectangle (cx, cz, w along angle ang, d across), eaves at height e.
  roofRect(cx, cz, w, d, ang, top, pitch, hip, key, tint, fasciaTint, over = 0.5) {
    if (d > w) { [w, d] = [d, w]; ang += Math.PI / 2; }
    const U = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang)), V = new THREE.Vector3(-Math.sin(ang), 0, Math.cos(ang));
    const tp = Math.tan(pitch), W = w / 2 + over, D = d / 2 + over, e = top - over * tp, ridge = top + d / 2 * tp;
    const P = (u, v, y) => [cx + U.x * u + V.x * v, y, cz + U.z * u + V.z * v];
    const up = new THREE.Vector3(0, 1, 0), slopeAxis = (vdir) => [U, new THREE.Vector3().copy(V).multiplyScalar(vdir).add(new THREE.Vector3(0, tp, 0)).normalize()];
    const r0 = hip ? -W + D : -W, r1 = hip ? W - D : W;
    const R0 = P(Math.min(r0, 0), 0, ridge), R1 = P(Math.max(r1, 0), 0, ridge);
    this.face(key, [P(-W, -D, e), P(W, -D, e), R1, R0], new THREE.Vector3().copy(V).negate().add(up), tint, slopeAxis(-1));
    this.face(key, [P(W, D, e), P(-W, D, e), R0, R1], new THREE.Vector3().copy(V).add(up), tint, slopeAxis(1));
    if (hip) {
      this.face(key, [P(-W, D, e), P(-W, -D, e), R0], new THREE.Vector3().copy(U).negate().add(up), tint, [V, up]);
      this.face(key, [P(W, -D, e), P(W, D, e), R1], new THREE.Vector3().copy(U).add(up), tint, [V, up]);
    } else {
      // Gable ends in the wall plane, plus barge boards under the overhang.
      for (const sgn of [-1, 1]) this.face('trim', [P(sgn * w / 2, -d / 2, top), P(sgn * w / 2, d / 2, top), P(sgn * w / 2, 0, ridge)], new THREE.Vector3().copy(U).multiplyScalar(sgn), fasciaTint, [V, up]);
    }
    // Fascia boards along the eaves.
    const fh = 0.2;
    for (const [p, q, nrm] of [[P(-W, -D, e), P(W, -D, e), new THREE.Vector3().copy(V).negate()], [P(W, D, e), P(-W, D, e), V], ...(hip ? [[P(W, -D, e), P(W, D, e), U], [P(-W, D, e), P(-W, -D, e), new THREE.Vector3().copy(U).negate()]] : [])]) {
      this.face('trim', [p, q, [q[0], e - fh, q[2]], [p[0], e - fh, p[2]]], nrm, fasciaTint, [U, up]);
    }
  }
  building(i) {
    const bd = this.map.buildings[i], R = bd.ring, n = R.length, h = k => this.hash(i, k), kh = ROAD.kerbH;
    const T = bd.type;
    let wallKey = 'plaster', wallTint = tintOf(HOUSE_PAINT[Math.floor(h(1) * HOUSE_PAINT.length)]), H = 2.7, roofKey = 'corrugated', roofTint = tintOf(ROOF_TINT[Math.floor(h(2) * ROOF_TINT.length)]);
    const trimTint = h(3) < 0.7 ? [0.93, 0.93, 0.9] : tintOf(0x3a3d40);
    const frameTint = h(4) < 0.6 ? [0.78, 0.8, 0.82] : h(4) < 0.85 ? [0.93, 0.93, 0.92] : [0.35, 0.3, 0.26];
    let base = kh, floorY = kh + 0.35, parapet = 0, pitch = THREE.MathUtils.degToRad(20 + h(5) * 8), hip = h(6) < 0.55, windows = true, shopfront = false;
    if (T === BT.house || T === BT.apartments) {
      const c = h(7);
      if (c < 0.36) { wallKey = 'brick'; wallTint = tintOf(BRICK_TINT[Math.floor(h(8) * BRICK_TINT.length)]); floorY = kh + 0.15; }
      else if (c < 0.78) { wallKey = 'weatherboard'; floorY = kh + 0.5; }
      else if (c < 0.92) { wallKey = 'plaster'; }
      else { wallKey = 'block'; wallTint = tintOf(HOUSE_PAINT[Math.floor(h(9) * 4)]); }
      if (h(10) < 0.42) { roofKey = 'roofTile'; }
      H = (T === BT.apartments || bd.levels >= 2 || (bd.area > 210 && h(11) < 0.3) ? 5.4 : 2.6) + (floorY - kh);
    } else if (T === BT.garage) { H = 2.5; wallKey = h(7) < 0.5 ? 'block' : 'weatherboard'; pitch = 0.22; hip = false; windows = false; }
    else if (T === BT.shed) { H = 2.2; wallKey = h(7) < 0.6 ? 'corrugated' : 'wood'; wallTint = h(7) < 0.6 ? tintOf(ROOF_TINT[Math.floor(h(8) * ROOF_TINT.length)]) : [0.8, 0.75, 0.68]; pitch = 0.18; hip = false; windows = false; }
    else if (T === BT.shop || T === BT.fastfood) { H = 4.3 + Math.max(0, bd.levels - 1) * 3.3; parapet = 0.9; wallKey = h(7) < 0.35 ? 'brick' : h(7) < 0.7 ? 'plaster' : 'block'; wallTint = wallKey === 'brick' ? [1, 1, 1] : tintOf([0xe9e2d0, 0xd8d3c4, 0xc9c1ae, 0xb9b3a6, 0xd9c7a3, 0xa9b4a1, 0x9fb0b8][Math.floor(h(8) * 7)]); shopfront = true; }
    else if (T === BT.mall) { H = 6.8; parapet = 1.2; wallKey = 'plaster'; wallTint = tintOf(0xe7dfcf); shopfront = true; }
    else if (T === BT.bigbox) { H = 8.5; parapet = 0.6; wallKey = 'tiltslab'; wallTint = tintOf(bd.brand === 'bigyellow' ? 0xf0c419 : bd.brand === 'bigred' ? 0xc8202a : bd.brand === 'red' ? 0xd8d2c6 : 0xd9d4c8); shopfront = true; }
    else if (T === BT.warehouse) { H = 7.5; parapet = 0.6; wallKey = 'corrugated'; wallTint = tintOf([0xb8bcc0, 0xd8d4c8, 0x7a8a8a, 0x3f5a6a][Math.floor(h(8) * 4)]); windows = false; }
    else if (T === BT.school) { H = 3.4 + kh; wallKey = h(7) < 0.6 ? 'weatherboard' : 'brick'; wallTint = wallKey === 'brick' ? [1, 1, 1] : tintOf([0xe8e1cf, 0xd9cfb2, 0xc3d0d4, 0xb8c4b0][Math.floor(h(8) * 4)]); pitch = 0.32; hip = false; floorY = kh + 0.6; }
    else if (T === BT.church) { H = 5; wallKey = h(7) < 0.6 ? 'brick' : 'weatherboard'; wallTint = [1, 1, 1]; pitch = 0.62; hip = false; roofKey = h(8) < 0.5 ? 'roofTile' : 'corrugated'; }
    else if (T === BT.civic) { H = 5.6; parapet = 0.8; wallKey = 'plaster'; wallTint = tintOf(0xd9d2c2); shopfront = true; }
    else if (T === BT.canopy) { this.canopy(bd); return; }
    const top = kh + H;
    // Walls, with a darker baseboard strip on raised timber houses.
    for (let k = 0; k < n; k++) {
      const a = R[k], b = R[(k + 1) % n];
      this.wall(wallKey, a, b, base, top + parapet, wallTint);
      if (wallKey === 'weatherboard' && floorY - kh > 0.3) this.wall('weatherboard', a, b, base - 0.002, floorY - 0.05, [wallTint[0] * 0.6, wallTint[1] * 0.6, wallTint[2] * 0.6]);
    }
    // Openings.
    const isFront = k => k === bd.fe;
    for (let k = 0; k < n; k++) {
      const a = R[k], b = R[(k + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (shopfront && (isFront(k) || (T === BT.mall && L > 25 && h(20 + k) < 0.5))) {
        // Shopfront glazing with door bays; supermarkets and the mall get big entries.
        const g0 = 0.6, g1 = L - 0.6; if (g1 - g0 < 1.5) continue;
        const bay = T === BT.bigbox || T === BT.mall ? 6 : 3.2;
        for (let s = g0; s + 0.5 < g1; s += bay) this.pane(a, b, s + 0.1, Math.min(g1, s + bay) - 0.1, kh + 0.35, kh + 3.0, [0.25, 0.26, 0.27], 2);
        continue;
      }
      if (!windows || L < 1.6) continue;
      const floors = H > 4.5 && T !== BT.church ? 2 : 1;
      for (let f = 0; f < floors; f++) {
        const sill = floorY + 0.85 + f * 2.7, wh = T === BT.school ? 1.5 : 1.15;
        let count = Math.max(0, Math.min(5, Math.floor((L - 0.6) / (T === BT.school ? 2.2 : 3.0))));
        if (!isFront(k) && h(30 + k) < 0.25) count = Math.min(count, 1);
        for (let w = 0; w < count; w++) {
          const ww = isFront(k) && w === 0 && f === 0 && T === BT.house && L > 6 ? 2.3 : T === BT.school ? 1.8 : 1.0 + h(40 + k) * 0.6;
          const c = L * (w + 0.5) / count; if (ww > L / count - 0.3) continue;
          this.pane(a, b, c - ww / 2, c + ww / 2, sill, sill + wh, frameTint, T === BT.school ? 1 : 0);
        }
      }
      if (isFront(k) && (T === BT.house || T === BT.apartments || T === BT.church || T === BT.school) && L > 2.5) {
        const s = L > 7 ? L * (h(50) < 0.5 ? 0.18 : 0.82) : L / 2;
        this.pane(a, b, s - 0.45, s + 0.45, floorY, floorY + 2.05, [0.9, 0.9, 0.88], 0, { key: 'trim', tint: tintOf(DOOR_PAINT[Math.floor(h(51) * DOOR_PAINT.length)]) });
        if (floorY - kh > 0.25) { const dx = b[0] - a[0], dz = b[1] - a[1]; const ux = -dx / L, uz = -dz / L, nx = dz / L, nz = -dx / L; const p = [b[0] + ux * s + nx * 0.5, b[1] + uz * s + nz * 0.5]; this.b.setTransform(new THREE.Matrix4().makeRotationY(Math.atan2(nx, nz)).setPosition(p[0], kh, p[1])); this.b.box('concrete', 0, 0, 0, 1.4, floorY - kh, 1.0); this.b.setTransform(null); }
      }
      if (T === BT.garage && isFront(k) && L > 2.6) this.pane(a, b, L / 2 - 1.2, L / 2 + 1.2, kh + 0.02, kh + 2.1, [0.9, 0.9, 0.88], 0, { key: 'roller', tint: [0.92, 0.92, 0.9] });
      if (T === BT.warehouse && isFront(k) && L > 5) for (let s = 1; s + 4 < L; s += 7) this.pane(a, b, s, s + 4, kh + 0.02, kh + 4.2, [0.3, 0.3, 0.3], 0, { key: 'roller', tint: [0.85, 0.87, 0.88] });
    }
    // Roof.
    const roofs = bd.roof;
    if (roofs && roofs.length > 1) {
      const ang = roofs[0];
      for (let r = 1; r + 3 < roofs.length; r += 4) this.roofRect(roofs[r], roofs[r + 1], roofs[r + 2], roofs[r + 3], ang, top, pitch, hip, roofKey, roofTint, trimTint, T === BT.shed ? 0.15 : 0.5);
      this.cap(R, top - 0.02, 'trim', [0.2, 0.2, 0.2]);
    } else {
      this.cap(R, top + 0.05, T === BT.mall || T === BT.bigbox || T === BT.warehouse ? 'corrugated' : 'trim', T === BT.mall || T === BT.bigbox ? [0.75, 0.76, 0.76] : [0.42, 0.42, 0.42]);
      if (parapet) for (let k = 0; k < n; k++) this.wallCap(R[k], R[(k + 1) % n], top + parapet, trimTint);
      if (bd.ver) this.verandah(bd);
      if (T === BT.mall) this.mallSkylight(bd, top);
    }
    this.collision.addPoly(R, 'building');
    if (T === BT.church) this.churchCross(bd, top, pitch);
  }
  wallCap(a, b, y, tint) {
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 0.1) return;
    const nx = dz / L, nz = -dx / L;
    this.b.poly('trim', [[a[0] + nx * 0.06, y + 0.08, a[1] + nz * 0.06], [b[0] + nx * 0.06, y + 0.08, b[1] + nz * 0.06], [b[0] - nx * 0.25, y + 0.08, b[1] - nz * 0.25], [a[0] - nx * 0.25, y + 0.08, a[1] - nz * 0.25]].reverse(), [0, 1, 0], [0, 0, 1, 0, 1, 1, 0, 1], null, null, tint);
    this.b.rect('trim', [b[0] + nx * 0.06, y, b[1] + nz * 0.06], [-dx / L, 0, -dz / L], [0, 1, 0], L, 0.08, { tint });
  }
  // NZ shop verandah over the footpath: cantilevered canopy with a deep fascia for signs.
  verandah(bd) { const prev = this.b.cls; this.b.cls = 'detail'; this.verandahGeo(bd); this.b.cls = prev; }
  verandahGeo(bd) {
    const R = bd.ring, k = bd.fe, a = R[k], b = R[(k + 1) % R.length], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 3) return;
    const nx = dz / L, nz = -dx / L, D = bd.ver, y = ROAD.kerbH + 3.1, fy = 0.65;
    const A = [a[0] + nx * D, a[1] + nz * D], B = [b[0] + nx * D, b[1] + nz * D];
    const tint = tintOf([0x2e3a34, 0xf1ede4, 0x5b4636, 0x3b4450, 0x7a1f1f][Math.floor(this.hash(bd.i, 60) * 5)]);
    this.b.poly('corrugated', [[a[0], y + 0.25, a[1]], [b[0], y + 0.25, b[1]], [B[0], y + 0.05, B[1]], [A[0], y + 0.05, A[1]]].reverse(), [0, 1, 0], [0, 0, L / 1.52, 0, L / 1.52, D / 1.52, 0, D / 1.52], null, null, [0.6, 0.62, 0.62]);
    this.b.poly('trim', [[a[0], y, a[1]], [b[0], y, b[1]], [B[0], y, B[1]], [A[0], y, A[1]]], [0, -1, 0], [0, 0, 1, 0, 1, 1, 0, 1], null, null, [0.85, 0.85, 0.82]);
    this.b.rect('trim', [A[0], y - fy + 0.05, A[1]], [dx / L, 0, dz / L], [0, 1, 0], L, fy + 0.25, { tint });
    this.b.rect('trim', [B[0] - nx * 0.05, y - fy + 0.05, B[1] - nz * 0.05], [-dx / L, 0, -dz / L], [0, 1, 0], L, fy + 0.25, { tint });
    bd.fascia = { A, B, y: y - fy + 0.05, h: fy + 0.25, nx, nz, L };
  }
  mallSkylight(bd, top) {
    // Southmall's central court roof: a long glazed gable down the middle of the building.
    const o = this.obb(bd.ring); const w = o.w * 0.55, d = Math.min(9, o.d * 0.25);
    this.roofRect(o.cx, o.cz, w, d, o.ang, top + 0.6, 0.45, false, 'glassRoof', [1, 1, 1], [0.85, 0.85, 0.85], 0.2);
    const U = [Math.cos(o.ang), Math.sin(o.ang)], V = [-U[1], U[0]];
    const pts = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([u, v]) => [o.cx + U[0] * u + V[0] * v, o.cz + U[1] * u + V[1] * v]);
    for (let k = 0; k < 4; k++) this.wall('trim', pts[k], pts[(k + 1) % 4], top + 0.05, top + 0.6, [0.9, 0.9, 0.88]);
  }
  churchCross(bd, top, pitch) {
    const o = this.obb(bd.ring), U = [Math.cos(o.ang), Math.sin(o.ang)];
    const w = Math.max(o.w, o.d), d = Math.min(o.w, o.d), along = o.w >= o.d ? U : [-U[1], U[0]];
    const p = [o.cx + along[0] * (w / 2 - 0.3), o.cz + along[1] * (w / 2 - 0.3)], y = top + d / 2 * Math.tan(pitch);
    this.b.box('white', p[0], y, p[1], 0.14, 1.6, 0.14); this.b.box('white', p[0], y + 0.95, p[1], 0.8, 0.14, 0.14);
  }
  canopy(bd) {
    const R = bd.ring, A = bd.area, kh = ROAD.kerbH, hgt = A > 120 ? 5.2 : 2.5;
    for (const p of R) { this.b.cylinder('steel', p[0], kh, p[1], 0.09, 0.09, hgt, 6); this.collision.addCircle(p[0], p[1], 0.12, 'pole'); }
    this.cap(R, kh + hgt, 'trim', [0.9, 0.9, 0.9]);
    const t = A > 120 ? tintOf(0x123f8c) : [0.85, 0.85, 0.85];
    for (let k = 0; k < R.length; k++) { const a = R[k], b = R[(k + 1) % R.length]; this.wall('trim', a, b, kh + hgt, kh + hgt + (A > 120 ? 0.9 : 0.2), t); }
    // underside
    const tris = THREE.ShapeUtils.triangulateShape(R.map(p => new THREE.Vector2(p[0], p[1])), []);
    for (const tr of tris) { const P = tr.map(k => R[k]); const cr = (P[1][0] - P[0][0]) * (P[2][1] - P[0][1]) - (P[1][1] - P[0][1]) * (P[2][0] - P[0][0]); const Q = cr > 0 ? P : [P[0], P[2], P[1]]; this.b.poly('trim', Q.map(p => [p[0], kh + hgt - 0.02, p[1]]), [0, -1, 0], [0, 0, 1, 0, 1, 1], null, null, [0.8, 0.8, 0.8]); }
  }
  obb(ring) {
    let best = null;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length], ang = Math.atan2(b[1] - a[1], b[0] - a[0]), c = Math.cos(-ang), s = Math.sin(-ang);
      let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
      for (const p of ring) { const u = p[0] * c - p[1] * s, v = p[0] * s + p[1] * c; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
      const A = (u1 - u0) * (v1 - v0);
      if (!best || A < best.A) best = { A, ang, u0, u1, v0, v1 };
    }
    const cu = (best.u0 + best.u1) / 2, cv = (best.v0 + best.v1) / 2, C = Math.cos(best.ang), S = Math.sin(best.ang);
    return { cx: cu * C - cv * S, cz: cu * S + cv * C, w: best.u1 - best.u0, d: best.v1 - best.v0, ang: best.ang };
  }

  // ---------------------------------------------------------------- fences
  fences() {
    const kh = ROAD.kerbH, m = this.map;
    const seg = (a, b, style, hgt) => {
      const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 0.3) return;
      const u = [dx / L, 0, dz / L];
      if (style === 'block') {
        const nx = -dz / L * 0.1, nz = dx / L * 0.1, tint = [0.95, 0.94, 0.9];
        this.wall('block', [a[0] - nx, a[1] - nz], [b[0] - nx, b[1] - nz], kh, kh + hgt, tint);
        this.wall('block', [b[0] + nx, b[1] + nz], [a[0] + nx, a[1] + nz], kh, kh + hgt, tint);
        this.b.poly('trim', [[a[0] - nx, kh + hgt, a[1] - nz], [a[0] + nx, kh + hgt, a[1] + nz], [b[0] + nx, kh + hgt, b[1] + nz], [b[0] - nx, kh + hgt, b[1] - nz]], [0, 1, 0], [0, 0, 1, 0, 1, 1, 0, 1], null, null, [0.85, 0.85, 0.82]);
      } else if (style === 'hedge') {
        const nx = -dz / L * 0.4, nz = dx / L * 0.4, tint = [0.32, 0.45, 0.22];
        this.wall('hedge', [a[0] - nx, a[1] - nz], [b[0] - nx, b[1] - nz], kh, kh + hgt, tint);
        this.wall('hedge', [b[0] + nx, b[1] + nz], [a[0] + nx, a[1] + nz], kh, kh + hgt, tint);
        this.b.poly('hedge', [[a[0] - nx, kh + hgt, a[1] - nz], [a[0] + nx, kh + hgt, a[1] + nz], [b[0] + nx, kh + hgt, b[1] + nz], [b[0] - nx, kh + hgt, b[1] - nz]], [0, 1, 0], [0, 0, 1, 0, 1, 1, 0, 1], null, null, [0.36, 0.5, 0.25]);
      } else {
        const key = style, tint = style === 'corrugated' ? tintOf(ROOF_TINT[Math.floor(this.hash(Math.round(a[0] * 7 + a[1] * 3), 2) * ROOF_TINT.length)]) : style === 'picket' ? [0.95, 0.95, 0.92] : [0.82, 0.74, 0.62];
        this.b.rect(key, [a[0], kh, a[1]], u, [0, 1, 0], L, hgt, { tint, uv0: [0, 0] });
        if (style === 'wood') for (let s = 0; s <= L; s += 2.4) this.b.box('timber', a[0] + u[0] * s, kh, a[1] + u[2] * s, 0.1, hgt + 0.05, 0.1);
      }
      this.collision.addSeg(a[0], a[1], b[0], b[1], style === 'hedge' ? 0.4 : 0.1, 'fence');
    };
    const FRONT = [[0.25, null, 0], [0.45, 'block', 0.9], [0.6, 'picket', 1.1], [0.72, 'wood', 1.8], [0.82, 'corrugated', 1.8], [0.94, 'hedge', 1.2], [1, 'block', 1.5]];
    m.frontFences.forEach((pts, k) => {
      const sec = m.frontSec[k], r = this.hash(sec, 70), f = FRONT.find(e => r < e[0]);
      if (!f[1]) return;
      for (let i = 0; i + 1 < pts.length; i++) seg(pts[i], pts[i + 1], f[1], f[2]);
    });
    m.sideFences.forEach((pts, k) => {
      const r = this.hash(k, 71); if (r < 0.08) return;
      const style = r < 0.7 ? 'wood' : r < 0.9 ? 'corrugated' : 'block';
      for (let i = 0; i + 1 < pts.length; i++) seg(pts[i], pts[i + 1], style, style === 'block' ? 1.5 : 1.8);
    });
    for (const pts of m.schoolFence) for (let i = 0; i + 1 < pts.length; i++) seg(pts[i], pts[i + 1], 'chainlink', 1.8);
    m.osmFences.forEach((pts, k) => { const kind = m.osmFenceKind[k]; const style = kind === 'h' ? 'hedge' : kind === 'w' || kind === 'r' ? 'block' : 'wood'; for (let i = 0; i + 1 < pts.length; i++) seg(pts[i], pts[i + 1], style, kind === 'r' ? 0.9 : 1.6); });
  }

  // ---------------------------------------------------------------- street furniture and dressing
  furniture() {
    const m = this.map, kh = ROAD.kerbH;
    // Streetlights (Auckland LED heads on 7.5 m poles) and the night light list.
    for (let k = 0; k < m.lights.length; k += 3) {
      const x = m.lights[k], z = m.lights[k + 1], rot = m.lights[k + 2];
      this.inst('streetlight', { x, y: kh, z, rot });
      this.lights.push(new THREE.Vector3(x + Math.sin(rot) * 2.1, kh + 7.6, z + Math.cos(rot) * 2.1));
      this.collision.addCircle(x, z, 0.14, 'pole');
    }
    // Power poles from the map, wired along the mapped lines.
    const P = []; for (let k = 0; k < m.poles.length; k += 2) { P.push({ x: m.poles[k], z: m.poles[k + 1] }); this.collision.addCircle(m.poles[k], m.poles[k + 1], 0.2, 'pole'); }
    for (let k = 0; k < m.wires.length; k += 2) { const a = P[m.wires[k]], b = P[m.wires[k + 1]]; if (a && b) this.poles.push([a, b]); }
    for (const [i, p] of P.entries()) { const nb = this.poles.find(([a, b]) => a === p || b === p); const q = nb ? (nb[0] === p ? nb[1] : nb[0]) : null; this.inst('pole', { x: p.x, y: kh, z: p.z, rot: q ? Math.atan2(q.x - p.x, q.z - p.z) + Math.PI / 2 : 0, light: false }); }
    // Trees: mapped street trees, bush, backyard trees and cabbage trees.
    const T = m.trees, K = m.treeKind;
    for (let k = 0; k < T.length; k += 2) {
      const code = K.charCodeAt(k / 2) - 70, x = T[k], z = T[k + 1], r = this.hash(k, 80);
      let kind = 'broad', s = 0.8 + r * 0.45;
      if (code === 3) { kind = 'cabbage'; s = 0.8 + r * 0.6; }
      else if (code === 5) { kind = 'conifer'; s = 1.6; }
      else if (code === 4) { kind = 'cabbage'; s = 1.3; }
      else if (code === -2) { kind = r < 0.3 ? 'conifer' : 'broad'; s = 0.8 + r * 0.6; }
      else if (code === -3) { kind = r < 0.15 ? 'conifer' : 'broad'; s = 0.55 + r * 0.4; }
      if (Math.hypot(x - MAPDATA.landmarks.norfolkPine[0], z - MAPDATA.landmarks.norfolkPine[1]) < 3) continue;
      this.trees.push({ x, z, y: groundHeight(x, z), kind, s });
      this.collision.addCircle(x, z, kind === 'cabbage' ? 0.15 : 0.3, 'tree');
    }
    // Southmall's 1911 Norfolk pine, lit at Christmas since 1950 with a cross on top.
    const np = MAPDATA.landmarks.norfolkPine;
    this.trees.push({ x: np[0], z: np[1], y: kh, kind: 'conifer', s: 2.7 });
    this.collision.addCircle(np[0], np[1], 0.8, 'tree');
    this.b.box('white', np[0], kh + 33.5, np[1], 0.25, 3.2, 0.25); this.b.box('white', np[0], kh + 35.4, np[1], 1.8, 0.25, 0.25);
    // Letterboxes at the boundary, parked cars on driveways and kerbside, bins out on the berm.
    for (let k = 0; k < m.letterboxes.length; k += 3) { const x = m.letterboxes[k], z = m.letterboxes[k + 1]; this.inst('letterbox', { x, y: kh, z, rot: m.letterboxes[k + 2] + Math.PI, v: Math.floor(this.hash(k, 81) * 3) }); this.collision.addCircle(x, z, 0.2, 'letterbox'); }
    const D = m.drives;
    for (let k = 0; k < D.length; k += 5) {
      const r = this.hash(k, 82);
      if (r < 0.62) this.parkCar(D[k], D[k + 1], D[k + 2] + (r < 0.3 ? Math.PI : 0), kh);
      if (this.hash(k, 83) < 0.22) { const bx = D[k + 3], bz = D[k + 4]; for (const [o, lid] of [[-0.5, 0], [0.35, 1]]) this.inst('bin', { x: bx + Math.cos(D[k + 2]) * o, y: kh, z: bz - Math.sin(D[k + 2]) * o, rot: D[k + 2] + Math.PI, lid }); }
    }
    for (let k = 0; k < m.stalls.length; k += 3) if (this.hash(k, 84) < 0.55) this.parkCar(m.stalls[k], m.stalls[k + 1], Math.PI / 2 - m.stalls[k + 2] / 10 + (this.hash(k, 85) < 0.5 ? Math.PI : 0), kh);
    for (const r of m.roadInfo) {
      if (r.cls[0] !== 'r' && r.cls[0] !== 't') continue;
      let acc = 6;
      for (let i = 0; i + 1 < r.pts.length; i++) {
        const a = r.pts[i], b = r.pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (!L) continue;
        const t = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], nrm = [-t[1], t[0]];
        while (acc < L) {
          if (this.hash(Math.round(a[0] * 13 + acc), Math.round(a[1])) < 0.11) {
            const side = this.hash(Math.round(acc), 3) < 0.5 ? 1 : -1, off = r.w / 2 - 1.1, x = a[0] + t[0] * acc + nrm[0] * off * side, z = a[1] + t[1] * acc + nrm[1] * off * side;
            if (isCarriageway(x, z) && isCarriageway(x + t[0] * 2.5, z + t[1] * 2.5) && isCarriageway(x - t[0] * 2.5, z - t[1] * 2.5)) this.parkCar(x, z, Math.atan2(t[0], t[1]) + (side > 0 ? 0 : Math.PI), 0); // parked with the traffic on the left
          }
          acc += 7;
        }
        acc -= L;
      }
    }
    // Bus stops: AT flag pole, shelters on the busier roads.
    for (const [x, z, rot, name, shelter] of MAPDATA.busStops) {
      this.inst('busSign', { x, y: kh, z, rot }); this.collision.addCircle(x, z, 0.1, 'pole');
      if (shelter) { const sx = x - Math.sin(rot) * -1.4 + Math.cos(rot) * 3, sz = z - Math.cos(rot) * -1.4 - Math.sin(rot) * 3; this.inst('busShelter', { x: sx, y: kh, z: sz, rot }); this.collision.addOBB(sx, sz, 1.8, 0.5, -rot, 'shelter'); }
    }
    // Signals: four poles round each signalised junction, on the first footpath cell outward.
    for (const [x, z] of MAPDATA.signals) for (let q = 0; q < 4; q++) {
      const th = Math.PI / 4 + q * Math.PI / 2, dx = Math.cos(th), dz = Math.sin(th);
      for (let s = 4; s < 26; s += 0.5) if (!isCarriageway(x + dx * s, z + dz * s)) { const px = x + dx * (s + 0.6), pz = z + dz * (s + 0.6); this.inst('signal', { x: px, y: kh, z: pz, rot: Math.atan2(-dx, -dz) }); this.collision.addCircle(px, pz, 0.12, 'pole'); break; }
    }
    // Street name blades (Manukau style: white on green).
    const names = []; for (const s of MAPDATA.streetSigns) names.push(s[2], s[4]);
    this.streetAtlas = new SignAtlas(names.map(n => n.toUpperCase()), 512, 64, () => ({ bg: '#0b6b3a', fg: '#ffffff', size: 40, border: '#ffffff' }));
    MAT_DEFS.streetNames = { atlas: this.streetAtlas };
    for (const [x, z, n1, d1, n2, d2] of MAPDATA.streetSigns) {
      this.b.cylinder('steel', x, kh, z, 0.04, 0.04, 2.9, 6); this.collision.addCircle(x, z, 0.08, 'pole');
      for (const [nm, dir, y] of [[n1, d1, kh + 2.75], [n2, d2, kh + 2.5]]) {
        const u = [Math.cos(dir), 0, Math.sin(dir)], w = 1.1, uv = this.streetAtlas.uv(nm.toUpperCase());
        this.b.rect('streetNames', [x - u[0] * w / 2, y, z - u[2] * w / 2], u, [0, 1, 0], w, 0.18, { uv });
        this.b.rect('streetNames', [x + u[0] * w / 2, y, z + u[2] * w / 2], [-u[0], 0, -u[2]], [0, 1, 0], w, 0.18, { uv });
      }
    }
    // Rugby goalposts and netball/basketball hoops.
    for (const [x, z, ang] of MAPDATA.goalposts) { this.inst('goalpost', { x, y: kh, z, rot: -ang }); for (const s of [-2.8, 2.8]) this.collision.addCircle(x + Math.cos(ang + Math.PI / 2) * s, z + Math.sin(ang + Math.PI / 2) * s, 0.15, 'pole'); }
    for (const [sport, flat] of MAPDATA.pitches) {
      if (!['basketball', 'netball'].includes(sport)) continue;
      const ring = []; for (let k = 0; k < flat.length; k += 2) ring.push([flat[k], flat[k + 1]]);
      const o = this.obb(ring), long = o.w >= o.d, U = long ? [Math.cos(o.ang), Math.sin(o.ang)] : [-Math.sin(o.ang), Math.cos(o.ang)], half = Math.max(o.w, o.d) / 2 - 0.6;
      for (const sg of [-1, 1]) { const x = o.cx + U[0] * half * sg, z = o.cz + U[1] * half * sg; this.inst('hoop', { x, y: kh, z, rot: Math.atan2(-U[0] * sg, -U[1] * sg) }); this.collision.addCircle(x, z, 0.12, 'pole'); }
    }
    // Shop signs: verandah fascia when there is one, otherwise on the wall above the door.
    const texts = MAPDATA.signs.map(s => s[3]);
    const styleOf = new Map(MAPDATA.signs.map(s => [s[3], s[4]]));
    this.shopAtlas = new SignAtlas(texts, 512, 64, t => signStyle(t, styleOf.get(t)));
    MAT_DEFS.shopSigns = { atlas: this.shopAtlas, glow: 1 };
    const usedEdge = new Map();
    for (const [bi, ei, t, text, style] of MAPDATA.signs) {
      const bd = m.buildings[bi]; if (!bd || bd.type === BT.canopy) continue;
      const R = bd.ring, e = ei < 0 ? bd.fe : ei % R.length, a = R[e], b = R[(e + 1) % R.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 2) continue;
      const big = ei < 0 || ['bigyellow', 'bigred', 'mall'].includes(style);
      const key = bi + ':' + e, used = usedEdge.get(key) || 0; usedEdge.set(key, used + 1);
      const sw = Math.min(L * 0.9, big ? Math.min(16, text.length * 1.0 + 2) : Math.min(6.5, text.length * 0.38 + 1.2)), sh = sw / 8;
      const dx = b[0] - a[0], dz = b[1] - a[1], ux = dx / L, uz = dz / L, nx = dz / L, nz = -dx / L;
      let along = clamp(t * L, sw / 2 + 0.1, L - sw / 2 - 0.1);
      const F = bd.fascia && e === bd.fe && !big ? bd.fascia : null;
      const ground = ROAD.kerbH, H = bd.type === BT.mall ? 6.8 : bd.type === BT.bigbox ? 8.5 : 4.3;
      let y = F ? F.y + (F.h - sh) / 2 : big ? ground + H - sh - 0.5 : ground + 3.35 + used * 0.0;
      const off = F ? bd.ver + 0.03 : 0.06;
      const c = [a[0] + ux * along + nx * off, a[1] + uz * along + nz * off];
      this.b.rect('shopSigns', [c[0] - ux * sw / 2, y, c[1] - uz * sw / 2], [ux, 0, uz], [0, 1, 0], sw, F ? Math.min(sh, F.h - 0.08) : sh, { uv: this.shopAtlas.uv(text) });
      this.signs.push({ text, pos: new THREE.Vector3(c[0], y, c[1]) });
    }
  }
  parkCar(x, z, rot, y) {
    const r = this.hash(Math.round(x * 10), Math.round(z * 10));
    this.cars.push({ x, z, y, rot, type: Math.floor(r * 4), color: this.hash(Math.round(z * 7), 9) });
    this.collision.addOBB(x, z, 0.95, 2.3, -rot, 'car');
  }
  platforms() {
    const kh = ROAD.kerbH, top = GROUND.platform;
    for (const ring of this.map.platforms) {
      const R = ringArea(ring) < 0 ? ring.slice().reverse() : ring;
      for (let k = 0; k < R.length; k++) this.wall('concrete', R[k], R[(k + 1) % R.length], 0, top, [0.85, 0.85, 0.82]);
      // Yellow safety line along the platform edges.
      for (let k = 0; k < R.length; k++) { const a = R[k], b = R[(k + 1) % R.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 20) continue; const nx = (b[1] - a[1]) / L, nz = -(b[0] - a[0]) / L; this.flatQuad('markYellow', [[a[0] - nx * 0.6, a[1] - nz * 0.6], [b[0] - nx * 0.6, b[1] - nz * 0.6], [b[0] - nx * 0.75, b[1] - nz * 0.75], [a[0] - nx * 0.75, a[1] - nz * 0.75]], top + 0.004); }
    }
    // Rails: NZ 1067 mm gauge, two steel rails per track on sleepers, overhead masts for the electrified line.
    for (const pts of this.map.rails) {
      let acc = 0;
      for (let i = 0; i + 1 < pts.length; i++) {
        const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (!L) continue;
        const u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], n = [-u[1], u[0]];
        for (const g of [-0.5335, 0.5335]) {
          const p = [a[0] + n[0] * g, a[1] + n[1] * g];
          this.b.rect('steel', [p[0] - n[0] * 0.035, kh + 0.18, p[1] - n[1] * 0.035], [u[0], 0, u[1]], [n[0], 0, n[1]], L, 0.07, {});
          this.b.rect('steel', [p[0] + n[0] * 0.035, kh + 0.03, p[1] + n[1] * 0.035], [u[0], 0, u[1]], [0, 1, 0], L, 0.15, {});
          this.b.rect('steel', [p[0] - n[0] * 0.035 + u[0] * L, kh + 0.03, p[1] - n[1] * 0.035 + u[1] * L], [-u[0], 0, -u[1]], [0, 1, 0], L, 0.15, {});
        }
        while (acc < L) { this.inst('sleeper', { x: a[0] + u[0] * acc, y: kh, z: a[1] + u[1] * acc, rot: Math.atan2(u[0], u[1]) }); acc += 0.68; }
        acc -= L;
      }
      let mast = 20;
      for (let i = 0; i + 1 < pts.length; i++) {
        const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (!L) continue;
        const u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], n = [-u[1], u[0]];
        while (mast < L) { const x = a[0] + u[0] * mast + n[0] * 3.2, z = a[1] + u[1] * mast + n[1] * 3.2; this.inst('mast', { x, y: kh, z, rot: Math.atan2(n[0], n[1]) }); this.collision.addCircle(x, z, 0.2, 'pole'); mast += 55; }
        mast -= L;
      }
    }
  }
  // Clendon skatepark: concrete plaza with quarter pipes, a fun box, a ledge and a rail.
  landmarks() {
    const L = MAPDATA.landmarks, kh = ROAD.kerbH;
    if (L.skateRing) {
      const o = this.obb(L.skateRing), long = o.w >= o.d, ang = long ? o.ang : o.ang + Math.PI / 2, len = Math.max(o.w, o.d), wid = Math.min(o.w, o.d);
      const U = [Math.cos(ang), Math.sin(ang)], V = [-U[1], U[0]];
      const at = (u, v) => [o.cx + U[0] * u + V[0] * v, o.cz + U[1] * u + V[1] * v];
      const qp = (u0, dir, width, hgt, depth) => {
        // Curved transition built from strips, with a deck and steel coping.
        const N = 8;
        for (let k = 0; k < N; k++) {
          const t0 = k / N, t1 = (k + 1) / N, a0 = t0 * Math.PI / 2, a1 = t1 * Math.PI / 2;
          const d0 = depth * (1 - Math.cos(a0)), d1 = depth * (1 - Math.cos(a1)); // not used for exact radius; good enough
          const r = depth, y0 = kh + r * (1 - Math.cos(a0)) * (hgt / r), y1 = kh + r * (1 - Math.cos(a1)) * (hgt / r);
          const s0 = u0 - dir * (r - r * Math.sin(a0)), s1 = u0 - dir * (r - r * Math.sin(a1));
          const p = [at(s0, -width / 2), at(s0, width / 2), at(s1, width / 2), at(s1, -width / 2)];
          const nrm = new THREE.Vector3(-dir * U[0] * Math.sin((a0 + a1) / 2), Math.cos((a0 + a1) / 2), -dir * U[1] * Math.sin((a0 + a1) / 2));
          this.face('skate', [[p[0][0], y0, p[0][1]], [p[1][0], y0, p[1][1]], [p[2][0], y1, p[2][1]], [p[3][0], y1, p[3][1]]], nrm, [1.1, 1.1, 1.1], [new THREE.Vector3(V[0], 0, V[1]), new THREE.Vector3(U[0], 0.5, U[1]).normalize()]);
        }
        const deck = [at(u0, -width / 2), at(u0, width / 2), at(u0 + dir * 1.6, width / 2), at(u0 + dir * 1.6, -width / 2)];
        this.flatQuad('skate', deck, kh + hgt, [1.05, 1.05, 1.05]);
        for (const [p, q] of [[deck[0], deck[3]], [deck[1], deck[2]], [deck[3], deck[2]]]) this.wall('skate', q, p, kh, kh + hgt, [0.95, 0.95, 0.95]);
        this.wall('skate', deck[1], deck[0], kh, kh + hgt, [0.95, 0.95, 0.95]);
        const c0 = at(u0, -width / 2), c1 = at(u0, width / 2);
        this.b.setTransform(new THREE.Matrix4().makeRotationY(-ang).setPosition((c0[0] + c1[0]) / 2, kh + hgt, (c0[1] + c1[1]) / 2)); this.b.box('steel', 0, -0.03, 0, 0.08, 0.08, width); this.b.setTransform(null);
        const cc = at(u0 + dir * 0.4, 0); this.collision.addOBB(cc[0], cc[1], depth / 2 + 0.6, width / 2, -ang, 'ramp');
      };
      qp(-len / 2 + 2.2 + 1.6, 1, wid * 0.7, 1.5, 2.2);
      qp(len / 2 - 2.2 - 1.6, -1, wid * 0.6, 1.2, 1.8);
      // Fun box with banks, a ledge and a flat rail.
      const fb = at(0, 0), fw = 2.4, fl = 3.2;
      this.b.setTransform(new THREE.Matrix4().makeRotationY(-ang).setPosition(fb[0], kh, fb[1]));
      this.b.box('skate', 0, 0, 0, fl, 0.5, fw, { tint: [1, 1, 1] });
      this.b.box('skate', 0, 0, wid * 0.32, 4.5, 0.42, 0.5, { tint: [0.9, 0.9, 0.9] });
      this.b.box('steel', 0, 0.42, wid * 0.32 + 0.24, 4.5, 0.05, 0.05);
      this.b.box('darkMetal', 0, 0.35, -wid * 0.3, 5, 0.05, 0.05);
      for (const s of [-2.3, 0, 2.3]) this.b.box('darkMetal', s, 0, -wid * 0.3, 0.05, 0.35, 0.05);
      this.b.setTransform(null);
      this.collision.addOBB(fb[0], fb[1], fl / 2, fw / 2, -ang, 'ramp');
      this.places.skatepark = { pos: new THREE.Vector3(...[at(0, wid * 0.42)].map(p => [p[0], kh, p[1]])[0]), rot: ang };
    }
  }
  // Real buildings and roads beyond the playable area, as simple boxes and ribbons, on a lawn apron.
  farContext() {
    const F = this.map.far;
    for (let k = 0; k < F.b.length; k += 5) {
      const cx = F.b[k], cz = F.b[k + 1], w = F.b[k + 2], d = F.b[k + 3], ang = F.b[k + 4] / 100, big = F.big[k / 5] === '1';
      const U = [Math.cos(ang), Math.sin(ang)], V = [-U[1], U[0]];
      const pts = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([u, v]) => [cx + U[0] * u + V[0] * v, cz + U[1] * u + V[1] * v]);
      if (ringArea(pts) < 0) pts.reverse();
      const H = big ? 6 : 2.8, r = this.hash(k, 90);
      for (let i = 0; i < 4; i++) this.wall(big ? 'tiltslab' : 'plaster', pts[i], pts[(i + 1) % 4], 0, H, tintOf(HOUSE_PAINT[Math.floor(r * HOUSE_PAINT.length)]));
      if (big) this.cap(pts, H, 'trim', [0.5, 0.5, 0.5]);
      else this.roofRect(cx, cz, w, d, ang, H, 0.38, r < 0.55, 'corrugated', tintOf(ROOF_TINT[Math.floor(this.hash(k, 91) * ROOF_TINT.length)]), [0.9, 0.9, 0.88], 0.4);
    }
    F.roads.forEach((pts, i) => {
      const w = F.rw[i] / 20;
      for (let k = 0; k + 1 < pts.length; k++) {
        const a = pts[k], b = pts[k + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (!L) continue;
        const n = [-(b[1] - a[1]) / L * w, (b[0] - a[0]) / L * w];
        this.flatQuad('asphaltFar', [[a[0] - n[0], a[1] - n[1]], [b[0] - n[0], b[1] - n[1]], [b[0] + n[0], b[1] + n[1]], [a[0] + n[0], a[1] + n[1]]], 0.02, [0.92, 0.92, 0.92]);
      }
    });
  }

  // ---------------------------------------------------------------- story places
  storySpots() {
    const m = this.map, kh = ROAD.kerbH;
    // Houses: every residential section, with a front-yard spot facing the street and a footpath spawn.
    m.sections.forEach((s, k) => {
      const bd = m.buildings[s.house]; if (!bd) return;
      const R = bd.ring, e = bd.fe, a = R[e], b = R[(e + 1) % R.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 2) return;
      const nx = (b[1] - a[1]) / L, nz = -(b[0] - a[0]) / L, mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      // Walk outward from the front wall to the street: yard spot 2.5 m out, spawn on the footpath.
      let roadD = null; for (let d = 1; d < 40; d += 0.5) if (isCarriageway(mx + nx * d, mz + nz * d)) { roadD = d; break; }
      if (roadD == null) return;
      const pos = new THREE.Vector3(mx + nx * 2.6, kh, mz + nz * 2.6), sp = new THREE.Vector3(mx + nx * (roadD - 3.6), kh, mz + nz * (roadD - 3.6));
      if (this.collision.collides(pos.x, pos.z, 0.4) || this.collision.collides(sp.x, sp.z, 0.4)) return;
      const rot = Math.atan2(nx, nz);
      this.houses.push({ pos, rot, spawn: { pos: sp, rot: rot + Math.PI }, street: s.street, address: s.street ? `${s.street}` : 'the house', area: bd.c[0] < -300 ? 'clendon' : 'manurewa', ring: 2, building: bd });
    });
    // Named places from the real map.
    const LM = MAPDATA.landmarks, P = (x, z, rot = 0) => ({ pos: new THREE.Vector3(x, groundHeight(x, z), z), rot });
    const free = (x, z) => { for (let r = 0; r < 30; r += 1.5) for (let a = 0; a < 12; a++) { const px = x + Math.cos(a / 12 * TAU) * r, pz = z + Math.sin(a / 12 * TAU) * r; if (!this.collision.collides(px, pz, 0.6) && !isCarriageway(px, pz)) return [px, pz]; } return [x, z]; };
    const place = (key, x, z, name, kind, rot = 0) => { const [px, pz] = free(x, z); const p = { ...P(px, pz, rot), name, kind, place: name }; this.places[key] = p; this.spots.push(p); return p; };
    place('southmallCarpark', 1300, -505, 'the Southmall car park', 'carpark');
    place('norfolkPine', LM.norfolkPine[0] - 4, LM.norfolkPine[1] + 3, 'the big Norfolk pine at Southmall', 'landmark');
    place('station', 1262, -444, 'Manurewa station', 'transport');
    place('clendonShops', -1180, 560, 'the Clendon shops car park', 'carpark');
    place('clendonDairy', -1222, 616, 'outside Clendon Dairy', 'shop');
    place('fishAndChips', -1206, 466, 'Clendon Fish and Chips', 'shop');
    place('teMatariki', -1262, 690, 'Te Matariki library', 'civic');
    place('greatSouthRd', 1470, -500, 'the Great South Road shops', 'shop');
    place('memorial', LM.warMemorial[0] + 4, LM.warMemorial[1], 'the Manurewa war memorial', 'landmark');
    if (this.places.skatepark) { const s = this.places.skatepark; place('skatepark', s.pos.x, s.pos.z, 'Clendon skate park', 'park', s.rot); }
    // A panel shop for Kev: mapped car repair yards near the town centre.
    place('panelShop', 1468, -386, 'the panel shop off Weymouth Road', 'warehouse');
  }
}
