// Run 23: public transport. Buses run the main roads and pull in at the real bus stops: whoever's waiting
// gets on, someone gets off, and you can ride one (TALK at the open door) across the district. Electric
// trains run both tracks through Manurewa station and stop at the platforms. Stay off the tracks.
const BUS_DEST = ['OTAHUHU', 'PAPAKURA', 'MANUKAU', 'CLENDON', 'WEYMOUTH', 'HOMAI', 'BOTANY', 'ŌTARA'];
function signTexture(text, w = 256, h = 40, bg = '#120a02', fg = '#ffb428') {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = fg; g.font = `bold ${Math.round(h * 0.68)}px monospace`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 1);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// A box with a flat vertex colour, ready to merge (front of a vehicle is +z).
function cbox(x0, x1, y0, y1, z0, z1, hex) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).toNonIndexed(); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); g.deleteAttribute('uv');
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
function ccyl(r, w, x, y, z, hex) { const g = new THREE.CylinderGeometry(r, r, w, 14).rotateZ(Math.PI / 2).toNonIndexed(); g.translate(x, y, z); g.deleteAttribute('uv'); const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }

class Transit {
  constructor(world, ctx) {
    this.world = world; this.ctx = ctx; this.scene = world.scene; this.nodes = ctx.traffic.nodes;
    this.stops = MAPDATA.busStops.map(([x, z, rot, name, shelter]) => ({ x, z, rot, name, shelter, last: -1e9 }));
    const tier = world.trafficCount || 8; this.maxBus = tier <= 4 ? 1 : tier <= 8 ? 2 : 3; this.buses = []; this.busT = 3;
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.3 });
    this.lamp = new THREE.MeshBasicMaterial({ color: 0xfff4dc, toneMapped: false }); this.tail = new THREE.MeshBasicMaterial({ color: 0xff2a18, toneMapped: false });
    this.busGeo = this.busGeometry();
    this.now = 0;
    // Trains: the rail lines chained into tracks, each with a stop at the platform.
    this.tracks = this.buildTracks(world.city.map); this.trains = [];
    this.tracks.forEach((T, i) => { T.timer = 25 + i * 120; });
    this.carGeo = [this.trainCarGeometry(true), this.trainCarGeometry(false)];
    this.sound = { hornT: 0, clackT: 0 };
  }
  // ---- buses ------------------------------------------------------------------------------------
  busGeometry() {
    const L = 12, W = 2.5, h = W / 2, P = [], white = 0xf1f3f4, blue = 0x1d4f91, teal = 0x26aebb, glass = 0x0e151b, tyre = 0x141414, grey = 0x9aa1a6;
    P.push(cbox(-h, h, 0.36, 1.4, -L / 2, L / 2, white), cbox(-h - 0.01, h + 0.01, 0.36, 0.78, -L / 2 - 0.01, L / 2 + 0.01, blue), cbox(-h - 0.012, h + 0.012, 1.32, 1.4, -L / 2 - 0.012, L / 2 + 0.012, teal));
    P.push(cbox(-h + 0.01, h - 0.01, 1.4, 2.44, -L / 2 + 0.05, L / 2 - 0.05, glass), cbox(-h, h, 2.44, 3.0, -L / 2, L / 2, white), cbox(-h + 0.3, h - 0.3, 3.0, 3.22, -3.5, 0.5, grey));
    // Window pillars down both sides, and the rear panel.
    for (const sx of [-1, 1]) for (let k = 0; k < 7; k++) { const z = -L / 2 + 0.4 + k * 1.75; if (sx > 0 && z > 3.6) continue; P.push(cbox(sx * h - 0.02, sx * h + 0.02, 1.4, 2.44, z - 0.07, z + 0.07, white)); }
    P.push(cbox(-h, h, 1.4, 2.0, -L / 2 - 0.01, -L / 2 + 0.06, white));
    // Front door (kerb side is the left: +x when facing +z), bumper, wheels.
    P.push(cbox(h - 0.005, h + 0.03, 0.38, 2.42, L / 2 - 1.95, L / 2 - 0.75, glass), cbox(-h - 0.02, h + 0.02, 0.3, 0.55, L / 2 - 0.05, L / 2 + 0.08, 0x202224), cbox(-h - 0.02, h + 0.02, 0.3, 0.55, -L / 2 - 0.08, -L / 2 + 0.05, 0x202224));
    for (const z of [L / 2 - 2.6, -L / 2 + 3.1]) for (const sx of [-1, 1]) { P.push(ccyl(0.5, 0.32, sx * (h - 0.16), 0.5, z, tyre), ccyl(0.3, 0.34, sx * (h - 0.16), 0.5, z, 0xb8bcc0)); }
    return mergeNonIndexedColored(P);
  }
  makeBus(dest) {
    const g = new THREE.Group(), body = new THREE.Mesh(this.busGeo, this.mat); body.castShadow = true; g.add(body);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.28), new THREE.MeshBasicMaterial({ map: signTexture(dest), toneMapped: false })); sign.position.set(0, 2.68, 6.04); g.add(sign);
    for (const sx of [-0.9, 0.9]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.03), this.lamp); l.position.set(sx, 0.92, 6.01); g.add(l); const r = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.03), this.tail); r.position.set(sx * 1.2, 1.1, -6.01); g.add(r); }
    this.scene.add(g); return g;
  }
  busEdges(n) { return n.nb.filter(e => e.vmax >= 12); }
  spawnBus(me) {
    for (let k = 0; k < 80; k++) {
      const i = Math.floor(Math.random() * this.nodes.length), n = this.nodes[i], d = Math.hypot(n.x - me.x, n.z - me.z);
      if (d < 120 || d > 280) continue; const es = this.busEdges(n); if (!es.length) continue;
      const e = es[Math.floor(Math.random() * es.length)], dest = BUS_DEST[Math.floor(Math.random() * BUS_DEST.length)];
      this.buses.push({ dest, g: this.makeBus(dest), from: i, to: e.to, e, t: 0, v: 7, x: n.x, z: n.z, h: 0, state: 'drive', stopT: 0, brake: null, init: true });
      return true;
    }
    return false;
  }
  nextEdge(B) {
    const a = this.nodes[B.from], b = this.nodes[B.to], dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1;
    let opts = this.busEdges(b).filter(e => e.to !== B.from); if (!opts.length) opts = b.nb.filter(e => e.to !== B.from); if (!opts.length) opts = b.nb;
    let best = opts[0], bw = -9;
    for (const e of opts) { const n = this.nodes[e.to], ex = n.x - b.x, ez = n.z - b.z, el = Math.hypot(ex, ez) || 1, w = (ex * dx + ez * dz) / (el * L) + Math.random() * 0.9 + (e.vmax >= 12 ? 1 : 0); if (w > bw) { bw = w; best = e; } }
    B.e = best; B.from = B.to; B.to = best.to; B.t = 0;
  }
  door(B) { const fx = Math.sin(B.h), fz = Math.cos(B.h); return { x: B.x + fx * 4.65 + fz * 1.6, z: B.z + fz * 4.65 - fx * 1.6 }; }
  busFrame(B, dt, me, player) {
    const a = this.nodes[B.from], b = this.nodes[B.to], dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 0.01, ux = dx / L, uz = dz / L;
    if (B.state === 'stop') {
      B.stopT -= dt; B.v = 0;
      if (B.stopT <= 0) { B.state = 'drive'; B.brake = null; B.leaveT = this.now; SFX.play('hiss', clamp(1 - Math.hypot(B.x - me.x, B.z - me.z) / 50, 0, 1)); }
    } else {
      let target = B.e.vmax * 0.85; const remain = L - B.t; if (b.nb.length > 2) target = Math.min(target, 4 + remain * 0.6);
      // Pull in at the next stop on the kerb side.
      if (B.brake == null && this.now - (B.leaveT || -99) > 6) for (const S of this.stops) {
        if (this.now - S.last < 80) continue; const rx = S.x - B.x, rz = S.z - B.z; if (Math.abs(rx) > 30 || Math.abs(rz) > 30) continue;
        const along = rx * ux + rz * uz, lat = rx * uz - rz * ux;
        if (along > 6 && along < 28 && lat > 0.3 && lat < 11) { B.brake = along - 4.65; B.stopAt = S; break; }
      }
      if (B.brake != null) target = Math.min(target, Math.sqrt(2 * 1.6 * Math.max(0, B.brake)) + 0.3);
      const ahead = (ox, oz, gap) => { const rx = ox - B.x, rz = oz - B.z, al = rx * ux + rz * uz, la = Math.abs(-rx * uz + rz * ux); return al > 0 && al < gap && la < 2.3; };
      for (const o of this.ctx.traffic.cars) if (ahead(o.x, o.z, 13)) target = 0;
      for (const o of this.buses) if (o !== B && ahead(o.x, o.z, 15)) target = 0;
      if (ahead(player.x, player.z, 12)) target = 0;
      B.v = target < B.v ? Math.max(target, B.v - 5 * dt) : Math.min(target, B.v + 1.6 * dt);
      const step = B.v * dt; B.t += step; if (B.brake != null) B.brake -= step;
      if (B.brake != null && B.brake <= 0.25) { B.state = 'stop'; B.stopT = 9 + Math.random() * 3; B.v = 0; B.stopAt.last = this.now; SFX.play('hiss', clamp(1 - Math.hypot(B.x - me.x, B.z - me.z) / 50, 0, 1)); this.ctx.onBusStop && this.ctx.onBusStop(B, B.stopAt, this.door(B)); }
      if (B.t >= L) { B.t -= L; this.nextEdge(B); }
    }
    const A = this.nodes[B.from], C = this.nodes[B.to], ex = C.x - A.x, ez = C.z - A.z, el = Math.hypot(ex, ez) || 0.01, vx = ex / el, vz = ez / el, lane = B.e.lane + 0.3;
    const tx = A.x + vx * Math.min(B.t, el) + vz * lane, tz = A.z + vz * Math.min(B.t, el) - vx * lane;
    if (B.init) { B.x = tx; B.z = tz; B.h = Math.atan2(vx, vz); B.init = false; }
    const k = 1 - Math.exp(-dt * 4); B.x = lerp(B.x, tx, k); B.z = lerp(B.z, tz, k); B.h += wrapA(Math.atan2(vx, vz) - B.h) * k;
    B.g.position.set(B.x, groundHeight(B.x, B.z) * 0.2, B.z); B.g.rotation.y = B.h;
  }
  // Put a bus at the stop nearest (x, z), doors open (where you get off after a ride).
  busAt(S) {
    let best = null, bd = 1e9;
    for (let i = 0; i < this.nodes.length; i++) { const n = this.nodes[i]; if (Math.abs(n.x - S.x) > 120 || Math.abs(n.z - S.z) > 120) continue; for (const e of this.busEdges(n)) {
      const m = this.nodes[e.to], dx = m.x - n.x, dz = m.z - n.z, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L, rx = S.x - n.x, rz = S.z - n.z, along = rx * ux + rz * uz, lat = rx * uz - rz * ux;
      if (along < 5 || along > L || lat < 0.3 || lat > 12) continue; const sc = lat + Math.abs(along - L / 2) * 0.01; if (sc < bd) { bd = sc; best = { i, e, t: along - 4.65 }; }
    } }
    if (!best) return null;
    let B = this.buses[0]; if (!B) { this.spawnBus({ x: 1e5, z: 1e5 }); B = this.buses[0]; if (!B) { B = { g: this.makeBus('MANUKAU'), v: 0, h: 0 }; this.buses.push(B); } }
    Object.assign(B, { from: best.i, to: best.e.to, e: best.e, t: Math.max(0, best.t), state: 'stop', stopT: 6, brake: null, init: true, v: 0 }); S.last = this.now; B.leaveT = this.now;
    return B;
  }
  busNear(p, r = 3.6) { for (const B of this.buses) { if (B.state !== 'stop') continue; const d = this.door(B); if (Math.hypot(d.x - p.x, d.z - p.z) < r) return B; } return null; }
  nearestStop(x, z) { let best = null, bd = 1e9; for (const S of this.stops) { const d = Math.hypot(S.x - x, S.z - z); if (d < bd) { bd = d; best = S; } } return best; }
  // ---- trains -----------------------------------------------------------------------------------
  buildTracks(map) {
    const lines = map.rails.map(p => p.map(q => [q[0], q[1]])), used = new Set(), out = [], near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1.5;
    for (let i = 0; i < lines.length; i++) {
      if (used.has(i)) continue; used.add(i); let pts = lines[i].slice(), grown = true;
      while (grown) {
        grown = false;
        for (let j = 0; j < lines.length; j++) {
          if (used.has(j)) continue; const L = lines[j];
          if (near(pts[pts.length - 1], L[0])) pts = pts.concat(L.slice(1));
          else if (near(pts[0], L[L.length - 1])) pts = L.slice(0, -1).concat(pts);
          else if (near(pts[pts.length - 1], L[L.length - 1])) pts = pts.concat(L.slice(0, -1).reverse());
          else if (near(pts[0], L[0])) pts = L.slice(1).reverse().concat(pts);
          else continue;
          used.add(j); grown = true;
        }
      }
      const s = [0]; for (let k = 1; k < pts.length; k++) s.push(s[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
      if (s[s.length - 1] > 400) out.push({ pts, s, L: s[s.length - 1] });
    }
    // The platform each track stops at.
    const plats = (map.platforms || []).map(r => { let x = 0, z = 0; for (const p of r) { x += p[0]; z += p[1]; } return { x: x / r.length, z: z / r.length }; });
    for (const T of out) {
      T.station = null; let bd = 22;
      for (const P of plats) for (let k = 0; k + 1 < T.pts.length; k++) {
        const a = T.pts[k], b = T.pts[k + 1], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1, u = clamp(((P.x - a[0]) * dx + (P.z - a[1]) * dz) / L2, 0, 1), d = Math.hypot(a[0] + dx * u - P.x, a[1] + dz * u - P.z);
        if (d < bd) { bd = d; T.station = T.s[k] + u * Math.sqrt(L2); T.platform = P; }
      }
    }
    return out;
  }
  sample(T, s, out = {}) {
    s = clamp(s, 0, T.L); let lo = 0, hi = T.s.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T.s[m] <= s) lo = m; else hi = m; }
    const a = T.pts[lo], b = T.pts[hi], seg = T.s[hi] - T.s[lo] || 1, u = (s - T.s[lo]) / seg; out.x = a[0] + (b[0] - a[0]) * u; out.z = a[1] + (b[1] - a[1]) * u; return out;
  }
  trainCarGeometry(cab) {
    // An electric multiple unit car: 24 m, white with a dark-blue skirt, black window band, grey roof; the cab
    // end (+z) gets a yellow nose and a big windscreen.
    const L = 23.6, W = 2.76, h = W / 2, P = [], z0 = -L / 2, z1 = L / 2;
    P.push(cbox(-h, h, 1.05, 3.9, z0, z1, 0xe9edf0), cbox(-h - 0.01, h + 0.01, 1.05, 1.6, z0 - 0.01, z1 + 0.01, 0x1c2f5e), cbox(-h - 0.012, h + 0.012, 2.25, 3.05, z0 + 0.6, z1 - (cab ? 2.4 : 0.6), 0x0d1216));
    P.push(cbox(-h + 0.1, h - 0.1, 3.9, 4.15, z0 + 0.3, z1 - 0.3, 0x8d9398), cbox(-h + 0.3, h - 0.3, 0.55, 1.05, z0 + 1.5, z0 + 4.2, 0x222426), cbox(-h + 0.3, h - 0.3, 0.55, 1.05, z1 - 4.2, z1 - 1.5, 0x222426));
    for (const sx of [-1, 1]) for (const z of [-5.5, 5.5]) P.push(cbox(sx * h - 0.02, sx * h + 0.02, 1.15, 3.35, z - 0.7, z + 0.7, 0x5c6266), cbox(sx * h - 0.025, sx * h + 0.025, 2.2, 3.15, z - 0.55, z + 0.55, 0x0d1216));
    for (const z of [z0 + 2.8, z1 - 2.8]) for (const sx of [-1, 1]) P.push(ccyl(0.42, 0.14, sx * 0.54, 0.42, z - 0.9, 0x2a2a2a), ccyl(0.42, 0.14, sx * 0.54, 0.42, z + 0.9, 0x2a2a2a));
    if (cab) P.push(cbox(-h + 0.02, h - 0.02, 1.05, 2.25, z1 - 0.02, z1 + 0.25, 0xf2c300), cbox(-h + 0.12, h - 0.12, 2.25, 3.4, z1 - 0.3, z1 + 0.05, 0x0d1216));
    else P.push(cbox(-h + 0.2, h - 0.2, 1.1, 3.8, z1 - 0.02, z1 + 0.42, 0x2a2c2e), cbox(-0.5, 0.5, 4.15, 4.25, -2, 2, 0x55595d), cbox(-0.04, 0.04, 4.25, 4.95, -0.9, 0.9, 0x3a3d40));
    return mergeNonIndexedColored(P);
  }
  makeTrain(T) {
    const cars = [];
    for (let i = 0; i < 3; i++) {
      const cab = i === 0 || i === 2, m = new THREE.Mesh(this.carGeo[cab ? 0 : 1], this.mat); m.castShadow = true;
      if (i === 2) m.geometry = this.carGeo[0]; // the rear cab faces backwards (rotated below)
      const g = new THREE.Group(); g.add(m); if (i === 2) m.rotation.y = Math.PI;
      if (i === 0) for (const sx of [-0.8, 0.8]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.04), this.lamp); l.position.set(sx, 1.5, 12.06); g.add(l); }
      if (i === 2) for (const sx of [-0.8, 0.8]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.04), this.tail); l.position.set(sx, 1.5, -12.06); g.add(l); }
      this.scene.add(g); cars.push(g);
    }
    return { T, cars, s: 0, v: 14, state: 'run', stopT: 0, honked: false, len: 3 * 24.4 };
  }
  trainFrame(R, dt, me) {
    const T = R.T, center = T.station != null ? T.station + R.len / 2 : null;
    if (R.state === 'stop') { R.stopT -= dt; if (R.stopT <= 0) { R.state = 'go'; this.horn(R, me, 0.7); } }
    else {
      let target = 22;
      if (R.state === 'run' && center != null && R.s < center) { target = Math.min(target, Math.sqrt(2 * 0.9 * Math.max(0, center - R.s)) + 0.2); if (center - R.s < 0.6) { R.state = 'stop'; R.stopT = 22; R.v = 0; R.s = center; this.ctx.onTrainStop && this.ctx.onTrainStop(R, T.platform); } }
      if (R.state !== 'stop') { R.v = target < R.v ? Math.max(target, R.v - 1.2 * dt) : Math.min(target, R.v + 0.9 * dt); R.s += R.v * dt; }
      if (!R.honked && center != null && R.state === 'run' && center - R.s < 380) { R.honked = true; this.horn(R, me, 1); }
    }
    const p = {}, f = {}, b = {}; let nearest = 1e9;
    R.cars.forEach((g, i) => {
      const c = R.s - (i + 0.5) * 24.4; this.sample(T, c + 8.5, f); this.sample(T, c - 8.5, b); this.sample(T, c, p);
      g.position.set(p.x, ROAD.kerbH + 0.215, p.z); g.rotation.y = Math.atan2(f.x - b.x, f.z - b.z);
      nearest = Math.min(nearest, Math.hypot(p.x - me.x, p.z - me.z));
    });
    R.cars.forEach(g => { g.visible = nearest < 700; });
    R.near = nearest;
    return R.s - R.len > T.L;
  }
  horn(R, me, k) { const d = R.near ?? Math.hypot(R.cars[0].position.x - me.x, R.cars[0].position.z - me.z); if (d < 600) SFX.play('trainHorn', clamp(1 - d / 600, 0.05, 1) * k); }
  // On the tracks in front of a moving train? (x, z) is you; returns the car that hit you.
  trainHit(x, z) {
    for (const R of this.trains) { if (R.v < 2 || R.near > 40) continue; for (const g of R.cars) { const fx = Math.sin(g.rotation.y), fz = Math.cos(g.rotation.y), rx = x - g.position.x, rz = z - g.position.z, al = rx * fx + rz * fz, la = rx * fz - rz * fx; if (Math.abs(al) < 12.5 && Math.abs(la) < 1.9) return R; } }
    return null;
  }
  obstacles() {
    const out = [];
    for (const B of this.buses) { const fx = Math.sin(B.h), fz = Math.cos(B.h); for (const k of [-4.5, -1.5, 1.5, 4.5]) out.push({ x: B.x + fx * k, z: B.z + fz * k, r: 1.3, bus: B }); }
    for (const R of this.trains) if (R.near < 60) for (const g of R.cars) { const fx = Math.sin(g.rotation.y), fz = Math.cos(g.rotation.y); for (const k of [-9, -4.5, 0, 4.5, 9]) out.push({ x: g.position.x + fx * k, z: g.position.z + fz * k, r: 1.45, train: R }); }
    return out;
  }
  // ---- per frame ----------------------------------------------------------------------------------
  update(dt, me, player) {
    this.now += dt;
    // Buses: a couple about whenever there's someone to carry (fewer after 11, none from 1 to 5 am).
    const c = this.world.clock, want = c && c.between(1, 5) ? 0 : c && c.between(23, 1) ? 1 : this.maxBus;
    if (this.buses.length < want && (this.busT -= dt) <= 0) { this.busT = 6; this.spawnBus(me); }
    for (let i = this.buses.length - 1; i >= 0; i--) {
      const B = this.buses[i], d = Math.hypot(B.x - me.x, B.z - me.z);
      if ((d > 380 || (this.buses.length > want && d > 150)) && B.state !== 'stop') { this.scene.remove(B.g); this.buses.splice(i, 1); continue; }
      this.busFrame(B, dt, me, player);
    }
    // Trains: one each way every few minutes, from 5 am to midnight.
    const running = !c || !c.between(0.5, 5);
    for (const T of this.tracks) if ((T.timer -= dt) <= 0) { T.timer = 230 + Math.random() * 60; if (running) this.trains.push(this.makeTrain(T)); }
    let rumble = 0;
    for (let i = this.trains.length - 1; i >= 0; i--) {
      const R = this.trains[i];
      if (this.trainFrame(R, dt, me)) { for (const g of R.cars) this.scene.remove(g); this.trains.splice(i, 1); continue; }
      rumble = Math.max(rumble, clamp(1 - R.near / 160, 0, 1) * clamp(R.v / 14, 0.15, 1));
      if (R.near < 120 && R.v > 3 && (this.sound.clackT -= dt * R.v / 20) <= 0) { this.sound.clackT = 0.55; SFX.play('clack', clamp(1 - R.near / 120, 0, 1)); }
    }
    SFX.rumble(rumble);
  }
  // Debug/test: a train now, and where things are.
  trainNow(i = 0, stopped = false) { const T = this.tracks[i]; if (T) { const R = this.makeTrain(T); if (T.station != null) R.s = Math.max(0, T.station - 160); R.v = 14; if (stopped && T.station != null) { R.s = T.station + R.len / 2; R.state = 'stop'; R.stopT = 120; R.v = 0; } this.trains.push(R); return R; } return null; }
}
