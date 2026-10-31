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
  let s0 = await state(page);
  await holdUntil(page, 'KeyW', z0 => window.__auGame.state().z < z0 - 0.2, s0.z);
  let s1 = await state(page);
  check('W moves the player forward (-z at yaw 0)', s1.z < s0.z - 0.2 && Number.isFinite(s1.x), `z ${s0.z.toFixed(2)} -> ${s1.z.toFixed(2)}`);
  await page.evaluate(() => { window.__auGame.teleport(0, 8); window.__auGame.face(Math.PI / 2); });
  await page.waitForTimeout(300);
  s0 = await state(page);
  await holdUntil(page, 'KeyW', x0 => window.__auGame.state().x < x0 - 0.2, s0.x);
  s1 = await state(page);
  check('after turning 90° left, W moves toward -x (forward follows the view)', s1.x < s0.x - 0.2 && Math.abs(s1.z - s0.z) < 0.3, `x ${s0.x.toFixed(2)} -> ${s1.x.toFixed(2)}`);
  await page.evaluate(() => window.__auGame.face(0));

  // Mission: origin -> recruit -> brawl route -> complete.
  const T = await page.evaluate(() => window.__auGame.targets());
  await walkTo(page, T.fixer.x, T.fixer.z + 2.5); await page.evaluate(() => window.__auGame.talk());
  check('talking to the fixer starts the hometown job', (await state(page)).stage === 'origin-recover');
  await page.evaluate(() => window.__auGame.face(0));
  await page.waitForTimeout(600);
  const way = await page.evaluate(() => document.getElementById('waypoint').textContent);
  const tp = await page.evaluate(() => window.__auGame.targets());
  const st = await state(page);
  const bearing = Math.atan2(tp.pickup.x - st.x, -(tp.pickup.z - st.z));
  const expected = Math.abs(bearing) < 0.4 ? '↑' : Math.abs(bearing) > 2.7 ? '↓' : bearing > 0 ? '→' : '←';
  check('waypoint arrow points toward the objective', way.startsWith(expected), `${way} (expected ${expected})`);
  await walkTo(page, tp.pickup.x + 1.5, tp.pickup.z); await page.evaluate(() => window.__auGame.talk());
  check('recovering the hometown item', (await state(page)).stage === 'origin-return');
  await walkTo(page, T.fixer.x, T.fixer.z + 2.5); await page.evaluate(() => window.__auGame.talk());
  check('returning to the fixer unlocks recruiting', (await state(page)).stage === 'recruit');
  const c0 = T.contacts[0];
  await walkTo(page, c0.x * 0.9, c0.z * 0.9); await page.evaluate(() => window.__auGame.talk());
  check('a crew contact accepts you', (await state(page)).stage === 'faction-choice', (await state(page)).chosen);
  await page.evaluate(() => window.__auGame.talk());
  check('initiation choice dialog opens', await page.evaluate(() => getComputedStyle(document.getElementById('choicePanel')).display) === 'flex');
  await page.click('#routeBrawl');
  check('loud route starts the brawl', (await state(page)).stage === 'mission-brawl');
  for (let n = 0; n < 3; n++) {
    const enemies = (await page.evaluate(() => window.__auGame.targets())).enemies;
    const s = await state(page);
    const e = enemies.filter(e => e.alive).sort((a, b) => Math.hypot(a.x - s.x, a.z - s.z) - Math.hypot(b.x - s.x, b.z - s.z))[0];
    for (let k = 0; k < 3; k++) {
      const cur = (await page.evaluate(() => window.__auGame.targets())).enemies.find(q => Math.abs(q.x - e.x) < 6 && Math.abs(q.z - e.z) < 6) || e;
      await page.evaluate(([ex, ez]) => { const g = window.__auGame; g.teleport(ex + 2.2, ez); g.face(Math.atan2(2.2, 0)); }, [cur.x, cur.z]);
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); // camera picks up the new yaw
      await page.evaluate(() => window.__auGame.hit());
    }
  }
  check('three knockouts complete the brawl', (await state(page)).stage === 'mission-return', JSON.stringify(await state(page)));
  await walkTo(page, T.fixer.x, T.fixer.z + 2.5); await page.evaluate(() => window.__auGame.talk());
  const done = await state(page);
  check('chapter completes', done.stage === 'complete', `cash ${done.cash} rep ${done.rep}`);
  await page.click('#pauseButton'); await page.click('#saveNow');
  for (const sel of ['[data-time="night"]', '[data-rain="2"]', '[data-gfx="medium"]', '[data-time="golden"]', '[data-gfx="low"]']) { await page.click(sel); await page.waitForTimeout(400); }
  check('graphics settings switch without errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  // Reload and continue.
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.engine === 'ready', null, { timeout: 300000 });
  check('continue button offered after reload', await page.evaluate(() => getComputedStyle(document.getElementById('continue')).display) !== 'none');
  await page.click('#continue');
  check('saved chapter restores', (await state(page)).stage === 'complete');
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
  check('no page errors in desktop session', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();

  // ---- phone session (touch joystick) ---------------------------------------------------------
  const phone = await boot(browser, url, { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await phone.page.evaluate(() => localStorage.removeItem('aotearoa-underworld-v2'));
  await phone.page.reload();
  await phone.page.waitForFunction(() => document.documentElement.dataset.engine === 'ready', null, { timeout: 300000 });
  await phone.page.tap('#start');
  await phone.page.waitForTimeout(800);
  check('joystick visible during play', await phone.page.evaluate(() => getComputedStyle(document.getElementById('joystick')).display) !== 'none');
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
