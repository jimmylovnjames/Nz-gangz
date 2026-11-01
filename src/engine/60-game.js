const MAP_VERSION = 'manurewa-1';
// Game logic ported from Run 11 (missions, factions, saves, UI), unchanged in behaviour except bug fixes:
// movement no longer turns into NaN, forward follows the view after turning, and the waypoint/radar rotate correctly.
// Fictional crews. Order matches the colours and contact positions used since Run 1.
const FACTIONS = ['Black Tide', 'Stray Dogs', 'Clansmen', 'Bone Collectors', 'Southside Hornets', 'Royal Taipans', 'Conquistadors MC', 'Sundowners MC', 'Dark Seraphs MC', 'Iron Horde MC', 'Insurgents MC', 'Route 77', 'Southern Wanderers', 'Phantom Souls MC'];
// Saves from Run 11 and earlier store the old crew names; map them so those saves keep their crew.
const LEGACY_FACTIONS = Object.fromEntries(['Black Power', 'Mongrel Mob', 'Tribesmen', 'Head Hunters', 'Killer Beez', 'King Cobras', 'Comancheros MC', 'Bandidos MC', 'Hells Angels MC', 'Mongols MC', 'Rebels MC', 'Highway 61', 'New Zealand Nomads', 'Immortal Souls MC'].map((name, i) => [name, FACTIONS[i]]));
// Run 12 replaced the hometown errand with the cousin prologue; old stages map onto the new chapter.
const LEGACY_STAGES = { 'origin-intro': 'prologue', 'origin-recover': 'debt-find', 'origin-return': 'debt-return' };
const migrateSave = s => {
  if (!s) return s;
  if (LEGACY_FACTIONS[s.chosen]) s.chosen = LEGACY_FACTIONS[s.chosen];
  if (LEGACY_STAGES[s.stage]) { if (s.stage === 'origin-return') { s.debtRoute = 'smooth'; s.debtCash = 200; } s.stage = LEGACY_STAGES[s.stage]; }
  return s;
};
const FACTION_COLORS = [0x3764d8, 0xc33737, 0x4b8e68, 0x9c8d54, 0xe4b82c, 0x7e4b99, 0x2e8692, 0xa67639, 0x9b9b9b, 0x7b4444, 0x67928b, 0xb57e50, 0x6b6a9d, 0x8d6c80];
const ORIGINS = { Northland: ['Kaikohe', 'Kaitaia', 'Whangārei', 'Opononi'], Auckland: ['South Auckland', 'West Auckland', 'Central Auckland', 'North Shore'], Waikato: ['Hamilton', 'Huntly', 'Tokoroa'], 'Bay of Plenty': ['Tauranga', 'Rotorua', 'Whakatāne'], 'East Coast': ['Gisborne', 'Wairoa'], 'Hawke’s Bay': ['Napier', 'Hastings'], 'Central North Island': ['Taupō', 'New Plymouth', 'Whanganui', 'Palmerston North'], Wellington: ['Wellington', 'Lower Hutt', 'Porirua'], 'Top of South': ['Nelson', 'Blenheim'], Canterbury: ['Christchurch', 'Ashburton', 'Timaru'], 'West Coast': ['Greymouth', 'Hokitika'], Otago: ['Dunedin', 'Queenstown', 'Wānaka'], Southland: ['Invercargill', 'Bluff'], Islands: ['Stewart Island / Rakiura', 'Chatham Islands'] };
const SAVE_KEY = 'aotearoa-underworld-v2', SAVE_EXPORT_FORMAT = 'aotearoa-underworld-save';
const STAGES = ['prologue', 'debt-find', 'debt-fight', 'debt-return', 'shorty-wait', 'shorty-meet', 'shorty-jobs', 'shorty-return', 'recruit', 'faction-choice', 'mission-courier', 'mission-brawl', 'mission-return', 'complete', 'c1-call', 'c1-car', 'c1-pickup', 'c1-deliver', 'c1-dairy', 'c1-rivals', 'c1-wait', 'c1-manu', 'c1-home', 'c1-done'];
const VALID_STAGES = [...STAGES, ...Object.keys(LEGACY_STAGES)];
const EYE = 1.62;

function createGame(world) {
  const { scene, camera, collision, charMaterial, fists, renderer, dialogue: dlg, prologue, phone, places } = world;
  const mobile = matchMedia('(pointer:coarse)').matches;
  const collides = (x, z, r = 0.55) => collision.collides(x, z, r);
  function slideMove(p, dx, dz, r = 0.55) {
    if (!Number.isFinite(dx) || !Number.isFinite(dz)) return;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / 0.45));
    for (let i = 0; i < steps; i++) {
      const nx = clamp(p.x + dx / steps, MAP_BOUNDS.x0, MAP_BOUNDS.x1), nz = clamp(p.z + dz / steps, MAP_BOUNDS.z0, MAP_BOUNDS.z1);
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
    h.mesh.userData.cull = CULL_DIST.people; h.mesh.userData.dyn = true; CULLED.push(h.mesh);
    scene.add(h.root);
    return h.root;
  }
  const markerMat = c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false });

  // ---- cast ------------------------------------------------------------------------------
  let chosen = 'Independent', rep = 0, hp = 100, chapter = 0, defeated = 0, started = false;
  const contacts = [], enemies = [];
  // The crews hang out round Clendon skate park and the reserve beside Te Matariki.
  const crewHub = places.skatepark?.pos || places.teMatariki.pos;
  const hubX = crewHub.x + 22, hubZ = crewHub.z - 26;
  FACTIONS.forEach((f, i) => {
    const a = i * TAU / FACTIONS.length, s0 = safeSpawn(hubX + Math.sin(a) * 18, hubZ + Math.cos(a) * 18), x = s0.x, z = s0.z;
    const p = person(x, z, { look: ['crewA', 'crewB', 'crewC'][i % 3], vest: FACTION_COLORS[i], top: [0x1c1c1e, 0x2a2a2d, 0x3b3530, 0x14181c][i % 4], pants: i % 3 ? 0xffffff : 0x3a3a3a, pantsCell: i % 3 ? ATLAS.denim : ATLAS.canvas, beanie: i % 3 === 0 ? 0x222222 : null, face: [ATLAS.faceA, ATLAS.faceB, ATLAS.faceC][i % 3], pose: 'crossed' });
    p.rotation.y = Math.atan2(hubX - x, hubZ - z) + (i % 2 ? 0.3 : -0.3);
    const marker = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 6).rotateX(Math.PI), markerMat(FACTION_COLORS[i]));
    marker.position.y = 2.25; p.add(marker); p.userData.marker = marker;
    contacts.push({ p, f });
  });
  for (let i = 0; i < 13; i++) {
    const a = i * 2.4, x = hubX + Math.sin(a) * (60 + i * 9), z = hubZ + Math.cos(a) * (60 + i * 9);
    const s = safeSpawn(x, z);
    const p = person(s.x, s.z, { look: ['crewC', 'crewA', 'crewB'][i % 3], top: [0x232527, 0x4a1d1d, 0x2b3440, 0x3a3a3a, 0x151515][i % 5], topCell: ATLAS.cotton, pants: [0x2a2a2a, 0x1f2a3a, 0x3d3d3d][i % 3], pantsCell: ATLAS.track, beanie: i % 2 ? [0x111111, 0x7a1414, 0x223355][i % 3] : null, face: [ATLAS.faceB, ATLAS.faceA, ATLAS.faceC][i % 3], shoes: 0xe8e8e8 });
    enemies.push({ p, hp: 3, alive: true, attackT: 0 });
  }
  const fixerAt = safeSpawn(hubX, hubZ);
  const fixer = person(fixerAt.x, fixerAt.z, { look: 'crewB', top: 0xc79a3e, topCell: ATLAS.canvas, pants: 0x4a4038, pantsCell: ATLAS.canvas, face: ATLAS.faceC, pose: 'relaxed', scale: 1.0 });
  const fixerMarker = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), markerMat(0xffe067)); fixerMarker.position.y = 2.3; fixer.add(fixerMarker);
  // Manu waits outside his place for the money; Darren hangs out somewhere that depends on your hometown.
  const home = world.cousinHome;
  const manu = person(home.pos.x, home.pos.z, { look: 'manu', seed: 4242, skin: 0x7a4b31, top: 0x2a2d33, topCell: ATLAS.cotton, pants: 0x3a3a3a, pantsCell: ATLAS.track, face: ATLAS.faceC, beanie: 0x1a1a1a, pose: 'crossed', scale: 1.02 });
  manu.rotation.y = home.rot;
  const manuMarker = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), markerMat(0xffe067)); manuMarker.position.y = 2.3; manu.add(manuMarker);
  const darren = person(0, 0, { look: 'darren', seed: 777, skin: 0xc68e6a, top: 0x6a6656, topCell: ATLAS.cotton, pants: 0xffffff, pantsCell: ATLAS.denim, face: ATLAS.faceA, shoes: 0x777777, pose: 'relaxed', scale: 0.95 });
  const darrenMarker = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), markerMat(0xff9a7a)); darrenMarker.position.y = 2.2; darren.add(darrenMarker);
  const darrenState = { hp: 3, hostile: false, down: false, attackT: 0 };
  const stashAt = safeSpawn(places.clendonShops.pos.x + 30, places.clendonShops.pos.z - 25);
  const stash = itemProp('parcel', 0xa9ff85); stash.position.set(stashAt.x, groundHeight(stashAt.x, stashAt.z), stashAt.z); scene.add(stash);
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
  camera.position.set(world.cousinHome.spawn.pos.x, ROAD.kerbH + EYE, world.cousinHome.spawn.pos.z);
  let yaw = 0, pitch = 0;
  const keys = {}, move = {};
  addEventListener('keydown', e => { keys[e.code] = true; if (e.code === 'KeyE') talk(); });
  addEventListener('keyup', e => { keys[e.code] = false; });
  let lookTouchId = null, lastX = 0, lastY = 0;
  const canvas = renderer.domElement;
  canvas.addEventListener('mousedown', e => { if (e.button === 2) rmb = true; });
  addEventListener('mouseup', e => { if (e.button === 2) rmb = false; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
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
  // RUN is a toggle on touch screens so the right thumb stays free to steer. It switches itself off
  // once you stop moving; Shift on a keyboard is still hold-to-run.
  let runLatch = false, stillT = 0;
  const runBtn = $('sprint');
  const setRun = on => { runLatch = on; runBtn?.classList.toggle('on', on); runBtn?.setAttribute('aria-pressed', on ? 'true' : 'false'); };
  document.querySelectorAll('[data-m]').forEach(b => {
    if (b.dataset.m === 'sprint') { b.addEventListener('pointerdown', e => { e.preventDefault(); setRun(!runLatch); stillT = 0; }); return; }
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
  // Run 17 mechanics: punch power from the gym, energy-drink sprint, regen, combos, driving, shops, hustles.
  let strength = 0, boostT = 0, lastHurt = -1e9, lastPunch = -1e9, combo = 0, rmb = false;
  const drive = new PlayerCars(world), traffic = new Traffic(world, world.trafficCount || 0), shops = new Shops(world.city);
  const blocking = () => !drive.car && !!(keys.KeyQ || keys.KeyF || rmb || move.block);
  const heat = new Heat(), police = new Police(world, traffic);
  let policeSeen = false;
  let stage = 'prologue', cash = 0, missionRoute = '', pauseOpen = false, saveAllowed = true, debtRoute = '', debtCash = 0, inPrologue = false;
  function hometownHash(name) { let h = 2166136261; for (const c of name) h = Math.imul(h ^ c.codePointAt(0), 16777619) >>> 0; return h >>> 0; }
  // Darren's hangout depends on your hometown, so different origins send you to different corners of the district.
  const titleCase = n => n.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()).replace(/'S\b/g, "'s");
  // Darren hangs round real Clendon spots; which one depends on your hometown. label completes
  // "Find Darren ___"; place completes "he's always hanging round ___".
  const P = places, mk = (sp, label, place) => sp && { ...sp, label, place };
  const hangouts = [
    mk(P.clendonShops, 'at the Clendon shops car park', 'the Clendon shops'), mk(P.clendonDairy, 'outside Clendon Dairy', 'Clendon Dairy'),
    mk(P.skatepark, 'at Clendon skate park', 'the skate park'), mk(P.fishAndChips, 'outside Clendon Fish and Chips', 'the fish and chip shop'),
    mk(P.teMatariki, 'outside Te Matariki library', 'Te Matariki'),
  ].filter(Boolean);
  // Mikey hangs round Manurewa town centre.
  const townSpots = [
    mk(P.southmallCarpark, 'at the Southmall car park', 'the Southmall car park'), mk(P.norfolkPine, 'by the big Norfolk pine at Southmall', 'the Norfolk pine at Southmall'),
    mk(P.station, 'at Manurewa station', 'Manurewa station'), mk(P.greatSouthRd, 'at the Great South Road shops', 'the Great South Road shops'),
  ].filter(Boolean);
  let hangout = hangouts[0];
  function placeDarren() {
    hangout = hangouts[hometownHash(hometown) % hangouts.length];
    if (typeof placeJobs === 'function' && JOBS) placeJobs();
    const p = safeSpawn(hangout.pos.x, hangout.pos.z);
    darren.position.set(p.x, groundHeight(p.x, p.z), p.z); darren.rotation.y = hangout.rot;
    darrenState.hp = 3; darrenState.hostile = false; darrenState.down = false; darren.userData.human.reset();
  }
  const storyVars = () => ({ spot: hangout.place, hometown });
  let JOBS = null;
  // ---- Shorty's chapter: Manu's weed man has three people who owe him -------------------------
  const sHome = world.shortyHome, pHome = world.pitaHome;
  const shorty = person(sHome.pos.x, sHome.pos.z, { look: 'shorty', seed: 9001, skin: 0x6b4029, top: 0x1f3a2a, topCell: ATLAS.cotton, pants: 0x2a2a2a, pantsCell: ATLAS.track, face: ATLAS.faceC, beanie: 0x2f5a2a, pose: 'crossed', scale: 1.12 });
  shorty.rotation.y = sHome.rot;
  const kevSpot = { ...places.panelShop, place: 'the panel shop off Weymouth Road' };
  JOBS = {
    kev: { name: 'KEV', amount: 600, spot: kevSpot, npc: person(0, 0, { look: 'kev', seed: 31, skin: 0xa86f4c, top: 0x34506a, topCell: ATLAS.canvas, pants: 0x34506a, pantsCell: ATLAS.canvas, face: ATLAS.faceC, shoes: 0x222222, scale: 1.08 }) },
    mikey: { name: 'MIKEY', amount: 300, spot: null, npc: person(0, 0, { look: 'mikey', seed: 77, skin: 0xe0b090, top: 0x8a2a3a, topCell: ATLAS.cotton, pants: 0x2a2a2a, pantsCell: ATLAS.track, face: ATLAS.faceB, beanie: 0x222244, shoes: 0xf0f0f0, scale: 0.92 }) },
    pita: { name: 'UNCLE PITA', amount: 150, spot: { ...pHome, place: pHome.address }, npc: person(0, 0, { look: 'pita', seed: 61, skin: 0x7a4b31, top: 0x5a4a3a, topCell: ATLAS.knit, pants: 0x4a4a4a, pantsCell: ATLAS.canvas, face: ATLAS.faceC, beanie: 0x8a8a8a, pose: 'relaxed', scale: 0.96 }) },
  };
  let jobState = { kev: 'open', mikey: 'open', pita: 'open' }, shortyTimer = 0;
  const kevRun = { hp: 4, down: false, attackT: 0 }, mikeyRun = { fleeing: false, burst: 0, tired: 0, escapedT: 0, barked: false };
  const shortyMarker = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), markerMat(0x9fd86a)); shortyMarker.position.y = 2.45; shorty.add(shortyMarker);
  for (const j of Object.values(JOBS)) { j.marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.18), markerMat(0x9fd86a)); j.marker.position.y = 2.2; j.npc.add(j.marker); }
  function placeJobs() {
    JOBS.mikey.spot = townSpots[(hometownHash(hometown) + 1) % townSpots.length];
    for (const j of Object.values(JOBS)) {
      const p = safeSpawn(j.spot.pos.x, j.spot.pos.z);
      j.npc.position.set(p.x, groundHeight(p.x, p.z), p.z); j.npc.rotation.y = j.spot.rot; j.npc.userData.human.reset();
    }
    kevRun.hp = 4; kevRun.down = false; Object.assign(mikeyRun, { fleeing: false, burst: 0, tired: 0, escapedT: 0, barked: false });
  }
  const phoneVars = () => ({ shortyPlace: sHome.address, kevPlace: kevSpot.place, mikeyPlace: JOBS.mikey.spot.place, pitaPlace: pHome.address });
  const jobDone = k => jobState[k] !== 'open' && jobState[k] !== 'fight';
  const collected = () => (jobState.kev === 'paid' ? 600 : 0) + (jobState.mikey === 'paid' ? 300 : 0) + (jobState.pita === 'take' || jobState.pita === 'cover' ? 150 : 0);
  function refreshJobs() {
    const st = { open: 'OPEN', fight: 'SCRAPPING', paid: 'PAID', take: 'PAID', cover: 'YOU COVERED IT', short: 'LET OFF' };
    const list = ['shorty-jobs', 'shorty-return'].includes(stage) ? Object.entries(JOBS).map(([k, j]) => ({ name: j.name, amount: j.amount, where: k === 'mikey' ? JOBS.mikey.spot.place + ' (he runs)' : j.spot.place, status: st[jobState[k]], done: jobDone(k) })) : [];
    if (hustle) list.push({ name: hustle.name, amount: hustle.amount, where: hustle.street, status: hustle.state === 'done' ? 'PAID' : hustle.state === 'fight' ? 'SCRAPPING' : 'OPEN', done: hustle.state === 'done' });
    phone.setJobs(list);
  }
  function checkJobs() {
    refreshJobs();
    if (stage === 'shorty-jobs' && ['kev', 'mikey', 'pita'].every(jobDone)) {
      advance('shorty-return', 'That\'s all three. Take the money back to Shorty.');
      phone.receive(TEXTS.shortyDone, phoneVars());
    }
  }
  const dist = p => Math.hypot(camera.position.x - p.x, camera.position.z - p.z);
  function objective() {
    if (stage === 'prologue') return ['Finish your game with Manu.', null];
    if (stage === 'debt-find') return [`Find Darren ${hangout.label} and collect Manu's $400.`, darren.position];
    if (stage === 'debt-fight') return ['Darren wants to scrap. Knock him down.', darren.position];
    if (stage === 'debt-return') return [`Take the $${debtCash} back to Manu at his place.`, manu.position];
    if (stage === 'shorty-wait') return ['Manu\'s passing your number on. Keep your phone handy.', null];
    if (stage === 'shorty-meet') return [`Go see Shorty at his place on ${sHome.address}.`, shorty.position];
    if (stage === 'shorty-jobs') {
      const open = Object.entries(JOBS).filter(([k]) => !jobDone(k)).sort((a, b) => dist(a[1].npc.position) - dist(b[1].npc.position));
      return [`Collect for Shorty (${3 - open.length}/3): ${open.map(([, j]) => j.name.replace('UNCLE ', '')).join(', ')}. Check JOBS on your phone.`, open[0]?.[1].npc.position || shorty.position];
    }
    if (stage === 'shorty-return') return [`Take the $${collected()} back to Shorty on ${sHome.address}.`, shorty.position];
    if (stage === 'recruit') return ['Meet a faction contact (coloured markers).', contacts[0].p.position];
    if (stage === 'faction-choice') return [`Talk to ${chosen} to choose your initiation.`, contacts.find(c => c.f === chosen)?.p.position || fixer.position];
    if (stage === 'mission-courier') return [`${chosen}: recover the package from the green marker.`, stash.position];
    if (stage === 'mission-brawl') { const living = enemies.filter(e => e.alive).sort((a, b) => dist(a.p.position) - dist(b.p.position)); return [`${chosen}: defeat three hostile opponents (${defeated}/3).`, living[0]?.p.position || null]; }
    if (stage === 'mission-return') return [`Return to the fixer for the ${missionRoute === 'courier' ? 'quiet' : 'loud'} ending.`, fixer.position];
    if (stage === 'complete') return [`Crew chapter done (${chosen}, ${missionRoute} route). Tipene will be in touch.`, null];
    if (stage === 'c1-call') return ['Tipene wants you. Keep your phone handy.', null];
    if (stage === 'c1-car') return ['Get a car (TALK next to any parked car), then pick up Manu at his place.', manu.position];
    if (stage === 'c1-pickup') return ['Drive to the Southmall car park and see Rawiri.', rawiri.position];
    if (stage === 'c1-deliver') return [heat.level > 0 ? 'Lose the cops, then take the parcel to Tipene at Clendon skate park.' : 'Take the parcel to Tipene at Clendon skate park.', fixer.position];
    if (stage === 'c1-dairy') return ['See Aunty Lani at Clendon Dairy.', lani.position];
    if (stage === 'c1-rivals') return [`Deal with the ${rivalCrew()} boys at Clendon skate park.`, c1.rivals.find(r => r.alive)?.p.position || places.skatepark.pos];
    if (stage === 'c1-wait') return ['Aunty Lani\'s dairy is quiet. Keep your phone handy.', null];
    if (stage === 'c1-manu') return ['Manu got jumped at Manurewa station. Get there and sort them out.', manu.position];
    if (stage === 'c1-home') return [c1.manuInCar ? 'Drive Manu home.' : 'Get Manu into a car (drive up to him).', c1.manuInCar ? home.pos : manu.position];
    if (stage === 'c1-done') return ['CHAPTER ONE COMPLETE. Shorty still texts jobs; more chapters to come.', null];
    return [`Chapter complete: ${hometown} / ${chosen} / ${missionRoute} route.`, null];
  }
  function updateHUD() {
    $('status').textContent = `HP ${Math.ceil(hp)} | ENERGY ${Math.ceil(stamina)}${boostT > 0 ? '⚡' : ''} | $${cash} | REP ${rep}${strength ? ' | PWR ' + strength : ''}${heat.level > 0 ? ' | HEAT ' + '★'.repeat(heat.stars) : ''} | ${chosen.toUpperCase()}`;
    const [goal, target] = objective(); $('quest').textContent = goal; $('status').setAttribute('title', `${hometown} | ${originRegion}`);
    const side = hustle && hustle.state !== 'done' ? ` · HUSTLE ${hustle.name} ${Math.round(dist(hustle.npc.position))}m` : '';
    if (target) $('missionDistance').textContent = `OBJECTIVE ${Math.round(dist(target))}m away${side}`;
    else $('missionDistance').textContent = (stage === 'mission-brawl' ? 'Find hostiles on the outskirts' : 'Story branch recorded') + side;
  }
  function store() {
    if (!saveAllowed || !started) return;
    try {
      const data = { version: 2, map: MAP_VERSION, strength, stage, hometown, originRegion, chosen, rep, hp, cash, defeated, missionRoute, stamina, debtRoute, debtCash, jobs: jobState, phone: phone.log.slice(-40), enemyHP: enemies.map(e => e.hp), enemyAlive: enemies.map(e => e.alive), enemyPositions: enemies.map(e => ({ x: e.p.position.x, z: e.p.position.z })), x: drive.car ? drive.car.x : camera.position.x, z: drive.car ? drive.car.z : camera.position.z, yaw, pitch };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data)); $('saveState').textContent = 'Saved on this device';
    } catch (e) { $('saveState').textContent = 'Local save unavailable in this browser'; }
  }
  function readSave() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (!s || s.version !== 2 || typeof s.hometown !== 'string' || !Object.values(ORIGINS).some(ts => ts.includes(s.hometown)) || !VALID_STAGES.includes(s.stage)) return null;
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
      if (inPrologue) { prologue.abort(); inPrologue = false; }
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
    saveAllowed = true; stage = 'prologue'; hp = 100; cash = 0; rep = 0; chapter = 0; defeated = 0; missionRoute = ''; stamina = 100; debtRoute = ''; debtCash = 0; strength = 0; endHustle(true);
    if (drive.car) exitCar();
    heat.level = 0; police.clear(); c1.timer = 25; stage = 'prologue'; placeChapterOne();
    jobState = { kev: 'open', mikey: 'open', pita: 'open' }; phone.clear();
    placeDarren();
    enemies.forEach(resetEnemy);
    while (fx.children.length) fx.remove(fx.children[0]);
    startPrologue();
    storePaused();
  }
  // Friday night at Manu's: the couch, the console and the conversation, then out onto the street.
  function startPrologue() {
    $('panel').style.display = 'none'; $('choicePanel').style.display = 'none'; $('pausePanel').style.display = 'none';
    pauseOpen = false; started = false; inPrologue = true;
    CHIP.ensure();
    prologue.start(storyVars(), () => {
      inPrologue = false; stage = 'debt-find';
      const sp = home.spawn;
      camera.position.set(sp.pos.x, groundHeight(sp.pos.x, sp.pos.z) + EYE, sp.pos.z); yaw = sp.rot + Math.PI; pitch = 0;
      closeMenus(); say(`Darren owes Manu $400. Find him ${hangout.label}.`); store();
    });
  }
  function restore(s) {
    hometown = s.hometown; originRegion = s.originRegion || Object.entries(ORIGINS).find(([, ts]) => ts.includes(s.hometown))?.[0] || 'Northland';
    chosen = FACTIONS.includes(s.chosen) ? s.chosen : 'Independent';
    if (drive.car) exitCar();
    stage = s.stage; placeDarren();
    debtRoute = ['smooth', 'hard'].includes(s.debtRoute) ? s.debtRoute : ''; debtCash = [200, 400].includes(s.debtCash) ? s.debtCash : 0;
    if (stage === 'debt-fight') darrenState.hostile = true;
    const sj = s.jobs || {}, okJob = v => ['open', 'fight', 'paid', 'take', 'cover', 'short'].includes(v);
    jobState = { kev: okJob(sj.kev) ? sj.kev : 'open', mikey: okJob(sj.mikey) ? sj.mikey : 'open', pita: okJob(sj.pita) ? sj.pita : 'open' };
    if (jobState.mikey === 'fight') jobState.mikey = 'open';
    phone.load(Array.isArray(s.phone) ? s.phone.slice(-40) : []); shortyTimer = 6; refreshJobs(); rep = Math.max(0, Number(s.rep) || 0); hp = Math.min(100, Math.max(1, Number(s.hp) || 100)); cash = Math.max(0, Number(s.cash) || 0);
    defeated = Math.max(0, Number(s.defeated) || 0); missionRoute = s.missionRoute || '';
    stamina = Number.isFinite(s.stamina) ? Math.max(0, Math.min(100, s.stamina)) : 100;
    strength = clamp(Math.floor(Number(s.strength) || 0), 0, 3);
    // Saves from before the real map (Run 15 and earlier) used the fictional grid: put the player outside Manu's.
    const sameMap = s.map === MAP_VERSION, hs = home.spawn.pos;
    const p = sameMap && Number.isFinite(s.x) && Number.isFinite(s.z) ? safeSpawn(clamp(s.x, MAP_BOUNDS.x0, MAP_BOUNDS.x1), clamp(s.z, MAP_BOUNDS.z0, MAP_BOUNDS.z1)) : { x: hs.x, z: hs.z };
    camera.position.set(p.x, groundHeight(p.x, p.z) + EYE, p.z);
    yaw = Number.isFinite(s.yaw) ? s.yaw : 0; pitch = Number.isFinite(s.pitch) ? s.pitch : 0;
    enemies.forEach((e, i) => {
      e.hp = Number.isFinite(s.enemyHP?.[i]) ? s.enemyHP[i] : 3; e.alive = s.enemyAlive?.[i] !== false; e.dyingT = 0; e.p.userData.human.reset();
      const pos = sameMap ? s.enemyPositions?.[i] : null;
      const q = safeSpawn(Number.isFinite(pos?.x) ? pos.x : enemySpawns[i].x, Number.isFinite(pos?.z) ? pos.z : enemySpawns[i].z);
      e.p.position.set(q.x, groundHeight(q.x, q.z), q.z);
      if (e.alive && !e.p.parent) scene.add(e.p); if (!e.alive && e.p.parent) scene.remove(e.p);
    });
    select.value = hometown;
    heat.level = 0; police.clear(); c1.timer = stage === 'c1-wait' ? 20 : 25; placeChapterOne();
    if (stage === 'prologue') { startPrologue(); return; }
    closeMenus(); say(`Welcome back to ${hometown}. Your ${chosen} story continues.`);
  }
  function advance(next, message) { stage = next; say(message); updateHUD(); store(); }
  const faceEachOther = p => { p.rotation.y = Math.atan2(camera.position.x - p.position.x, camera.position.z - p.position.z); };
  function talk() {
    if (dlg.active) { dlg.advance(); return; }
    if (!started || pauseOpen) return;
    if (drive.car) { exitCar(); return; }
    if (stage === 'debt-find' && dist(darren.position) < 4.5) {
      faceEachOther(darren);
      dlg.run('darrenMeet', storyVars(), r => {
        if (r === 'smooth') { debtRoute = 'smooth'; debtCash = 200; advance('debt-return', 'Darren paid $200 and swears the rest is coming Friday. Take it to Manu.'); }
        else if (r === 'fight') { debtRoute = 'hard'; darrenState.hostile = true; advance('debt-fight', 'Darren wants to scrap. Knock him down. HIT when he is in front of you.'); }
      });
      return;
    }
    if (stage === 'debt-return' && dist(manu.position) < 4.5) {
      faceEachOther(manu);
      dlg.run(debtRoute === 'hard' ? 'returnHard' : 'returnSmooth', storyVars(), () => {
        const cut = debtRoute === 'hard' ? 100 : 50; cash += cut; rep += debtRoute === 'hard' ? 30 : 15;
        shortyTimer = 9; advance('shorty-wait', `Manu gave you $${cut}. He's passing your number to Shorty.`);
      });
      return;
    }
    if (dist(manu.position) < 4.5 && (stage === 'debt-find' || stage === 'debt-fight')) { faceEachOther(manu); dlg.run('manuWaiting', storyVars(), null); return; }
    if (dist(manu.position) < 4.5 && (stage === 'shorty-wait' || stage === 'shorty-meet')) { faceEachOther(manu); dlg.run('manuAfter', storyVars(), null); return; }
    if (dist(shorty.position) < 4.5 && stage === 'shorty-meet') {
      faceEachOther(shorty);
      dlg.run('shortyMeet', storyVars(), r => { if (r === 'jobs') { advance('shorty-jobs', 'Shorty texted you the three names. Open JOBS on your phone.'); phone.receive(TEXTS.shortyJobs, phoneVars(), () => refreshJobs()); refreshJobs(); } });
      return;
    }
    if (dist(shorty.position) < 4.5 && stage === 'shorty-jobs') { faceEachOther(shorty); dlg.run('shortyWaiting', storyVars(), null); return; }
    if (dist(shorty.position) < 4.5 && stage === 'shorty-return') {
      faceEachOther(shorty);
      const seq = jobState.pita === 'cover' ? 'shortyBackCovered' : jobState.pita === 'short' ? 'shortyBackShort' : 'shortyBackAll';
      dlg.run(seq, storyVars(), () => {
        const cut = Math.max(0, Math.round(collected() * 0.25) - (jobState.pita === 'short' ? 150 : 0));
        cash += cut; rep += 25 + (jobState.pita === 'short' ? 0 : 10);
        advance(chosen === 'Independent' ? 'recruit' : 'faction-choice', `Shorty paid you $${cut}. ${chosen === 'Independent' ? 'The crews at the square want to meet you.' : `Go talk to ${chosen} at the square.`}`);
      });
      return;
    }
    if (stage === 'shorty-jobs' || stage === 'shorty-return') {
      const near = Object.entries(JOBS).filter(([, j]) => dist(j.npc.position) < 4.5).sort((a, b) => dist(a[1].npc.position) - dist(b[1].npc.position))[0];
      if (near) {
        const [k, j] = near; faceEachOther(j.npc);
        if (k === 'kev' && jobState.kev === 'open') {
          dlg.run('kevMeet', storyVars(), r => { if (r === 'fight') { jobState.kev = 'fight'; refreshJobs(); say('Kev wants to scrap. Knock him down.'); } });
          return;
        }
        if (k === 'mikey' && jobState.mikey === 'open') { catchMikey(); return; }
        if (k === 'pita' && jobState.pita === 'open') {
          dlg.run('pitaMeet', storyVars(), r => {
            if (r === 'take') { jobState.pita = 'take'; say('Uncle Pita paid $150.'); }
            else if (r === 'cover') {
              if (cash >= 150) { cash -= 150; jobState.pita = 'cover'; say('You paid Pita\'s $150 out of your own pocket.'); }
              else { jobState.pita = 'short'; say('You let Uncle Pita off. Shorty will take it out of your cut.'); }
            }
            updateHUD(); store(); checkJobs();
          });
          return;
        }
        if (jobDone(k)) { dlg.run(k === 'kev' ? 'kevAgain' : k === 'mikey' ? 'mikeyAgain' : 'pitaAgain', storyVars(), null); return; }
      }
    }
    if (debtRoute && stage !== 'debt-fight' && dist(darren.position) < 4.5 && !darrenState.down) { faceEachOther(darren); dlg.run('darrenAgain', storyVars(), null); return; }
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
    if (stage === 'mission-return' && dist(fixer.position) < 5) { cash += missionRoute === 'courier' ? 100 : 60; rep += missionRoute === 'courier' ? 15 : 35; advance('complete', `${hometown} ending: ${chosen} now knows your name. ${missionRoute === 'courier' ? 'Quiet route: more cash, less heat.' : 'Loud route: more reputation, more enemies.'} CHAPTER COMPLETE.`); return; }
    if (stage === 'c1-pickup' && dist(rawiri.position) < 4.5) { faceEachOther(rawiri); dlg.run('c1Rawiri', {}, () => advance('c1-deliver', 'Rawiri handed over the parcel. Take it to Tipene at Clendon skate park.')); return; }
    if (stage === 'c1-deliver' && dist(fixer.position) < 5) {
      faceEachOther(fixer);
      if (heat.level > 0.2) { dlg.run('c1Hot', {}, null); return; }
      dlg.run('c1Deliver', {}, () => { cash += 200; rep += 20; if (c1.manuInCar) manuOut(home.pos.x, home.pos.z); else { manu.position.set(home.pos.x, groundHeight(home.pos.x, home.pos.z), home.pos.z); } lani.visible = true; advance('c1-dairy', 'Tipene paid you $200. Aunty Lani at Clendon Dairy wants a word.'); });
      return;
    }
    if (stage === 'c1-dairy' && dist(lani.position) < 4.5) { faceEachOther(lani); dlg.run('c1Lani', { rival: rivalCrew() }, () => { placeRivals('park'); advance('c1-rivals', `The ${rivalCrew()} boys hang round Clendon skate park. Go have a word.`); }); return; }
    if (stage === 'c1-rivals') {
      const lead = c1.rivals.slice(0, 3).find(r => r.alive && !r.hostile && dist(r.p.position) < 5);
      if (lead) {
        faceEachOther(lead.p); CAST.rival.name = rivalCrew().toUpperCase();
        dlg.run('c1Rivals', {}, r => {
          if (r === 'talk' && rep >= 160) dlg.run('c1RivalsBackOff', {}, () => { c1.rivals.slice(0, 3).forEach(x => { x.alive = false; x.p.visible = false; }); rep += 10; c1.timer = 20; advance('c1-wait', 'They backed off. Aunty Lani\'s sorted.'); });
          else dlg.run('c1RivalsFight', {}, () => { c1.rivals.slice(0, 3).forEach(x => { if (x.alive) x.hostile = true; }); peds.scare(camera.position.x, camera.position.z); say('Three on one. Block, step back, hit back.'); });
        });
        return;
      }
    }
    if (stage === 'c1-manu' && dist(manu.position) < 4.5 && !c1.rivals.slice(3).some(r => r.alive)) { faceEachOther(manu); manu.userData.human.reset(); dlg.run('c1ManuDown', { rival: rivalCrew() }, () => advance('c1-home', 'Get Manu into a car and take him home.')); return; }
    if (stage === 'c1-done' || stage === 'complete') { if (dist(manu.position) < 4.5) { faceEachOther(manu); dlg.run('manuAfter', storyVars(), null); return; } }
    if (hustle && dist(hustle.npc.position) < 4.5 && hustle.npc.visible) { talkHustle(); return; }
    const shop = shops.nearest(camera.position); if (shop) { openShop(shop); return; }
    const car = drive.nearest(camera.position); if (car) { enterCar(car); return; }
    if (stage === 'complete') { say(`Chapter complete. ${hometown} → ${chosen} → ${missionRoute}. Try a different origin and route for a different ending.`); return; }
    say(`Follow your current objective. ${objective()[0]}`);
  }
  // ---- driving -------------------------------------------------------------------------
  let orbit = 0, lastDriveYaw = 0;
  function enterCar(c) {
    const car = drive.enter(c); orbit = 0; yaw = car.h + Math.PI; lastDriveYaw = yaw; pitch = -0.14;
    if (c1.manuInCar && manu.parent !== car.group) manuIntoCar();
    document.body.classList.add('driving'); setRun(false); say('Joystick or W/S to drive, steer left/right. TALK (E) to get out. HIT honks.');
  }
  function exitCar() {
    const p = drive.exit(); if (!p) return;
    camera.position.set(p.x, groundHeight(p.x, p.z) + EYE, p.z); pitch = 0;
    document.body.classList.remove('driving'); $('speedo').style.display = 'none'; store();
  }
  // ---- shops ---------------------------------------------------------------------------
  function openShop(shop) {
    started = false; if (document.pointerLockElement) document.exitPointerLock();
    shops.open(shop, {
      cash: () => cash, spend: n => { cash -= n; }, heal: n => { hp = Math.min(100, hp + n); }, energy: (n, b) => { stamina = Math.min(100, stamina + n); boostT = Math.max(boostT, b); },
      rep: n => { rep += n; }, strength: () => strength, train: () => { strength = Math.min(3, strength + 1); }, say,
      close: () => { started = true; updateHUD(); store(); },
    });
  }
  $('shopClose').onclick = () => shops.close();
  // ---- Shorty's ongoing hustles ------------------------------------------------------------
  const HUSTLE_NAMES = ['BIG T', 'JOJO', 'SIONE', 'TANE', 'LOGAN', 'MOSES', 'JAYDEN', 'KANE', 'TYSON', 'RAWIRI', 'MALAKAI', 'BRAYDEN', 'TAVITA', 'HEMI', 'NIKO', 'ZANE'];
  const debtors = ['crewA', 'crewB', 'crewC'].map((look, i) => { const p = person(0, 0, { look, seed: 500 + i * 37, top: 0x2a2a2a, pants: 0x333333, pantsCell: ATLAS.track, face: ATLAS.faceB, pose: 'relaxed' }); p.visible = false; return p; });
  let hustle = null, hustleTimer = 90;
  // People on the footpaths (realistic bodies on MEDIUM and up).
  const PED_LOOKS = ['pedF1', 'pedM1', 'pedF2', 'pedM2', 'pedF3', 'crewC', 'pedF1', 'pedM2'];
  const peds = new Pedestrians(world, traffic.nodes, PED_LOOKS.slice(0, world.pedCount ?? 6).map((look, i) => { const p = person(0, 0, { look, seed: 900 + i * 53, top: [0x7a2a3a, 0x2a4a6a, 0xd8d0c0, 0x3a5a3a][i % 4], pants: 0x2a2a30, face: [ATLAS.faceA, ATLAS.faceB][i % 2], pose: 'relaxed' }); p.visible = false; return p; }));
  // ---- Chapter One cast: Tipene (the fixer), Rawiri, Aunty Lani, the rival crew ------------------
  const rivalCrew = () => FACTIONS[((FACTIONS.indexOf(chosen) + 18) % FACTIONS.length + FACTIONS.length) % FACTIONS.length] || 'Southside Hornets';
  const rawiri = person(places.southmallCarpark.pos.x, places.southmallCarpark.pos.z, { look: 'crewB', seed: 1201, top: 0x3a3a3a, pants: 0x2a2a2a, face: ATLAS.faceC, pose: 'crossed' });
  const lani = person(places.clendonDairy.pos.x, places.clendonDairy.pos.z, { look: 'pedF3', seed: 1202, top: 0x8a4a6a, pants: 0x3a3a3a, face: ATLAS.faceA, pose: 'crossed' });
  const c1 = { manuInCar: false, timer: 25, rivals: [] };
  for (let i = 0; i < 5; i++) { const p = person(0, 0, { look: ['crewA', 'pedM2', 'crewC', 'crewA', 'pedM2'][i], seed: 1300 + i * 17, top: 0x8a1a1a, pants: 0x222222, face: ATLAS.faceB, pose: 'relaxed' }); p.visible = false; c1.rivals.push({ p, hp: 3, alive: false, hostile: false, attackT: 1, windup: 0 }); }
  function placeRivals(group) {
    const base = group === 'park' ? places.skatepark.pos : places.station.pos, list = group === 'park' ? c1.rivals.slice(0, 3) : c1.rivals.slice(3);
    c1.rivals.forEach(r => { if (!list.includes(r)) { r.p.visible = false; r.alive = false; } });
    list.forEach((r, i) => { const sp = safeSpawn(base.x + Math.cos(i * 2.1) * 3, base.z + Math.sin(i * 2.1) * 3); r.p.position.set(sp.x, groundHeight(sp.x, sp.z), sp.z); r.p.visible = true; r.alive = true; r.hp = 3; r.hostile = group === 'station'; r.windup = 0; r.p.userData.human.reset(); });
  }
  function manuIntoCar() {
    const car = drive.car; if (!car) return;
    car.group.add(manu); manu.position.set(0.42, 0.02, 0.1); manu.rotation.set(0, 0, 0); manu.userData.human.pose = 'seated'; manu.userData.human.reset(); c1.manuInCar = true; manuMarker.visible = false;
  }
  function manuOut(x, z) {
    const wp = new THREE.Vector3(); manu.getWorldPosition(wp);
    scene.add(manu); const sp = safeSpawn(x ?? wp.x, z ?? wp.z); manu.position.set(sp.x, groundHeight(sp.x, sp.z), sp.z); manu.rotation.set(0, home.rot, 0);
    manu.userData.human.pose = 'crossed'; manu.userData.human.reset(); c1.manuInCar = false;
  }
  // Where Manu and the Chapter One cast belong for a given stage (new game, restore, transitions).
  function placeChapterOne() {
    if (c1.manuInCar) manuOut(home.pos.x, home.pos.z);
    const atStation = stage === 'c1-manu' || stage === 'c1-home';
    if (atStation) { const sp = safeSpawn(places.station.pos.x + 2, places.station.pos.z + 2); manu.position.set(sp.x, groundHeight(sp.x, sp.z), sp.z); if (stage === 'c1-manu') manu.userData.human.knockDown(); }
    else { manu.position.set(home.pos.x, groundHeight(home.pos.x, home.pos.z), home.pos.z); manu.rotation.y = home.rot; manu.userData.human.reset(); }
    rawiri.visible = stage === 'c1-pickup' || stage === 'c1-car'; lani.visible = STAGES.indexOf(stage) >= STAGES.indexOf('c1-dairy');
    if (stage === 'c1-rivals') placeRivals('park'); else if (stage === 'c1-manu') placeRivals('station'); else c1.rivals.forEach(r => { r.p.visible = false; r.alive = false; });
    CAST.rival.name = rivalCrew().toUpperCase();
  }
  function startHustle() {
    const near = world.city.houses.filter(h => { const d = dist(h.pos); return d > 250 && d < 1400; });
    if (!near.length) return;
    const house = near[Math.floor(rnd() * near.length)], amount = [120, 150, 200, 250, 300, 400, 500][Math.floor(rnd() * 7)];
    const npc = debtors[Math.floor(rnd() * debtors.length)]; debtors.forEach(d => { d.visible = false; });
    const p = safeSpawn(house.pos.x, house.pos.z); npc.position.set(p.x, groundHeight(p.x, p.z), p.z); npc.rotation.y = house.rot; npc.visible = true; npc.userData.human.reset();
    hustle = { name: HUSTLE_NAMES[Math.floor(rnd() * HUSTLE_NAMES.length)], amount, street: house.address, npc, type: rnd() < (amount >= 300 ? 0.6 : 0.3) ? 'fights' : 'pays', state: 'open', hp: 3 + amount / 200, attackT: 1, windup: 0 };
    phone.receive(TEXTS.hustleNew, { name: hustle.name, amount: '$' + amount, street: hustle.street }, () => refreshJobs());
    refreshJobs();
  }
  function endHustle(reset) { if (hustle && reset) hustle.npc.visible = false; if (reset) hustle = null; hustleTimer = reset ? 90 : 150 + rnd() * 90; refreshJobs?.(); }
  function hustlePaid(extraRep = 0) {
    const cut = Math.round(hustle.amount * 0.25); cash += cut; rep += 4 + extraRep; hustle.state = 'done';
    phone.receive(TEXTS.hustlePaid, { cut: '$' + cut }); say(`${hustle.name} paid up. Shorty's flicking you $${cut}.`);
    endHustle(false); updateHUD(); store(); refreshJobs();
  }
  function talkHustle() {
    const hz = hustle, v = { amount: '$' + hz.amount }; faceEachOther(hz.npc); CAST.debtor.name = hz.name;
    if (hz.state === 'done') { dlg.run('hustleAgain', v, null); return; }
    if (hz.state === 'fight') return;
    dlg.run('hustleMeet', v, r => {
      if (hz.type === 'pays' || (r === 'threat' && rnd() < 0.5)) dlg.run(r === 'threat' ? 'hustleScared' : 'hustlePays', v, () => hustlePaid(r === 'threat' ? 1 : 0));
      else dlg.run('hustleRefuses', v, () => { hz.state = 'fight'; refreshJobs(); say(`${hz.name} wants to scrap. Block his punches (BLOCK / Q) and hit back.`); });
    });
  }
  function catchMikey() {
    mikeyRun.fleeing = false; faceEachOther(JOBS.mikey.npc);
    dlg.run('mikeyCaught', storyVars(), () => { jobState.mikey = 'paid'; say('Mikey paid $300.'); updateHUD(); store(); checkJobs(); });
  }
  function hit() {
    if (drive.car) { drive.audio.horn(); return; }
    if (!started || pauseOpen || dlg.active || blocking()) return;
    const now = performance.now(); if (now - lastPunch < 300) return;
    combo = now - lastPunch < 900 ? combo + 1 : 1; lastPunch = now;
    const heavy = combo % 3 === 0, dmg = (heavy ? 2 : 1) * (1 + strength * 0.25), push = heavy ? 0.9 : 0.45, cone = mobile ? 0.3 : 0.45;
    fists.swing();
    const forward = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
    const landed = () => { world.shake = heavy ? 0.32 : 0.18; if (heavy) say('Heavy hit!'); };
    if (hustle && hustle.state === 'fight') {
      const n = hustle.npc, delta = n.position.clone().add(new THREE.Vector3(0, 1.4, 0)).sub(camera.position), d = delta.length();
      if (d < 4 && delta.normalize().dot(forward) > cone) {
        hustle.hp -= dmg; bloodAt(n.position); slideMove(n.position, forward.x * push, forward.z * push, 0.4); n.userData.human.hit(); landed();
        if (hustle.hp <= 0) { hustle.state = 'down'; n.userData.human.knockDown(); setTimeout(() => { CAST.debtor.name = hustle.name; dlg.run('hustleBeaten', {}, () => { n.userData.human.reset(); hustlePaid(3); }); }, 1300); }
        return;
      }
    }
    if (stage === 'debt-fight' && !darrenState.down) {
      const delta = darren.position.clone().add(new THREE.Vector3(0, 1.4, 0)).sub(camera.position), d = delta.length();
      if (d < 4 && delta.normalize().dot(forward) > cone) {
        darrenState.hp -= dmg; bloodAt(darren.position); slideMove(darren.position, forward.x * push, forward.z * push, 0.4);
        landed(); darren.userData.human.hit();
        if (darrenState.hp <= 0) {
          darrenState.down = true; darrenState.hostile = false; darren.userData.human.knockDown(); rep += 5;
          say('Darren is down.');
          setTimeout(() => dlg.run('darrenBeaten', storyVars(), () => {
            debtCash = 400; darren.userData.human.reset(); darrenState.down = false;
            advance('debt-return', 'Darren handed over the full $400. Take it to Manu.');
          }), 1400);
        } else say('Hit landed.');
        updateHUD(); return;
      }
    }
    if (jobState.kev === 'fight' && !kevRun.down) {
      const kev = JOBS.kev.npc, delta = kev.position.clone().add(new THREE.Vector3(0, 1.4, 0)).sub(camera.position), d = delta.length();
      if (d < 4 && delta.normalize().dot(forward) > cone) {
        kevRun.hp -= dmg; bloodAt(kev.position); slideMove(kev.position, forward.x * push * 0.8, forward.z * push * 0.8, 0.4);
        landed(); kev.userData.human.hit();
        if (kevRun.hp <= 0) {
          kevRun.down = true; kev.userData.human.knockDown(); rep += 8; say('Kev is down.');
          setTimeout(() => dlg.run('kevBeaten', storyVars(), () => { kev.userData.human.reset(); kevRun.down = false; jobState.kev = 'paid'; say('Kev paid $600.'); updateHUD(); store(); checkJobs(); }), 1400);
        } else say('Hit landed. Kev is tough.');
        updateHUD(); return;
      }
    }
    let target = null, score = 99;
    for (const e of enemies) {
      if (!e.alive) continue;
      const delta = e.p.position.clone().add(new THREE.Vector3(0, 1.4, 0)).sub(camera.position), d = delta.length();
      if (d < 4 && delta.normalize().dot(forward) > cone && d < score) { target = e; score = d; }
    }
    // Chapter One rivals.
    for (const r of c1.rivals) {
      if (!r.alive || !r.p.visible) continue;
      const delta = r.p.position.clone().add(new THREE.Vector3(0, 1.4, 0)).sub(camera.position), d = delta.length();
      if (d < 4 && delta.normalize().dot(forward) > cone) {
        r.hostile = true; r.hp -= dmg; bloodAt(r.p.position); slideMove(r.p.position, forward.x * push, forward.z * push, 0.4); r.p.userData.human.hit(); landed();
        if (r.hp <= 0) { r.alive = false; r.p.userData.human.knockDown(); rep += 4; heat.add(0.5); peds.scare(r.p.position.x, r.p.position.z); }
        updateHUD(); return;
      }
    }
    if (!target) {
      // Innocent bystanders: they go down, everyone else scatters, and the cops hear about it.
      const ped = peds.near(camera.position.x, camera.position.z, 3.5).find(a => { const v = a.p.position.clone().add(new THREE.Vector3(0, 1.4, 0)).sub(camera.position).normalize(); return v.dot(forward) > cone; });
      if (ped) { peds.knock(ped); bloodAt(ped.p.position); landed(); heat.add(1); peds.scare(camera.position.x, camera.position.z); say('You just laid out a random. Someone\'s calling the cops.'); updateHUD(); }
      return;
    }
    target.hp -= dmg; bloodAt(target.p.position); slideMove(target.p.position, forward.x * push, forward.z * push, 0.4);
    landed(); target.p.userData.human.hit();
    if (target.hp <= 0) {
      target.alive = false; target.dyingT = 0.0001; target.p.userData.human.knockDown(); rep += 5; heat.add(0.4); peds.scare(target.p.position.x, target.p.position.z);
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
  select.onchange = () => { originUpdate(); placeDarren(); $('originStory').textContent = `${hometown}, ${originRegion}. You and your cousin Manu grew up here.`; };
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
  $('restart').onclick = () => { if (document.pointerLockElement) document.exitPointerLock(); if (inPrologue) { prologue.abort(); inPrologue = false; } started = false; pauseOpen = false; $('pausePanel').style.display = 'none'; $('panel').style.display = 'grid'; refreshContinue(); };
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
  // Static map of the real streets and buildings, drawn once at 1 px per 2 m.
  const C0 = MAPDATA.meta.crop, MAP_PX = 0.5, mapCanvas = document.createElement('canvas');
  mapCanvas.width = Math.ceil((C0.x1 - C0.x0) * MAP_PX); mapCanvas.height = Math.ceil((C0.z1 - C0.z0) * MAP_PX);
  {
    const g = mapCanvas.getContext('2d'), X = x => (x - C0.x0) * MAP_PX, Z = z => (z - C0.z0) * MAP_PX;
    g.fillStyle = '#0d2622'; g.fillRect(0, 0, mapCanvas.width, mapCanvas.height);
    g.fillStyle = '#1e3a35';
    for (const bd of world.city.map.buildings) { g.beginPath(); bd.ring.forEach((p, k) => k ? g.lineTo(X(p[0]), Z(p[1])) : g.moveTo(X(p[0]), Z(p[1]))); g.closePath(); g.fill(); }
    g.strokeStyle = '#4d6b63'; g.lineCap = 'round'; g.lineJoin = 'round';
    for (const r of world.city.map.roadInfo) { g.lineWidth = Math.max(2, r.w * MAP_PX * 1.4); g.beginPath(); r.pts.forEach((p, k) => k ? g.lineTo(X(p[0]), Z(p[1])) : g.moveTo(X(p[0]), Z(p[1]))); g.stroke(); }
  }
  // Where am I: nearest named street and the suburb, for the HUD and the radar.
  const here = { street: '', suburb: 'Clendon Park' };
  const roadGrid = new Map();
  world.city.map.roadInfo.forEach((r, ri) => { if (!r.name) return; for (let i = 0; i + 1 < r.pts.length; i++) { const a = r.pts[i], b = r.pts[i + 1]; for (let t = 0; t <= 1; t += 0.25) { const k = Math.floor((a[0] + (b[0] - a[0]) * t) / 50) + ',' + Math.floor((a[1] + (b[1] - a[1]) * t) / 50); if (!roadGrid.has(k)) roadGrid.set(k, new Set()); roadGrid.get(k).add(ri * 1000 + i); } } });
  function locate() {
    const x = camera.position.x, z = camera.position.z, cx = Math.floor(x / 50), cz = Math.floor(z / 50); let best = 1e9, name = '';
    for (let i = cx - 1; i <= cx + 1; i++) for (let j = cz - 1; j <= cz + 1; j++) for (const id of roadGrid.get(i + ',' + j) || []) { const r = world.city.map.roadInfo[Math.floor(id / 1000)], k = id % 1000, a = r.pts[k], b = r.pts[k + 1]; const d = segDist2(x, z, a[0], a[1], b[0], b[1]); if (d < best) { best = d; name = r.name; } }
    here.street = name; here.suburb = x < -480 ? 'Clendon Park' : z < -760 && x < 700 ? 'Homai' : 'Manurewa';
    $('location').textContent = `${name ? name + ', ' : ''}${here.suburb}`;
  }
  function drawMiniMap() {
    const c = miniCtx, w = c.canvas.width, h = c.canvas.height, scale = 1.25;
    c.clearRect(0, 0, w, h); c.fillStyle = '#092321'; c.fillRect(0, 0, w, h);
    c.save(); c.translate(w / 2, h / 2); c.rotate(yaw);
    const k = scale / MAP_PX;
    c.drawImage(mapCanvas, (C0.x0 - camera.position.x) * scale, (C0.z0 - camera.position.z) * scale, mapCanvas.width * k, mapCanvas.height * k);
    const dot = (x, z, color, r) => { const dx = (x - camera.position.x) * scale, dz = (z - camera.position.z) * scale; if (Math.abs(dx) > w || Math.abs(dz) > h) return; c.fillStyle = color; c.beginPath(); c.arc(dx, dz, r, 0, TAU); c.fill(); };
    for (const contact of contacts) dot(contact.p.position.x, contact.p.position.z, '#76b1fa', 2.5);
    for (const enemy of enemies) if (enemy.alive) dot(enemy.p.position.x, enemy.p.position.z, '#e96666', 2.5);
    const target = objective()[1]; if (target) dot(target.x, target.z, '#f6d766', 5);
    if (hustle && hustle.state !== 'done') dot(hustle.npc.position.x, hustle.npc.position.z, '#ff9a3c', 4.5);
    if (drive.car) dot(drive.car.x, drive.car.z, '#ffffff', 2);
    c.restore(); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(w / 2, h / 2 - 8); c.lineTo(w / 2 - 6, h / 2 + 7); c.lineTo(w / 2 + 6, h / 2 + 7); c.closePath(); c.fill();
    c.fillStyle = '#b9d5c5'; c.font = '11px sans-serif'; c.fillText(here.suburb.toUpperCase(), 7, 15);
  }

  // ---- fighting ------------------------------------------------------------------------------
  // Opponents telegraph each punch (wind-up, then impact), so you can block or step out of range.
  const KO_HOME = { at: () => home.spawn.pos, msg: 'You got knocked out. You came to outside Manu\'s.', rep: 10 };
  const KO_ENEMY = KO_HOME, KO_DARREN = { at: () => home.spawn.pos, msg: 'Darren dropped you. You came to outside Manu\'s place.', rep: 0 };
  const KO_KEV = { at: () => sHome.spawn.pos, msg: 'Kev dropped you. You came to outside Shorty\'s.', rep: 0 };
  function hurtPlayer(dmg, ko) {
    if (blocking() && stamina > 5) { dmg *= 0.15; stamina = Math.max(0, stamina - 14); world.shake = Math.max(world.shake, 0.06); }
    else { world.hurt = 1; world.shake = Math.max(world.shake, 0.15); }
    hp = Math.max(0, hp - dmg); lastHurt = performance.now();
    if (hp <= 0) {
      const lost = Math.round(cash * 0.1); cash -= lost; hp = 100; rep = Math.max(0, rep - (ko.rep || 0));
      if (drive.car) exitCar();
      const p = ko.at(); camera.position.set(p.x, groundHeight(p.x, p.z) + EYE, p.z);
      say(`${ko.msg}${lost ? ` You got rolled for $${lost} while you were out.` : ''}${ko.rep ? ` Reputation -${ko.rep}.` : ''}`);
      updateHUD(); store();
    }
  }
  function meleeAI(st, h, d, dmg, ko, dt) {
    if (st.windup > 0) { st.windup -= dt; if (st.windup <= 0) { st.attackT = 0.8 + rnd() * 0.7; if (d < 2.1) hurtPlayer(dmg, ko); } return; }
    st.attackT = (st.attackT ?? 0.6) - dt;
    if (d < 1.95 && st.attackT <= 0) { st.windup = 0.42; h.punch(); }
  }
  function busted() {
    const lost = Math.round(cash * 0.3); cash -= lost; heat.level = 0; police.clear();
    if (drive.car) exitCar();
    if (c1.manuInCar) manuOut(home.pos.x, home.pos.z);
    const p = police.station; camera.position.set(p.x, groundHeight(p.x, p.z) + EYE, p.z);
    say(`Busted. A night in the cells at Manurewa station and a $${lost} fine.`); updateHUD(); store();
  }
  // ---- Chapter One per-frame logic ---------------------------------------------------------
  function chapterOne(dt) {
    const rdt = world.realDt || dt;
    if (stage === 'complete' && (c1.timer -= rdt) <= 0) { c1.timer = 1e9; phone.receive(TEXTS.c1Call, {}, () => { rawiri.visible = true; advance('c1-car', 'Tipene texted. Get a car, then pick up Manu at his place.'); }); }
    if ((stage === 'c1-car' || stage === 'c1-home') && drive.car && !c1.manuInCar && Math.hypot(manu.position.x - drive.car.x, manu.position.z - drive.car.z) < 10 && manu.parent === scene) {
      manuIntoCar();
      if (stage === 'c1-car') advance('c1-pickup', 'Manu\'s in. Drive to the Southmall car park and see Rawiri.'); else say('Manu\'s in. Take him home.');
    }
    if (stage === 'c1-home' && c1.manuInCar && drive.car && Math.abs(drive.car.v) < 2.5 && Math.hypot(home.pos.x - drive.car.x, home.pos.z - drive.car.z) < 16) {
      manuOut(home.pos.x, home.pos.z); faceEachOther(manu);
      dlg.run('c1Home', {}, () => { cash += 100; rep += 25; advance('c1-done', 'CHAPTER ONE COMPLETE. Manu\'s home. Tipene reckons you\'re the real deal.'); });
    }
    if (stage === 'c1-wait' && (c1.timer -= rdt) <= 0) {
      c1.timer = 1e9;
      phone.receive(TEXTS.c1ManuJumped, { rival: rivalCrew() }, () => { advance('c1-manu', 'Manu got jumped at Manurewa station. Get there.'); placeChapterOne(); });
    }
    // Rival fights.
    for (const r of c1.rivals) {
      if (!r.alive || !r.p.visible) continue;
      const h = r.p.userData.human, d = dist(r.p.position);
      if (stage === 'c1-manu' && d < 30) r.hostile = true;
      if (!r.hostile) { h.speed = 0; h.mode = 'idle'; continue; }
      let sp = 0;
      if (d < 30 && d > 1.9) { const b0 = r.p.position.clone(); slideMove(r.p.position, (camera.position.x - r.p.position.x) / d * dt * 1.6, (camera.position.z - r.p.position.z) / d * dt * 1.6, 0.4); sp = b0.distanceTo(r.p.position) / Math.max(dt, 1e-4); }
      faceEachOther(r.p); h.speed = sp; h.mode = d < 6 ? 'guard' : 'idle'; r.p.position.y = groundHeight(r.p.position.x, r.p.position.z);
      if (!dlg.active && !drive.car) meleeAI(r, h, d, 9, KO_HOME, dt);
    }
    if (stage === 'c1-rivals' && c1.rivals.slice(0, 3).every(r => !r.alive) && c1.rivals[0].hostile) { c1.timer = 20; rep += 10; advance('c1-wait', 'All three down. Aunty Lani\'s dairy should be quiet now.'); }
  }
  // ---- driving frame: arcade car + chase camera ----------------------------------------------
  function driveFrame(dt, throttle, steer) {
    const near = [];
    for (const p of [...contacts.map(c => c.p), fixer, manu, darren, shorty, ...Object.values(JOBS).map(j => j.npc), ...enemies.filter(e => e.alive).map(e => e.p), ...debtors.filter(d => d.visible)]) if (p.parent && Math.abs(p.position.x - drive.car.x) < 30 && Math.abs(p.position.z - drive.car.z) < 30) near.push({ x: p.position.x, z: p.position.z, r: 0.45 });
    for (const a of peds.agents) if (a.active && a.down <= 0) near.push({ x: a.p.position.x, z: a.p.position.z, r: 0.4, ped: a });
    drive.update(dt, throttle, steer, !!keys.Space, [...traffic.obstacles(), ...police.obstacles(), ...near]);
    if (drive.hit) {
      const o = drive.hit, v = drive.lastImpact || 0; drive.hit = null;
      if (o.ped && v > 4) { peds.knock(o.ped); heat.add(2); peds.scare(drive.car.x, drive.car.z); say('You hit someone. That\'s heat.'); }
      else if (o.police && v > 3) { heat.add(1.5); say('You rammed a cop car.'); }
      else if (o.car && v > 7) heat.add(0.6);
    }
    const car = drive.car;
    const dy = Math.atan2(Math.sin(yaw - lastDriveYaw), Math.cos(yaw - lastDriveYaw)); orbit += dy;
    if (lookTouchId === null && !document.pointerLockElement) orbit *= Math.exp(-dt * 1.4); else orbit *= Math.exp(-dt * 0.3);
    yaw = car.h + Math.PI + orbit; lastDriveYaw = yaw; pitch = lerp(pitch, -0.14, 1 - Math.exp(-dt * 2));
    const fx = Math.sin(car.h + orbit), fz = Math.cos(car.h + orbit), k = 1 - Math.exp(-dt * 7);
    camera.position.x = lerp(camera.position.x, car.x - fx * 7, k); camera.position.z = lerp(camera.position.z, car.z - fz * 7, k); camera.position.y = lerp(camera.position.y, car.y + 2.6, k);
    $('speedo').style.display = 'block'; $('speedo').innerHTML = `${Math.round(Math.abs(car.v) * 3.6)}<small>km/h</small>`;
  }
  let hintT = 0;
  function showHint(talking) {
    const el = $('hint'); let t = '';
    if (!talking && !dlg.active) {
      if (drive.car) t = Math.abs(drive.car.v) < 1 ? 'TALK / E: get out' : '';
      else if (hustle && hustle.state === 'open' && dist(hustle.npc.position) < 4.5) t = `TALK: ${hustle.name}`;
      else { const sh = shops.nearest(camera.position); if (sh) t = `TALK: ${sh.name}`; else if (drive.nearest(camera.position)) t = 'TALK / E: get in'; }
    }
    el.textContent = t; el.style.display = t ? 'block' : 'none';
  }

  // ---- per-frame simulation ---------------------------------------------------------------
  let lastHud = 0, bobT = 0;
  const forward = new THREE.Vector3();
  function update(dt, now, t) {
    if (started) {
      const talking = dlg.active;
      const joy = talking ? { x: 0, y: 0 } : (window.AUControls || { x: 0, y: 0 });
      const k = c => !!keys[c];
      const right = (k('KeyD') || k('ArrowRight') || move.right ? 1 : 0) - (k('KeyA') || k('ArrowLeft') || move.left ? 1 : 0) + (Number(joy.x) || 0);
      const back = (k('KeyS') || k('ArrowDown') || move.back ? 1 : 0) - (k('KeyW') || k('ArrowUp') || move.forward ? 1 : 0) + (Number(joy.y) || 0);
      const moving = !drive.car && !talking && (Math.abs(right) > 0.05 || Math.abs(back) > 0.05);
      const guarding = blocking();
      stillT = moving ? 0 : stillT + dt;
      if (runLatch && (stillT > 0.6 || talking)) setRun(false);
      const wantsSprint = !!(keys.ShiftLeft || keys.ShiftRight || runLatch);
      const sprinting = wantsSprint && moving && stamina > 0 && !guarding;
      if (boostT > 0) { boostT -= dt; stamina = 100; }
      stamina = clamp(stamina + (sprinting ? -STAMINA_DRAIN : STAMINA_RECOVERY * (guarding ? 0.3 : 1)) * dt, 0, 100);
      if (now - lastHurt > 6000 && hp < 60) hp = Math.min(60, hp + 2.5 * dt);
      const speed = (sprinting ? 12 : guarding ? 3.2 : 7) * dt;
      let dx = talking ? 0 : right, dz = talking ? 0 : back; const len = Math.hypot(dx, dz);
      if (len > 1) { dx /= len; dz /= len; }
      const mx = (dx * Math.cos(yaw) + dz * Math.sin(yaw)) * speed, mz = (-dx * Math.sin(yaw) + dz * Math.cos(yaw)) * speed;
      if (drive.car) driveFrame(dt, talking ? 0 : clamp(-back, -1, 1), talking ? 0 : clamp(right, -1, 1));
      else {
        slideMove(camera.position, mx, mz);
        bobT += dt * (moving ? (sprinting ? 13 : 9) * Math.min(1, len) : 0);
        const ground = groundHeight(camera.position.x, camera.position.z) + EYE + (moving ? Math.sin(bobT) * 0.035 : 0);
        camera.position.y = lerp(camera.position.y, ground, 1 - Math.exp(-dt * 12));
      }
      traffic.update(dt, drive.car ? { x: drive.car.x, z: drive.car.z } : camera.position, drive.car);
      const me = drive.car ? { x: drive.car.x, z: drive.car.z } : camera.position;
      peds.update(dt, me.x, me.z, (pp, dx, dz) => slideMove(pp, dx, dz, 0.35));
      heat.update(dt, policeSeen);
      const pr = police.update(dt, t, heat, me, !!drive.car);
      policeSeen = pr.closest < 70;
      if (pr.closest < 40 && heat.level > 0) peds.scare(me.x, me.z, 20);
      if (pr.caught) busted();
      chapterOne(dt);
      // Traffic that reaches you on foot clips you (they normally stop in time).
      if (!drive.car) for (const o of traffic.obstacles()) if (o.car.v > 4 && Math.hypot(o.x - camera.position.x, o.z - camera.position.z) < 1.3) { hurtPlayer(12, KO_HOME); o.car.v = 0; say('Watch the road, egg.'); }
      window.__auTelemetry = { engine: 'three', started, paused: pauseOpen, x: camera.position.x, z: camera.position.z, joyX: joy.x, joyY: joy.y };
      window.AUControls?.setPosition?.(camera.position.x, camera.position.z, 'THREE');
      if (Math.abs(joy.x) + Math.abs(joy.y) > 0.1) $('joyReadout').textContent = `${Math.round(camera.position.x)},${Math.round(camera.position.z)}`;
      const guardUp = enemies.some(e => e.alive && dist(e.p.position) < 8) || (darrenState.hostile && dist(darren.position) < 8) || (jobState.kev === 'fight' && dist(JOBS.kev.npc.position) < 8);
      fists.update(dt, moving, sprinting, (guardUp || guarding) && !drive.car);
      if (drive.car) fists.group.visible = false;
      // Interaction hints.
      if ((hintT -= dt) <= 0) { hintT = 0.25; showHint(talking); }
      // Hustles: Shorty texts a new job every few minutes once his chapter is done.
      if (STAGES.indexOf(stage) >= STAGES.indexOf('recruit') && (!hustle || hustle.state === 'done') && (hustleTimer -= world.realDt || dt) <= 0) startHustle();
      if (hustle && hustle.state === 'done' && hustle.npc.visible && dist(hustle.npc.position) > 120) hustle.npc.visible = false;
      if (hustle && hustle.state === 'fight') {
        const n = hustle.npc, h = n.userData.human, d = dist(n.position);
        let sp = 0;
        if (d < 25 && d > 1.9) { const b0 = n.position.clone(); slideMove(n.position, (camera.position.x - n.position.x) / d * dt * 1.6, (camera.position.z - n.position.z) / d * dt * 1.6, 0.4); sp = b0.distanceTo(n.position) / Math.max(dt, 1e-4); }
        faceEachOther(n); h.speed = sp; h.mode = d < 6 ? 'guard' : 'idle'; n.position.y = groundHeight(n.position.x, n.position.z);
        if (!talking && !drive.car) meleeAI(hustle, h, d, 9, KO_HOME, dt);
      }
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
        if (!drive.car) meleeAI(e, h, d, 8, KO_ENEMY, dt);
      }
      // Darren squares up when the debt talk goes bad.
      {
        const h = darren.userData.human, d = dist(darren.position);
        if (darrenState.hostile && !darrenState.down) {
          let sp = 0;
          if (d < 20 && d > 1.9) {
            const before = darren.position.clone();
            slideMove(darren.position, (camera.position.x - darren.position.x) / d * dt * 1.7, (camera.position.z - darren.position.z) / d * dt * 1.7, 0.4);
            sp = before.distanceTo(darren.position) / Math.max(dt, 1e-4);
          }
          faceEachOther(darren); h.speed = sp; h.mode = d < 6 ? 'guard' : 'idle';
          darren.position.y = groundHeight(darren.position.x, darren.position.z);
          if (!talking && !drive.car) meleeAI(darrenState, h, d, 10, KO_DARREN, dt);
        } else { h.mode = 'idle'; h.speed = 0; }
      }
      // Shorty texts a little while after Manu passes your number on.
      if (stage === 'shorty-wait' && (shortyTimer -= world.realDt || dt) <= 0) {
        shortyTimer = 1e9; phone.receive(TEXTS.shortyHello, phoneVars(), () => advance('shorty-meet', `Shorty texted. Go see him on ${sHome.address}.`));
      }
      // Kev fights like a panel beater: slower than Darren, hits harder.
      if (jobState.kev === 'fight' && !kevRun.down) {
        const kev = JOBS.kev.npc, h = kev.userData.human, d = dist(kev.position);
        let sp = 0;
        if (d < 22 && d > 1.9) { const b0 = kev.position.clone(); slideMove(kev.position, (camera.position.x - kev.position.x) / d * dt * 1.5, (camera.position.z - kev.position.z) / d * dt * 1.5, 0.45); sp = b0.distanceTo(kev.position) / Math.max(dt, 1e-4); }
        faceEachOther(kev); h.speed = sp; h.mode = d < 6 ? 'guard' : 'idle'; kev.position.y = groundHeight(kev.position.x, kev.position.z);
        if (!talking && !drive.car) meleeAI(kevRun, h, d, 14, KO_KEV, dt);
      }
      // Mikey bolts when you get close: sprint bursts, then he blows out and you can catch him.
      if (stage === 'shorty-jobs' && jobState.mikey === 'open' && !talking) {
        const mk = JOBS.mikey.npc, h = mk.userData.human, d = dist(mk.position);
        if (mikeyRun.escapedT > 0) {
          if ((mikeyRun.escapedT -= dt) <= 0) { const p = safeSpawn(JOBS.mikey.spot.pos.x, JOBS.mikey.spot.pos.z); mk.position.set(p.x, groundHeight(p.x, p.z), p.z); mikeyRun.fleeing = false; mikeyRun.barked = false; mk.visible = true; }
        } else if (d < 1.9) catchMikey();
        else if (!mikeyRun.fleeing && d < 11) { mikeyRun.fleeing = true; mikeyRun.burst = 4.5; mikeyRun.tired = 0; if (!mikeyRun.barked) { mikeyRun.barked = true; dlg.bark('mikeyRuns'); } }
        if (mikeyRun.fleeing && mikeyRun.escapedT <= 0) {
          let speed;
          if (mikeyRun.burst > 0) { mikeyRun.burst -= dt; speed = 9.2; if (mikeyRun.burst <= 0) mikeyRun.tired = 2.4; }
          else { mikeyRun.tired -= dt; speed = 3.2; if (mikeyRun.tired <= 0) mikeyRun.burst = 3.5; }
          const ax = (mk.position.x - camera.position.x) / d, az = (mk.position.z - camera.position.z) / d, b0 = mk.position.clone();
          slideMove(mk.position, ax * speed * dt, az * speed * dt, 0.4);
          if (b0.distanceTo(mk.position) < speed * dt * 0.3) slideMove(mk.position, -az * speed * dt, ax * speed * dt, 0.4); // cornered: dodge sideways
          h.speed = b0.distanceTo(mk.position) / Math.max(dt, 1e-4); mk.rotation.y = Math.atan2(mk.position.x - b0.x, mk.position.z - b0.z) || mk.rotation.y;
          mk.position.y = groundHeight(mk.position.x, mk.position.z);
          if (d > 70) { mikeyRun.escapedT = 8; mk.visible = false; say(`Mikey got away. He'll be back at ${JOBS.mikey.spot.place} soon.`); }
        } else h.speed = 0;
      }
      if (now - lastHud > 180) { updateHUD(); locate(); drawMiniMap(); lastHud = now; }
    }
    // Dying enemies stay down for a few seconds, then leave the scene.
    for (const e of enemies) if (!e.alive && e.dyingT > 0) { e.dyingT += dt; if (e.dyingT > 4.5 && e.p.parent) { scene.remove(e.p); e.dyingT = 0; } }
    // Crew contacts and the fixer turn their heads to watch the player.
    for (const c of [...contacts.map(c => c.p), fixer, manu, shorty, JOBS.pita.npc, rawiri, lani, ...(darrenState.hostile ? [] : [darren]), ...(jobState.kev === 'fight' ? [] : [JOBS.kev.npc])]) {
      const h = c.userData.human, dx = camera.position.x - c.position.x, dz = camera.position.z - c.position.z, d = Math.hypot(dx, dz);
      const want = d < 9 ? Math.atan2(dx, dz) - c.rotation.y : 0;
      h.lookYaw = lerp(h.lookYaw, Math.atan2(Math.sin(want), Math.cos(want)), 1 - Math.exp(-dt * 4));
      if (c.userData.marker) { c.userData.marker.position.y = 2.25 + Math.sin(t * 2 + c.position.x) * 0.06; c.userData.marker.material.opacity = clamp((d - 1.5) / 5, 0.12, 0.9); }
    }
    fixerMarker.rotation.y += dt; fixerMarker.position.y = 2.3 + Math.sin(t * 2) * 0.06;
    fixerMarker.material.opacity = clamp((dist(fixer.position) - 1.5) / 5, 0.12, 0.9);
    stashMarker.rotation.y += dt; stashMarker.position.y = 1.0 + Math.sin(t * 2.2 + 1) * 0.08;
    const storyMarker = (m, show, base) => { m.visible = show; if (show) { m.rotation.y += dt; m.position.y = base + Math.sin(t * 2) * 0.06; } };
    storyMarker(manuMarker, stage === 'debt-return', 2.3); storyMarker(darrenMarker, stage === 'debt-find', 2.2);
    fixerMarker.visible = !['debt-find', 'debt-fight', 'debt-return', 'prologue', 'shorty-wait', 'shorty-meet', 'shorty-jobs', 'shorty-return'].includes(stage);
    storyMarker(shortyMarker, stage === 'shorty-meet' || stage === 'shorty-return', 2.45);
    for (const [k, j] of Object.entries(JOBS)) storyMarker(j.marker, stage === 'shorty-jobs' && !jobDone(k) && !(k === 'kev' && jobState.kev === 'fight'), 2.2);
    camera.rotation.order = 'YXZ';
    const sh = world.shake || 0; world.shake = Math.max(0, sh - dt);
    camera.rotation.set(pitch + (Math.random() - 0.5) * sh * 0.12, yaw + (Math.random() - 0.5) * sh * 0.12, 0);
    // Animate characters near the camera every frame, distant ones at a lower rate.
    for (const p of [...contacts.map(c => c.p), fixer, manu, darren, shorty, ...Object.values(JOBS).map(j => j.npc), ...enemies.map(e => e.p), ...debtors, ...peds.people, rawiri, lani, ...c1.rivals.map(r => r.p)]) {
      if (!p.parent || !p.visible) continue;
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
    drive: () => drive.car ? { x: drive.car.x, z: drive.car.z, v: drive.car.v, h: drive.car.h } : null,
    nearestCar: () => { let b = null, bd = 1e9; for (const c of world.city.cars) { if (c.taken) continue; const d = Math.hypot(c.x - camera.position.x, c.z - camera.position.z); if (d < bd) { bd = d; b = c; } } return b && { x: b.x, z: b.z }; },
    shopsList: () => shops.list.map(s => ({ kind: s.kind, name: s.name, x: s.x, z: s.z })),
    buy: i => { const b = document.querySelectorAll('#shopItems button')[i]; b?.click(); return !!b; }, closeShop: () => shops.close(),
    setHp: v => { hp = v; }, setCash: v => { cash = v; }, strength: () => strength, traffic: () => traffic.cars.length,
    hustle: () => hustle && { name: hustle.name, amount: hustle.amount, state: hustle.state, type: hustle.type, x: hustle.npc.position.x, z: hustle.npc.position.z },
    startHustle: type => { hustleTimer = 0; startHustle(); if (hustle && type) hustle.type = type; return !!hustle; },
    pedDebug: () => peds.agents.map(a => ({ active: a.active, x: Math.round(a.p.position.x), z: Math.round(a.p.position.z), flee: a.flee, down: a.down, vis: a.p.visible })),
    heat: () => heat.level, addHeat: n => heat.add(n), clearHeat: () => { heat.level = 0; police.clear(); }, police: () => police.cars.map(c => ({ x: c.x, z: c.z })), peds: () => peds.agents.filter(a => a.active).length,
    carTo: (x, z) => { if (drive.car) { drive.car.x = x; drive.car.z = z; drive.car.v = 0; } },
    c1: () => ({ manuInCar: c1.manuInCar, rawiri: rawiri.position.clone(), lani: lani.position.clone(), home: home.pos.clone(), rivals: c1.rivals.map(r => ({ x: r.p.position.x, z: r.p.position.z, alive: r.alive, hostile: r.hostile })) }),
    skipTimers: () => { c1.timer = 0; },
    jobs: () => ({ ...jobState }),
    targets: () => ({ fixer: fixer.position.clone(), manu: manu.position.clone(), darren: darren.position.clone(), shorty: shorty.position.clone(), kev: JOBS.kev.npc.position.clone(), mikey: JOBS.mikey.npc.position.clone(), pita: JOBS.pita.npc.position.clone(), stash: stash.position.clone(), contacts: contacts.map(c => ({ f: c.f, x: c.p.position.x, z: c.p.position.z })), enemies: enemies.map(e => ({ x: e.p.position.x, z: e.p.position.z, alive: e.alive })) }),
  };
  return { update, isStarted: () => started, isPaused: () => pauseOpen, inPrologue: () => inPrologue };
}
