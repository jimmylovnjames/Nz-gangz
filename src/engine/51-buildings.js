// Procedural buildings. Each is generated in a local frame (front face at z = 0 facing -z,
// x along the frontage, z = depth) and placed with a 90-degree rotation onto its street.
const PAINT = [0xe9e2d0, 0xd8d3c4, 0xc9c1ae, 0xb9b3a6, 0xd9c7a3, 0xc4a98a, 0xa9b4a1, 0x9fb0b8, 0xd8b98c, 0xe4d7c3, 0xb7a08a, 0x8f9a8c];
const HOUSE_PAINT = [0xf2efe6, 0xe8e1cf, 0xd7d2c4, 0xc3d0d4, 0xd9cfb2, 0xb8c4b0, 0xe6d3b8, 0xa8b8c4, 0xcfc6b6, 0x9ea89c, 0xf0e6d0];
const ROOF_PAINT = [0x7a2b22, 0x3f4a3a, 0x2f3236, 0x4d5a63, 0x6a3a2a, 0x555a52, 0x8a8f90];
const DOOR_PAINT = [0x8b2a22, 0x2a4a6a, 0x2f5a3a, 0x6a4a2a, 0x222222, 0xe0c060];
const SHOP_NAMES = ['KAI TIME TAKEAWAYS', 'SUNRISE DAIRY', "TAMA'S BARBERS", 'GOLDEN LOTUS', 'MAINSTREET PHARMACY', 'TE AWA OP SHOP',
  'HOKI FISH & CHIPS', 'PACIFIC FOODS', 'KORU CAFE', 'BARGAIN BIN', 'PAWN & LOAN', 'THE LUCKY HORSE', 'MANA MOTORS', 'WHANAU HAIR',
  'RIMU BOOKS', 'SOUTHERN CROSS BAKERY', 'PIKI TATTOO', 'HUNGRY HORSE PIZZA', "ROSIE'S LAUNDROMAT", 'KAURI REAL ESTATE', 'FANTAIL SPORTS',
  'HARBOUR CAFE', 'TAONGA GIFTS', 'PHONE FIX', 'NIGHT OWL BURGERS', 'MOANA SUSHI', "RANGI'S BUTCHERY", 'KIA ORA DONUTS',
  'PACIFIC FREIGHT', 'WAIRAU ENGINEERING', 'KAHU PANEL & PAINT', 'TOTARA TIMBER'];
const col = hex => new THREE.Color(hex);
let WINDOW_SEED = 1;

// Wall frames in building-local space (see header). P(a, y, d): a along the wall left->right seen
// from outside, d = depth into the building.
function wallsFor(W, D) {
  return {
    front: { S: [W, 0, 0], U: [-1, 0, 0], N: [0, 0, -1], L: W },
    right: { S: [W, 0, D], U: [0, 0, -1], N: [1, 0, 0], L: D },
    back: { S: [0, 0, D], U: [1, 0, 0], N: [0, 0, 1], L: W },
    left: { S: [0, 0, 0], U: [0, 0, 1], N: [-1, 0, 0], L: D },
  };
}
const WP = (w, a, y, d) => [w.S[0] + w.U[0] * a - w.N[0] * d, y, w.S[2] + w.U[2] * a - w.N[2] * d];
const NEG = v => [-v[0], -v[1], -v[2]];
const UP = [0, 1, 0];

Object.assign(City.prototype, {
  frameFor(s, side, t) {
    const F = BAND.footpath, kh = ROAD.kerbH;
    const c = { s: [s.x0, s.z0 + F, 0], n: [s.x1, s.z1 - F, Math.PI], w: [s.x0 + F, s.z1, Math.PI / 2], e: [s.x1 - F, s.z0, -Math.PI / 2] }[side];
    const dir = { s: [1, 0], n: [-1, 0], w: [0, -1], e: [0, 1] }[side];
    const m = new THREE.Matrix4().makeRotationY(c[2]).setPosition(c[0] + dir[0] * t, kh, c[1] + dir[1] * t);
    return m;
  },
  // Frame for a frontage that starts at world point (ox, oz) on the given side orientation.
  frameRaw(side, ox, oz) {
    const rot = { s: 0, n: Math.PI, w: Math.PI / 2, e: -Math.PI / 2 }[side];
    return new THREE.Matrix4().makeRotationY(rot).setPosition(ox, ROAD.kerbH, oz);
  },
  sideLength(s, side) { return side === 's' || side === 'n' ? s.x1 - s.x0 : s.z1 - s.z0; },
  footprint(m, x0, z0, x1, z1, tag) {
    const a = new THREE.Vector3(x0, 0, z0).applyMatrix4(m), b = new THREE.Vector3(x1, 0, z1).applyMatrix4(m);
    const cx = (a.x + b.x) / 2, cz = (a.z + b.z) / 2, w = Math.abs(a.x - b.x), d = Math.abs(a.z - b.z);
    return this.collision.add(cx, cz, w, d, tag);
  },
  wallRect(key, w, a0, a1, y0, y1, opt = {}) {
    if (a1 - a0 < 0.005 || y1 - y0 < 0.005) return;
    this.b.rect(key, WP(w, a0, y0, opt.d || 0), w.U, UP, a1 - a0, y1 - y0, { uv0: [a0 + (opt.u0 || 0), y0], ao: opt.ao, tint: opt.tint });
  },
  // Box in wall space: a0..a1 along, y0..y1 up, d0..d1 depth (negative = outside the wall).
  wallBox(key, w, a0, a1, y0, y1, d0, d1, opt = {}) {
    const L = a1 - a0, H = y1 - y0, T = d1 - d0, t = opt.tint;
    this.b.rect(key, WP(w, a0, y0, d0), w.U, UP, L, H, { uv0: [a0, y0], tint: t });
    this.b.rect(key, WP(w, a0, y1, d0), w.U, NEG(w.N), L, T, { uv0: [a0, 0], tint: t });
    if (!opt.noBottom) this.b.rect(key, WP(w, a0, y0, d1), w.U, w.N, L, T, { uv0: [a0, 0], tint: t });
    this.b.rect(key, WP(w, a0, y0, d1), w.N, UP, T, H, { uv0: [0, y0], tint: t });
    this.b.rect(key, WP(w, a1, y0, d0), NEG(w.N), UP, T, H, { uv0: [0, y0], tint: t });
  },
  // One recessed opening: reveals, glass (interior-mapped) or a solid panel, frame and sill.
  opening(w, o, wallKey, wallTint) {
    const { a0, a1, b0, b1 } = o, r = o.depth ?? 0.16, ww = a1 - a0, wh = b1 - b0;
    const revealKey = o.revealKey || wallKey;
    this.b.rect(revealKey, WP(w, a0, b0, 0), NEG(w.N), UP, r, wh, { uv0: [0, b0], tint: wallTint });
    this.b.rect(revealKey, WP(w, a1, b0, r), w.N, UP, r, wh, { uv0: [0, b0], tint: wallTint });
    this.b.rect(revealKey, WP(w, a0, b1, r), w.U, w.N, ww, r, { uv0: [a0, 0], tint: wallTint });
    if (!o.noSillReveal) this.b.rect(revealKey, WP(w, a0, b0, 0), w.U, NEG(w.N), ww, r, { uv0: [a0, 0], tint: wallTint });
    if (o.panel) {
      this.b.rect(o.panel, WP(w, a0, b0, r), w.U, UP, ww, wh, { uv0: [0, 0], tint: o.panelTint });
    } else {
      this.b.rect('glass', WP(w, a0, b0, r), w.U, UP, ww, wh, { uv: [0, 0, 1, 0, 1, 1, 0, 1], win: [WINDOW_SEED++ * 1.618 % 997, ww, wh, o.kind || 0] });
    }
    const fk = o.frame || 'alu', fw = o.frameW ?? 0.05, fd = r - 0.012;
    if (fk !== 'none') {
      this.wallRect(fk, w, a0, a0 + fw, b0, b1, { d: fd });
      this.wallRect(fk, w, a1 - fw, a1, b0, b1, { d: fd });
      this.wallRect(fk, w, a0, a1, b0, b0 + fw, { d: fd });
      this.wallRect(fk, w, a0, a1, b1 - fw, b1, { d: fd });
      if (o.transom) this.wallRect(fk, w, a0, a1, b0 + wh * o.transom - fw / 2, b0 + wh * o.transom + fw / 2, { d: fd });
      if (o.mullions) for (let k = 1; k < o.mullions; k++) { const a = a0 + ww * k / o.mullions; this.wallRect(fk, w, a - fw / 2, a + fw / 2, b0, b1, { d: fd }); }
    }
    if (o.sill) this.wallBox(o.sill, w, a0 - 0.08, a1 + 0.08, b0 - 0.06, b0, -0.07, 0.02, { tint: o.sillTint });
  },
  // A storey band of wall with evenly spaced openings sharing one vertical range.
  windowRow(w, key, tint, y0, y1, ops, aStart = 0, aEnd = w.L, ao) {
    const b0 = ops.length ? Math.min(...ops.map(o => o.b0)) : y1, b1 = ops.length ? Math.max(...ops.map(o => o.b1)) : y1;
    this.wallRect(key, w, aStart, aEnd, y0, b0, { tint, ao });
    this.wallRect(key, w, aStart, aEnd, b1, y1, { tint });
    let a = aStart;
    for (const o of ops) {
      this.wallRect(key, w, a, o.a0, b0, b1, { tint }); a = o.a1;
      this.wallRect(key, w, o.a0, o.a1, b0, o.b0, { tint }); this.wallRect(key, w, o.a0, o.a1, o.b1, b1, { tint });
    }
    this.wallRect(key, w, a, aEnd, b0, b1, { tint });
    for (const o of ops) this.opening(w, o, key, tint);
  },
  bays(L, bay, ww, b0, b1, extra = {}) {
    const n = Math.max(1, Math.floor(L / bay)), step = L / n, ops = [];
    for (let k = 0; k < n; k++) { const c = step * (k + 0.5); ops.push({ a0: c - ww / 2, a1: c + ww / 2, b0, b1, ...extra }); }
    return ops;
  },

  // ---------------------------------------------------------------- main street shop
  shop(s, side, t, W, D, floors, opts = {}) {
    const m = opts.frame || this.frameFor(s, side, t);
    this.b.setTransform(m);
    const walls = wallsFor(W, D), f = walls.front;
    const brick = opts.key ? opts.key === 'brick' : this.rng() < 0.4;
    const key = opts.key || (brick ? 'brick' : 'plaster');
    const tint = brick ? col(0xffffff).lerp(col(0xd8c8b8), this.rng() * 0.5) : col(this.pick(PAINT));
    const trimTint = col(this.pick([0xf1ede4, 0x2e3a34, 0x5b4636, 0xe0d6bf, 0x3b4450]));
    const gH = 4.0, fH = 3.3, H = gH + fH * (floors - 1), para = 0.7 + this.rng() * 0.6;
    // Ground-floor shopfront.
    const pil = 0.35, doorW = 1.1, doorLeft = this.rng() < 0.5;
    const da0 = doorLeft ? pil + 0.2 : W - pil - 0.2 - doorW, da1 = da0 + doorW;
    this.wallRect(key, f, 0, pil, 0, gH, { tint, ao: [0.75, 0.75, 1, 1] });
    this.wallRect(key, f, W - pil, W, 0, gH, { tint, ao: [0.75, 0.75, 1, 1] });
    this.wallRect(key, f, pil, W - pil, 3.05, gH, { tint });
    const glassA0 = doorLeft ? da1 + 0.12 : pil, glassA1 = doorLeft ? W - pil : da0 - 0.12;
    this.wallRect('stone', f, glassA0, glassA1, 0, 0.45, { d: 0.0, tint: [0.35, 0.34, 0.33] });
    this.wallRect(key, f, doorLeft ? pil : da1, doorLeft ? da0 : W - pil, 0, 3.05, { tint });
    this.wallRect(key, f, doorLeft ? da1 : glassA1, doorLeft ? glassA0 : da0, 0, 3.05, { tint });
    this.opening(f, { a0: glassA0, a1: glassA1, b0: 0.45, b1: 3.05, kind: 2, depth: 0.25, mullions: Math.max(1, Math.round((glassA1 - glassA0) / 2.2)), transom: 0.82, noSillReveal: false }, key, tint);
    this.opening(f, { a0: da0, a1: da1, b0: 0.0, b1: 3.05, kind: 2, depth: 0.45, transom: 0.76, frameW: 0.07 }, key, tint);
    // Upper floors.
    const winKind = opts.office ? 1 : 0, bay = opts.office ? 2.0 : 2.7, ww = opts.office ? 1.7 : 1.25;
    for (let fl = 1; fl < floors; fl++) {
      const y0 = gH + fH * (fl - 1), y1 = y0 + fH;
      this.windowRow(f, key, tint, y0, y1, this.bays(W, bay, ww, y0 + 0.9, y0 + 2.55, { kind: winKind, sill: brick ? 'stone' : 'trim', sillTint: [trimTint.r, trimTint.g, trimTint.b], transom: opts.office ? 0 : 0.62, frame: opts.office ? 'darkMetal' : (this.rng() < 0.5 ? 'white' : 'alu') }));
      if (brick || this.rng() < 0.5) this.wallBox('trim', f, 0, W, y0 - 0.12, y0 + 0.02, -0.08, 0, { tint: trimTint });
    }
    // Parapet with cap, optional central pediment.
    this.wallRect(key, f, 0, W, H, H + para, { tint });
    this.wallBox('trim', f, -0.05, W + 0.05, H + para, H + para + 0.1, -0.08, 0.3, { tint: trimTint });
    if (W > 7 && this.rng() < 0.45) {
      const pw = W * 0.36, pa = (W - pw) / 2;
      this.wallBox(key, f, pa, pa + pw, H + para, H + para + 0.9, 0, 0.25, { tint });
      this.wallBox('trim', f, pa - 0.05, pa + pw + 0.05, H + para + 0.9, H + para + 0.98, -0.06, 0.3, { tint: trimTint });
    }
    // Sides: party walls unless exposed; back wall with a few windows.
    const exposedL = opts.exposedL, exposedR = opts.exposedR;
    for (const [wall, exposed] of [[walls.left, exposedL], [walls.right, exposedR]]) {
      if (exposed && floors > 1) {
        this.wallRect(key, wall, 0, wall.L, 0, gH, { tint, ao: [0.75, 0.75, 1, 1] });
        for (let fl = 1; fl < floors; fl++) {
          const y0 = gH + fH * (fl - 1);
          this.windowRow(wall, key, tint, y0, y0 + fH, this.bays(wall.L, 3.2, 1.2, y0 + 0.9, y0 + 2.5, { sill: 'trim', sillTint: [trimTint.r, trimTint.g, trimTint.b], frame: 'alu' }));
        }
        this.wallRect(key, wall, 0, wall.L, H, H + para, { tint });
      } else this.wallRect(key, wall, 0, wall.L, 0, H + para, { tint, ao: [0.8, 0.8, 1, 1] });
    }
    const back = walls.back;
    const backGround = opts.backShop
      ? this.bays(W, 3.2, 2.2, 0.5, 2.9, { kind: 2, depth: 0.2, frame: 'alu', transom: 0.8 })
      : [{ a0: W * 0.2, a1: W * 0.2 + 0.95, b0: 0.0, b1: 2.1, panel: 'darkMetal', depth: 0.1, frame: 'none', noSillReveal: true }];
    this.windowRow(back, key, tint, 0, gH, backGround, 0, W, [0.75, 0.75, 1, 1]);
    for (let fl = 1; fl < floors; fl++) {
      const y0 = gH + fH * (fl - 1);
      this.windowRow(back, key, tint, y0, y0 + fH, opts.backShop ? this.bays(W, bay, ww, y0 + 0.9, y0 + 2.55, { kind: winKind, frame: 'alu', sill: 'trim', sillTint: [trimTint.r, trimTint.g, trimTint.b] }) : this.bays(W, 3.4, 1.0, y0 + 1.0, y0 + 2.3, { frame: 'alu', sill: 'trim', sillTint: [0.8, 0.8, 0.8] }));
    }
    this.wallRect(key, back, 0, W, H, H + para, { tint });
    // Roof deck with clutter.
    this.b.rect('gravel', [0, H + 0.05, D], [1, 0, 0], [0, 0, -1], W, D, { uv0: [0, 0] });
    if (this.rng() < 0.7) this.b.box('steel', W * (0.3 + this.rng() * 0.4), H + 0.05, D * (0.4 + this.rng() * 0.3), 1.2, 0.9, 0.8, { faces: 'XxYZz' });
    if (this.rng() < 0.5) this.b.cylinder('darkMetal', W * 0.8, H, D * 0.7, 0.12, 0.12, 1.4, 6, { cap: true });
    // Verandah over the footpath.
    if (opts.verandah !== false) this.verandah(f, W, gH, trimTint, opts.sign);
    this.b.setTransform(null);
    this.footprint(m, 0, 0, W, D, 'building');
    return m;
  },
  verandah(f, W, gH, trimTint, sign) {
    const y = 3.25, depth = 2.75, kerbSide = depth - 0.15;
    const t = [trimTint.r, trimTint.g, trimTint.b];
    // Roof (corrugated, slight fall), fascia band and soffit.
    this.b.rect('corrugated', WP(f, W + 0.02, y + 0.55, 0), [1, 0, 0], [0, -0.07, -0.997], W + 0.04, depth, { tint: [0.55, 0.57, 0.58] });
    this.wallBox('trim', f, -0.02, W + 0.02, y, y + 0.5, -depth, -depth + 0.08, { tint: t });
    this.b.rect('white', WP(f, 0, y, 0), f.U, f.N, W, depth - 0.02, { tint: [0.92, 0.92, 0.9] });
    for (let a = 1.2; a < W - 0.6; a += 2.4) this.wallBox('lamp', f, a - 0.18, a + 0.18, y - 0.02, y, -depth * 0.55 - 0.18, -depth * 0.55 + 0.18, { noBottom: false });
    if (sign != null) {
      const sw = Math.min(W - 0.6, 4.4), sa = (W - sw) / 2, cell = sign % 32;
      const u0 = (cell % 2) * 0.5, v0 = 1 - (Math.floor(cell / 2) + 1) / 16;
      const p = WP(f, sa, y + 0.07, -depth - 0.005);
      this.b.rect('signs', p, f.U, UP, sw, 0.36, { uv: [u0, v0, u0 + 0.5, v0, u0 + 0.5, v0 + 1 / 16, u0, v0 + 1 / 16] });
    }
    if (W > 5.5) for (let a = 0.3; a <= W - 0.25; a += (W - 0.55) / Math.max(1, Math.round(W / 4.5))) {
      const p = WP(f, a, 0, -kerbSide);
      this.b.cylinder('darkMetal', p[0], 0, p[2], 0.06, 0.05, y, 8);
    }
  },

  // ---------------------------------------------------------------- apartments / offices
  block(s, side, t, W, D, floors, frame) {
    const m = frame || this.frameFor(s, side, t);
    this.b.setTransform(m);
    const walls = wallsFor(W, D);
    const office = this.rng() < 0.45;
    const key = office ? (this.rng() < 0.5 ? 'tiltslab' : 'plaster') : this.pick(['plaster', 'plaster', 'brick']);
    const tint = key === 'plaster' ? col(this.pick(PAINT)) : col(0xffffff);
    const trimTint = col(this.pick([0xe9e6dd, 0x3a4048, 0x7a6a58]));
    const fH = 3.2, gH = 3.6, H = gH + fH * (floors - 1);
    for (const [name, wall] of Object.entries(walls)) {
      const L = wall.L;
      // Ground floor: lobby glazing on the front, service openings elsewhere.
      if (name === 'front') {
        this.windowRow(wall, key, tint, 0, gH, this.bays(L, 3.0, 2.4, 0.3, 3.0, { kind: 2, depth: 0.2, frame: 'darkMetal', transom: 0.8 }), 0, L, [0.75, 0.75, 1, 1]);
      } else this.windowRow(wall, key, tint, 0, gH, name === 'back' ? [] : this.bays(L, 4.5, 1.2, 1.1, 2.4, { frame: 'alu' }), 0, L, [0.75, 0.75, 1, 1]);
      for (let fl = 1; fl < floors; fl++) {
        const y0 = gH + fH * (fl - 1);
        const ops = office
          ? this.bays(L, 1.9, 1.75, y0 + 0.75, y0 + 2.75, { kind: 1, frame: 'darkMetal', depth: 0.12 })
          : this.bays(L, 3.1, 1.5, y0 + 0.85, y0 + 2.45, { kind: 0, frame: 'alu', sill: 'trim', sillTint: [trimTint.r, trimTint.g, trimTint.b], transom: 0.7 });
        this.windowRow(wall, key, tint, y0, y0 + fH, ops);
        if (office) this.wallBox('trim', wall, 0, L, y0 - 0.1, y0 + 0.08, -0.12, 0, { tint: trimTint });
        // Apartment balconies on the front.
        if (!office && name === 'front' && fl % 1 === 0) {
          for (const o of ops) {
            if (this.rng() < 0.35) continue;
            this.wallBox('concrete', wall, o.a0 - 0.4, o.a1 + 0.4, y0 - 0.02, y0 + 0.16, -1.3, 0, { tint: [0.85, 0.85, 0.85] });
            this.wallBox('steel', wall, o.a0 - 0.4, o.a1 + 0.4, y0 + 1.0, y0 + 1.05, -1.3, -1.25);
            for (let a = o.a0 - 0.35; a <= o.a1 + 0.36; a += 0.24) this.wallBox('steel', wall, a, a + 0.03, y0 + 0.16, y0 + 1.0, -1.29, -1.26);
          }
        }
      }
      this.wallRect(key, wall, 0, L, H, H + 0.8, { tint });
      this.wallBox('trim', wall, -0.05, L + 0.05, H + 0.8, H + 0.9, -0.06, 0.25, { tint: trimTint });
    }
    this.b.rect('gravel', [0, H + 0.05, D], [1, 0, 0], [0, 0, -1], W, D, { uv0: [0, 0] });
    for (let k = 0; k < 3; k++) if (this.rng() < 0.6) this.b.box('steel', 1.5 + this.rng() * (W - 3), H + 0.05, 1.5 + this.rng() * (D - 3), 1.4, 1.0, 1.0, { faces: 'XxYZz' });
    if (floors >= 4) this.b.box(key, W * 0.25, H, D * 0.5, 3.0, 2.6, 3.0, { tint: tint, faces: 'XxYZz' });
    this.b.setTransform(null);
    this.footprint(m, 0, 0, W, D, 'building');
  },

  // ---------------------------------------------------------------- house
  house(s, side, t, lotW, lotD) {
    const m = this.frameFor(s, side, t);
    this.b.setTransform(m);
    const W = clamp(lotW - 4 - this.rng() * 2.5, 8, 13), D = clamp(7.5 + this.rng() * 3, 7.5, Math.min(11, lotD - 9));
    const setback = 4.5 + this.rng() * 2.5, x = 1.6 + this.rng() * (lotW - W - 3.2);
    const fl = 0.55, wallTop = fl + 2.45, kh = 0;
    const wb = this.rng() < 0.82, key = wb ? 'weatherboard' : 'brick';
    const tint = wb ? col(this.pick(HOUSE_PAINT)) : col(0xffffff).lerp(col(0xd0b8a0), this.rng());
    const roofKey = this.rng() < 0.2 ? 'corrugatedRust' : 'corrugated';
    const roofTint = roofKey === 'corrugated' ? col(this.pick(ROOF_PAINT)) : col(0xffffff);
    const trim = [0.94, 0.93, 0.9];
    const local = new THREE.Matrix4().makeTranslation(x, 0, setback).premultiply(m);
    this.b.setTransform(local);
    const walls = wallsFor(W, D);
    // Base boards (piles hidden behind) and walls with windows.
    for (const [name, wall] of Object.entries(walls)) {
      const L = wall.L;
      this.wallRect(key, wall, 0, L, kh, fl, { tint: [tint.r * 0.7, tint.g * 0.7, tint.b * 0.7], ao: [0.6, 0.6, 1, 1] });
      let ops;
      if (name === 'front') {
        const doorA = W * (this.rng() < 0.5 ? 0.22 : 0.7);
        ops = [{ a0: doorA - 0.45, a1: doorA + 0.45, b0: fl, b1: fl + 2.05, panel: 'trim', panelTint: (c => [c.r, c.g, c.b])(col(this.pick(DOOR_PAINT))), depth: 0.08, frame: 'white', frameW: 0.07, noSillReveal: true, door: true }];
        const big = doorA < W / 2 ? [doorA + 1.2, W - 0.9] : [0.9, doorA - 1.2];
        ops.push({ a0: big[0], a1: Math.min(big[1], big[0] + 2.8), b0: fl + 0.75, b1: fl + 2.1, frame: 'white', frameW: 0.08, mullions: 2, transom: 0.72, sill: 'white', sillTint: trim, depth: 0.1 });
        ops.sort((p, q) => p.a0 - q.a0);
        this.porch(wall, doorA, fl, wallTop, roofKey, roofTint);
      } else if (name === 'back') {
        ops = [{ a0: W * 0.25, a1: W * 0.25 + 1.8, b0: fl, b1: fl + 2.05, frame: 'alu', frameW: 0.06, mullions: 2, depth: 0.1 },
          { a0: W * 0.65, a1: W * 0.65 + 1.0, b0: fl + 1.0, b1: fl + 2.0, frame: 'white', frameW: 0.07, sill: 'white', sillTint: trim, depth: 0.1 }];
      } else ops = this.bays(L, 3.6, 1.0, fl + 0.85, fl + 2.05, { frame: 'white', frameW: 0.07, transom: 0.55, sill: 'white', sillTint: trim, depth: 0.1 });
      this.windowRow(wall, key, tint, fl, wallTop, ops, 0, L);
      for (const o of ops) if (o.door) for (let st = 0; st < 3; st++) this.wallBox('concrete', wall, o.a0 - 0.3, o.a1 + 0.3, 0, fl - st * 0.18, -0.35 - st * 0.3, st ? -0.35 - (st - 1) * 0.3 : 0, { tint: [0.8, 0.8, 0.78] });
    }
    // Corner boards.
    for (const [cx, cz] of [[0, 0], [W, 0], [W, D], [0, D]]) this.b.box('white', cx, 0, cz, 0.12, wallTop, 0.12, { tint: trim, faces: 'XxZz' });
    this.roof(W, D, wallTop, roofKey, roofTint, this.rng() < 0.45 ? 'hip' : 'gable', key, tint);
    if (this.rng() < 0.4) this.b.box('brick', W * (0.25 + this.rng() * 0.5), wallTop - 0.5, D * 0.5, 0.7, 2.6, 0.7, { faces: 'XxYZz' });
    this.b.setTransform(null);
    this.footprint(local, -0.4, -0.4, W + 0.4, D + 0.4, 'house');
    return { m, x, W, D, setback };
  },
  porch(wall, a, fl, wallTop, roofKey, roofTint) {
    const y = wallTop - 0.25, d = 1.6, w = 2.4;
    const p = WP(wall, a + w / 2, y, 0);
    this.b.rect(roofKey, p, NEG(wall.U), [wall.N[0] * 0.98, -0.18, wall.N[2] * 0.98], w, d, { tint: [roofTint.r, roofTint.g, roofTint.b] });
    for (const s of [-1, 1]) {
      const q = WP(wall, a + s * (w / 2 - 0.1), 0, -d + 0.15);
      this.b.box('white', q[0], 0, q[2], 0.1, y - 0.25, 0.1, { tint: [0.94, 0.93, 0.9], faces: 'XxZz' });
    }
  },
  roof(W, D, wallTop, key, tint, type, wallKey, wallTint) {
    const ov = 0.45, pitch = THREE.MathUtils.degToRad(22 + this.rng() * 10), tp = Math.tan(pitch);
    const yE = wallTop - ov * tp, rise = (D / 2) * tp, yR = wallTop + rise;
    const t = [tint.r, tint.g, tint.b], s = this.lib.scale(key);
    const run = D / 2 + ov, slope = Math.hypot(run, run * tp);
    const fl = [-ov, yE, -ov], fr = [W + ov, yE, -ov], bl = [-ov, yE, D + ov], br = [W + ov, yE, D + ov];
    const nF = [0, Math.cos(pitch), -Math.sin(pitch)], nB = [0, Math.cos(pitch), Math.sin(pitch)];
    const nL = [-Math.sin(pitch), Math.cos(pitch), 0], nR = [Math.sin(pitch), Math.cos(pitch), 0];
    const uvs = (pts, axis, origin) => pts.flatMap(p => axis === 'x' ? [p[0] / s, Math.abs(p[2] - origin) / Math.cos(pitch) / s] : [p[2] / s, Math.abs(p[0] - origin) / Math.cos(pitch) / s]);
    if (type === 'gable' || W - D < 1) {
      const rl = [-ov, yR, D / 2], rr = [W + ov, yR, D / 2];
      this.b.poly(key, [fr, fl, rl, rr], nF, uvs([fr, fl, rl, rr], 'x', -ov), null, null, t);
      this.b.poly(key, [bl, br, rr, rl], nB, uvs([bl, br, rr, rl], 'x', D + ov), null, null, t);
      const wt = [wallTint.r, wallTint.g, wallTint.b], ws = this.lib.scale(wallKey);
      this.b.tri(wallKey, [0, wallTop, 0], [0, wallTop, D], [0, yR, D / 2], [0, wallTop / ws, D / ws, wallTop / ws, D / 2 / ws, yR / ws], wt);
      this.b.tri(wallKey, [W, wallTop, D], [W, wallTop, 0], [W, yR, D / 2], [-D / ws, wallTop / ws, 0, wallTop / ws, -D / 2 / ws, yR / ws], wt);
      for (const x of [-ov, W + ov]) { // barge boards
        const fix = q => x < 0 ? q.reverse() : q;
        this.b.poly('white', fix([[x, yE - 0.18, -ov], [x, yE, -ov], [x, yR + 0.02, D / 2], [x, yR - 0.16, D / 2]]), [x < 0 ? -1 : 1, 0, 0], [0, 0, 1, 0, 1, 1, 0, 1], null, null, [0.94, 0.93, 0.9]);
        this.b.poly('white', fix([[x, yR - 0.16, D / 2], [x, yR + 0.02, D / 2], [x, yE, D + ov], [x, yE - 0.18, D + ov]]), [x < 0 ? -1 : 1, 0, 0], [0, 0, 1, 0, 1, 1, 0, 1], null, null, [0.94, 0.93, 0.9]);
      }
      this.b.box('trim', W / 2, yR - 0.02, D / 2, W + 2 * ov, 0.1, 0.24, { tint: t, faces: 'XxYZz' });
    } else {
      const rl = [D / 2, yR, D / 2], rr = [W - D / 2, yR, D / 2];
      this.b.poly(key, [fr, fl, rl, rr], nF, uvs([fr, fl, rl, rr], 'x', -ov), null, null, t);
      this.b.poly(key, [bl, br, rr, rl], nB, uvs([bl, br, rr, rl], 'x', D + ov), null, null, t);
      this.b.poly(key, [fl, bl, rl], nL, uvs([fl, bl, rl], 'z', -ov), null, null, t);
      this.b.poly(key, [br, fr, rr], nR, uvs([br, fr, rr], 'z', W + ov), null, null, t);
      this.b.box('trim', W / 2, yR - 0.02, D / 2, rr[0] - rl[0], 0.08, 0.2, { tint: t, faces: 'XxYZz' });
    }
    // Fascia and gutters along the eaves.
    for (const z of [-ov, D + ov]) {
      this.b.box('white', W / 2, yE - 0.2, z, W + 2 * ov, 0.2, 0.06, { tint: [0.94, 0.93, 0.9], faces: 'XxZzy' });
      this.b.box('darkMetal', W / 2, yE - 0.16, z + (z < 0 ? -0.09 : 0.09), W + 2 * ov, 0.12, 0.12, { faces: 'XxZzy' });
    }
    this.b.rect('white', [-ov, yE - 0.2, -ov], [1, 0, 0], [0, 0, 1], W + 2 * ov, ov, { tint: [0.9, 0.9, 0.88] });
    this.b.rect('white', [-ov, yE - 0.2, D], [1, 0, 0], [0, 0, 1], W + 2 * ov, ov, { tint: [0.9, 0.9, 0.88] });
  },

  // ---------------------------------------------------------------- warehouse
  warehouse(s, side, t, W, D) {
    const m = this.frameFor(s, side, t);
    this.b.setTransform(m);
    const walls = wallsFor(W, D), H = 6.5 + this.rng() * 1.5;
    const tint = col(0xffffff).lerp(col(this.pick([0xd8d2c4, 0xc7cdd2, 0xe0d8c8])), 0.6);
    const roofKey = this.rng() < 0.5 ? 'corrugatedRust' : 'corrugated', roofTint = roofKey === 'corrugated' ? col(this.pick([0x8a8f90, 0x4d5a63, 0x5a6a5a])) : col(0xffffff);
    for (const [name, wall] of Object.entries(walls)) {
      const L = wall.L;
      if (name === 'front') {
        const doors = Math.max(1, Math.floor((L - 6) / 6.5)), ops = [];
        for (let k = 0; k < doors; k++) { const c = 5 + k * 6.5 + 2.2; ops.push({ a0: c - 2.2, a1: c + 2.2, b0: 0, b1: 4.6, panel: 'roller', panelTint: (c2 => [c2.r, c2.g, c2.b])(col(this.pick([0xd9d9d6, 0x5b6f7c, 0x8a3b2e, 0x3d5940]))), depth: 0.3, frame: 'darkMetal', frameW: 0.12, noSillReveal: true }); }
        ops.push({ a0: L - 4.5, a1: L - 1.2, b0: 1.0, b1: 2.4, kind: 1, frame: 'alu', depth: 0.1, mullions: 2 });
        ops.sort((p, q) => p.a0 - q.a0);
        this.windowRow(wall, 'tiltslab', tint, 0, H, ops, 0, L, [0.7, 0.7, 1, 1]);
        const sign = 28 + Math.floor(this.rng() * 4);
        const u0 = (sign % 2) * 0.5, v0 = 1 - (Math.floor(sign / 2) + 1) / 16;
        this.b.rect('signs', WP(wall, L / 2 - 4, H - 1.4, -0.03), wall.U, UP, 8, 0.9, { uv: [u0, v0, u0 + 0.5, v0, u0 + 0.5, v0 + 1 / 16, u0, v0 + 1 / 16] });
        this.wallBox('lamp', wall, L / 2 - 0.3, L / 2 + 0.3, H - 0.35, H - 0.2, -0.5, 0);
      } else this.windowRow(wall, 'tiltslab', tint, 0, H, [], 0, L, [0.7, 0.7, 1, 1]);
    }
    // Low-pitch gable roof, ridge front-to-back, with gable infill.
    const rise = W / 2 * 0.09, t3 = [roofTint.r, roofTint.g, roofTint.b], sc = this.lib.scale(roofKey);
    const ov = 0.3, ang = Math.atan2(rise, W / 2);
    const pts = [[-ov, H - ov * 0.09, -ov], [-ov, H - ov * 0.09, D + ov], [W / 2, H + rise, D + ov], [W / 2, H + rise, -ov]];
    this.b.poly(roofKey, pts, [-Math.sin(ang), Math.cos(ang), 0], [0, 0, (D + 2 * ov) / sc, 0, (D + 2 * ov) / sc, (W / 2 + ov) / sc, 0, (W / 2 + ov) / sc], null, null, t3);
    const pts2 = [[W + ov, H - ov * 0.09, D + ov], [W + ov, H - ov * 0.09, -ov], [W / 2, H + rise, -ov], [W / 2, H + rise, D + ov]];
    this.b.poly(roofKey, pts2, [Math.sin(ang), Math.cos(ang), 0], [0, 0, (D + 2 * ov) / sc, 0, (D + 2 * ov) / sc, (W / 2 + ov) / sc, 0, (W / 2 + ov) / sc], null, null, t3);
    this.b.tri('tiltslab', [W, H, 0], [0, H, 0], [W / 2, H + rise, 0], [0, H / 4, W / 4, H / 4, W / 8, (H + rise) / 4], [tint.r, tint.g, tint.b]);
    this.b.tri('tiltslab', [0, H, D], [W, H, D], [W / 2, H + rise, D], [0, H / 4, W / 4, H / 4, W / 8, (H + rise) / 4], [tint.r, tint.g, tint.b]);
    this.b.setTransform(null);
    this.footprint(m, 0, 0, W, D, 'warehouse');
  },
});
