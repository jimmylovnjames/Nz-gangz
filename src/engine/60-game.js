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
  // The player is `eye` (head position + look direction); the render camera follows it in first person
  // or trails it over the shoulder in third person (see the end of update()).
  const eye = new THREE.Object3D(); eye.rotation.order = 'YXZ';
  const mobile = matchMedia('(pointer:coarse)').matches;
  const collides = (x, z, r = 0.55, feet) => collision.collides(x, z, r, feet);
  function slideMove(p, dx, dz, r = 0.55, feet) {
    if (!Number.isFinite(dx) || !Number.isFinite(dz)) return;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / 0.45));
    for (let i = 0; i < steps; i++) {
      const nx = clamp(p.x + dx / steps, MAP_BOUNDS.x0, MAP_BOUNDS.x1), nz = clamp(p.z + dz / steps, MAP_BOUNDS.z0, MAP_BOUNDS.z1);
      if (!collides(nx, nz, r, feet)) { p.x = nx; p.z = nz; continue; }
      if (!collides(nx, p.z, r, feet)) p.x = nx;
      if (!collides(p.x, nz, r, feet)) p.z = nz;
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
  eye.position.set(world.cousinHome.spawn.pos.x, ROAD.kerbH + EYE, world.cousinHome.spawn.pos.z);
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
  document.addEventListener('mousemove', e => { if (document.pointerLockElement === canvas) { lastLook = performance.now(); yaw -= e.movementX * 0.0025; pitch = clamp(pitch - e.movementY * 0.0025, -1.3, 1.3); } });
  canvas.addEventListener('touchstart', e => { const t = e.changedTouches[0]; if (lookTouchId === null && t.clientX > innerWidth * 0.35) { lookTouchId = t.identifier; lastX = t.clientX; lastY = t.clientY; } }, { passive: true });
  canvas.addEventListener('touchmove', e => {
    if (lookTouchId === null) return;
    const t = Array.from(e.changedTouches).find(t => t.identifier === lookTouchId); if (!t) return;
    e.preventDefault(); lastLook = performance.now(); yaw -= (t.clientX - lastX) * 0.006; pitch = clamp(pitch - (t.clientY - lastY) * 0.006, -1.3, 1.3); lastX = t.clientX; lastY = t.clientY;
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
  let stamina = 100; const STAMINA_DRAIN = 15, STAMINA_RECOVERY = 17;
  // Feel: momentum, dodge, hit-stop, slow-mo on the last knockout, fight token, view mode.
  const vel = new THREE.Vector2(); let dodgeT = 0, dodgeCD = 0, prevBlock = false, hitStop = 0, slowMo = 0, stepDist = 0, fightToken = null, tokenT = 0;
  let thirdPerson = (() => { try { return localStorage.getItem('au-view') === '3'; } catch (_) { return false; } })(), bodyYaw = 0, guardingNow = false;
  let bnCash = 0, bnRep = 0;
  const REP_TITLES = [[600, 'FEARED'], [300, 'SOLID'], [150, 'RESPECTED'], [50, 'KNOWN'], [0, 'NOBODY']];
  const repTitle = () => REP_TITLES.find(([n]) => rep >= n)[1];
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
  const kevRun = { hp: 4, maxHp: 4, down: false, attackT: 0 }, mikeyRun = { fleeing: false, burst: 0, tired: 0, escapedT: 0, barked: false };
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
  const dist = p => Math.hypot(eye.position.x - p.x, eye.position.z - p.z);
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
    bnCash = Math.min(bnCash, cash);
    $('status').textContent = `HP ${Math.ceil(hp)} | ENERGY ${Math.ceil(stamina)}${boostT > 0 ? '⚡' : ''} | $${cash} | REP ${rep} ${repTitle()}${strength ? ' | PWR ' + strength : ''}${heat.level > 0 ? ' | HEAT ' + '★'.repeat(heat.stars) : ''} | ${chosen.toUpperCase()}`;
    const [goal, target] = objective(); $('quest').textContent = goal; beaconTarget = target || (hustle && hustle.state !== 'done' ? hustle.npc.position : null); $('status').setAttribute('title', `${hometown} | ${originRegion}`);
    const side = hustle && hustle.state !== 'done' ? ` · HUSTLE ${hustle.name} ${Math.round(dist(hustle.npc.position))}m` : '';
    if (target) $('missionDistance').textContent = `OBJECTIVE ${Math.round(dist(target))}m away${side}`;
    else $('missionDistance').textContent = (stage === 'mission-brawl' ? 'Find hostiles on the outskirts' : 'Story branch recorded') + side;
  }
  function store() {
    if (!saveAllowed || !started) return;
    try {
      const data = { version: 2, map: MAP_VERSION, strength, stage, hometown, originRegion, chosen, rep, hp, cash, defeated, missionRoute, stamina, debtRoute, debtCash, jobs: jobState, phone: phone.log.slice(-40), enemyHP: enemies.map(e => e.hp), enemyAlive: enemies.map(e => e.alive), enemyPositions: enemies.map(e => ({ x: e.p.position.x, z: e.p.position.z })), x: drive.car ? drive.car.x : eye.position.x, z: drive.car ? drive.car.z : eye.position.z, yaw, pitch };
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
    grab = null; climb = null; air = false; setWeapon(null);
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
    CHIP.ensure(); SFX.ensure(); bnCash = cash; bnRep = rep;
    prologue.start(storyVars(), () => {
      inPrologue = false; stage = 'debt-find';
      const sp = home.spawn;
      eye.position.set(sp.pos.x, groundHeight(sp.pos.x, sp.pos.z) + EYE, sp.pos.z); yaw = sp.rot + Math.PI; pitch = 0;
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
    eye.position.set(p.x, groundHeight(p.x, p.z) + EYE, p.z);
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
    bnCash = cash; bnRep = rep; SFX.ensure();
    if (stage === 'prologue') { startPrologue(); return; }
    closeMenus(); say(`Welcome back to ${hometown}. Your ${chosen} story continues.`);
  }
  function banner(title, sub = '') {
    const el = $('banner'); el.innerHTML = '<b></b><span></span>'; el.children[0].textContent = title; el.children[1].textContent = sub;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); SFX.play(title === 'BUSTED' || title === 'KNOCKED OUT' ? 'ko' : 'banner');
  }
  function rewardCheck(title = 'JOB DONE') {
    const dc = cash - bnCash, dr = rep - bnRep;
    if (dc > 0 || dr > 0) { banner(title, [dc > 0 && `+$${dc}`, dr > 0 && `+${dr} REP`].filter(Boolean).join(' · ')); if (dc > 0) SFX.play('cash'); }
    bnCash = cash; bnRep = rep;
  }
  function advance(next, message) { stage = next; say(message); rewardCheck(next === 'complete' || next === 'c1-done' ? 'CHAPTER COMPLETE' : 'JOB DONE'); updateHUD(); store(); }
  const faceEachOther = p => { p.rotation.y = Math.atan2(eye.position.x - p.position.x, eye.position.z - p.position.z); };
  function talk() {
    if (dlg.active) { dlg.advance(); return; }
    if (!started || pauseOpen) return;
    if (drive.car) { exitCar(); return; }
    if (grab) { throwGrab(); return; }
    if (tryGrab()) return;
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
          else dlg.run('c1RivalsFight', {}, () => { c1.rivals.slice(0, 3).forEach(x => { if (x.alive) x.hostile = true; }); peds.scare(eye.position.x, eye.position.z); say('Three on one. Block, step back, hit back.'); });
        });
        return;
      }
    }
    if (stage === 'c1-manu' && dist(manu.position) < 4.5 && !c1.rivals.slice(3).some(r => r.alive)) { faceEachOther(manu); manu.userData.human.reset(); dlg.run('c1ManuDown', { rival: rivalCrew() }, () => advance('c1-home', 'Get Manu into a car and take him home.')); return; }
    if (stage === 'c1-done' || stage === 'complete') { if (dist(manu.position) < 4.5) { faceEachOther(manu); dlg.run('manuAfter', storyVars(), null); return; } }
    if (hustle && dist(hustle.npc.position) < 4.5 && hustle.npc.visible) { talkHustle(); return; }
    const pk = nearestPickup(); if (pk && !weapon) { scene.remove(pk.g); pickups.splice(pickups.indexOf(pk), 1); setWeapon({ kind: pk.kind, uses: WEAPON_DEF[pk.kind].uses }); say(`Picked up a ${WEAPON_DEF[pk.kind].name}. Hits hard, swings slow, and the cops won't like it. TALK with nothing around to drop it.`); return; }
    const shop = shops.nearest(eye.position); if (shop) { openShop(shop); return; }
    const car = drive.nearest(eye.position); if (car) { enterCar(car); return; }
    if (weapon) { spawnPickup(weapon.kind, eye.position.x + 0.8, eye.position.z); say(`Dropped the ${WEAPON_DEF[weapon.kind].name}.`); setWeapon(null); return; }
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
    eye.position.set(p.x, groundHeight(p.x, p.z) + EYE, p.z); pitch = 0;
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
    hustle = { name: HUSTLE_NAMES[Math.floor(rnd() * HUSTLE_NAMES.length)], amount, street: house.address, npc, type: rnd() < (amount >= 300 ? 0.6 : 0.3) ? 'fights' : 'pays', state: 'open', hp: 3 + amount / 200, maxHp: 3 + amount / 200, attackT: 1, windup: 0 };
    phone.receive(TEXTS.hustleNew, { name: hustle.name, amount: '$' + amount, street: hustle.street }, () => refreshJobs());
    refreshJobs();
  }
  function endHustle(reset) { if (hustle && reset) hustle.npc.visible = false; if (reset) hustle = null; hustleTimer = reset ? 90 : 150 + rnd() * 90; refreshJobs?.(); }
  function hustlePaid(extraRep = 0) {
    const cut = Math.round(hustle.amount * 0.25); cash += cut; rep += 4 + extraRep; hustle.state = 'done';
    phone.receive(TEXTS.hustlePaid, { cut: '$' + cut }); say(`${hustle.name} paid up. Shorty's flicking you $${cut}.`); rewardCheck('HUSTLE DONE');
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
  // ---- fighting: fists, weapons, grabs, throws, finishers --------------------------------------
  let grab = null, weapon = null;
  const pickups = [];
  // Everyone you can hit: current opponents plus the rival boys (hitting them starts it).
  function targets() { const out = hostiles(); for (const r of c1.rivals) if (r.alive && r.p.visible && !r.hostile) out.push([r.p, r]); return out; }
  function nearestTarget(forward, reach, cone) {
    let best = null, bd = reach;
    for (const [p, st] of targets()) { const delta = p.position.clone().add(new THREE.Vector3(0, 1.4, 0)).sub(eye.position), d = delta.length(); if (d < bd && delta.normalize().dot(forward) > cone) { best = [p, st]; bd = d; } }
    return best;
  }
  // Knockouts by who it was (story fights move the story on).
  function koTarget(p, st, finisher) {
    if (finisher) { slowMo = 1.1; rep += 3; banner('FINISHER', '+3 REP'); }
    heat.add(0.4); peds.scare(p.position.x, p.position.z);
    if (st === darrenState) {
      darrenState.down = true; darrenState.hostile = false; darren.userData.human.knockDown(); rep += 5; say('Darren is down.');
      setTimeout(() => dlg.run('darrenBeaten', storyVars(), () => { debtCash = 400; darren.userData.human.reset(); darrenState.down = false; advance('debt-return', 'Darren handed over the full $400. Take it to Manu.'); }), 1400);
    } else if (st === kevRun) {
      kevRun.down = true; JOBS.kev.npc.userData.human.knockDown(); rep += 8; say('Kev is down.');
      setTimeout(() => dlg.run('kevBeaten', storyVars(), () => { JOBS.kev.npc.userData.human.reset(); kevRun.down = false; jobState.kev = 'paid'; say('Kev paid $600.'); updateHUD(); store(); checkJobs(); }), 1400);
    } else if (hustle && st === hustle) {
      hustle.state = 'down'; const n = hustle.npc; n.userData.human.knockDown();
      setTimeout(() => { CAST.debtor.name = hustle.name; dlg.run('hustleBeaten', {}, () => { n.userData.human.reset(); hustlePaid(3); }); }, 1300);
    } else if (c1.rivals.includes(st)) { st.alive = false; p.userData.human.knockDown(); rep += 4; heat.add(0.1); }
    else if (enemies.includes(st)) {
      st.alive = false; st.dyingT = 0.0001; p.userData.human.knockDown(); rep += 5;
      if (stage === 'mission-brawl') { defeated++; if (defeated >= 3) { advance('mission-return', `You won the fights. Your ${hometown} fixer wants to see you.`); return; } }
      say('Opponent defeated. Reputation +5.');
    }
    updateHUD(); store();
  }
  function applyHit(p, st, dmg, push, heavy, forward, how = 'punch', react = 'jab', side = 1, stagger) {
    // A finisher: the blow that drops someone who is already staggered or on the ground.
    const finisher = st.hp <= dmg && (st.stagger > 0 || st.downT > 0);
    if (c1.rivals.includes(st)) st.hostile = true;
    st.hp -= dmg; st._p = p; bloodAt(p.position);
    slideMove(p.position, forward.x * push * (finisher ? 2.2 : 1), forward.z * push * (finisher ? 2.2 : 1), 0.4);
    p.userData.human.hit(react, side);
    world.shake = heavy || finisher ? 0.34 : 0.18; hitStop = finisher ? 0.16 : heavy ? 0.1 : (stagger || 0) > 0.3 ? 0.07 : 0.05; SFX.play(heavy || finisher || how !== 'punch' ? 'heavy' : 'hit');
    st.stagger = stagger ?? (heavy ? 0.75 : how === 'weapon' ? 0.6 : 0.28); st.windup = 0; st.blockT = 0;
    if (st.hp <= 0) koTarget(p, st, finisher);
    else { if (heavy) say('Heavy hit!'); else if (st === kevRun) say('Hit landed. Kev is tough.'); }
    setTimeout(() => { if (!hostiles().length && st.hp <= 0) { slowMo = Math.max(slowMo, 0.7); SFX.play('ko'); } }, 0);
  }
  // Your strikes: HIT strings jab, cross, hook, uppercut. Damage lands at the moment the fist does (not on the
  // tap), a tap during a strike queues the next one, and the uppercut breaks a block.
  const PMOVES = {
    jab: { dmg: 0.6, hit: 0.09, chain: 0.16, dur: 0.3, reach: 3.3, push: 0.25, react: 'jab', side: 1, stagger: 0.22 },
    cross: { dmg: 0.9, hit: 0.13, chain: 0.22, dur: 0.38, reach: 3.5, push: 0.4, react: 'cross', side: -1, stagger: 0.3 },
    hook: { dmg: 1.15, hit: 0.16, chain: 0.27, dur: 0.42, reach: 3.0, push: 0.45, react: 'hook', side: 1, stagger: 0.38 },
    upper: { dmg: 1.6, hit: 0.19, chain: 0.4, dur: 0.5, reach: 2.9, push: 0.9, react: 'upper', side: -1, stagger: 0.7, heavy: true, breaks: true },
    swing: { dmg: 1, hit: 0.22, chain: 0.4, dur: 0.56, reach: 2.6, push: 0.8, react: 'heavy', side: -1, stagger: 0.6 },
    knee: { dmg: 1.3, hit: 0.15, chain: 0.3, dur: 0.42, reach: 2, push: 0, react: 'body', side: 1, stagger: 0.5, heavy: true },
  };
  const COMBO = ['jab', 'cross', 'hook', 'upper'];
  let pmove = null, comboIdx = -1, lastMoveEnd = -9, simT = 0, lastBlockPress = -9, lockT = null, lastLook = -1e9, lastPop = '', lastPopT = -9, parryTold = false, fightTold = false;
  const popEl = document.createElement('div');
  popEl.style.cssText = 'position:fixed;left:50%;top:36%;transform:translate(-50%,-50%);font:900 24px/1 system-ui,sans-serif;letter-spacing:3px;color:#fff;text-shadow:0 2px 10px #000,0 0 2px #000;pointer-events:none;opacity:0;transition:opacity .2s,transform .2s;z-index:40';
  document.body.appendChild(popEl); let popTimer = 0;
  function pop(text, color = '#fff') {
    lastPop = text; lastPopT = simT; popEl.textContent = text; popEl.style.color = color; popEl.style.opacity = '1'; popEl.style.transform = 'translate(-50%,-50%) scale(1.1)';
    clearTimeout(popTimer); popTimer = setTimeout(() => { popEl.style.opacity = '0'; popEl.style.transform = 'translate(-50%,-50%) scale(1)'; }, 560);
  }
  function hit() {
    if (drive.car) { drive.audio.horn(); return; }
    if (!started || pauseOpen || dlg.active || blocking() || climb) return;
    if (pmove) { if (pmove.t > pmove.d.dur * 0.3) pmove.queued = true; return; }
    startMove();
  }
  // Turn toward the nearest opponent in a wide cone so swings connect on a phone.
  function aimAssist(reach, k) {
    let best = null, bd = reach;
    for (const [p] of targets()) { const dx = p.position.x - eye.position.x, dz = p.position.z - eye.position.z, d = Math.hypot(dx, dz); if (d > bd) continue; let da = Math.atan2(-dx, -dz) - yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.abs(da) < 1.25) { best = da; bd = d; } }
    if (best != null) { yaw += best * k; pitch = lerp(pitch, -0.05, 0.6 * k); eye.rotation.set(pitch, yaw, 0); }
  }
  function startMove() {
    const def = weapon && WEAPON_DEF[weapon.kind];
    let name;
    if (grab) { name = 'knee'; comboIdx = -1; }
    else if (def) { name = 'swing'; comboIdx = -1; }
    else { comboIdx = simT - lastMoveEnd < 0.5 ? (comboIdx + 1) % COMBO.length : 0; name = COMBO[comboIdx]; }
    pmove = { name, d: PMOVES[name], t: 0, done: false, queued: false }; lastPunch = performance.now();
    fists.play(name); playerBody.userData.human.attack(name);
    SFX.play('whoosh', name === 'swing' ? 1.3 : name === 'upper' || name === 'hook' ? 1.05 : 0.8);
    if (grab) return;
    aimAssist(def ? def.reach + 0.6 : 3.9, 0.55);
    // They see it coming: sometimes they cover up (more often the better the fighter).
    for (const [p, st] of hostiles()) if (dist(p.position) < 3.2 && !(st.windup > 0) && !(st.stagger > 0) && !(st.downT > 0) && !((st.blockCD || 0) > 0) && rnd() < styleOf(st).block) { st.blockT = 0.55; st.blockCD = 1.6; }
  }
  function moveFrame(dt) {
    const m = pmove; if (!m) return;
    m.t += dt;
    if (!m.done && m.t >= m.d.hit) { m.done = true; strike(m); }
    if (pmove !== m) return;
    // Only punches carry the string on; a knee or a bat swing starts it again.
    if (m.queued && m.t >= m.d.chain) { pmove = null; lastMoveEnd = COMBO.includes(m.name) ? simT : -9; startMove(); }
    else if (m.t >= m.d.dur) { pmove = null; lastMoveEnd = COMBO.includes(m.name) ? simT : -9; }
  }
  function strike(m) {
    const def = weapon && WEAPON_DEF[weapon.kind], power = 1 + strength * 0.25, d = m.d;
    if (m.name === 'knee') { // knee to the body while you hold them
      if (!grab) return;
      const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
      applyHit(grab.p, grab.st, d.dmg * power, 0, true, fwd, 'knee', 'body', 1, 0.5); grab.knees++;
      if (grab.st.hp <= 0) grab = null; else if (grab.knees >= 3) throwGrab();
      updateHUD(); return;
    }
    aimAssist(def ? def.reach + 0.6 : 3.9, 0.85);
    const forward = new THREE.Vector3(0, 0, -1).applyEuler(eye.rotation), cone = mobile ? 0.3 : 0.45;
    const t = nearestTarget(forward, def ? def.reach + 1.4 : d.reach + 0.7, def ? cone - 0.15 : cone);
    if (t) {
      const [p, st] = t; lockT = st;
      let dmg = (def ? def.dmg : d.dmg) * power, tag = '';
      if (st.windup > 0) { dmg *= 1.4; tag = 'COUNTER'; }
      if (st.parried > 0) { dmg *= 1.5; tag = tag || 'OPEN'; }
      if (st.blockT > 0 && !def) {
        if (d.breaks) { dmg *= 0.75; tag = 'GUARD BREAK'; }
        else {
          // Covered up: it bounces off the forearms. Chip damage only, and he's coming back at you.
          st.blockT = Math.max(st.blockT, 0.35); st.attackT = Math.min(st.attackT ?? 1, 0.35); st.hp = Math.max(0.1, st.hp - dmg * 0.12);
          p.userData.human.hit('block', d.side); SFX.play('block'); world.shake = Math.max(world.shake, 0.05); hitStop = 0.03;
          slideMove(p.position, forward.x * 0.15, forward.z * 0.15, 0.4); pop('BLOCKED', '#9fc3ff'); updateHUD(); return;
        }
      }
      applyHit(p, st, dmg, def ? 0.8 : d.push, !!d.heavy || !!def, forward, def ? 'weapon' : 'punch', def ? 'heavy' : d.react, d.side, def ? 0.6 : d.stagger);
      if (tag && st.hp > 0) pop(tag, tag === 'COUNTER' ? '#ffd166' : tag === 'OPEN' ? '#7fe0ff' : '#ff9a5a');
      if (def) { heat.add(0.15); if (--weapon.uses <= 0) { say(`Your ${def.name} snapped.`); SFX.play('heavy'); setWeapon(null); } }
      updateHUD(); return;
    }
    // Innocent bystanders: they go down, everyone else scatters, and the cops hear about it.
    const ped = peds.near(eye.position.x, eye.position.z, def ? 4 : 3.5).find(a => { const v = a.p.position.clone().add(new THREE.Vector3(0, 1.4, 0)).sub(eye.position).normalize(); return v.dot(forward) > cone; });
    if (ped) { peds.knock(ped); bloodAt(ped.p.position); world.shake = 0.18; SFX.play('hit'); heat.add(def ? 1.5 : 1); peds.scare(eye.position.x, eye.position.z); say('You just laid out a random. Someone\'s calling the cops.'); updateHUD(); }
  }
  // A block tapped just before their punch lands: it's knocked aside and they're wide open.
  function parry(st, h) {
    st.stagger = 1.0; st.parried = 1.1; st.windup = 0; h.clip = null; h.hit('parried', 1);
    fists.play('parry'); playerBody.userData.human.attack('parry');
    SFX.play('parry'); slowMo = Math.max(slowMo, 0.3); hitStop = 0.08; stamina = Math.min(100, stamina + 15);
    pop('PARRY', '#7fe0ff'); if (!parryTold) { parryTold = true; say('Parried. He\'s wide open: hit him.'); }
  }
  // Soft lock-on: while you're in a fight and not steering the camera, the view eases onto your opponent.
  function lockOn(dt) {
    if (drive.car || dlg.active || climb || performance.now() - lastLook < 700) return;
    const list = hostiles(); if (!list.length) { lockT = null; return; }
    let tg = list.find(([p, st]) => st === lockT && dist(p.position) < 6 && !(st.downT > 0));
    if (!tg) { let bd = 4.5; for (const e of list) { const [p, st] = e, d = dist(p.position); if (d < bd && !(st.downT > 0)) { bd = d; tg = e; } } }
    if (!tg) return;
    const p = tg[0], dx = p.position.x - eye.position.x, dz = p.position.z - eye.position.z;
    let da = Math.atan2(-dx, -dz) - yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.abs(da) > 1.5) return;
    yaw += da * (1 - Math.exp(-dt * 5)); pitch = lerp(pitch, -0.06, 1 - Math.exp(-dt * 3));
  }
  // Grab (TALK next to someone you're fighting): hold them, knee them with HIT, then throw.
  function tryGrab() {
    if (grab || weapon || drive.car) return false;
    const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const t = hostiles().map(([p, st]) => [p, st, dist(p.position)]).filter(([p, st, d]) => d < 2.1 && !(st.downT > 0)).sort((a, b) => a[2] - b[2])[0];
    if (!t) return false;
    const [p, st] = t; grab = { p, st, t: 0, knees: 0 }; st._p = p; st.windup = 0; st.stagger = 0.5; st.blockT = 0; p.userData.human.clip = null;
    SFX.play('block'); say('Got him. HIT to knee, TALK to throw.'); return true;
  }
  function throwGrab() {
    const g = grab; if (!g) return; grab = null;
    const dir = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)), p = g.p, st = g.st;
    let slammed = false;
    for (let k = 0; k < 12; k++) { const x0 = p.position.x, z0 = p.position.z; slideMove(p.position, dir.x * 0.28, dir.z * 0.28, 0.4); if (Math.hypot(p.position.x - x0, p.position.z - z0) < 0.1) { slammed = true; break; } }
    p.position.y = groundHeight(p.position.x, p.position.z);
    fists.play('throw'); playerBody.userData.human.attack('throw');
    applyHit(p, st, (slammed ? 2.6 : 1.6) * (1 + strength * 0.25), 0, true, dir, 'throw', 'heavy', -1, 0.6);
    if (st.hp > 0) { st.downT = 1.5; p.userData.human.knockDown(); }
    if (slammed) say('Slammed him into the fence.'); heat.add(0.2);
  }
  function setWeapon(w) {
    weapon = w; fists.setWeapon(w ? w.kind : null);
    const hb = playerBody.userData.human; hb.weapon = !!w;
    const hand = hb.bones[BONE.handR]; if (hb._wm) { hand.remove(hb._wm); hb._wm = null; }
    if (w) { const m = weaponMesh(w.kind); m.rotation.x = -Math.PI / 2; m.position.set(0, -0.08, 0.03); hand.add(m); hb._wm = m; }
  }
  function spawnPickup(kind, x, z) {
    const m = weaponMesh(kind); m.rotation.set(Math.PI / 2, 0, rnd() * TAU); const g = new THREE.Group(); g.add(m);
    const sp = safeSpawn(x, z); g.position.set(sp.x, groundHeight(sp.x, sp.z) + 0.04, sp.z); scene.add(g);
    pickups.push({ kind, g, x: sp.x, z: sp.z });
  }
  for (const w of world.city.weapons()) spawnPickup(w.kind, w.x, w.z);
  function nearestPickup(r = 2) { let best = null, bd = r; for (const q of pickups) { const d = Math.hypot(q.x - eye.position.x, q.z - eye.position.z); if (d < bd) { bd = d; best = q; } } return best; }

  // ---- jump, vault, climb ------------------------------------------------------------------
  let vy = 0, air = false, climb = null, prevJump = false;
  const feetUp = () => eye.position.y - EYE - groundHeight(eye.position.x, eye.position.z);
  function tryJump() {
    if (drive.car || climb || dlg.active) return;
    const f = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)), feet = Math.max(0, feetUp());
    // Something climbable right in front (fences, walls, cars, letterboxes, ramps)? Vault or climb it.
    for (const s0 of [0.5, 0.85, 1.15]) {
      const o = collision.first(eye.position.x + f.x * s0, eye.position.z + f.z * s0, 0.3, feet);
      if (!o) continue;
      if ((o.top ?? 99) > 2.4) break; // a house wall or a pole: no
      for (let s = s0 + 0.35; s < 3.6; s += 0.15) {
        const x = eye.position.x + f.x * s, z = eye.position.z + f.z * s;
        if (!collision.collides(x, z, 0.45)) { climb = { t: 0, dur: o.top <= 1.25 ? 0.45 : 0.95, fx: eye.position.x, fz: eye.position.z, tx: x, tz: z, top: o.top, y0: eye.position.y }; air = false; vy = 0; SFX.play('step', 2); vel.set(0, 0); return; }
      }
      break;
    }
    if (!air) { air = true; vy = 5.6; SFX.play('step', 2); }
  }
  function verticalFrame(dt, moving) {
    const h = playerBody.userData.human;
    if (climb) {
      const c = climb; c.t += dt; const k = Math.min(1, c.t / c.dur);
      const along = k < 0.55 ? 0.3 * (k / 0.55) : 0.3 + 0.7 * ((k - 0.55) / 0.45);
      eye.position.x = lerp(c.fx, c.tx, along); eye.position.z = lerp(c.fz, c.tz, along);
      const ground = groundHeight(eye.position.x, eye.position.z) + EYE, peak = Math.max(0, c.top + 1.0 - EYE);
      eye.position.y = lerp(c.y0, ground, k) + Math.sin(k * Math.PI) * peak;
      h.climbing = true; if (k >= 1) { climb = null; h.climbing = false; SFX.play('step'); }
      return;
    }
    const ground = groundHeight(eye.position.x, eye.position.z) + EYE;
    if (air) {
      vy -= 22 * dt; eye.position.y += vy * dt; h.air = true;
      if (eye.position.y <= ground && vy < 0) { eye.position.y = ground; air = false; vy = 0; h.air = false; SFX.play('step', 2); world.shake = Math.max(world.shake, 0.04); }
      return;
    }
    h.air = false;
    eye.position.y = lerp(eye.position.y, ground + (moving ? Math.sin(bobT) * 0.035 : 0), 1 - Math.exp(-dt * 12));
    if (eye.position.y < ground - 0.5 || eye.position.y > ground + 0.6) eye.position.y = ground;
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
    const dx = target.x - eye.position.x, dz = target.z - eye.position.z;
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
    const x = eye.position.x, z = eye.position.z, cx = Math.floor(x / 50), cz = Math.floor(z / 50); let best = 1e9, name = '';
    for (let i = cx - 1; i <= cx + 1; i++) for (let j = cz - 1; j <= cz + 1; j++) for (const id of roadGrid.get(i + ',' + j) || []) { const r = world.city.map.roadInfo[Math.floor(id / 1000)], k = id % 1000, a = r.pts[k], b = r.pts[k + 1]; const d = segDist2(x, z, a[0], a[1], b[0], b[1]); if (d < best) { best = d; name = r.name; } }
    here.street = name; here.suburb = x < -480 ? 'Clendon Park' : z < -760 && x < 700 ? 'Homai' : 'Manurewa';
    $('location').textContent = `${name ? name + ', ' : ''}${here.suburb}`;
  }
  function drawMiniMap() {
    const c = miniCtx, w = c.canvas.width, h = c.canvas.height, scale = 1.25;
    c.clearRect(0, 0, w, h); c.fillStyle = '#092321'; c.fillRect(0, 0, w, h);
    c.save(); c.translate(w / 2, h / 2); c.rotate(yaw);
    const k = scale / MAP_PX;
    c.drawImage(mapCanvas, (C0.x0 - eye.position.x) * scale, (C0.z0 - eye.position.z) * scale, mapCanvas.width * k, mapCanvas.height * k);
    const dot = (x, z, color, r) => { const dx = (x - eye.position.x) * scale, dz = (z - eye.position.z) * scale; if (Math.abs(dx) > w || Math.abs(dz) > h) return; c.fillStyle = color; c.beginPath(); c.arc(dx, dz, r, 0, TAU); c.fill(); };
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
  function hurtPlayer(dmg, ko, A) {
    if (dodgeT > 0 || climb) { if (A) pop('SLIPPED', '#b8f5e1'); return; } // slipped it
    if (grab) grab = null;
    const pb = playerBody.userData.human;
    if (blocking() && stamina > 5) {
      // A haymaker on your guard eats your energy; run out and it comes through.
      if (A && A.heavy) { stamina = Math.max(0, stamina - 38); dmg *= stamina > 0 ? 0.45 : 0.8; if (stamina <= 0) pop('GUARD BROKEN', '#ff7070'); }
      else { dmg *= 0.15; stamina = Math.max(0, stamina - 14); }
      world.shake = Math.max(world.shake, 0.06); SFX.play('block'); pb.hit('block', 1); fists.kick = 0.5;
    } else {
      world.hurt = 1; world.shake = Math.max(world.shake, A && A.heavy ? 0.3 : 0.15); SFX.play(A && A.heavy ? 'heavy' : 'hurt'); pb.hit(A ? A.react : 'jab', A ? A.side : 1); fists.kick = 1;
      if (A) { yaw += A.side * (A.react === 'hook' || A.heavy ? 0.07 : 0.02); pitch += A.heavy ? 0.06 : 0.03; }
      if (A && A.heavy && pmove && !pmove.done) { pmove = null; lastMoveEnd = simT; } // a haymaker knocks you out of your swing
    }
    hp = Math.max(0, hp - dmg); lastHurt = performance.now();
    if (hp <= 0) {
      const lost = Math.round(cash * 0.1); cash -= lost; hp = 100; rep = Math.max(0, rep - (ko.rep || 0));
      if (drive.car) exitCar();
      const p = ko.at(); eye.position.set(p.x, groundHeight(p.x, p.z) + EYE, p.z);
      say(`${ko.msg}${lost ? ` You got rolled for $${lost} while you were out.` : ''}${ko.rep ? ` Reputation -${ko.rep}.` : ''}`);
      banner('KNOCKED OUT', lost ? `-$${lost}` : 'Back on your feet'); bnCash = cash; bnRep = rep;
      // Retry: whoever beat you is back to full and still there.
      for (const r of c1.rivals) if (r.alive) { r.hp = 3; r.stagger = 0; }
      if (hustle && hustle.state === 'fight') hustle.hp = hustle.maxHp || hustle.hp;
      darrenState.hp = Math.max(darrenState.hp, 3); kevRun.hp = Math.max(kevRun.hp, 4);
      updateHUD(); store();
    }
  }
  // What they throw: quick jabs, crosses, hooks and a slow haymaker (big telegraph, blocking it costs you).
  const EATK = {
    jab: { wu: 0.3, mult: 0.6, reach: 1.9, react: 'jab', side: 1 }, cross: { wu: 0.42, mult: 1, reach: 1.9, react: 'cross', side: -1 },
    hook: { wu: 0.5, mult: 1.15, reach: 1.7, react: 'hook', side: 1 }, hay: { wu: 0.72, mult: 1.8, reach: 2.0, react: 'heavy', side: -1, heavy: true },
  };
  const STYLES = {
    base: { jab: 0.35, cross: 0.33, hook: 0.2, hay: 0.12, block: 0.25, combo: 0.35, aggr: 1 },
    darren: { jab: 0.45, cross: 0.3, hook: 0.18, hay: 0.07, block: 0.3, combo: 0.45, aggr: 1.1 }, // quick, mouthy
    kev: { jab: 0.12, cross: 0.3, hook: 0.2, hay: 0.38, block: 0.4, combo: 0.2, aggr: 0.85 }, // slow, heavy hands
  };
  const styleOf = st => st === darrenState ? STYLES.darren : st === kevRun ? STYLES.kev : STYLES.base;
  function pickAttack(sty) { let r = rnd() * (sty.jab + sty.cross + sty.hook + sty.hay); for (const k of ['jab', 'cross', 'hook', 'hay']) if ((r -= sty[k]) <= 0) return k; return 'cross'; }
  function meleeAI(st, h, d, dmg, ko, dt, p) {
    st.lastSeen = performance.now(); st.inFight = d < 10;
    for (const k of ['blockT', 'blockCD', 'parried']) if (st[k] > 0) st[k] -= dt;
    h.daze = st.stagger > 0.35 || st.parried > 0;
    if (st.blockT > 0) h.mode = 'block';
    if (st.stagger > 0 || st.downT > 0 || (grab && grab.st === st)) { if (st.windup > 0) { st.windup = 0; h.clip = null; } return; }
    if (st.windup > 0) {
      const A = EATK[st.atk] || EATK.cross;
      // Step in behind the punch.
      if (p && d > 1.05) { const ux = (eye.position.x - p.position.x) / d, uz = (eye.position.z - p.position.z) / d, s0 = Math.min(2.6 * dt, d - 1.0); slideMove(p.position, ux * s0, uz * s0, 0.4); }
      st.windup -= dt;
      if (st.windup <= 0) {
        SFX.play('whoosh', A.heavy ? 1.2 : 0.75);
        const sty = styleOf(st);
        if (d < A.reach) { if (simT - lastBlockPress < 0.26 && dodgeT <= 0 && !drive.car) parry(st, h); else hurtPlayer(dmg * A.mult, ko, A); }
        else st.stagger = 0.25; // swung at air: off balance
        if (st.atk === 'jab' && !(st.parried > 0) && rnd() < sty.combo) { st.attackT = 0.1; st.chain = 'cross'; }
        else st.attackT = (0.75 + rnd() * 0.8) / sty.aggr;
        if (fightToken === st) tokenT = Math.min(tokenT, 0.4);
      }
      return;
    }
    st.attackT = (st.attackT ?? 0.6) - dt;
    if (d < 1.6 && st.attackT <= 0 && !(st.blockT > 0) && (fightToken === st || !fightToken)) {
      st.atk = st.chain || pickAttack(styleOf(st)); st.chain = null;
      const A = EATK[st.atk]; st.windup = A.wu; h.attack(st.atk, A.wu); h.mode = 'guard';
      if (A.heavy) SFX.play('tell');
    }
  }
  // Fighters close in, hold at range and circle; only the token holder steps in to swing.
  function brawlerMove(pos, st, d, dt, sp) {
    if (d < 0.01 || (grab && grab.st === st)) return 0;
    if (st.downT > 0) { st.downT -= dt; if (st.downT <= 0 && st._p && st.hp > 0) st._p.userData.human.getUp(); return 0; }
    if (d > 6) sp *= 1.8; // jog in from range
    const ux = (eye.position.x - pos.x) / d, uz = (eye.position.z - pos.z) / d;
    if ((st.circleT = (st.circleT ?? 0) - dt) <= 0) { st.circle = rnd() < 0.5 ? 1 : -1; st.circleT = 1.2 + rnd() * 2; }
    const attacker = fightToken === st || !fightToken, want = attacker ? 1.2 : 2.7;
    let fwd = d > want + 0.25 ? 1 : d < want - 0.3 ? -0.7 : 0, side = attacker ? (d < 2.2 ? 0.25 : 0) : 0.7;
    if (st.blockT > 0 || st.windup > 0) { fwd = Math.min(fwd, 0); side = 0; }
    if (d > 6) { fwd = 1; side = 0; }
    if (st.stagger > 0) { st.stagger -= dt; fwd = -0.9; side = 0; }
    const vx = (ux * fwd - uz * (st.circle || 1) * side) * sp, vz = (uz * fwd + ux * (st.circle || 1) * side) * sp;
    const b0x = pos.x, b0z = pos.z; slideMove(pos, vx * dt, vz * dt, 0.4);
    return Math.hypot(pos.x - b0x, pos.z - b0z) / Math.max(dt, 1e-4);
  }
  function hostiles() {
    const out = [];
    for (const e of enemies) if (e.alive && e.p.parent) out.push([e.p, e]);
    if (darrenState.hostile && !darrenState.down) out.push([darren, darrenState]);
    if (jobState.kev === 'fight' && !kevRun.down) out.push([JOBS.kev.npc, kevRun]);
    if (hustle && hustle.state === 'fight') out.push([hustle.npc, hustle]);
    for (const r of c1.rivals) if (r.alive && r.hostile && r.p.visible) out.push([r.p, r]);
    return out.filter(([p]) => dist(p.position) < 12);
  }
  function fightDirector(dt) {
    const list = hostiles();
    if (list.length && !fightTold && list.some(([p]) => dist(p.position) < 6)) { fightTold = true; say('HIT strings jab, cross, hook, uppercut. Tap BLOCK just as their punch lands to parry. TALK up close grabs.'); }
    if ((tokenT -= dt) <= 0 || !list.some(([, st]) => st === fightToken)) {
      const near = list.filter(([p]) => dist(p.position) < 5).sort((a, b) => dist(a[0].position) - dist(b[0].position));
      fightToken = near.length ? near[Math.floor(rnd() * Math.min(2, near.length))][1] : list[0]?.[1] || null; tokenT = 1.4 + rnd() * 1.2;
    }
    // Health bars over everyone you're fighting.
    for (const [p, st] of list) {
      if (!st._bar) {
        const g = new THREE.Group(), bg = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.07), new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.7, depthTest: false, toneMapped: false })), fg = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.05), new THREE.MeshBasicMaterial({ color: 0xe04040, depthTest: false, toneMapped: false }));
        fg.position.z = 0.001; bg.renderOrder = 20; fg.renderOrder = 21; g.add(bg, fg); scene.add(g); st._bar = { g, fg };
        st.maxHp = st.maxHp || Math.max(st.hp, 3);
      }
      const b = st._bar, f = clamp(st.hp / st.maxHp, 0, 1);
      b.g.visible = true; b.g.position.set(p.position.x, p.position.y + 2.12, p.position.z); b.g.quaternion.copy(camera.quaternion);
      b.fg.scale.x = Math.max(0.001, f); b.fg.position.x = -0.3 * (1 - f); b.st = st; b.seen = performance.now();
      // The bar flashes as they wind up (white for a haymaker), blue while they cover up.
      b.fg.material.color.setHex(st.windup > 0 ? (EATK[st.atk]?.heavy ? 0xffffff : 0xffa94d) : st.blockT > 0 ? 0x7fa8ff : st.parried > 0 ? 0x7fe0ff : 0xe04040);
    }
    for (const st of [...enemies, darrenState, kevRun, hustle, ...c1.rivals]) if (st && st._bar && !list.some(([, s2]) => s2 === st)) st._bar.g.visible = false;
  }
  function busted() {
    const lost = Math.round(cash * 0.3); cash -= lost; heat.level = 0; police.clear();
    if (drive.car) exitCar();
    if (c1.manuInCar) manuOut(home.pos.x, home.pos.z);
    const p = police.station; eye.position.set(p.x, groundHeight(p.x, p.z) + EYE, p.z);
    say(`Busted. A night in the cells at Manurewa station and a $${lost} fine.`);
    banner('BUSTED', lost ? `-$${lost} fine` : 'A night in the cells'); bnCash = cash;
    // Busted on the parcel run: the cops keep it, Rawiri has one more.
    if (stage === 'c1-deliver') { stage = 'c1-pickup'; rawiri.visible = true; say('Busted. The cops took the parcel. Rawiri\'s got one more: back to Southmall, and drive like a nana this time.'); }
    updateHUD(); store();
  }
  // ---- Chapter One per-frame logic ---------------------------------------------------------
  function chapterOne(dt) {
    const rdt = world.realDt || dt;
    if (stage === 'complete' && (c1.timer -= rdt) <= 0) { c1.timer = 1e9; phone.receive(TEXTS.c1Call, {}, () => { if (stage !== 'complete') return; rawiri.visible = true; advance('c1-car', 'Tipene texted. Get a car, then pick up Manu at his place.'); }); }
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
      phone.receive(TEXTS.c1ManuJumped, { rival: rivalCrew() }, () => { if (stage !== 'c1-wait') return; advance('c1-manu', 'Manu got jumped at Manurewa station. Get there.'); placeChapterOne(); });
    }
    // Rival fights.
    for (const r of c1.rivals) {
      if (!r.alive || !r.p.visible) continue;
      const h = r.p.userData.human, d = dist(r.p.position);
      if (stage === 'c1-manu' && d < 30) r.hostile = true;
      if (!r.hostile) { h.speed = 0; h.mode = 'idle'; continue; }
      let sp = 0;
      if (d < 30) sp = brawlerMove(r.p.position, r, d, dt, 1.75);
      faceEachOther(r.p); h.speed = sp; h.mode = d < 6 ? 'guard' : 'idle'; r.p.position.y = groundHeight(r.p.position.x, r.p.position.z);
      if (!dlg.active && !drive.car) meleeAI(r, h, d, 9, KO_HOME, dt, r.p);
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
    eye.position.x = lerp(eye.position.x, car.x - fx * 7, k); eye.position.z = lerp(eye.position.z, car.z - fz * 7, k); eye.position.y = lerp(eye.position.y, car.y + 2.6, k);
    $('speedo').style.display = 'block'; $('speedo').innerHTML = `${Math.round(Math.hypot(car.vx || 0, car.vz || 0) * 3.6)}<small>km/h</small>${drive.drifting ? ' <small style="color:#e8ba55">DRIFT</small>' : ''}<small style="color:${car.health > 60 ? '#b8f5e1' : car.health > 30 ? '#e8ba55' : '#ff7070'}"> · ${Math.round(car.health ?? 100)}%</small>`;
    if (car.health <= 0 && !car.deadSaid) { car.deadSaid = true; say('This car\'s munted. Get out and find another.'); }
  }
  let hintT = 0;
  function showHint(talking) {
    const el = $('hint'); let t = '';
    if (!talking && !dlg.active) {
      if (drive.car) t = Math.abs(drive.car.v) < 1 ? 'TALK / E: get out' : '';
      else if (hostiles().some(([p]) => dist(p.position) < 2.1) && !weapon) t = grab ? 'HIT: knee · TALK: throw' : lastPop === 'BLOCKED' && simT - lastPopT < 2 ? 'BLOCKED · TALK: grab · 4th hit breaks guard' : 'TALK: grab';
      else if (hustle && hustle.state === 'open' && dist(hustle.npc.position) < 4.5) t = `TALK: ${hustle.name}`;
      else if (nearestPickup() && !weapon) t = `TALK: pick up ${WEAPON_DEF[nearestPickup().kind].name}`;
      else { const sh = shops.nearest(eye.position); if (sh) t = `TALK: ${sh.name}`; else if (drive.nearest(eye.position)) t = 'TALK / E: get in'; }
    }
    el.textContent = t; el.style.display = t ? 'block' : 'none';
  }

  // ---- camera: first person at the eye, or over the shoulder with your own body on screen -------
  const playerBody = person(0, 0, { look: 'player', seed: 4321, top: 0x2f3236, topCell: ATLAS.cotton, pants: 0x3a4a66, pantsCell: ATLAS.denim, face: ATLAS.faceC, shoes: 0xeeeeee, pose: 'relaxed' });
  playerBody.visible = false;
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 90, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd860, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, blending: THREE.AdditiveBlending }));
  beacon.visible = false; scene.add(beacon);
  let beaconTarget = null;
  const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _head = new THREE.Vector3(), _want = new THREE.Vector3();
  function syncCamera(dt, t) {
    const tp = thirdPerson && !drive.car && !inPrologue;
    playerBody.visible = tp && started;
    if (!tp) { camera.position.copy(eye.position); camera.quaternion.copy(eye.quaternion); }
    else {
      if (fists.group) fists.group.visible = false;
      const pb = playerBody, h = pb.userData.human, sp = vel.length();
      pb.position.set(eye.position.x, groundHeight(eye.position.x, eye.position.z), eye.position.z);
      let want = bodyYaw;
      if (guardingNow || performance.now() - lastPunch < 650 || hostiles().length) want = yaw + Math.PI; else if (sp > 0.4) want = Math.atan2(vel.x, vel.y);
      let da = want - bodyYaw; da = Math.atan2(Math.sin(da), Math.cos(da)); bodyYaw += da * Math.min(1, dt * 12); pb.rotation.y = bodyYaw;
      h.mode = guardingNow && dodgeT <= 0 ? 'block' : hostiles().length || pmove ? 'guard' : 'idle'; h.dodge = dodgeT > 0; h.update(dt, t);
      _f.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)); _r.set(Math.cos(yaw), 0, -Math.sin(yaw));
      _head.copy(eye.position).y -= 0.05;
      _want.copy(_head).addScaledVector(_r, 0.7).addScaledVector(_f, -3.7); _want.y += 0.45;
      // Pull the camera in rather than through walls and fences.
      let k = 1; for (let i = 1; i <= 10; i++) { const f = i / 10, x = lerp(_head.x, _want.x, f), z = lerp(_head.z, _want.z, f); if (collision.collides(x, z, 0.22)) { k = Math.max(0.15, (i - 1) / 10); break; } }
      _want.lerpVectors(_head, _want, k); _want.y = Math.max(_want.y, groundHeight(_want.x, _want.z) + 0.35);
      if (camera.position.distanceTo(_want) > 6) camera.position.copy(_want); else camera.position.lerp(_want, 1 - Math.exp(-dt * 16));
      camera.quaternion.copy(eye.quaternion);
    }
    // Objective beacon: a tall light over wherever you need to go.
    const tg = beaconTarget, show = !!tg && started && !dlg.active && Math.hypot(tg.x - eye.position.x, tg.z - eye.position.z) > 18;
    beacon.visible = show; if (show) { beacon.position.set(tg.x, (tg.y || 0) + 45, tg.z); beacon.material.opacity = 0.14 + 0.06 * Math.sin(t * 2.5); }
  }
  function setView(third) {
    thirdPerson = third; try { localStorage.setItem('au-view', third ? '3' : '1'); } catch (_) { }
    $('viewToggle').textContent = third ? 'VIEW: THIRD PERSON' : 'VIEW: FIRST PERSON'; $('viewToggle').classList.toggle('on', third);
    document.body.classList.toggle('thirdperson', third);
  }
  $('viewToggle').onclick = () => setView(!thirdPerson);
  addEventListener('keydown', e => { if (e.code === 'KeyV' && started) setView(!thirdPerson); });
  setView(thirdPerson);
  const soundToggle = on => { SFX.setOn(on); try { localStorage.setItem('au-sound', on ? '1' : '0'); } catch (_) { } $('soundToggle').textContent = on ? 'SOUND: ON' : 'SOUND: OFF'; $('soundToggle').classList.toggle('on', on); };
  $('soundToggle').onclick = () => soundToggle(!SFX.on);
  soundToggle((() => { try { return localStorage.getItem('au-sound') !== '0'; } catch (_) { return true; } })());

  // ---- per-frame simulation ---------------------------------------------------------------
  let lastHud = 0, bobT = 0;
  const forward = new THREE.Vector3();
  function update(dt, now, t) {
    if (hitStop > 0) { hitStop -= dt; dt *= 0.08; }
    if (slowMo > 0) { slowMo -= world.realDt || dt; dt *= 0.35; }
    SFX.ambience(world.realDt || dt, G.uNight.value);
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
      // Momentum: jog 4.4 m/s, sprint 7.8, guard shuffle 2.2; accelerate and ease to a stop.
      const topSpeed = sprinting ? 7.8 : guarding ? 2.2 : 4.4;
      let dx = talking ? 0 : right, dz = talking ? 0 : back; const len = Math.hypot(dx, dz);
      if (len > 1) { dx /= len; dz /= len; }
      const wx = (dx * Math.cos(yaw) + dz * Math.sin(yaw)) * topSpeed, wz = (-dx * Math.sin(yaw) + dz * Math.cos(yaw)) * topSpeed;
      // Dodge: hit BLOCK while moving for a quick sidestep (you can't be hit during it; costs energy).
      const blockEdge = guarding && !prevBlock; prevBlock = guarding; guardingNow = guarding; dodgeCD -= dt;
      simT += dt; if (blockEdge) lastBlockPress = simT;
      if (blockEdge && len > 0.5 && stamina >= 20 && dodgeCD <= 0 && !drive.car) { const k = 9.5 / Math.max(0.01, Math.hypot(wx, wz)); dodgeT = 0.26; dodgeCD = 0.7; stamina -= 20; vel.set(wx * k, wz * k); SFX.play('dodge'); }
      if (dodgeT > 0) dodgeT -= dt;
      else { const acc = (Math.hypot(wx, wz) > vel.length() ? 24 : 32) * dt, ex = wx - vel.x, ez = wz - vel.y, el = Math.hypot(ex, ez); if (el <= acc) vel.set(wx, wz); else vel.set(vel.x + ex / el * acc, vel.y + ez / el * acc); }
      const mx = vel.x * dt, mz = vel.y * dt;
      if (!drive.car && (stepDist += Math.hypot(mx, mz)) > (sprinting ? 1.5 : 0.9)) { stepDist = 0; SFX.play('step', isCarriageway(eye.position.x, eye.position.z) ? 2 : 1); }
      if (drive.car) driveFrame(dt, talking ? 0 : clamp(-back, -1, 1), talking ? 0 : clamp(right, -1, 1));
      else {
        const jumpNow = !!(keys.Space || move.jump); if (jumpNow && !prevJump && !talking) tryJump(); prevJump = jumpNow;
        if (!climb) slideMove(eye.position, mx * (air ? 0.85 : 1), mz * (air ? 0.85 : 1), 0.55, Math.max(0, feetUp()));
        bobT += dt * (moving && !air ? (sprinting ? 13 : 9) * Math.min(1, len) : 0);
        verticalFrame(dt, moving);
      }
      traffic.update(dt, drive.car ? { x: drive.car.x, z: drive.car.z } : eye.position, drive.car);
      const me = drive.car ? { x: drive.car.x, z: drive.car.z } : eye.position;
      peds.update(dt, me.x, me.z, (pp, dx, dz) => slideMove(pp, dx, dz, 0.35));
      heat.update(dt, policeSeen);
      const pr = police.update(dt, t, heat, me, !!drive.car);
      policeSeen = pr.closest < 70;
      if (pr.closest < 40 && heat.level > 0) peds.scare(me.x, me.z, 20);
      if (pr.caught) busted();
      chapterOne(dt);
      // Traffic that reaches you on foot clips you (they normally stop in time).
      if (!drive.car) for (const o of traffic.obstacles()) if (o.car.v > 4 && Math.hypot(o.x - eye.position.x, o.z - eye.position.z) < 1.3) { hurtPlayer(12, KO_HOME); o.car.v = 0; say('Watch the road, egg.'); }
      window.__auTelemetry = { engine: 'three', started, paused: pauseOpen, x: eye.position.x, z: eye.position.z, joyX: joy.x, joyY: joy.y };
      window.AUControls?.setPosition?.(eye.position.x, eye.position.z, 'THREE');
      if (Math.abs(joy.x) + Math.abs(joy.y) > 0.1) $('joyReadout').textContent = `${Math.round(eye.position.x)},${Math.round(eye.position.z)}`;
      const guardUp = enemies.some(e => e.alive && dist(e.p.position) < 8) || (darrenState.hostile && dist(darren.position) < 8) || (jobState.kev === 'fight' && dist(JOBS.kev.npc.position) < 8);
      fists.hold = !!grab;
      fists.update(dt, moving, sprinting, (guardUp || hostiles().length > 0) && !drive.car, guarding && !drive.car);
      moveFrame(dt); lockOn(dt);
      fightDirector(dt);
      if (grab) {
        grab.t += dt; const g = grab, f = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
        g.p.position.set(eye.position.x + f.x * 0.85, groundHeight(eye.position.x, eye.position.z), eye.position.z + f.z * 0.85); g.p.rotation.y = Math.atan2(-f.x, -f.z);
        g.st.stagger = 0.4; g.st.windup = 0; if (g.t > 1.8 || !hostiles().some(([, st]) => st === g.st)) throwGrab();
      }
      if (drive.car) fists.group.visible = false;
      // Interaction hints.
      if ((hintT -= dt) <= 0) { hintT = 0.25; showHint(talking); }
      // Hustles: Shorty texts a new job every few minutes once his chapter is done.
      if (STAGES.indexOf(stage) >= STAGES.indexOf('recruit') && (!hustle || hustle.state === 'done') && (hustleTimer -= world.realDt || dt) <= 0) startHustle();
      if (hustle && hustle.state === 'done' && hustle.npc.visible && dist(hustle.npc.position) > 120) hustle.npc.visible = false;
      if (hustle && hustle.state === 'fight') {
        const n = hustle.npc, h = n.userData.human, d = dist(n.position);
        let sp = 0;
        if (d < 25) sp = brawlerMove(n.position, hustle, d, dt, 1.7);
        faceEachOther(n); h.speed = sp; h.mode = d < 6 ? 'guard' : 'idle'; n.position.y = groundHeight(n.position.x, n.position.z);
        if (!talking && !drive.car) meleeAI(hustle, h, d, 9, KO_HOME, dt, n);
      }
      for (const e of enemies) {
        if (!e.alive) continue;
        const h = e.p.userData.human;
        const d = Math.hypot(eye.position.x - e.p.position.x, eye.position.z - e.p.position.z);
        let sp = 0;
        if (d < 15) sp = brawlerMove(e.p.position, e, d, dt, 1.7);
        if (d < 15) e.p.rotation.y = Math.atan2(eye.position.x - e.p.position.x, eye.position.z - e.p.position.z);
        h.speed = sp; h.mode = d < 6 ? 'guard' : 'idle';
        e.p.position.y = groundHeight(e.p.position.x, e.p.position.z);
        if (!drive.car) meleeAI(e, h, d, 8, KO_ENEMY, dt, e.p);
      }
      // Darren squares up when the debt talk goes bad.
      {
        const h = darren.userData.human, d = dist(darren.position);
        if (darrenState.hostile && !darrenState.down) {
          let sp = 0;
          if (d < 20) sp = brawlerMove(darren.position, darrenState, d, dt, 1.8);
          faceEachOther(darren); h.speed = sp; h.mode = d < 6 ? 'guard' : 'idle';
          darren.position.y = groundHeight(darren.position.x, darren.position.z);
          if (!talking && !drive.car) meleeAI(darrenState, h, d, 10, KO_DARREN, dt, darren);
        } else { h.mode = 'idle'; h.speed = 0; }
      }
      // Shorty texts a little while after Manu passes your number on.
      if (stage === 'shorty-wait' && (shortyTimer -= world.realDt || dt) <= 0) {
        shortyTimer = 1e9; phone.receive(TEXTS.shortyHello, phoneVars(), () => { if (stage === 'shorty-wait') advance('shorty-meet', `Shorty texted. Go see him on ${sHome.address}.`); });
      }
      // Kev fights like a panel beater: slower than Darren, hits harder.
      if (jobState.kev === 'fight' && !kevRun.down) {
        const kev = JOBS.kev.npc, h = kev.userData.human, d = dist(kev.position);
        let sp = 0;
        if (d < 22) sp = brawlerMove(kev.position, kevRun, d, dt, 1.6);
        faceEachOther(kev); h.speed = sp; h.mode = d < 6 ? 'guard' : 'idle'; kev.position.y = groundHeight(kev.position.x, kev.position.z);
        if (!talking && !drive.car) meleeAI(kevRun, h, d, 14, KO_KEV, dt, kev);
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
          if (mikeyRun.burst > 0) { mikeyRun.burst -= dt; speed = 8.3; if (mikeyRun.burst <= 0) mikeyRun.tired = 2.4; }
          else { mikeyRun.tired -= dt; speed = 3.0; if (mikeyRun.tired <= 0) mikeyRun.burst = 3.5; }
          const ax = (mk.position.x - eye.position.x) / d, az = (mk.position.z - eye.position.z) / d, b0 = mk.position.clone();
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
      const h = c.userData.human, dx = eye.position.x - c.position.x, dz = eye.position.z - c.position.z, d = Math.hypot(dx, dz);
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
    eye.rotation.order = 'YXZ';
    const sh = world.shake || 0; world.shake = Math.max(0, sh - dt);
    eye.rotation.set(pitch + (Math.random() - 0.5) * sh * 0.12, yaw + (Math.random() - 0.5) * sh * 0.12, 0);
    syncCamera(dt, t);
    // Animate characters near the camera every frame, distant ones at a lower rate.
    for (const p of [...contacts.map(c => c.p), fixer, manu, darren, shorty, ...Object.values(JOBS).map(j => j.npc), ...enemies.map(e => e.p), ...debtors, ...peds.people, rawiri, lani, ...c1.rivals.map(r => r.p), ...labPeople]) {
      if (!p.parent || !p.visible) continue;
      const d = p.position.distanceTo(eye.position);
      const h = p.userData.human;
      if (d < 45 || (h.skip = (h.skip || 0) + 1) % 4 === 0) h.update(d < 45 ? dt : dt * 4, t);
    }
    forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    return forward;
  }

  // Pose lab (screenshots/tests): frozen figures, e.g. { look, x, z, ry, vx, vz, ph, clip, u, mode, down }.
  const labPeople = [];
  function lab(list) {
    list.forEach((o, i) => {
      let p = labPeople[i]; if (!p) { p = person(o.x, o.z, { look: o.look || 'player', seed: 77 + i, pose: 'relaxed' }); labPeople.push(p); }
      p.visible = true; p.position.set(o.x, groundHeight(o.x, o.z), o.z); p.rotation.y = o.ry || 0;
      const h = p.userData.human; h.mode = o.mode || 'idle'; h.weapon = !!o.weapon; h.lab = o; h.react = o.react ? { kind: o.react, side: o.side || 1, t: o.rt ?? 0.06 } : null;
    });
    for (let i = list.length; i < labPeople.length; i++) labPeople[i].visible = false;
  }
  window.__auEngineReady = true; window.__auThreeBooting = false; document.documentElement.dataset.engine = 'ready';
  $('start').disabled = false; $('continue').disabled = false; $('start').title = ''; $('continue').title = '';
  // Test/diagnostic hooks.
  window.__auGame = {
    state: () => ({ stage, hp, rep, cash, chosen, defeated, started, x: eye.position.x, z: eye.position.z, yaw, objective: objective()[0] }),
    teleport(x, z) { eye.position.set(x, groundHeight(x, z) + EYE, z); },
    face(y) { yaw = y; }, look(p) { pitch = p; }, talk, hit, collides, lab, fpLab: o => { fists.lab = o || null; },
    drive: () => drive.car ? { x: drive.car.x, z: drive.car.z, v: drive.car.v, h: drive.car.h } : null,
    nearestCar: () => { let b = null, bd = 1e9; for (const c of world.city.cars) { if (c.taken) continue; const d = Math.hypot(c.x - eye.position.x, c.z - eye.position.z); if (d < bd) { bd = d; b = c; } } return b && { x: b.x, z: b.z }; },
    shopsList: () => shops.list.map(s => ({ kind: s.kind, name: s.name, x: s.x, z: s.z })),
    buy: i => { const b = document.querySelectorAll('#shopItems button')[i]; b?.click(); return !!b; }, closeShop: () => shops.close(),
    setHp: v => { hp = v; }, setCash: v => { cash = v; }, strength: () => strength, traffic: () => traffic.cars.length,
    hustle: () => hustle && { name: hustle.name, amount: hustle.amount, state: hustle.state, type: hustle.type, x: hustle.npc.position.x, z: hustle.npc.position.z },
    startHustle: type => { hustleTimer = 0; startHustle(); if (hustle && type) hustle.type = type; return !!hustle; },
    jumpTest: () => { tryJump(); return { air, climb: !!climb }; }, y: () => eye.position.y, airborne: () => air || !!climb,
    nearFence: () => { let best = null, bd = 1e9; for (const o of collision.list) { if (o.tag !== 'fence' || o.t !== 2 || o.top > 1.9 || o.top < 0.8) continue; const mx = (o.ax + o.bx) / 2, mz = (o.az + o.bz) / 2, d = Math.hypot(mx - eye.position.x, mz - eye.position.z); if (d < bd && Math.hypot(o.bx - o.ax, o.bz - o.az) > 3) { bd = d; best = o; } } return best && { ax: best.ax, az: best.az, bx: best.bx, bz: best.bz, top: best.top }; },
    fight: () => ({ move: pmove && pmove.name, busy: !!pmove, combo: comboIdx, pop: lastPop, windups: hostiles().map(([, st]) => st.windup || 0), blocks: hostiles().map(([, st]) => st.blockT || 0) }),
    block: on => { move.block = !!on; },
    grabbed: () => !!grab, weapon: () => weapon && { ...weapon }, pickups: () => pickups.map(q => ({ kind: q.kind, x: q.x, z: q.z })), carHealth: () => drive.car ? drive.car.health : null,
    view: v => { if (v != null) setView(!!v); return thirdPerson; }, feel: () => ({ vel: vel.length(), dodgeT, token: !!fightToken, beacon: beacon.visible, bars: [...enemies, darrenState, kevRun, ...c1.rivals].filter(s => s && s._bar && s._bar.g.visible).length }),
    dodge: () => { prevBlock = false; move.block = true; setTimeout(() => { move.block = false; }, 120); },
    pedDebug: () => peds.agents.map(a => ({ active: a.active, x: Math.round(a.p.position.x), z: Math.round(a.p.position.z), flee: a.flee, down: a.down, vis: a.p.visible })),
    heat: () => heat.level, addHeat: n => heat.add(n), clearHeat: () => { heat.level = 0; police.clear(); }, police: () => police.cars.map(c => ({ x: c.x, z: c.z })), peds: () => peds.agents.filter(a => a.active).length,
    carTo: (x, z) => { if (drive.car) { drive.car.x = x; drive.car.z = z; drive.car.v = 0; } },
    c1: () => ({ manuInCar: c1.manuInCar, rawiri: rawiri.position.clone(), lani: lani.position.clone(), home: home.pos.clone(), rivals: c1.rivals.map(r => ({ x: r.p.position.x, z: r.p.position.z, alive: r.alive, hostile: r.hostile, hp: r.hp, down: r.downT || 0, stagger: r.stagger || 0 })) }),
    skipTimers: () => { if (c1.timer < 1e8) c1.timer = 0; }, // not once a text is already on its way
    jobs: () => ({ ...jobState }),
    targets: () => ({ fixer: fixer.position.clone(), manu: manu.position.clone(), darren: darren.position.clone(), shorty: shorty.position.clone(), kev: JOBS.kev.npc.position.clone(), mikey: JOBS.mikey.npc.position.clone(), pita: JOBS.pita.npc.position.clone(), stash: stash.position.clone(), contacts: contacts.map(c => ({ f: c.f, x: c.p.position.x, z: c.p.position.z })), enemies: enemies.map(e => ({ x: e.p.position.x, z: e.p.position.z, alive: e.alive })) }),
  };
  return { update, isStarted: () => started, isPaused: () => pauseOpen, inPrologue: () => inPrologue };
}
