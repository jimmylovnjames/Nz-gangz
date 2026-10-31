// GPU texture synthesis: tileable albedo / normal / ORM(+height) maps rendered once at load.
// Albedo targets are sRGB (hardware-encoded on write), so generators output linear colour.
const TEX_LIB = `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes; uniform float uSeed; uniform int uMode; uniform int uMat; uniform float uRelief;
float gAlpha;
vec3 L(vec3 c){ return pow(c, vec3(2.2)); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float pnoise(vec2 p, vec2 rep){
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(mod(i, rep) + uSeed), b = hash12(mod(i + vec2(1, 0), rep) + uSeed);
  float c = hash12(mod(i + vec2(0, 1), rep) + uSeed), d = hash12(mod(i + vec2(1, 1), rep) + uSeed);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 uv, float f, int oct){
  float s = 0.0, a = 0.5, n = 0.0;
  for (int i = 0; i < 8; i++) { if (i >= oct) break; s += a * pnoise(uv * f, vec2(f)); n += a; f *= 2.0; a *= 0.5; }
  return s / n;
}
// anisotropic periodic noise (fx, fy integer frequencies)
float anoise(vec2 uv, float fx, float fy){ return pnoise(uv * vec2(fx, fy), vec2(fx, fy)); }
vec3 voronoi(vec2 uv, float f){
  vec2 p = uv * f, i = floor(p), fr = fract(p);
  float d1 = 8.0; vec2 mr = vec2(0.0), mi = vec2(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(x, y), o = hash22(mod(i + g, f) + uSeed), r = g + o - fr; float d = dot(r, r);
    if (d < d1) { d1 = d; mr = r; mi = mod(i + g, f); }
  }
  float de = 8.0;
  for (int y = -2; y <= 2; y++) for (int x = -2; x <= 2; x++) {
    vec2 g = vec2(x, y), o = hash22(mod(i + g, f) + uSeed), r = g + o - fr;
    if (dot(mr - r, mr - r) > 1e-5) de = min(de, dot(0.5 * (mr + r), normalize(r - mr)));
  }
  return vec3(sqrt(d1), de, hash12(mi + uSeed * 1.7 + 3.1));
}
float lineMask(float x, float w){ float d = min(x, 1.0 - x); return 1.0 - smoothstep(0.0, w, d); }

void mAsphalt(vec2 uv, out vec3 al, out float h, out float r, out float ao, out float m, float coarse){
  vec3 v = voronoi(uv, coarse);
  float chip = smoothstep(0.62, 0.18, v.x);
  float big = fbm(uv, 3.0, 5), mid = fbm(uv, 20.0, 4), fine = fbm(uv, 160.0, 3);
  vec3 binder = L(vec3(0.15, 0.152, 0.158)) * (0.75 + 0.5 * mid);
  vec3 stone = L(mix(vec3(0.30, 0.30, 0.31), vec3(0.55, 0.53, 0.50), v.z)) * (0.85 + 0.3 * fine);
  al = mix(binder, stone, chip * (0.55 + 0.45 * big));
  al *= 0.8 + 0.45 * smoothstep(0.35, 0.75, big);
  vec2 wq = uv + 0.03 * vec2(fbm(uv, 6.0, 3), fbm(uv + 0.37, 6.0, 3));
  vec3 cr = voronoi(wq, 3.0);
  float crack = (1.0 - smoothstep(0.0, 0.006, cr.y)) * step(0.45, fbm(uv, 5.0, 3));
  float seal = (1.0 - smoothstep(0.004, 0.02, cr.y)) * step(0.55, cr.z) * step(0.4, fbm(uv + 0.2, 4.0, 2));
  al = mix(al, L(vec3(0.07)), max(crack * 0.9, seal * 0.85));
  float stain = smoothstep(0.62, 0.8, fbm(uv + 1.3, 8.0, 4));
  al *= 1.0 - stain * 0.35;
  h = chip * 0.55 + fine * 0.35 + mid * 0.1 - crack * 0.6;
  r = mix(0.93, 0.78, chip * 0.5) - seal * 0.35 - stain * 0.2;
  ao = mix(0.7, 1.0, clamp(h + 0.2, 0.0, 1.0));
  m = 0.0;
}
void mConcrete(vec2 uv, out vec3 al, out float h, out float r, out float ao, out float m){
  vec2 slab = floor(uv * 2.0);
  float joint = max(lineMask(fract(uv.x * 2.0), 0.006), lineMask(fract(uv.y * 2.0), 0.006));
  float broom = anoise(uv, 900.0, 24.0) * 0.6 + anoise(uv, 300.0, 12.0) * 0.4;
  float tone = hash12(slab + uSeed);
  float blot = fbm(uv, 6.0, 5), fine = fbm(uv, 128.0, 3);
  al = L(vec3(0.62, 0.61, 0.58)) * (0.86 + 0.18 * tone) * (0.85 + 0.3 * blot) * (0.94 + 0.12 * fine);
  float stain = smoothstep(0.6, 0.85, fbm(uv + 2.7, 5.0, 5));
  al *= 1.0 - 0.32 * stain;
  vec3 g = voronoi(uv, 34.0);
  float gum = (1.0 - smoothstep(0.035, 0.06, g.x)) * step(0.82, g.z);
  al = mix(al, L(vec3(0.16, 0.16, 0.15)), gum * 0.85);
  vec3 cr = voronoi(uv + 0.02 * fbm(uv, 9.0, 3), 2.0);
  float crack = (1.0 - smoothstep(0.0, 0.004, cr.y)) * step(0.7, cr.z);
  al *= 1.0 - joint * 0.45 - crack * 0.5;
  h = 0.6 + broom * 0.2 + fine * 0.15 - joint * 0.6 - crack * 0.4 + gum * 0.15;
  r = 0.88 - stain * 0.1 - gum * 0.3;
  ao = 1.0 - joint * 0.5;
  m = 0.0;
}
void mPavers(vec2 uv, out vec3 al, out float h, out float r, out float ao, out float m){
  vec2 p = uv * vec2(12.0, 24.0);
  float row = floor(p.y); p.x += mod(row, 2.0) * 0.5;
  vec2 id = vec2(mod(floor(p.x), 12.0), row), f = fract(p);
  vec2 e = min(f, 1.0 - f) * vec2(0.2, 0.1) * 10.0;
  float edge = smoothstep(0.0, 0.06, min(e.x, e.y));
  float t = hash12(id + uSeed);
  vec3 col = t < 0.45 ? vec3(0.50, 0.26, 0.20) : t < 0.8 ? vec3(0.42, 0.22, 0.18) : vec3(0.26, 0.24, 0.23);
  float fine = fbm(uv, 96.0, 3), wear = fbm(uv, 4.0, 4);
  al = L(col) * (0.85 + 0.3 * fine) * (0.9 + 0.2 * hash12(id + 7.0));
  al = mix(al, L(vec3(0.55, 0.52, 0.46)) * (0.8 + 0.3 * fine), 1.0 - edge);
  al *= 0.9 + 0.2 * wear;
  h = edge * (0.75 + 0.25 * fine);
  r = mix(0.95, 0.72 + 0.15 * wear, edge);
  ao = mix(0.55, 1.0, edge);
  m = 0.0;
}
void mBrick(vec2 uv, out vec3 al, out float h, out float r, out float ao, out float m){
  vec2 p = uv * vec2(10.0, 28.0);
  float row = floor(p.y); p.x += mod(row, 2.0) * 0.5;
  vec2 id = vec2(mod(floor(p.x), 10.0), row), f = fract(p);
  vec2 e = min(f, 1.0 - f) * vec2(0.244, 0.087);
  float d = min(e.x, e.y);
  float brick = smoothstep(0.004, 0.0075, d + (fbm(uv, 64.0, 3) - 0.5) * 0.003);
  float t = hash12(id + uSeed);
  vec3 col = t < 0.5 ? vec3(0.56, 0.27, 0.19) : t < 0.8 ? vec3(0.46, 0.22, 0.17) : t < 0.93 ? vec3(0.33, 0.17, 0.14) : vec3(0.66, 0.43, 0.32);
  float fine = fbm(uv, 128.0, 3), blot = fbm(uv * vec2(1.0, 1.0) + id.yx * 0.01, 24.0, 3);
  al = L(col) * (0.82 + 0.3 * fine) * (0.9 + 0.2 * blot);
  al = mix(L(vec3(0.62, 0.6, 0.56)) * (0.8 + 0.3 * fine), al, brick);
  h = brick * (0.7 + 0.3 * fine * blot) + (1.0 - brick) * 0.1 * fine;
  r = mix(0.95, 0.84, brick);
  ao = mix(0.6, 1.0, brick);
  m = 0.0;
}
void mPlaster(vec2 uv, out vec3 al, out float h, out float r, out float ao, out float m){
  float fine = fbm(uv, 220.0, 3), mid = fbm(uv, 30.0, 4), big = fbm(uv, 3.0, 4);
  float streak = anoise(uv, 48.0, 3.0) * smoothstep(0.3, 1.0, uv.y + 0.2 * big);
  al = L(vec3(0.86, 0.85, 0.82)) * (0.93 + 0.1 * mid) * (0.95 + 0.08 * fine);
  al *= 1.0 - 0.18 * smoothstep(0.55, 0.9, streak) - 0.08 * smoothstep(0.5, 0.8, big);
  vec3 cr = voronoi(uv + 0.015 * fbm(uv, 12.0, 3), 3.0);
  float crack = (1.0 - smoothstep(0.0, 0.0025, cr.y)) * step(0.8, cr.z);
  al *= 1.0 - crack * 0.4;
  h = fine * 0.5 + mid * 0.3 - crack * 0.5;
  r = 0.9; ao = 1.0 - crack * 0.4; m = 0.0;
}
void mWeatherboard(vec2 uv, out vec3 al, out float h, out float r, out float ao, out float m){
  float b = uv.y * 16.0, board = floor(b), t = fract(b);
  float seam = fract(uv.x * 2.0 + hash12(vec2(board, uSeed)) );
  float butt = lineMask(seam, 0.004) * step(0.55, hash12(vec2(board, 9.0)));
  float grain = anoise(uv + vec2(0.0, board * 0.13), 6.0, 180.0) * 0.5 + anoise(uv, 24.0, 640.0) * 0.5;
  float peel = smoothstep(0.66, 0.72, fbm(uv + 0.4, 10.0, 5));
  vec3 paint = L(vec3(0.9, 0.89, 0.86)) * (0.94 + 0.08 * fbm(uv, 64.0, 3));
  vec3 wood = L(vec3(0.46, 0.43, 0.38)) * (0.8 + 0.4 * grain);
  al = mix(paint, wood, peel);
  float shadowLine = smoothstep(0.82, 1.0, t);
  al *= 1.0 - shadowLine * 0.25 - butt * 0.35;
  h = (1.0 - t) * 0.85 + grain * 0.04 + (1.0 - peel) * 0.03 - butt * 0.3;
  r = mix(0.62, 0.9, peel); ao = 1.0 - shadowLine * 0.55; m = 0.0;
}
void mCorrugated(vec2 uv, out vec3 al, out float h, out float r, out float ao, out float m, float rusty){
  float wave = 0.5 + 0.5 * sin(uv.x * 20.0 * 6.2831853);
  float lap = lineMask(fract(uv.y * 0.5 + 0.0), 0.004);
  float spangle = voronoi(uv, 60.0).z;
  float streak = anoise(uv, 160.0, 4.0);
  float rust = rusty * smoothstep(0.45, 0.75, fbm(uv, 6.0, 5) * 0.7 + streak * 0.5 + (1.0 - uv.y) * 0.2);
  vec3 base = rusty > 0.5 ? L(vec3(0.62, 0.64, 0.66)) * (0.85 + 0.25 * spangle) : L(vec3(0.88, 0.88, 0.86));
  al = mix(base, L(mix(vec3(0.42, 0.2, 0.1), vec3(0.6, 0.33, 0.16), streak)), rust);
  al *= 0.9 + 0.12 * fbm(uv, 32.0, 3);
  h = wave * 0.9 + 0.1 * streak;
  r = rusty > 0.5 ? mix(0.42 + 0.15 * spangle, 0.85, rust) : 0.48 + 0.1 * streak;
  m = rusty > 0.5 ? mix(0.8, 0.1, rust) : 0.12;
  ao = mix(0.75, 1.0, wave) * (1.0 - lap * 0.4);
}
void mTiltSlab(vec2 uv, out vec3 al, out float h, out float r, out float ao, out float m){
  float joint = lineMask(fract(uv.x), 0.004);
  vec2 tie = fract(uv * vec2(6.0, 6.0)) - 0.5;
  float hole = 1.0 - smoothstep(0.012, 0.02, length(tie * vec2(1.0, 1.0)));
  float mott = fbm(uv, 8.0, 5), fine = fbm(uv, 200.0, 3);
  float streak = anoise(uv, 60.0, 2.0) * smoothstep(0.4, 1.0, uv.y);
  al = L(vec3(0.66, 0.65, 0.62)) * (0.82 + 0.3 * mott) * (0.96 + 0.06 * fine);
  al *= 1.0 - 0.25 * smoothstep(0.5, 0.9, streak) - joint * 0.5 - hole * 0.4;
  h = 0.6 + fine * 0.1 - joint * 0.6 - hole * 0.4;
  r = 0.82 - 0.1 * streak; ao = 1.0 - joint * 0.5 - hole * 0.3; m = 0.0;
}
void mGrass(vec2 uv, out vec3 al, out float h, out float r, out float ao, out float m){
  float b1 = anoise(uv, 700.0, 140.0), b2 = anoise(uv.yx + 0.3, 640.0, 120.0), b3 = fbm(uv, 400.0, 2);
  float blades = max(b1, b2) * 0.7 + b3 * 0.3;
  float patchy = fbm(uv, 4.0, 5), tint = fbm(uv + 0.7, 9.0, 4);
  vec3 g1 = vec3(0.24, 0.34, 0.12), g2 = vec3(0.36, 0.42, 0.16), dry = vec3(0.5, 0.47, 0.28), dirt = vec3(0.32, 0.26, 0.19);
  al = L(mix(mix(g1, g2, tint), dry, smoothstep(0.55, 0.8, patchy) * 0.6)) * (0.6 + 0.6 * blades);
  float bare = smoothstep(0.72, 0.8, fbm(uv + 3.3, 6.0, 5));
  al = mix(al, L(dirt) * (0.8 + 0.3 * b3), bare * 0.8);
  h = blades; r = 0.95; ao = mix(0.55, 1.0, blades); m = 0.0;
}
void mGravel(vec2 uv, out vec3 al, out float h, out float r, out float ao, out float m, vec3 tint){
  vec3 v = voronoi(uv, 140.0);
  float stone = smoothstep(0.75, 0.2, v.x);
  float big = fbm(uv, 5.0, 4);
  al = L(tint * mix(0.55, 1.15, v.z)) * mix(0.35, 1.0, stone) * (0.85 + 0.3 * big);
  h = stone * (0.7 + 0.3 * v.z); r = 0.9; ao = mix(0.45, 1.0, stone); m = 0.0;
}
void mWood(vec2 uv, out vec3 al, out float h, out float r, out float ao, out float m){
  float bx = uv.x * 8.0, board = floor(bx), t = fract(bx);
  float gap = 1.0 - smoothstep(0.0, 0.04, min(t, 1.0 - t));
  float grain = anoise(uv + vec2(board * 0.31, 0.0), 40.0, 3.0) * 0.6 + anoise(uv, 160.0, 6.0) * 0.4;
  float tone = hash12(vec2(board, uSeed));
  al = L(mix(vec3(0.42, 0.36, 0.29), vec3(0.58, 0.52, 0.43), tone)) * (0.75 + 0.45 * grain);
  al *= 1.0 - gap * 0.75;
  h = (1.0 - gap) * (0.7 + 0.3 * grain); r = 0.86; ao = 1.0 - gap * 0.6; m = 0.0;
}
void mRoller(vec2 uv, out vec3 al, out float h, out float r, out float ao, out float m){
  float rib = 0.5 + 0.5 * sin(uv.y * 40.0 * 6.2831853);
  float dirt = fbm(uv, 8.0, 4) * smoothstep(0.6, 0.0, uv.y);
  al = L(vec3(0.85, 0.85, 0.84)) * (0.9 + 0.1 * rib) * (1.0 - 0.3 * dirt);
  h = rib; r = 0.5 + 0.2 * dirt; ao = mix(0.7, 1.0, rib); m = 0.35;
}
void mStone(vec2 uv, out vec3 al, out float h, out float r, out float ao, out float m){
  vec3 v = voronoi(uv, 180.0);
  float fine = fbm(uv, 64.0, 4);
  float speck = step(0.7, v.z) * smoothstep(0.5, 0.2, v.x);
  al = L(vec3(0.55, 0.54, 0.52)) * (0.8 + 0.3 * fine);
  al = mix(al, L(vec3(0.12)), speck * 0.7);
  h = fine; r = 0.6 + 0.2 * fine; ao = 1.0; m = 0.0;
}
void mPaint(vec2 uv, out vec3 al, out float h, out float r, out float ao, out float m){
  float wear = fbm(uv, 12.0, 5), fine = fbm(uv, 120.0, 3);
  vec3 v = voronoi(uv, 160.0);
  al = L(vec3(0.86, 0.86, 0.83)) * (0.8 + 0.25 * fine);
  gAlpha = smoothstep(0.32, 0.4, wear * 0.75 + fine * 0.25 + 0.12) * smoothstep(0.05, 0.4, v.x + 0.1);
  h = 0.6 + 0.3 * fine; r = 0.62; ao = 1.0; m = 0.0;
}
void mBark(vec2 uv, out vec3 al, out float h, out float r, out float ao, out float m){
  float ridges = anoise(uv, 14.0, 2.0) * 0.6 + anoise(uv, 40.0, 4.0) * 0.4;
  float fine = fbm(uv, 64.0, 3);
  al = L(vec3(0.33, 0.28, 0.23)) * (0.55 + 0.6 * ridges) * (0.9 + 0.2 * fine);
  h = ridges; r = 0.92; ao = mix(0.5, 1.0, ridges); m = 0.0;
}
void material(vec2 uv, out vec3 al, out float h, out float r, out float ao, out float m){
  gAlpha = 1.0;
  if (uMat == 0) mAsphalt(uv, al, h, r, ao, m, 300.0);
  else if (uMat == 1) mAsphalt(uv, al, h, r, ao, m, 150.0);
  else if (uMat == 2) mConcrete(uv, al, h, r, ao, m);
  else if (uMat == 3) mPavers(uv, al, h, r, ao, m);
  else if (uMat == 4) mBrick(uv, al, h, r, ao, m);
  else if (uMat == 5) mPlaster(uv, al, h, r, ao, m);
  else if (uMat == 6) mWeatherboard(uv, al, h, r, ao, m);
  else if (uMat == 7) mCorrugated(uv, al, h, r, ao, m, 0.0);
  else if (uMat == 8) mCorrugated(uv, al, h, r, ao, m, 1.0);
  else if (uMat == 9) mTiltSlab(uv, al, h, r, ao, m);
  else if (uMat == 10) mGrass(uv, al, h, r, ao, m);
  else if (uMat == 11) mGravel(uv, al, h, r, ao, m, vec3(0.5, 0.5, 0.5));
  else if (uMat == 12) mWood(uv, al, h, r, ao, m);
  else if (uMat == 13) mRoller(uv, al, h, r, ao, m);
  else if (uMat == 14) mGravel(uv, al, h, r, ao, m, vec3(0.45, 0.38, 0.3));
  else if (uMat == 15) mStone(uv, al, h, r, ao, m);
  else if (uMat == 16) mPaint(uv, al, h, r, ao, m);
  else mBark(uv, al, h, r, ao, m);
}
void main(){
  vec3 al; float h, r, ao, m;
  material(vUv, al, h, r, ao, m);
  if (uMode == 0) { gl_FragColor = vec4(al, gAlpha); return; }
  if (uMode == 2) { gl_FragColor = vec4(ao, clamp(r, 0.04, 1.0), m, h); return; }
  vec3 a2; float hx, hy, t1, t2, t3;
  vec2 e = 1.0 / uRes;
  material(fract(vUv + vec2(e.x, 0.0)), a2, hx, t1, t2, t3);
  material(fract(vUv + vec2(0.0, e.y)), a2, hy, t1, t2, t3);
  vec2 slope = vec2(h - hx, h - hy) * uRes * uRelief;
  gl_FragColor = vec4(normalize(vec3(slope, 1.0)) * 0.5 + 0.5, 1.0);
}`;

// name -> [shader id, size factor (1 = tier size, .5 = half), relief = height metres / tile metres]
const TEX_DEFS = {
  asphalt: [0, 1, 0.004 / 4], chipseal: [1, 1, 0.008 / 3], concrete: [2, 1, 0.004 / 3], pavers: [3, 1, 0.01 / 2.4],
  brick: [4, 1, 0.012 / 2.44], plaster: [5, 0.5, 0.003 / 3], weatherboard: [6, 0.5, 0.02 / 2.4],
  corrugated: [7, 0.5, 0.018 / 1.52], corrugatedRust: [8, 0.5, 0.018 / 1.52], tiltslab: [9, 0.5, 0.006 / 4],
  grass: [10, 0.5, 0.01 / 2.5], gravel: [11, 0.5, 0.012 / 3], wood: [12, 0.5, 0.006 / 1.2], roller: [13, 0.5, 0.012 / 3],
  dirt: [14, 0.5, 0.012 / 3], stone: [15, 0.5, 0.002 / 1.5], paint: [16, 0.5, 0.0015 / 2], bark: [17, 0.5, 0.03 / 2],
};

class TextureForge {
  constructor(renderer, tierSize, aniso) {
    this.renderer = renderer; this.tierSize = tierSize; this.aniso = aniso;
    this.quad = new FullScreenQuad(new THREE.ShaderMaterial({
      vertexShader: FS_VERT, fragmentShader: TEX_LIB,
      uniforms: { uRes: { value: new THREE.Vector2() }, uSeed: { value: 0 }, uMode: { value: 0 }, uMat: { value: 0 }, uRelief: { value: 1 } },
      depthTest: false, depthWrite: false,
    }));
    this.sets = {};
  }
  make(name) {
    const [id, factor, relief] = TEX_DEFS[name];
    const size = Math.max(256, Math.round(this.tierSize * factor));
    const u = this.quad.material.uniforms;
    u.uRes.value.set(size, size); u.uSeed.value = id * 13.7 + 1.3; u.uMat.value = id; u.uRelief.value = relief;
    const out = [];
    for (let mode = 0; mode < 3; mode++) {
      const rt = new THREE.WebGLRenderTarget(size, size, {
        depthBuffer: false, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter,
        wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, anisotropy: this.aniso,
        colorSpace: mode === 0 ? THREE.SRGBColorSpace : THREE.NoColorSpace,
      });
      u.uMode.value = mode;
      this.renderer.setRenderTarget(rt); this.quad.render(this.renderer);
      out.push(rt.texture);
    }
    this.renderer.setRenderTarget(null);
    return (this.sets[name] = { map: out[0], normalMap: out[1], orm: out[2] });
  }
}
