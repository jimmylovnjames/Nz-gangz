// Synthesised sound (no downloads): punches, impacts, blocks, footsteps, cash, phone buzz, knockouts,
// and a street ambience (birds by day, crickets at night, distant traffic). Starts on the first tap.
const SFX = {
  ac: null, on: true, master: null, noise: null, amb: null,
  ensure() {
    if (this.ac || !this.on) return;
    try {
      const ac = this.ac = new (window.AudioContext || window.webkitAudioContext)();
      this.master = ac.createGain(); this.master.gain.value = 0.9; this.master.connect(ac.destination);
      const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
      // Distant traffic: brown-ish noise through a low-pass, always on, very quiet.
      const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
      const g = ac.createGain(); g.gain.value = 0.035; src.connect(lp); lp.connect(g); g.connect(this.master); src.start();
      this.amb = { g, birdT: 2, cricketT: 0 };
    } catch (_) { this.ac = null; }
  },
  setOn(v) { this.on = v; if (this.master) this.master.gain.value = v ? 0.9 : 0; if (v) this.ensure(); },
  burst(t0, dur, freq, q, gain, type = 'bandpass', sweep = 0) {
    const ac = this.ac, s = ac.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t0); if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t0 + dur); f.Q.value = q;
    const g = ac.createGain(); g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t0, Math.random()); s.stop(t0 + dur + 0.02);
  },
  tone(t0, dur, freq, gain, type = 'sine', to = 0) {
    const ac = this.ac, o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t0); if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
    o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + 0.02);
  },
  play(name, k = 1) {
    if (!this.on) return; this.ensure(); if (!this.ac) return;
    const t = this.ac.currentTime;
    switch (name) {
      case 'whoosh': this.burst(t, 0.14, 700, 1.2, 0.12 * k, 'bandpass', 2600); break;
      case 'hit': this.burst(t, 0.09, 1600, 0.8, 0.35 * k, 'lowpass'); this.tone(t, 0.14, 110, 0.4 * k, 'sine', 55); break;
      case 'heavy': this.burst(t, 0.14, 1200, 0.7, 0.5, 'lowpass'); this.tone(t, 0.22, 85, 0.6, 'sine', 40); break;
      case 'block': this.tone(t, 0.07, 190, 0.3, 'triangle', 120); this.burst(t, 0.05, 500, 1, 0.12, 'lowpass'); break;
      case 'hurt': this.burst(t, 0.12, 900, 0.7, 0.3, 'lowpass'); this.tone(t, 0.18, 70, 0.45, 'sine', 45); break;
      case 'step': this.burst(t, 0.045, k > 1 ? 1300 : 900, 0.9, 0.05, 'lowpass'); break;
      case 'ko': this.burst(t, 0.3, 500, 0.8, 0.45, 'lowpass'); this.tone(t, 0.35, 60, 0.5, 'sine', 32); break;
      case 'cash': this.tone(t, 0.16, 1320, 0.18); this.tone(t + 0.09, 0.22, 1760, 0.18); break;
      case 'buzz': for (const o of [0, 0.32]) this.tone(t + o, 0.22, 62, 0.25, 'square'); break;
      case 'click': this.tone(t, 0.03, 1800, 0.06, 'square'); break;
      case 'dodge': this.burst(t, 0.18, 400, 1, 0.15, 'bandpass', 1800); break;
      case 'parry': this.tone(t, 0.2, 1500, 0.16, 'triangle', 900); this.tone(t, 0.12, 2300, 0.06, 'sine', 1800); this.burst(t, 0.12, 2400, 1.5, 0.12, 'bandpass', 600); break;
      case 'tell': this.tone(t, 0.16, 150, 0.12, 'sawtooth', 95); this.burst(t, 0.1, 380, 1.2, 0.08, 'lowpass'); break;
      case 'bark': this.burst(t, 0.09, 620, 2.2, 0.32 * k, 'bandpass', 380); this.tone(t, 0.1, 330, 0.18 * k, 'square', 210); this.burst(t + 0.16, 0.08, 560, 2.2, 0.26 * k, 'bandpass', 360); this.tone(t + 0.16, 0.09, 300, 0.14 * k, 'square', 200); break;
      case 'yelp': this.tone(t, 0.22, 1100, 0.18, 'triangle', 520); this.burst(t, 0.15, 1400, 2, 0.12, 'bandpass', 700); break;
      case 'kick': this.burst(t, 0.05, 700, 1, 0.16 * k, 'lowpass'); this.tone(t, 0.07, 160, 0.12 * k, 'sine', 80); break;
      case 'thump': this.tone(t, 0.18, 70, 0.32 * k, 'sine', 38); this.burst(t, 0.04, 220, 1, 0.08 * k, 'lowpass'); break;
      case 'sirenFar': for (let i = 0; i < 4; i++) { this.tone(t + i * 1.4, 0.7, 620, 0.018, 'sine', 980); this.tone(t + i * 1.4 + 0.7, 0.7, 980, 0.018, 'sine', 620); } break;
      case 'hiss': this.burst(t, 0.7, 2600, 0.5, 0.1 * k, 'highpass'); break;
      case 'clack': this.burst(t, 0.05, 800, 1, 0.14 * k, 'lowpass'); this.tone(t, 0.05, 120, 0.06 * k, 'sine', 70); this.burst(t + 0.12, 0.05, 800, 1, 0.12 * k, 'lowpass'); break;
      case 'trainHorn': for (const f of [370, 466]) this.held(t, 1.3, f, 0.035 * k, 'sawtooth'); break;
      case 'alarm': for (let i = 0; i < 3; i++) this.held(t + i * 0.36, 0.2, i % 2 ? 1300 : 1050, 0.03 * k, 'square'); break;
      case 'hat': this.burst(t, 0.03, 8000, 0.8, 0.03 * k, 'highpass'); break;
      case 'rev': this.tone(t, 0.9, 90, 0.05 * k, 'sawtooth', 240); this.tone(t + 0.7, 0.6, 240, 0.04 * k, 'sawtooth', 140); break;
      case 'screech': this.burst(t, 0.8, 2400, 3, 0.05 * k, 'bandpass', 1800); break;
      case 'banner': this.tone(t, 0.18, 660, 0.12, 'triangle'); this.tone(t + 0.12, 0.3, 990, 0.12, 'triangle'); break;
    }
  },
  // The ice-cream van: the first half of Greensleeves on a music-box tone (traditional, public domain).
  chime(g) {
    if (!this.on || g <= 0.01) return; this.ensure(); if (!this.ac) return;
    const t0 = this.ac.currentTime + 0.05, e = 0.17, mid = n => 440 * Math.pow(2, (n - 69) / 12);
    const tune = [[69, 1], [72, 2], [74, 1], [76, 1.5], [77, 0.5], [76, 1], [74, 2], [71, 1], [67, 1.5], [69, 0.5], [71, 1], [72, 2], [69, 1], [69, 1.5], [68, 0.5], [69, 1], [71, 2], [68, 1], [64, 2], [69, 1], [72, 2], [74, 1], [76, 1.5], [77, 0.5], [76, 1], [74, 2], [71, 1], [67, 1.5], [69, 0.5], [71, 1], [72, 1.5], [71, 0.5], [69, 1], [68, 1.5], [66, 0.5], [68, 1], [69, 3]];
    let tt = t0; for (const [n, d] of tune) { this.tone(tt, d * e * 0.95, mid(n + 12), 0.05 * g, 'triangle'); this.tone(tt, d * e * 0.6, mid(n + 24), 0.012 * g, 'sine'); tt += d * e; }
  },
  // A sustained note with a short release (horns, alarms).
  held(t0, dur, freq, gain, type = 'sine') {
    const ac = this.ac, o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain(); o.type = type; o.frequency.value = freq; f.type = 'lowpass'; f.frequency.value = freq * 4;
    g.gain.setValueAtTime(0.0005, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.04); g.gain.setValueAtTime(gain, t0 + dur - 0.08); g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
    o.connect(f); f.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + 0.02);
  },
  // A train going by: low rumble, louder the closer it is (0 = off).
  rumble(level) {
    if (!this.ac || !this.on) return;
    if (!this.rb && level > 0.01) {
      const ac = this.ac, s = ac.createBufferSource(); s.buffer = this.noise; s.loop = true;
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 150; const g = ac.createGain(); g.gain.value = 0;
      s.connect(f); f.connect(g); g.connect(this.master); s.start(); this.rb = { g };
    }
    if (this.rb) this.rb.g.gain.setTargetAtTime(Math.min(1, level) * 0.5, this.ac.currentTime, 0.3);
  },
  // Lawn mower: a two-stroke drone, louder the closer you are (0 = off).
  mower(level) {
    if (!this.ac || !this.on) return;
    if (!this.mw && level > 0.01) {
      const ac = this.ac, o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.value = 52; o2.type = 'square'; o2.frequency.value = 104.5; f.type = 'lowpass'; f.frequency.value = 520; g.gain.value = 0;
      o.connect(f); o2.connect(f); f.connect(g); g.connect(this.master); o.start(); o2.start(); this.mw = { g, o };
    }
    if (this.mw) this.mw.g.gain.setTargetAtTime(Math.min(1, level) * 0.045, this.ac.currentTime, 0.2);
  },
  // Called every frame with the night factor (0 day .. 1 night).
  ambience(dt, night) {
    if (!this.ac || !this.on) return;
    const A = this.amb, t = this.ac.currentTime;
    if (night < 0.5 && (A.birdT -= dt) <= 0) {
      // A tūī-ish phrase: a couple of quick rising/falling whistles, sometimes a click.
      A.birdT = 2 + Math.random() * 6;
      const base = 1800 + Math.random() * 1600;
      for (let i = 0, n = 2 + Math.floor(Math.random() * 3); i < n; i++) this.tone(t + i * 0.13, 0.11, base * (0.8 + Math.random() * 0.5), 0.025, 'sine', base * (0.7 + Math.random() * 0.8));
      if (Math.random() < 0.3) this.burst(t + 0.5, 0.03, 3000, 2, 0.02);
    }
    if (night > 0.5 && (A.cricketT -= dt) <= 0) { A.cricketT = 0.6 + Math.random() * 0.8; for (let i = 0; i < 3; i++) this.tone(t + i * 0.05, 0.03, 4600 + Math.random() * 300, 0.012, 'sine'); }
  },
};
