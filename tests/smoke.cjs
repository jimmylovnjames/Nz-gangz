// Browser smoke test: boots the game in headless Chromium (software WebGL) and plays through the
// core loop. Run: node tests/smoke.cjs [url]   (default serves ./index.html on a local port)
// Uses ?gfx=low so software rendering stays fast; a real GPU is still needed to judge performance.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const root = path.join(__dirname, '..');
function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const f = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
      if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
    }).listen(0, () => resolve(srv));
  });
}
const args = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
let failures = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); if (!ok) failures++; };

async function boot(browser, url, ctxOpts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 450 }, ...ctxOpts });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
  await page.goto(url);
  await page.waitForFunction(() => document.documentElement.dataset.engine === 'ready' || window.__auOfflineWebGL, null, { timeout: 300000 });
  return { ctx, page, errors };
}
const state = page => page.evaluate(() => window.__auGame.state());
// Software rendering can take over a second per frame, so hold the key until the player has moved.
async function holdUntil(page, key, predicate, arg) {
  await page.keyboard.down(key);
  try { await page.waitForFunction(predicate, arg, { timeout: 30000, polling: 100 }); } catch (_) { }
  await page.keyboard.up(key);
}
// Taps through dialogue lines until the predicate holds (choices stop the dialogue until chosen).
async function advanceUntil(page, predicate, tries = 40) {
  for (let i = 0; i < tries; i++) {
    if (await page.evaluate(predicate)) return true;
    await page.evaluate(() => { window.__auStory.advance(); window.__auStory.advance(); });
    await page.waitForTimeout(250);
  }
  return page.evaluate(predicate);
}
// Strikes land when the fist does (a few frames after the tap), so tap and wait for the move to finish.
async function strike(page) {
  await page.evaluate(() => window.__auGame.hit());
  await page.waitForFunction(() => !window.__auGame.fight().busy, null, { timeout: 30000, polling: 100 }).catch(() => { });
}
async function walkTo(page, x, z) { await page.evaluate(([x, z]) => window.__auGame.teleport(x, z), [x, z]); await page.waitForTimeout(400); }

(async () => {
  const srv = process.argv[2] ? null : await serve();
  const base = process.argv[2] || `http://localhost:${srv.address().port}/index.html`;
  const url = base + (base.includes('?') ? '&' : '?') + 'gfx=low';
  const browser = await chromium.launch({ args });

  // ---- desktop session --------------------------------------------------------------------
  const { ctx, page, errors } = await boot(browser, url);
  check('Three.js engine boots (not the offline fallback)', await page.evaluate(() => document.documentElement.dataset.engine) === 'ready');
  check('controls are hidden while the menu is open', await page.evaluate(() => getComputedStyle(document.getElementById('joystick')).display) === 'none');
  await page.evaluate(() => localStorage.removeItem('aotearoa-underworld-v2'));
  await page.click('#start');
  await page.waitForTimeout(800);
  check('NEW GAME opens the prologue on Manu\'s couch', await page.evaluate(() => window.__auStory.prologue && window.__auGame.state().stage === 'prologue'));
  // Prologue: talk through the intro, the match starts on the TV.
  await advanceUntil(page, () => window.__auStory.minigame.phase !== 'off');
  check('the Kiwi Knuckle Kings match starts after the intro chat', await page.evaluate(() => window.__auStory.minigame.phase) !== 'off');
  await page.evaluate(() => { const m = window.__auStory.minigame; m.phase = 'fight'; m.phaseT = 0; m.p1.x = 120; m.p2.x = 140; });
  for (let i = 0; i < 40 && (await page.evaluate(() => window.__auStory.minigame.p2.hp)) === 100; i++) {
    await page.keyboard.press('KeyJ'); await page.evaluate(() => { const m = window.__auStory.minigame; m.p1.x = m.p2.x - 20; }); await page.waitForTimeout(150);
  }
  check('punching in the mini-game hurts Manu\'s fighter', await page.evaluate(() => window.__auStory.minigame.p2.hp) < 100, JSON.stringify(await page.evaluate(() => window.__auStory.minigame.state())));
  await page.evaluate(() => window.__auStory.skip());
  await advanceUntil(page, () => !!(window.__auStory.line && window.__auStory.line.choice));
  check('after the match Manu raises the debt and offers a choice', await page.evaluate(() => !!(window.__auStory.line && window.__auStory.line.choice)));
  await page.evaluate(() => window.__auStory.choose(1));
  await advanceUntil(page, () => !!(window.__auStory.line && window.__auStory.line.choice));
  await page.evaluate(() => window.__auStory.choose(0));
  await advanceUntil(page, () => !window.__auStory.prologue, 60);
  await page.waitForTimeout(1500);
  check('offering to collect sends you onto the street', (await state(page)).stage === 'debt-find', (await state(page)).objective);
  // Movement checks on the open carriageway of Roscommon Road (Clendon), clear of fences and parked cars.
  await walkTo(page, -1214, 235);
  let s0 = await state(page);
  await page.evaluate(() => window.__auGame.face(0));
  await page.waitForTimeout(300);
  s0 = await state(page);
  await holdUntil(page, 'KeyW', z0 => window.__auGame.state().z < z0 - 0.2, s0.z);
  let s1 = await state(page);
  check('W moves the player forward (-z at yaw 0)', s1.z < s0.z - 0.2 && Number.isFinite(s1.x), `z ${s0.z.toFixed(2)} -> ${s1.z.toFixed(2)}`);
  await page.evaluate(() => window.__auGame.face(Math.PI / 2));
  await page.waitForFunction(() => window.__auGame.feel().vel < 0.05, null, { timeout: 20000 }).catch(() => { }); // let momentum settle
  s0 = await state(page);
  await holdUntil(page, 'KeyW', x0 => window.__auGame.state().x < x0 - 0.2, s0.x);
  s1 = await state(page);
  check('after turning 90° left, W moves toward -x (forward follows the view)', s1.x < s0.x - 0.2 && Math.abs(s1.z - s0.z) < 0.3, `x ${s0.x.toFixed(2)} -> ${s1.x.toFixed(2)}`);
  // Debt: find Darren, go hard, win the scrap, bring the money back.
  let T = await page.evaluate(() => window.__auGame.targets());
  await walkTo(page, T.darren.x + 2.2, T.darren.z);
  await page.evaluate(() => window.__auGame.face(Math.atan2(2.2, 0)));
  const way = await page.evaluate(() => document.getElementById('waypoint').textContent);
  await page.evaluate(() => window.__auGame.talk());
  await advanceUntil(page, () => !!(window.__auStory.line && window.__auStory.line.choice));
  await page.evaluate(() => window.__auStory.choose(0));
  await advanceUntil(page, () => !!(window.__auStory.line && window.__auStory.line.choice));
  await page.evaluate(() => window.__auStory.choose(1));
  await advanceUntil(page, () => !window.__auStory.active);
  check('telling Darren "the whole four hundred" starts a scrap', (await state(page)).stage === 'debt-fight');
  for (let k = 0; k < 18 && (await state(page)).stage === 'debt-fight' && !(await page.evaluate(() => window.__auStory.active)); k++) {
    const d = (await page.evaluate(() => window.__auGame.targets())).darren;
    await page.evaluate(([x, z]) => { const g = window.__auGame; g.teleport(x + 2.2, z); g.face(Math.atan2(2.2, 0)); g.setHp(100); }, [d.x, d.z]);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await strike(page);
  }
  await page.waitForFunction(() => window.__auStory.active, null, { timeout: 30000 }).catch(() => { });
  await advanceUntil(page, () => !window.__auStory.active);
  check('knocking Darren down gets the full $400', (await state(page)).stage === 'debt-return' && (await state(page)).objective.includes('$400'), (await state(page)).objective);
  T = await page.evaluate(() => window.__auGame.targets());
  await walkTo(page, T.manu.x + 1.5, T.manu.z); await page.evaluate(() => window.__auGame.talk());
  await advanceUntil(page, () => !!(window.__auStory.line && window.__auStory.line.choice));
  await page.evaluate(() => window.__auStory.choose(0));
  await advanceUntil(page, () => !window.__auStory.active);
  const afterManu = await state(page);
  check('Manu pays a cut and offers your number to Shorty', afterManu.stage === 'shorty-wait' && afterManu.cash === 100, `stage ${afterManu.stage} cash ${afterManu.cash}`);
  // Shorty's chapter: the text, the meeting, three jobs, the payout.
  await page.waitForFunction(() => window.__auGame.state().stage === 'shorty-meet', null, { timeout: 120000 }).catch(() => { });
  check('Shorty texts you and the meeting is set', (await state(page)).stage === 'shorty-meet' && await page.evaluate(() => window.__auStory.phone.log.some(m => m.from === 'shorty')), (await state(page)).objective);
  T = await page.evaluate(() => window.__auGame.targets());
  await walkTo(page, T.shorty.x + 1.5, T.shorty.z); await page.evaluate(() => window.__auGame.talk());
  await advanceUntil(page, () => !!(window.__auStory.line && window.__auStory.line.choice));
  await page.evaluate(() => window.__auStory.choose(0));
  await advanceUntil(page, () => !window.__auStory.active);
  check('Shorty hands out three jobs', (await state(page)).stage === 'shorty-jobs' && await page.evaluate(() => window.__auStory.phone.jobs.length === 3));
  // Kev: talk, refuse, scrap.
  T = await page.evaluate(() => window.__auGame.targets());
  await walkTo(page, T.kev.x + 2.2, T.kev.z); await page.evaluate(() => window.__auGame.talk());
  for (let c = 0; c < 2; c++) { await advanceUntil(page, () => !!(window.__auStory.line && window.__auStory.line.choice)); await page.evaluate(() => window.__auStory.choose(0)); }
  await advanceUntil(page, () => !window.__auStory.active);
  check('Kev refuses and squares up', (await page.evaluate(() => window.__auGame.jobs())).kev === 'fight');
  for (let k = 0; k < 22 && (await page.evaluate(() => window.__auGame.jobs())).kev === 'fight' && !(await page.evaluate(() => window.__auStory.active)); k++) {
    const d = (await page.evaluate(() => window.__auGame.targets())).kev;
    await page.evaluate(([x, z]) => { const g = window.__auGame; g.teleport(x + 2.2, z); g.face(Math.atan2(2.2, 0)); g.setHp(100); }, [d.x, d.z]);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await strike(page);
  }
  await page.waitForFunction(() => window.__auStory.active, null, { timeout: 30000 }).catch(() => { });
  await advanceUntil(page, () => !window.__auStory.active);
  check('knocking Kev down collects $600', (await page.evaluate(() => window.__auGame.jobs())).kev === 'paid');
  // Mikey: runs when you get close, caught when you reach him.
  T = await page.evaluate(() => window.__auGame.targets());
  await walkTo(page, T.mikey.x + 8, T.mikey.z);
  await page.waitForFunction(m0 => { const m = window.__auGame.targets().mikey; return Math.hypot(m.x - m0.x, m.z - m0.z) > 1; }, T.mikey, { timeout: 60000 }).catch(() => { });
  const m1 = (await page.evaluate(() => window.__auGame.targets())).mikey;
  check('Mikey bolts when you get close', Math.hypot(m1.x - T.mikey.x, m1.z - T.mikey.z) > 1, `moved ${Math.hypot(m1.x - T.mikey.x, m1.z - T.mikey.z).toFixed(1)}m`);
  for (let k = 0; k < 10 && !(await page.evaluate(() => window.__auStory.active)); k++) {
    const m = (await page.evaluate(() => window.__auGame.targets())).mikey;
    await page.evaluate(([x, z]) => window.__auGame.teleport(x + 1.0, z), [m.x, m.z]);
    await page.waitForTimeout(400);
  }
  await advanceUntil(page, () => !window.__auStory.active);
  check('catching Mikey collects $300', (await page.evaluate(() => window.__auGame.jobs())).mikey === 'paid');
  // Uncle Pita: let him off (you can't cover $150 with $100, so Shorty docks your cut).
  T = await page.evaluate(() => window.__auGame.targets());
  await walkTo(page, T.pita.x + 1.5, T.pita.z); await page.evaluate(() => window.__auGame.talk());
  await advanceUntil(page, () => !!(window.__auStory.line && window.__auStory.line.choice));
  await page.evaluate(() => window.__auStory.choose(1));
  await advanceUntil(page, () => !window.__auStory.active);
  check('letting Uncle Pita off is recorded', (await page.evaluate(() => window.__auGame.jobs())).pita === 'short');
  check('all three done sends you back to Shorty', (await state(page)).stage === 'shorty-return', (await state(page)).objective);
  T = await page.evaluate(() => window.__auGame.targets());
  await walkTo(page, T.shorty.x + 1.5, T.shorty.z); await page.evaluate(() => window.__auGame.talk());
  await advanceUntil(page, () => !window.__auStory.active);
  const afterShorty = await state(page);
  check('Shorty pays a quarter minus Pita\'s $150 and opens the crews', afterShorty.stage === 'recruit' && afterShorty.cash === 175, `stage ${afterShorty.stage} cash ${afterShorty.cash}`);
  // Crew chapter (unchanged from Run 11).
  T = await page.evaluate(() => window.__auGame.targets());
  const c0 = T.contacts[0];
  await walkTo(page, c0.x + 1.2, c0.z); await page.evaluate(() => window.__auGame.talk());
  check('a crew contact accepts you', (await state(page)).stage === 'faction-choice', (await state(page)).chosen);
  await page.evaluate(() => window.__auGame.talk());
  check('initiation choice dialog opens', await page.evaluate(() => getComputedStyle(document.getElementById('choicePanel')).display) === 'flex');
  await page.click('#routeBrawl');
  check('loud route starts the brawl', (await state(page)).stage === 'mission-brawl');
  for (let n = 0; n < 3; n++) {
    const enemies = (await page.evaluate(() => window.__auGame.targets())).enemies;
    const s = await state(page);
    const e = enemies.filter(e => e.alive).sort((a, b) => Math.hypot(a.x - s.x, a.z - s.z) - Math.hypot(b.x - s.x, b.z - s.z))[0];
    for (let k = 0; k < 14; k++) {
      const cur = (await page.evaluate(() => window.__auGame.targets())).enemies.find(q => Math.abs(q.x - e.x) < 6 && Math.abs(q.z - e.z) < 6) || e;
      if (!cur.alive) break;
      await page.evaluate(([ex, ez]) => { const g = window.__auGame; g.teleport(ex + 2.2, ez); g.face(Math.atan2(2.2, 0)); g.setHp(100); }, [cur.x, cur.z]);
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      await strike(page);
    }
  }
  check('three knockouts complete the brawl', (await state(page)).stage === 'mission-return', JSON.stringify(await state(page)));
  T = await page.evaluate(() => window.__auGame.targets());
  await walkTo(page, T.fixer.x, T.fixer.z + 2.5); await page.evaluate(() => window.__auGame.talk());
  const done = await state(page);
  check('chapter completes', done.stage === 'complete', `cash ${done.cash} rep ${done.rep}`);
  // Run 17 mechanics: shops, driving, hustles.
  const shopsList = await page.evaluate(() => window.__auGame.shopsList());
  const food = shopsList.find(sh => ['dairy', 'takeaway', 'bakery'].includes(sh.kind));
  check('real shops are interactive', shopsList.length > 10 && !!food, `${shopsList.length} shops, e.g. ${food && food.name}`);
  await page.evaluate(([x, z]) => { const g = window.__auGame; g.teleport(x, z); g.setHp(40); g.setCash(100); }, [food.x, food.z]);
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__auGame.talk());
  await page.waitForTimeout(300);
  check('TALK at a shop opens its menu', await page.evaluate(() => getComputedStyle(document.getElementById('shopPanel')).display) === 'flex');
  await page.evaluate(() => window.__auGame.buy(0));
  const fed = await state(page);
  check('buying food heals and costs money', fed.hp >= 60 && fed.cash < 100, `hp ${Math.round(fed.hp)} cash ${fed.cash}`);
  await page.evaluate(() => window.__auGame.closeShop());
  const car = await page.evaluate(() => window.__auGame.nearestCar());
  await page.evaluate(([x, z]) => window.__auGame.teleport(x + 2.2, z), [car.x, car.z]);
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__auGame.talk());
  const inCar = await page.evaluate(() => window.__auGame.drive());
  check('TALK next to a parked car gets you in', !!inCar);
  let moved = 0;
  for (const key of ['KeyW', 'KeyS']) {
    await holdUntil(page, key, ([x0, z0]) => { const d = window.__auGame.drive(); return d && Math.hypot(d.x - x0, d.z - z0) > 0.6; }, [inCar.x, inCar.z]);
    const d = await page.evaluate(() => window.__auGame.drive()); moved = Math.max(moved, Math.hypot(d.x - inCar.x, d.z - inCar.z)); if (moved > 0.6) break;
  }
  check('the car drives', moved > 0.6, `moved ${moved.toFixed(2)}m`);
  await page.evaluate(() => window.__auGame.talk());
  check('TALK gets you back out', !(await page.evaluate(() => window.__auGame.drive())));
  check('traffic is on the roads', (await page.evaluate(() => window.__auGame.traffic())) > 0);
  for (const [type, pick, label] of [['pays', 0, 'a paying hustle'], ['fights', 0, 'a fighting hustle']]) {
    const cash0 = (await state(page)).cash;
    await page.evaluate(t => window.__auGame.startHustle(t), type);
    const hz = await page.evaluate(() => window.__auGame.hustle());
    await page.evaluate(([x, z]) => { const g = window.__auGame; g.teleport(x + 1.5, z); g.face(Math.atan2(1.5, 0)); }, [hz.x, hz.z]);
    await page.waitForTimeout(300);
    await page.evaluate(() => window.__auGame.talk());
    await advanceUntil(page, () => !!(window.__auStory.line && window.__auStory.line.choice));
    await page.evaluate(i => window.__auStory.choose(i), pick);
    await advanceUntil(page, () => !window.__auStory.active);
    for (let k = 0; k < 30 && (await page.evaluate(() => window.__auGame.hustle().state)) === 'fight'; k++) {
      const d = await page.evaluate(() => window.__auGame.hustle());
      await page.evaluate(([x, z]) => { const g = window.__auGame; g.teleport(x + 2.2, z); g.face(Math.atan2(2.2, 0)); g.setHp(100); }, [d.x, d.z]);
      await page.waitForTimeout(350);
      await strike(page);
    }
    await page.waitForFunction(() => window.__auStory.active || window.__auGame.hustle().state === 'done', null, { timeout: 30000 }).catch(() => { });
    await advanceUntil(page, () => !window.__auStory.active);
    const after = await state(page), h2 = await page.evaluate(() => window.__auGame.hustle());
    check(`${label} pays Shorty's cut`, h2.state === 'done' && after.cash === cash0 + Math.round(hz.amount * 0.25), `${hz.name} $${hz.amount}: cash ${cash0} -> ${after.cash}`);
  }
  // Run 18: pedestrians, police heat and a bust, then Chapter One end to end.
  await page.waitForFunction(() => window.__auGame.peds() > 0, null, { timeout: 90000 }).catch(() => { });
  check('people walk the footpaths', (await page.evaluate(() => window.__auGame.peds())) > 0);
  const cashBefore = (await state(page)).cash;
  await page.evaluate(() => window.__auGame.addHeat(2));
  await page.waitForFunction(() => window.__auGame.police().length > 0, null, { timeout: 60000 }).catch(() => { });
  check('heat brings police cars', (await page.evaluate(() => window.__auGame.police().length)) > 0);
  for (let k = 0; k < 60 && (await page.evaluate(() => window.__auGame.heat())) > 0; k++) {
    const cop = (await page.evaluate(() => window.__auGame.police()))[0]; if (!cop) break;
    await page.evaluate(([x, z]) => window.__auGame.teleport(x + 3, z), [cop.x, cop.z]);
    await page.waitForTimeout(800);
  }
  const bustedState = await state(page);
  check('the cops catch you: fine and a night at Manurewa station', bustedState.cash < cashBefore && (await page.evaluate(() => window.__auGame.heat())) === 0, `cash ${cashBefore} -> ${bustedState.cash}`);
  // Chapter One.
  await page.evaluate(() => window.__auGame.skipTimers());
  await page.waitForFunction(() => window.__auGame.state().stage === 'c1-car', null, { timeout: 90000 }).catch(() => { });
  check('Tipene texts the first Chapter One job', (await state(page)).stage === 'c1-car', (await state(page)).objective);
  let C1 = await page.evaluate(() => window.__auGame.c1());
  const carNearManu = await page.evaluate(([x, z]) => { window.__auGame.teleport(x, z); return window.__auGame.nearestCar(); }, [C1.home.x, C1.home.z]);
  await page.evaluate(([x, z]) => { window.__auGame.teleport(x + 2.2, z); window.__auGame.talk(); }, [carNearManu.x, carNearManu.z]);
  const T2 = await page.evaluate(() => window.__auGame.targets());
  await page.evaluate(([x, z]) => window.__auGame.carTo(x + 4, z), [T2.manu.x, T2.manu.z]);
  await page.waitForFunction(() => window.__auGame.state().stage === 'c1-pickup', null, { timeout: 30000 }).catch(() => { });
  check('driving up to Manu picks him up', (await state(page)).stage === 'c1-pickup' && (await page.evaluate(() => window.__auGame.c1().manuInCar)));
  C1 = await page.evaluate(() => window.__auGame.c1());
  await page.evaluate(([x, z]) => { const g = window.__auGame; g.carTo(x + 6, z); g.talk(); g.teleport(x + 1.5, z); g.clearHeat(); }, [C1.rawiri.x, C1.rawiri.z]);
  await page.waitForTimeout(300); await page.evaluate(() => window.__auGame.talk());
  await advanceUntil(page, () => !window.__auStory.active);
  check('Rawiri hands over the parcel', (await state(page)).stage === 'c1-deliver');
  const T3 = await page.evaluate(() => window.__auGame.targets());
  await page.evaluate(([x, z]) => { const g = window.__auGame; g.clearHeat(); g.teleport(x, z + 2.5); g.talk(); }, [T3.fixer.x, T3.fixer.z]);
  await advanceUntil(page, () => !window.__auStory.active);
  check('Tipene takes the parcel and sends you to Aunty Lani', (await state(page)).stage === 'c1-dairy');
  C1 = await page.evaluate(() => window.__auGame.c1());
  await page.evaluate(([x, z]) => { const g = window.__auGame; g.teleport(x + 1.5, z); g.talk(); }, [C1.lani.x, C1.lani.z]);
  await advanceUntil(page, () => !window.__auStory.active);
  check('Aunty Lani points you at the rival crew', (await state(page)).stage === 'c1-rivals');
  C1 = await page.evaluate(() => window.__auGame.c1());
  await page.evaluate(([x, z]) => { const g = window.__auGame; g.teleport(x + 1.5, z); g.talk(); }, [C1.rivals[0].x, C1.rivals[0].z]);
  await advanceUntil(page, () => !!(window.__auStory.line && window.__auStory.line.choice));
  await page.evaluate(() => window.__auStory.choose(1));
  await advanceUntil(page, () => !window.__auStory.active);
  await page.waitForFunction(() => window.__auGame.feel().bars > 0, null, { timeout: 20000 }).catch(() => { });
  check('health bars show over the people you fight', (await page.evaluate(() => window.__auGame.feel().bars)) > 0);
  const brawl = async () => {
    for (let k = 0; k < 40; k++) {
      const alive = (await page.evaluate(() => window.__auGame.c1().rivals)).filter(r => r.alive);
      if (!alive.length) break;
      await page.evaluate(([x, z]) => { const g = window.__auGame; g.teleport(x + 2.2, z); g.face(Math.atan2(2.2, 0)); g.setHp(100); }, [alive[0].x, alive[0].z]);
      await page.waitForTimeout(350); await strike(page);
    }
  };
  await brawl();
  await page.waitForFunction(() => window.__auGame.state().stage === 'c1-wait', null, { timeout: 20000 }).catch(() => { });
  check('beating the rival boys clears the dairy', (await state(page)).stage === 'c1-wait', JSON.stringify({ s: await state(page), f: await page.evaluate(() => window.__auGame.fight()), r: (await page.evaluate(() => window.__auGame.c1())).rivals.slice(0, 3), heat: await page.evaluate(() => window.__auGame.heat()), story: await page.evaluate(() => window.__auStory.active), car: await page.evaluate(() => window.__auGame.drive()) }));
  await page.evaluate(() => window.__auGame.skipTimers());
  await page.waitForFunction(() => window.__auGame.state().stage === 'c1-manu', null, { timeout: 90000 }).catch(() => { });
  check('Manu texts that he got jumped at the station', (await state(page)).stage === 'c1-manu');
  await brawl();
  const T4 = await page.evaluate(() => window.__auGame.targets());
  await page.evaluate(([x, z]) => { const g = window.__auGame; g.teleport(x + 1.5, z); g.talk(); }, [T4.manu.x, T4.manu.z]);
  await advanceUntil(page, () => !window.__auStory.active);
  check('you pick Manu up off the ground', (await state(page)).stage === 'c1-home');
  const car2 = await page.evaluate(() => window.__auGame.nearestCar());
  await page.evaluate(([x, z]) => { window.__auGame.teleport(x + 2.2, z); window.__auGame.talk(); }, [car2.x, car2.z]);
  await page.evaluate(([x, z]) => window.__auGame.carTo(x + 4, z), [T4.manu.x, T4.manu.z]);
  await page.waitForFunction(() => window.__auGame.c1().manuInCar, null, { timeout: 30000 }).catch(() => { });
  C1 = await page.evaluate(() => window.__auGame.c1());
  await page.evaluate(([x, z]) => window.__auGame.carTo(x + 5, z), [C1.home.x, C1.home.z]);
  await page.waitForFunction(() => window.__auStory.active || window.__auGame.state().stage === 'c1-done', null, { timeout: 30000 }).catch(() => { });
  await advanceUntil(page, () => !window.__auStory.active);
  check('driving Manu home completes Chapter One', (await state(page)).stage === 'c1-done', (await state(page)).objective);
  if (await page.evaluate(() => !!window.__auGame.drive())) await page.evaluate(() => window.__auGame.talk());
  // Run 19: third-person view, objective beacon.
  await page.evaluate(() => window.__auGame.view(true));
  await page.waitForTimeout(1500);
  const boom = await page.evaluate(() => { const c = window.__auDebug.camera.position, s = window.__auGame.state(); return Math.hypot(c.x - s.x, c.z - s.z); });
  check('third-person view puts the camera behind you', boom > 1.2, `camera ${boom.toFixed(2)}m back`);
  await page.evaluate(() => window.__auGame.view(false));
  await page.waitForTimeout(800);
  check('first-person view puts it back at your eyes', (await page.evaluate(() => { const c = window.__auDebug.camera.position, s = window.__auGame.state(); return Math.hypot(c.x - s.x, c.z - s.z); })) < 0.3);
  await page.evaluate(() => window.__auGame.startHustle('pays'));
  await page.waitForFunction(() => window.__auGame.feel().beacon, null, { timeout: 20000 }).catch(() => { });
  check('a light beacon marks the objective', await page.evaluate(() => window.__auGame.feel().beacon));
  // Run 20: jump, climb a fence, grab and throw, weapons, car damage.
  await page.evaluate(() => { window.__auGame.teleport(-1214, 235); window.__auGame.clearHeat(); });
  await page.waitForTimeout(500);
  const y0 = await page.evaluate(() => window.__auGame.y());
  const j = await page.evaluate(() => window.__auGame.jumpTest());
  await page.waitForFunction(y0 => window.__auGame.y() > y0 + 0.15, y0, { timeout: 20000 }).catch(() => { });
  check('JUMP leaves the ground', j.air && (await page.evaluate(() => window.__auGame.y())) > y0 + 0.15);
  await page.waitForFunction(() => !window.__auGame.airborne(), null, { timeout: 30000 }).catch(() => { });
  const fence = await page.evaluate(() => { const g = window.__auGame; const f0 = g.nearFence(); return f0; });
  if (fence) {
    const mx = (fence.ax + fence.bx) / 2, mz = (fence.az + fence.bz) / 2, L = Math.hypot(fence.bx - fence.ax, fence.bz - fence.az), nx = -(fence.bz - fence.az) / L, nz = (fence.bx - fence.ax) / L;
    let start = null;
    for (const sgn of [1, -1]) { const sx = mx + nx * 0.75 * sgn, sz = mz + nz * 0.75 * sgn; if (!(await page.evaluate(([x, z]) => window.__auGame.collides(x, z, 0.5), [sx, sz]))) { start = [sx, sz, sgn]; break; } }
    if (start) {
      await page.evaluate(([x, z, fx, fz]) => { const g = window.__auGame; g.teleport(x, z); g.face(Math.atan2(-(fx - x), -(fz - z))); }, [start[0], start[1], mx, mz]);
      await page.waitForTimeout(400);
      const c = await page.evaluate(() => window.__auGame.jumpTest());
      await page.waitForFunction(() => !window.__auGame.airborne(), null, { timeout: 40000 }).catch(() => { });
      const st2 = await state(page), side = (st2.x - mx) * nx + (st2.z - mz) * nz;
      check('JUMP at a fence climbs over it', c.climb && Math.sign(side) === -start[2], `fence ${fence.top.toFixed(1)}m, side ${side.toFixed(2)}`);
    } else check('JUMP at a fence climbs over it', false, 'no clear spot beside the fence');
  } else check('JUMP at a fence climbs over it', false, 'no fence found');
  await page.evaluate(() => window.__auGame.startHustle('fights'));
  let H = await page.evaluate(() => window.__auGame.hustle());
  await page.evaluate(([x, z]) => { const g = window.__auGame; g.teleport(x + 1.5, z); g.face(Math.atan2(1.5, 0)); g.talk(); }, [H.x, H.z]);
  await advanceUntil(page, () => !!(window.__auStory.line && window.__auStory.line.choice));
  await page.evaluate(() => window.__auStory.choose(0));
  await advanceUntil(page, () => !window.__auStory.active);
  H = await page.evaluate(() => window.__auGame.hustle());
  await page.evaluate(([x, z]) => { const g = window.__auGame; g.teleport(x + 1.2, z); g.face(Math.atan2(1.2, 0)); g.setHp(100); g.talk(); }, [H.x, H.z]);
  check('TALK next to someone you are fighting grabs them', await page.evaluate(() => window.__auGame.grabbed()));
  await page.waitForTimeout(350); await page.evaluate(() => window.__auGame.hit());
  await page.waitForTimeout(350); await page.evaluate(() => window.__auGame.talk());
  check('TALK again throws them', !(await page.evaluate(() => window.__auGame.grabbed())));
  // Run 21: the combo string (away from anyone) and the parry (in a fresh hustle fight).
  await page.waitForFunction(() => !window.__auGame.fight().busy, null, { timeout: 30000 }).catch(() => { });
  { const P0 = await state(page); await page.evaluate(([x, z]) => window.__auGame.teleport(x + 60, z + 60), [P0.x, P0.z]); }
  await page.waitForTimeout(1500);
  const seq = [];
  for (let i = 0; i < 4; i++) { await page.evaluate(() => window.__auGame.hit()); seq.push(await page.evaluate(() => window.__auGame.fight().move)); await page.waitForFunction(() => !window.__auGame.fight().busy, null, { timeout: 30000, polling: 'raf' }).catch(() => { }); }
  check('HIT strings jab, cross, hook, uppercut', seq.join() === 'jab,cross,hook,upper', seq.join());
  await page.waitForFunction(() => !window.__auStory.active, null, { timeout: 30000 }).catch(() => { });
  await advanceUntil(page, () => !window.__auStory.active);
  H = await page.evaluate(() => window.__auGame.hustle());
  if (!H || H.state !== 'fight') {
    await page.evaluate(() => window.__auGame.startHustle('fights'));
    H = await page.evaluate(() => window.__auGame.hustle());
    await page.evaluate(([x, z]) => { const g = window.__auGame; g.teleport(x + 1.5, z); g.face(Math.atan2(1.5, 0)); g.talk(); }, [H.x, H.z]);
    await advanceUntil(page, () => !!(window.__auStory.line && window.__auStory.line.choice));
    await page.evaluate(() => window.__auStory.choose(0));
    await advanceUntil(page, () => !window.__auStory.active);
    H = await page.evaluate(() => window.__auGame.hustle());
  }
  let parried = false;
  for (let a = 0; a < 4 && !parried && H && H.state === 'fight'; a++) {
    await page.evaluate(([x, z]) => { const g = window.__auGame; g.teleport(x + 1.4, z); g.face(Math.atan2(1.4, 0)); g.setHp(100); }, [H.x, H.z]);
    const wound = await page.waitForFunction(() => window.__auGame.fight().windups.some(w => w > 0 && w < 0.2), null, { timeout: 90000, polling: 'raf' }).then(() => true).catch(() => false);
    if (wound) {
      await page.evaluate(() => window.__auGame.block(true));
      await page.waitForFunction(() => window.__auGame.fight().pop === 'PARRY' || !window.__auGame.fight().windups.some(w => w > 0), null, { timeout: 30000, polling: 'raf' }).catch(() => { });
      await page.evaluate(() => window.__auGame.block(false));
      parried = (await page.evaluate(() => window.__auGame.fight().pop)) === 'PARRY';
    }
    H = await page.evaluate(() => window.__auGame.hustle());
  }
  check('BLOCK timed to their punch parries it', parried, JSON.stringify(await page.evaluate(() => window.__auGame.fight())) + ' ' + JSON.stringify(H));
  const pk = (await page.evaluate(() => window.__auGame.pickups()))[0];
  await page.evaluate(([x, z]) => { const g = window.__auGame; g.teleport(x + 0.6, z); }, [pk.x, pk.z]);
  await page.waitForTimeout(300);
  for (let i = 0; i < 3 && !(await page.evaluate(() => window.__auGame.weapon())); i++) { await page.evaluate(() => window.__auGame.talk()); await page.waitForTimeout(200); }
  check('bats and pipes can be picked up', !!(await page.evaluate(() => window.__auGame.weapon())), pk.kind);
  await page.evaluate(() => window.__auGame.talk());
  const carW = await page.evaluate(() => window.__auGame.nearestCar());
  await page.evaluate(([x, z]) => { window.__auGame.teleport(x + 2.2, z); window.__auGame.talk(); }, [carW.x, carW.z]);
  check('cars have health', (await page.evaluate(() => window.__auGame.carHealth())) === 100);
  if (await page.evaluate(() => !!window.__auGame.drive())) await page.evaluate(() => window.__auGame.talk());
  await page.click('#pauseButton'); await page.click('#saveNow');
  for (const sel of ['[data-time="night"]', '[data-rain="2"]', '[data-gfx="medium"]', '[data-time="golden"]', '[data-gfx="low"]']) { await page.click(sel); await page.waitForTimeout(400); }
  check('graphics settings switch without errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  // Reload and continue.
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.engine === 'ready', null, { timeout: 300000 });
  check('continue button offered after reload', await page.evaluate(() => getComputedStyle(document.getElementById('continue')).display) !== 'none');
  await page.click('#continue');
  check('saved chapter restores', (await state(page)).stage === 'c1-done');
  // A Run 11 save with a real gang name loads under the renamed fictional crew.
  // Back to the menu first: an active session saves itself when the page hides on reload.
  await page.click('#pauseButton'); await page.click('#restart');
  await page.evaluate(() => localStorage.setItem('aotearoa-underworld-v2', JSON.stringify({ version: 2, stage: 'mission-courier', hometown: 'Kaikohe', originRegion: 'Northland', chosen: 'Mongrel Mob', rep: 25, hp: 100, cash: 40, defeated: 0, missionRoute: 'courier', stamina: 100, x: 0, z: 8, yaw: 0, pitch: 0 })));
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.engine === 'ready', null, { timeout: 300000 });
  const realNames = ['Black Power', 'Mongrel', 'Tribesmen', 'Head Hunters', 'Killer Beez', 'King Cobras', 'Comancheros', 'Bandidos', 'Hells Angels', 'Mongols', 'Rebels MC', 'Highway 61', 'Nomads', 'Immortal Souls'];
  const menuText = await page.evaluate(() => document.body.innerText);
  check('menu shows only fictional crew names', !realNames.some(n => menuText.includes(n)), realNames.filter(n => menuText.includes(n)).join(', '));
  await page.click('#continue');
  check('Run 11 save keeps its crew under the new name', (await state(page)).chosen === 'Stray Dogs', (await state(page)).chosen);
  await page.click('#pauseButton'); await page.click('#restart');
  await page.evaluate(() => localStorage.setItem('aotearoa-underworld-v2', JSON.stringify({ version: 2, stage: 'origin-recover', hometown: 'Kaikohe', originRegion: 'Northland', chosen: 'Independent', rep: 0, hp: 100, cash: 0, defeated: 0, missionRoute: '', stamina: 100, x: 0, z: 8, yaw: 0, pitch: 0 })));
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.engine === 'ready', null, { timeout: 300000 });
  await page.click('#continue');
  check('Run 11 save mid-errand continues as the Darren job', (await state(page)).stage === 'debt-find', (await state(page)).stage);
  check('no page errors in desktop session', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();

  // ---- phone session (touch joystick) ---------------------------------------------------------
  const phone = await boot(browser, url, { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await phone.page.evaluate(() => localStorage.removeItem('aotearoa-underworld-v2'));
  await phone.page.reload();
  await phone.page.waitForFunction(() => document.documentElement.dataset.engine === 'ready', null, { timeout: 300000 });
  await phone.page.tap('#start');
  await advanceUntil(phone.page, () => window.__auStory.minigame.phase !== 'off');
  check('fight pad shows during the match on phone', await phone.page.evaluate(() => getComputedStyle(document.getElementById('mgPad')).display) !== 'none');
  check('street controls hidden in the lounge', await phone.page.evaluate(() => getComputedStyle(document.getElementById('joystick')).display) === 'none');
  await phone.page.evaluate(() => { const m = window.__auStory.minigame; m.phase = 'fight'; m.p1.x = 120; m.p2.x = 140; });
  for (let i = 0; i < 30 && (await phone.page.evaluate(() => window.__auStory.minigame.p2.hp)) === 100; i++) {
    await phone.page.tap('[data-mg="punch"]'); await phone.page.evaluate(() => { const m = window.__auStory.minigame; m.p1.x = m.p2.x - 20; }); await phone.page.waitForTimeout(150);
  }
  check('tapping PUNCH on the fight pad lands hits', await phone.page.evaluate(() => window.__auStory.minigame.p2.hp) < 100);
  await phone.page.click('#pauseButton'); await phone.page.click('#restart');
  check('restarting from pause leaves the lounge', await phone.page.evaluate(() => !window.__auStory.prologue && !document.body.classList.contains('prologue')));
  // Pausing saves the current game, so inject the street save only after leaving the prologue.
  await phone.page.evaluate(() => localStorage.setItem('aotearoa-underworld-v2', JSON.stringify({ version: 2, map: 'manurewa-1', stage: 'recruit', hometown: 'Kaikohe', originRegion: 'Northland', chosen: 'Independent', rep: 15, hp: 100, cash: 50, defeated: 0, missionRoute: '', stamina: 100, x: -1214, z: 235, yaw: 0, pitch: 0 })));
  await phone.page.reload();
  await phone.page.waitForFunction(() => document.documentElement.dataset.engine === 'ready', null, { timeout: 300000 });
  await phone.page.tap('#continue');
  await phone.page.waitForTimeout(800);
  check('joystick visible during play', await phone.page.evaluate(() => getComputedStyle(document.getElementById('joystick')).display) !== 'none');
  await phone.page.tap('#sprint');
  check('RUN toggles on with one tap', await phone.page.evaluate(() => document.getElementById('sprint').classList.contains('on')));
  await phone.page.tap('#sprint');
  const p0 = await state(phone.page);
  const box = await phone.page.locator('#joystick').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const cdp = await phone.ctx.newCDPSession(phone.page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy, id: 1 }] });
  for (let i = 0; i < 150; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx, y: cy - 45 + (i % 2), id: 1 }] });
    await phone.page.waitForTimeout(100);
    if ((await state(phone.page)).z < p0.z - 0.2) break;
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const p1 = await state(phone.page);
  check('touch joystick moves the player (street no longer stays still)', p1.z < p0.z - 0.2, `z ${p0.z.toFixed(2)} -> ${p1.z.toFixed(2)}`);
  check('no page errors in phone session', phone.errors.length === 0, phone.errors.slice(0, 3).join(' | '));
  await phone.ctx.close();

  await browser.close();
  if (srv) srv.close();
  console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
