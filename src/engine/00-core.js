// Run 12 graphics engine. Every file in src/engine is concatenated (in name order) into one module.
// Files only declare things; 99-boot.js is the single entry point.
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const AU_SKIP = !!window.__auOfflineWebGL;
if (!AU_SKIP) window.__auThreeBooting = true;

const $ = id => document.getElementById(id);
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp, smoothstep = THREE.MathUtils.smoothstep;
const TAU = Math.PI * 2;
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const nextTick = () => new Promise(r => setTimeout(r, 0));
function setLoad(fraction, message) {
  const bar = document.querySelector('#loadBar>i'), label = $('loadState');
  if (bar) bar.style.width = Math.round(fraction * 100) + '%';
  if (label && message) label.textContent = message;
}

// ---------------------------------------------------------------------------
// Shared uniforms. Injected into every material through the global onBeforeCompile hook,
// so weather/time-of-day changes never need shader recompiles.
const G = {
  uTime: { value: 0 },
  uWet: { value: 0.7 },          // surface wetness 0..1
  uRain: { value: 0.25 },        // active rainfall 0..1 (ripples)
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uFogSun: { value: new THREE.Color(1, 0.8, 0.6) },
  uFogFalloff: { value: 0.035 },
  uNight: { value: 0 },          // 0 day .. 1 night (window lights, emissive props)
  uLitFrac: { value: 0.12 },     // fraction of apartment windows with lights on
  uWind: { value: 0.4 },
};
function injectGlobals(shader) {
  for (const k in G) shader.uniforms[k] = G[k];
}
THREE.Material.prototype.onBeforeCompile = injectGlobals;
// Materials that need their own shader edits go through this helper so the globals still arrive.
function patchMaterial(material, key, fn) {
  material.onBeforeCompile = shader => { injectGlobals(shader); fn(shader); };
  material.customProgramCacheKey = () => key;
  return material;
}
// Fragment-stage declarations for the shared uniforms. The fog chunk already declares the sun/fog
// ones when fog is enabled, and GLSL rejects duplicate uniform declarations.
function fragUniforms(...names) {
  return names.map(n => n === 'uSunDir' || n === 'uFogSun'
    ? `#ifndef USE_FOG\nuniform vec3 ${n};\n#endif`
    : n === 'uFogFalloff' ? `#ifndef USE_FOG\nuniform float ${n};\n#endif` : `uniform float ${n};`).join('\n');
}

// Height fog with sun in-scattering replaces three's distance fog for every material.
THREE.ShaderChunk.fog_pars_vertex = `#ifdef USE_FOG
varying vec3 vFogRay;
#endif`;
THREE.ShaderChunk.fog_vertex = `#ifdef USE_FOG
vFogRay = (vec4(mvPosition.xyz, 0.0) * viewMatrix).xyz;
#endif`;
THREE.ShaderChunk.fog_pars_fragment = `#ifdef USE_FOG
uniform vec3 fogColor;
uniform float fogDensity;
uniform vec3 uSunDir;
uniform vec3 uFogSun;
uniform float uFogFalloff;
varying vec3 vFogRay;
#endif`;
THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG
{
  float fogDist = length(vFogRay);
  vec3 fogDir = vFogRay / max(fogDist, 1e-4);
  float k = fogDir.y * uFogFalloff;
  float column = abs(k) > 1e-4 ? (1.0 - exp(-fogDist * k)) / k : fogDist;
  float fogAmount = 1.0 - exp(-fogDensity * exp(-cameraPosition.y * uFogFalloff) * max(column, 0.0));
  float sunAmount = pow(max(dot(fogDir, uSunDir), 0.0), 6.0);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, mix(fogColor, uFogSun, sunAmount), clamp(fogAmount, 0.0, 1.0));
}
#endif`;

// ---------------------------------------------------------------------------
// Quality tiers. HIGH is tuned for flagship phones (Snapdragon 8 Gen 2/3, Apple A16+).
const GFX_KEY = 'aotearoa-underworld-gfx-v1';
const QUALITY = {
  low:    { dprMax: 1.0,  dprStart: 0.9,  shadow: 0,    msaa: 0, ao: 0, bloom: 0, post: 0, tex: 512,  aniso: 2,  rain: 500,  shadowRange: 0 },
  medium: { dprMax: 1.25, dprStart: 1.0,  shadow: 1024, msaa: 0, ao: 0, bloom: 1, post: 1, tex: 1024, aniso: 4,  rain: 900,  shadowRange: 45 },
  high:   { dprMax: 1.6,  dprStart: 1.3,  shadow: 2048, msaa: 4, ao: 1, bloom: 1, post: 1, tex: 1024, aniso: 8,  rain: 1600, shadowRange: 60 },
  ultra:  { dprMax: 2.0,  dprStart: 1.75, shadow: 4096, msaa: 4, ao: 1, bloom: 1, post: 1, tex: 1024, aniso: 16, rain: 2600, shadowRange: 80 },
};
function loadSettings() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(GFX_KEY) || '{}') || {}; } catch (_) { s = {}; }
  const params = new URLSearchParams(location.search);
  if (QUALITY[params.get('gfx')]) s.tier = params.get('gfx');
  if (params.get('time')) s.time = params.get('time');
  if (params.has('rain')) s.rain = +params.get('rain');
  return s;
}
function saveSettings(s) { try { localStorage.setItem(GFX_KEY, JSON.stringify(s)); } catch (_) { } }
function detectTier(renderer) {
  const gl = renderer.getContext();
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  const mobile = matchMedia('(pointer:coarse)').matches;
  let tier;
  if (/swiftshader|llvmpipe|software/i.test(gpu)) tier = 'low';
  else if (mobile) {
    if (/Adreno \(TM\) (7[3-9]\d|8\d\d)|Immortalis|Mali-G7[1-9]\d|Apple GPU|Xclipse 9/i.test(gpu)) tier = 'high';
    else if (/Adreno \(TM\) (6[4-9]\d|7[0-2]\d)|Mali-G(6[89]|7\d)/i.test(gpu)) tier = 'medium';
    else tier = 'low';
  } else tier = /RTX|Radeon RX|Arc A|Apple M\d (Pro|Max|Ultra)/i.test(gpu) ? 'ultra' : 'high';
  return { tier, gpu, mobile };
}

// ---------------------------------------------------------------------------
// Post-processing: HDR scene (MSAA) -> SSAO (half res, bilateral blur) -> bloom -> tone map + grade.
const FS_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const AO_FRAG = `
precision highp float;
uniform sampler2D tDepth; uniform mat4 uProj; uniform mat4 uInvProj;
uniform vec2 uTexel; uniform float uRadius; uniform float uIntensity; uniform float uAspect;
varying vec2 vUv;
vec3 viewPos(vec2 uv){ float d = texture2D(tDepth, uv).x; vec4 v = uInvProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return v.xyz / v.w; }
float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void main(){
  float d = texture2D(tDepth, vUv).x;
  if (d >= 0.99999) { gl_FragColor = vec4(1.0, 1e4, 0.0, 1.0); return; }
  vec3 p = viewPos(vUv);
  vec3 pl = viewPos(vUv - vec2(uTexel.x, 0.0)), pr = viewPos(vUv + vec2(uTexel.x, 0.0));
  vec3 pd = viewPos(vUv - vec2(0.0, uTexel.y)), pu = viewPos(vUv + vec2(0.0, uTexel.y));
  vec3 dx = abs(pr.z - p.z) < abs(p.z - pl.z) ? pr - p : p - pl;
  vec3 dy = abs(pu.z - p.z) < abs(p.z - pd.z) ? pu - p : p - pd;
  vec3 n = normalize(cross(dx, dy));
  float rs = min(uRadius * uProj[1][1] * 0.5 / -p.z, 0.12);
  float ang = ign(gl_FragCoord.xy) * 6.2831853;
  float occ = 0.0;
  const int N = 12;
  for (int i = 0; i < N; i++) {
    float fi = (float(i) + 0.5) / float(N);
    float a = ang + float(i) * 2.39996;
    vec2 off = vec2(cos(a) / uAspect, sin(a)) * rs * sqrt(fi);
    vec3 v = viewPos(vUv + off) - p;
    float vv = dot(v, v);
    float falloff = max(0.0, 1.0 - vv / (uRadius * uRadius * 4.0));
    occ += max(0.0, dot(v, n) - 0.015 * -p.z) / (vv + 0.02) * falloff;
  }
  float ao = clamp(1.0 - occ * uIntensity / float(N), 0.0, 1.0);
  gl_FragColor = vec4(ao * ao, -p.z, 0.0, 1.0);
}`;
const BLUR_FRAG = `
precision highp float;
uniform sampler2D tAO; uniform vec2 uDir; varying vec2 vUv;
void main(){
  vec2 c = texture2D(tAO, vUv).rg; float sum = c.r, w = 1.0;
  for (int i = -4; i <= 4; i++) {
    if (i == 0) continue;
    vec2 s = texture2D(tAO, vUv + uDir * float(i)).rg;
    float wt = exp(-abs(s.g - c.g) / (c.g * 0.04 + 0.05)) * (1.0 - abs(float(i)) / 5.0);
    sum += s.r * wt; w += wt;
  }
  gl_FragColor = vec4(sum / w, c.g, 0.0, 1.0);
}`;
const COMP_FRAG = `
uniform sampler2D tColor; uniform sampler2D tAO; uniform float uAO; varying vec2 vUv;
void main(){ vec4 c = texture2D(tColor, vUv); float ao = texture2D(tAO, vUv).r; c.rgb *= mix(1.0, ao, uAO); gl_FragColor = c; }`;
const FINAL_FRAG = `
#include <common>
#include <tonemapping_pars_fragment>
uniform sampler2D tHDR; uniform vec2 uTexel; uniform float uTime; uniform float uFxaa;
uniform float uSat; uniform float uContrast; uniform float uVignette; uniform float uGrain;
uniform vec3 uShadowTint; uniform vec3 uHighTint; uniform float uToneMode;
varying vec2 vUv;
float lumaHDR(vec3 c){ return dot(c / (1.0 + c), vec3(0.299, 0.587, 0.114)); }
vec3 fetch(vec2 uv){ return texture2D(tHDR, uv).rgb; }
vec3 fxaa(vec2 uv){
  vec3 nw = fetch(uv + vec2(-1.0, -1.0) * uTexel), ne = fetch(uv + vec2(1.0, -1.0) * uTexel);
  vec3 sw = fetch(uv + vec2(-1.0, 1.0) * uTexel), se = fetch(uv + vec2(1.0, 1.0) * uTexel), m = fetch(uv);
  float lNW = lumaHDR(nw), lNE = lumaHDR(ne), lSW = lumaHDR(sw), lSE = lumaHDR(se), lM = lumaHDR(m);
  float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE))), lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
  vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), (lNW + lSW) - (lNE + lSE));
  float reduce = max((lNW + lNE + lSW + lSE) * 0.03125, 1.0 / 128.0);
  dir = clamp(dir / (min(abs(dir.x), abs(dir.y)) + reduce), -8.0, 8.0) * uTexel;
  vec3 a = 0.5 * (fetch(uv + dir * (1.0 / 3.0 - 0.5)) + fetch(uv + dir * (2.0 / 3.0 - 0.5)));
  vec3 b = a * 0.5 + 0.25 * (fetch(uv - dir * 0.5) + fetch(uv + dir * 0.5));
  float lB = lumaHDR(b);
  return (lB < lMin || lB > lMax) ? a : b;
}
vec3 srgb(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main(){
  vec3 hdr = uFxaa > 0.5 ? fxaa(vUv) : fetch(vUv);
  vec3 c = uToneMode > 0.5 ? AgXToneMapping(hdr) : ACESFilmicToneMapping(hdr);
  c = srgb(clamp(c, 0.0, 1.0));
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSat);
  c = (c - 0.5) * uContrast + 0.5;
  c += uShadowTint * (1.0 - smoothstep(0.0, 0.5, l)) + uHighTint * smoothstep(0.45, 1.0, l);
  vec2 q = vUv - 0.5;
  c *= mix(1.0, smoothstep(0.85, 0.2, length(q * vec2(1.0, 0.8))), uVignette);
  c += (hash12(gl_FragCoord.xy + fract(uTime * 7.13) * 431.0) - 0.5) * uGrain;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

class PostPipeline {
  constructor(renderer) {
    this.renderer = renderer;
    this.quad = new FullScreenQuad(null);
    const shader = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: FS_VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
    this.aoMat = shader(AO_FRAG, { tDepth: { value: null }, uProj: { value: new THREE.Matrix4() }, uInvProj: { value: new THREE.Matrix4() }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: 0.9 }, uIntensity: { value: 1.4 }, uAspect: { value: 1 } });
    this.blurMat = shader(BLUR_FRAG, { tAO: { value: null }, uDir: { value: new THREE.Vector2() } });
    this.compMat = shader(COMP_FRAG, { tColor: { value: null }, tAO: { value: null }, uAO: { value: 0.85 } });
    this.finalMat = shader(FINAL_FRAG, {
      tHDR: { value: null }, uTexel: { value: new THREE.Vector2() }, uTime: G.uTime, uFxaa: { value: 0 },
      toneMappingExposure: { value: 1 }, uToneMode: { value: 1 },
      uSat: { value: 1.08 }, uContrast: { value: 1.06 }, uVignette: { value: 0.35 }, uGrain: { value: 0.025 },
      uShadowTint: { value: new THREE.Vector3(-0.01, 0.0, 0.012) }, uHighTint: { value: new THREE.Vector3(0.015, 0.006, -0.012) },
    });
    this.finalMat.toneMapped = false; // tone mapping happens in FINAL_FRAG; keep three from injecting its own copy
    this.white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); this.white.needsUpdate = true;
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.55, 1.6);
    this.width = 1; this.height = 1; this.q = null;
  }
  configure(q) {
    this.q = q;
    this.disposeTargets();
    if (!q.post) return;
    const w = this.width, h = this.height;
    this.rtScene = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: q.msaa, depthTexture: new THREE.DepthTexture(w, h) });
    this.rtHDR = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: false });
    if (q.ao) {
      const hw = Math.max(1, w >> 1), hh = Math.max(1, h >> 1);
      const opts = { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
      this.rtAO = new THREE.WebGLRenderTarget(hw, hh, opts);
      this.rtAO2 = new THREE.WebGLRenderTarget(hw, hh, opts);
    }
    this.bloom.setSize(w, h);
  }
  disposeTargets() {
    for (const k of ['rtScene', 'rtHDR', 'rtAO', 'rtAO2']) { if (this[k]) { this[k].depthTexture?.dispose(); this[k].dispose(); this[k] = null; } }
  }
  setSize(w, h) {
    this.width = Math.max(1, w); this.height = Math.max(1, h);
    if (this.q) this.configure(this.q);
  }
  pass(material, target) { this.quad.material = material; this.renderer.setRenderTarget(target); this.quad.render(this.renderer); }
  render(scene, camera, dt) {
    const r = this.renderer, q = this.q;
    if (!q.post) { r.setRenderTarget(null); r.render(scene, camera); return; }
    r.setRenderTarget(this.rtScene); r.render(scene, camera);
    let aoTex = this.white;
    if (q.ao) {
      const u = this.aoMat.uniforms;
      u.tDepth.value = this.rtScene.depthTexture;
      u.uProj.value.copy(camera.projectionMatrix); u.uInvProj.value.copy(camera.projectionMatrixInverse);
      u.uTexel.value.set(1 / this.width, 1 / this.height); u.uAspect.value = camera.aspect;
      this.pass(this.aoMat, this.rtAO);
      const b = this.blurMat.uniforms;
      b.tAO.value = this.rtAO.texture; b.uDir.value.set(1 / this.rtAO.width, 0); this.pass(this.blurMat, this.rtAO2);
      b.tAO.value = this.rtAO2.texture; b.uDir.value.set(0, 1 / this.rtAO.height); this.pass(this.blurMat, this.rtAO);
      aoTex = this.rtAO.texture;
    }
    this.compMat.uniforms.tColor.value = this.rtScene.texture; this.compMat.uniforms.tAO.value = aoTex;
    this.pass(this.compMat, this.rtHDR);
    if (q.bloom) this.bloom.render(r, null, this.rtHDR, dt, false);
    const f = this.finalMat.uniforms;
    f.tHDR.value = this.rtHDR.texture; f.uTexel.value.set(1 / this.width, 1 / this.height); f.uFxaa.value = q.msaa ? 0 : 1;
    this.pass(this.finalMat, null);
  }
}
