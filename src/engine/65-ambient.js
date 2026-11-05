// The living street (Run 22): locals at real spots (bus stops, shop fronts, courts, the skate park, front
// yards), kids playing, dogs, a crowd that gathers to watch a scrap, people who greet you as you go past,
// the ice-cream van doing its rounds, and the sounds of the neighbourhood. Everything is drawn from fixed
// pools near the player and recycled, so the cost stays flat however far you walk.
const AMB_ADULT = ['crewA', 'pedM1', 'pedF2', 'crewB', 'pedM2', 'pedF1', 'crewC', 'pedF3', 'pedM1', 'pedF2', 'crewB', 'pedM2'];
const AMB_KID = ['pedM2', 'pedF1', 'pedF3', 'pedM1', 'pedF2', 'pedM2'];
const AMB_AUNTY = ['pedF1', 'pedF3', 'pedF2'];
const hash2 = (x, z) => { let h = Math.imul((x * 10) | 0, 73856093) ^ Math.imul((z * 10) | 0, 19349663); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };

// A dog: one skinned mesh (shared character atlas), trots, sniffs, barks at you, wags. Staffy-ish build.
class Dog {
  constructor(material, seed) {
    const r = mulberry32(seed), coat = new THREE.Color([0x3b2a20, 0x1c1a19, 0x8a6a48, 0xb89a78, 0x5a4636][Math.floor(r() * 5)]), belly = coat.clone().lerp(new THREE.Color(0xd8cbb8), 0.35);
    const BN = [['root', -1, [0, 0, 0]], ['hips', 0, [0, 0.46, -0.2]], ['chest', 1, [0, 0.02, 0.4]], ['neck', 2, [0, 0.08, 0.1]], ['head', 3, [0, 0.12, 0.06]], ['tail', 1, [0, 0.04, -0.06]],
      ['fl', 2, [0.09, -0.06, 0.02]], ['flLo', 6, [0, -0.2, 0]], ['fr', 2, [-0.09, -0.06, 0.02]], ['frLo', 8, [0, -0.2, 0]],
      ['bl', 1, [0.09, -0.04, 0]], ['blLo', 10, [0, -0.2, 0]], ['br', 1, [-0.09, -0.04, 0]], ['brLo', 12, [0, -0.2, 0]]];
    const I = Object.fromEntries(BN.map((b, i) => [b[0], i])), parts = [];
    const torso = new THREE.CapsuleGeometry(0.135, 0.42, 4, 12).rotateX(Math.PI / 2); torso.scale(1, 1.05, 1); torso.translate(0, 0.47, 0);
    parts.push(part(torso, ATLAS.knit, coat, I.hips, I.chest, -0.05, 0.12));
    const tp = torso.attributes.position; // weights by z, not y: re-stamp
    { const si = torso.attributes.skinIndex, sw = torso.attributes.skinWeight; for (let i = 0; i < tp.count; i++) { const w = clamp((tp.getZ(i) + 0.05) / 0.25, 0, 1); si.setXY(i, I.hips, I.chest); sw.setXY(i, 1 - w, w); } }
    const neck = new THREE.CylinderGeometry(0.07, 0.09, 0.16, 10).rotateX(-0.7); neck.translate(0, 0.6, 0.3); parts.push(part(neck, ATLAS.knit, coat, I.neck));
    const head = new THREE.SphereGeometry(0.1, 12, 10); head.scale(1, 0.95, 1.1); head.translate(0, 0.7, 0.36); parts.push(part(head, ATLAS.knit, coat, I.head));
    const snout = new THREE.BoxGeometry(0.09, 0.075, 0.12, 2, 2, 2); snout.translate(0, 0.67, 0.47); parts.push(part(snout, ATLAS.knit, belly, I.head));
    const nose = new THREE.SphereGeometry(0.022, 6, 6); nose.translate(0, 0.69, 0.535); parts.push(part(nose, ATLAS.leather, new THREE.Color(0x111111), I.head));
    for (const s of [1, -1]) { const ear = new THREE.ConeGeometry(0.035, 0.07, 6); ear.rotateZ(-s * 0.3); ear.translate(s * 0.055, 0.79, 0.33); parts.push(part(ear, ATLAS.knit, coat, I.head)); }
    for (const [up, lo, x, z] of [['fl', 'flLo', 0.09, 0.22], ['fr', 'frLo', -0.09, 0.22], ['bl', 'blLo', 0.09, -0.2], ['br', 'brLo', -0.09, -0.2]]) {
      parts.push(part(limb(0.05, 0.04, 0.18, x, 0.42, z), ATLAS.knit, coat, I[up]));
      parts.push(part(limb(0.035, 0.03, 0.18, x, 0.22, z), ATLAS.knit, belly, I[lo]));
    }
    const tail = new THREE.CylinderGeometry(0.012, 0.025, 0.24, 6); tail.rotateX(-0.9); tail.translate(0, 0.55, -0.34); parts.push(part(tail, ATLAS.knit, coat, I.tail));
    const geometry = mergeParts(parts);
    const bones = BN.map(([n]) => { const b = new THREE.Bone(); b.name = n; return b; });
    BN.forEach(([n, par, p], i) => { bones[i].position.fromArray(p); if (par >= 0) bones[par].add(bones[i]); });
    // Bone offsets above are relative; rest pose matches the parts' absolute layout when accumulated.
    this.mesh = new THREE.SkinnedMesh(geometry, material); this.mesh.add(bones[0]); this.mesh.bind(new THREE.Skeleton(bones));
    this.mesh.castShadow = true; this.mesh.frustumCulled = false;
    this.root = new THREE.Group(); this.root.add(this.mesh); this.root.scale.setScalar(0.85 + r() * 0.3);
    this.b = Object.fromEntries(BN.map(([n], i) => [n, bones[i]])); this.ph = r(); this.seed = r() * 10;
    this.speed = 0; this.bark = 0; this.wag = 1;
  }
  update(dt, t) {
    const b = this.b, sp = this.speed, gait = clamp(sp / 1.5, 0, 1), run = clamp((sp - 2.5) / 2, 0, 1);
    this.ph = (this.ph + dt * (1.6 + sp * 0.9)) % 1;
    for (const k in b) b[k].rotation.set(0, 0, 0);
    const c = Math.sin(this.ph * TAU), c2 = Math.sin(this.ph * TAU + Math.PI), amp = 0.45 * gait + 0.25 * run;
    b.fl.rotation.x = -c * amp; b.br.rotation.x = -c * amp; b.fr.rotation.x = -c2 * amp; b.bl.rotation.x = -c2 * amp;
    b.flLo.rotation.x = Math.max(0, c) * amp * 0.9; b.brLo.rotation.x = -Math.max(0, -c) * amp * 0.7; b.frLo.rotation.x = Math.max(0, c2) * amp * 0.9; b.blLo.rotation.x = -Math.max(0, -c2) * amp * 0.7;
    b.hips.position.y = 0.46 + Math.abs(Math.cos(this.ph * TAU)) * 0.02 * gait;
    this.bark = Math.max(0, this.bark - dt * 4);
    b.neck.rotation.x = -0.15 * this.bark + (sp < 0.2 ? Math.sin(t * 0.7 + this.seed) * 0.12 : 0.05);
    b.head.rotation.x = -0.35 * this.bark; b.head.rotation.y = this.look || 0;
    b.tail.rotation.y = Math.sin(t * (6 + 8 * this.wag)) * 0.5 * this.wag; b.tail.rotation.x = -0.3 * this.wag;
  }
}

class AmbientLife {
  constructor(world, ctx) {
    this.world = world; this.ctx = ctx; this.scene = world.scene;
    const tier = world.pedCount || 5, nAdult = tier <= 3 ? 6 : tier <= 5 ? 9 : 12, nKid = tier <= 3 ? 3 : tier <= 5 ? 4 : 6;
    this.agents = [];
    for (let i = 0; i < nAdult + nKid; i++) {
      const kid = i >= nAdult, look = kid ? AMB_KID[(i - nAdult) % AMB_KID.length] : AMB_ADULT[i % AMB_ADULT.length];
      const p = ctx.person(0, 0, { look, seed: 7000 + i * 41, pose: 'relaxed' }); p.visible = false;
      if (kid) p.scale.setScalar(0.64 + (i % 3) * 0.05);
      this.agents.push({ p, h: p.userData.human, kid, look, spot: null, greetCD: 0, react: 0 });
    }
    this.people = this.agents.map(a => a.p);
    this.spots = []; this.grid = new Map(); this.buildSpots(world.city);
    // Props: white plastic chairs (uncles in the driveway), a push mower, a ball per court.
    const white = new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.55 }), red = new THREE.MeshStandardMaterial({ color: 0xb02a1c, roughness: 0.5 }), steel = new THREE.MeshStandardMaterial({ color: 0x3a3c3e, roughness: 0.6, metalness: 0.6 });
    this.chairs = Array.from({ length: 4 }, () => { const g = new THREE.Group(); g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.04, 0.44), white), 0, 0.44, 0), at(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.04), white), 0, 0.68, -0.21)); for (const [x, z] of [[-0.2, -0.19], [0.2, -0.19], [-0.2, 0.19], [0.2, 0.19]]) g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.44, 5), white), x, 0.22, z)); g.visible = false; g.traverse(o => { if (o.isMesh) o.castShadow = true; }); this.scene.add(g); return g; });
    this.mower = (() => { const g = new THREE.Group(); g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.55), red), 0, 0.2, 0)); const h = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.05, 5), steel); h.position.set(0, 0.62, -0.42); h.rotation.x = -0.75; g.add(h); for (const [x, z] of [[-0.24, -0.22], [0.24, -0.22], [-0.24, 0.22], [0.24, 0.22]]) g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 10).rotateZ(Math.PI / 2), steel), x, 0.08, z)); g.visible = false; g.traverse(o => { if (o.isMesh) o.castShadow = true; }); this.scene.add(g); return g; })();
    this.balls = Array.from({ length: 2 }, () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), new THREE.MeshStandardMaterial({ color: 0xd8642a, roughness: 0.7 })); m.castShadow = true; m.visible = false; this.scene.add(m); return { m, vx: 0, vz: 0, spot: null }; });
    // Dogs: a few roaming the yards and footpaths near you.
    this.dogs = Array.from({ length: tier <= 3 ? 2 : 3 }, (_, i) => { const d = new Dog(world.charMaterial, 900 + i * 77); d.root.visible = false; this.scene.add(d.root); return { d, home: null, tx: 0, tz: 0, waitT: 0, barkT: 0, cool: 0, flee: 0 }; });
    // Speech bubbles over whoever's talking.
    this.bubbleEl = document.createElement('div'); this.bubbleEl.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:25;overflow:hidden';
    document.body.appendChild(this.bubbleEl); this.bubbles = [];
    this.timer = 0; this.first = true; this.globalTalk = 0; this.fightAt = null; this.danger = 0;
    this.van = this.makeVan(world); this.sound = { barkT: 6 + Math.random() * 10, sirenT: 90 + Math.random() * 90, mower: null, beatT: 0 };
  }

  // ---- spots ------------------------------------------------------------------------------------
  addSpot(s) { s.agents = []; this.spots.push(s); const k = Math.floor(s.x / 80) + ',' + Math.floor(s.z / 80); if (!this.grid.has(k)) this.grid.set(k, []); this.grid.get(k).push(s); }
  roadDir(x, z, max = 9) { let best = null; for (let k = 0; k < 16; k++) { const a = k / 16 * TAU, dx = Math.sin(a), dz = Math.cos(a); for (let d = 0.8; d < max; d += 0.5) if (isCarriageway(x + dx * d, z + dz * d)) { if (!best || d < best.d) best = { d, a }; break; } } return best; }
  clear(x, z, r = 0.45) { return !this.ctx.collides(x, z, r) && !isCarriageway(x, z); }
  frontOf(x, z) { // the open footpath in front of a shop sign
    let best = null;
    for (let k = 0; k < 12; k++) { const a = k / 12 * TAU, dx = Math.sin(a), dz = Math.cos(a); let sc = 0; for (const d of [2.2, 3.2, 4.2]) if (this.clear(x + dx * d, z + dz * d, 0.5)) sc++; if (sc === 3 && (!best || sc > best.sc)) best = { sc, x: x + dx * 3.2, z: z + dz * 3.2 }; }
    return best;
  }
  buildSpots(city) {
    // Bus stops: someone waiting (on the phone, eyes up the road), sitting if there's a shelter.
    for (const [x, z, rot, , shelter] of MAPDATA.busStops) {
      const r = this.roadDir(x, z), face = r ? r.a : rot;
      if (shelter) {
        const sx = x - Math.sin(rot) * -1.4 + Math.cos(rot) * 3, sz = z - Math.cos(rot) * -1.4 - Math.sin(rot) * 3, lz = 0.2;
        this.addSpot({ kind: 'bench', x: sx + lz * Math.sin(rot), z: sz + lz * Math.cos(rot), face: rot + Math.PI, axis: rot, seat: 0.5, n: hash2(x, z) > 0.55 ? 2 : 1 });
      } else this.addSpot({ kind: 'wait', x: x - Math.sin(face) * 1.1, z: z - Math.cos(face) * 1.1, face, n: hash2(x, z) > 0.7 ? 2 : 1 });
    }
    // Shop fronts: a couple of people yarning outside (not every shop, or it's a crowd).
    for (const sg of city.signs) { if (hash2(sg.pos.x, sg.pos.z) > 0.45) continue; const c = this.frontOf(sg.pos.x, sg.pos.z); if (c) this.addSpot({ kind: 'chat', x: c.x, z: c.z, n: 2 + (hash2(sg.pos.z, sg.pos.x) > 0.6 ? 1 : 0), shop: true }); }
    // Courts and fields: kids having a kick-around / shooting hoops.
    for (const [sport, flat] of MAPDATA.pitches) {
      if (!/basketball|netball|rugby|soccer|skateboard/.test(sport)) continue;
      const ring = []; for (let k = 0; k < flat.length; k += 2) ring.push([flat[k], flat[k + 1]]);
      const o = city.obb(ring), field = Math.max(o.w, o.d) > 40;
      this.addSpot({ kind: 'play', x: o.cx, z: o.cz, ang: o.ang, hw: Math.max(2, Math.min(o.w / 2 - 1.5, field ? 16 : 10)), hd: Math.max(2, Math.min(o.d / 2 - 1.5, field ? 10 : 7)), n: 3 + (hash2(o.cx, o.cz) > 0.5 ? 1 : 0), day: true });
    }
    // Named places: people hanging round Southmall, the station, the library, the Clendon shops.
    for (const k of ['southmallCarpark', 'norfolkPine', 'station', 'clendonShops', 'clendonDairy', 'fishAndChips', 'teMatariki', 'greatSouthRd', 'skatepark']) { const p = city.places[k]; if (!p) continue; const c = this.frontOf(p.pos.x, p.pos.z) || { x: p.pos.x, z: p.pos.z }; this.addSpot({ kind: 'chat', x: c.x, z: c.z, n: 3 }); }
    // Front yards: an uncle on a plastic chair, someone mowing the lawn, two neighbours at the letterbox.
    city.houses.forEach(hs => {
      const q = hash2(hs.pos.x, hs.pos.z); if (q > 0.085) return;
      const kind = q < 0.03 ? 'chair' : q < 0.055 ? 'mow' : 'chat';
      this.addSpot({ kind, x: hs.pos.x, z: hs.pos.z, face: hs.rot, n: kind === 'chat' ? 2 : 1, day: kind === 'mow', yard: true, house: hs });
    });
  }
  slotPos(s, i, out) {
    if (s.kind === 'chat') { const n = s.n, a = i / n * TAU + hash2(s.x, s.z) * TAU, r = 0.55 + 0.12 * n; out.x = s.x + Math.sin(a) * r; out.z = s.z + Math.cos(a) * r; out.face = a + Math.PI; }
    else if (s.kind === 'bench') { const off = (i - (s.n - 1) / 2) * 1.0; out.x = s.x + Math.cos(s.axis) * off; out.z = s.z - Math.sin(s.axis) * off; out.face = s.face; }
    else if (s.kind === 'wait') { const off = (i - (s.n - 1) / 2) * 1.2; out.x = s.x + Math.cos(s.face) * off; out.z = s.z - Math.sin(s.face) * off; out.face = s.face + (i ? 0.5 : -0.2); }
    else if (s.kind === 'play') { const u = (hash2(s.x + i, s.z) - 0.5) * 2 * s.hw, v = (hash2(s.x, s.z + i) - 0.5) * 2 * s.hd; out.x = s.x + Math.cos(s.ang) * u - Math.sin(s.ang) * v; out.z = s.z + Math.sin(s.ang) * u + Math.cos(s.ang) * v; out.face = hash2(i, s.x) * TAU; }
    else { out.x = s.x; out.z = s.z; out.face = s.face; }
    return out;
  }
  // ---- assigning locals to nearby spots ------------------------------------------------------------
  night() { return G.uNight.value > 0.5; }
  release(s) {
    for (const a of s.agents) { a.spot = null; a.role = null; a.p.visible = false; a.h.act = null; a.h.sit = null; a.h.reset(); a.moment = null; if (a.marker) a.marker.visible = false; }
    s.agents = [];
    if (s.chair) { s.chair.visible = false; s.chair = null; } if (s.mower) { this.mower.visible = false; s.mower = false; } if (s.ball) { s.ball.m.visible = false; s.ball.spot = null; s.ball = null; }
  }
  assign(s) {
    if (s.day && this.night()) return;
    const want = s.kind === 'play' ? 'kid' : 'adult';
    const free = this.agents.filter(a => !a.spot && (want === 'kid' ? a.kid : !a.kid));
    if (free.length < (s.kind === 'chat' ? 2 : 1)) return;
    if (s.kind === 'chair') { const c = this.chairs.find(c => !c.visible); if (!c) return; s.chair = c; c.visible = true; c.position.set(s.x, groundHeight(s.x, s.z), s.z); c.rotation.y = s.face; }
    if (s.kind === 'mow') { if (this.mower.visible) return; this.mower.visible = true; s.mower = true; }
    if (s.kind === 'play') { s.chaser = 0; const bl = this.balls.find(b => !b.spot); if (bl) { s.ball = bl; bl.spot = s; bl.m.visible = true; bl.m.position.set(s.x, groundHeight(s.x, s.z) + 0.11, s.z); bl.vx = bl.vz = 0; } }
    const n = Math.min(s.n, free.length), tmp = {};
    for (let i = 0; i < n; i++) {
      const a = free[i]; a.spot = s; a.slot = i; s.agents.push(a); this.slotPos(s, i, tmp);
      a.home = { x: tmp.x, z: tmp.z, face: tmp.face }; a.p.position.set(tmp.x, groundHeight(tmp.x, tmp.z), tmp.z); a.p.rotation.y = tmp.face;
      a.p.visible = true; a.h.reset(); a.h.mode = 'idle'; a.h.sit = s.kind === 'bench' || s.kind === 'chair' ? (s.kind === 'chair' ? 0.46 : s.seat) : null;
      a.h.act = s.kind === 'wait' ? (hash2(tmp.x, i) > 0.5 ? 'phone' : null) : null; a.state = 'home'; a.t = Math.random() * 3; a.watch = null; a.flee = 0;
      a.tx = tmp.x; a.tz = tmp.z; a.speakT = Math.random() * 4;
      // Now and then someone has something to ask you (a smoke, help with the shopping, a ball over the fence).
      a.moment = null;
      if (!this.momentBusy && Math.random() < 0.22) {
        if ((s.kind === 'wait' || s.kind === 'chat') && !s.yard && /crew|pedM/.test(a.look)) a.moment = 'smoke';
        else if (s.shop && /pedF/.test(a.look) && i === 0) a.moment = 'bags';
        else if (s.kind === 'play' && i === 0 && this.ctx.fenceNear && this.ctx.fenceNear(s.x, s.z)) a.moment = 'ball';
      }
      if (a.moment && !a.marker) { a.marker = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.24, 6).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: 0xffd860, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false })); a.p.add(a.marker); }
      if (a.marker) { a.marker.visible = !!a.moment; a.marker.position.y = 2.25 / a.p.scale.y; }
    }
  }
  // ---- per frame ---------------------------------------------------------------------------------------
  update(dt, t, me, info) {
    this.fightAt = info.fightAt; this.danger = info.danger;
    if ((this.timer -= dt) <= 0) {
      this.timer = 0.5;
      const cx = Math.floor(me.x / 80), cz = Math.floor(me.z / 80), near = [];
      for (let x = cx - 2; x <= cx + 2; x++) for (let z = cz - 2; z <= cz + 2; z++) for (const s of this.grid.get(x + ',' + z) || []) near.push([s, Math.hypot(s.x - me.x, s.z - me.z)]);
      for (const s of this.spots) if (s.agents.length && Math.hypot(s.x - me.x, s.z - me.z) > 150) this.release(s);
      near.sort((a, b) => a[1] - b[1]);
      const fx = -Math.sin(info.yaw), fz = -Math.cos(info.yaw);
      for (const [s, d] of near) {
        if (d > 105 || s.agents.length) continue;
        const ahead = ((s.x - me.x) * fx + (s.z - me.z) * fz) / Math.max(d, 1);
        if (this.first || d > 45 || ahead < 0.2) this.assign(s); // don't pop people in right in front of you
      }
      this.first = false;
    }
    this.globalTalk -= dt;
    const tmp = {};
    for (const a of this.agents) {
      if (!a.spot) continue;
      const p = a.p, h = a.h, s = a.spot, dx = me.x - p.position.x, dz = me.z - p.position.z, d = Math.hypot(dx, dz);
      a.greetCD -= dt; a.t += dt;
      // A scrap nearby: everyone stops to watch (filming, cheering) at a safe distance; anything nasty and they're off.
      const fight = this.fightAt && Math.hypot(this.fightAt.x - p.position.x, this.fightAt.z - p.position.z) < 26 && !a.kid;
      if (this.danger && d < 30 && !a.flee) { a.flee = 5; this.say(a, 'ambFlee', 0.6); h.sit = null; h.act = null; }
      if (a.flee > 0) {
        a.flee -= dt; const ux = -dx / (d || 1), uz = -dz / (d || 1); this.ctx.slide(p.position, ux * 4.5 * dt, uz * 4.5 * dt); p.rotation.y = Math.atan2(ux, uz); p.position.y = groundHeight(p.position.x, p.position.z);
        if (a.flee <= 0) { a.p.visible = false; a.flee = 0; a.spot.agents = a.spot.agents.filter(q => q !== a); a.spot = null; }
        continue;
      }
      if (fight && s.kind !== 'mow') {
        if (!a.watch) { const ang = Math.atan2(p.position.x - this.fightAt.x, p.position.z - this.fightAt.z) + (Math.random() - 0.5) * 0.6; a.watch = { ang, r: 6 + Math.random() * 2.5, kind: Math.random() < 0.45 ? 'film' : 'cheer' }; h.sit = null; if (Math.random() < 0.5) this.say(a, 'ambFightStart', 0.5); }
        const w = a.watch, tx = this.fightAt.x + Math.sin(w.ang) * w.r, tz = this.fightAt.z + Math.cos(w.ang) * w.r;
        this.walkTo(a, tx, tz, 2.2, dt);
        if (Math.hypot(tx - p.position.x, tz - p.position.z) < 0.6) { p.rotation.y = Math.atan2(this.fightAt.x - p.position.x, this.fightAt.z - p.position.z); h.act = w.kind; if (Math.random() < dt * 0.12) this.say(a, 'ambFightCheer', 0.35); }
        else h.act = null;
        continue;
      } else if (a.watch) { a.watch = null; h.act = null; a.state = 'return'; }
      // Getting back to where they were.
      if (a.state === 'return' || a.state === 'follow') {
        if (a.state === 'follow' && a.follow) { const f = a.follow; if (this.walkTo(a, f.x, f.z, 1.3, dt)) { a.state = 'home'; f.done && f.done(); a.follow = null; } continue; }
        if (this.walkTo(a, a.home.x, a.home.z, 1.4, dt)) { a.state = 'home'; p.rotation.y = a.home.face; if (s.kind === 'bench' || s.kind === 'chair') h.sit = s.kind === 'chair' ? 0.46 : s.seat; }
        continue;
      }
      // Routines.
      if (s.kind === 'chat') {
        if ((a.speakT -= dt) <= 0) { a.speakT = 2.5 + Math.random() * 4; s.speaker = a; }
        h.act = s.speaker === a ? 'talk' : 'listen';
      } else if (s.kind === 'mow') {
        // Back and forth across the front lawn.
        const ax = Math.cos(s.face), az = -Math.sin(s.face), ph = Math.sin(a.t * 0.22) * 3.2, tx = s.x + ax * ph, tz = s.z + az * ph;
        const ox = p.position.x, oz = p.position.z; p.position.x = tx; p.position.z = tz; p.position.y = groundHeight(tx, tz);
        const vx = tx - ox, vz = tz - oz; if (Math.hypot(vx, vz) > 1e-4) p.rotation.y = Math.atan2(vx, vz);
        h.act = 'push'; this.mower.position.set(tx + Math.sin(p.rotation.y) * 0.85, p.position.y, tz + Math.cos(p.rotation.y) * 0.85); this.mower.rotation.y = p.rotation.y;
      } else if (s.kind === 'play') this.play(a, s, dt, t);
      else if (s.kind === 'wait' && a.t > 6) { a.t = 0; if (Math.random() < 0.4) h.act = h.act ? null : 'phone'; }
      // Noticing you: a look, a word as you pass, a "watch it" if you barge through.
      if (!a.kid || s.kind !== 'play') {
        const want = d < 7 ? Math.atan2(dx, dz) - p.rotation.y : 0;
        h.lookYaw = lerp(h.lookYaw, wrapA(want), 1 - Math.exp(-dt * 4));
      }
      if (d < 0.9 && info.speed > 4.2 && a.react <= 0) { a.react = 2; h.hit('jab', Math.sign(dx) || 1); this.say(a, 'ambBump', 1); }
      a.react -= dt;
      if (d < 3.2 && info.speed < 4 && a.greetCD <= 0 && this.globalTalk <= 0 && !info.inCar) {
        a.greetCD = 50 + Math.random() * 40; this.say(a, info.heat ? 'ambHeat' : info.weapon ? 'ambWeapon' : info.rep >= 120 ? 'ambKnown' : this.night() ? 'ambNight' : a.kid ? 'ambKid' : 'ambGreet', 0.55);
      }
    }
    for (const bl of this.balls) if (bl.spot) this.ballFrame(bl, dt);
    this.dogFrame(dt, t, me, info);
    this.vanFrame(dt, t, me, info);
    this.soundFrame(dt, t, me);
    this.bubbleFrame(info.camera);
  }
  walkTo(a, tx, tz, speed, dt) {
    const p = a.p, dx = tx - p.position.x, dz = tz - p.position.z, d = Math.hypot(dx, dz);
    if (d < 0.25) return true;
    const st = Math.min(d, speed * dt); this.ctx.slide(p.position, dx / d * st, dz / d * st); p.position.y = groundHeight(p.position.x, p.position.z);
    const want = Math.atan2(dx, dz), dh = wrapA(want - p.rotation.y); p.rotation.y += dh * Math.min(1, dt * 8);
    a.h.sit = null; return false;
  }
  // Kids: chase the ball round the court, kick it on, the odd sprint.
  play(a, s, dt) {
    const p = a.p, bl = s.ball;
    let tx = a.tx, tz = a.tz;
    if (bl && a.slot === s.chaser) { tx = bl.m.position.x; tz = bl.m.position.z; }
    if (Math.hypot(tx - p.position.x, tz - p.position.z) < 0.5 || (a.t > 4 && a.slot !== s.chaser)) {
      a.t = 0; const u = (Math.random() - 0.5) * 2 * s.hw, v = (Math.random() - 0.5) * 2 * s.hd;
      a.tx = s.x + Math.cos(s.ang) * u - Math.sin(s.ang) * v; a.tz = s.z + Math.sin(s.ang) * u + Math.cos(s.ang) * v;
    }
    this.walkTo(a, tx, tz, a.slot === s.chaser ? 3.8 : 2.4, dt);
    if (bl && a.slot === s.chaser && Math.hypot(bl.m.position.x - p.position.x, bl.m.position.z - p.position.z) < 0.7) {
      // Kick it to a mate.
      const mates = s.agents.filter(q => q !== a), m = mates[Math.floor(Math.random() * mates.length)];
      const tx2 = m ? m.p.position.x : s.x, tz2 = m ? m.p.position.z : s.z, dx = tx2 - bl.m.position.x, dz = tz2 - bl.m.position.z, L = Math.hypot(dx, dz) || 1, v = 5 + Math.random() * 3;
      bl.vx = dx / L * v; bl.vz = dz / L * v; s.chaser = m ? m.slot : a.slot; SFX.play('kick', 0.5);
    }
  }
  ballFrame(bl, dt) {
    const m = bl.m, s = bl.spot; if (!s) return;
    const nx = m.position.x + bl.vx * dt, nz = m.position.z + bl.vz * dt;
    if (this.ctx.collides(nx, nz, 0.11) || isCarriageway(nx, nz)) { bl.vx *= -0.5; bl.vz *= -0.5; } else { m.position.x = nx; m.position.z = nz; }
    const f = Math.exp(-dt * 1.4); bl.vx *= f; bl.vz *= f; m.position.y = groundHeight(m.position.x, m.position.z) + 0.11;
    m.rotation.x += bl.vz * dt * 8; m.rotation.z -= bl.vx * dt * 8;
  }
  // ---- dogs ------------------------------------------------------------------------------------------
  dogFrame(dt, t, me, info) {
    const homes = this.spots.filter(s => s.yard && Math.hypot(s.x - me.x, s.z - me.z) < 90);
    for (const D of this.dogs) {
      const d = D.d, r = d.root;
      if (!D.home || Math.hypot(D.home.x - me.x, D.home.z - me.z) > 130) {
        r.visible = false; D.home = null;
        const h = homes[Math.floor(Math.random() * homes.length)];
        if (h && !this.dogs.some(o => o.home === h) && Math.hypot(h.x - me.x, h.z - me.z) > 35) { D.home = h; r.position.set(h.x + 1.5, groundHeight(h.x, h.z), h.z + 1.5); r.visible = true; D.tx = r.position.x; D.tz = r.position.z; D.waitT = 2; }
        continue;
      }
      const dx = me.x - r.position.x, dz = me.z - r.position.z, dist = Math.hypot(dx, dz);
      D.cool -= dt; D.barkT -= dt;
      let speed = 0, tx = D.tx, tz = D.tz;
      if (D.flee > 0) { D.flee -= dt; tx = r.position.x - dx; tz = r.position.z - dz; speed = 5.5; d.wag = 0; }
      else if (dist < 7 && D.cool <= 0 && !info.inCar) {
        // Bark at you, and give a bit of chase if you run.
        d.look = clamp(wrapA(Math.atan2(dx, dz) - r.rotation.y), -0.8, 0.8); d.wag = 0.3;
        if (D.barkT <= 0) { D.barkT = 0.55 + Math.random() * 0.5; d.bark = 1; SFX.play('bark', clamp(1.2 - dist / 8, 0.2, 1)); if (Math.random() < 0.15) D.cool = 6; }
        if (info.speed > 4.5 && dist > 2.2) { tx = me.x; tz = me.z; speed = 4.8; } else r.rotation.y += wrapA(Math.atan2(dx, dz) - r.rotation.y) * Math.min(1, dt * 6);
      } else {
        d.look = 0; d.wag = 1;
        if ((D.waitT -= dt) <= 0 && Math.hypot(tx - r.position.x, tz - r.position.z) < 0.4) { D.waitT = 2 + Math.random() * 5; const a = Math.random() * TAU, rr = 2 + Math.random() * 6; D.tx = D.home.x + Math.sin(a) * rr; D.tz = D.home.z + Math.cos(a) * rr; }
        if (D.waitT <= 0) { tx = D.tx; tz = D.tz; speed = 1.4; }
      }
      if (speed > 0) {
        const ex = tx - r.position.x, ez = tz - r.position.z, el = Math.hypot(ex, ez);
        if (el > 0.3) { const st = Math.min(el, speed * dt), x0 = r.position.x, z0 = r.position.z; this.ctx.slide(r.position, ex / el * st, ez / el * st, 0.25); r.rotation.y += wrapA(Math.atan2(ex, ez) - r.rotation.y) * Math.min(1, dt * 7); d.speed = Math.hypot(r.position.x - x0, r.position.z - z0) / Math.max(dt, 1e-4); if (d.speed < 0.1) { D.tx = r.position.x; D.tz = r.position.z; } }
        else d.speed = 0;
      } else d.speed = lerp(d.speed, 0, 1 - Math.exp(-dt * 6));
      r.position.y = groundHeight(r.position.x, r.position.z);
      if (dist < 60) d.update(dt, t);
    }
  }
  hitDog(x, z, r) { const D = this.dogs.find(D => D.home && Math.hypot(D.d.root.position.x - x, D.d.root.position.z - z) < r); if (!D) return false; D.flee = 6; D.d.bark = 1; SFX.play('yelp', 1); return true; }
  // ---- the ice-cream van ---------------------------------------------------------------------------------
  makeVan(world) {
    const K = world.city.carKit; if (!K || !K.protos[5]) return null;
    const g = new THREE.Group(), white = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.35, metalness: 0.3 });
    g.add(new THREE.Mesh(K.protos[5].body, white), new THREE.Mesh(K.protos[5].rest, K.rest));
    // Pink and blue stripes, a big cone on the roof, a swirl sign.
    for (const [y, c] of [[0.78, 0xe86aa0], [0.66, 0x56b7e6]]) for (const s of [1, -1]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, 3.9), new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 })); st.position.set(s * 0.94, y, -0.1); g.add(st); }
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 14).rotateX(Math.PI), new THREE.MeshStandardMaterial({ color: 0xd9a35a, roughness: 0.7 })); cone.position.set(0, 2.55, 0.6); g.add(cone);
    const scoop = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), new THREE.MeshStandardMaterial({ color: 0xfbe6ef, roughness: 0.6 })); scoop.position.set(0, 2.95, 0.6); g.add(scoop);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; }); g.visible = false; this.scene.add(g);
    return { g, on: false, x: 0, z: 0, h: 0, from: -1, to: -1, t: 0, stopT: 0, chimeT: 0, cruise: 0 };
  }
  vanFrame(dt, t, me, info) {
    const V = this.van, T = this.ctx.traffic; if (!V || !T || !T.nodes.length) return;
    if (this.night()) { if (V.on) { V.on = false; V.g.visible = false; } return; }
    if (!V.on || Math.hypot(V.x - me.x, V.z - me.z) > 260) {
      // Turn up on a quiet street 90-180 m away now and then.
      V.g.visible = false; V.on = false; if ((V.cruise -= dt) > 0) return; V.cruise = 20;
      for (let k = 0; k < 40; k++) { const i = Math.floor(Math.random() * T.nodes.length), n = T.nodes[i], dd = Math.hypot(n.x - me.x, n.z - me.z); if (dd > 90 && dd < 180 && n.nb.length && n.nb[0].vmax <= 9.5) { V.from = i; V.to = n.nb[0].to; V.t = 0; V.x = n.x; V.z = n.z; V.on = true; V.g.visible = true; V.stopT = 0; break; } }
      return;
    }
    const a = T.nodes[V.from], b = T.nodes[V.to], ex = b.x - a.x, ez = b.z - a.z, L = Math.hypot(ex, ez) || 0.01, ux = ex / L, uz = ez / L;
    const dMe = Math.hypot(V.x - me.x, V.z - me.z);
    // Pull over when you're near on foot (and now and then anyway), chime going.
    if (V.stopT <= 0 && ((dMe < 22 && !info.inCar && !V.served) || Math.random() < dt * 0.01)) V.stopT = dMe < 22 ? 25 : 10;
    if (dMe > 40) V.served = false;
    let v = 5.5; if (V.stopT > 0) { V.stopT -= dt; v = 0; }
    if (v > 0) { V.t += v * dt; if (V.t >= L) { V.t -= L; const opts = b.nb.filter(e => e.to !== V.from && e.vmax <= 9.5); const e = (opts.length ? opts : b.nb)[Math.floor(Math.random() * (opts.length || b.nb.length))]; V.from = V.to; V.to = e.to; } }
    const a2 = T.nodes[V.from], b2 = T.nodes[V.to], fx = b2.x - a2.x, fz = b2.z - a2.z, l2 = Math.hypot(fx, fz) || 0.01, vx = fx / l2, vz = fz / l2, lane = 2.6;
    const tx = a2.x + vx * Math.min(V.t, l2) + vz * lane, tz = a2.z + vz * Math.min(V.t, l2) - vx * lane, k = 1 - Math.exp(-dt * 3);
    V.x = lerp(V.x, tx, k); V.z = lerp(V.z, tz, k); V.h += wrapA(Math.atan2(vx, vz) - V.h) * k;
    V.g.position.set(V.x, groundHeight(V.x, V.z) * 0.2, V.z); V.g.rotation.y = V.h;
    if ((V.chimeT -= dt) <= 0 && dMe < 110) { V.chimeT = 9.5; SFX.chime(clamp(1 - dMe / 110, 0, 1) * (V.stopT > 0 ? 1 : 0.7)); }
  }
  obstacles() { const V = this.van; if (!V || !V.on) return []; const fx = Math.sin(V.h), fz = Math.cos(V.h); return [{ x: V.x + fx * 1.2, z: V.z + fz * 1.2, r: 1.0, car: V }, { x: V.x - fx * 1.2, z: V.z - fz * 1.2, r: 1.0, car: V }]; }
  vanNear(p) { const V = this.van; return V && V.on && V.stopT > 0 && Math.hypot(V.x - p.x, V.z - p.z) < 4.5 ? V : null; }
  // ---- sound ------------------------------------------------------------------------------------------
  soundFrame(dt, t, me) {
    const S = this.sound;
    if ((S.barkT -= dt) <= 0) { S.barkT = 8 + Math.random() * 16; SFX.play('bark', 0.18 + Math.random() * 0.15); }
    if ((S.sirenT -= dt) <= 0) { S.sirenT = 120 + Math.random() * 120; SFX.play('sirenFar'); }
    let mw = 0; for (const s of this.spots) if (s.mower) mw = Math.max(mw, clamp(1 - Math.hypot(s.x - me.x, s.z - me.z) / 45, 0, 1));
    SFX.mower(mw);
    // Car stereos: some traffic thumps as it goes by.
    const T = this.ctx.traffic; let bass = 0;
    if (T) for (const c of T.cars) { if (c.slot % 3) continue; bass = Math.max(bass, clamp(1 - Math.hypot(c.x - me.x, c.z - me.z) / 28, 0, 1)); }
    if (bass > 0.02 && (S.beatT -= dt) <= 0) { S.beatT = 60 / 92; SFX.play('thump', bass); }
  }
  // ---- speech bubbles ---------------------------------------------------------------------------------
  say(a, key, chance = 1) {
    if (Math.random() > chance || this.globalTalk > 0.3 && key !== 'ambBump') return;
    const pool = SCRIPT[key]; if (!pool) return; const line = pool[Math.floor(Math.random() * pool.length)];
    this.globalTalk = 3.5; this.bubble(a.p, line.text);
  }
  bubble(obj, text, life = 3) {
    let B = this.bubbles.find(b => b.obj === obj);
    if (!B) { const el = document.createElement('div'); el.style.cssText = 'position:absolute;transform:translate(-50%,-100%);background:rgba(12,14,16,.72);color:#fff;font:600 13px/1.25 system-ui,sans-serif;padding:5px 9px;border-radius:10px;max-width:220px;text-align:center;white-space:normal;transition:opacity .25s'; this.bubbleEl.appendChild(el); B = { el, obj }; this.bubbles.push(B); }
    B.el.textContent = text; B.until = performance.now() + life * 1000; B.el.style.opacity = '1';
  }
  bubbleFrame(camera) {
    const now = performance.now(), v = _V[12];
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const B = this.bubbles[i];
      if (now > B.until || !B.obj.visible) { B.el.remove(); this.bubbles.splice(i, 1); continue; }
      v.copy(B.obj.position); v.y += 2.05 * (B.obj.scale.y || 1);
      const d = v.distanceTo(camera.position); v.project(camera);
      if (v.z > 1 || d > 28 || Math.abs(v.x) > 1.1) { B.el.style.display = 'none'; continue; }
      B.el.style.display = 'block'; B.el.style.left = ((v.x + 1) / 2 * innerWidth).toFixed(0) + 'px'; B.el.style.top = ((1 - v.y) / 2 * innerHeight).toFixed(0) + 'px';
      B.el.style.opacity = now > B.until - 400 ? '0' : '1';
    }
  }
  // ---- for the game: who's around, who wants a word, who you just hit --------------------------------------
  near(x, z, r) { return this.agents.filter(a => a.spot && a.p.visible && !a.down && Math.hypot(a.p.position.x - x, a.p.position.z - z) < r); }
  momentNear(p, r = 2.6) { return this.agents.find(a => a.spot && a.moment && a.p.visible && Math.hypot(a.p.position.x - p.x, a.p.position.z - p.z) < r) || null; }
  knock(a) { a.h.knockDown(); a.h.sit = null; a.h.act = null; a.down = true; setTimeout(() => { a.down = false; a.flee = 5; a.h.getUp(); }, 5000); }
  cheer() { for (const a of this.agents) if (a.watch && Math.random() < 0.5) this.say(a, 'ambFightCheer', 0.6); }
}
