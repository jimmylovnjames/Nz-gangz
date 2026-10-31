// Material library. Geometry uses metre-based UVs; `scale` is metres per texture tile.
const MAT_DEFS = {
  asphalt: { tex: 'asphalt', scale: 4, wet: 1 },
  chipseal: { tex: 'chipseal', scale: 3, wet: 1 },
  concrete: { tex: 'concrete', scale: 3, wet: 0.8 },
  kerb: { alias: 'concrete', scale: 1.2 },
  pavers: { tex: 'pavers', scale: 2.4, wet: 0.9 },
  brick: { tex: 'brick', scale: 2.44, cast: 1 },
  plaster: { tex: 'plaster', scale: 3, cast: 1 },
  weatherboard: { tex: 'weatherboard', scale: 2.4, cast: 1 },
  corrugated: { tex: 'corrugated', scale: 1.52, cast: 1, side: 2 },
  corrugatedRust: { tex: 'corrugatedRust', scale: 1.52, cast: 1, side: 2 },
  tiltslab: { tex: 'tiltslab', scale: 4, cast: 1 },
  grass: { tex: 'grass', scale: 2.5, wet: 0.35 },
  gravel: { tex: 'gravel', scale: 3, wet: 0.4 },
  wood: { tex: 'wood', scale: 1.2, cast: 1, side: 2 },
  roller: { tex: 'roller', scale: 3, cast: 1 },
  dirt: { tex: 'dirt', scale: 3, wet: 0.7 },
  stone: { tex: 'stone', scale: 1.5, cast: 1 },
  bark: { tex: 'bark', scale: 2, cast: 1 },
  paint: { tex: 'paint', scale: 2, alphaTest: 0.5, offset: 1, wet: 0.7 },
  plazaPavers: { tex: 'pavers', scale: 2.4, offset: 1, wet: 0.9 },
  channel: { alias: 'path', scale: 1.2 },
  path: { tex: 'concrete', scale: 3, offset: 1, wet: 0.8 },
  patch: { tex: 'asphalt', scale: 4, offset: 1, wet: 1 },
  yard: { tex: 'gravel', scale: 3, offset: 1, wet: 0.5 },
  glass: { glass: 1 },
  // Untextured painted and metal surfaces share two materials; colour comes from vertex tints.
  trim: { color: 0xffffff, rough: 0.62, cast: 1 },
  metal: { color: 0xffffff, metal: 0.85, rough: 0.4, cast: 1 },
  white: { alias: 'trim', tint: 0xffffff },
  timber: { alias: 'trim', tint: 0x6b5843 },
  rubber: { alias: 'trim', tint: 0x1a1a1a },
  alu: { alias: 'metal', tint: 0xc2c7ca },
  steel: { alias: 'metal', tint: 0xa3a9ad },
  darkMetal: { alias: 'metal', tint: 0x3a3e41 },
  lamp: { color: 0x1d1d1d, emissive: 0xffd2a0, day: 0.08, night: 9 },
  neon: { color: 0x111111, emissive: 0xffffff, day: 0.6, night: 5 },
};

const WET_PATCH_PARS = `
varying vec3 vWetPos;
${fragUniforms('uWet', 'uRain', 'uTime')}
float wHash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float wNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wHash(i), wHash(i + vec2(1, 0)), f.x), mix(wHash(i + vec2(0, 1)), wHash(i + vec2(1, 1)), f.x), f.y); }
vec2 ripple(vec2 p, float t){
  vec2 cell = floor(p), f = fract(p) - 0.5, g = vec2(0.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = cell + vec2(i, j); vec2 o = vec2(wHash(c), wHash(c + 7.7)) - 0.5;
    float phase = fract(t * (0.9 + 0.4 * wHash(c + 3.1)) + wHash(c + 1.3));
    vec2 d = f - vec2(i, j) - o * 0.8; float dist = length(d);
    float ring = sin((dist - phase * 0.55) * 60.0) * (1.0 - phase) * smoothstep(0.02, 0.0, abs(dist - phase * 0.55) - 0.03);
    g += d / max(dist, 1e-3) * ring;
  }
  return g;
}`;
const WET_PATCH_BODY = `
{
  float porosity = WET_POROSITY;
  float hgt = texture2D(roughnessMap, vRoughnessMapUv).a;
  float n = wNoise(vWetPos.xz * 0.16) * 0.6 + wNoise(vWetPos.xz * 0.5 + 9.0) * 0.3 + wNoise(vWetPos.xz * 2.1) * 0.1;
  float puddle = smoothstep(0.6, 0.66, n + (0.45 - hgt) * 0.18 + (uWet - 0.75) * 0.4) * step(0.25, uWet) * porosity;
  float wet = uWet * porosity;
  diffuseColor.rgb *= mix(1.0, 0.58, wet) * mix(1.0, 0.7, puddle);
  roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.32 + 0.06, wet);
  roughnessFactor = mix(roughnessFactor, 0.035, puddle);
  vec3 up = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  vec3 flatN = up;
  if (uRain > 0.01) {
    vec2 g = ripple(vWetPos.xz * 2.6, uTime) + ripple(vWetPos.xz * 2.6 + 0.5, uTime * 1.13 + 0.4);
    vec3 rw = normalize(vec3(-g.x * 0.25 * uRain, 1.0, -g.y * 0.25 * uRain));
    flatN = normalize((viewMatrix * vec4(rw, 0.0)).xyz);
  }
  normal = normalize(mix(normal, flatN, puddle * 0.92));
}`;

const GLASS_PARS = `
attribute vec4 aWin;
varying vec4 vWin; varying vec3 vGlassPos; varying vec3 vGlassN;`;
const GLASS_FRAG_PARS = `
varying vec4 vWin; varying vec3 vGlassPos; varying vec3 vGlassN;
${fragUniforms('uNight', 'uLitFrac')}
float gh(float n){ return fract(sin(n * 91.3458) * 47453.5453); }
vec3 roomColour(vec2 puv){
  vec3 N = normalize(vGlassN), T = normalize(cross(vec3(0.0, 1.0, 0.0), N)), B = vec3(0.0, 1.0, 0.0);
  vec3 rd = normalize(vGlassPos - cameraPosition);
  vec3 d = vec3(dot(rd, T), dot(rd, B), max(-dot(rd, N), 0.02));
  float seed = vWin.x, W = vWin.y, H = vWin.z, kind = vWin.w;
  bool shop = kind > 1.5;
  float D = shop ? 6.0 + gh(seed * 3.1) * 4.0 : 3.0 + gh(seed * 3.1) * 3.0;
  vec3 p = vec3(puv.x * W, puv.y * H, 0.0);
  float x0 = -0.7, x1 = W + 0.7, y0 = shop ? -0.4 : -0.95, y1 = H + (shop ? 0.6 : 0.35);
  float tx = d.x > 0.0 ? (x1 - p.x) / d.x : (x0 - p.x) / min(d.x, -1e-4);
  float ty = d.y > 0.0 ? (y1 - p.y) / d.y : (y0 - p.y) / min(d.y, -1e-4);
  float tz = (D - p.z) / d.z;
  float t = min(min(tx, ty), tz);
  vec3 hit = p + d * t;
  float depthFade = clamp(hit.z / D, 0.0, 1.0);
  vec3 wallC = mix(vec3(0.52, 0.47, 0.38), vec3(0.34, 0.38, 0.4), gh(seed * 7.7)) * (0.8 + 0.4 * gh(seed * 1.9));
  vec3 col;
  if (t == tz) {
    col = wallC;
    if (shop) {
      float shelf = smoothstep(0.42, 0.5, fract(hit.y * 1.6)) * step(0.2, hit.y) * step(hit.y, H);
      float cellId = floor(hit.x * 1.3) + floor(hit.y * 1.6) * 7.0;
      vec3 goods = mix(vec3(0.55, 0.5, 0.42), vec3(gh(cellId + seed), gh(cellId * 1.7 + seed), gh(cellId * 2.3 + 3.0)), 0.35);
      col = mix(vec3(0.82, 0.81, 0.78), goods, shelf * 0.8);
    } else {
      float pic = step(abs(hit.x - W * (0.3 + 0.4 * gh(seed * 5.0))), 0.35) * step(abs(hit.y - H * 0.55), 0.25) * step(0.5, gh(seed * 9.0));
      float door = step(abs(hit.x - W * gh(seed * 8.3)), 0.45) * step(hit.y, H * 0.9) * step(0.6, gh(seed * 4.4));
      col = mix(col, vec3(0.18, 0.13, 0.09), max(pic, door * 0.8));
    }
  } else if (t == ty) {
    col = d.y > 0.0 ? vec3(0.78, 0.77, 0.74) : (shop ? vec3(0.62, 0.62, 0.6) : mix(vec3(0.26, 0.17, 0.1), vec3(0.32, 0.31, 0.34), gh(seed * 2.3)));
  } else {
    col = wallC * 0.78;
  }
  float furn = step(hit.y, 0.4) * step(0.35, hit.z / D) * step(hit.z / D, 0.8) * step(0.4, gh(seed * 6.6)) * (shop ? 0.0 : 1.0);
  col *= 1.0 - furn * 0.65;
  float lit = shop ? 1.0 : step(1.0 - uLitFrac, gh(seed * 11.3));
  vec3 lamp = shop ? vec3(1.0, 0.96, 0.88) * mix(0.75, 1.7, uNight) : vec3(1.0, 0.76, 0.5) * 1.45;
  vec3 ambient = vec3(0.13, 0.145, 0.17) * (1.0 - uNight * 0.9);
  vec3 light = mix(ambient * mix(1.0, 0.3, depthFade), lamp * mix(1.2, 0.75, depthFade), lit);
  if (t == ty && d.y > 0.0) light *= mix(1.0, 1.35, lit);
  col *= light;
  float cur = gh(seed * 4.7);
  if (!shop && cur > 0.45) {
    float xx = puv.x * W, cw = W * (0.12 + 0.3 * gh(seed * 6.1));
    if (xx < cw || xx > W - cw * gh(seed * 8.0)) {
      vec3 cc = mix(vec3(0.62, 0.56, 0.45), vec3(0.3, 0.32, 0.42), gh(seed * 12.0));
      col = cc * (0.75 + 0.25 * sin(xx * 30.0)) * mix(ambient * 1.6, lamp * 0.8, lit);
    }
  } else if (!shop && cur < 0.22) {
    if (puv.y > 1.0 - gh(seed * 13.0) * 0.75) col = vec3(0.72, 0.7, 0.64) * (0.7 + 0.3 * step(0.5, fract(puv.y * H * 14.0))) * mix(ambient * 1.8, lamp * 0.7, lit);
  }
  return col;
}`;

class MaterialLib {
  constructor(forge, quality) {
    this.forge = forge; this.q = quality; this.cache = {};
  }
  scale(key) { return MAT_DEFS[key]?.scale || 1; }
  get(key) {
    if (this.cache[key]) return this.cache[key];
    if (MAT_DEFS[key]?.alias) return (this.cache[key] = this.get(MAT_DEFS[key].alias));
    const d = MAT_DEFS[key];
    if (!d) throw new Error('unknown material ' + key);
    let m;
    if (d.glass) m = this.makeGlass();
    else if (d.tex) {
      const t = this.forge.sets[d.tex] || this.forge.make(d.tex);
      m = new THREE.MeshStandardMaterial({
        map: t.map, normalMap: t.normalMap, roughnessMap: t.orm, metalnessMap: t.orm, aoMap: t.orm,
        roughness: 1, metalness: 1, vertexColors: true,
      });
      if (d.alphaTest) { m.alphaTest = d.alphaTest; m.alphaToCoverage = this.q.msaa > 0; }
      if (d.offset) { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; }
      if (d.wet) this.addWetness(m, d.wet, key);
    } else {
      m = new THREE.MeshStandardMaterial({ color: d.color, roughness: d.rough ?? 0.7, metalness: d.metal ?? 0, vertexColors: true });
      if (d.emissive) this.addNightEmissive(m, d, key);
    }
    if (d.side === 2) m.side = THREE.DoubleSide;
    m.userData.cast = !!d.cast;
    m.name = key;
    return (this.cache[key] = m);
  }
  addWetness(m, porosity, key) {
    patchMaterial(m, 'wet-' + key, s => {
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWetPos;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWetPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\n' + WET_PATCH_PARS)
        .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + WET_PATCH_BODY.replace('WET_POROSITY', porosity.toFixed(3)));
    });
  }
  addNightEmissive(m, d, key) {
    m.emissive = new THREE.Color(d.emissive);
    patchMaterial(m, 'em-' + key, s => {
      s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\n' + fragUniforms('uNight'))
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance *= mix(${d.day.toFixed(3)}, ${d.night.toFixed(3)}, uNight);`);
    });
  }
  makeGlass() {
    const m = new THREE.MeshStandardMaterial({ color: 0x050607, roughness: 0.05, metalness: 0.0, envMapIntensity: 1.1 });
    patchMaterial(m, 'glass-interior', s => {
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\n' + GLASS_PARS)
        .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
          vWin = aWin; vGlassPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vGlassN = normalize(mat3(modelMatrix) * objectNormal);`);
      s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\n' + GLASS_FRAG_PARS)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += roomColour(vGlassUv);')
        .replace('void main() {', 'varying vec2 vGlassUv;\nvoid main() {');
      s.vertexShader = s.vertexShader.replace('void main() {', 'varying vec2 vGlassUv;\nvoid main() {\nvGlassUv = uv;');
    });
    m.userData.cast = false;
    return m;
  }
}
