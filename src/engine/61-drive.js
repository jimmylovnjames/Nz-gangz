// Driving and traffic. Any parked car can be taken (TALK next to it): arcade handling, chase camera,
// engine note and horn. Traffic drives the real road graph on the left, stops for you and each other.
const CAR_DIM = [{ L: 4.05, wb: 2.54 }, { L: 4.65, wb: 2.7 }, { L: 4.75, wb: 2.74 }, { L: 5.3, wb: 3.08 }, { L: 4.8, wb: 2.85 }, { L: 4.7, wb: 2.55 }];
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v3 = new THREE.Vector3(), _s1 = new THREE.Vector3(1, 1, 1), _y = new THREE.Vector3(0, 1, 0);
const ZERO_M = new THREE.Matrix4().makeScale(0, 0, 0);

class CarAudio {
  ensure() {
    if (this.ac) return;
    try {
      const ac = this.ac = new (window.AudioContext || window.webkitAudioContext)();
      this.gain = ac.createGain(); this.gain.gain.value = 0;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
      this.o1 = ac.createOscillator(); this.o1.type = 'sawtooth'; this.o2 = ac.createOscillator(); this.o2.type = 'square';
      this.o1.connect(lp); this.o2.connect(lp); lp.connect(this.gain); this.gain.connect(ac.destination);
      this.o1.start(); this.o2.start();
    } catch (_) { this.ac = null; }
  }
  set(on, speed, throttle) {
    if (!this.ac) return;
    const t = this.ac.currentTime, f = 34 + Math.abs(speed) * 4.2 + Math.max(0, throttle) * 14;
    this.o1.frequency.setTargetAtTime(f, t, 0.08); this.o2.frequency.setTargetAtTime(f * 0.5, t, 0.08);
    this.gain.gain.setTargetAtTime(on ? 0.028 + Math.max(0, throttle) * 0.02 : 0, t, 0.12);
  }
  horn() {
    if (!this.ac) return;
    const t = this.ac.currentTime, g = this.ac.createGain(); g.gain.value = 0.06; g.connect(this.ac.destination);
    for (const f of [415, 520]) { const o = this.ac.createOscillator(); o.type = 'square'; o.frequency.value = f; o.connect(g); o.start(t); o.stop(t + 0.35); }
    g.gain.setTargetAtTime(0, t + 0.3, 0.03);
  }
}

class PlayerCars {
  constructor(world) {
    this.world = world; this.kit = world.city.carKit; this.car = null; this.own = []; this.audio = new CarAudio();
    this.grid = new Map();
    for (const c of world.city.cars) { const k = Math.floor(c.x / 20) + ',' + Math.floor(c.z / 20); if (!this.grid.has(k)) this.grid.set(k, []); this.grid.get(k).push(c); }
  }
  nearest(p, r = 3.4) {
    let best = null, bd = r;
    const cx = Math.floor(p.x / 20), cz = Math.floor(p.z / 20);
    for (let i = cx - 1; i <= cx + 1; i++) for (let j = cz - 1; j <= cz + 1; j++) for (const c of this.grid.get(i + ',' + j) || []) {
      if (c.taken) continue; const d = Math.hypot(c.x - p.x, c.z - p.z); if (d < bd) { bd = d; best = c; }
    }
    for (const c of this.own) { if (c === this.car) continue; const d = Math.hypot(c.x - p.x, c.z - p.z); if (d < bd) { bd = d; best = c; } }
    return best;
  }
  // Turn a parked instance into a drivable car (or get back into one of ours).
  enter(c) {
    let car = this.own.find(o => o === c);
    if (!car) {
      c.taken = true;
      for (const [mesh, i] of c._inst || []) { mesh.setMatrixAt(i, ZERO_M); mesh.instanceMatrix.needsUpdate = true; }
      const K = this.kit, P = K.protos[c.type], paint = K.paint.clone(); paint.color.set(K.paints[Math.floor(c.color * K.paints.length)]);
      const g = new THREE.Group(), body = new THREE.Mesh(P.body, paint), rest = new THREE.Mesh(P.rest, K.rest);
      body.castShadow = rest.castShadow = true; body.receiveShadow = true; g.add(body, rest);
      this.world.scene.add(g);
      car = { group: g, x: c.x, z: c.z, y: c.y || 0, h: c.rot, v: 0, steer: 0, type: c.type, col: c.col, pitch: 0, health: 100 };
      this.own.push(car);
    }
    if (car.col) car.col.off = true;
    this.car = car; this.audio.ensure(); this.place(car);
    return car;
  }
  exit() {
    const car = this.car; if (!car) return null;
    this.car = null; car.v = 0; car.vx = car.vz = 0; car.w = 0; this.drifting = false; this.audio.set(false, 0, 0);
    // Re-solidify where it stopped.
    const D = CAR_DIM[car.type];
    car.col = this.world.collision.addOBB(car.x, car.z, 0.95, D.L / 2, -car.h, 'car');
    // NZ cars are right-hand drive: get out on the right, else the left, else behind.
    const fx = Math.sin(car.h), fz = Math.cos(car.h), rx = -fz, rz = fx;
    for (const [ox, oz] of [[rx * 1.7, rz * 1.7], [-rx * 1.7, -rz * 1.7], [-fx * (D.L / 2 + 1), -fz * (D.L / 2 + 1)], [fx * (D.L / 2 + 1), fz * (D.L / 2 + 1)]]) {
      const x = car.x + ox, z = car.z + oz; if (!this.world.collision.collides(x, z, 0.5)) return { x, z };
    }
    return { x: car.x + rx * 1.7, z: car.z + rz * 1.7 };
  }
  place(car) {
    _q.setFromEuler(new THREE.Euler(car.pitch + (car.dive || 0), car.h, car.roll || 0, 'YXZ'));
    car.group.position.set(car.x, car.y, car.z); car.group.quaternion.copy(_q);
  }
  blocked(car, x, z, h, others) {
    const D = CAR_DIM[car.type], fx = Math.sin(h), fz = Math.cos(h), half = D.L / 2 - 0.85;
    for (const s of [-half, -half / 3, half / 3, half]) {
      const px = x + fx * s, pz = z + fz * s;
      if (this.world.collision.collides(px, pz, 0.9)) return true;
      for (const o of others) if ((o.x - px) ** 2 + (o.z - pz) ** 2 < (0.9 + o.r) ** 2) { this.hit = o; return true; }
    }
    return x < MAP_BOUNDS.x0 || x > MAP_BOUNDS.x1 || z < MAP_BOUNDS.z0 || z > MAP_BOUNDS.z1;
  }
  // Handling with weight: the car carries momentum, tyres only grip so hard, the handbrake breaks the
  // rear loose (drift), the body rolls in corners and dives under braking. Impacts cost health; below
  // 40% it smokes, at 0 the engine dies.
  update(dt, throttle, steer, brake, others) {
    const car = this.car; if (!car) return;
    const D = CAR_DIM[car.type], vmax = 26;
    if (car.vx == null) { car.vx = Math.sin(car.h) * car.v; car.vz = Math.cos(car.h) * car.v; car.w = 0; car.health = car.health ?? 100; car.roll = 0; car.dive = 0; }
    if (car.health <= 0) throttle = Math.min(0, throttle) * 0; // engine's dead
    const fx = Math.sin(car.h), fz = Math.cos(car.h), rx = -fz, rz = fx;
    let vf = car.vx * fx + car.vz * fz, vr = car.vx * rx + car.vz * rz;
    car.steer = lerp(car.steer, steer, 1 - Math.exp(-dt * 7));
    let a = 0;
    if (throttle > 0.05) a = vf < -0.5 ? 15 * throttle : 7.2 * throttle * (1 - Math.max(0, vf) / vmax);
    else if (throttle < -0.05) a = vf > 0.5 ? 15 * throttle : 4.5 * throttle * (1 + Math.min(0, vf) / 8);
    vf += a * dt;
    const roll = 0.6 + 0.0035 * vf * vf;
    if (Math.abs(throttle) < 0.05) vf -= Math.sign(vf) * Math.min(Math.abs(vf), roll * dt);
    if (brake) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 7 * dt);
    // Tyre grip: lateral speed bleeds off fast normally, slowly with the handbrake on (slide).
    const grip = brake ? 1.4 : 7.5 + Math.max(0, 4 - Math.abs(vf) * 0.15);
    vr *= Math.exp(-grip * dt);
    // Yaw with inertia; the handbrake swings the tail round.
    const maxSteer = 0.62 / (1 + Math.abs(vf) / 13);
    const wTarget = -vf * Math.tan(car.steer * maxSteer) / D.wb * (brake && Math.abs(vf) > 5 ? 1.7 : 1);
    car.w = lerp(car.w, wTarget, 1 - Math.exp(-dt * (brake ? 3 : 6.5)));
    const nh = car.h + car.w * dt, nfx = Math.sin(nh), nfz = Math.cos(nh), nrx = -nfz, nrz = nfx;
    car.vx = nfx * vf + nrx * vr; car.vz = nfz * vf + nrz * vr; car.v = vf;
    // Integrate with substeps; on impact bounce, lose speed, take damage.
    const speed = Math.hypot(car.vx, car.vz), steps = Math.max(1, Math.ceil(speed * dt / 0.4));
    let h = car.h;
    for (let k = 0; k < steps; k++) {
      const sdt = dt / steps; h += car.w * sdt;
      const nx = car.x + car.vx * sdt, nz = car.z + car.vz * sdt;
      if (this.blocked(car, nx, nz, h, others)) {
        const imp = Math.hypot(car.vx, car.vz);
        if (imp > 6) this.world.shake = Math.min(0.55, imp * 0.03);
        this.lastImpact = imp; if (imp > 4) { car.health = Math.max(0, car.health - (imp - 4) * 4.5); SFX.play(imp > 10 ? 'heavy' : 'hit', 0.8); }
        car.vx *= -0.22; car.vz *= -0.22; car.w *= 0.3; car.v = -car.v * 0.22; break;
      }
      car.x = nx; car.z = nz;
    }
    car.h = h;
    // Ride: kerb bumps pitch the car; cornering rolls it; braking and accelerating dive/squat it.
    const half = D.wb / 2, yf = groundHeight(car.x + Math.sin(car.h) * half, car.z + Math.cos(car.h) * half), yb = groundHeight(car.x - Math.sin(car.h) * half, car.z - Math.cos(car.h) * half);
    car.y = lerp(car.y, (yf + yb) / 2, 1 - Math.exp(-dt * 12)); car.pitch = lerp(car.pitch, Math.atan2(yb - yf, D.wb), 1 - Math.exp(-dt * 10));
    car.roll = lerp(car.roll, clamp(car.w * vf * 0.012 + vr * 0.02, -0.09, 0.09), 1 - Math.exp(-dt * 5));
    car.dive = lerp(car.dive, clamp(-a * 0.004, -0.05, 0.05), 1 - Math.exp(-dt * 5));
    this.drifting = Math.abs(vr) > 3.5 && Math.abs(vf) > 6;
    this.place(car);
    this.audio.set(car.health > 0, vf, car.health > 0 ? throttle : 0);
    this.smokeFx(dt, car);
  }
  // Damage smoke from the bonnet (and tyre smoke when drifting).
  smokeFx(dt, car) {
    if (!this.smoke) {
      const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
      gr.addColorStop(0, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      const tex = new THREE.CanvasTexture(c);
      this.smoke = Array.from({ length: 28 }, () => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0x777777, transparent: true, opacity: 0, depthWrite: false })); sp.visible = false; this.world.scene.add(sp); return { sp, life: 0 }; });
      this.smokeT = 0;
    }
    const D = CAR_DIM[car.type], fx = Math.sin(car.h), fz = Math.cos(car.h);
    const engine = car.health < 40, tyres = this.drifting;
    if ((engine || tyres) && (this.smokeT -= dt) <= 0) {
      this.smokeT = engine ? (car.health <= 0 ? 0.05 : 0.12) : 0.06;
      const p = this.smoke.find(q => q.life <= 0); if (p) {
        const front = engine && (!tyres || Math.random() < 0.5);
        const off = front ? D.L / 2 - 0.5 : -D.L / 2 + 0.6, y = front ? 1.0 : 0.25;
        p.sp.position.set(car.x + fx * off + (Math.random() - 0.5) * 0.6, car.y + y, car.z + fz * off + (Math.random() - 0.5) * 0.6);
        p.life = 1; p.vy = front ? 1.2 : 0.4; p.sp.visible = true; p.sp.material.color.set(front && car.health <= 0 ? 0x2a2a2a : front ? 0x6a6a6a : 0xcfcfcf); p.sp.scale.setScalar(0.6);
      }
    }
    for (const p of this.smoke) {
      if (p.life <= 0) { p.sp.visible = false; continue; }
      p.life -= dt * 0.7; p.sp.position.y += p.vy * dt; p.sp.scale.setScalar(0.6 + (1 - p.life) * 2.4); p.sp.material.opacity = Math.max(0, p.life) * 0.5;
    }
  }
}

// Traffic on the real street network (graph from every mapped road vertex), driving on the left.
class Traffic {
  constructor(world, count) {
    this.world = world; this.kit = world.city.carKit; this.cars = []; this.max = count;
    const nodes = [], key = new Map();
    const id = p => { const k = Math.round(p[0] * 2) + ',' + Math.round(p[1] * 2); let i = key.get(k); if (i == null) { i = nodes.length; key.set(k, i); nodes.push({ x: p[0], z: p[1], nb: [] }); } return i; };
    for (const r of world.city.map.roadInfo) {
      const vmax = { p: 14, s: 13, t: 12, r: 9.5, l: 6, u: 9 }[r.cls[0]] || 9, lane = clamp(r.w / 4, 1.5, 2.6);
      for (let i = 0; i + 1 < r.pts.length; i++) { const a = id(r.pts[i]), b = id(r.pts[i + 1]); if (a === b) continue; nodes[a].nb.push({ to: b, vmax, lane }); nodes[b].nb.push({ to: a, vmax, lane }); }
    }
    this.nodes = nodes;
    if (!count) return;
    // One instanced mesh per car type (paint + everything else); unused slots are collapsed.
    this.meshes = this.kit.protos.map(P => {
      const body = new THREE.InstancedMesh(P.body, this.kit.paint, count), rest = new THREE.InstancedMesh(P.rest, this.kit.rest, count);
      for (const m of [body, rest]) { m.frustumCulled = false; m.castShadow = true; for (let i = 0; i < count; i++) m.setMatrixAt(i, ZERO_M); world.scene.add(m); }
      for (let i = 0; i < count; i++) body.setColorAt(i, new THREE.Color(0xffffff));
      return { body, rest, free: Array.from({ length: count }, (_, i) => i) };
    });
  }
  spawn(px, pz) {
    for (let tries = 0; tries < 40; tries++) {
      const n = this.nodes[Math.floor(Math.random() * this.nodes.length)], d = Math.hypot(n.x - px, n.z - pz);
      if (d < 110 || d > 280 || !n.nb.length) continue;
      const e = n.nb[Math.floor(Math.random() * n.nb.length)], type = Math.floor(Math.random() * 6), M = this.meshes[type]; if (!M.free.length) return;
      const slot = M.free.pop(), K = this.kit;
      M.body.setColorAt(slot, new THREE.Color(K.paints[Math.floor(Math.random() * K.paints.length)])); M.body.instanceColor.needsUpdate = true;
      const from = this.nodes.indexOf(n);
      this.cars.push({ from, to: e.to, e, t: 0, v: e.vmax * 0.6, type, slot, x: n.x, z: n.z, h: 0, r: 2.0, init: true });
      return;
    }
  }
  next(c) {
    const a = this.nodes[c.from], b = this.nodes[c.to], dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1;
    const opts = b.nb.filter(e => e.to !== c.from);
    if (!opts.length) { c.e = b.nb.find(e => e.to === c.from) || c.e; }
    else {
      let best = null, bw = -1;
      for (const e of opts) { const n = this.nodes[e.to], ex = n.x - b.x, ez = n.z - b.z, el = Math.hypot(ex, ez) || 1, w = (ex * dx + ez * dz) / (el * L) + 1.3 + Math.random() * 1.2; if (w > bw) { bw = w; best = e; } }
      c.e = best;
    }
    c.from = c.to; c.to = c.e.to; c.t = 0;
  }
  update(dt, player, playerCar) {
    if (!this.max) return;
    const px = player.x, pz = player.z;
    while (this.cars.length < this.max) { const n = this.cars.length; this.spawn(px, pz); if (this.cars.length === n) break; }
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const c = this.cars[i];
      if (Math.hypot(c.x - px, c.z - pz) > 340) { const M = this.meshes[c.type]; M.body.setMatrixAt(c.slot, ZERO_M); M.rest.setMatrixAt(c.slot, ZERO_M); M.free.push(c.slot); this.cars.splice(i, 1); continue; }
      const a = this.nodes[c.from], b = this.nodes[c.to], dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 0.01, ux = dx / L, uz = dz / L;
      // Brake for anything ahead in the lane: other cars, you on foot, your car.
      let target = c.e.vmax;
      const remain = L - c.t; if (b.nb.length > 2) target = Math.min(target, 4 + remain * 0.7);
      const ahead = (ox, oz, gap) => { const rx = ox - c.x, rz = oz - c.z, along = rx * ux + rz * uz, lat = Math.abs(-rx * uz + rz * ux); return along > 0 && along < gap && lat < 2.2; };
      for (const o of this.cars) if (o !== c && ahead(o.x, o.z, 9)) target = 0;
      if (ahead(px, pz, 10) || (playerCar && ahead(playerCar.x, playerCar.z, 10))) { target = 0; if (!c.honked) { c.honked = true; c.honkT = 0; } }
      else c.honked = false;
      c.v = target < c.v ? Math.max(target, c.v - 9 * dt) : Math.min(target, c.v + 2.5 * dt);
      c.t += c.v * dt;
      while (c.t >= L) { c.t -= L; this.next(c); break; }
      const A = this.nodes[c.from], B = this.nodes[c.to], ex = B.x - A.x, ez = B.z - A.z, el = Math.hypot(ex, ez) || 0.01, vx = ex / el, vz = ez / el;
      const lane = c.e.lane, tx = A.x + vx * Math.min(c.t, el) + vz * lane, tz = A.z + vz * Math.min(c.t, el) - vx * lane; // left of travel: (vz, -vx)
      if (c.init) { c.x = tx; c.z = tz; c.h = Math.atan2(vx, vz); c.init = false; }
      const k = 1 - Math.exp(-dt * 6); c.x = lerp(c.x, tx, k); c.z = lerp(c.z, tz, k);
      const want = Math.atan2(vx, vz); let dh = want - c.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); c.h += dh * k;
      const M = this.meshes[c.type];
      _q.setFromAxisAngle(_y, c.h); _m4.compose(_v3.set(c.x, groundHeight(c.x, c.z) * 0.2, c.z), _q, _s1);
      M.body.setMatrixAt(c.slot, _m4); M.rest.setMatrixAt(c.slot, _m4);
    }
    for (const M of this.meshes) { M.body.instanceMatrix.needsUpdate = true; M.rest.instanceMatrix.needsUpdate = true; }
  }
  // Circles for collision with the player's car and with the player on foot.
  obstacles() { const out = []; for (const c of this.cars) { const fx = Math.sin(c.h), fz = Math.cos(c.h); out.push({ x: c.x + fx * 1.2, z: c.z + fz * 1.2, r: 1.0, car: c }, { x: c.x - fx * 1.2, z: c.z - fz * 1.2, r: 1.0, car: c }); } return out; }
}
