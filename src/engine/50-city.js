// District layout. Roads keep the original 55 m grid (lines at -220..220), so mission coordinates,
// waypoints and saves stay valid. The space between carriageways is a raised "island" (kerb height)
// holding footpaths, lots and buildings. The town square replaces the old central plaza radius.
const PLAZA = 34;
const BAND = { kerbTop: 0.3, footpath: 4.0 };
const OUTER = 302.5;

class City {
  constructor(lib, scene, quality) {
    this.lib = lib; this.scene = scene; this.q = quality;
    this.b = new GeoBuilder(lib);
    this.collision = new CollisionGrid(8);
    this.rng = mulberry32(20261031);
    this.lights = [];      // streetlight lamp positions (night lighting)
    this.cars = [];        // parked car placements
    this.trees = [];       // tree placements
    this.poles = [];       // power pole placements (wires)
    this.instances = {};   // instanced prop placements by kind
    this.signs = [];       // shop signs
  }
  r(a = 0, b = 1) { return a + (b - a) * this.rng(); }
  pick(arr) { return arr[Math.floor(this.rng() * arr.length)]; }

  // Horizontal convex polygon at height y; winding fixed so the face points up.
  flat(key, pts, y, tint) {
    let area = 0;
    for (let i = 0; i < pts.length; i++) { const a = pts[i], c = pts[(i + 1) % pts.length]; area += a[0] * c[1] - c[0] * a[1]; }
    const p = area > 0 ? pts.slice().reverse() : pts;
    const s = this.lib.scale(key);
    this.b.poly(key, p.map(q => [q[0], y, q[1]]), [0, 1, 0], p.flatMap(q => [q[0] / s, -q[1] / s]), null, null, tint);
  }
  // Vertical quad between ground points a and b, facing `out` (2D direction).
  vquad(key, a, b, y0, y1, out, opt = {}) {
    let p = a, q = b;
    const dx = q[0] - p[0], dz = q[1] - p[1];
    if (-dz * out[0] + dx * out[1] < 0) { p = b; q = a; } // rect normal is (-dz, dx); flip to face `out`
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const u = [(q[0] - p[0]) / len, 0, (q[1] - p[1]) / len];
    this.b.rect(key, [p[0], y0, p[1]], u, [0, 1, 0], len, y1 - y0, { uv0: [opt.u0 || 0, y0], ao: opt.ao, tint: opt.tint });
  }

  async build(progress = () => { }) {
    this.buildBaseRoads();
    const step = ROAD.spacing;
    let n = 0;
    for (let bi = -5; bi <= 4; bi++) for (let bj = -5; bj <= 4; bj++) {
      const x0 = bi === -5 ? -OUTER : bi * step + ROAD.half, x1 = bi === 4 ? OUTER : (bi + 1) * step - ROAD.half;
      const z0 = bj === -5 ? -OUTER : bj * step + ROAD.half, z1 = bj === 4 ? OUTER : (bj + 1) * step - ROAD.half;
      const island = { bi, bj, x0, x1, z0, z1, edges: { w: bi !== -5, e: bi !== 4, s: bj !== -5, n: bj !== 4 } };
      island.ring = Math.max(Math.abs(bi + 0.5), Math.abs(bj + 0.5)) - 0.5;
      island.zone = this.zoneFor(island);
      this.buildIsland(island);
      if (++n % 5 === 0) { progress(n / 100); await nextTick(); }
    }
    this.buildPlaza();
    this.buildMarkings();
  }
  zoneFor(s) {
    if (s.ring >= 4) return 'rural';
    if (s.ring === 0) return 'core';
    if (s.ring === 1) return (s.bi === -1 || s.bi === 0 || s.bj === -1 || s.bj === 0) ? 'mainstreet' : 'mixed';
    if (s.bi === 1 && s.bj === -3) return 'park';
    if (s.bi === 3 || (s.bj === -4 && s.bi >= 0)) return 'industrial';
    return 'residential';
  }

  buildBaseRoads() {
    const step = ROAD.spacing;
    for (let i = -5; i <= 5; i++) for (let j = -5; j <= 5; j++) {
      const cx = i * step, cz = j * step, h = step / 2;
      const ring = Math.max(Math.abs(i), Math.abs(j));
      const key = ring <= 1 ? 'asphalt' : 'chipseal';
      this.flat(key, [[cx - h, cz - h], [cx + h, cz - h], [cx + h, cz + h], [cx - h, cz + h]], 0);
    }
  }

  // Rounded-rectangle island: kerb face + kerb top + gutter + surface, corners rounded at real road corners.
  buildIsland(s) {
    const R = ROAD.corner, kh = ROAD.kerbH, kt = BAND.kerbTop, seg = 6;
    const corners = [
      { x: s.x0, z: s.z0, sx: 1, sz: 1, round: s.edges.w && s.edges.s },
      { x: s.x1, z: s.z0, sx: -1, sz: 1, round: s.edges.e && s.edges.s },
      { x: s.x1, z: s.z1, sx: -1, sz: -1, round: s.edges.e && s.edges.n },
      { x: s.x0, z: s.z1, sx: 1, sz: -1, round: s.edges.w && s.edges.n },
    ];
    // Outline (inset by d) as a convex polygon, used for the island surface.
    const outline = d => {
      const pts = [];
      for (const c of corners) {
        if (!c.round) { pts.push([c.x + c.sx * d, c.z + c.sz * d]); continue; }
        const cx = c.x + c.sx * R, cz = c.z + c.sz * R, rr = R - d;
        const a0 = Math.atan2(-c.sz, 0), a1 = Math.atan2(0, -c.sx);
        let da = a1 - a0; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
        const arc = [];
        for (let k = 0; k <= seg; k++) { const a = a0 + da * k / seg; arc.push([cx + Math.cos(a) * rr, cz + Math.sin(a) * rr]); }
        pts.push(...(c === corners[0] || c === corners[2] ? arc.reverse() : arc));
      }
      return pts;
    };
    const surfKey = { core: 'concrete', mainstreet: 'concrete', mixed: 'concrete', residential: 'grass', park: 'grass', industrial: 'concrete', rural: 'grass' }[s.zone];
    const top = outline(kt);
    this.fixOrder(top);
    this.flat(surfKey, top, kh);
    // Kerb faces, kerb tops and gutters along the outline (only on edges that border a road).
    const ring0 = outline(0), ringIn = outline(kt), ringOut = outline(-0.35);
    this.fixOrder(ring0); this.fixOrder(ringIn); this.fixOrder(ringOut);
    const n = ring0.length;
    for (let k = 0; k < n; k++) {
      const a = ring0[k], c = ring0[(k + 1) % n];
      const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2;
      if (!this.bordersRoad(s, mx, mz)) continue;
      if (Math.abs(mx) < PLAZA && Math.abs(mz) < PLAZA) continue;
      const ox = mx - (s.x0 + s.x1) / 2, oz = mz - (s.z0 + s.z1) / 2; // outward-ish
      const ex = c[0] - a[0], ez = c[1] - a[1];
      let nx = ez, nz = -ex; if (nx * ox + nz * oz < 0) { nx = -nx; nz = -nz; }
      this.vquad('kerb', a, c, 0, kh, [nx, nz]);
      const ai = ringIn[k], ci = ringIn[(k + 1) % n], ao = ringOut[k], co = ringOut[(k + 1) % n];
      this.flat('kerb', [a, c, ci, ai], kh);
      this.flat('channel', [ao, co, c, a], 0.003);
    }
    const g = this.zoneGen[s.zone];
    if (g) g.call(this, s);
  }
  fixOrder(pts) { // outline() builds corners in a fixed order; make sure it is consistently clockwise in (x,z)
    let area = 0;
    for (let i = 0; i < pts.length; i++) { const a = pts[i], c = pts[(i + 1) % pts.length]; area += a[0] * c[1] - c[0] * a[1]; }
    if (area > 0) pts.reverse();
  }
  bordersRoad(s, x, z) {
    const eps = 0.6;
    if (s.edges.w && x < s.x0 + ROAD.corner + eps) return true;
    if (s.edges.e && x > s.x1 - ROAD.corner - eps) return true;
    if (s.edges.s && z < s.z0 + ROAD.corner + eps) return true;
    if (s.edges.n && z > s.z1 - ROAD.corner - eps) return true;
    return false;
  }

  buildPlaza() {
    const P = PLAZA, kh = ROAD.kerbH;
    this.flat('plazaPavers', [[-P, -P], [P, -P], [P, P], [-P, P]], kh);
    // Kerbs where the two main roads meet the square, with bollards to keep cars out.
    for (const [ax, az] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const H = ROAD.half;
      const a = ax ? [ax * P, -H] : [-H, az * P], c = ax ? [ax * P, H] : [H, az * P];
      this.vquad('kerb', a, c, 0, kh, [ax, az]);
      for (let t = -H + 0.8; t <= H - 0.8; t += 1.6) {
        const bx = ax ? ax * (P - 0.6) : t, bz = ax ? t : az * (P - 0.6);
        this.b.cylinder('darkMetal', bx, kh, bz, 0.11, 0.1, 0.95, 8, { cap: true });
        this.collision.add(bx, bz, 0.3, 0.3, 'bollard');
      }
    }
    // Memorial obelisk on a stepped plinth, off the spawn-to-fixer line so the fixer stays in view.
    const mx = 11.5, mz = -11.5;
    this.b.box('stone', mx, kh, mz, 4.4, 0.3, 4.4, { aoBottom: 0.7 });
    this.b.box('stone', mx, kh + 0.3, mz, 3.4, 0.3, 3.4);
    this.b.box('stone', mx, kh + 0.6, mz, 1.6, 1.4, 1.6);
    this.b.cylinder('stone', mx, kh + 2.0, mz, 0.55, 0.22, 5.2, 4, { cap: true });
    this.collision.add(mx, mz, 4.4, 4.4, 'memorial');
    // Compass-rose inlay at the centre of the square.
    for (let k = 0; k < 16; k++) {
      const a0 = k / 16 * TAU, a1 = (k + 1) / 16 * TAU, r0 = k % 2 ? 1.2 : 2.3;
      this.flat('paint', [[0, 0], [Math.sin(a0) * (k % 2 ? 2.3 : 1.2), Math.cos(a0) * (k % 2 ? 2.3 : 1.2)], [Math.sin(a1) * r0, Math.cos(a1) * r0]], kh + 0.004, [0.42, 0.4, 0.37]);
    }
    // Benches and planters on rings that avoid the crew-contact circle (r = 25).
    for (let i = 0; i < 8; i++) {
      const a = (i + 0.5) / 8 * TAU, r = 15.5, x = Math.sin(a) * r, z = Math.cos(a) * r;
      this.bench(x, z, a);
    }
    for (let i = 0; i < 14; i++) {
      const a = (i + 0.5) / 14 * TAU, r = 31;
      const x = Math.sin(a) * r, z = Math.cos(a) * r;
      if (Math.abs(x) < 7 || Math.abs(z) < 7) continue;
      this.trees.push({ x, z, kind: i % 3 === 0 ? 'cabbage' : 'broad', s: 0.9 + this.rng() * 0.3, y: kh });
      this.b.box('stone', x, kh, z, 2.2, 0.45, 2.2, { aoBottom: 0.75 });
      this.flat('dirt', [[x - 1, z - 1], [x + 1, z - 1], [x + 1, z + 1], [x - 1, z + 1]], kh + 0.46);
      this.collision.add(x, z, 2.2, 2.2, 'planter');
    }
    // Streetlights around the square.
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU, x = Math.sin(a) * 20.5, z = Math.cos(a) * 20.5;
      this.instances.plazaLamp = this.instances.plazaLamp || [];
      this.instances.plazaLamp.push({ x, y: kh, z, rot: a });
      this.lights.push(new THREE.Vector3(x, kh + 4.1, z));
      this.collision.add(x, z, 0.35, 0.35, 'lamp');
    }
  }
  bench(x, z, a) {
    const m = new THREE.Matrix4().makeRotationY(a).setPosition(x, ROAD.kerbH, z);
    this.b.setTransform(m);
    this.b.box('timber', 0, 0.42, 0, 1.8, 0.06, 0.45);
    this.b.box('timber', 0, 0.5, 0.2, 1.8, 0.4, 0.05);
    for (const sx of [-0.75, 0.75]) this.b.box('darkMetal', sx, 0, 0, 0.06, 0.42, 0.4);
    this.b.setTransform(null);
  }

  buildMarkings() {
    const step = ROAD.spacing, y = 0.006, P = PLAZA;
    const white = new THREE.Color(0xf4f2ec), yellow = new THREE.Color(0xe8b923);
    const strip = (x0, z0, x1, z1, tint) => this.flat('paint', [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], y, tint ? [tint.r, tint.g, tint.b] : null);
    for (let i = -4; i <= 4; i++) {
      const c = i * step;
      const segments = [[-OUTER, -229.5, false, true]];
      for (let k = -4; k < 4; k++) segments.push([k * step + 9.5, (k + 1) * step - 9.5, true, true]);
      segments.push([229.5, OUTER, true, false]);
      for (const [a, b, endA, endB] of segments) {
        for (const along of ['z', 'x']) {
          // Centre line: 3 m dash, 7 m gap.
          for (let t = a + 2; t + 3 < b; t += 10) {
            if (i === 0 && Math.abs(t + 1.5) < P + 1) continue;
            if (along === 'z') strip(c - 0.05, t, c + 0.05, t + 3, white); else strip(t, c - 0.05, t + 3, c + 0.05, white);
          }
          // Limit lines across the left-hand lane and broken yellow no-stopping lines near each corner.
          for (const end of [a, b]) {
            const dir = end === a ? 1 : -1;
            if ((end === a && !endA) || (end === b && !endB)) continue;
            if (i === 0 && Math.abs(end) < P + 10) continue;
            const t0 = end + dir * 0.6, t1 = t0 + dir * 0.3;
            const side = along === 'z' ? -dir : dir; // NZ: keep left
            const l0 = c, l1 = c + side * ROAD.half * 0.92;
            if (along === 'z') strip(Math.min(l0, l1), Math.min(t0, t1), Math.max(l0, l1), Math.max(t0, t1), white);
            else strip(Math.min(t0, t1), Math.min(l0, l1), Math.max(t0, t1), Math.max(l0, l1), white);
            for (const ks of [-1, 1]) {
              const kx = c + ks * (ROAD.half - 0.55);
              for (let d = 0; d < 7; d += 2) {
                const s0 = end + dir * (1.5 + d), s1 = s0 + dir * 1;
                if (along === 'z') strip(kx - 0.05, Math.min(s0, s1), kx + 0.05, Math.max(s0, s1), yellow);
                else strip(Math.min(s0, s1), kx - 0.05, Math.max(s0, s1), kx + 0.05, yellow);
              }
            }
          }
        }
      }
    }
    // Zebra crossings on the main roads just outside the square, with orange-disc posts.
    for (const [ax, az] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const t = (P + 6) * (ax || az);
      for (let w = -ROAD.half + 0.5; w < ROAD.half - 0.5; w += 1.2) {
        if (ax) strip(t - 1.5, w, t + 1.5, w + 0.6, white); else strip(w, t - 1.5, w + 0.6, t + 1.5, white);
      }
      for (const s of [-1, 1]) {
        const px = ax ? t : s * (ROAD.half + 0.7), pz = ax ? s * (ROAD.half + 0.7) : t;
        this.instances.zebraPost = this.instances.zebraPost || [];
        this.instances.zebraPost.push({ x: px, y: ROAD.kerbH, z: pz, rot: 0 });
        this.collision.add(px, pz, 0.3, 0.3, 'post');
      }
    }
  }
  finish() { return this.b.finish(this.scene); }
}
City.prototype.zoneGen = {};
