// Game logic ported from Run 11 (missions, factions, saves, UI), unchanged in behaviour except bug fixes:
// movement no longer turns into NaN, forward follows the view after turning, and the waypoint/radar rotate correctly.
// Fictional crews. Order matches the colours and contact positions used since Run 1.
const FACTIONS = ['Black Tide', 'Stray Dogs', 'Clansmen', 'Bone Collectors', 'Southside Hornets', 'Royal Taipans', 'Conquistadors MC', 'Sundowners MC', 'Dark Seraphs MC', 'Iron Horde MC', 'Insurgents MC', 'Route 77', 'Southern Wanderers', 'Phantom Souls MC'];
// Saves from Run 11 and earlier store the old crew names; map them so those saves keep their crew.
const LEGACY_FACTIONS = Object.fromEntries(['Black Power', 'Mongrel Mob', 'Tribesmen', 'Head Hunters', 'Killer Beez', 'King Cobras', 'Comancheros MC', 'Bandidos MC', 'Hells Angels MC', 'Mongols MC', 'Rebels MC', 'Highway 61', 'New Zealand Nomads', 'Immortal Souls MC'].map((name, i) => [name, FACTIONS[i]]));
const migrateSave = s => { if (s && LEGACY_FACTIONS[s.chosen]) s.chosen = LEGACY_FACTIONS[s.chosen]; return s; };
const FACTION_COLORS = [0x3764d8, 0xc33737, 0x4b8e68, 0x9c8d54, 0xe4b82c, 0x7e4b99, 0x2e8692, 0xa67639, 0x9b9b9b, 0x7b4444, 0x67928b, 0xb57e50, 0x6b6a9d, 0x8d6c80];
const ORIGINS = { Northland: ['Kaikohe', 'Kaitaia', 'Whangārei', 'Opononi'], Auckland: ['South Auckland', 'West Auckland', 'Central Auckland', 'North Shore'], Waikato: ['Hamilton', 'Huntly', 'Tokoroa'], 'Bay of Plenty': ['Tauranga', 'Rotorua', 'Whakatāne'], 'East Coast': ['Gisborne', 'Wairoa'], 'Hawke’s Bay': ['Napier', 'Hastings'], 'Central North Island': ['Taupō', 'New Plymouth', 'Whanganui', 'Palmerston North'], Wellington: ['Wellington', 'Lower Hutt', 'Porirua'], 'Top of South': ['Nelson', 'Blenheim'], Canterbury: ['Christchurch', 'Ashburton', 'Timaru'], 'West Coast': ['Greymouth', 'Hokitika'], Otago: ['Dunedin', 'Queenstown', 'Wānaka'], Southland: ['Invercargill', 'Bluff'], Islands: ['Stewart Island / Rakiura', 'Chatham Islands'] };
const ORIGIN_TALES = {
  'Northland': ['A cousin in your hometown swears the missing envelope was taken by a seagull with expensive taste.', 'sealed wharf envelope', 'The harbour contact says you kept your word.'],
  'Auckland': ['An old mate has a missing pay packet and a very loud landlord.', 'pay packet', 'Your old mate finally pays the rent, and stops blaming the bus timetable.'],
  'Waikato': ['The garage owner wants a parts invoice back before the boss discovers his creative bookkeeping.', 'garage invoice', 'The garage is saved, but the boss still suspects the photocopier.'],
  'Bay of Plenty': ['A courier dropped a tour operator\'s booking ledger somewhere between two bad decisions.', 'booking ledger', 'The booking ledger returns, with an alarming number of karaoke bookings.'],
  'East Coast': ['The community radio host needs a lost interview tape before tonight\'s show.', 'interview tape', 'The interview makes air. You are thanked between two extremely long weather reports.'],
  'Hawke’s Bay': ['A fictional orchard foreman lost a delivery docket and needs it back.', 'orchard docket', 'The orchard crew get paid. Nobody mentions the forklift incident.'],
  'Central North Island': ['A roadside mechanic needs the keys to a stranded ute recovered.', 'ute keys', 'The ute runs again, mostly. The mechanic says the rattling is a feature.'],
  'Wellington': ['A film extra needs a missing prop briefcase before the director calls action.', 'prop briefcase', 'The film crew get their prop back. The director wants another seventeen takes.'],
  'Top of South': ['A ferry worker has lost the passenger manifest for a fictional charter.', 'charter manifest', 'The manifest is found, and the ferry leaves only slightly late.'],
  'Canterbury': ['A student flat has misplaced the last rent receipt. The landlord has opinions.', 'rent receipt', 'The flat survives another week. The fridge remains a crime scene.'],
  'West Coast': ['A miner\'s family wants a keepsake notebook recovered from the roadside.', 'keepsake notebook', 'The notebook is home. The family buys you a pie and refuses to tell you what is in it.'],
  'Otago': ['A fictional ski-lodge worker needs the guest book back before check-in.', 'guest book', 'The lodge reopens, with a new rule about keeping books away from kea.'],
  'Southland': ['A fish-and-chip shop has lost its secret batter recipe.', 'recipe notebook', 'The recipe is safe. The cook insists the secret is just more salt.'],
  'Islands': ['A supply boat worker needs a lost cargo tally recovered.', 'cargo tally', 'The tally is returned, and the supply boat sails before the weather changes.'],
};
const SAVE_KEY = 'aotearoa-underworld-v2', SAVE_EXPORT_FORMAT = 'aotearoa-underworld-save';
const STAGES = ['origin-intro', 'origin-recover', 'origin-return', 'recruit', 'faction-choice', 'mission-courier', 'mission-brawl', 'mission-return', 'complete'];
const EYE = 1.62;

function createGame(world) {
  const { scene, camera, collision, charMaterial, fists, renderer } = world;
  const mobile = matchMedia('(pointer:coarse)').matches;
  const collides = (x, z, r = 0.55) => collision.collides(x, z, r);
  function slideMove(p, dx, dz, r = 0.55) {
    if (!Number.isFinite(dx) || !Number.isFinite(dz)) return;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / 0.45));
    for (let i = 0; i < steps; i++) {
      const nx = clamp(p.x + dx / steps, -260, 260), nz = clamp(p.z + dz / steps, -260, 260);
      if (!collides(nx, nz, r)) { p.x = nx; p.z = nz; continue; }
      if (!collides(nx, p.z, r)) p.x = nx;
      if (!collides(p.x, nz, r)) p.z = nz;
    }
  }
  function safeSpawn(x, z) {
    if (!collides(x, z, 0.7)) return { x, z };
    for (let r = 2; r <= 34; r += 2) for (let a = 0; a < 16; a++) {
      const th = a * Math.PI / 8, px = x + Math.cos(th) * r, pz = z + Math.sin(th) * r;
      if (!collides(px, pz, 0.7)) return { x: px, z: pz };
    }
    return { x, z };
  }
  let seedCounter = 1;
  function person(x, z, outfit = {}) {
    const h = new Human(charMaterial, { seed: seedCounter++ * 977, ...outfit });
    h.root.position.set(x, groundHeight(x, z), z);
    scene.add(h.root);
    return h.root;
  }
  const markerMat = c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false });

  // ---- cast ------------------------------------------------------------------------------
  let chosen = 'Independent', rep = 0, hp = 100, chapter = 0, defeated = 0, started = false;
  const contacts = [], enemies = [];
  FACTIONS.forEach((f, i) => {
    const a = i * TAU / FACTIONS.length, x = Math.sin(a) * 25, z = Math.cos(a) * 25;
    const p = person(x, z, { vest: FACTION_COLORS[i], top: [0x1c1c1e, 0x2a2a2d, 0x3b3530, 0x14181c][i % 4], pants: i % 3 ? 0xffffff : 0x3a3a3a, pantsCell: i % 3 ? ATLAS.denim : ATLAS.canvas, beanie: i % 3 === 0 ? 0x222222 : null, face: [ATLAS.faceA, ATLAS.faceB, ATLAS.faceC][i % 3], pose: 'crossed' });
    p.rotation.y = Math.atan2(-x, -z) + (i % 2 ? 0.3 : -0.3);
    const marker = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 6).rotateX(Math.PI), markerMat(FACTION_COLORS[i]));
    marker.position.y = 2.25; p.add(marker); p.userData.marker = marker;
    contacts.push({ p, f });
  });
  for (let i = 0; i < 13; i++) {
    const a = i * 2.4, x = Math.sin(a) * (45 + i * 8), z = Math.cos(a) * (45 + i * 8);
    const s = safeSpawn(x, z);
    const p = person(s.x, s.z, { top: [0x232527, 0x4a1d1d, 0x2b3440, 0x3a3a3a, 0x151515][i % 5], topCell: ATLAS.cotton, pants: [0x2a2a2a, 0x1f2a3a, 0x3d3d3d][i % 3], pantsCell: ATLAS.track, beanie: i % 2 ? [0x111111, 0x7a1414, 0x223355][i % 3] : null, face: [ATLAS.faceB, ATLAS.faceA, ATLAS.faceC][i % 3], shoes: 0xe8e8e8 });
    enemies.push({ p, hp: 3, alive: true, attackT: 0 });
  }
  const fixer = person(0, -8, { top: 0xc79a3e, topCell: ATLAS.canvas, pants: 0x4a4038, pantsCell: ATLAS.canvas, face: ATLAS.faceC, pose: 'relaxed', scale: 1.0 });
  const fixerMarker = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), markerMat(0xffe067)); fixerMarker.position.y = 2.3; fixer.add(fixerMarker);
  const pickup = itemProp('bag', 0x77ffdb); scene.add(pickup);
  const pickupMarker = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), markerMat(0x77ffdb)); pickupMarker.position.y = 1.0; pickup.add(pickupMarker);
  const stash = itemProp('parcel', 0xa9ff85); stash.position.set(-18, ROAD.kerbH, -19); scene.add(stash);
  const stashMarker = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), markerMat(0xa9ff85)); stashMarker.position.y = 1.0; stash.add(stashMarker);
  const enemySpawns = enemies.map(e => e.p.position.clone());

  // ---- blood decals ----------------------------------------------------------------------
  const fx = new THREE.Group(); scene.add(fx);
  const splat = canvasTexture(128, 128, (g, w, h) => {
    const r = mulberry32(9); g.clearRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { const a = r() * TAU, d = r() * 40, rr = 4 + r() * 18 * (1 - d / 50); g.fillStyle = `rgba(${90 + r() * 40},${8 + r() * 10},${10 + r() * 10},${0.7 + r() * 0.3})`; g.beginPath(); g.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, rr, 0, TAU); g.fill(); }
  });
  const bloodMat = new THREE.MeshStandardMaterial({ map: splat, transparent: true, depthWrite: false, roughness: 0.15, metalness: 0, polygonOffset: true, polygonOffsetFactor: -4 });
  const rnd = mulberry32(31337);
  function bloodAt(p) {
    const o = new THREE.Mesh(new THREE.PlaneGeometry(0.9 + rnd() * 0.6, 0.9 + rnd() * 0.6), bloodMat);
    o.rotation.set(-Math.PI / 2, 0, rnd() * TAU); o.position.set(p.x + (rnd() - 0.5) * 0.4, groundHeight(p.x, p.z) + 0.01, p.z + (rnd() - 0.5) * 0.4);
    fx.add(o); if (fx.children.length > 30) fx.remove(fx.children[0]);
  }

  // ---- input -----------------------------------------------------------------------------
  camera.position.set(0, ROAD.kerbH + EYE, 8);
  let yaw = 0, pitch = 0;
  const keys = {}, move = {};
  addEventListener('keydown', e => { keys[e.code] = true; if (e.code === 'KeyE') talk(); });
  addEventListener('keyup', e => { keys[e.code] = false; });
  let lookTouchId = null, lastX = 0, lastY = 0;
  const canvas = renderer.domElement;
  canvas.addEventListener('click', () => { if (!mobile && started) { if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.(); else hit(); } });
  document.addEventListener('mousemove', e => { if (document.pointerLockElement === canvas) { yaw -= e.movementX * 0.0025; pitch = clamp(pitch - e.movementY * 0.0025, -1.3, 1.3); } });
  canvas.addEventListener('touchstart', e => { const t = e.changedTouches[0]; if (lookTouchId === null && t.clientX > innerWidth * 0.35) { lookTouchId = t.identifier; lastX = t.clientX; lastY = t.clientY; } }, { passive: true });
  canvas.addEventListener('touchmove', e => {
    if (lookTouchId === null) return;
    const t = Array.from(e.changedTouches).find(t => t.identifier === lookTouchId); if (!t) return;
    e.preventDefault(); yaw -= (t.clientX - lastX) * 0.006; pitch = clamp(pitch - (t.clientY - lastY) * 0.006, -1.3, 1.3); lastX = t.clientX; lastY = t.clientY;
  }, { passive: false });
  const releaseLook = e => { if (Array.from(e.changedTouches).some(t => t.identifier === lookTouchId)) lookTouchId = null; };
  canvas.addEventListener('touchend', releaseLook); canvas.addEventListener('touchcancel', releaseLook);
  document.querySelectorAll('[data-m]').forEach(b => {
    b.addEventListener('pointerdown', e => { e.preventDefault(); move[b.dataset.m] = true; b.setPointerCapture(e.pointerId); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, () => { move[b.dataset.m] = false; });
  });

  // ---- story -----------------------------------------------------------------------------
  const notice = $('notice'); const say = s => { notice.textContent = s; };
  let hometown = 'Kaikohe', originRegion = 'Northland';
  const select = $('hometown');
  select.innerHTML = Object.entries(ORIGINS).map(([region, towns]) => `<optgroup label="${region}">${towns.map(t => `<option value="${t}" data-region="${region}">${t}</option>`).join('')}</optgroup>`).join('');
  function originUpdate() { hometown = select.value; originRegion = select.selectedOptions[0].dataset.region; }
  $('factions').innerHTML = FACTIONS.map((f, i) => `<button data-f="${i}">${f}</button>`).join('');
  let stamina = 100; const STAMINA_DRAIN = 24, STAMINA_RECOVERY = 17;
  let stage = 'origin-intro', cash = 0, missionRoute = '', pauseOpen = false, saveAllowed = true;
  let originText = ORIGIN_TALES[originRegion];
  function hometownHash(name) { let h = 2166136261; for (const c of name) h = Math.imul(h ^ c.codePointAt(0), 16777619) >>> 0; return h >>> 0; }
  function hometownPickup(name) { const h = hometownHash(name); const a = ((h % 3600) / 3600) * TAU; const radius = 18 + (Math.floor(h / 3600) % 9) * 4; return safeSpawn(Math.cos(a) * radius, Math.sin(a) * radius); }
  function positionOriginPickup() { const p = hometownPickup(hometown); pickup.position.set(p.x, groundHeight(p.x, p.z), p.z); }
  const dist = p => Math.hypot(camera.position.x - p.x, camera.position.z - p.z);
  function objective() {
    if (stage === 'origin-intro') return ['Find the local fixer. Hear your hometown story.', fixer.position];
    if (stage === 'origin-recover') return [`Recover the ${originText[1]} (TALK to the teal marker).`, pickup.position];
    if (stage === 'origin-return') return ['Return the item to the fixer.', fixer.position];
    if (stage === 'recruit') return ['Meet a faction contact (coloured markers).', contacts[0].p.position];
    if (stage === 'faction-choice') return [`Talk to ${chosen} to choose your initiation.`, contacts.find(c => c.f === chosen)?.p.position || fixer.position];
    if (stage === 'mission-courier') return [`${chosen}: recover the package from the green marker.`, stash.position];
    if (stage === 'mission-brawl') { const living = enemies.filter(e => e.alive).sort((a, b) => dist(a.p.position) - dist(b.p.position)); return [`${chosen}: defeat three hostile opponents (${defeated}/3).`, living[0]?.p.position || null]; }
    if (stage === 'mission-return') return [`Return to the fixer for the ${missionRoute === 'courier' ? 'quiet' : 'loud'} ending.`, fixer.position];
    return [`Chapter complete: ${hometown} origin / ${chosen} / ${missionRoute} route.`, null];
  }
  function updateHUD() {
    $('status').textContent = `HP ${Math.ceil(hp)} | ENERGY ${Math.ceil(stamina)} | $${cash} | REP ${rep} | ${chosen.toUpperCase()}`;
    const [goal, target] = objective(); $('quest').textContent = goal; $('status').setAttribute('title', `${hometown} | ${originRegion}`);
    if (target) $('missionDistance').textContent = `OBJECTIVE ${Math.round(dist(target))}m away`;
    else $('missionDistance').textContent = stage === 'mission-brawl' ? 'Find hostiles on the outskirts' : 'Story branch recorded';
  }
  function store() {
    if (!saveAllowed || !started) return;
    try {
      const data = { version: 2, stage, hometown, originRegion, chosen, rep, hp, cash, defeated, missionRoute, stamina, enemyHP: enemies.map(e => e.hp), enemyAlive: enemies.map(e => e.alive), enemyPositions: enemies.map(e => ({ x: e.p.position.x, z: e.p.position.z })), x: camera.position.x, z: camera.position.z, yaw, pitch };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data)); $('saveState').textContent = 'Saved on this device';
    } catch (e) { $('saveState').textContent = 'Local save unavailable in this browser'; }
  }
  function readSave() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (!s || s.version !== 2 || typeof s.hometown !== 'string' || !Object.values(ORIGINS).some(ts => ts.includes(s.hometown)) || !STAGES.includes(s.stage)) return null;
      return migrateSave(s);
    } catch (e) { return null; }
  }
  function exportSave() {
    storePaused();
    const saved = readSave();
    if (!saved) { $('transferStatus').textContent = 'No valid save to export yet.'; return; }
    const payload = JSON.stringify({ format: SAVE_EXPORT_FORMAT, exportedAt: new Date().toISOString(), save: saved }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' })), a = document.createElement('a');
    a.href = url; a.download = 'AOTEAROA-UNDERWORLD-' + saved.hometown.replace(/[^a-z0-9]+/gi, '-') + '-save.json';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    $('transferStatus').textContent = 'Save file exported. Keep it somewhere safe.';
  }
  function validateImportedSave(payload) {
    if (!payload || payload.format !== SAVE_EXPORT_FORMAT || !payload.save || payload.save.version !== 2) throw Error('Not an AOTEAROA: UNDERWORLD v2 save file.');
    const s = migrateSave(payload.save);
    if (typeof s.hometown !== 'string' || !Object.values(ORIGINS).some(towns => towns.includes(s.hometown))) throw Error('Unknown hometown.');
    if (!['Independent', ...FACTIONS].includes(s.chosen)) throw Error('Unknown faction.');
    if (!STAGES.includes(s.stage)) throw Error('Unknown mission stage.');
    if (JSON.stringify(payload).length > 100000) throw Error('Save file is too large.');
    return s;
  }
  async function importSaveFile(file) {
    if (!file) return;
    try {
      if (file.size > 100000) throw Error('Save file is too large.');
      const data = validateImportedSave(JSON.parse(await file.text()));
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      refreshContinue();
      $('transferStatus').textContent = 'Imported ' + data.hometown + ' save. Select CONTINUE SAVED GAME.';
      $('pausePanel').style.display = 'none'; pauseOpen = false; started = false;
      $('panel').style.display = 'grid';
    } catch (error) { $('transferStatus').textContent = 'Import failed: ' + error.message; }
    finally { $('saveFile').value = ''; }
  }
  $('exportSave').onclick = exportSave;
  $('importSave').onclick = () => $('saveFile').click();
  $('saveFile').onchange = e => importSaveFile(e.target.files?.[0]);
  function refreshContinue() { const s = readSave(); $('continue').style.display = s ? 'inline-block' : 'none'; $('saveState').textContent = s ? `Save: ${s.hometown} / ${s.chosen} / ${s.stage}` : 'No previous save found'; }
  function closeMenus() { $('panel').style.display = 'none'; $('choicePanel').style.display = 'none'; $('pausePanel').style.display = 'none'; pauseOpen = false; started = true; updateHUD(); }
  function resetEnemy(e, i) { e.alive = true; e.hp = 3; e.dyingT = 0; e.p.userData.human.reset(); e.p.position.set(enemySpawns[i].x, groundHeight(enemySpawns[i].x, enemySpawns[i].z), enemySpawns[i].z); if (!e.p.parent) scene.add(e.p); }
  function beginNew() {
    saveAllowed = true; stage = 'origin-intro'; hp = 100; cash = 0; rep = 0; chapter = 0; defeated = 0; missionRoute = ''; stamina = 100;
    originText = ORIGIN_TALES[originRegion] || ORIGIN_TALES.Northland; positionOriginPickup();
    camera.position.set(0, ROAD.kerbH + EYE, 8); yaw = 0; pitch = 0;
    enemies.forEach(resetEnemy);
    while (fx.children.length) fx.remove(fx.children[0]);
    closeMenus(); say(`${hometown}: ${originText[0]} Find the yellow fixer marker.`); store();
  }
  function restore(s) {
    hometown = s.hometown; originRegion = s.originRegion || Object.entries(ORIGINS).find(([, ts]) => ts.includes(s.hometown))?.[0] || 'Northland';
    chosen = FACTIONS.includes(s.chosen) ? s.chosen : 'Independent'; originText = ORIGIN_TALES[originRegion] || ORIGIN_TALES.Northland; positionOriginPickup();
    stage = s.stage; rep = Math.max(0, Number(s.rep) || 0); hp = Math.min(100, Math.max(1, Number(s.hp) || 100)); cash = Math.max(0, Number(s.cash) || 0);
    defeated = Math.max(0, Number(s.defeated) || 0); missionRoute = s.missionRoute || '';
    stamina = Number.isFinite(s.stamina) ? Math.max(0, Math.min(100, s.stamina)) : 100;
    const p = safeSpawn(Number.isFinite(s.x) ? clamp(s.x, -260, 260) : 0, Number.isFinite(s.z) ? clamp(s.z, -260, 260) : 8); // Run 11 saves may sit inside the new buildings
    camera.position.set(p.x, groundHeight(p.x, p.z) + EYE, p.z);
    yaw = Number.isFinite(s.yaw) ? s.yaw : 0; pitch = Number.isFinite(s.pitch) ? s.pitch : 0;
    enemies.forEach((e, i) => {
      e.hp = Number.isFinite(s.enemyHP?.[i]) ? s.enemyHP[i] : 3; e.alive = s.enemyAlive?.[i] !== false; e.dyingT = 0; e.p.userData.human.reset();
      const pos = s.enemyPositions?.[i];
      const q = safeSpawn(Number.isFinite(pos?.x) ? pos.x : enemySpawns[i].x, Number.isFinite(pos?.z) ? pos.z : enemySpawns[i].z);
      e.p.position.set(q.x, groundHeight(q.x, q.z), q.z);
      if (e.alive && !e.p.parent) scene.add(e.p); if (!e.alive && e.p.parent) scene.remove(e.p);
    });
    select.value = hometown; closeMenus(); say(`Welcome back to ${hometown}. Your ${chosen} story continues.`);
  }
  function advance(next, message) { stage = next; say(message); updateHUD(); store(); }
  function talk() {
    if (!started || pauseOpen) return;
    if (stage === 'origin-intro' && dist(fixer.position) < 5) { advance('origin-recover', `${hometown} origin: ${originText[0]} Find the ${originText[1]}.`); return; }
    if (stage === 'origin-recover' && dist(pickup.position) < 5) { advance('origin-return', `Recovered the ${originText[1]}. Return it to your fixer.`); return; }
    if (stage === 'origin-return' && dist(fixer.position) < 5) { cash += 40; rep += 15; advance(chosen === 'Independent' ? 'recruit' : 'faction-choice', `${originText[2]} $40 and reputation +15. ${chosen === 'Independent' ? 'Meet a crew contact.' : 'Talk to your selected faction.'}`); return; }
    if (stage === 'recruit') {
      const c = contacts.filter(c => dist(c.p.position) < 5).sort((a, b) => dist(a.p.position) - dist(b.p.position))[0];
      if (c) { chosen = c.f; rep += 10; advance('faction-choice', `${chosen} has offered you a chance. Talk again to choose a job.`); return; }
    }
    if (stage === 'faction-choice') {
      const c = contacts.find(c => c.f === chosen);
      if (c && dist(c.p.position) < 5) {
        $('choiceTitle').textContent = `${chosen}: your first decision`;
        $('choiceText').textContent = `Your ${hometown} past matters. The ${originRegion} fixer vouched for you. Do you keep it quiet, or go loud? Your route changes the ending and rewards.`;
        $('choicePanel').style.display = 'flex'; started = false; if (document.pointerLockElement) document.exitPointerLock(); return;
      }
    }
    if (stage === 'mission-courier' && dist(stash.position) < 5) { cash += 20; advance('mission-return', `Package secured. Your ${originRegion} contacts gave you a clean exit. Return to the fixer.`); return; }
    if (stage === 'mission-return' && dist(fixer.position) < 5) { cash += missionRoute === 'courier' ? 100 : 60; rep += missionRoute === 'courier' ? 15 : 35; advance('complete', `${hometown} ending: ${originText[2]} ${chosen} now knows your name. ${missionRoute === 'courier' ? 'Quiet route: more cash, less heat.' : 'Loud route: more reputation, more enemies.'} CHAPTER COMPLETE.`); return; }
    if (stage === 'complete') { say(`Chapter complete. ${hometown} → ${chosen} → ${missionRoute}. Try a different origin and route for a different ending.`); return; }
    say(`Follow your current objective. ${objective()[0]}`);
  }
  function hit() {
    if (!started || pauseOpen) return;
    fists.swing();
    const forward = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
    let target = null, score = 99;
    for (const e of enemies) {
      if (!e.alive) continue;
      const delta = e.p.position.clone().add(new THREE.Vector3(0, 1.4, 0)).sub(camera.position), d = delta.length();
      if (d < 4 && delta.normalize().dot(forward) > 0.45 && d < score) { target = e; score = d; }
    }
    if (!target) { say('No opponent in melee range.'); return; }
    target.hp--; bloodAt(target.p.position); slideMove(target.p.position, forward.x * 0.45, forward.z * 0.45, 0.4);
    world.shake = 0.18; target.p.userData.human.hit();
    if (target.hp <= 0) {
      target.alive = false; target.dyingT = 0.0001; target.p.userData.human.knockDown(); rep += 5;
      if (stage === 'mission-brawl') { defeated++; if (defeated >= 3) { advance('mission-return', `You won the fights. Your ${hometown} fixer wants to see you.`); return; } }
      say('Opponent defeated. Reputation +5.');
    } else say('Hit landed.');
    updateHUD(); store();
  }
  $('attack').onclick = hit; $('interact').onclick = talk;
  $('routeCourier').onclick = () => { missionRoute = 'courier'; closeMenus(); advance('mission-courier', `${chosen} chose the quiet route. Find the green package.`); };
  $('routeBrawl').onclick = () => {
    missionRoute = 'brawl'; defeated = 0;
    if (enemies.filter(e => e.alive).length < 3) enemies.slice(0, 3).forEach((e, i) => resetEnemy(e, i));
    closeMenus(); advance('mission-brawl', `${chosen} chose the loud route. Defeat 3 hostile opponents.`);
  };
  $('choiceBack').onclick = closeMenus;
  $('independent').onclick = () => { chosen = 'Independent'; document.querySelectorAll('[data-f]').forEach(x => x.classList.remove('selected')); $('start').textContent = 'NEW GAME: INDEPENDENT'; };
  $('start').onclick = beginNew;
  $('continue').onclick = () => { const s = readSave(); if (s) restore(s); else refreshContinue(); };
  select.onchange = () => { originUpdate(); originText = ORIGIN_TALES[originRegion] || ORIGIN_TALES.Northland; $('originStory').textContent = `${hometown}: ${originText[0]}`; };
  select.onchange();
  document.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => {
    chosen = FACTIONS[+b.dataset.f];
    document.querySelectorAll('[data-f]').forEach(x => x.classList.remove('selected')); b.classList.add('selected');
    $('start').textContent = `NEW GAME: ${chosen.toUpperCase()}`;
  }));
  function pauseGame() {
    if ($('panel').style.display !== 'none' || $('choicePanel').style.display === 'flex') return;
    pauseOpen = !pauseOpen; started = !pauseOpen; $('pausePanel').style.display = pauseOpen ? 'flex' : 'none';
    if (pauseOpen) { if (document.pointerLockElement) document.exitPointerLock(); storePaused(); } else say('Back on the street.');
  }
  function storePaused() { const was = started; started = true; store(); started = was; }
  $('pauseButton').onclick = pauseGame; $('resume').onclick = pauseGame;
  $('saveNow').onclick = () => { storePaused(); say('Saved on this device.'); };
  $('restart').onclick = () => { if (document.pointerLockElement) document.exitPointerLock(); started = false; pauseOpen = false; $('pausePanel').style.display = 'none'; $('panel').style.display = 'grid'; refreshContinue(); };
  addEventListener('keydown', e => { if (e.code === 'Escape' && $('panel').style.display === 'none' && $('choicePanel').style.display !== 'flex') { pauseGame(); e.preventDefault(); } });
  addEventListener('visibilitychange', () => { if (document.hidden && started) pauseGame(); });
  refreshContinue();
  setInterval(() => { if (started) store(); }, 12000);
  setInterval(() => {
    if (!started) return;
    const [, target] = objective();
    if (!target || dist(target) <= 6) { $('waypoint').textContent = ''; return; }
    const dx = target.x - camera.position.x, dz = target.z - camera.position.z;
    let angle = Math.atan2(dx, -dz) + yaw; angle = Math.atan2(Math.sin(angle), Math.cos(angle));
    const arrow = Math.abs(angle) < 0.4 ? '↑' : Math.abs(angle) > 2.7 ? '↓' : angle > 0 ? '→' : '←';
    $('waypoint').textContent = arrow + ' ' + Math.round(dist(target)) + 'm';
  }, 250);

  // ---- radar: static street map rendered once, rotated with the view --------------------
  const miniMap = $('miniMap'), miniCtx = miniMap.getContext('2d');
  miniMap.addEventListener('click', () => miniMap.classList.toggle('compact'));
  const MAP_PX = 2, mapCanvas = document.createElement('canvas'); mapCanvas.width = mapCanvas.height = 600 * MAP_PX;
  {
    const g = mapCanvas.getContext('2d'), o = 300 * MAP_PX;
    g.fillStyle = '#0d2622'; g.fillRect(0, 0, mapCanvas.width, mapCanvas.height);
    g.fillStyle = '#3f5c55';
    for (let i = -4; i <= 4; i++) { const c = o + i * 55 * MAP_PX; g.fillRect(c - 5.5 * MAP_PX, 0, 11 * MAP_PX, mapCanvas.height); g.fillRect(0, c - 5.5 * MAP_PX, mapCanvas.width, 11 * MAP_PX); }
    g.fillStyle = '#5d6f5a'; g.fillRect(o - 34 * MAP_PX, o - 34 * MAP_PX, 68 * MAP_PX, 68 * MAP_PX);
    g.fillStyle = '#1e3a35';
    for (const b of collision.list) if (b.tag === 'building' || b.tag === 'house' || b.tag === 'warehouse') g.fillRect(o + (b.x - b.w / 2) * MAP_PX, o + (b.z - b.d / 2) * MAP_PX, b.w * MAP_PX, b.d * MAP_PX);
  }
  function drawMiniMap() {
    const c = miniCtx, w = c.canvas.width, h = c.canvas.height, scale = 1.25;
    c.clearRect(0, 0, w, h); c.fillStyle = '#092321'; c.fillRect(0, 0, w, h);
    c.save(); c.translate(w / 2, h / 2); c.rotate(yaw);
    const k = scale / MAP_PX;
    c.drawImage(mapCanvas, (-300 - camera.position.x) * scale, (-300 - camera.position.z) * scale, mapCanvas.width * k, mapCanvas.height * k);
    const dot = (x, z, color, r) => { const dx = (x - camera.position.x) * scale, dz = (z - camera.position.z) * scale; if (Math.abs(dx) > w || Math.abs(dz) > h) return; c.fillStyle = color; c.beginPath(); c.arc(dx, dz, r, 0, TAU); c.fill(); };
    for (const contact of contacts) dot(contact.p.position.x, contact.p.position.z, '#76b1fa', 2.5);
    for (const enemy of enemies) if (enemy.alive) dot(enemy.p.position.x, enemy.p.position.z, '#e96666', 2.5);
    const target = objective()[1]; if (target) dot(target.x, target.z, '#f6d766', 5);
    c.restore(); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(w / 2, h / 2 - 8); c.lineTo(w / 2 - 6, h / 2 + 7); c.lineTo(w / 2 + 6, h / 2 + 7); c.closePath(); c.fill();
    c.fillStyle = '#b9d5c5'; c.font = '11px sans-serif'; c.fillText('DISTRICT RADAR', 7, 15);
  }

  // ---- per-frame simulation ---------------------------------------------------------------
  let lastHud = 0, bobT = 0;
  const forward = new THREE.Vector3();
  function update(dt, now, t) {
    if (started) {
      const joy = window.AUControls || { x: 0, y: 0 };
      const k = c => !!keys[c];
      const right = (k('KeyD') || k('ArrowRight') || move.right ? 1 : 0) - (k('KeyA') || k('ArrowLeft') || move.left ? 1 : 0) + (Number(joy.x) || 0);
      const back = (k('KeyS') || k('ArrowDown') || move.back ? 1 : 0) - (k('KeyW') || k('ArrowUp') || move.forward ? 1 : 0) + (Number(joy.y) || 0);
      const wantsSprint = !!(keys.ShiftLeft || keys.ShiftRight || move.sprint);
      const moving = Math.abs(right) > 0.05 || Math.abs(back) > 0.05;
      const sprinting = wantsSprint && moving && stamina > 0;
      stamina = clamp(stamina + (sprinting ? -STAMINA_DRAIN : STAMINA_RECOVERY) * dt, 0, 100);
      const speed = (sprinting ? 12 : 7) * dt;
      let dx = right, dz = back; const len = Math.hypot(dx, dz);
      if (len > 1) { dx /= len; dz /= len; }
      const mx = (dx * Math.cos(yaw) + dz * Math.sin(yaw)) * speed, mz = (-dx * Math.sin(yaw) + dz * Math.cos(yaw)) * speed;
      slideMove(camera.position, mx, mz);
      bobT += dt * (moving ? (sprinting ? 13 : 9) * Math.min(1, len) : 0);
      const ground = groundHeight(camera.position.x, camera.position.z) + EYE + (moving ? Math.sin(bobT) * 0.035 : 0);
      camera.position.y = lerp(camera.position.y, ground, 1 - Math.exp(-dt * 12));
      window.__auTelemetry = { engine: 'three', started, paused: pauseOpen, x: camera.position.x, z: camera.position.z, joyX: joy.x, joyY: joy.y };
      window.AUControls?.setPosition?.(camera.position.x, camera.position.z, 'THREE');
      if (Math.abs(joy.x) + Math.abs(joy.y) > 0.1) $('joyReadout').textContent = `${Math.round(camera.position.x)},${Math.round(camera.position.z)}`;
      fists.update(dt, moving, sprinting);
      for (const e of enemies) {
        if (!e.alive) continue;
        const h = e.p.userData.human;
        const d = Math.hypot(camera.position.x - e.p.position.x, camera.position.z - e.p.position.z);
        let sp = 0;
        if (d < 15 && d > 2) {
          const vx = (camera.position.x - e.p.position.x) / d, vz = (camera.position.z - e.p.position.z) / d;
          const before = e.p.position.clone();
          slideMove(e.p.position, vx * dt * 1.4, vz * dt * 1.4, 0.4);
          sp = before.distanceTo(e.p.position) / Math.max(dt, 1e-4);
        }
        if (d < 15) e.p.rotation.y = Math.atan2(camera.position.x - e.p.position.x, camera.position.z - e.p.position.z);
        h.speed = sp; h.mode = d < 6 ? 'guard' : 'idle';
        e.p.position.y = groundHeight(e.p.position.x, e.p.position.z);
        if (d < 1.6) {
          hp = Math.max(0, hp - dt * 5);
          e.attackT -= dt; if (e.attackT <= 0) { e.attackT = 0.9 + rnd() * 0.4; h.punch(); world.hurt = 1; world.shake = 0.12; }
          if (hp === 0) { hp = 100; camera.position.set(0, ROAD.kerbH + EYE, 8); rep = Math.max(0, rep - 10); say('You got knocked out. Respawned at the dairy. Reputation -10.'); }
        }
      }
      if (now - lastHud > 180) { updateHUD(); drawMiniMap(); lastHud = now; }
    }
    // Dying enemies stay down for a few seconds, then leave the scene.
    for (const e of enemies) if (!e.alive && e.dyingT > 0) { e.dyingT += dt; if (e.dyingT > 4.5 && e.p.parent) { scene.remove(e.p); e.dyingT = 0; } }
    // Crew contacts and the fixer turn their heads to watch the player.
    for (const c of [...contacts.map(c => c.p), fixer]) {
      const h = c.userData.human, dx = camera.position.x - c.position.x, dz = camera.position.z - c.position.z, d = Math.hypot(dx, dz);
      const want = d < 9 ? Math.atan2(dx, dz) - c.rotation.y : 0;
      h.lookYaw = lerp(h.lookYaw, Math.atan2(Math.sin(want), Math.cos(want)), 1 - Math.exp(-dt * 4));
      if (c.userData.marker) { c.userData.marker.position.y = 2.25 + Math.sin(t * 2 + c.position.x) * 0.06; c.userData.marker.material.opacity = clamp((d - 1.5) / 5, 0.12, 0.9); }
    }
    fixerMarker.rotation.y += dt; fixerMarker.position.y = 2.3 + Math.sin(t * 2) * 0.06;
    fixerMarker.material.opacity = clamp((dist(fixer.position) - 1.5) / 5, 0.12, 0.9);
    pickupMarker.rotation.y += dt; stashMarker.rotation.y += dt;
    pickupMarker.position.y = 1.0 + Math.sin(t * 2.2) * 0.08; stashMarker.position.y = 1.0 + Math.sin(t * 2.2 + 1) * 0.08;
    camera.rotation.order = 'YXZ';
    const sh = world.shake || 0; world.shake = Math.max(0, sh - dt);
    camera.rotation.set(pitch + (Math.random() - 0.5) * sh * 0.12, yaw + (Math.random() - 0.5) * sh * 0.12, 0);
    // Animate characters near the camera every frame, distant ones at a lower rate.
    for (const p of [...contacts.map(c => c.p), fixer, ...enemies.map(e => e.p)]) {
      if (!p.parent) continue;
      const d = p.position.distanceTo(camera.position);
      const h = p.userData.human;
      if (d < 45 || (h.skip = (h.skip || 0) + 1) % 4 === 0) h.update(d < 45 ? dt : dt * 4, t);
    }
    forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    return forward;
  }

  window.__auEngineReady = true; window.__auThreeBooting = false; document.documentElement.dataset.engine = 'ready';
  $('start').disabled = false; $('continue').disabled = false; $('start').title = ''; $('continue').title = '';
  // Test/diagnostic hooks.
  window.__auGame = {
    state: () => ({ stage, hp, rep, cash, chosen, defeated, started, x: camera.position.x, z: camera.position.z, yaw, objective: objective()[0] }),
    teleport(x, z) { camera.position.set(x, groundHeight(x, z) + EYE, z); },
    face(y) { yaw = y; }, talk, hit, collides,
    targets: () => ({ fixer: fixer.position.clone(), pickup: pickup.position.clone(), stash: stash.position.clone(), contacts: contacts.map(c => ({ f: c.f, x: c.p.position.x, z: c.p.position.z })), enemies: enemies.map(e => ({ x: e.p.position.x, z: e.p.position.z, alive: e.alive })) }),
  };
  return { update, isStarted: () => started };
}
