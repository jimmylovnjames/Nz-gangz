// Zone generators: what fills each island. Local frames come from frameFor()/frameRaw().
// Street names (NZ trees along x, birds along z) so houses get real-sounding addresses.
const STREETS_X = ['Kauri Rd', 'Rimu St', 'Tōtara Ave', 'Mataī St', 'Kōwhai St', 'Pūriri St', 'Nīkau Pl', 'Rātā St', 'Miro St'];
const STREETS_Z = ['Tūī St', 'Kererū Rd', 'Pīwakawaka Ave', 'Kea St', 'Kākā Rd', 'Weka St', 'Takahē Pl', 'Ruru St', 'Kōtare St'];
Object.assign(City.prototype, {
  streetFor(s, side) {
    const i = side === 'w' ? s.x0 - ROAD.half : side === 'e' ? s.x1 + ROAD.half : side === 's' ? s.z0 - ROAD.half : s.z1 + ROAD.half;
    const k = clamp(Math.round(i / ROAD.spacing), -4, 4) + 4;
    return side === 'w' || side === 'e' ? STREETS_X[k] : STREETS_Z[k];
  },
  split(len, min, max) {
    const out = []; let left = len;
    while (left > max) { const w = min + this.rng() * (max - min); if (left - w < min) break; out.push(w); left -= w; }
    out.push(left);
    return out;
  },
  frontage(s, side) {
    const F = BAND.footpath, L = this.sideLength(s, side), e = s.edges;
    const a = { s: e.w, n: e.e, w: e.n, e: e.s }[side], b = { s: e.e, n: e.w, w: e.s, e: e.n }[side];
    return [a ? F : 0, L - (b ? F : 0)];
  },
  local(m, x, z, y = 0) { return new THREE.Vector3(x, y, z).applyMatrix4(m); },
  sideNormal(side) { return { s: [0, -1], n: [0, 1], w: [-1, 0], e: [1, 0] }[side]; },
  nextSign() { this.signIndex = ((this.signIndex ?? Math.floor(this.rng() * 28)) + 7) % 28; return this.signIndex; },

  // Kerbside furniture shared by every zone: parked cars, streetlights or power poles, street trees.
  streetside(s, side, opts) {
    if (!s.edges[side]) return;
    const [t0, t1] = this.frontage(s, side), n = this.sideNormal(side);
    const inPlaza = p => Math.abs(p.x) < PLAZA + 2 && Math.abs(p.z) < PLAZA + 2;
    const nearZebra = p => (Math.abs(p.x) < 7 && Math.abs(Math.abs(p.z) - PLAZA - 6) < 6) || (Math.abs(p.z) < 7 && Math.abs(Math.abs(p.x) - PLAZA - 6) < 6);
    if (opts.cars) for (let t = t0 + 7; t < t1 - 7; t += 6.4) {
      if (this.rng() > opts.cars) continue;
      const m = this.frameFor(s, side, t), p = this.local(m, 0, -BAND.footpath - 1.15);
      if (inPlaza(p) || nearZebra(p)) continue;
      // Car model faces +z; heading keeps the kerb on the driver's left (NZ drives on the left).
      this.cars.push({ x: p.x, z: p.z, rot: Math.atan2(n[1], -n[0]), type: Math.floor(this.rng() * 4), color: this.rng() });
      const along = side === 's' || side === 'n';
      this.collision.add(p.x, p.z, along ? 4.4 : 1.9, along ? 1.9 : 4.4, 'car');
    }
    if (opts.lights) for (let t = t0 + 6 + (opts.offset || 0); t < t1 - 3; t += opts.lights) {
      const m = this.frameFor(s, side, t), p = this.local(m, 0, -BAND.footpath + 0.55);
      if (inPlaza(p)) continue;
      const rot = Math.atan2(n[0], n[1]);
      (this.instances.streetlight = this.instances.streetlight || []).push({ x: p.x, y: ROAD.kerbH, z: p.z, rot });
      this.lights.push(new THREE.Vector3(p.x + n[0] * 2.1, ROAD.kerbH + 7.6, p.z + n[1] * 2.1));
      this.collision.add(p.x, p.z, 0.35, 0.35, 'pole');
    }
    if (opts.poles) {
      let prev = null;
      for (let t = t0 + 4; t <= t1 - 3; t += opts.poles) {
        const m = this.frameFor(s, side, t), p = this.local(m, 0, -BAND.footpath + 0.5);
        const rot = Math.atan2(n[0], n[1]);
        const light = Math.round(t / opts.poles) % 2 === 0;
        (this.instances.pole = this.instances.pole || []).push({ x: p.x, y: ROAD.kerbH, z: p.z, rot, light });
        if (light) this.lights.push(new THREE.Vector3(p.x + n[0] * 1.9, ROAD.kerbH + 8.2, p.z + n[1] * 1.9));
        this.collision.add(p.x, p.z, 0.4, 0.4, 'pole');
        if (prev) this.poles.push([prev, p]);
        prev = p;
      }
    }
    if (opts.trees) for (let t = t0 + 5 + this.rng() * 4; t < t1 - 4; t += opts.trees + this.rng() * 6) {
      const m = this.frameFor(s, side, t), p = this.local(m, 0, -BAND.footpath + 1.0);
      if (inPlaza(p) || this.collision.collides(p.x, p.z, 1.2)) continue;
      this.trees.push({ x: p.x, z: p.z, y: ROAD.kerbH, kind: this.rng() < 0.25 ? 'cabbage' : 'broad', s: 0.75 + this.rng() * 0.35 });
      this.collision.add(p.x, p.z, 0.45, 0.45, 'tree');
    }
    if (opts.bins) for (let t = t0 + 10; t < t1 - 6; t += opts.bins) {
      if (this.rng() < 0.4) continue;
      const m = this.frameFor(s, side, t), p = this.local(m, 0, -BAND.footpath + 0.7);
      if (inPlaza(p)) continue;
      (this.instances.bin = this.instances.bin || []).push({ x: p.x, y: ROAD.kerbH, z: p.z, rot: Math.atan2(n[0], n[1]) + (this.rng() - 0.5) * 0.4, lid: this.rng() < 0.5 ? 0 : 1 });
    }
  },
  footpathStrips(s) {
    // Residential berms: concrete footpath 1.6-3.0 m back from the kerb face.
    const kh = ROAD.kerbH + 0.001, a = 1.6, b = 3.0;
    if (s.edges.s) this.flat('path', [[s.x0 + (s.edges.w ? a : 0), s.z0 + a], [s.x1 - (s.edges.e ? a : 0), s.z0 + a], [s.x1 - (s.edges.e ? a : 0), s.z0 + b], [s.x0 + (s.edges.w ? a : 0), s.z0 + b]], kh);
    if (s.edges.n) this.flat('path', [[s.x0 + (s.edges.w ? a : 0), s.z1 - b], [s.x1 - (s.edges.e ? a : 0), s.z1 - b], [s.x1 - (s.edges.e ? a : 0), s.z1 - a], [s.x0 + (s.edges.w ? a : 0), s.z1 - a]], kh);
    if (s.edges.w) this.flat('path', [[s.x0 + a, s.z0 + (s.edges.s ? b : 0)], [s.x0 + b, s.z0 + (s.edges.s ? b : 0)], [s.x0 + b, s.z1 - (s.edges.n ? b : 0)], [s.x0 + a, s.z1 - (s.edges.n ? b : 0)]], kh);
    if (s.edges.e) this.flat('path', [[s.x1 - b, s.z0 + (s.edges.s ? b : 0)], [s.x1 - a, s.z0 + (s.edges.s ? b : 0)], [s.x1 - a, s.z1 - (s.edges.n ? b : 0)], [s.x1 - b, s.z1 - (s.edges.n ? b : 0)]], kh);
  },
  carPark(x0, z0, x1, z1, fill) {
    this.flat('patch', [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], ROAD.kerbH + 0.002);
    this.spots.push({ name: 'the car park behind the shops', kind: 'carpark', pos: new THREE.Vector3((x0 + x1) / 2, ROAD.kerbH, (z0 + z1) / 2), rot: 0 });
    const white = [0.95, 0.94, 0.9], horiz = (x1 - x0) > (z1 - z0);
    const len = horiz ? x1 - x0 : z1 - z0, depth = horiz ? z1 - z0 : x1 - x0;
    if (depth < 10) return;
    for (const row of [0, 1]) for (let t = 1.5; t < len - 2.6; t += 2.6) {
      const a = (horiz ? x0 : z0) + t, r0 = row ? (horiz ? z1 - 5 : x1 - 5) : (horiz ? z0 : x0), r1 = r0 + 5;
      if (horiz) this.flat('paint', [[a, r0], [a + 0.1, r0], [a + 0.1, r1], [a, r1]], ROAD.kerbH + 0.008, white);
      else this.flat('paint', [[r0, a], [r1, a], [r1, a + 0.1], [r0, a + 0.1]], ROAD.kerbH + 0.008, white);
      if (this.rng() < fill && t + 2.6 < len - 2.6) {
        const c = a + 1.3, rr = row ? r1 - 2.4 : r0 + 2.4;
        const x = horiz ? c : rr, z = horiz ? rr : c;
        this.cars.push({ x, z, rot: (horiz ? 0 : Math.PI / 2) + (row ? Math.PI : 0), type: Math.floor(this.rng() * 4), color: this.rng(), y: ROAD.kerbH });
        this.collision.add(x, z, horiz ? 1.9 : 4.4, horiz ? 4.4 : 1.9, 'car');
      }
    }
  },
});

Object.assign(City.prototype.zoneGen, {
  core(s) {
    const sx = s.bi >= 0 ? 1 : -1, sz = s.bj >= 0 ? 1 : -1, near = PLAZA + 0.5, D = 11;
    // Row A runs along x and faces the square; row B runs along z. A corner block fills the angle.
    const rowA = this.split(21.5, 6.5, 11), rowB = this.split(21.5, 6.5, 11);
    const sideA = sz > 0 ? 's' : 'n', sideB = sx > 0 ? 'w' : 'e';
    let t = 0;
    rowA.forEach((W, k) => {
      const ox = sideA === 's' ? (sx > 0 ? 9.5 : -31) + t : (sx > 0 ? 31 : -9.5) - t;
      const first = sideA === 's' ? (sx > 0) : (sx < 0);
      this.shop(s, sideA, 0, W, D, 2 + Math.floor(this.rng() * 2), { frame: this.frameRaw(sideA, ox, sz * near), backShop: true, sign: this.nextSign(), exposedL: k === 0 && first, exposedR: k === rowA.length - 1 && !first });
      t += W;
    });
    t = 0;
    rowB.forEach((W, k) => {
      const oz = sideB === 'w' ? (sz > 0 ? 31 : -9.5) - t : (sz > 0 ? 9.5 : -31) + t;
      this.shop(s, sideB, 0, W, D, 2 + Math.floor(this.rng() * 2), { frame: this.frameRaw(sideB, sx * near, oz), backShop: true, sign: this.nextSign() });
      t += W;
    });
    const cx = sx > 0 ? near : -near - D, cz = sz > 0 ? near : -near - D;
    this.block(s, 's', 0, D, D, 4 + Math.floor(this.rng() * 2), this.frameRaw('s', cx, cz));
    for (const side of ['s', 'n', 'w', 'e']) {
      const p = this.sideNormal(side);
      if ((p[0] && p[0] === -sx) || (p[1] && p[1] === -sz)) continue; // sides facing the square have no kerb
      this.streetside(s, side, { cars: 0.35, lights: 28, bins: 30 });
    }
  },
  mainstreet(s) {
    const main = s.bi === 0 ? 'w' : s.bi === -1 ? 'e' : s.bj === 0 ? 's' : 'n';
    const opp = { w: 'e', e: 'w', s: 'n', n: 's' }[main];
    const [a0, a1] = this.frontage(s, main);
    let t = a0;
    const widths = this.split(a1 - a0, 6, 12);
    widths.forEach((W, k) => {
      this.shop(s, main, t, W, 14, 1 + Math.floor(this.rng() * 3), { sign: this.nextSign(), exposedL: k === 0, exposedR: k === widths.length - 1 });
      t += W;
    });
    const [b0, b1] = this.frontage(s, opp);
    t = b0;
    for (const W of this.split(b1 - b0, 10, 18)) {
      if (this.rng() < 0.6) this.block(s, opp, t, W, 12, 2 + Math.floor(this.rng() * 3));
      else this.shop(s, opp, t, W, 12, 2, { verandah: false, office: true });
      t += W;
    }
    // Rear car park between the two rows.
    const F = BAND.footpath;
    const box = { w: [s.x0 + F + 14, s.z0 + F, s.x1 - F - 12, s.z1 - F], e: [s.x0 + F + 12, s.z0 + F, s.x1 - F - 14, s.z1 - F], s: [s.x0 + F, s.z0 + F + 14, s.x1 - F, s.z1 - F - 12], n: [s.x0 + F, s.z0 + F + 12, s.x1 - F, s.z1 - F - 14] }[main];
    this.carPark(box[0] + 0.5, box[1] + 0.5, box[2] - 0.5, box[3] - 0.5, 0.35);
    for (const side of ['s', 'n', 'w', 'e']) this.streetside(s, side, { cars: side === main ? 0.45 : 0.25, lights: 28, offset: side === main ? 0 : 14, bins: side === main ? 18 : 40 });
  },
  mixed(s) {
    const sides = this.rng() < 0.5 ? ['s', 'n'] : ['w', 'e'];
    for (const side of sides) {
      const [a0, a1] = this.frontage(s, side);
      let t = a0;
      for (const W of this.split(a1 - a0, 12, 20)) { this.block(s, side, t, W, 13, 3 + Math.floor(this.rng() * 4)); t += W; }
    }
    const F = BAND.footpath;
    if (sides[0] === 's') this.carPark(s.x0 + F + 0.5, s.z0 + F + 13.5, s.x1 - F - 0.5, s.z1 - F - 13.5, 0.5);
    else this.carPark(s.x0 + F + 13.5, s.z0 + F + 0.5, s.x1 - F - 13.5, s.z1 - F - 0.5, 0.5);
    for (const side of ['s', 'n', 'w', 'e']) this.streetside(s, side, { cars: 0.25, lights: 30, offset: 10, trees: 22 });
  },
  residential(s) {
    this.footpathStrips(s);
    const F = BAND.footpath, lotD = (s.z1 - s.z0 - 2 * F) / 2;
    for (const side of ['s', 'n']) {
      const [a0, a1] = this.frontage(s, side);
      let t = a0;
      const lots = this.split(a1 - a0, 11, 19);
      lots.forEach((lotW, k) => {
        const m = this.frameFor(s, side, t);
        const h = this.house(s, side, t, lotW, lotD);
        this.b.setTransform(m);
        // Driveway on the roomier side of the house, crossing the berm to the kerb.
        const right = lotW - (h.x + h.W) > h.x;
        const dx0 = right ? Math.min(lotW - 3.1, h.x + h.W + 0.4) : Math.max(0.2, h.x - 3.2), dx1 = dx0 + 2.9;
        const lp = (x, z) => { const v = this.local(m, x, z); return [v.x, v.z]; };
        this.flat('path', [lp(dx0, -F + BAND.kerbTop), lp(dx1, -F + BAND.kerbTop), lp(dx1, -F + 1.6), lp(dx0, -F + 1.6)], ROAD.kerbH + 0.001);
        this.flat('path', [lp(dx0, -F + 3.0), lp(dx1, -F + 3.0), lp(dx1, h.setback + 4), lp(dx0, h.setback + 4)], ROAD.kerbH + 0.001);
        // Front boundary fence with a gap for the driveway, side fences between sections.
        const style = this.pick(['picket', 'paling', 'block', 'none', 'picket']);
        const fenceSeg = (x0, x1) => {
          if (x1 - x0 < 0.3) return;
          if (style === 'picket') this.fence('picket', [x0, 0.02], [x1, 0.02], 1.0);
          else if (style === 'paling') this.fence('wood', [x0, 0.02], [x1, 0.02], 1.2, true);
          else if (style === 'block') this.b.box('plaster', (x0 + x1) / 2, 0, 0.1, x1 - x0, 0.75, 0.2, { tint: col(this.pick(HOUSE_PAINT)), aoBottom: 0.7 });
        };
        fenceSeg(0.05, dx0 - 0.1); fenceSeg(dx1 + 0.1, lotW - 0.05);
        if (k > 0 || !s.edges[{ s: 'w', n: 'e' }[side]]) this.fence('wood', [0, 0.5], [0, lotD - 0.1], 1.8, true);
        if (side === 's') this.fence('wood', [0, lotD - 0.05], [lotW, lotD - 0.05], 1.8, true);
        // Letterbox on a post beside the driveway.
        const lbx = right ? dx0 - 0.5 : dx1 + 0.5;
        this.b.box('timber', lbx, 0, -0.25, 0.08, 1.0, 0.08, { faces: 'XxZz' });
        this.b.box('trim', lbx, 1.0, -0.25, 0.32, 0.26, 0.42, { tint: col(this.pick([0xc8302a, 0x2a4a7a, 0xe8e2d0, 0x333333])) });
        this.b.setTransform(null);
        const number = (Math.floor((t + lotW / 2) / 9) * 2 + 1) + (side === 'n' ? 1 : 0);
        this.houses.push({ ring: s.ring, ...this.spotFrom(m, h.x + h.W / 2, h.setback - 1.8, 'house', 'house'), spawn: this.spotFrom(m, (dx0 + dx1) / 2, -1.0, 'drive', 'drive'), address: `${number} ${this.streetFor(s, side)}` });
        if (this.rng() < 0.35) {
          const c = this.local(m, (dx0 + dx1) / 2, h.setback + 1.2 + this.rng() * 1.5);
          const rot = { s: 0, n: Math.PI, w: Math.PI / 2, e: -Math.PI / 2 }[side] + (this.rng() < 0.6 ? 0 : Math.PI);
          this.cars.push({ x: c.x, z: c.z, rot, type: Math.floor(this.rng() * 4), color: this.rng(), y: ROAD.kerbH });
          this.collision.add(c.x, c.z, side === 's' || side === 'n' ? 1.9 : 4.4, side === 's' || side === 'n' ? 4.4 : 1.9, 'car');
        }
        if (this.rng() < 0.5) { const p = this.local(m, right ? h.x * 0.5 : lotW - (lotW - h.x - h.W) * 0.5, h.setback * 0.45); this.trees.push({ x: p.x, z: p.z, y: ROAD.kerbH, kind: 'cabbage', s: 0.7 + this.rng() * 0.4 }); this.collision.add(p.x, p.z, 0.4, 0.4, 'tree'); }
        if (this.rng() < 0.55) { const p = this.local(m, lotW * (0.25 + this.rng() * 0.5), lotD - 2.5); this.trees.push({ x: p.x, z: p.z, y: ROAD.kerbH, kind: this.rng() < 0.3 ? 'conifer' : 'broad', s: 0.8 + this.rng() * 0.5 }); this.collision.add(p.x, p.z, 0.5, 0.5, 'tree'); }
        if (this.rng() < 0.3) { const p = this.local(m, (dx0 + dx1) / 2 + (right ? 1.8 : -1.8), -F + 0.75); (this.instances.bin = this.instances.bin || []).push({ x: p.x, y: ROAD.kerbH, z: p.z, rot: this.rng() * TAU, lid: this.rng() < 0.5 ? 0 : 1 }); }
        t += lotW;
      });
    }
    this.streetside(s, 's', { cars: 0.14, poles: 34 });
    this.streetside(s, 'w', { cars: 0.14, poles: 34 });
    this.streetside(s, 'n', { cars: 0.14, trees: 14 });
    this.streetside(s, 'e', { cars: 0.14, trees: 14 });
  },
  park(s) {
    this.footpathStrips(s);
    const F = BAND.footpath, cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2, kh = ROAD.kerbH + 0.001;
    this.flat('path', [[s.x0 + 3, cz - 1], [s.x1 - 3, cz - 1], [s.x1 - 3, cz + 1], [s.x0 + 3, cz + 1]], kh);
    // Touch-rugby field with H posts.
    const white = [0.95, 0.95, 0.92], fx0 = s.x0 + F + 2, fx1 = s.x1 - F - 2, fz0 = cz + 3, fz1 = s.z1 - F - 2;
    const line = (x0, z0, x1, z1) => this.flat('paint', [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], kh + 0.004, white);
    line(fx0, fz0, fx1, fz0 + 0.1); line(fx0, fz1 - 0.1, fx1, fz1); line(fx0, fz0, fx0 + 0.1, fz1); line(fx1 - 0.1, fz0, fx1, fz1); line(cx - 0.05, fz0, cx + 0.05, fz1);
    for (const x of [fx0 + 0.2, fx1 - 0.2]) {
      for (const dz of [-2.8, 2.8]) this.b.cylinder('white', x, ROAD.kerbH, (fz0 + fz1) / 2 + dz, 0.08, 0.07, 9, 8, { tint: white, cap: true });
      this.b.box('white', x, ROAD.kerbH + 3, (fz0 + fz1) / 2, 0.12, 0.12, 5.6, { tint: white });
    }
    // Playground: swing frame and slide.
    const px = s.x0 + F + 6, pz = cz - 8;
    this.flat('dirt', [[px - 4, pz - 4], [px + 4, pz - 4], [px + 4, pz + 4], [px - 4, pz + 4]], kh + 0.002);
    for (const dx of [-2, 2]) for (const dz of [-0.9, 0.9]) this.b.box('darkMetal', px + dx, ROAD.kerbH, pz + dz * 1.0, 0.08, 2.4, 0.08);
    this.b.box('darkMetal', px, ROAD.kerbH + 2.4, pz, 4.2, 0.1, 0.1);
    this.b.box('trim', px + 2.5, ROAD.kerbH, pz + 2, 0.6, 1.6, 0.6, { tint: col(0xd84a2a) });
    this.b.rect('trim', [px + 2.2, ROAD.kerbH + 1.6, pz + 2.3], [0.6, 0, 0], [0, -0.55, 0.835], 1, 2.6, { tint: col(0xe8c02a) });
    for (let i = 0; i < 9; i++) {
      const x = s.x0 + F + 2 + this.rng() * (s.x1 - s.x0 - 2 * F - 4), z = s.z0 + F + 2 + this.rng() * (cz - s.z0 - F - 6);
      if (Math.abs(x - px) < 5 && Math.abs(z - pz) < 5) continue;
      this.trees.push({ x, z, y: ROAD.kerbH, kind: this.rng() < 0.3 ? 'cabbage' : 'broad', s: 1 + this.rng() * 0.5 });
      this.collision.add(x, z, 0.5, 0.5, 'tree');
    }
    for (let i = 0; i < 4; i++) this.bench(cx - 12 + i * 8, cz - 2.2, Math.PI);
    this.spots.push({ name: 'the park by the rugby posts', kind: 'park', pos: new THREE.Vector3(cx - 4, ROAD.kerbH, cz - 3.4), rot: 0 });
    for (const side of ['s', 'n', 'w', 'e']) this.streetside(s, side, { cars: 0.2, lights: 32, offset: 8 });
  },
  industrial(s) {
    const sides = ['s', 'n'], F = BAND.footpath;
    this.flat('yard', [[s.x0 + F, s.z0 + F], [s.x1 - F, s.z0 + F], [s.x1 - F, s.z1 - F], [s.x0 + F, s.z1 - F]], ROAD.kerbH + 0.002);
    for (const side of sides) {
      const [a0, a1] = this.frontage(s, side), len = a1 - a0;
      if (len < 26) continue;
      const W = Math.min(len - 2, 24 + this.rng() * 8);
      this.warehouse(s, side, a0 + (len - W) * this.rng(), W, 14 + this.rng() * 3);
    }
    // Shipping containers stacked in the yard.
    const tints = [0xa33a2a, 0x2a5a8a, 0x3a6a3a, 0x8a8a84, 0xb07a2a];
    for (let i = 0; i < 4; i++) {
      const x = s.x0 + F + 3 + this.rng() * (s.x1 - s.x0 - 2 * F - 6), z = (s.z0 + s.z1) / 2 + (this.rng() - 0.5) * 3;
      if (this.collision.collides(x, z, 3.5)) continue;
      const tint = col(this.pick(tints));
      this.b.box('corrugated', x, ROAD.kerbH, z, 6.06, 2.59, 2.44, { tint, aoBottom: 0.7 });
      if (this.rng() < 0.4) this.b.box('corrugated', x + 0.2, ROAD.kerbH + 2.59, z, 6.06, 2.59, 2.44, { tint: col(this.pick(tints)) });
      this.collision.add(x, z, 6.1, 2.5, 'container');
    }
    for (const side of ['s', 'n', 'w', 'e']) this.streetside(s, side, { cars: 0.15, poles: side === 's' || side === 'w' ? 38 : 0 });
    // Chain-link fence around the yard (gaps left at the gates).
    const x0 = s.x0 + F + 0.2, x1 = s.x1 - F - 0.2, z0 = s.z0 + F + 0.2, z1 = s.z1 - F - 0.2;
    this.fence('chainlink', [x0, (z0 + z1) / 2 + 4], [x0, z1], 2.0); this.fence('chainlink', [x1, z0], [x1, (z0 + z1) / 2 - 4], 2.0);
  },
  rural(s) {
    // Paddocks beyond the outer roads: post-and-wire fences, a shelterbelt and the odd shed.
    const F = BAND.footpath;
    const x0 = Math.max(s.x0, -OUTER) + (s.edges.w ? F : 0), x1 = Math.min(s.x1, OUTER) - (s.edges.e ? F : 0);
    const z0 = Math.max(s.z0, -OUTER) + (s.edges.s ? F : 0), z1 = Math.min(s.z1, OUTER) - (s.edges.n ? F : 0);
    if (s.edges.s) this.postWire([x0, z0], [x1, z0]);
    if (s.edges.n) this.postWire([x0, z1], [x1, z1]);
    if (s.edges.w) this.postWire([x0, z0], [x0, z1]);
    if (s.edges.e) this.postWire([x1, z0], [x1, z1]);
    if (this.rng() < 0.6) {
      const along = this.rng() < 0.5, n = 7 + Math.floor(this.rng() * 5);
      for (let i = 0; i < n; i++) {
        const f = (i + 0.5) / n, x = along ? lerp(x0 + 3, x1 - 3, f) : (s.edges.w ? x1 - 3 : x0 + 3), z = along ? (s.edges.s ? z1 - 3 : z0 + 3) : lerp(z0 + 3, z1 - 3, f);
        this.trees.push({ x, z, y: ROAD.kerbH, kind: 'conifer', s: 1.3 + this.rng() * 0.5 });
      }
    }
    if (this.rng() < 0.35) {
      const cx = (x0 + x1) / 2 + (this.rng() - 0.5) * 10, cz = (z0 + z1) / 2 + (this.rng() - 0.5) * 10;
      const m = new THREE.Matrix4().setPosition(cx, ROAD.kerbH, cz); this.b.setTransform(m);
      this.b.box('corrugatedRust', 0, 0, 0, 9, 3.6, 0.1); this.b.box('corrugatedRust', -4.5, 0, 3, 0.1, 3.6, 6); this.b.box('corrugatedRust', 4.5, 0, 3, 0.1, 3.6, 6);
      this.b.rect('corrugatedRust', [-4.8, 3.6, -0.3], [1, 0, 0], [0, 0.15, 0.989], 9.6, 6.7);
      this.b.cylinder('concrete', 7, 0, 2, 1.6, 1.6, 2.4, 14, { cap: true });
      this.b.setTransform(null);
      this.collision.add(cx, cz + 3, 9.2, 6.2, 'shed');
    }
  },
});

Object.assign(City.prototype, {
  // Thin double-sided fence panel between local points a and b (current transform applies).
  fence(key, a, b, h, rail) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < 0.05) return;
    const u = [(b[0] - a[0]) / len, 0, (b[1] - a[1]) / len];
    this.b.rect(key, [a[0], 0, a[1]], u, [0, 1, 0], len, h, { uv0: [0, 0] });
    if (rail) this.b.box('timber', (a[0] + b[0]) / 2, h - 0.02, (a[1] + b[1]) / 2, Math.abs(b[0] - a[0]) + 0.06, 0.08, Math.abs(b[1] - a[1]) + 0.06, { faces: 'XxYZz' });
    const posts = Math.max(1, Math.round(len / 2.4));
    for (let i = 0; i <= posts; i++) {
      const x = a[0] + (b[0] - a[0]) * i / posts, z = a[1] + (b[1] - a[1]) * i / posts;
      this.b.box(key === 'chainlink' ? 'steel' : 'timber', x, 0, z, 0.09, h + 0.05, 0.09, { faces: 'XxYZz' });
    }
  },
  postWire(a, b) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(len / 3.5));
    for (let i = 0; i <= n; i++) {
      const x = a[0] + (b[0] - a[0]) * i / n, z = a[1] + (b[1] - a[1]) * i / n;
      this.b.box('timber', x, ROAD.kerbH, z, 0.1, 1.15, 0.1, { faces: 'XxYZz' });
    }
    for (const y of [0.45, 0.75, 1.05]) {
      const u = [(b[0] - a[0]) / len, 0, (b[1] - a[1]) / len];
      this.b.rect('steel', [a[0], ROAD.kerbH + y, a[1]], u, [0, 1, 0], len, 0.012, { uvScale: 1 });
      this.b.rect('steel', [b[0], ROAD.kerbH + y, b[1]], [-u[0], 0, -u[2]], [0, 1, 0], len, 0.012, { uvScale: 1 });
    }
  },
});
