// Street life: heat and police (Battenburg patrol cars that chase on the real road graph), and people
// walking the footpaths who react when things kick off.
class Heat {
  constructor() { this.level = 0; this.calm = 0; }
  add(n) { this.level = Math.min(5, this.level + n); this.calm = 0; }
  get stars() { return Math.ceil(this.level - 0.001); }
  update(dt, seen) {
    if (this.level <= 0) return;
    this.calm = seen ? 0 : this.calm + dt;
    if (this.calm > 14) this.level = Math.max(0, this.level - dt / 9); // about one star per 9 s once you've lost them
  }
}

class Siren {
  ensure() { if (this.ac) return; try { const ac = this.ac = new (window.AudioContext || window.webkitAudioContext)(); this.g = ac.createGain(); this.g.gain.value = 0; this.o = ac.createOscillator(); this.o.type = 'triangle'; this.o.connect(this.g); this.g.connect(ac.destination); this.o.start(); } catch (_) { this.ac = null; } }
  set(level, t) { if (!this.ac) return; const f = 700 + 450 * (0.5 + 0.5 * Math.sin(t * 2.2)); this.o.frequency.setTargetAtTime(f, this.ac.currentTime, 0.05); this.g.gain.setTargetAtTime(level * 0.03, this.ac.currentTime, 0.2); }
}

class Police {
  constructor(world, traffic) {
    this.world = world; this.nodes = traffic.nodes; this.cars = []; this.siren = new Siren();
    const K = world.city.carKit, P = K.police;
    this.white = new THREE.MeshStandardMaterial({ color: 0xf4f4f2, metalness: 0.4, roughness: 0.35 });
    this.red = new THREE.MeshBasicMaterial({ color: 0xff2020, toneMapped: false }); this.blue = new THREE.MeshBasicMaterial({ color: 0x2050ff, toneMapped: false });
    this.make = () => {
      const g = new THREE.Group(), body = new THREE.Mesh(P.body, this.white), rest = new THREE.Mesh(P.rest, K.rest);
      const lr = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.11, 0.38), this.red), lb = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.11, 0.38), this.blue);
      lr.position.set(0.3, 1.51, 0.12); lb.position.set(-0.3, 1.51, 0.12);
      body.castShadow = rest.castShadow = true; g.add(body, rest, lr, lb); g.userData = { lr, lb };
      return g;
    };
    const st = world.city.map.buildings.find(b => /Police/i.test(b.name));
    this.station = st ? { x: st.c[0] - 16, z: st.c[1] + 6 } : { x: 1505, z: -660 };
  }
  nearestNode(x, z, min, max) {
    for (let k = 0; k < 60; k++) { const i = Math.floor(Math.random() * this.nodes.length), n = this.nodes[i], d = Math.hypot(n.x - x, n.z - z); if (d > min && d < max && n.nb.length) return i; }
    return -1;
  }
  update(dt, t, heat, target, inCar) {
    const want = heat.level > 0 ? Math.min(3, heat.stars) : 0;
    while (this.cars.length < want) {
      const i = this.nearestNode(target.x, target.z, 130, 260); if (i < 0) break;
      const g = this.make(); this.world.scene.add(g); this.siren.ensure();
      this.cars.push({ g, from: i, to: this.nodes[i].nb[0].to, t: 0, x: this.nodes[i].x, z: this.nodes[i].z, h: 0, v: 8, direct: false, near: 0, leaveT: 0 });
    }
    let closest = 1e9;
    for (let k = this.cars.length - 1; k >= 0; k--) {
      const c = this.cars[k], d = Math.hypot(target.x - c.x, target.z - c.z);
      if (want === 0) { c.leaveT += dt; if (c.leaveT > 12 || d > 220) { this.world.scene.remove(c.g); this.cars.splice(k, 1); continue; } }
      closest = Math.min(closest, d);
      // Chase: off the graph and straight at you when close, else greedy along the streets.
      c.direct = want > 0 && d < 40;
      if (c.direct) {
        const ux = (target.x - c.x) / (d || 1), uz = (target.z - c.z) / (d || 1), sp = d < 7 ? Math.max(0, c.v - 14 * dt) : Math.min(15, c.v + 6 * dt);
        const nx = c.x + ux * sp * dt, nz = c.z + uz * sp * dt;
        if (!this.world.collision.collides(nx, nz, 1.0)) { c.x = nx; c.z = nz; } else c.direct = false;
        c.v = sp; const want2 = Math.atan2(ux, uz); let dh = want2 - c.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); c.h += dh * Math.min(1, dt * 4);
      }
      if (!c.direct) {
        const A = this.nodes[c.from], B = this.nodes[c.to], ex = B.x - A.x, ez = B.z - A.z, L = Math.hypot(ex, ez) || 0.01;
        const vmax = want > 0 ? 17 : 9; c.v = Math.min(vmax, c.v + 5 * dt); c.t += c.v * dt;
        if (c.t >= L) {
          c.t = 0; const prev = c.from; c.from = c.to;
          const opts = B.nb.filter(e => e.to !== prev); const pool = opts.length ? opts : B.nb;
          let best = pool[0], bd = 1e9;
          for (const e of pool) { const n = this.nodes[e.to], dd = Math.hypot(n.x - target.x, n.z - target.z) + (want ? 0 : Math.random() * 400); if (dd < bd) { bd = dd; best = e; } }
          c.to = best.to;
        }
        const A2 = this.nodes[c.from], B2 = this.nodes[c.to], fx = B2.x - A2.x, fz = B2.z - A2.z, l2 = Math.hypot(fx, fz) || 0.01;
        const tx = A2.x + fx / l2 * Math.min(c.t, l2) + fz / l2 * 2, tz = A2.z + fz / l2 * Math.min(c.t, l2) - fx / l2 * 2, k2 = 1 - Math.exp(-dt * 6);
        c.x = lerp(c.x, tx, k2); c.z = lerp(c.z, tz, k2); const wh = Math.atan2(fx, fz); let dh = wh - c.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); c.h += dh * k2;
      }
      c.g.position.set(c.x, groundHeight(c.x, c.z) * 0.3, c.z); c.g.rotation.y = c.h;
      const flash = Math.sin(t * 14 + k) > 0; c.g.userData.lr.visible = want > 0 ? flash : false; c.g.userData.lb.visible = want > 0 ? !flash : false;
      // Caught: a patrol car alongside you for a moment.
      c.near = d < (inCar ? 5 : 6.5) && want > 0 ? c.near + dt : 0;
    }
    this.siren.set(want > 0 && closest < 250 ? Math.max(0.15, 1 - closest / 250) : 0, t);
    return { closest, caught: this.cars.some(c => c.near > (inCar ? 2 : 1.6)) };
  }
  obstacles() { const out = []; for (const c of this.cars) { const fx = Math.sin(c.h), fz = Math.cos(c.h); out.push({ x: c.x + fx * 1.2, z: c.z + fz * 1.2, r: 1.0, police: c }, { x: c.x - fx * 1.2, z: c.z - fz * 1.2, r: 1.0, police: c }); } return out; }
  clear() { for (const c of this.cars) this.world.scene.remove(c.g); this.cars = []; this.siren.set(0, 0); }
}

// People on the footpaths: they walk the street graph on the footpath side, scatter when a fight
// starts or the cops turn up, and go down if you hit them (which brings heat).
class Pedestrians {
  constructor(world, nodes, people) {
    this.nodes = nodes; this.people = people; this.agents = people.map(p => ({ p, h: p.userData.human, active: false })); this.max = people.length; this.homes = null;
    // 60 m grid of street nodes so spawns pick from what's actually near the player.
    this.grid = new Map();
    nodes.forEach((n, i) => { const k = Math.floor(n.x / 60) + ',' + Math.floor(n.z / 60); if (!this.grid.has(k)) this.grid.set(k, []); this.grid.get(k).push(i); });
  }
  // Houses people come out of and go home to (comings and goings), on the same 60 m grid.
  setHomes(houses, collides) {
    this.homes = new Map(); this.collides = collides;
    for (const hs of houses) { const k = Math.floor(hs.pos.x / 60) + ',' + Math.floor(hs.pos.z / 60); if (!this.homes.has(k)) this.homes.set(k, []); this.homes.get(k).push(hs); }
  }
  // Front door, front yard, footpath: only if the walk is clear (no fence in the way).
  housePath(hs) {
    if (hs.blocked) return null;
    const nx = Math.sin(hs.rot), nz = Math.cos(hs.rot), door = { x: hs.pos.x - nx * 2.1, z: hs.pos.z - nz * 2.1 }, yard = { x: hs.pos.x, z: hs.pos.z }, path = { x: hs.spawn.pos.x, z: hs.spawn.pos.z };
    if (this.collides) for (const [a, b] of [[door, yard], [yard, path]]) { const L = Math.hypot(b.x - a.x, b.z - a.z); for (let d = 0; d <= L; d += 0.5) if (this.collides(a.x + (b.x - a.x) * d / L, a.z + (b.z - a.z) * d / L, 0.3)) { hs.blocked = true; return null; } }
    return [door, yard, path];
  }
  housesNear(x, z, r) { const out = [], cx = Math.floor(x / 60), cz = Math.floor(z / 60); if (!this.homes) return out; for (let i = cx - 1; i <= cx + 1; i++) for (let j = cz - 1; j <= cz + 1; j++) for (const hs of this.homes.get(i + ',' + j) || []) if (Math.hypot(hs.pos.x - x, hs.pos.z - z) < r) out.push(hs); return out; }
  nearestNode(x, z) { let best = -1, bd = 60; const cx = Math.floor(x / 60), cz = Math.floor(z / 60); for (let i = cx - 1; i <= cx + 1; i++) for (let j = cz - 1; j <= cz + 1; j++) for (const k of this.grid.get(i + ',' + j) || []) { const n = this.nodes[k], d = Math.hypot(n.x - x, n.z - z); if (d < bd && n.nb.length) { bd = d; best = k; } } return best; }
  join(a, x, z) { const i = this.nearestNode(x, z); if (i < 0) return false; const n = this.nodes[i], e = n.nb[Math.floor(Math.random() * n.nb.length)]; Object.assign(a, { from: i, to: e.to, e, t: 0 }); return true; }
  // Someone stepping off a bus (or out of anywhere) at (x, z), then on their way.
  spawnAt(x, z) {
    const a = this.agents.find(q => !q.active); if (!a || !this.join(a, x, z)) return null;
    Object.assign(a, { active: true, side: Math.random() < 0.5 ? 1 : -1, speed: 1.15 + Math.random() * 0.4, flee: 0, down: 0, house: null, watching: null });
    a.p.position.set(x, groundHeight(x, z), z); a.p.visible = true; a.h.reset(); a.h.mode = 'idle'; return a;
  }
  spawn(a, px, pz) {
    // Now and then they come out of a house instead of just appearing on the street.
    if (this.homes && Math.random() < 0.3) {
      const hs = this.housesNear(px, pz, 110).filter(h => { const d = Math.hypot(h.pos.x - px, h.pos.z - pz); return d > 35; });
      const h = hs[Math.floor(Math.random() * hs.length)], path = h && this.housePath(h);
      if (path) { Object.assign(a, { active: true, side: Math.random() < 0.5 ? 1 : -1, speed: 1.1 + Math.random() * 0.3, flee: 0, down: 0, watching: null, house: { pts: [path[1], path[2]], i: 0, T: 0, out: true } }); a.p.position.set(path[0].x, groundHeight(path[0].x, path[0].z), path[0].z); a.p.visible = true; a.h.reset(); a.h.mode = 'idle'; return true; }
    }
    const cand = [], cx = Math.floor(px / 60), cz = Math.floor(pz / 60);
    for (let x = cx - 2; x <= cx + 2; x++) for (let z = cz - 2; z <= cz + 2; z++) for (const i of this.grid.get(x + ',' + z) || []) { const n = this.nodes[i], d = Math.hypot(n.x - px, n.z - pz); if (d > 45 && d < 120 && n.nb.length) cand.push(i); }
    if (!cand.length) return false;
    {
      const i = cand[Math.floor(Math.random() * cand.length)], n = this.nodes[i];
      const e = n.nb[Math.floor(Math.random() * n.nb.length)];
      Object.assign(a, { active: true, from: i, to: e.to, e, t: Math.random() * 5, side: Math.random() < 0.5 ? 1 : -1, speed: 1.15 + Math.random() * 0.4, flee: 0, down: 0, house: null });
      // Start on the footpath beside the node (otherwise they'd slide in from the map origin).
      const B = this.nodes[e.to], L = Math.hypot(B.x - n.x, B.z - n.z) || 1, vx = (B.x - n.x) / L, vz = (B.z - n.z) / L, off = (e.lane * 2 + 3.4) * a.side;
      a.p.position.set(n.x + vz * off, 0, n.z - vx * off); a.p.position.y = groundHeight(a.p.position.x, a.p.position.z);
      a.p.visible = true; a.h.reset(); a.h.mode = 'idle'; return true;
    }
  }
  update(dt, px, pz, collide, fightAt) {
    // One new walker every 0.4 s while there are free slots (steady, not frame-rate dependent).
    this.spawnT = (this.spawnT ?? 0) - dt;
    const live = this.agents.reduce((n, a) => n + (a.active ? 1 : 0), 0);
    if (this.spawnT <= 0) { const free = this.agents.find(a => !a.active); if (free && live < this.max) this.spawn(free, px, pz); this.spawnT = 0.4; }
    for (const a of this.agents) {
      if (!a.active) continue;
      const p = a.p, d = Math.hypot(p.position.x - px, p.position.z - pz);
      if (d > 160 || (live > this.max && d > 70)) { a.active = false; p.visible = false; continue; }
      // Going in the front door / coming out to the footpath.
      if (a.house && a.flee <= 0 && a.down <= 0) {
        const H = a.house, tg = H.pts[H.i], ex = tg.x - p.position.x, ez = tg.z - p.position.z, el = Math.hypot(ex, ez); H.T += dt;
        if (el > 0.35 && H.T < 25) { const st = Math.min(el, a.speed * dt), b0 = p.position.clone(); collide(p.position, ex / el * st, ez / el * st); a.h.speed = b0.distanceTo(p.position) / Math.max(dt, 1e-4); p.rotation.y += wrapA(Math.atan2(ex, ez) - p.rotation.y) * Math.min(1, dt * 6); p.position.y = groundHeight(p.position.x, p.position.z); continue; }
        if (++H.i < H.pts.length && H.T < 25) continue;
        if (H.out && this.join(a, p.position.x, p.position.z)) { a.house = null; } else { a.active = false; p.visible = false; a.house = null; continue; }
      }
      if (a.down > 0) { a.down -= dt; a.h.speed = 0; if (a.down <= 0) { a.h.getUp(); a.flee = 5; } continue; }
      // A scrap nearby: stop and watch from the footpath (filming, cheering), then carry on.
      if (fightAt && a.flee <= 0 && Math.hypot(p.position.x - fightAt.x, p.position.z - fightAt.z) < 28) {
        if (!a.watching) { a.watching = { ang: Math.atan2(p.position.x - fightAt.x, p.position.z - fightAt.z) + (Math.random() - 0.5) * 0.5, r: 6.5 + Math.random() * 2.5, kind: Math.random() < 0.5 ? 'film' : 'cheer' }; }
        const w = a.watching, tx = fightAt.x + Math.sin(w.ang) * w.r, tz = fightAt.z + Math.cos(w.ang) * w.r, ex = tx - p.position.x, ez = tz - p.position.z, el = Math.hypot(ex, ez);
        if (el > 0.5) { const st = Math.min(el, 2.4 * dt); collide(p.position, ex / el * st, ez / el * st); p.rotation.y = Math.atan2(ex, ez); a.h.act = null; }
        else { p.rotation.y = Math.atan2(fightAt.x - p.position.x, fightAt.z - p.position.z); a.h.act = w.kind; }
        p.position.y = groundHeight(p.position.x, p.position.z); continue;
      } else if (a.watching) { a.watching = null; a.h.act = null; }
      if (a.flee > 0) {
        a.flee -= dt; const ux = (p.position.x - px) / (d || 1), uz = (p.position.z - pz) / (d || 1), b0 = p.position.clone();
        collide(p.position, ux * 4.6 * dt, uz * 4.6 * dt);
        a.h.speed = b0.distanceTo(p.position) / Math.max(dt, 1e-4); p.rotation.y = Math.atan2(ux, uz);
        p.position.y = groundHeight(p.position.x, p.position.z);
        if (a.flee <= 0) { a.active = false; p.visible = false; } // they've cleared off
        continue;
      }
      const A = this.nodes[a.from], B = this.nodes[a.to], ex = B.x - A.x, ez = B.z - A.z, L = Math.hypot(ex, ez) || 0.01;
      a.t += a.speed * dt;
      if (a.t >= L) {
        a.t -= L; const prev = a.from; a.from = a.to; const opts = B.nb.filter(e => e.to !== prev), pool = opts.length ? opts : B.nb;
        // Home time: turn in at a house on this stretch.
        if (this.homes && Math.random() < 0.08) { const hs = this.housesNear(p.position.x, p.position.z, 30).filter(h => Math.hypot(h.spawn.pos.x - p.position.x, h.spawn.pos.z - p.position.z) < 16); const h = hs[0], path = h && this.housePath(h); if (path) { a.house = { pts: [path[2], path[1], path[0]], i: 0, T: 0 }; continue; } }
        a.e = pool[Math.floor(Math.random() * pool.length)]; a.to = a.e.to;
      }
      const A2 = this.nodes[a.from], B2 = this.nodes[a.to], fx = B2.x - A2.x, fz = B2.z - A2.z, l2 = Math.hypot(fx, fz) || 0.01, vx = fx / l2, vz = fz / l2;
      const off = (a.e.lane * 2 + 3.4) * a.side, tx = A2.x + vx * Math.min(a.t, l2) + vz * off, tz = A2.z + vz * Math.min(a.t, l2) - vx * off;
      const k = 1 - Math.exp(-dt * 4); p.position.x = lerp(p.position.x, tx, k); p.position.z = lerp(p.position.z, tz, k);
      p.position.y = groundHeight(p.position.x, p.position.z);
      const want = Math.atan2(vx, vz); let dh = want - p.rotation.y; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); p.rotation.y += dh * k;
      a.h.speed = a.speed;
    }
  }
  scare(x, z, r = 30) { for (const a of this.agents) if (a.active && a.down <= 0 && Math.hypot(a.p.position.x - x, a.p.position.z - z) < r) { a.flee = 6; a.watching = null; a.h.act = null; } }
  knock(a) { a.down = 6; a.flee = 0; a.h.knockDown(); }
  near(x, z, r) { return this.agents.filter(a => a.active && a.down <= 0 && Math.hypot(a.p.position.x - x, a.p.position.z - z) < r); }
}
