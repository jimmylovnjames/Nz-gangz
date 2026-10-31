// Story: dialogue box, voice lines, the script, and the prologue director.
// Every line has an id. Drop a recording in voice/ and list it in voice/manifest.js to hear it;
// lines without a recording play as subtitles. See VOICE_SCRIPT.md for the full list.
const CAST = {
  manu: { name: 'MANU', color: '#f3d98c' },
  you: { name: 'YOU', color: '#b8f5e1' },
  darren: { name: 'DARREN', color: '#ff9a7a' },
};
const SCRIPT = {
  proIntro: [
    { who: 'manu', id: 'pro_01', text: 'Oi. Pass us that other controller, cuz.' },
    { who: 'you', id: 'pro_02', text: 'This thing still works? It\'s older than me.' },
    { who: 'manu', id: 'pro_03', text: 'Kiwi Knuckle Kings Two, bro. Turbo edition. Classic.' },
    { who: 'manu', id: 'pro_04', text: 'Rematch. Loser shouts the feed.' },
    { who: 'you', id: 'pro_05', text: 'You\'re on.' },
  ],
  barkYouHit: [
    { who: 'manu', id: 'bark_hit_1', text: 'Ohh, cheap shot!' },
    { who: 'manu', id: 'bark_hit_2', text: 'Bro, stop spamming kick.' },
    { who: 'manu', id: 'bark_hit_3', text: 'That\'s lag, that is. Controller\'s munted.' },
    { who: 'manu', id: 'bark_hit_4', text: 'Sweet as, sweet as. I\'m just warming up.' },
  ],
  barkManuHit: [
    { who: 'manu', id: 'bark_got_1', text: 'Get that! Get that!' },
    { who: 'manu', id: 'bark_got_2', text: 'Too easy, cuz.' },
    { who: 'manu', id: 'bark_got_3', text: 'Kevo\'s the champ, eh.' },
  ],
  round1You: [
    { who: 'manu', id: 'r1_win_1', text: 'Lucky. That\'s all that was.' },
    { who: 'you', id: 'r1_win_2', text: 'Lucky, aye? Keep telling yourself that.' },
  ],
  round1Manu: [
    { who: 'manu', id: 'r1_lose_1', text: 'Told you. Undefeated in this whare.' },
    { who: 'you', id: 'r1_lose_2', text: 'Round two, bro. Round two.' },
  ],
  debt: [
    { who: 'manu', id: 'debt_talk_01', text: 'Real talk though... you still skint?' },
    { who: 'you', id: 'debt_talk_02', text: 'Always, cuz.' },
    { who: 'manu', id: 'debt_talk_03', text: 'You remember Darren? Skinny fulla from down the road?' },
    { who: 'you', id: 'debt_talk_04', text: 'Darren with the Commodore? Yeah.' },
    { who: 'manu', id: 'debt_talk_05', text: 'He owes me four hundred bucks. Been dodging me three weeks now.' },
    { who: 'manu', id: 'debt_talk_06', text: 'Every time I go round, his missus reckons he\'s at work.' },
    { who: 'you', id: 'debt_talk_07', text: 'Darren? Work?' },
    { who: 'manu', id: 'debt_talk_08', text: 'Exactly.' },
  ],
  matchYou: [{ who: 'manu', id: 'match_win', text: 'Yeah, yeah. Feed\'s on me then.' }],
  matchManu: [{ who: 'manu', id: 'match_lose', text: 'Ha! You\'re shouting the feed, loser.' }],
  offer: [
    { who: 'manu', id: 'offer_01', text: 'Anyway. Four hundred, bro. I need that.' },
    { choice: [
      { who: 'you', id: 'offer_you_a', text: 'Want me to go have a word with him?', next: 'offerYes' },
      { who: 'you', id: 'offer_you_b', text: 'Sounds like your problem, cuz.', next: 'offerNo' },
    ] },
  ],
  offerNo: [
    { who: 'manu', id: 'offer_02', text: 'Wow. Thought you were whānau.' },
    { choice: [{ who: 'you', id: 'offer_you_c', text: 'Nah, I\'m playing. I\'ll go have a word.', next: 'offerYes' }] },
  ],
  offerYes: [
    { who: 'manu', id: 'offer_03', text: '...For real? You\'d do that?' },
    { who: 'you', id: 'offer_04', text: 'He knows me. I\'ll sort it.' },
    { who: 'manu', id: 'offer_05', text: 'Last I heard he\'s always hanging round {spot}.' },
    { who: 'manu', id: 'offer_06', text: 'Bring back the whole four hundred and you\'re getting a cut. Don\'t do nothing stupid, eh.' },
    { who: 'you', id: 'offer_07', text: 'Me? Never.', result: 'accepted' },
  ],
  darrenMeet: [
    { who: 'darren', id: 'darren_01', text: 'Ohh... hey bro. What you doing round this way?' },
    { choice: [{ who: 'you', id: 'darren_you_1', text: 'Manu sent me. You know what this is about.', next: 'darrenExcuse' }] },
  ],
  darrenExcuse: [
    { who: 'darren', id: 'darren_02', text: 'Look, I was gonna sort him out, true story. Just had a rough couple of weeks.' },
    { choice: [
      { who: 'you', id: 'darren_you_soft', text: 'Half now, rest by Friday. Don\'t make me come back.', next: 'darrenPays' },
      { who: 'you', id: 'darren_you_hard', text: 'Nah. The whole four hundred. Today.', next: 'darrenFights' },
    ] },
  ],
  darrenPays: [{ who: 'darren', id: 'darren_03', text: '...Yeah. Yeah, alright. Here\'s two hundred. Tell him Friday, eh.', result: 'smooth' }],
  darrenFights: [{ who: 'darren', id: 'darren_04', text: 'I told you, I ain\'t got it! You wanna go, bro? Let\'s go.', result: 'fight' }],
  darrenBeaten: [
    { who: 'darren', id: 'darren_05', text: 'Alright! Alright... take it. Take it. Four hundred. Happy?' },
    { who: 'you', id: 'darren_06', text: 'Should\'ve just paid him, Daz.', result: 'paid' },
  ],
  darrenAgain: [{ who: 'darren', id: 'darren_07', text: 'I already paid, bro. Leave us alone.' }],
  manuWaiting: [{ who: 'manu', id: 'manu_wait', text: 'Any luck with Darren? He\'s round {spot}.' }],
  returnSmooth: [
    { who: 'manu', id: 'ret_s1', text: 'Two hundred? ...Better than nothing, I suppose.' },
    { who: 'you', id: 'ret_s2', text: 'Rest by Friday. He knows I\'ll come back.' },
    { who: 'manu', id: 'ret_s3', text: 'Chur. Here, fifty for your gas.', goto: 'returnEnd' },
  ],
  returnHard: [
    { who: 'manu', id: 'ret_h1', text: 'Bro... the whole four hundred? What\'d you do to him?' },
    { who: 'you', id: 'ret_h2', text: 'We had a chat. Bit of a loud one.' },
    { who: 'manu', id: 'ret_h3', text: 'Hard out. Here, a hundred\'s yours.', goto: 'returnEnd' },
  ],
  returnEnd: [
    { who: 'manu', id: 'ret_4', text: 'Word gets round quick here, eh. Couple of the crews down the square been asking who you are.' },
    { who: 'manu', id: 'ret_5', text: 'Go see who\'s keen. Just watch yourself.', result: 'done' },
  ],
};

class VoiceBank {
  constructor() { this.files = window.AU_VOICE || {}; this.audio = null; }
  has(id) { return !!this.files[id]; }
  // Resolves with the clip length (seconds) once playing, or null if there is no recording.
  play(id) {
    this.stop();
    if (!this.has(id)) return Promise.resolve(null);
    return new Promise(resolve => {
      const a = new Audio('voice/' + this.files[id]); this.audio = a;
      a.onloadedmetadata = () => resolve(a.duration || null);
      a.onerror = () => resolve(null);
      a.play().catch(() => resolve(null));
    });
  }
  stop() { if (this.audio) { this.audio.pause(); this.audio = null; } }
  pause(p) { if (this.audio) p ? this.audio.pause() : this.audio.play().catch(() => { }); }
}

class Dialogue {
  constructor() {
    this.box = $('dialogue'); this.who = $('dlgWho'); this.text = $('dlgText'); this.choices = $('dlgChoices');
    this.voice = new VoiceBank();
    this.seq = null; this.i = 0; this.line = null; this.t = 0; this.dur = 0; this.typed = 0; this.vars = {}; this.done = null; this.result = null; this.paused = false;
    this.box.addEventListener('click', e => { if (e.target.closest('button')) return; this.advance(); });
  }
  get active() { return !!this.seq; }
  get waitingChoice() { return !!(this.line && this.line.choice); }
  fill(s) { return s.replace(/\{(\w+)\}/g, (_, k) => this.vars[k] ?? ''); }
  run(key, vars, done) {
    this.vars = { ...this.vars, ...vars }; this.done = done; this.result = null;
    this.load(key);
  }
  load(key) { this.seq = SCRIPT[key]; this.key = key; this.i = 0; this.show(); }
  // One-off line from a pool, only when nothing else is being said.
  bark(key) {
    if (this.seq) return false;
    const pool = SCRIPT[key]; const line = pool[Math.floor(Math.random() * pool.length)];
    this.seq = [line]; this.key = key; this.i = 0; this.done = null; this.show(); return true;
  }
  show() {
    const line = this.line = this.seq[this.i];
    this.box.classList.add('show'); this.choices.innerHTML = '';
    if (line.choice) {
      this.who.textContent = 'YOU'; this.who.style.color = CAST.you.color; this.text.textContent = '';
      line.choice.forEach((c, k) => {
        const b = document.createElement('button'); b.textContent = this.fill(c.text); b.onclick = () => this.choose(k); this.choices.appendChild(b);
      });
      this.box.classList.add('choosing');
      return;
    }
    this.box.classList.remove('choosing');
    const cast = CAST[line.who] || CAST.you;
    this.who.textContent = cast.name; this.who.style.color = cast.color;
    this.full = this.fill(line.text); this.typed = 0; this.text.textContent = ''; this.t = 0;
    this.dur = 1.3 + this.full.length * 0.055;
    const token = this.token = {};
    this.voice.play(line.id).then(d => { if (token === this.token && d) this.dur = Math.max(this.dur * 0.5, d + 0.35); });
  }
  choose(k) {
    const c = this.line?.choice?.[k]; if (!c) return;
    // The chosen reply is spoken as a normal line, then the story branches.
    this.seq = [{ who: c.who || 'you', id: c.id, text: c.text, next: c.next, result: c.result }]; this.i = 0; this.show();
  }
  advance() {
    if (!this.seq || this.waitingChoice) return;
    if (this.typed < this.full.length) { this.typed = this.full.length; this.text.textContent = this.full; return; }
    this.nextLine();
  }
  nextLine() {
    const line = this.line;
    this.voice.stop();
    if (line.result !== undefined) this.result = line.result;
    if (line.next) return this.load(line.next);
    if (line.goto) return this.load(line.goto);
    this.i++;
    if (this.i < this.seq.length) return this.show();
    this.close();
  }
  close() {
    const done = this.done, result = this.result;
    this.seq = null; this.line = null; this.done = null; this.box.classList.remove('show', 'choosing');
    if (done) done(result);
  }
  stop() { this.voice.stop(); this.seq = null; this.line = null; this.done = null; this.box.classList.remove('show', 'choosing'); }
  update(dt) {
    if (!this.seq || this.waitingChoice || this.paused) return;
    this.t += dt;
    if (this.typed < this.full.length) { this.typed = Math.min(this.full.length, this.typed + dt * 38); this.text.textContent = this.full.slice(0, Math.floor(this.typed)); }
    if (this.t > this.dur) this.nextLine();
  }
  setPaused(p) { this.paused = p; this.voice.pause(p); }
}

// Prologue director: lounge camera, the match, banter and the offer, then hands over to the street.
class Prologue {
  constructor(lounge, game, dialogue) {
    this.lounge = lounge; this.mg = game; this.dlg = dialogue; this.active = false; this.barkCool = 0; this.debtQueued = false;
    game.on((type, d) => this.onGame(type, d));
    const held = this.mg.input;
    document.querySelectorAll('[data-mg]').forEach(b => {
      const k = b.dataset.mg, hold = k === 'left' || k === 'right' || k === 'block';
      b.addEventListener('pointerdown', e => { e.preventDefault(); if (hold) held[k] = true; else this.mg.press(k); b.setPointerCapture?.(e.pointerId); });
      for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, () => { if (hold) held[k] = false; });
    });
    const keys = { KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', KeyL: 'block', ShiftLeft: 'block', KeyJ: 'punch', KeyK: 'kick', KeyI: 'special', Space: 'special' };
    addEventListener('keydown', e => { if (!this.active || e.repeat) return; const k = keys[e.code]; if (!k) return; if (k === 'left' || k === 'right' || k === 'block') held[k] = true; else this.mg.press(k); });
    addEventListener('keyup', e => { const k = keys[e.code]; if (k === 'left' || k === 'right' || k === 'block') held[k] = false; });
    $('mgSkip').addEventListener('click', () => this.skip());
  }
  start(vars, onDone) {
    this.active = true; this.onDone = onDone; this.vars = vars; this.debtQueued = false; this.debtDone = false; this.ended = false;
    document.body.classList.add('prologue'); document.body.classList.remove('mg');
    this.lounge.look = 'cousin'; this.lounge.aimAt(this.lounge.cousinHead(), true);
    this.mg.stop(); this.mg.phase = 'off';
    fadeIn();
    this.dlg.run('proIntro', vars, () => { this.lounge.look = 'tv'; document.body.classList.add('mg'); this.mg.start(); });
  }
  onGame(type, d) {
    if (!this.active) return;
    if (type === 'hit' && !d.blocked && this.barkCool <= 0 && Math.random() < 0.45) {
      if (this.dlg.bark(d.by === 1 ? 'barkYouHit' : 'barkManuHit')) this.barkCool = 7;
      if (d.by === 1) this.lounge.cousin.hit();
    }
    if (type === 'roundEnd' && d.round === 1) { this.dlg.stop(); this.dlg.run(d.winner === 1 ? 'round1You' : 'round1Manu', this.vars, null); this.lounge.cousin.react = d.winner === 1 ? -1 : 1; }
    if (type === 'round' && d.round === 2 && !this.debtQueued) { this.debtQueued = true; this.debtAt = 3.5; }
    if (type === 'match') this.endMatch(d.winner);
  }
  endMatch(winner) {
    if (this.ended) return; this.ended = true;
    document.body.classList.remove('mg');
    this.lounge.cousin.react = winner === 1 ? -1 : 1;
    const after = () => {
      this.lounge.look = 'cousin';
      this.dlg.run(winner === 1 ? 'matchYou' : 'matchManu', this.vars, () => this.dlg.run('offer', this.vars, r => { if (r === 'accepted') this.finish(); }));
    };
    // The debt conversation always happens, even after a quick match or a skip.
    if (!this.debtDone) { this.dlg.stop(); this.lounge.look = 'cousin'; this.debtDone = true; this.dlg.run('debt', this.vars, after); }
    else if (this.dlg.active) { const prev = this.dlg.done; this.dlg.done = r => { prev?.(r); after(); }; }
    else after();
  }
  // Leaving to the menu mid-prologue (pause > restart, or importing a save).
  abort() { if (!this.active) return; this.active = false; this.mg.stop(); this.dlg.stop(); document.body.classList.remove('prologue', 'mg'); fadeIn(); }
  skip() { if (!this.active) return; this.dlg.stop(); if (this.mg.phase === 'off') this.mg.start(); this.mg.finish(); }
  finish() {
    fadeOut(() => {
      this.active = false; this.mg.stop();
      document.body.classList.remove('prologue', 'mg');
      this.onDone?.();
      setTimeout(fadeIn, 120);
    });
  }
  update(dt, paused) {
    if (!this.active) return;
    this.dlg.setPaused(paused);
    if (paused) return;
    this.barkCool -= dt;
    if (this.debtQueued && !this.debtDone && this.mg.phase === 'fight') {
      this.debtAt -= dt;
      if (this.debtAt <= 0 && !this.dlg.active) { this.debtDone = true; this.dlg.run('debt', this.vars, null); }
    }
    this.mg.update(dt);
    this.mg.draw();
    this.dlg.update(dt);
    this.lounge.update(dt, this.dlg.active && this.dlg.line?.who === 'manu');
  }
}
function fadeOut(then) { const f = $('fade'); f.style.opacity = '1'; setTimeout(then, 700); }
function fadeIn() { const f = $('fade'); f.style.opacity = '0'; }
