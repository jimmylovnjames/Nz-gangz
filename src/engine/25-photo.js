// Photographic assets: CC0 scanned PBR textures and HDRI skies (Poly Haven), streamed in after the
// district is playable. Anything that fails to load leaves the GPU-generated texture or sky in place.
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

const ASSET_CDN = 'https://cdn.jsdelivr.net/gh/jimmylovnjames/Nz-gangz@ccr-e2a07ab1-xlsvi1/assets/';
// material key -> [Poly Haven asset, tile size in metres, rotate 90° (planks laid the other way)]
const PHOTO = {
  asphalt: ['asphalt_02', 3.0], patch: ['asphalt_02', 3.0], chipseal: ['tarred_gravel', 2.2],
  concrete: ['concrete_pavement', 1.8], kerb: ['concrete_floor_02', 2.0], path: ['concrete_floor_02', 2.0],
  pavers: ['herringbone_brick', 1.8], plazaPavers: ['herringbone_brick', 1.8],
  brick: ['brick_wall_02', 2.0], plaster: ['beige_wall_002', 3.0], weatherboard: ['distressed_painted_planks', 1.6, true],
  corrugated: ['corrugated_iron', 1.12], corrugatedRust: ['worn_corrugated_iron', 1.8],
  grass: ['leafy_grass', 2.0], gravel: ['gravel_floor', 2.25], yard: ['gravel_floor', 2.25],
  roller: ['painted_metal_shutter', 2.0], wood: ['weathered_brown_planks', 1.8, true], bark: ['bark_willow', 1.0],
};

function assetBases() {
  const p = new URLSearchParams(location.search).get('assets');
  if (p === 'off') return [];
  if (p === 'cdn' || !location.protocol.startsWith('http')) return [ASSET_CDN];
  return ['assets/', ASSET_CDN];
}
function loadWithFallback(loader, path, bases) {
  return new Promise((resolve, reject) => {
    const tryAt = i => {
      if (i >= bases.length) return reject(new Error('asset unavailable: ' + path));
      loader.load(bases[i] + path, resolve, undefined, () => tryAt(i + 1));
    };
    tryAt(0);
  });
}

class PhotoAssets {
  constructor(renderer, lib, quality) {
    this.renderer = renderer; this.lib = lib; this.q = quality; this.bases = assetBases();
    this.texLoader = new THREE.TextureLoader(); this.sets = {}; this.applied = new Set(); this.hdri = {};
    this.enabled = this.bases.length > 0 && quality.tex >= 1024;
  }
  // Loads every scanned set in parallel and applies each as soon as its three maps arrive.
  async loadTextures(onProgress) {
    if (!this.enabled) return 0;
    const assets = [...new Set(Object.values(PHOTO).map(p => p[0]))];
    let done = 0;
    await Promise.all(assets.map(async name => {
      try {
        const [map, normalMap, arm] = await Promise.all(['diff', 'nor', 'arm'].map(k => loadWithFallback(this.texLoader, `tex/${name}/${name}_${k}_1k.jpg`, this.bases)));
        map.colorSpace = THREE.SRGBColorSpace; normalMap.colorSpace = THREE.NoColorSpace; arm.colorSpace = THREE.NoColorSpace;
        this.sets[name] = { map, normalMap, arm };
        for (const [key, p] of Object.entries(PHOTO)) if (p[0] === name) this.applyTo(key);
      } catch (_) { /* keep the generated texture for this surface */ }
      onProgress?.(++done / assets.length);
    }));
    return Object.keys(this.sets).length;
  }
  applyTo(key) {
    const m = this.lib.cache[key], p = PHOTO[key], set = this.sets[p?.[0]];
    if (!m || !set || this.applied.has(m)) return;
    this.applied.add(m);
    const repeat = (MAT_DEFS[key]?.scale || 1) / p[1], aniso = Math.min(this.q.aniso, this.renderer.capabilities.getMaxAnisotropy());
    const prep = t => {
      const c = t.clone(); c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(repeat, repeat); c.anisotropy = aniso;
      if (p[2]) { c.center.set(0.5, 0.5); c.rotation = Math.PI / 2; }
      c.needsUpdate = true; return c;
    };
    m.map = prep(set.map); m.normalMap = prep(set.normalMap);
    m.roughnessMap = m.metalnessMap = m.aoMap = prep(set.arm);
    m.normalScale.set(1, 1); m.needsUpdate = true;
  }
  // HDRI sky: decoded once, rotated so its sun sits at the preset's azimuth, analysed for sun and horizon colour.
  async loadHDRI(file, azimuthDeg) {
    if (!this.enabled) return null;
    if (this.hdri[file]) return this.hdri[file];
    const loader = new RGBELoader().setDataType(THREE.HalfFloatType);
    const tex = await loadWithFallback(loader, 'hdri/' + file, this.bases);
    const { width: W, height: H, data } = tex.image, h2f = THREE.DataUtils.fromHalfFloat;
    // Brightest pixel = the sun (sampled on a grid, then refined).
    let best = -1, bx = 0, by = 0;
    for (let y = 0; y < H * 0.55; y += 2) for (let x = 0; x < W; x += 2) {
      const i = (y * W + x) * 4, l = h2f(data[i]) * 0.3 + h2f(data[i + 1]) * 0.59 + h2f(data[i + 2]) * 0.11;
      if (l > best) { best = l; bx = x; by = y; }
    }
    const sunPix = (by * W + bx) * 4, sunColor = new THREE.Color(h2f(data[sunPix]), h2f(data[sunPix + 1]), h2f(data[sunPix + 2]));
    // Rows run top to bottom (texture.flipY), so v = 1 - row/H. three's equirect: u = atan(z, x)/2π + 0.5.
    const u0 = (bx + 0.5) / W, theta = (1 - (by + 0.5) / H - 0.5) * Math.PI;
    const A = THREE.MathUtils.degToRad(azimuthDeg), phiT = Math.atan2(-Math.cos(A), Math.sin(A)), uT = phiT / TAU + 0.5;
    const shift = Math.round((u0 - uT) * W);
    if (shift) {
      const row = new Uint16Array(W * 4);
      for (let y = 0; y < H; y++) {
        const o = y * W * 4;
        for (let x = 0; x < W; x++) { const sx = ((x + shift) % W + W) % W; row.set(data.subarray(o + sx * 4, o + sx * 4 + 4), x * 4); }
        data.set(row, o);
      }
    }
    const phi = (uT - 0.5) * TAU;
    const sunDir = new THREE.Vector3(Math.cos(theta) * Math.cos(phi), Math.sin(theta), Math.cos(theta) * Math.sin(phi)).normalize();
    if (sunDir.y < 0.06) { sunDir.y = 0.06; sunDir.normalize(); }
    // Horizon colours: average just above the horizon, and the part facing the sun.
    const hz = new THREE.Color(0, 0, 0), toward = new THREE.Color(0, 0, 0); let n = 0, nt = 0;
    const yH = Math.floor(H * 0.47);
    for (let y = yH - 4; y < yH; y++) for (let x = 0; x < W; x += 4) {
      const i = (y * W + x) * 4, c = new THREE.Color(h2f(data[i]), h2f(data[i + 1]), h2f(data[i + 2]));
      const near = Math.abs(((x / W - uT + 1.5) % 1) - 0.5) < 0.08;
      if (near) { toward.add(c); nt++; } else { hz.add(c); n++; }
    }
    hz.multiplyScalar(1 / Math.max(1, n)); toward.multiplyScalar(1 / Math.max(1, nt));
    tex.mapping = THREE.EquirectangularReflectionMapping; tex.needsUpdate = true;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const env = pmrem.fromEquirectangular(tex); pmrem.dispose();
    return (this.hdri[file] = { tex, env, sunDir, sunColor, horizon: hz, towardSun: toward, sunLum: best });
  }
}
