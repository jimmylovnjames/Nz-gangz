// Sky dome with procedural clouds, baked into a PMREM environment for image-based lighting.
const lin = hex => new THREE.Color(hex); // THREE.Color hex input is sRGB; stored linear.
const TIME_PRESETS = {
  golden: {
    sunElev: 8.5, sunAzim: -38, sunColor: lin(0xffc39a), sunIntensity: 4.6,
    zenith: lin(0x3a6cb0), horizon: lin(0xf6c79a), horizon2: lin(0xa9b7c9), ground: lin(0x3a342e), cloudLit: lin(0xffe2c4), cloudShade: lin(0x7a7f90),
    cover: 0.45, fog: lin(0xb4b6b9), fogSun: lin(0xf7b27a), fogDensity: 0.0009, fogFalloff: 0.03,
    exposure: 0.95, env: 0.95, night: 0, litFrac: 0.14, sat: 1.06, contrast: 1.1, tone: 0,
    shadowTint: [-0.012, 0.0, 0.016], highTint: [0.02, 0.008, -0.014],
    hdri: 'kloppenheim_06_puresky_2k.hdr', hdriSun: 3.4, hdriExposure: 0.52, hdriEnv: 0.9, bgIntensity: 1.0, hdriFog: 0.0006, hdriContrast: 1.14, hdriSat: 1.1,
  },
  overcast: {
    sunElev: 38, sunAzim: -20, sunColor: lin(0xdfe6ef), sunIntensity: 1.1,
    zenith: lin(0x8c98a6), horizon: lin(0xc3c9cf), horizon2: lin(0xbcc3ca), ground: lin(0x3c3f40), cloudLit: lin(0xd2d6db), cloudShade: lin(0x7f868f),
    cover: 0.93, fog: lin(0xaeb6bd), fogSun: lin(0xc8cdd2), fogDensity: 0.0022, fogFalloff: 0.025,
    exposure: 1.1, env: 1.25, night: 0, litFrac: 0.22, sat: 0.98, contrast: 1.08, tone: 0,
    shadowTint: [-0.006, 0.0, 0.01], highTint: [0.0, 0.0, 0.0],
    hdri: 'kloofendal_overcast_puresky_1k.hdr', hdriSun: 0.8, hdriExposure: 0.75, hdriEnv: 1.1, bgIntensity: 1.0, hdriFog: 0.0016, hdriContrast: 1.1, hdriSat: 1.0,
  },
  // Clear midday (the live clock's 8:30 to 4:30); in heavy rain it turns overcast instead.
  day: {
    sunElev: 52, sunAzim: 10, sunColor: lin(0xfff1dc), sunIntensity: 3.6,
    zenith: lin(0x2f64b8), horizon: lin(0xbcd2e8), horizon2: lin(0xa9c0da), ground: lin(0x3a3a36), cloudLit: lin(0xffffff), cloudShade: lin(0x9aa3b2),
    cover: 0.4, fog: lin(0xb8c6d4), fogSun: lin(0xe8eef2), fogDensity: 0.0012, fogFalloff: 0.03,
    exposure: 0.9, env: 1.0, night: 0, litFrac: 0.05, sat: 1.04, contrast: 1.08, tone: 0,
    shadowTint: [-0.006, 0.0, 0.012], highTint: [0.008, 0.004, -0.006],
    hdri: 'kloofendal_48d_partly_cloudy_puresky_1k.hdr', hdriSun: 2.5, hdriExposure: 0.56, hdriEnv: 1.9, bgIntensity: 1.0, hdriFog: 0.0009, hdriContrast: 1.1, hdriSat: 1.05,
  },
  // Moonlit, with the orange glow of Auckland on the horizon: dark, but you can see the street (Run 23: the
  // live clock makes night a third of play, and the old near-black night was unplayable on a phone).
  night: {
    sunElev: 34, sunAzim: 60, sunColor: lin(0x9fb4e6), sunIntensity: 0.95,
    zenith: lin(0x0e1a32), horizon: lin(0x5a4436), horizon2: lin(0x232838), ground: lin(0x1a1a1a), cloudLit: lin(0x2a2526), cloudShade: lin(0x0b0b10),
    cover: 0.6, fog: lin(0x262a36), fogSun: lin(0x1c1c24), fogDensity: 0.002, fogFalloff: 0.03,
    exposure: 1.8, env: 1.7, night: 1, litFrac: 0.42, sat: 1.05, contrast: 1.08, tone: 0,
    shadowTint: [-0.006, 0.0, 0.014], highTint: [0.012, 0.004, -0.01],
  },
};

const SKY_FRAG = `
uniform vec3 uSkySun; uniform vec3 uSunColor; uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uHorizon2; uniform vec3 uGround;
uniform vec3 uCloudLit; uniform vec3 uCloudShade; uniform float uCover; uniform float uSkyTime; uniform float uEnvBake; uniform float uSkyNight;
varying vec3 vDir;
float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h12(i), h12(i + vec2(1, 0)), f.x), mix(h12(i + vec2(0, 1)), h12(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 6; i++) { s += a * vnoise(p); p = p * 2.07 + vec2(17.1, 9.3); a *= 0.5; } return s; }
void main(){
  vec3 rd = normalize(vDir);
  float y = rd.y, h = max(y, 0.0);
  float sd = max(dot(rd, uSkySun), 0.0);
  float toward = dot(normalize(rd.xz + 1e-5), normalize(uSkySun.xz + 1e-5)) * 0.5 + 0.5;
  vec3 col = mix(mix(uHorizon2, uHorizon, pow(toward, 1.6)), uZenith, pow(h, 0.42));
  col += uSunColor * (pow(sd, 5.0) * 0.28 + pow(sd, 48.0) * 0.5) * (1.0 - uSkyNight * 0.9);
  col += uSunColor * smoothstep(0.99955, 0.9999, sd) * 45.0 * (1.0 - uEnvBake);
  if (y > 0.0) {
    vec2 cp = rd.xz / (y + 0.12) * 1.25 + uSkyTime * vec2(0.006, 0.0025);
    float n = fbm(cp);
    float lit = fbm(cp + uSkySun.xz * 0.09);
    float cover = smoothstep(1.0 - uCover - 0.08, 1.0 - uCover + 0.38, n);
    float shade = clamp((n - lit) * 5.0 + 0.55, 0.0, 1.0);
    vec3 cloud = mix(uCloudShade, uCloudLit, shade);
    cloud += uSunColor * pow(sd, 10.0) * 0.9 * (1.0 - cover * 0.6);
    cover *= smoothstep(0.0, 0.1, y);
    col = mix(col, cloud, cover * 0.96);
    if (uSkyNight > 0.5) {
      vec2 sp = floor(rd.xz / (y + 0.3) * 260.0);
      float star = step(0.9975, h12(sp)) * (1.0 - cover) * smoothstep(0.05, 0.3, y);
      col += vec3(star) * 0.6;
    }
  }
  col = mix(col, uGround, smoothstep(0.0, -0.06, y));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

class SkySystem {
  constructor(scene, renderer) {
    this.scene = scene; this.renderer = renderer;
    this.uniforms = {
      uSkySun: { value: new THREE.Vector3(0, 1, 0) }, uSunColor: { value: new THREE.Color() },
      uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uHorizon2: { value: new THREE.Color() }, uGround: { value: new THREE.Color() },
      uCloudLit: { value: new THREE.Color() }, uCloudShade: { value: new THREE.Color() },
      uCover: { value: 0.5 }, uSkyTime: { value: 0 }, uEnvBake: { value: 0 }, uSkyNight: { value: 0 },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
      fragmentShader: SKY_FRAG,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), this.material);
    this.mesh.renderOrder = -1000; this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    scene.add(this.sun, this.sun.target);
    this.sunDir = new THREE.Vector3();
    this.lightRight = new THREE.Vector3(); this.lightUp = new THREE.Vector3();
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envRT = null;
    this.fog = new THREE.FogExp2(0xffffff, 0.004);
    scene.fog = this.fog;
  }
  apply(name, post) {
    const p = TIME_PRESETS[name] || TIME_PRESETS.golden;
    this.preset = p; this.presetName = TIME_PRESETS[name] ? name : 'golden';
    const el = THREE.MathUtils.degToRad(p.sunElev), az = THREE.MathUtils.degToRad(p.sunAzim);
    this.sunDir.set(Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)).normalize();
    const u = this.uniforms;
    u.uSkySun.value.copy(this.sunDir); u.uSunColor.value.copy(p.sunColor);
    u.uZenith.value.copy(p.zenith); u.uHorizon.value.copy(p.horizon); u.uHorizon2.value.copy(p.horizon2); u.uGround.value.copy(p.ground);
    u.uCloudLit.value.copy(p.cloudLit); u.uCloudShade.value.copy(p.cloudShade); u.uCover.value = p.cover; u.uSkyNight.value = p.night;
    this.sun.color.copy(p.sunColor); this.sun.intensity = p.sunIntensity;
    this.fog.color.copy(p.fog); this.fog.density = p.fogDensity;
    G.uSunDir.value.copy(this.sunDir); G.uFogSun.value.copy(p.fogSun); G.uFogFalloff.value = p.fogFalloff;
    G.uNight.value = p.night; G.uLitFrac.value = p.litFrac;
    this.updateLightBasis();
    this.renderer.toneMappingExposure = p.exposure;
    if (post) {
      const f = post.finalMat.uniforms;
      f.toneMappingExposure.value = p.exposure; f.uToneMode.value = p.tone; f.uSat.value = p.sat; f.uContrast.value = p.contrast;
      f.uShadowTint.value.fromArray(p.shadowTint); f.uHighTint.value.fromArray(p.highTint);
      post.bloom.threshold = p.night ? 0.9 : 1.6; post.bloom.strength = p.night ? 0.55 : 0.32;
    }
    const h = p.hdri && this.photo?.hdri[p.hdri];
    if (h) this.useHDRI(h, p, post);
    else { this.mesh.visible = true; this.scene.background = null; this.bakeEnvironment(); this.scene.environmentIntensity = p.env; }
  }
  updateLightBasis() {
    this.lightRight.crossVectors(new THREE.Vector3(0, 1, 0), this.sunDir).normalize();
    this.lightUp.crossVectors(this.sunDir, this.lightRight).normalize();
  }
  // Photographic sky: background, image-based light, sun direction/colour and haze all come from the HDRI.
  useHDRI(h, p, post) {
    this.mesh.visible = false;
    this.scene.background = h.tex; this.scene.backgroundIntensity = p.bgIntensity;
    this.scene.environment = h.env.texture; this.scene.environmentIntensity = p.hdriEnv;
    this.sunDir.copy(h.sunDir); G.uSunDir.value.copy(h.sunDir); this.uniforms.uSkySun.value.copy(h.sunDir);
    const c = h.sunColor.clone(), mx = Math.max(c.r, c.g, c.b, 1e-4); c.multiplyScalar(1 / mx).lerp(p.sunColor, 0.35);
    this.sun.color.copy(c); this.sun.intensity = p.hdriSun;
    this.fog.color.copy(h.horizon).multiplyScalar(p.bgIntensity * 0.85); this.fog.density = p.hdriFog;
    const ts = h.towardSun.clone(), cap = Math.max(h.horizon.r, h.horizon.g, h.horizon.b) * 2.5, tm = Math.max(ts.r, ts.g, ts.b);
    if (tm > cap) ts.multiplyScalar(cap / tm);
    G.uFogSun.value.copy(ts);
    this.updateLightBasis();
    this.renderer.toneMappingExposure = p.hdriExposure;
    if (post) { const f = post.finalMat.uniforms; f.toneMappingExposure.value = p.hdriExposure; f.uContrast.value = p.hdriContrast; f.uSat.value = p.hdriSat; }
  }
  bakeEnvironment() {
    const envScene = new THREE.Scene();
    const mesh = new THREE.Mesh(this.mesh.geometry, this.material);
    envScene.add(mesh);
    this.uniforms.uEnvBake.value = 1;
    const rt = this.pmrem.fromScene(envScene, 0, 0.1, 1000);
    this.uniforms.uEnvBake.value = 0;
    if (this.envRT) this.envRT.dispose();
    this.envRT = rt;
    this.scene.environment = rt.texture;
  }
  configureShadows(q) {
    const s = this.sun;
    s.castShadow = q.shadow > 0;
    if (!s.castShadow) return;
    if (s.shadow.mapSize.x !== q.shadow) { s.shadow.mapSize.set(q.shadow, q.shadow); s.shadow.map?.dispose(); s.shadow.map = null; }
    const R = q.shadowRange, c = s.shadow.camera;
    c.left = -R; c.right = R; c.top = R; c.bottom = -R; c.near = 1; c.far = 420; c.updateProjectionMatrix();
    s.shadow.bias = -0.00025; s.shadow.normalBias = 0.035; s.shadow.radius = 2;
    this.shadowRange = R; this.shadowTexel = 2 * R / q.shadow;
  }
  // Keeps the shadow frustum centred ahead of the player, snapped to shadow texels to stop shimmering.
  update(camera, forward) {
    this.mesh.position.copy(camera.position);
    this.uniforms.uSkyTime.value = G.uTime.value;
    const focus = camera.position.clone();
    if (this.shadowRange) focus.addScaledVector(forward, this.shadowRange * 0.45);
    focus.y = 0;
    const t = this.shadowTexel || 1;
    const x = Math.round(focus.dot(this.lightRight) / t) * t;
    const y = Math.round(focus.dot(this.lightUp) / t) * t;
    const z = focus.dot(this.sunDir);
    const target = this.sun.target.position;
    target.copy(this.lightRight).multiplyScalar(x).addScaledVector(this.lightUp, y).addScaledVector(this.sunDir, z);
    this.sun.position.copy(target).addScaledVector(this.sunDir, 200);
    this.sun.target.updateMatrixWorld();
  }
}

// The world clock, in minutes since midnight. One real second is one game minute; the small hours
// (10 pm to 5 am) go twice as fast, so a full day is about 20 minutes and night about 6 of them.
// Dawn 5:30 and dusk 4:30 are golden hour, 8:30 to 4:30 is day, 8 pm to 5:30 is night.
const CLOCK_PERIODS = [[330, 'golden'], [510, 'day'], [990, 'golden'], [1200, 'night']];
const CLOCK_FIXED = { golden: 1080, day: 750, overcast: 780, night: 1380 }; // the time shown when a sky is picked by hand
class WorldClock {
  constructor(min = 1060) { this.min = min; this.day = 0; this.live = true; this.snap = false; }
  tick(dt) { const h = this.min / 60; this.min += dt * (h >= 22 || h < 5 ? 2 : 1); if (this.min >= 1440) { this.min -= 1440; this.day++; } }
  get hour() { return this.min / 60; }
  preset(min = this.min) { let p = 'night'; for (const [m, n] of CLOCK_PERIODS) if (min >= m) p = n; return p; }
  next() { for (const [m, n] of CLOCK_PERIODS) if (m > this.min) return { in: m - this.min, name: n }; return { in: 1440 - this.min + 330, name: 'golden' }; }
  between(a, b) { const h = this.hour; return a <= b ? h >= a && h < b : h >= a || h < b; }
  label(min = this.min) { const m = Math.floor(min), h = Math.floor(m / 60) % 24, mm = m % 60; return `${(h % 12) || 12}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; }
  set(min) { this.min = ((min % 1440) + 1440) % 1440; this.snap = true; }
  advance(mins) { const t = this.min + mins; this.day += Math.floor(t / 1440); this.set(t); }
  // Jump forward to the next time it's `min` o'clock (a night in the cells: next morning).
  until(min) { this.advance(((min - this.min) % 1440 + 1440) % 1440 || 1440); }
}
