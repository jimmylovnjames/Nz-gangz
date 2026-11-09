// Run 23: things happening on the street. Every minute or two the director starts something near you,
// picked by the time of day: a house party, a sausage sizzle outside the supermarket, a cop pulling
// someone over, two locals scrapping, someone breaking into a car, boy racers doing donuts in a car park.
// Each has its own little cast from a small pool, its own props, and something you can do about it.
const EVENT_HOURS = { party: [20.5, 3], sizzle: [9.5, 15], pullover: [7, 2], scuffle: [12, 2], breakin: [21, 5], racers: [21.5, 3] };
const EVENT_LOOKS = ['crewA', 'pedM1', 'crewB', 'pedF2', 'pedM2', 'crewC', 'pedF1', 'pedF3'];
function softDot() { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,0.9)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t; }

class StreetEvents {
  constructor(world, ctx) {
    this.world = world; this.ctx = ctx; this.scene = world.scene;
    const tier = world.pedCount || 5, n = tier <= 3 ? 6 : 8;
    this.pool = Array.from({ length: n }, (_, i) => { const p = ctx.person(0, 0, { look: EVENT_LOOKS[i % EVENT_LOOKS.length], seed: 8100 + i * 59, pose: 'relaxed' }); p.visible = false; return { p, h: p.userData.human, busy: false }; });
    this.people = this.pool.map(a => a.p);
    this.active = null; this.timer = 45; this.last = null; this.hostiles = []; this.now = 0;
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.1 });
    this.glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    this.puffTex = softDot();
    this.puffs = Array.from({ length: 18 }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.puffTex, color: 0xdddddd, transparent: true, opacity: 0, depthWrite: false })); s.visible = false; this.scene.add(s); return { s, life: 0, vx: 0, vz: 0 }; });
    this.vest = null; this.markerMat = new THREE.MeshBasicMaterial({ color: 0xffd860, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false });
  }
  get clockH() { return this.world.clock ? this.world.clock.hour : 18; }
  inHours(kind) { const [a, b] = EVENT_HOURS[kind], h = this.clockH; return a <= b ? h >= a && h < b : h >= a || h < b; }
  // ---- cast and props -----------------------------------------------------------------------------
  take(n) { const out = []; for (const a of this.pool) { if (out.length >= n) break; if (!a.busy) { a.busy = true; out.push(a); } } return out; }
  put(a, x, z, face) { a.p.position.set(x, groundHeight(x, z), z); a.p.rotation.y = face; a.p.visible = true; a.h.reset(); a.h.mode = 'idle'; a.h.act = null; a.h.sit = null; a.home = { x, z, face }; a.down = false; }
  marker(a) { if (!a.marker) { a.marker = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.24, 6).rotateX(Math.PI), this.markerMat); a.p.add(a.marker); } a.marker.position.y = 2.25; a.marker.visible = true; }
  prop(parts, glow = false) { const m = new THREE.Mesh(mergeNonIndexedColored(parts), glow ? this.glow : this.mat); m.castShadow = !glow; m.userData.own = true; this.scene.add(m); return m; }
  sign(text, sub, w = 1.6, h = 0.6) {
    const c = document.createElement('canvas'); c.width = 320; c.height = 120; const g = c.getContext('2d');
    g.fillStyle = '#f6f2e6'; g.fillRect(0, 0, 320, 120); g.fillStyle = '#b3261e'; g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.fillText(text, 160, 52); g.fillStyle = '#222'; g.font = 'bold 22px sans-serif'; g.fillText(sub, 160, 92);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8, side: THREE.DoubleSide })); m.userData.own = true; this.scene.add(m); return m;
  }
  car(type, color) { const K = this.world.city.carKit; if (!K || !K.protos[type]) return null; const g = new THREE.Group(), body = new THREE.Mesh(K.protos[type].body, new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.5 })), rest = new THREE.Mesh(K.protos[type].rest, K.rest); body.castShadow = rest.castShadow = true; g.add(body, rest); this.scene.add(g); return g; }
  puff(x, y, z, vx, vz, size = 1.2, life = 1.6, color = 0xdddddd) { const P = this.puffs.find(q => q.life <= 0); if (!P) return; P.s.position.set(x, y, z); P.vx = vx; P.vz = vz; P.life = P.max = life; P.size = size; P.s.material.color.setHex(color); P.s.visible = true; }
  puffFrame(dt) { for (const P of this.puffs) { if (P.life <= 0) continue; P.life -= dt; const k = 1 - P.life / P.max; P.s.position.x += P.vx * dt; P.s.position.z += P.vz * dt; P.s.position.y += dt * 0.6; P.s.scale.setScalar(P.size * (0.6 + k * 1.6)); P.s.material.opacity = 0.45 * (1 - k); if (P.life <= 0) P.s.visible = false; } }
  // Somewhere 50-140 m away that isn't right in front of you (no popping in).
  okSpot(x, z, me, yaw, min = 50, max = 140) { const d = Math.hypot(x - me.x, z - me.z); if (d < min || d > max) return false; const ahead = ((x - me.x) * -Math.sin(yaw) + (z - me.z) * -Math.cos(yaw)) / d; return d > 60 || ahead < 0.3; }
  // ---- director --------------------------------------------------------------------------------------
  pick() {
    const kinds = Object.keys(EVENT_HOURS).filter(k => k !== this.last && this.inHours(k));
    return kinds.length ? kinds[Math.floor(Math.random() * kinds.length)] : null;
  }
  start(kind, me, yaw, force) {
    if (this.active) this.end();
    const E = { kind, t: 0, actors: [], props: [], state: 'on', life: 150 + Math.random() * 90, force };
    const ok = this['start_' + kind] && this['start_' + kind](E, me, yaw, force);
    if (!ok) { this.free(E); return null; }
    this.active = E; this.last = kind; return E;
  }
  free(E) {
    for (const a of E.actors) { a.busy = false; a.p.visible = false; a.h.reset(); if (a.marker) a.marker.visible = false; if (a.vest) a.vest.visible = false; a.st = null; }
    for (const o of E.props) { this.scene.remove(o); if (o.userData.own) { o.geometry.dispose(); if (o.material.map) { o.material.map.dispose(); o.material.dispose(); } } }
    this.hostiles = this.hostiles.filter(h => !E.actors.includes(h.a));
  }
  end() { if (this.active) { this.free(this.active); this.active = null; } }
  update(dt, t, me, info) {
    this.now += dt; this.puffFrame(dt);
    const E = this.active;
    if (!E) { if ((this.timer -= dt) <= 0) { this.timer = 60 + Math.random() * 60; const k = this.pick(); if (k) this.start(k, me, info.yaw); } return; }
    E.t += dt; E.d = Math.hypot(E.x - me.x, E.z - me.z);
    // Over when it's run its course and you're not there, or you've left it well behind.
    if (E.d > 230 || (E.t > E.life && E.d > 70) || E.state === 'done') { this.end(); this.timer = 40 + Math.random() * 50; return; }
    this['frame_' + E.kind](E, dt, t, me, info);
    // Anyone in the event looks at you when you're close.
    for (const a of E.actors) if (a.p.visible && !a.down && !a.st) { const dx = me.x - a.p.position.x, dz = me.z - a.p.position.z, d = Math.hypot(dx, dz); a.h.lookYaw = lerp(a.h.lookYaw || 0, d < 6 ? wrapA(Math.atan2(dx, dz) - a.p.rotation.y) : 0, 1 - Math.exp(-dt * 4)); }
  }
  // Who you can TALK to here (the game runs the dialogue).
  talkable(p, r = 3.2) { const E = this.active; if (!E) return null; for (const a of E.actors) if (a.p.visible && !a.down && a.talk && Math.hypot(a.p.position.x - p.x, a.p.position.z - p.z) < r) return { E, a }; return null; }
  near(x, z, r) { const E = this.active; if (!E) return []; return E.actors.filter(a => a.p.visible && !a.down && !a.st && Math.hypot(a.p.position.x - x, a.p.position.z - z) < r); }
  knock(a) {
    const E = this.active;
    // Dropping the car thief counts as catching him; swinging at a scrapper makes it your fight.
    if (E && a === E.thief && (E.state === 'run' || E.state === 'on')) { a.down = true; a.h.knockDown(); E.state = 'caught'; E.caughtT = E.t; this.ctx.onEvent && this.ctx.onEvent('thiefCaught', E); return 'thief'; }
    if (E && a.role === 'fighter' && !a.st) { E.state = 'stopped'; this.turn(a); a.h.hit('jab', 1); return 'fighter'; }
    a.down = true; a.h.knockDown(); a.h.act = null; if (a.marker) a.marker.visible = false; if (E) for (const b of E.actors) if (b !== a && !b.down && !b.st) { b.flee = 6; b.h.act = null; } }
  obstacles() { const E = this.active, out = []; if (!E) return out; for (const c of E.cars || []) { const fx = Math.sin(c.rotation.y), fz = Math.cos(c.rotation.y); out.push({ x: c.position.x + fx * 1.2, z: c.position.z + fz * 1.2, r: 1.0, car: c }, { x: c.position.x - fx * 1.2, z: c.position.z - fz * 1.2, r: 1.0, car: c }); } return out; }
  // Watchers in a ring round (x, z), filming or cheering.
  crowd(E, x, z, n, r0 = 5) { for (const a of this.take(n)) { const ang = Math.random() * TAU, r = r0 + Math.random() * 2, px = x + Math.sin(ang) * r, pz = z + Math.cos(ang) * r; if (this.ctx.collides(px, pz, 0.35)) { a.busy = false; continue; } this.put(a, px, pz, Math.atan2(x - px, z - pz)); a.h.act = Math.random() < 0.5 ? 'film' : 'cheer'; a.role = 'watch'; E.actors.push(a); } }
  walkTo(a, tx, tz, speed, dt) { const p = a.p.position, dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz); if (d < 0.3) return true; const st = Math.min(d, speed * dt); this.ctx.slide(p, dx / d * st, dz / d * st); p.y = groundHeight(p.x, p.z); a.p.rotation.y += wrapA(Math.atan2(dx, dz) - a.p.rotation.y) * Math.min(1, dt * 8); return false; }
  fleeFrame(E, dt, me) { for (const a of E.actors) if (a.flee > 0) { a.flee -= dt; const dx = a.p.position.x - me.x, dz = a.p.position.z - me.z, d = Math.hypot(dx, dz) || 1; this.ctx.slide(a.p.position, dx / d * 4.2 * dt, dz / d * 4.2 * dt); a.p.rotation.y = Math.atan2(dx, dz); a.p.position.y = groundHeight(a.p.position.x, a.p.position.z); if (a.flee <= 0) a.p.visible = false; } }
  // ---- the house party (night) ---------------------------------------------------------------------------
  start_party(E, me, yaw, force) {
    const hs = this.ctx.houses.filter(h => force ? Math.hypot(h.pos.x - me.x, h.pos.z - me.z) < 130 && Math.hypot(h.pos.x - me.x, h.pos.z - me.z) > 15 : this.okSpot(h.pos.x, h.pos.z, me, yaw)).sort(() => Math.random() - 0.5)[0]; if (!hs) return false;
    const nx = Math.sin(hs.rot), nz = Math.cos(hs.rot), tx = Math.cos(hs.rot), tz = -Math.sin(hs.rot);
    E.x = hs.pos.x; E.z = hs.pos.z; E.house = hs;
    const cast = this.take(5); if (cast.length < 3) return false;
    cast.forEach((a, i) => { const ang = i / cast.length * TAU, px = E.x + nx * 0.6 + Math.sin(ang) * 1.4, pz = E.z + nz * 0.6 + Math.cos(ang) * 1.4; this.put(a, px, pz, Math.atan2(E.x - px, E.z - pz)); a.h.act = i === 0 ? 'talk' : i % 2 ? 'cheer' : 'listen'; a.role = 'guest'; E.actors.push(a); });
    cast[0].talk = 'party'; this.marker(cast[0]);
    // Fairy lights along the front of the house, a speaker and a chilly bin on the lawn.
    const L = [], cols = [0xff4040, 0x40ff60, 0x4080ff, 0xffd040, 0xff60ff];
    for (let k = -7; k <= 7; k++) { const x = E.x - nx * 2.2 + tx * k * 0.55, z = E.z - nz * 2.2 + tz * k * 0.55, y = 2.35 - Math.abs(Math.sin(k * 0.9)) * 0.12; L.push(cbox(x - 0.04, x + 0.04, y - 0.04, y + 0.04, z - 0.04, z + 0.04, cols[(k + 7) % cols.length])); }
    E.props.push(this.prop(L, true));
    const sx = E.x + tx * 2.4, sz = E.z + tz * 2.4;
    E.props.push(this.prop([cbox(sx - 0.25, sx + 0.25, 0, 0.9, sz - 0.22, sz + 0.22, 0x151515), cbox(sx - 0.15, sx + 0.15, 0.55, 0.8, sz + 0.221, sz + 0.23, 0x444444), cbox(sx - 1.4, sx - 0.9, 0, 0.4, sz - 0.2, sz + 0.2, 0x2b6cb0), cbox(sx - 1.42, sx - 0.88, 0.4, 0.46, sz - 0.22, sz + 0.22, 0xf2f2f2)]));
    E.beatT = 0; E.n = 0; return true;
  }
  frame_party(E, dt, t, me) {
    this.fleeFrame(E, dt, me);
    E.actors.forEach((a, i) => { if (a.flee || a.down) return; if (a.h.act === 'cheer') a.p.rotation.y = a.home.face + Math.sin(t * 2.1 + i) * 0.35; if (Math.random() < dt * 0.05) a.h.act = ['cheer', 'talk', 'listen'][Math.floor(Math.random() * 3)]; });
    // The music: a bassline you can hear down the street.
    const v = clamp(1 - E.d / 75, 0, 1);
    if (v > 0.02 && (E.beatT -= dt) <= 0) { E.beatT = 60 / 104 / 2; E.n++; if (E.n % 2) SFX.play('thump', v * 1.2); else SFX.play('hat', v); }
    if (E.d < 18 && Math.random() < dt * 0.15) this.ctx.bubble(E.actors[Math.floor(Math.random() * E.actors.length)].p, 'evPartyB');
  }
  // ---- the sausage sizzle (day) -------------------------------------------------------------------------------
  start_sizzle(E, me, yaw, force) {
    const big = /PAK'N'PAY|SUPERMARKET|STOREHOUSE|WAREHOUSE|MITRE|HARDWARE|NU WORLD|BUNNINGS|COUNTDOWN|WOOLWORTHS/;
    const cand = this.ctx.signs.filter(s => big.test(s.text) && (force ? Math.hypot(s.pos.x - me.x, s.pos.z - me.z) < 160 : this.okSpot(s.pos.x, s.pos.z, me, yaw, 50, 170)));
    // The car parks out front first (that's where they set up), then the front of a big shop.
    const lots = ['southmallCarpark', 'clendonShops', 'greatSouthRd'].map(k => this.ctx.places[k]).filter(pl => pl && (force ? Math.hypot(pl.pos.x - me.x, pl.pos.z - me.z) < 200 : this.okSpot(pl.pos.x, pl.pos.z, me, yaw, 50, 200))).map(pl => ({ x: pl.pos.x, z: pl.pos.z, lot: true }));
    const sites = [...lots.sort(() => Math.random() - 0.5), ...cand.map(s => ({ x: s.pos.x, z: s.pos.z })).sort(() => Math.random() - 0.5)];
    let spot = null; for (const s of sites) { spot = s.lot && !this.ctx.collides(s.x, s.z, 2.2) ? { x: s.x, z: s.z } : this.ctx.frontOf(s.x, s.z); if (spot) break; }
    if (!spot && force) spot = this.ctx.frontOf(me.x + 6, me.z) || { x: me.x + 6, z: me.z + 2 };
    if (!spot) return false;
    const face = Math.atan2(me.x - spot.x, me.z - spot.z), fx = Math.sin(face), fz = Math.cos(face), rx = Math.cos(face), rz = -Math.sin(face);
    E.x = spot.x; E.z = spot.z; E.face = face;
    // Gazebo (blue canopy on four legs), trestle table, the barbie.
    const P = [], at = (u, v) => [E.x + rx * u + fx * v, E.z + rz * u + fz * v];
    for (const [u, v] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) { const [x, z] = at(u, v); P.push(cbox(x - 0.03, x + 0.03, 0, 2.2, z - 0.03, z + 0.03, 0xdddddd)); }
    { const [x, z] = at(0, 0); const g = new THREE.ConeGeometry(2.1, 0.55, 4, 1).rotateY(Math.PI / 4 + face).toNonIndexed(); g.translate(x, 2.45, z); g.deleteAttribute('uv'); const c = new THREE.Color(0x2459b8), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); P.push(g); }
    const tb = (u0, u1, v0, v1, y0, y1, col) => { const c = [at(u0, v0), at(u1, v0), at(u0, v1), at(u1, v1)]; const xs = c.map(q => q[0]), zs = c.map(q => q[1]); P.push(cbox(Math.min(...xs), Math.max(...xs), y0, y1, Math.min(...zs), Math.max(...zs), col)); };
    tb(-1.1, 0.2, 0.55, 1.05, 0.72, 0.76, 0xeeeeee); tb(-1.05, -0.95, 0.6, 1.0, 0, 0.72, 0x888888); tb(0.1, 0.2, 0.6, 1.0, 0, 0.72, 0x888888);
    tb(0.5, 1.3, 0.45, 1.0, 0.0, 0.85, 0x1b1b1b); tb(0.48, 1.32, 0.43, 1.02, 0.85, 0.9, 0x555555);
    E.props.push(this.prop(P));
    const sg = this.sign('SAUSAGE SIZZLE $3', 'School camp fundraiser'); const [sx, sz] = at(-0.45, 1.12); sg.position.set(sx, 0.55, sz); sg.rotation.y = face; E.props.push(sg);
    E.grill = at(0.9, 0.72);
    const cast = this.take(2); if (cast.length < 2) return false;
    const [ax, az] = at(-0.4, -0.1), [bx, bz] = at(0.9, -0.05);
    this.put(cast[0], ax, az, face); cast[0].h.act = 'talk'; cast[0].talk = 'sizzle'; cast[0].role = 'till';
    this.put(cast[1], bx, bz, face); cast[1].h.act = 'rest'; cast[1].role = 'cook';
    E.actors.push(...cast); this.marker(cast[0]); E.puffT = 0; E.life = 240; return true;
  }
  frame_sizzle(E, dt, t, me) {
    this.fleeFrame(E, dt, me);
    if (E.d < 90 && (E.puffT -= dt) <= 0) { E.puffT = 0.35; this.puff(E.grill[0] + (Math.random() - 0.5) * 0.4, 1.1, E.grill[1] + (Math.random() - 0.5) * 0.3, 0.15, 0.05, 0.6, 2.4, 0xcfcfcf); }
    const cook = E.actors.find(a => a.role === 'cook'); if (cook && !cook.down && !cook.flee) cook.h.act = Math.sin(t * 0.9) > 0 ? 'rest' : 'push';
  }
  // ---- cops pulling someone over ---------------------------------------------------------------------------------
  start_pullover(E, me, yaw, force) {
    const T = this.ctx.traffic, nodes = T.nodes; let pick = null;
    const close = []; for (let i = 0; i < nodes.length; i++) { const n = nodes[i], d = Math.hypot(n.x - me.x, n.z - me.z); if (d > 20 && d < 160) close.push(i); }
    for (let k = 0; k < 160 && !pick && close.length; k++) { const i = close[Math.floor(Math.random() * close.length)], n = nodes[i]; const e = n.nb.find(e => e.vmax <= 13 && e.vmax >= 9); if (!e) continue; const m = nodes[e.to], L = Math.hypot(m.x - n.x, m.z - n.z); if (L < 30) continue; const ux = (m.x - n.x) / L, uz = (m.z - n.z) / L, lane = e.lane + 1.1, cx = (n.x + m.x) / 2 + uz * lane, cz = (n.z + m.z) / 2 - ux * lane;
      // Room at the kerb for both cars and the constable.
      if (this.ctx.collides(cx, cz, 1.0) || this.ctx.collides(cx - ux * 7, cz - uz * 7, 1.0) || this.ctx.collides(cx + ux * 0.4 - uz * 1.45, cz + uz * 0.4 + ux * 1.45, 0.35)) continue;
      if (force ? Math.hypot(cx - me.x, cz - me.z) > 25 && Math.hypot(cx - me.x, cz - me.z) < 120 : this.okSpot(cx, cz, me, yaw)) pick = { n, m, e }; }
    if (!pick) return false;
    const { n, m, e } = pick, L = Math.hypot(m.x - n.x, m.z - n.z), ux = (m.x - n.x) / L, uz = (m.z - n.z) / L, h = Math.atan2(ux, uz), lane = e.lane + 1.1;
    const cx = (n.x + m.x) / 2 + uz * lane, cz = (n.z + m.z) / 2 - ux * lane;
    E.x = cx; E.z = cz;
    const car = this.car(Math.floor(Math.random() * 3), [0x8a1414, 0x15171a, 0xb8bcc0, 0x1f3f78][Math.floor(Math.random() * 4)]); if (!car) return false;
    car.position.set(cx, groundHeight(cx, cz) * 0.2, cz); car.rotation.y = h; E.props.push(car);
    const cop = this.ctx.policeCar(); cop.position.set(cx - ux * 7, groundHeight(cx, cz) * 0.2, cz - uz * 7); cop.rotation.y = h; this.scene.add(cop); E.props.push(cop); E.cop = cop; E.cars = [car, cop];
    // The constable at the driver's window (right-hand drive: the right side of the car).
    const [o] = this.take(1); if (!o) return false;
    const ox = cx + ux * 0.4 - uz * 1.45, oz = cz + uz * 0.4 + ux * 1.45;
    this.put(o, ox, oz, Math.atan2(uz, -ux)); o.h.act = 'talk'; o.talk = 'cop'; o.role = 'cop'; E.actors.push(o); this.hiVis(o);
    return true;
  }
  hiVis(a) {
    if (!a.vest) {
      const chest = a.h.bones && a.h.bones.find(b => b.name === 'chest'); if (!chest) return;
      const g = new THREE.Group(), vm = new THREE.MeshStandardMaterial({ color: 0xd8f020, emissive: 0x2c3a00, roughness: 0.7 }), sm = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, emissive: 0x303030, roughness: 0.3, metalness: 0.6 });
      const v = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.46, 12, 1, true), vm); v.scale.set(1.02, 1, 0.72); g.add(v);
      for (const y of [-0.12, 0.02]) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.2, 0.04, 12, 1, true), sm); s.scale.set(1.03, 1, 0.74); s.position.y = y; g.add(s); }
      g.position.y = -0.02; chest.add(g); a.vest = g;
    }
    a.vest.visible = true;
  }
  frame_pullover(E, dt, t, me, info) {
    this.fleeFrame(E, dt, me);
    const flash = Math.sin(t * 12) > 0; if (E.cop.userData.lr) { E.cop.userData.lr.visible = flash; E.cop.userData.lb.visible = !flash; }
    // Got heat and you walk right past them? They notice.
    const o = E.actors[0]; if (o && !o.down && info.heat && E.d < 14 && !E.noticed) { E.noticed = true; this.ctx.bubble(o.p, 'evCopNotice'); this.ctx.onEvent && this.ctx.onEvent('copNotice', E); }
    if (o && !o.down && E.d < 16 && Math.random() < dt * 0.08) this.ctx.bubble(o.p, 'evCopB');
  }
  // ---- two locals scrapping ----------------------------------------------------------------------------------------
  start_scuffle(E, me, yaw, force) {
    const sp = this.ctx.spots().filter(s => s.kind === 'chat' && !s.yard && (force ? Math.hypot(s.x - me.x, s.z - me.z) < 70 && Math.hypot(s.x - me.x, s.z - me.z) > 8 : this.okSpot(s.x, s.z, me, yaw, 45, 130)) && !s.agents.length).sort(() => Math.random() - 0.5)[0];
    let x, z; if (sp) { x = sp.x; z = sp.z; }
    else if (force) { for (let k = 0; k < 48 && x == null; k++) { const a = k * 2.4, r = 7 + (k % 4) * 2, px = me.x + Math.sin(a) * r, pz = me.z + Math.cos(a) * r; if (!this.ctx.collides(px, pz, 1.3) && !isCarriageway(px, pz)) { x = px; z = pz; } } if (x == null) return false; }
    else return false;
    if (this.ctx.collides(x, z, 1.2)) return false;
    E.x = x; E.z = z;
    const [A, B] = this.take(2); if (!B) return false;
    const ang = Math.random() * TAU; this.put(A, x + Math.sin(ang) * 0.85, z + Math.cos(ang) * 0.85, ang + Math.PI); this.put(B, x - Math.sin(ang) * 0.85, z - Math.cos(ang) * 0.85, ang);
    for (const a of [A, B]) { a.h.mode = 'guard'; a.role = 'fighter'; a.talk = 'scuffle'; a.hp = 3; E.actors.push(a); }
    this.crowd(E, x, z, 3, 4.5);
    E.swingT = 1; E.fighters = [A, B]; E.life = 120; return true;
  }
  frame_scuffle(E, dt, t, me) {
    this.fleeFrame(E, dt, me);
    const [A, B] = E.fighters;
    if (E.state === 'on' && !A.st && !B.st && !A.down && !B.down) {
      // Circling, swinging, taking it.
      for (const [a, b] of [[A, B], [B, A]]) { a.p.rotation.y = Math.atan2(b.p.position.x - a.p.position.x, b.p.position.z - a.p.position.z); a.h.mode = 'guard'; }
      if ((E.swingT -= dt) <= 0) {
        E.swingT = 0.8 + Math.random() * 0.9; const [a, b] = Math.random() < 0.5 ? [A, B] : [B, A], mv = ['jab', 'cross', 'hook', 'jab', 'hay'][Math.floor(Math.random() * 5)];
        a.h.attack(mv); setTimeout(() => { if (b.p.visible && !b.down) { b.h.hit(mv === 'hook' || mv === 'hay' ? 'hook' : 'jab', Math.random() < 0.5 ? 1 : -1); if (E.d < 40) SFX.play('hit', clamp(1 - E.d / 40, 0.1, 0.7)); } }, 160);
        if (Math.random() < 0.3) this.ctx.bubble(a.p, 'evScuffleB');
      }
      // Nobody steps in: after a while one of them drops.
      if (E.t > 70 && !E.loser) { E.loser = Math.random() < 0.5 ? A : B; E.loser.down = true; E.loser.h.knockDown(); E.state = 'over'; }
    }
    if (E.state === 'stopped' || E.state === 'over') {
      // Break it up / it's done: they walk off in different directions.
      for (const a of E.fighters) if (!a.down && !a.st) { a.h.mode = 'idle'; if (!a.leave) a.leave = { x: a.p.position.x + (a.p.position.x - E.x) * 12, z: a.p.position.z + (a.p.position.z - E.z) * 12 }; if (this.walkTo(a, a.leave.x, a.leave.z, 1.4, dt) || Math.hypot(a.p.position.x - me.x, a.p.position.z - me.z) > 45) a.p.visible = false; }
      for (const a of E.actors) if (a.role === 'watch' && a.h.act) { a.h.act = null; a.flee = 0; }
      if (E.t > (E.overT = E.overT || E.t + 25)) E.state = 'done';
    }
  }
  // One of them turns on you.
  turn(a) { const st = { a, p: a.p, hp: 3, maxHp: 3, hostile: true, stagger: 0, windup: 0, attackT: 1, event: true }; a.st = st; a.talk = null; this.hostiles.push(st); return st; }
  // A scrapper you put down.
  ko(st) { const a = st.a; a.down = true; a.h.knockDown(); this.hostiles = this.hostiles.filter(h => h !== st); const E = this.active; if (E) { E.state = 'over'; E.overT = E.t + 25; for (const w of E.actors) if (w.role === 'watch' && Math.random() < 0.6) this.ctx.bubble(w.p, 'ambFightCheer'); } }
  // ---- a car break-in (night) -------------------------------------------------------------------------------------
  start_breakin(E, me, yaw, force) {
    const c = this.ctx.cars().filter(c => !c.taken && (force ? Math.hypot(c.x - me.x, c.z - me.z) < 140 && Math.hypot(c.x - me.x, c.z - me.z) > 25 : this.okSpot(c.x, c.z, me, yaw, 45, 120))).sort(() => Math.random() - 0.5)[0]; if (!c) return false;
    const h = c.h || 0, fx = Math.sin(h), fz = Math.cos(h), rx = -Math.cos(h), rz = Math.sin(h);
    const px = c.x + rx * 1.35 + fx * 0.3, pz = c.z + rz * 1.35 + fz * 0.3; if (this.ctx.collides(px, pz, 0.3)) return false;
    E.x = c.x; E.z = c.z; E.car = c;
    const [th] = this.take(1); if (!th) return false;
    this.put(th, px, pz, Math.atan2(-rx, -rz)); th.h.act = 'push'; th.role = 'thief'; E.actors.push(th); E.thief = th; E.alarmT = 0; E.life = 150; return true;
  }
  frame_breakin(E, dt, t, me, info) {
    const th = E.thief;
    if (E.state === 'on' && E.d < 24 && !info.inCar) { E.state = 'run'; SFX.play('alarm', 1); this.ctx.bubble(th.p, 'evThiefB'); th.h.act = null; }
    if (E.state === 'run' || E.state === 'on' && E.alarm) { if ((E.alarmT -= dt) <= 0 && E.d < 120) { E.alarmT = 1.1; SFX.play('alarm', clamp(1 - E.d / 120, 0.1, 1)); } }
    if (E.state === 'run' && !th.down) {
      E.alarm = true;
      const dx = th.p.position.x - me.x, dz = th.p.position.z - me.z, d = Math.hypot(dx, dz) || 1, b0 = th.p.position.clone();
      // Away from you, sliding round whatever's in the way, with a bit of a weave.
      const w = Math.sin(E.t * 0.7) * 0.6, ux = dx / d * Math.cos(w) - dz / d * Math.sin(w), uz = dz / d * Math.cos(w) + dx / d * Math.sin(w);
      this.ctx.slide(th.p.position, ux * 5.4 * dt, uz * 5.4 * dt); th.p.position.y = groundHeight(th.p.position.x, th.p.position.z); th.p.rotation.y = Math.atan2(ux, uz);
      th.h.speed = b0.distanceTo(th.p.position) / Math.max(dt, 1e-4);
      if (d < 1.5 && !info.inCar) { th.down = true; th.h.knockDown(); E.state = 'caught'; E.caughtT = E.t; this.ctx.onEvent && this.ctx.onEvent('thiefCaught', E); }
      else if (d > 65) { th.p.visible = false; E.state = 'gone'; this.ctx.onEvent && this.ctx.onEvent('thiefGone', E); }
    }
    if (E.state === 'caught' && E.t - E.caughtT > 8) { th.down = false; th.h.getUp(); th.flee = 6; E.state = 'over'; }
    if (E.state === 'over') { this.fleeFrame(E, dt, me); if (!th.p.visible || th.flee <= 0) E.state = 'done'; }
    if (E.state === 'gone') E.state = 'done';
  }
  // ---- boy racers doing donuts (late night) ---------------------------------------------------------------------------
  start_racers(E, me, yaw, force) {
    const sites = ['southmallCarpark', 'clendonShops'].map(k => this.ctx.places[k]).filter(Boolean).filter(p => force ? Math.hypot(p.pos.x - me.x, p.pos.z - me.z) < 260 : this.okSpot(p.pos.x, p.pos.z, me, yaw, 50, 260));
    const P = sites[Math.floor(Math.random() * sites.length)]; if (!P) return false;
    // A clear circle to spin in.
    let cx = P.pos.x, cz = P.pos.z, ok = false;
    for (let k = 0; k < 30 && !ok; k++) { const x = P.pos.x + (Math.random() - 0.5) * 50, z = P.pos.z + (Math.random() - 0.5) * 50; ok = true; for (let a = 0; a < 12 && ok; a++) if (this.ctx.collides(x + Math.sin(a / 12 * TAU) * 8, z + Math.cos(a / 12 * TAU) * 8, 1.2)) ok = false; if (ok) { cx = x; cz = z; } }
    if (!ok) return false;
    E.x = cx; E.z = cz; E.cars = [this.car(0, 0xf2f2f0), this.car(1, 0x15171a)].filter(Boolean); E.props.push(...E.cars); E.ph = [0, Math.PI]; E.screechT = 0; E.revT = 2;
    this.crowd(E, cx, cz, 4, 11);
    E.actors.forEach(a => { a.talk = 'racers'; }); return true;
  }
  frame_racers(E, dt, t, me, info) {
    this.fleeFrame(E, dt, me);
    E.cars.forEach((c, i) => {
      E.ph[i] += dt * (1.25 + i * 0.15); const r = 6.5 - i * 1.5, a = E.ph[i] * (i ? -1 : 1), x = E.x + Math.sin(a) * r, z = E.z + Math.cos(a) * r;
      const tan = a + (i ? -1 : 1) * Math.PI / 2; c.position.set(x, groundHeight(x, z) * 0.2, z); c.rotation.y = tan + (i ? -0.65 : 0.65);
      if (E.d < 120 && Math.random() < dt * 9) { const fx = Math.sin(c.rotation.y), fz = Math.cos(c.rotation.y); this.puff(x - fx * 1.6 + (Math.random() - 0.5), 0.4, z - fz * 1.6 + (Math.random() - 0.5), (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, 1.6, 2.2, 0xe8e8e8); }
    });
    const v = clamp(1 - E.d / 140, 0, 1);
    if (v > 0.02 && (E.screechT -= dt) <= 0) { E.screechT = 0.7 + Math.random() * 0.6; SFX.play('screech', v); }
    if (v > 0.02 && (E.revT -= dt) <= 0) { E.revT = 1.5 + Math.random() * 2; SFX.play('rev', v); }
    for (const a of E.actors) if (!a.flee && Math.random() < dt * 0.1) a.h.act = Math.random() < 0.5 ? 'film' : 'cheer';
    // On foot in the ring: they're not stopping for you.
    if (!info.inCar && E.cars.some(c => Math.hypot(c.position.x - me.x, c.position.z - me.z) < 2.1)) this.ctx.onEvent && this.ctx.onEvent('racerHit', E);
    // The cops turn up eventually and everyone scatters.
    if (E.t > 140 && E.state === 'on') { E.state = 'scatter'; for (const a of E.actors) a.flee = 6; SFX.play('sirenFar'); }
    if (E.state === 'scatter') { E.cars.forEach((c, i) => { const fx = Math.sin(c.rotation.y), fz = Math.cos(c.rotation.y); c.position.x += fx * 14 * dt * (i ? 1 : -1); c.position.z += fz * 14 * dt * (i ? 1 : -1); }); if (E.t > 150) E.state = 'done'; }
  }
}
