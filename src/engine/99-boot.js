// Entry point: build the world, wire settings, run the frame loop.
async function boot() {
  const settings = loadSettings();
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
  renderer.domElement.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block;z-index:0;touch-action:none';
  document.body.prepend(renderer.domElement);
  const detected = detectTier(renderer);
  // HDR post-processing renders to half-float targets; without colour-buffer-float support use the direct path.
  const hdrOK = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
  if (!hdrOK) for (const k in QUALITY) Object.assign(QUALITY[k], { post: 0, ao: 0, bloom: 0, msaa: 0 });
  let tierName = QUALITY[settings.tier] ? settings.tier : detected.tier, q = QUALITY[tierName];
  const startTex = q.tex;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.info.autoReset = false;
  let dpr = Math.min(devicePixelRatio || 1, q.dprStart);
  renderer.setPixelRatio(dpr); renderer.setSize(innerWidth, innerHeight, false);
  const post = new PostPipeline(renderer);
  const bufferSize = () => { const v = new THREE.Vector2(); renderer.getDrawingBufferSize(v); return v; };
  { const s = bufferSize(); post.setSize(s.x, s.y); }
  post.configure(q);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 1800);
  scene.add(camera);
  const sky = new SkySystem(scene, renderer);
  sky.configureShadows(q);
  let timeName = TIME_PRESETS[settings.time] ? settings.time : 'golden';
  sky.apply(timeName, post);

  setLoad(0.05, 'Generating surface materials…');
  const forge = new TextureForge(renderer, q.tex, Math.min(q.aniso, renderer.capabilities.getMaxAnisotropy()));
  const names = Object.keys(TEX_DEFS);
  for (let i = 0; i < names.length; i++) { forge.make(names[i]); if (i % 3 === 2) { setLoad(0.05 + 0.2 * i / names.length); await nextTick(); } }
  const lib = new MaterialLib(forge, q);

  setLoad(0.28, 'Building the district…');
  const city = new City(lib, scene, q);
  await city.build(f => setLoad(0.28 + f * 0.4, 'Building the district…'));
  city.finish();
  setLoad(0.72, 'Planting trees, parking cars…'); await nextTick();
  new PropBuilder(lib, scene, city, q).build();
  setLoad(0.82, 'Dressing the locals…'); await nextTick();
  const charMaterial = buildCharacterAtlas();
  const fists = new Fists(charMaterial, camera);
  const rain = new Rain(scene, 2600);
  let rainLevel = Number.isInteger(settings.rain) ? clamp(settings.rain, 0, 2) : 1;
  rain.set(rainLevel, q, sky.preset.night);

  // Night lighting: a small pool of real point lights follows the player between the nearest lamps.
  const pool = [];
  for (let i = 0; i < 8; i++) { const l = new THREE.PointLight(0xffc28a, 0, 30, 1.7); l.visible = false; scene.add(l); pool.push(l); }
  const applyNight = () => { const on = sky.preset.night > 0.5; pool.forEach(l => { l.visible = on; l.intensity = on ? 140 : 0; }); };
  applyNight();
  let poolTimer = 0;
  const updatePool = dt => {
    if (!pool[0].visible || (poolTimer -= dt) > 0) return;
    poolTimer = 0.3;
    const p = camera.position;
    const near = city.lights.map(v => [v, (v.x - p.x) ** 2 + (v.z - p.z) ** 2]).sort((a, b) => a[1] - b[1]).slice(0, pool.length);
    near.forEach(([v], i) => pool[i].position.copy(v).add(new THREE.Vector3(0, -0.4, 0)));
  };

  const world = { scene, camera, renderer, collision: city.collision, charMaterial, fists, shake: 0, hurt: 0 };
  window.__auDebug = { scene, renderer, camera, post, sky, city };
  setLoad(0.9, 'Compiling shaders…'); await nextTick();
  const game = createGame(world);
  try { await renderer.compileAsync(scene, camera); } catch (_) { /* compileAsync is an optimisation only */ }
  setLoad(1, 'District ready.');

  // ---- settings panel ---------------------------------------------------------------------
  const mark = () => {
    document.querySelectorAll('[data-gfx]').forEach(b => b.classList.toggle('on', b.dataset.gfx === tierName));
    document.querySelectorAll('[data-time]').forEach(b => b.classList.toggle('on', b.dataset.time === timeName));
    document.querySelectorAll('[data-rain]').forEach(b => b.classList.toggle('on', +b.dataset.rain === rainLevel));
    $('fpsToggle').classList.toggle('on', !!settings.fps);
    $('fps').style.display = settings.fps ? 'block' : 'none';
  };
  const persist = () => { settings.tier = tierName; settings.time = timeName; settings.rain = rainLevel; saveSettings(settings); mark(); };
  document.querySelectorAll('[data-gfx]').forEach(b => b.addEventListener('click', () => {
    tierName = b.dataset.gfx; q = QUALITY[tierName];
    post.configure(q); sky.configureShadows(q); rain.set(rainLevel, q, sky.preset.night);
    dpr = Math.min(devicePixelRatio || 1, q.dprStart); resize();
    $('gfxNote').textContent = q.tex !== startTex ? 'Texture detail for this setting applies after you reload the page.' : `Graphics: ${tierName.toUpperCase()}. GPU: ${detected.gpu}`;
    persist();
  }));
  document.querySelectorAll('[data-time]').forEach(b => b.addEventListener('click', () => { timeName = b.dataset.time; sky.apply(timeName, post); applyNight(); rain.set(rainLevel, q, sky.preset.night); persist(); }));
  document.querySelectorAll('[data-rain]').forEach(b => b.addEventListener('click', () => { rainLevel = +b.dataset.rain; rain.set(rainLevel, q, sky.preset.night); persist(); }));
  $('fpsToggle').addEventListener('click', () => { settings.fps = !settings.fps; persist(); });
  $('gfxNote').textContent = `Auto-detected: ${detected.tier.toUpperCase()} (${detected.gpu})`;
  mark();

  function resize() {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setPixelRatio(dpr); renderer.setSize(innerWidth, innerHeight, false);
    const s = bufferSize(); post.setSize(s.x, s.y);
  }
  addEventListener('resize', resize);

  // ---- frame loop ---------------------------------------------------------------------------
  let prev = performance.now(), frames = 0, frameMs = 0, cooldown = 0, fpsShown = 0, fpsTimer = 0;
  const hitFlash = $('hitFlash');
  function loop(now) {
    requestAnimationFrame(loop);
    const elapsed = clamp(now - prev, 0, 250), dt = Math.min(elapsed / 1000, 0.05); prev = now;
    if (document.hidden) return;
    G.uTime.value += dt;
    const forward = game.update(dt, now, G.uTime.value);
    sky.update(camera, forward);
    rain.update(camera);
    updatePool(dt);
    world.hurt = Math.max(0, world.hurt - dt * 2.5); hitFlash.style.opacity = (world.hurt * 0.8).toFixed(2);
    renderer.info.reset();
    post.render(scene, camera, dt);
    // Adaptive resolution keeps the frame rate up as the phone heats up.
    if (elapsed > 0 && elapsed < 150) { frames++; frameMs += elapsed; }
    if (frames >= 90) {
      const fps = 1000 * frames / frameMs;
      if (now > cooldown) {
        let target = dpr;
        if (fps < 40) target = Math.max(0.7, dpr - 0.12); else if (fps > 57) target = Math.min(q.dprMax, devicePixelRatio || 1, dpr + 0.08);
        if (Math.abs(target - dpr) > 0.01) { dpr = target; resize(); cooldown = now + 5000; }
      }
      fpsShown = fps; frames = 0; frameMs = 0;
    }
    if ((fpsTimer -= dt) <= 0) {
      fpsTimer = 0.5;
      const info = renderer.info.render;
      window.__auStats = { fps: Math.round(fpsShown), dpr, tier: tierName, calls: info.calls, triangles: info.triangles, gpu: detected.gpu };
      if (settings.fps) $('fps').innerHTML = `${Math.round(fpsShown)} FPS · ${dpr.toFixed(2)}x · ${tierName.toUpperCase()}<br>${info.calls} draws · ${(info.triangles / 1e3).toFixed(0)}k tris`;
    }
  }
  requestAnimationFrame(loop);
}

if (!AU_SKIP) {
  boot().catch(err => {
    console.error('AOTEAROA engine failed to start', err);
    window.__auThreeBooting = false;
    document.querySelectorAll('canvas:not(#miniMap)').forEach(c => { if (c.id !== 'offlineWorld') c.remove(); });
    setLoad(0, 'The full 3D engine could not start on this device. Starting the offline district…');
    if (!window.__auEngineReady && !window.__auOfflineWebGL) window.__auStartOffline();
  });
}
