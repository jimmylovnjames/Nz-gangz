// "KIWI KNUCKLE KINGS 2": the budget console fighter you play against your cousin in the prologue.
// Original game: 256x192 canvas, blocky pixel fighters, chiptune bleeps. Rendered onto the lounge TV.
const MG_W = 256, MG_H = 192, MG_GROUND = 170;
const FONT = {
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14], D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16], G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17], S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31], 0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14],
  2: [14, 17, 1, 2, 4, 8, 31], 3: [31, 2, 4, 2, 1, 17, 14], 4: [2, 6, 10, 18, 31, 2, 2], 5: [31, 16, 30, 1, 1, 17, 14],
  6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8], 8: [14, 17, 17, 14, 17, 17, 14], 9: [14, 17, 17, 15, 1, 2, 12],
  '!': [4, 4, 4, 4, 4, 0, 4], '.': [0, 0, 0, 0, 0, 12, 12], ':': [0, 12, 12, 0, 12, 12, 0], '-': [0, 0, 0, 31, 0, 0, 0],
  "'": [4, 4, 8, 0, 0, 0, 0], '?': [14, 17, 1, 2, 4, 0, 4], '$': [4, 15, 20, 14, 5, 30, 4], ' ': [0, 0, 0, 0, 0, 0, 0],
  '&': [12, 18, 20, 8, 21, 18, 13], ',': [0, 0, 0, 0, 12, 4, 8],
};
function pixText(g, str, x, y, color, s = 1, shadow = '#000') {
  const w = str.length * 6 * s - s;
  if (x === 'center') x = Math.round((MG_W - w) / 2);
  const draw = (ox, oy, c) => {
    g.fillStyle = c;
    for (let i = 0; i < str.length; i++) {
      const rows = FONT[str[i]] || FONT[' '];
      for (let r = 0; r < 7; r++) for (let b = 0; b < 5; b++) if (rows[r] & (16 >> b)) g.fillRect(ox + (i * 6 + b) * s, oy + r * s, s, s);
    }
  };
  if (shadow) draw(x + s, y + s, shadow);
  draw(x, y, color);
  return w;
}
// Square-brush line: keeps limbs crisp at low resolution.
function pixLine(g, x0, y0, x1, y1, w) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let i = 0; i <= n; i++) { const t = i / n; g.fillRect(Math.round(x0 + (x1 - x0) * t - w / 2), Math.round(y0 + (y1 - y0) * t - w / 2), w, w); }
}

// Tiny WebAudio chip: bleeps for hits and a looping bassline. Created on the NEW GAME tap.
class Chip {
  constructor() { this.ctx = null; this.music = false; this.next = 0; this.step = 0; this.vol = 0.5; }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); this.out = this.ctx.createGain(); this.out.gain.value = this.vol; this.out.connect(this.ctx.destination); } catch (_) { this.ctx = null; }
  }
  tone(freq, dur, type = 'square', vol = 0.12, slide = 0, when = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(this.out); o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, vol = 0.15) {
    if (!this.ctx) return;
    const b = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = this.ctx.createBufferSource(), g = this.ctx.createGain(); s.buffer = b; g.gain.value = vol; s.connect(g); g.connect(this.out); s.start();
  }
  sfx(kind) {
    if (kind === 'punch') { this.tone(220, 0.08, 'square', 0.1, 0.5); this.noise(0.05, 0.12); }
    else if (kind === 'kick') { this.tone(140, 0.14, 'square', 0.12, 0.4); this.noise(0.09, 0.16); }
    else if (kind === 'block') this.tone(900, 0.04, 'square', 0.06, 0.8);
    else if (kind === 'whiff') this.tone(500, 0.05, 'triangle', 0.04, 0.6);
    else if (kind === 'special') { this.tone(110, 0.35, 'sawtooth', 0.1, 3); this.noise(0.2, 0.08); }
    else if (kind === 'ko') [523, 392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.18, 'square', 0.1, 1, i * 0.12));
    else if (kind === 'round') [440, 440, 660].forEach((f, i) => this.tone(f, 0.1, 'square', 0.08, 1, i * 0.15));
    else if (kind === 'fight') this.tone(880, 0.25, 'square', 0.1, 1.5);
  }
  // Schedules the bassline a little ahead of time; call every frame.
  tick() {
    if (!this.ctx || !this.music) return;
    const bass = [55, 55, 82, 55, 73, 55, 82, 98, 49, 49, 73, 49, 65, 49, 73, 82];
    const spb = 60 / 138 / 2;
    if (this.next < this.ctx.currentTime) this.next = this.ctx.currentTime + 0.05;
    while (this.next < this.ctx.currentTime + 0.2) {
      const f = bass[this.step % 16], t = this.next - this.ctx.currentTime;
      this.tone(f * 2, spb * 0.9, 'triangle', 0.07, 1, t);
      if (this.step % 4 === 2) this.tone(f * 6, spb * 0.5, 'square', 0.025, 1, t);
      this.next += spb; this.step++;
    }
  }
}
const CHIP = new Chip();

const MG_MOVES = {
  punch: { startup: 0.07, active: 0.07, recover: 0.15, range: 26, dmg: 6, push: 7, stun: 0.24, sfx: 'punch' },
  kick: { startup: 0.15, active: 0.08, recover: 0.25, range: 36, dmg: 10, push: 11, stun: 0.32, sfx: 'kick' },
  special: { startup: 0.18, active: 0.34, recover: 0.38, range: 22, dmg: 15, push: 26, stun: 0.5, dash: 170, cooldown: 3.5, sfx: 'kick' },
};
class MGFighter {
  constructor(name, look, x, face) { this.name = name; this.look = look; this.home = x; this.face = face; this.reset(); }
  reset() { this.x = this.home; this.hp = 100; this.state = 'idle'; this.t = 0; this.move = null; this.stun = 0; this.kb = 0; this.blocking = false; this.cool = 0; this.flash = 0; this.walk = 0; }
}

class KnuckleKings {
  constructor() {
    this.canvas = document.createElement('canvas'); this.canvas.width = MG_W; this.canvas.height = MG_H;
    this.g = this.canvas.getContext('2d');
    this.p1 = new MGFighter('TAMA', { skin: '#8a5a3c', hair: '#141010', top: '#2f5fd0', top2: '#1d3c8a', legs: '#202020', shoe: '#e8e8e8', singlet: true }, 80, 1);
    this.p2 = new MGFighter('KEVO', { skin: '#c99272', hair: '#7a3e1c', top: '#d23a2a', top2: '#8a1f16', legs: '#3a5a9a', shoe: '#2a2a2a', mullet: true }, 176, -1);
    this.bg = this.paintBackground(); this.scan = this.paintScanlines();
    this.listeners = []; this.sparks = [];
    this.phase = 'off'; this.round = 1; this.wins = [0, 0]; this.timer = 45; this.phaseT = 0; this.time = 0; this.aiT = 0; this.aiHold = 0; this.aiWant = {};
    this.input = { left: false, right: false, block: false }; this.pressed = new Set();
  }
  on(fn) { this.listeners.push(fn); }
  emit(type, data) { for (const fn of this.listeners) fn(type, data); }
  start() { this.round = 1; this.wins = [0, 0]; this.p1.reset(); this.p2.reset(); this.phase = 'title'; this.phaseT = 0; CHIP.music = true; }
  stop() { this.phase = 'off'; CHIP.music = false; }
  press(btn) { this.pressed.add(btn); }
  // Ends the match on the spot (SKIP button); the story carries on from the result.
  finish() { if (this.phase === 'off' || this.phase === 'done') return; this.phase = 'done'; CHIP.music = false; this.emit('match', { winner: this.wins[0] >= this.wins[1] ? 1 : 2, skipped: true }); }
  state() { return { phase: this.phase, round: this.round, wins: this.wins.slice(), p1: this.p1.hp, p2: this.p2.hp, timer: Math.ceil(this.timer) }; }

  paintBackground() {
    const c = document.createElement('canvas'); c.width = MG_W; c.height = MG_H; const g = c.getContext('2d');
    const sky = ['#2b1d4a', '#46245c', '#6b2f63', '#9a3d5e', '#c95a4e', '#e88a4a', '#f2b257'];
    sky.forEach((col, i) => { g.fillStyle = col; g.fillRect(0, i * 14, MG_W, 15); });
    for (let y = 0; y < 98; y++) for (let x = (y % 2); x < MG_W; x += 2) if (y % 14 > 10) { g.fillStyle = sky[Math.min(6, Math.floor(y / 14) + 1)]; g.fillRect(x, y, 1, 1); }
    g.fillStyle = '#ffd98a'; g.fillRect(190, 70, 22, 22); g.fillStyle = '#f2b257'; g.fillRect(190, 84, 22, 2); g.fillRect(190, 88, 22, 2);
    g.fillStyle = '#1f3a2a'; for (let x = 0; x < MG_W; x++) { const h = 18 + Math.round(Math.sin(x * 0.04) * 6 + Math.sin(x * 0.11) * 3); g.fillRect(x, 112 - h, 1, h); }
    // Dairy shopfront.
    g.fillStyle = '#d8cfbf'; g.fillRect(22, 92, 110, 62); g.fillStyle = '#b8ac98'; g.fillRect(22, 92, 110, 4);
    g.fillStyle = '#c4302a'; g.fillRect(18, 104, 118, 12); pixText(g, 'SUPER DAIRY', 44, 107, '#ffe9a0', 1, '#5a1010');
    g.fillStyle = '#2a3a46'; g.fillRect(30, 122, 40, 30); g.fillRect(84, 122, 22, 32);
    g.fillStyle = '#f2e04a'; g.fillRect(34, 126, 14, 10); pixText(g, '$2', 35, 128, '#c4302a', 1, null);
    g.fillStyle = '#ffffff'; g.fillRect(52, 128, 14, 8); g.fillStyle = '#6aa0d8'; g.fillRect(36, 140, 30, 4);
    // Power pole, wires, cabbage tree.
    g.fillStyle = '#4a3324'; g.fillRect(160, 60, 4, 100); g.fillRect(150, 66, 24, 3);
    g.fillStyle = '#111'; for (let x = 0; x < MG_W; x++) { g.fillRect(x, 66 + Math.round(Math.pow((x - 162) / 140, 2) * 14), 1, 1); g.fillRect(x, 72 + Math.round(Math.pow((x - 162) / 140, 2) * 12), 1, 1); }
    g.fillStyle = '#3a2a1a'; g.fillRect(216, 104, 3, 52); g.fillRect(212, 96, 3, 14); g.fillRect(221, 98, 3, 12);
    g.fillStyle = '#2d5a2a'; for (const [cx, cy] of [[213, 92], [222, 94], [217, 100]]) for (let a = 0; a < 12; a++) pixLine(g, cx, cy, cx + Math.cos(a / 12 * TAU) * 9, cy + Math.sin(a / 12 * TAU) * 6 + 3, 1);
    // Road, kerb and painted lines.
    g.fillStyle = '#9a9a92'; g.fillRect(0, 154, MG_W, 6); g.fillStyle = '#3a3a40'; g.fillRect(0, 160, MG_W, 32);
    g.fillStyle = '#e8c43a'; g.fillRect(0, 160, MG_W, 1);
    g.fillStyle = '#4a4a52'; for (let i = 0; i < 300; i++) g.fillRect((i * 37) % MG_W, 162 + (i * 13) % 30, 1, 1);
    g.fillStyle = '#d8d8d0'; for (let x = 4; x < MG_W; x += 26) g.fillRect(x, 182, 12, 2);
    return c;
  }
  paintScanlines() {
    const c = document.createElement('canvas'); c.width = MG_W; c.height = MG_H; const g = c.getContext('2d');
    g.fillStyle = 'rgba(0,0,0,0.22)'; for (let y = 1; y < MG_H; y += 2) g.fillRect(0, y, MG_W, 1);
    const v = g.createRadialGradient(MG_W / 2, MG_H / 2, 60, MG_W / 2, MG_H / 2, 170); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = v; g.fillRect(0, 0, MG_W, MG_H);
    return c;
  }

  // ---- simulation --------------------------------------------------------------------------
  update(dt) {
    this.time += dt; this.phaseT += dt;
    CHIP.tick();
    const P = this.phase;
    if (P === 'off' || P === 'done') { this.pressed.clear(); return; }
    if (P === 'title' && this.phaseT > 2.6) this.setPhase('intro');
    if (P === 'intro') { if (this.phaseT > 0.05 && !this.introSfx) { CHIP.sfx('round'); this.introSfx = true; } if (this.phaseT > 1.6) { this.setPhase('fight'); CHIP.sfx('fight'); this.emit('round', { round: this.round }); } }
    if (P === 'fight') {
      this.timer -= dt;
      this.control(this.p1, this.input, this.pressed, dt);
      this.ai(dt);
      this.control(this.p2, this.aiWant, this.aiPressed || new Set(), dt);
      this.aiPressed = new Set();
      this.separate();
      if (this.p1.hp <= 0 || this.p2.hp <= 0 || this.timer <= 0) this.endRound();
    } else { this.animateOnly(this.p1, dt); this.animateOnly(this.p2, dt); }
    if (P === 'ko' && this.phaseT > 2.6) {
      if (this.wins[0] >= 2 || this.wins[1] >= 2) { this.phase = 'done'; CHIP.music = false; this.emit('match', { winner: this.wins[0] >= 2 ? 1 : 2 }); }
      else { this.round++; this.p1.reset(); this.p2.reset(); this.setPhase('intro'); }
    }
    for (const s of this.sparks) s.t += dt;
    this.sparks = this.sparks.filter(s => s.t < 0.25);
    this.pressed.clear();
  }
  setPhase(p) { this.phase = p; this.phaseT = 0; this.introSfx = false; if (p === 'intro') this.timer = 45; }
  endRound() {
    const w = this.p1.hp === this.p2.hp ? (Math.random() < 0.5 ? 1 : 2) : this.p1.hp > this.p2.hp ? 1 : 2;
    this.wins[w - 1]++; const loser = w === 1 ? this.p2 : this.p1, winner = w === 1 ? this.p1 : this.p2;
    loser.state = 'ko'; loser.t = 0; loser.hp = Math.max(0, loser.hp); winner.state = 'win'; winner.t = 0;
    CHIP.sfx('ko'); this.setPhase('ko'); this.koTimeout = this.timer <= 0;
    this.emit('roundEnd', { winner: w, round: this.round, wins: this.wins.slice(), timeout: this.koTimeout });
  }
  separate() {
    const a = this.p1, b = this.p2, gap = 18, d = b.x - a.x;
    if (Math.abs(d) < gap) { const push = (gap - Math.abs(d)) / 2 * Math.sign(d || 1); a.x -= push; b.x += push; }
    a.x = clamp(a.x, 14, MG_W - 14); b.x = clamp(b.x, 14, MG_W - 14);
    a.face = b.x >= a.x ? 1 : -1; b.face = -a.face;
  }
  control(f, inp, pressed, dt) {
    const other = f === this.p1 ? this.p2 : this.p1;
    f.t += dt; f.cool = Math.max(0, f.cool - dt); f.flash = Math.max(0, f.flash - dt);
    if (f.stun > 0) { f.stun -= dt; f.x += f.kb * dt; f.kb *= Math.pow(0.02, dt); if (f.stun <= 0) f.state = 'idle'; return; }
    if (f.move) {
      const m = MG_MOVES[f.move], t = f.t;
      if (m.dash && t < m.startup + m.active) f.x += f.face * m.dash * dt * (t > m.startup ? 1 : 0.3);
      if (t >= m.startup && t < m.startup + m.active && !f.connected) {
        if (Math.abs(other.x - f.x) <= m.range + 6) { f.connected = true; this.hit(f, other, m); }
      }
      if (t >= m.startup + m.active + m.recover) { if (!f.connected) CHIP.sfx('whiff'); f.move = null; f.state = 'idle'; }
      return;
    }
    const start = name => { const m = MG_MOVES[name]; if (m.cooldown && f.cool > 0) return false; f.move = name; f.state = name; f.t = 0; f.connected = false; if (m.cooldown) f.cool = m.cooldown; if (name === 'special') CHIP.sfx('special'); return true; };
    if (pressed.has('special') && start('special')) return;
    if (pressed.has('kick') && start('kick')) return;
    if (pressed.has('punch') && start('punch')) return;
    f.blocking = !!inp.block;
    if (f.blocking) { f.state = 'block'; return; }
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (dir) { f.x += dir * 58 * dt; f.state = 'walk'; f.walk += dt * dir * f.face; } else f.state = 'idle';
  }
  hit(att, def, m) {
    const blocked = def.blocking && !def.move && def.stun <= 0;
    const dmg = blocked ? Math.ceil(m.dmg * 0.15) : m.dmg;
    def.hp = Math.max(0, def.hp - dmg);
    def.kb = att.face * m.push * (blocked ? 3 : 6);
    def.stun = blocked ? 0.12 : m.stun; def.state = blocked ? 'block' : 'hit'; def.t = 0; def.flash = blocked ? 0 : 0.12;
    this.sparks.push({ x: (att.x + def.x) / 2 + att.face * 6, y: MG_GROUND - (m === MG_MOVES.kick ? 26 : 32), t: 0, blocked });
    CHIP.sfx(blocked ? 'block' : m.sfx);
    this.emit('hit', { by: att === this.p1 ? 1 : 2, move: Object.keys(MG_MOVES).find(k => MG_MOVES[k] === m), blocked, hp1: this.p1.hp, hp2: this.p2.hp });
  }
  animateOnly(f, dt) { f.t += dt; f.flash = Math.max(0, f.flash - dt); if (f.state === 'hit' || f.state === 'block' || f.move) { f.state = f.state === 'ko' || f.state === 'win' ? f.state : 'idle'; f.move = null; } }
  // Cousin AI: reacts after a short delay, likes the kick, blocks about a third of the time.
  ai(dt) {
    const me = this.p2, you = this.p1, d = Math.abs(you.x - me.x);
    this.aiT -= dt; this.aiHold -= dt;
    if (this.aiHold <= 0) this.aiWant = {};
    if (this.aiT > 0) return;
    this.aiT = 0.16 + Math.random() * 0.18;
    const toward = you.x > me.x ? 'right' : 'left', away = toward === 'right' ? 'left' : 'right';
    if (you.move && d < 44 && Math.random() < 0.38) { this.aiWant = { block: true }; this.aiHold = 0.35; return; }
    if (d > 32) { this.aiWant = { [toward]: true }; this.aiHold = 0.25; return; }
    if (d < 16 && Math.random() < 0.3) { this.aiWant = { [away]: true }; this.aiHold = 0.2; return; }
    const r = Math.random();
    this.aiPressed = new Set([r < 0.45 ? 'punch' : r < 0.82 ? 'kick' : me.cool <= 0 ? 'special' : 'punch']);
    if (Math.random() < 0.25) this.aiT += 0.3;
  }

  // ---- drawing ---------------------------------------------------------------------------
  drawFighter(f) {
    const g = this.g, L = f.look, s = f.face, t = f.t;
    let hipX = f.x, hipY = MG_GROUND - 20, lean = 0;
    const bob = f.state === 'idle' ? Math.round(Math.sin(this.time * 6 + f.home) * 1) : 0;
    // Joint targets relative to hip (x forward = facing direction).
    let fa = [10, -24], fh = [16, -26], ba = [-2, -18], bh = [4, -14]; // front/back elbow & hand
    let fk = [6, 10], ff = [8, 20], bk = [-5, 10], bf = [-8, 20];   // knees & feet
    const phaseP = m => clamp(t / Math.max(1e-3, MG_MOVES[m].startup), 0, 1) * (t < MG_MOVES[m].startup + MG_MOVES[m].active + MG_MOVES[m].recover * 0.5 ? 1 : 0);
    if (f.state === 'walk') { const w = Math.sin(f.walk * 9) * 5; fk = [5 + w * 0.6, 10]; ff = [6 + w, 20]; bk = [-4 - w * 0.6, 10]; bf = [-6 - w, 20]; }
    if (f.state === 'punch') { const p = phaseP('punch'); fa = [lerp(10, 14, p), lerp(-24, -29, p)]; fh = [lerp(16, 27, p), lerp(-26, -30, p)]; lean = 2 * p; }
    if (f.state === 'kick') { const p = phaseP('kick'); fk = [lerp(6, 14, p), lerp(10, -2, p)]; ff = [lerp(8, 30, p), lerp(20, -6, p)]; lean = -3 * p; }
    if (f.state === 'special') { const p = clamp(t / 0.18, 0, 1); lean = 6 * p; fa = [12, -22]; fh = [20, -22]; ba = [8, -20]; bh = [16, -18]; }
    if (f.state === 'block') { fa = [8, -22]; fh = [10, -32]; ba = [6, -20]; bh = [7, -30]; lean = -2; }
    if (f.state === 'hit') { lean = -5; fa = [4, -20]; fh = [-2, -14]; }
    if (f.state === 'win') { fa = [6, -32]; fh = [8, -44]; hipY -= Math.abs(Math.sin(t * 6)) * 4; }
    if (f.state === 'ko') {
      const p = clamp(t / 0.4, 0, 1);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(Math.round(hipX - 20), MG_GROUND - 1, 40, 3);
      const y = MG_GROUND - 4 - (1 - p) * 16, x0 = hipX - s * 16;
      g.fillStyle = L.legs; pixLine(g, hipX, y, hipX + s * 14, y + 1, 5);
      g.fillStyle = L.top; pixLine(g, hipX, y, x0, y - 1, 8);
      g.fillStyle = L.skin; g.fillRect(Math.round(x0 - s * 6 - 4), Math.round(y - 5), 8, 8);
      g.fillStyle = L.hair; g.fillRect(Math.round(x0 - s * 6 - 4), Math.round(y - 5), 8, 3);
      return;
    }
    hipY += bob;
    const P = (v) => [Math.round(hipX + v[0] * s), Math.round(hipY + v[1])];
    const neck = [lean, -22], head = [lean + 1, -30];
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(Math.round(hipX - 12), MG_GROUND - 1, 24, 3);
    const flash = f.flash > 0 && Math.floor(this.time * 40) % 2 === 0;
    const col = c => flash ? '#ffffff' : c;
    // back limbs
    g.fillStyle = col(L.legs); pixLine(g, ...P([0, 0]), ...P(bk), 5); pixLine(g, ...P(bk), ...P(bf), 4);
    g.fillStyle = col(L.shoe); { const q = P(bf); g.fillRect(q[0] - 2 + s, q[1] - 1, 6, 3); }
    g.fillStyle = col(L.singlet ? L.skin : L.top2); pixLine(g, ...P([lean, -19]), ...P(ba), 4);
    g.fillStyle = col(L.skin); pixLine(g, ...P(ba), ...P(bh), 4); { const q = P(bh); g.fillRect(q[0] - 2, q[1] - 2, 5, 5); }
    // torso
    g.fillStyle = col(L.top); pixLine(g, ...P([0, -2]), ...P(neck), 9);
    if (L.singlet) { g.fillStyle = col(L.skin); g.fillRect(Math.round(hipX + (lean - 3) * s) - 1, Math.round(hipY - 22), 3, 4); }
    g.fillStyle = col(L.legs); pixLine(g, ...P([-1, -2]), ...P([1, 2]), 9);
    // head
    const h = P(head); g.fillStyle = col(L.skin); g.fillRect(h[0] - 4, h[1] - 4, 8, 9);
    g.fillStyle = col(L.hair); g.fillRect(h[0] - 4, h[1] - 5, 8, 3); if (L.mullet) g.fillRect(h[0] - 4 - s * 2, h[1] - 3, 3, 8);
    g.fillStyle = '#000'; g.fillRect(h[0] + s * 2, h[1] - 1, 1, 2);
    // front limbs
    g.fillStyle = col(L.legs); pixLine(g, ...P([0, 0]), ...P(fk), 5); pixLine(g, ...P(fk), ...P(ff), 4);
    g.fillStyle = col(L.shoe); { const q = P(ff); g.fillRect(q[0] - 2 + s, q[1] - 1, 6, 3); }
    g.fillStyle = col(L.singlet ? L.skin : L.top); pixLine(g, ...P([lean + 1, -19]), ...P(fa), 4);
    g.fillStyle = col(L.skin); pixLine(g, ...P(fa), ...P(fh), 4); { const q = P(fh); g.fillRect(q[0] - 2, q[1] - 2, 5, 5); }
    if (f.state === 'special' && t < 0.55) { g.fillStyle = 'rgba(255,220,120,0.5)'; for (let k = 1; k < 4; k++) g.fillRect(Math.round(hipX - s * k * 7) - 3, Math.round(hipY - 26), 6, 22); }
  }
  bar(x, hp, right) {
    const g = this.g, w = 100;
    g.fillStyle = '#000'; g.fillRect(x - 1, 9, w + 2, 9);
    g.fillStyle = '#a01010'; g.fillRect(x, 10, w, 7);
    g.fillStyle = hp > 30 ? '#f2d13a' : '#ff7a2a';
    const fw = Math.round(w * hp / 100); g.fillRect(right ? x + w - fw : x, 10, fw, 7);
  }
  draw() {
    const g = this.g;
    g.drawImage(this.bg, 0, 0);
    // crowd bobbing behind the kerb
    for (let i = 0; i < 9; i++) {
      const x = 8 + i * 29, y = 146 + Math.round(Math.sin(this.time * (3 + i % 3) + i) * 1.2);
      g.fillStyle = ['#3a2a4a', '#4a3a2a', '#2a3a4a'][i % 3]; g.fillRect(x, y, 10, 10);
      g.fillStyle = ['#8a5a3c', '#c99272', '#6b4029'][i % 3]; g.fillRect(x + 2, y - 6, 6, 6);
    }
    if (this.phase !== 'off') {
      const order = this.p1.x < this.p2.x ? [this.p1, this.p2] : [this.p2, this.p1];
      for (const f of order) this.drawFighter(f);
      for (const s of this.sparks) {
        const r = Math.round(2 + s.t * 30); g.fillStyle = s.blocked ? '#9ad8ff' : '#fff6a0';
        g.fillRect(Math.round(s.x) - r, Math.round(s.y), r * 2, 1); g.fillRect(Math.round(s.x), Math.round(s.y) - r, 1, r * 2);
        g.fillRect(Math.round(s.x) - 1, Math.round(s.y) - 1, 3, 3);
      }
      this.bar(8, this.p1.hp, false); this.bar(MG_W - 108, this.p2.hp, true);
      pixText(g, this.p1.name, 8, 20, '#ffffff'); pixText(g, this.p2.name, MG_W - 8 - this.p2.name.length * 6 + 1, 20, '#ffffff');
      for (let i = 0; i < 2; i++) { g.fillStyle = this.wins[0] > i ? '#f2d13a' : '#333'; g.fillRect(40 + i * 7, 21, 5, 5); g.fillStyle = this.wins[1] > i ? '#f2d13a' : '#333'; g.fillRect(MG_W - 45 - i * 7, 21, 5, 5); }
      g.fillStyle = '#000'; g.fillRect(118, 6, 20, 13); pixText(g, String(Math.max(0, Math.ceil(this.timer))).padStart(2, '0'), 'center', 9, '#ffffff');
    }
    const blink = Math.floor(this.time * 3) % 2 === 0;
    if (this.phase === 'title') {
      g.fillStyle = 'rgba(10,0,30,0.7)'; g.fillRect(0, 40, MG_W, 82);
      pixText(g, 'KIWI KNUCKLE', 'center', 52, '#ffd84a', 2, '#a01010'); pixText(g, 'KINGS 2', 'center', 72, '#ffd84a', 2, '#a01010');
      pixText(g, 'TURBO EDITION', 'center', 94, '#9ad8ff'); if (blink) pixText(g, 'PRESS START', 'center', 108, '#ffffff');
    }
    if (this.phase === 'intro') pixText(g, this.phaseT < 1.0 ? `ROUND ${this.round}` : 'FIGHTING!', 'center', 78, '#ffd84a', 2, '#a01010');
    if (this.phase === 'ko') {
      pixText(g, this.koTimeout ? 'TIME OVER' : 'K.O.!!', 'center', 70, '#ff4a2a', 2, '#000');
      if (this.phaseT > 1.0) pixText(g, `WINNER IS ${this.wins[0] > this.wins[1] || (this.p1.state === 'win') ? this.p1.name : this.p2.name}`, 'center', 96, '#ffffff');
    }
    if (this.phase === 'done') { g.fillStyle = 'rgba(10,0,30,0.6)'; g.fillRect(0, 70, MG_W, 40); pixText(g, this.wins[0] > this.wins[1] ? 'YOU WIN! PERFECTLY!' : 'TRY AGAIN LOSER', 'center', 80, '#ffd84a'); if (blink) pixText(g, 'INSERT COIN', 'center', 94, '#ffffff'); }
    g.drawImage(this.scan, 0, 0);
  }
  // Average screen colour for the TV's light on the room.
  glow(out) {
    if (!this.tiny) { this.tiny = document.createElement('canvas'); this.tiny.width = this.tiny.height = 2; this.tctx = this.tiny.getContext('2d', { willReadFrequently: true }); }
    this.tctx.drawImage(this.canvas, 0, 0, 2, 2);
    const d = this.tctx.getImageData(0, 0, 2, 2).data;
    let r = 0, gg = 0, b = 0; for (let i = 0; i < 16; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
    out.setRGB(r / 1020, gg / 1020, b / 1020, THREE.SRGBColorSpace);
    return out;
  }
}
