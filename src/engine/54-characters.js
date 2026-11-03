// Procedural skinned humans. One SkinnedMesh (one draw call) per character, textured from a shared
// 4x4 canvas atlas, animated procedurally: IK gait with planted feet, boxing guard and strikes, hit reactions, falls.
const ATLAS = { skin: 0, faceA: 1, faceB: 2, faceC: 3, denim: 4, cotton: 5, leather: 6, vest: 7, knit: 8, shoe: 9, canvas: 10, track: 13 };
const SKIN_TONES = [0x8d5a3b, 0x6b4029, 0xa86f4c, 0xc68e6a, 0x7a4b31, 0xe0b090, 0x5a3624, 0xb5835e];

function buildCharacterAtlas() {
  const S = 1024, C = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d'), r = mulberry32(42);
  const cell = i => [(i % 4) * C, Math.floor(i / 4) * C];
  const speckle = (i, base, n, amp, size = 2) => {
    const [x, y] = cell(i); g.fillStyle = base; g.fillRect(x, y, C, C);
    for (let k = 0; k < n; k++) { const v = (r() - 0.5) * amp; g.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`; g.fillRect(x + r() * C, y + r() * C, size, size); }
  };
  speckle(ATLAS.skin, '#d9cbbf', 5000, 0.12);
  // Faces: sphere UV puts the face centre at u = 0.25, v = 0.5.
  for (const [i, hair, beard] of [[ATLAS.faceA, 'short', false], [ATLAS.faceB, 'shaved', false], [ATLAS.faceC, 'short', true]]) {
    speckle(i, '#d9cbbf', 4000, 0.1);
    const [x, y] = cell(i), fx = x + C * 0.25, ey = y + C * 0.44;
    g.fillStyle = hair === 'shaved' ? 'rgba(25,20,18,0.55)' : '#1d1714';
    g.fillRect(x, y, C, C * (hair === 'shaved' ? 0.3 : 0.36));
    g.beginPath(); g.ellipse(x + C * 0.75, y + C * 0.5, C * 0.3, C * 0.4, 0, 0, TAU); g.fill();
    g.fillRect(x, y, C * 0.06, C * 0.6); g.fillRect(x + C * 0.44, y, C * 0.12, C * 0.6);
    for (const s of [-1, 1]) {
      const ex = fx + s * C * 0.045;
      g.fillStyle = 'rgba(70,40,30,0.35)'; g.beginPath(); g.ellipse(ex, ey + 2, 11, 7, 0, 0, TAU); g.fill();
      g.fillStyle = '#efe9e2'; g.beginPath(); g.ellipse(ex, ey, 7, 3.6, 0, 0, TAU); g.fill();
      g.fillStyle = '#2a1c14'; g.beginPath(); g.arc(ex, ey, 2.6, 0, TAU); g.fill();
      g.fillStyle = '#20160f'; g.fillRect(ex - 9, ey - 10, 18, 3.5);
    }
    g.fillStyle = 'rgba(80,45,35,0.35)'; g.fillRect(fx - 3, ey + 6, 6, 18);
    g.fillStyle = 'rgba(60,30,25,0.45)'; g.beginPath(); g.ellipse(fx, ey + 34, 13, 4, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(120,50,45,0.55)'; g.beginPath(); g.ellipse(fx, ey + 33, 11, 2.6, 0, 0, TAU); g.fill();
    if (beard) { g.fillStyle = 'rgba(25,18,14,0.75)'; g.beginPath(); g.ellipse(fx, ey + 44, 30, 26, 0, 0, Math.PI); g.fill(); g.fillRect(fx - 14, ey + 26, 28, 5); }
  }
  speckle(ATLAS.denim, '#3d5476', 9000, 0.25, 2);
  { const [x, y] = cell(ATLAS.denim); g.strokeStyle = 'rgba(255,255,255,0.06)'; for (let k = -C; k < C; k += 3) { g.beginPath(); g.moveTo(x + k, y); g.lineTo(x + k + C, y + C); g.stroke(); } }
  speckle(ATLAS.cotton, '#e6e3de', 6000, 0.12, 2);
  speckle(ATLAS.leather, '#1b1a19', 3000, 0.18, 3);
  speckle(ATLAS.vest, '#191818', 4000, 0.15, 2);
  { const [x, y] = cell(ATLAS.vest), cx = x + C * 0.5, cy = y + C * 0.52;
    g.fillStyle = '#f2f0ea'; g.beginPath(); g.arc(cx, cy, C * 0.13, 0, TAU); g.fill();
    g.fillStyle = '#191818'; g.beginPath(); g.arc(cx, cy, C * 0.09, 0, TAU); g.fill();
    g.fillStyle = '#f2f0ea'; g.beginPath(); g.moveTo(cx, cy - 18); g.lineTo(cx + 16, cy + 12); g.lineTo(cx - 16, cy + 12); g.fill();
    g.lineWidth = 9; g.strokeStyle = '#f2f0ea';
    g.beginPath(); g.arc(cx, cy + 40, C * 0.25, Math.PI * 1.2, Math.PI * 1.8); g.stroke();
    g.beginPath(); g.arc(cx, cy - 40, C * 0.25, Math.PI * 0.2, Math.PI * 0.8); g.stroke(); }
  speckle(ATLAS.knit, '#dcd9d4', 2000, 0.1, 2);
  { const [x, y] = cell(ATLAS.knit); g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 2; for (let k = 0; k < C; k += 6) { g.beginPath(); g.moveTo(x + k, y); g.lineTo(x + k, y + C); g.stroke(); } }
  speckle(ATLAS.shoe, '#d7d4cf', 2000, 0.1, 2);
  { const [x, y] = cell(ATLAS.shoe); g.fillStyle = '#f4f2ee'; g.fillRect(x, y + C * 0.82, C, C * 0.18); }
  speckle(ATLAS.canvas, '#cfc9bf', 7000, 0.16, 2);
  speckle(ATLAS.track, '#d8d6d3', 3000, 0.1, 2);
  { const [x, y] = cell(ATLAS.track); g.fillStyle = '#ffffff'; g.fillRect(x + C * 0.22, y, 8, C); g.fillRect(x + C * 0.72, y, 8, C); }
  const map = new THREE.CanvasTexture(cv); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  // Normal map from luminance (fabric weave, stitching, facial relief).
  const N = 512, src = document.createElement('canvas'); src.width = src.height = N;
  const sg = src.getContext('2d'); sg.drawImage(cv, 0, 0, N, N);
  const d = sg.getImageData(0, 0, N, N).data, out = sg.createImageData(N, N);
  const lum = (x, y) => { x = (x + N) % N; y = (y + N) % N; const i = (y * N + x) * 4; return (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255; };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (lum(x + 1, y) - lum(x - 1, y)) * 2.2, dy = (lum(x, y + 1) - lum(x, y - 1)) * 2.2;
    const l = Math.hypot(dx, dy, 1), i = (y * N + x) * 4;
    out.data[i] = (-dx / l * 0.5 + 0.5) * 255; out.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; out.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; out.data[i + 3] = 255;
  }
  sg.putImageData(out, 0, 0);
  const normalMap = new THREE.CanvasTexture(src);
  return new THREE.MeshStandardMaterial({ map, normalMap, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.78, metalness: 0, vertexColors: true });
}

const BONES = [
  ['root', -1, [0, 0, 0]], ['hips', 0, [0, 0.95, 0]], ['spine', 1, [0, 0.12, 0]], ['chest', 2, [0, 0.2, 0]], ['neck', 3, [0, 0.25, 0]], ['head', 4, [0, 0.1, 0]],
  ['armL', 3, [0.2, 0.19, 0]], ['foreL', 6, [0, -0.29, 0]], ['handL', 7, [0, -0.26, 0]],
  ['armR', 3, [-0.2, 0.19, 0]], ['foreR', 9, [0, -0.29, 0]], ['handR', 10, [0, -0.26, 0]],
  ['thighL', 1, [0.1, -0.03, 0]], ['shinL', 12, [0, -0.44, 0]], ['footL', 13, [0, -0.42, 0]],
  ['thighR', 1, [-0.1, -0.03, 0]], ['shinR', 15, [0, -0.44, 0]], ['footR', 16, [0, -0.42, 0]],
];
const BONE = Object.fromEntries(BONES.map((b, i) => [b[0], i]));

// Prepare a part: remap UVs into an atlas cell, stamp tint + bone weights, return indexed geometry.
function part(geo, cellIndex, tint, bone, bone2, splitY0, splitY1) {
  const g = geo;
  const n = g.attributes.position.count, uv = g.attributes.uv, pad = 6 / 1024, size = 0.25 - 2 * pad;
  const cx = (cellIndex % 4) * 0.25 + pad, cy = 1 - (Math.floor(cellIndex / 4) + 1) * 0.25 + pad;
  const uvs = new Float32Array(n * 2), colors = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    uvs[i * 2] = cx + clamp(uv.getX(i), 0, 1) * size; uvs[i * 2 + 1] = cy + clamp(uv.getY(i), 0, 1) * size;
    colors[i * 3] = tint.r; colors[i * 3 + 1] = tint.g; colors[i * 3 + 2] = tint.b;
    if (bone2 != null) {
      const y = g.attributes.position.getY(i), w = clamp((y - splitY0) / (splitY1 - splitY0), 0, 1);
      si[i * 4] = bone; si[i * 4 + 1] = bone2; sw[i * 4] = 1 - w; sw[i * 4 + 1] = w;
    } else { si[i * 4] = bone; sw[i * 4] = 1; }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  return g;
}
function limb(r0, r1, len, x, yTop, z = 0) {
  const g = new THREE.CapsuleGeometry(1, len, 4, 10);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = clamp((p.getY(i) + len / 2) / len, 0, 1), r = lerp(r1, r0, t);
    const y = p.getY(i), yy = y > len / 2 ? len / 2 + (y - len / 2) * r : y < -len / 2 ? -len / 2 + (y + len / 2) * r : y;
    p.setXYZ(i, p.getX(i) * r, yy, p.getZ(i) * r * 0.92);
  }
  g.translate(x, yTop - len / 2, z);
  return g;
}
function lathe(profile, zScale, y0 = 0) {
  const g = new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(p[0], p[1] + y0)), 16);
  g.scale(1, 1, zScale);
  return g;
}
function mergeParts(list) {
  let n = 0, ni = 0; for (const g of list) { n += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const attrs = { position: [3, Float32Array], normal: [3, Float32Array], uv: [2, Float32Array], color: [3, Float32Array], skinIndex: [4, Uint16Array], skinWeight: [4, Float32Array] };
  const out = {}; for (const k in attrs) out[k] = new attrs[k][1](n * attrs[k][0]);
  const idx = new Uint32Array(ni); let o = 0, io = 0;
  for (const g of list) {
    for (const k in attrs) out[k].set(g.attributes[k].array, o * attrs[k][0]);
    const c = g.attributes.position.count;
    if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i++) idx[io + i] = a[i] + o; io += a.length; }
    else { for (let i = 0; i < c; i++) idx[io + i] = o + i; io += c; }
    o += c;
  }
  const m = new THREE.BufferGeometry();
  for (const k in attrs) m.setAttribute(k, new THREE.BufferAttribute(out[k], attrs[k][0]));
  m.setIndex(new THREE.BufferAttribute(idx, 1));
  return m;
}

// ---- procedural animation helpers: two-bone IK, Catmull-Rom tracks, boxing clips ------------------
const _V = Array.from({ length: 16 }, () => new THREE.Vector3());
const _Q = Array.from({ length: 4 }, () => new THREE.Quaternion());
const _Qa = [new THREE.Quaternion(), new THREE.Quaternion()], _Qb = [new THREE.Quaternion(), new THREE.Quaternion()];
const _M = Array.from({ length: 4 }, () => new THREE.Matrix4());
const _EU = new THREE.Euler(), _EQ = new THREE.Quaternion(), V_FWD = new THREE.Vector3(0, 0, 1);
// Rotation turning a bone's rest axis a0 (front f0) onto axis a1 (front f1); fronts are squared up to their axis.
function aimQuat(out, a0, f0, a1, f1) {
  const X = _V[14], Z = _V[15], m0 = _M[0], m1 = _M[1];
  Z.copy(f0).addScaledVector(a0, -f0.dot(a0)).normalize(); X.crossVectors(a0, Z); m0.makeBasis(X, a0, Z);
  Z.copy(f1).addScaledVector(a1, -f1.dot(a1)); if (Z.lengthSq() < 1e-8) Z.set(0, 0, 1).addScaledVector(a1, -a1.z); Z.normalize(); X.crossVectors(a1, Z); m1.makeBasis(X, a1, Z);
  return out.setFromRotationMatrix(m1.multiply(m0.transpose()));
}
// Two-bone IK in the limb's parent space: tgt = where the end joint goes, pole = which way the knee/elbow points.
// sgn +1 when the limb's rest front faces the pole (legs: kneecap), -1 when it faces away (arms: inside of the elbow).
function ik2(L, tgt, pole, sgn) {
  const base = L.up.position, D = _V[0].subVectors(tgt, base); let d = D.length(); if (d < 1e-5) return; D.divideScalar(d);
  const l1 = L.l1, l2 = L.l2; d = clamp(d, Math.abs(l1 - l2) + 0.02, (l1 + l2) * 0.999);
  const ca = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1), sa = Math.sqrt(1 - ca * ca);
  const n = _V[1].copy(pole).addScaledVector(D, -pole.dot(D)); if (n.lengthSq() < 1e-8) n.set(0, 0, sgn).addScaledVector(D, -D.z * sgn); n.normalize();
  const ud = _V[2].copy(D).multiplyScalar(ca).addScaledVector(n, sa);
  const mid = _V[3].copy(base).addScaledVector(ud, l1), ld = _V[4].copy(base).addScaledVector(D, d).sub(mid).normalize();
  const f = _V[5].copy(n).multiplyScalar(sgn);
  aimQuat(L.up.quaternion, L.a1, V_FWD, ud, f);
  const qi = _Q[0].copy(L.up.quaternion).invert();
  aimQuat(L.lo.quaternion, L.a2, V_FWD, _V[6].copy(ld).applyQuaternion(qi), _V[7].copy(f).applyQuaternion(qi));
}
const cr = (p0, p1, p2, p3, s) => 0.5 * (2 * p1 + (-p0 + p2) * s + (2 * p0 - 5 * p1 + 4 * p2 - p3) * s * s + (-p0 + 3 * p1 - 3 * p2 + p3) * s * s * s);
function trackAt(tr, u) {
  const n = tr.length; if (u <= tr[0][0]) return tr[0][1]; if (u >= tr[n - 1][0]) return tr[n - 1][1];
  let i = 0; while (u > tr[i + 1][0]) i++;
  return cr(tr[Math.max(0, i - 1)][1], tr[i][1], tr[i + 1][1], tr[Math.min(n - 1, i + 2)][1], (u - tr[i][0]) / (tr[i + 1][0] - tr[i][0]));
}
// Guard hand spots relative to each shoulder in the chest's frame, in arm lengths (x outward, y up, z forward).
// Orthodox: left hand leads at the chin, right hand by the jaw.
const GUARD = { lead: [-0.18, 0.23, 0.48], rear: [-0.2, 0.27, 0.25], block: [-0.22, 0.38, 0.53], weapon: [0.25, 0.32, 0.15] };
// Strikes for anyone throwing them (player body and every fighter). Hand keys are relative to the shoulder in
// the body frame ('G' guard, 'W' weapon guard); torso tracks add to the guard stance (yaws in radians, steps in m).
// hit = the impact moment, which the fight code lines up with damage.
const CLIPS = {
  jab: { arm: 'L', dur: 0.32, hit: 0.1, pole: [0.5, -1, -0.25], hand: [[0, 'G'], [0.1, [-0.22, 0.1, 0.96]], [0.16, [-0.22, 0.09, 0.93]], [0.32, 'G']],
    chest: [[0, 0], [0.1, -0.25], [0.32, 0]], hips: [[0, 0], [0.1, -0.08], [0.32, 0]], lean: [[0, 0], [0.1, 0.08], [0.32, 0]], lead: [[0, 0], [0.1, 0.12], [0.32, 0]] },
  cross: { arm: 'R', dur: 0.4, hit: 0.13, pole: [0.5, -1, -0.25], hand: [[0, 'G'], [0.13, [-0.2, 0.08, 0.97]], [0.2, [-0.2, 0.07, 0.94]], [0.4, 'G']],
    chest: [[0, 0], [0.13, 0.85], [0.22, 0.8], [0.4, 0]], hips: [[0, 0], [0.13, 0.5], [0.4, 0]], lean: [[0, 0], [0.13, 0.12], [0.4, 0]], heel: [[0, 0], [0.13, 0.07], [0.3, 0.04], [0.4, 0]], pivot: [[0, 0], [0.13, 0.55], [0.4, 0]] },
  hook: { arm: 'L', dur: 0.44, hit: 0.17, pole: [1, 0.8, -0.5], hand: [[0, 'G'], [0.07, [0.38, 0.0, 0.42]], [0.17, [-0.42, 0.03, 0.75]], [0.25, [-0.55, 0.0, 0.55]], [0.44, 'G']],
    chest: [[0, 0], [0.07, -0.2], [0.17, 0.75], [0.25, 0.85], [0.44, 0]], hips: [[0, 0], [0.07, -0.05], [0.17, 0.4], [0.44, 0]], lean: [[0, 0], [0.17, 0.05], [0.44, 0]], leadHeel: [[0, 0], [0.17, 0.04], [0.44, 0]], leadPivot: [[0, 0], [0.17, 0.4], [0.44, 0]] },
  upper: { arm: 'R', dur: 0.5, hit: 0.2, pole: [0.3, -1, -0.5], hand: [[0, 'G'], [0.08, [0.06, -0.48, 0.35]], [0.2, [-0.16, 0.42, 0.62]], [0.28, [-0.16, 0.52, 0.5]], [0.5, 'G']],
    chest: [[0, 0], [0.08, -0.15], [0.2, 0.7], [0.5, 0]], hips: [[0, 0], [0.2, 0.35], [0.5, 0]], lean: [[0, 0], [0.08, 0.12], [0.2, -0.06], [0.5, 0]], drop: [[0, 0], [0.08, 0.08], [0.2, -0.02], [0.5, 0]],
    roll: [[0, 0], [0.08, 0.14], [0.2, -0.08], [0.5, 0]], heel: [[0, 0], [0.2, 0.06], [0.5, 0]], pivot: [[0, 0], [0.2, 0.45], [0.5, 0]] },
  hay: { arm: 'R', dur: 1.0, hit: 0.62, pole: [1, 0.5, -0.4], hand: [[0, 'G'], [0.42, [0.62, 0.25, -0.35]], [0.62, [-0.32, 0.05, 0.62]], [0.74, [-0.62, -0.12, 0.38]], [1.0, 'G']],
    chest: [[0, 0], [0.42, -0.55], [0.62, 0.95], [0.74, 1.1], [1.0, 0]], hips: [[0, 0], [0.42, -0.3], [0.62, 0.6], [1, 0]], lean: [[0, 0], [0.42, -0.12], [0.62, 0.18], [1, 0]], lead: [[0, 0], [0.42, -0.05], [0.62, 0.18], [1, 0]],
    heel: [[0, 0], [0.62, 0.07], [1, 0]], pivot: [[0, 0], [0.62, 0.6], [1, 0]] },
  swing: { arm: 'R', dur: 0.56, hit: 0.22, pole: [1, 0.3, -0.5], hand: [[0, 'W'], [0.1, [0.55, 0.45, -0.18]], [0.22, [-0.25, 0.0, 0.85]], [0.34, [-0.65, -0.3, 0.45]], [0.56, 'W']],
    chest: [[0, 0], [0.1, -0.45], [0.22, 0.85], [0.34, 1.1], [0.56, 0]], hips: [[0, 0], [0.1, -0.2], [0.22, 0.5], [0.56, 0]], lean: [[0, 0], [0.22, 0.15], [0.56, 0]], heel: [[0, 0], [0.22, 0.06], [0.56, 0]], pivot: [[0, 0], [0.22, 0.5], [0.56, 0]] },
  knee: { arm: 'B', dur: 0.42, hit: 0.15, pole: [0.6, -1, -0.3], hand: [[0, [-0.25, -0.15, 0.75]], [0.42, [-0.25, -0.15, 0.75]]], knee: [[0, 0], [0.15, 1], [0.42, 0]], lean: [[0, 0], [0.15, 0.22], [0.42, 0]] },
  parry: { arm: 'L', dur: 0.3, hit: 0.08, pole: [0.6, -1, -0.2], hand: [[0, 'G'], [0.08, [0.3, 0.2, 0.62]], [0.3, 'G']], chest: [[0, 0], [0.08, -0.25], [0.3, 0]] },
  throw: { arm: 'B', dur: 0.55, hit: 0.2, pole: [0.6, -1, -0.3], hand: [[0, [-0.25, -0.1, 0.75]], [0.2, [-0.6, 0.0, 0.5]], [0.55, 'G']], chest: [[0, -0.3], [0.2, 1.1], [0.55, 0]], hips: [[0, -0.1], [0.2, 0.5], [0.55, 0]], lean: [[0, 0], [0.2, 0.2], [0.55, 0]] },
};
// First-person versions (camera space, x outward): [pos, forearm-toward-elbow, back-of-hand]. Lead = left hand.
const FGUARD = {
  lead: [[0.12, -0.13, -0.44], [0.18, -0.7, 0.65], [0.35, 0.75, 0.5]], rear: [[0.17, -0.17, -0.36], [0.22, -0.72, 0.62], [0.35, 0.75, 0.55]],
  block: [[0.075, -0.03, -0.32], [0.12, -1, 0.2], [0.15, 0.1, -1]], hold: [[0.11, -0.16, -0.5], [0.2, -0.6, 0.8], [0.3, 0.9, 0.2]], weapon: [[0.2, -0.16, -0.4], [0.22, -0.72, 0.62], [0.35, 0.75, 0.55]],
};
const FCLIPS = {
  jab: { hand: 'L', dur: 0.3, keys: [[0, 'G'], [0.03, [[0.13, -0.13, -0.42], [0.18, -0.7, 0.65], [0.35, 0.75, 0.5]]], [0.09, [[-0.02, -0.08, -0.7], [0.08, -0.2, 1], [0.35, 0.75, 0.1]]], [0.14, [[-0.02, -0.085, -0.68], [0.08, -0.2, 1], [0.35, 0.75, 0.1]]], [0.3, 'G']], twist: [[0, 0], [0.09, -0.03], [0.3, 0]] },
  cross: { hand: 'R', dur: 0.38, keys: [[0, 'G'], [0.13, [[-0.03, -0.09, -0.72], [0.08, -0.2, 1], [0.35, 0.75, 0.1]]], [0.19, [[-0.03, -0.095, -0.7], [0.08, -0.2, 1], [0.35, 0.75, 0.1]]], [0.38, 'G']], twist: [[0, 0], [0.13, 0.07], [0.38, 0]] },
  hook: { hand: 'L', dur: 0.42, keys: [[0, 'G'], [0.07, [[0.3, -0.1, -0.42], [1, -0.15, 0.3], [0.05, 1, 0.1]]], [0.16, [[0.0, -0.07, -0.55], [1, -0.05, 0.25], [0, 1, 0]]], [0.24, [[-0.12, -0.08, -0.5], [0.95, -0.05, 0.35], [0, 1, 0]]], [0.42, 'G']], twist: [[0, 0], [0.07, 0.04], [0.16, -0.08], [0.42, 0]] },
  upper: { hand: 'R', dur: 0.5, keys: [[0, 'G'], [0.08, [[0.1, -0.3, -0.42], [0.15, -0.95, 0.35], [0.2, 0.2, -1]]], [0.19, [[0.02, -0.03, -0.56], [0.1, -1, 0.3], [0.1, 0.15, -1]]], [0.26, [[0.02, 0.0, -0.54], [0.1, -1, 0.3], [0.1, 0.15, -1]]], [0.5, 'G']], twist: [[0, 0], [0.08, -0.03], [0.19, 0.05], [0.5, 0]], dip: [[0, 0], [0.08, 0.03], [0.19, -0.02], [0.5, 0]] },
  parry: { hand: 'L', dur: 0.3, keys: [[0, 'G'], [0.08, [[0.32, -0.04, -0.5], [0.4, -0.8, 0.5], [0.6, 0.2, -0.6]]], [0.3, 'G']], twist: [[0, 0], [0.08, -0.05], [0.3, 0]] },
  knee: { hand: 'B', dur: 0.42, keys: [[0, 'G'], [0.15, [[0.11, -0.12, -0.46], [0.2, -0.6, 0.8], [0.3, 0.9, 0.2]]], [0.42, 'G']], dip: [[0, 0], [0.15, 0.05], [0.42, 0]] },
  throw: { hand: 'B', dur: 0.55, keys: [[0, 'G'], [0.2, [[-0.3, -0.12, -0.45], [0.6, -0.5, 0.6], [0.3, 0.9, 0.2]]], [0.55, 'G']], twist: [[0, 0], [0.2, 0.18], [0.55, 0]] },
  swing: { hand: 'R', dur: 0.56, keys: [[0, 'G'], [0.1, [[0.26, -0.06, -0.38], [0.22, -0.72, 0.62], [0.35, 0.75, 0.55]]], [0.22, [[-0.05, -0.12, -0.6], [0.1, -0.4, 0.9], [0.35, 0.75, 0.2]]], [0.34, [[-0.2, -0.2, -0.5], [0.1, -0.5, 0.85], [0.35, 0.75, 0.3]]], [0.56, 'G']],
    sweep: [[0, 0], [0.1, -0.5], [0.22, 1.3], [0.34, 1.65], [0.56, 0]], twist: [[0, 0], [0.1, 0.05], [0.22, -0.1], [0.56, 0]] },
};

class Human {
  constructor(material, o) {
    const rnd = mulberry32(o.seed || 1);
    const skin = new THREE.Color(o.skin ?? SKIN_TONES[Math.floor(rnd() * SKIN_TONES.length)]);
    const top = new THREE.Color(o.top ?? 0x333333), pants = new THREE.Color(o.pants ?? 0xffffff), shoes = new THREE.Color(o.shoes ?? 0x222222);
    const parts = [];
    const pantsCell = o.pantsCell ?? ATLAS.denim, topCell = o.topCell ?? ATLAS.cotton;
    // Torso (spine->chest blend) and pelvis.
    parts.push(part(lathe([[0.001, 0], [0.15, 0.02], [0.152, 0.12], [0.17, 0.26], [0.19, 0.36], [0.185, 0.42], [0.15, 0.47], [0.075, 0.5], [0.001, 0.505]], 0.66, 1.0), topCell, top, BONE.spine, BONE.chest, 1.12, 1.3));
    parts.push(part(lathe([[0.001, 0], [0.135, 0.01], [0.168, 0.1], [0.162, 0.2], [0.001, 0.205]], 0.7, 0.82), pantsCell, pants, BONE.hips));
    if (o.vest != null) parts.push(part(lathe([[0.158, 0.06], [0.16, 0.12], [0.178, 0.26], [0.198, 0.36], [0.194, 0.42], [0.16, 0.47], [0.13, 0.48]], 0.7, 1.0), ATLAS.vest, new THREE.Color(o.vest), BONE.spine, BONE.chest, 1.12, 1.3));
    parts.push(part(new THREE.CylinderGeometry(0.052, 0.058, 0.14, 10).translate(0, 1.55, 0), ATLAS.skin, skin, BONE.neck));
    const head = new THREE.SphereGeometry(0.112, 20, 16); head.scale(0.9, 1.12, 1.0); head.translate(0, 1.715, 0.005);
    const hp = head.attributes.position; for (let i = 0; i < hp.count; i++) { const y = hp.getY(i) - 1.715; if (y < -0.03) hp.setX(i, hp.getX(i) * (1 + y * 1.6)); }
    parts.push(part(head, o.face ?? ATLAS.faceA, skin, BONE.head));
    parts.push(part(new THREE.SphereGeometry(0.022, 6, 6).scale(0.6, 1.2, 1).translate(0.1, 1.71, 0.0), ATLAS.skin, skin, BONE.head));
    parts.push(part(new THREE.SphereGeometry(0.022, 6, 6).scale(0.6, 1.2, 1).translate(-0.1, 1.71, 0.0), ATLAS.skin, skin, BONE.head));
    parts.push(part(new THREE.ConeGeometry(0.02, 0.05, 6).rotateX(Math.PI / 2).translate(0, 1.705, 0.115), ATLAS.skin, skin, BONE.head));
    if (o.beanie != null) { const b = new THREE.SphereGeometry(0.122, 16, 8, 0, TAU, 0, Math.PI * 0.5); b.scale(0.93, 1.05, 1.02); b.translate(0, 1.75, 0.0); parts.push(part(b, ATLAS.knit, new THREE.Color(o.beanie), BONE.head)); }
    const sleeveLong = o.longSleeves !== false;
    for (const s of [1, -1]) {
      const L = s > 0 ? 'L' : 'R', x = 0.2 * s;
      parts.push(part(new THREE.SphereGeometry(0.072, 10, 8).translate(x, 1.45, 0), topCell, top, BONE['arm' + L]));
      parts.push(part(limb(0.058, 0.047, 0.24, x, 1.44), topCell, top, BONE['arm' + L]));
      parts.push(part(limb(0.046, 0.036, 0.23, x, 1.16), sleeveLong ? topCell : ATLAS.skin, sleeveLong ? top : skin, BONE['fore' + L]));
      const hand = new THREE.SphereGeometry(0.05, 10, 8); hand.scale(0.75, 1.5, 0.5); hand.translate(x, 0.85, 0.01);
      parts.push(part(hand, ATLAS.skin, skin, BONE['hand' + L]));
      const xl = 0.1 * s;
      parts.push(part(limb(0.088, 0.064, 0.38, xl, 0.9), pantsCell, pants, BONE['thigh' + L]));
      parts.push(part(limb(0.062, 0.046, 0.38, xl, 0.48), pantsCell, pants, BONE['shin' + L]));
      const shoe = new THREE.BoxGeometry(0.105, 0.085, 0.27, 2, 1, 3); const sp = shoe.attributes.position;
      for (let i = 0; i < sp.count; i++) { const zz = sp.getZ(i); if (zz > 0.08) sp.setY(i, sp.getY(i) * 0.75); if (Math.abs(zz) > 0.12) sp.setX(i, sp.getX(i) * 0.8); }
      shoe.translate(xl, 0.045, 0.05);
      parts.push(part(shoe, ATLAS.shoe, shoes, BONE['foot' + L]));
    }
    const geometry = mergeParts(parts);
    const bones = BONES.map(([name]) => new THREE.Bone());
    BONES.forEach(([name, parent, p], i) => { bones[i].name = name; bones[i].position.fromArray(p); if (parent >= 0) bones[parent].add(bones[i]); });
    this.mesh = new THREE.SkinnedMesh(geometry, material);
    this.mesh.add(bones[0]);
    this.mesh.bind(new THREE.Skeleton(bones));
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.bones = bones;
    bones[BONE.armL].rotation.order = 'YXZ'; bones[BONE.armR].rotation.order = 'YXZ';
    this.root = new THREE.Group();
    this.root.add(this.mesh);
    const s = o.scale ?? (0.96 + rnd() * 0.1); this.mesh.scale.setScalar(s);
    this.root.userData.human = this;
    this.phase = rnd() * TAU; this.idleSeed = rnd() * 100; this.mode = 'idle'; this.speed = 0; this.punchT = 0; this.hitT = 0; this.downT = 0;
    this.pose = o.pose || 'relaxed'; this.lookYaw = 0; this.heading = 0; this.lean = 0;
    this.hipRest = new THREE.Vector3(0, 0.95, 0);
    if (o.look) PEOPLE.get(o.look).then(d => d && this.applyReal(d)).catch(() => { });
  }
  // Swap the stand-in body for a realistic MakeHuman one: same bones, rest joints from the model.
  applyReal(d) {
    const B = this.bones, J = d.joints;
    const PARENT = { hips: null, spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck', armL: 'chest', foreL: 'armL', handL: 'foreL', armR: 'chest', foreR: 'armR', handR: 'foreR', thighL: 'hips', shinL: 'thighL', footL: 'shinL', thighR: 'hips', shinR: 'thighR', footR: 'shinR' };
    for (const b of B) b.rotation.set(0, 0, 0);
    B[0].position.set(0, 0, 0);
    for (const [n, par] of Object.entries(PARENT)) { const a = J[n], q = par ? J[par] : [0, 0, 0]; B[BONE[n]].position.set(a[0] - q[0], a[1] - q[1], a[2] - q[2]); }
    this.hipRest.copy(B[BONE.hips].position);
    const old = this.mesh, mesh = new THREE.SkinnedMesh(d.geometry, d.material);
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    old.remove(B[0]); mesh.add(B[0]);
    mesh.rotation.copy(old.rotation); mesh.position.copy(old.position);
    const rot = mesh.rotation.clone(), pos = mesh.position.clone(); mesh.rotation.set(0, 0, 0); mesh.position.set(0, 0, 0);
    this.root.add(mesh); this.root.remove(old);
    this.root.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(B));
    mesh.rotation.copy(rot); mesh.position.copy(pos);
    mesh.userData = { ...old.userData };
    const k = CULLED.indexOf(old); if (k >= 0) CULLED[k] = mesh;
    this.mesh = mesh; this.real = true; this._rig = null; if (this.loco) this.loco.hy = this.hipRest.y;
  }
  // Moves: jab, cross, hook, upper, hay (haymaker), swing (weapon), knee, parry, throw. windup (s) stretches
  // the build-up so the impact lands exactly when the fight code resolves it.
  attack(name, windup = 0) { const d = CLIPS[name] || CLIPS.cross; this.clip = { d, e: 0, wu: windup > 0 ? windup : 0 }; }
  punch(windup) { this.attack('cross', windup); }
  // kind: jab | cross | hook | upper | body | heavy | parried | block; side: +1 from their right, -1 from their left.
  hit(kind = 'jab', side = 1) { this.react = { kind, side, t: 0 }; if (kind !== 'block' && this.clip && this.clip.e < (this.clip.wu || this.clip.d.hit)) this.clip = null; }
  knockDown() { this.downT = 0.0001; this.upT = 0; this.clip = null; this.downSide = Math.random() < 0.5 ? -1 : 1; }
  getUp() { if (this.downT > 0) this.upT = Math.min(this.downT, 0.8); else this.reset(); }
  reset() { this.downT = 0; this.upT = 0; this.hitT = 0; this.punchT = 0; this.clip = null; this.react = null; this.mesh.rotation.set(0, 0, 0); this.mesh.position.set(0, 0, 0); if (this.loco) this.loco.hy = this.hipRest.y; }
  rig() {
    if (this._rig) return this._rig;
    const B = this.bones, b = n => B[BONE[n]];
    const limb = (u, l, e) => { const up = b(u), lo = b(l), en = b(e); return { up, lo, en, l1: lo.position.length(), l2: en.position.length(), a1: lo.position.clone().normalize(), a2: en.position.clone().normalize() }; };
    const R = { legL: limb('thighL', 'shinL', 'footL'), legR: limb('thighR', 'shinR', 'footR'), armL: limb('armL', 'foreL', 'handL'), armR: limb('armR', 'foreR', 'handR') };
    R.leg = R.legL.l1 + R.legL.l2; R.k = R.leg / 0.875; R.reach = R.armL.l1 + R.armL.l2;
    R.ankleY = this.hipRest.y + b('thighL').position.y + b('shinL').position.y + b('footL').position.y;
    R.hipX = Math.abs(b('thighL').position.x); R.thighY = b('thighL').position.y; R.thighZ = b('thighL').position.z;
    R.feet = [{ p: new THREE.Vector3(), pitch: 0, yaw: 0, st: 0, u: 0 }, { p: new THREE.Vector3(), pitch: 0, yaw: 0, st: 0, u: 0 }];
    return (this._rig = R);
  }
  update(dt, t) {
    const B = this.bones, b = n => B[BONE[n]], R = this.rig();
    for (const bone of B) bone.rotation.set(0, 0, 0);
    const hips = b('hips'), spine = b('spine'), chest = b('chest');
    hips.position.copy(this.hipRest);
    // Velocity in the body's own frame, from how far the character actually moved (so feet match the ground).
    const rp = this.root.position, ry = this.root.rotation.y;
    const L = this.loco || (this.loco = { lx: rp.x, lz: rp.z, ly: ry, vx: 0, vz: 0, ph: this.phase / TAU, hy: this.hipRest.y, dx: 0, dz: 1, yr: 0 });
    let wvx = 0, wvz = 0;
    if (dt > 0) {
      const ddx = rp.x - L.lx, ddz = rp.z - L.lz; if (ddx * ddx + ddz * ddz < 9) { wvx = ddx / dt; wvz = ddz / dt; }
      let dyaw = ry - L.ly; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw)); L.yr = lerp(L.yr, clamp(dyaw / dt, -8, 8), 1 - Math.exp(-dt * 8));
    }
    L.lx = rp.x; L.lz = rp.z; L.ly = ry;
    const cy = Math.cos(ry), sy = Math.sin(ry), sc = this.mesh.scale.x || 1;
    let lvx = (wvx * cy - wvz * sy) / sc, lvz = (wvx * sy + wvz * cy) / sc; const ls = Math.hypot(lvx, lvz); if (ls > 9) { lvx *= 9 / ls; lvz *= 9 / ls; }
    const kv = 1 - Math.exp(-dt * 10); L.vx = lerp(L.vx, lvx, kv); L.vz = lerp(L.vz, lvz, kv);
    const lab = this.lab; if (lab) { L.vx = lab.vx || 0; L.vz = lab.vz || 0; if (lab.down != null) { this.downT = lab.down; this.upT = 0; } }
    const sp = Math.hypot(L.vx, L.vz); this.speed = sp; if (sp > 0.15) { L.dx = L.vx / sp; L.dz = L.vz / sp; }
    if (this.upT > 0) { this.upT -= dt * 1.5; if (this.upT <= 0) { this.upT = 0; this.downT = 0; this.mesh.rotation.set(0, 0, 0); this.mesh.position.set(0, 0, 0); L.hy = this.hipRest.y - 0.3 * R.k; } }
    if (this.downT > 0) { if (!(this.upT > 0) && !lab) this.downT = Math.min(this.downT + dt, 4); this.fallPose(this.upT > 0 ? Math.min(this.upT, 0.8) : this.downT, t, b, R); return; }
    if (this.pose === 'seated') { b('head').rotation.y = clamp(this.lookYaw, -1.1, 1.1) * 0.75; b('neck').rotation.y = clamp(this.lookYaw, -1.1, 1.1) * 0.25; b('head').rotation.x = Math.sin(t * 0.7 + this.idleSeed) * 0.04; this.seated(dt, t, b); return; }
    // Clip timeline.
    if (lab) this.clip = lab.clip ? { d: CLIPS[lab.clip], e: lab.u || 0, wu: 0 } : null;
    let C = this.clip, cu = -1, cw = 0;
    if (C) {
      if (!lab) C.e += dt; const d = C.d; cu = C.wu && C.e < C.wu ? C.e / C.wu * d.hit : C.wu ? d.hit + (C.e - C.wu) : C.e;
      if (cu >= d.dur) { this.clip = C = null; cu = -1; } else cw = clamp(Math.min(cu / Math.max(0.04, d.hit * 0.5), (d.dur - cu) / (d.dur * 0.3)), 0, 1);
    }
    const tr = name => C && C.d[name] ? trackAt(C.d[name], cu) : 0;
    // Hit reaction envelope.
    let rk = null, re = 0, rs = 1;
    if (this.react) { const r = this.react; r.t += dt; re = r.t < 0.05 ? r.t / 0.05 : Math.exp(-(r.t - 0.05) * 6.5); if (r.t > 0.7) this.react = null; else { rk = r.kind; rs = r.side; } }
    this.dz = lerp(this.dz || 0, this.daze ? 1 : 0, 1 - Math.exp(-dt * 6));
    const guardMode = this.mode === 'guard' || this.mode === 'block';
    const gwT = (guardMode ? 1 - smoothstep(sp, 2.6, 3.4) : 0) || (C ? 1 : 0);
    this.gw = lab ? gwT : lerp(this.gw ?? 0, gwT, 1 - Math.exp(-dt * 9)); const gw = this.gw;
    // ---- gait --------------------------------------------------------------------------------------
    // Dodge: a quick duck-and-slip, feet sliding, not a sideways sprint.
    this.dgw = lab ? (this.dodge ? 1 : 0) : lerp(this.dgw || 0, this.dodge ? 1 : 0, 1 - Math.exp(-dt * 18)); const dg = this.dgw;
    const sn = sp / R.k, run = smoothstep(sn, 1.9, 3.0) * (1 - gw) * (1 - dg), moveW = smoothstep(sp, 0.08, 0.6) * (1 - dg), fwdW = moveW * clamp(L.dz * 1.5, 0, 1);
    const cad = lerp(lerp(1.55 + 0.32 * sn, 2.65 + 0.16 * sn, run), 3.2, gw) / Math.sqrt(R.k);
    if (lab && lab.ph != null) L.ph = lab.ph; else if (sp > 0.05) L.ph = (L.ph + dt * cad / 2) % 1;
    const sf = lerp(lerp(0.6, lerp(0.35, 0.28, smoothstep(sn, 4, 8)), run), 0.62, gw);
    const dT = Math.min(sp * sf / Math.max(cad / 2, 0.1), 1.05 * R.k);
    const lift = (lerp(0.05 + 0.025 * sn, Math.min(0.5, 0.15 + 0.05 * sn), run) * (1 - gw) + gw * 0.045) * R.k;
    const back = L.dz < -0.2;
    for (let i = 0; i < 2; i++) {
      const F = R.feet[i], sg = i ? -1 : 1, psi = (L.ph + i * 0.5) % 1;
      let along, y = R.ankleY, pitch;
      if (psi < sf) {
        const u = psi / sf; along = dT * (0.5 - u);
        const hr = lerp(0.07, 0.09, run) * smoothstep(u, lerp(0.55, 0.4, run), 1) * R.k; y += hr;
        pitch = hr * 5.5 - (1 - run) * 0.18 * (1 - smoothstep(u, 0, 0.18)); F.st = 1; F.u = u;
      } else {
        const u = (psi - sf) / (1 - sf), ue = Math.pow(u, lerp(1, 1.35, run));
        along = dT * (-0.5 + (1 - Math.cos(Math.PI * ue)) / 2);
        y += lift * Math.sin(Math.PI * Math.pow(u, lerp(1, 0.7, run)));
        pitch = lerp(0.5, 0.8, run) * (1 - u) * (1 - u) - (1 - run) * 0.22 * smoothstep(u, 0.6, 1); F.st = 0; F.u = u;
      }
      along -= 0.2 * run * R.k; // runners land under themselves and push off well behind
      if (back) pitch *= 0.3;
      const bx = lerp(sg * lerp(0.12, 0.09, run) * R.k, (i ? -0.16 : 0.15) * R.k, gw), bz = lerp(0, (i ? -0.2 : 0.19) * R.k, gw) + (i ? 0 : tr('lead') * R.k);
      F.p.set(bx + L.dx * along * moveW, lerp(R.ankleY, y, moveW) + (i ? tr('heel') : tr('leadHeel')) * R.k, bz + L.dz * along * moveW);
      F.pitch = pitch * moveW + (i ? tr('heel') : tr('leadHeel')) * 5;
      F.yaw = lerp(sg * 0.12, i ? -0.75 : -0.25, gw) + (i ? tr('pivot') : tr('leadPivot'));
    }
    const kn = tr('knee'); if (kn) { const F = R.feet[1]; F.p.lerp(_V[8].set(-0.06 * R.k, R.ankleY + 0.45 * R.k, 0.3 * R.k), kn); F.pitch = lerp(F.pitch, 0.6, kn); F.st = 0; }
    // ---- pelvis and torso ---------------------------------------------------------------------------
    const cyc = Math.cos(TAU * L.ph), syc = Math.sin(TAU * L.ph);
    const sway = 0.022 * (1 - run * 0.7) * syc * moveW * (1 - gw) * R.k;
    const hx = this.hipRest.x + sway * L.dz, hz = this.hipRest.z - sway * L.dx;
    let hy = this.hipRest.y - (0.035 * run + 0.1 * gw + 0.03 * this.dz + 0.12 * dg) * R.k - tr('drop') * R.k;
    if (rk === 'body') hy -= 0.07 * re * R.k;
    let anyStance = false;
    for (let i = 0; i < 2; i++) {
      const F = R.feet[i]; if (!F.st) continue; anyStance = true;
      const jx = hx + (i ? -R.hipX : R.hipX), jz = hz + R.thighZ, h2 = (F.p.x - jx) ** 2 + (F.p.z - jz) ** 2;
      const top = F.p.y + Math.sqrt(Math.max(0, (0.975 * R.leg) ** 2 - h2)) - R.thighY - 0.06 * R.k * run * Math.sin(Math.PI * F.u);
      if (top < hy) hy = top;
    }
    if (!anyStance) hy += 0.025 * R.k * run;
    hy += gw * 0.012 * R.k * Math.sin(t * 10.5 + this.idleSeed) * (1 - moveW * 0.6);
    L.hy = hy < L.hy || lab ? hy : lerp(L.hy, hy, 1 - Math.exp(-dt * 14));
    hips.position.set(hx, L.hy, hz);
    const bank = clamp(-L.yr * sp * 0.025, -0.25, 0.25) * (1 - gw);
    const list = lerp(0.045, 0.025, run) * syc * moveW * (1 - gw);
    let hipsYaw = lerp(-lerp(0.1, 0.07, run) * cyc * fwdW, -0.3, gw) + tr('hips');
    let chestYaw = lerp(lerp(0.06, 0.16, run) * cyc * fwdW, -0.45, gw) + tr('chest');
    let lean = lerp(0.04 + 0.1 * run + 0.08 * smoothstep(sn, 5, 8), 0.12, gw) * (back ? 0.3 : 1) + tr('lean') + 0.1 * this.dz;
    let roll = tr('roll') - L.dx * 0.4 * dg, headX = 0, headY = 0, headZ = 0, armOut = 0; lean += L.dz * 0.25 * dg;
    if (rk) {
      if (rk === 'jab' || rk === 'cross') { headX -= 0.5 * re; lean -= 0.14 * re; headY += rs * 0.15 * re; }
      else if (rk === 'hook') { headY += rs * 0.7 * re; headZ += rs * 0.25 * re; chestYaw += rs * 0.25 * re; lean -= 0.05 * re; }
      else if (rk === 'upper') { headX -= 0.8 * re; lean -= 0.3 * re; armOut += 0.5 * re; }
      else if (rk === 'body') { lean += 0.6 * re; headX += 0.2 * re; }
      else if (rk === 'heavy') { headX -= 0.55 * re; headY += rs * 0.45 * re; lean -= 0.25 * re; chestYaw += rs * 0.3 * re; armOut += 0.3 * re; }
      else if (rk === 'parried') { chestYaw += rs * 0.45 * re; lean -= 0.12 * re; armOut += 0.35 * re; }
      else if (rk === 'block') { lean -= 0.06 * re; headX -= 0.08 * re; }
    }
    const breath = Math.sin(t * 1.6 + this.idleSeed) * 0.015;
    hips.rotation.set(0, hipsYaw, list + bank);
    const twist = chestYaw - hipsYaw;
    spine.rotation.set(lean * 0.6, twist * 0.4, -0.5 * list + roll * 0.5);
    chest.rotation.set(lean * 0.4 + breath, twist * 0.6, roll * 0.5);
    // ---- legs: two-bone IK onto the planted / swinging feet -----------------------------------------
    const legsFK = this.air || this.climbing;
    if (!legsFK) {
      const hq = hips.quaternion, hqi = _Q[1].copy(hq).invert();
      for (let i = 0; i < 2; i++) {
        const F = R.feet[i], leg = i ? R.legR : R.legL;
        const tgt = _V[8].copy(F.p).sub(hips.position).applyQuaternion(hqi);
        const pole = _V[9].set(Math.sin(F.yaw) + (i ? -0.15 : 0.15), 0, Math.cos(F.yaw)).applyQuaternion(hqi);
        ik2(leg, tgt, pole, 1);
        _EU.set(F.pitch, F.yaw, 0, 'YXZ');
        leg.en.quaternion.copy(_Q[3].copy(hq).multiply(leg.up.quaternion).multiply(leg.lo.quaternion).invert()).multiply(_Q[2].setFromEuler(_EU));
      }
    }
    // ---- arms: relaxed swing (FK), then guard / strike IK blended over it -----------------------------
    const S = lerp(0.22 + 0.1 * sn, Math.min(0.7, 0.38 + 0.04 * sn), run) * moveW;
    const aL = b('armL'), aR = b('armR'), fL = b('foreL'), fR = b('foreR');
    aL.rotation.set(S * cyc + 0.1 * run + 0.03, -0.25 * run * Math.max(0, -cyc), (this.real ? 0.0 : 0.07) + 0.1 * run + breath);
    aR.rotation.set(-S * cyc + 0.1 * run + 0.03, 0.25 * run * Math.max(0, cyc), -(this.real ? 0.0 : 0.07) - 0.1 * run - breath);
    fL.rotation.x = -(lerp(0.18, 1.3, run) + lerp(0.2, 0.3, run) * Math.max(0, -cyc) * moveW);
    fR.rotation.x = -(lerp(0.18, 1.3, run) + lerp(0.2, 0.3, run) * Math.max(0, cyc) * moveW);
    if (this.pose === 'crossed' && sp < 0.1 && !guardMode && !C) {
      aL.rotation.set(-0.4, 0, 0.06); aR.rotation.set(-0.4, 0, -0.06);
      fL.rotation.set(0, 0.55, -1.72); fR.rotation.set(0, -0.48, 1.68);
    }
    const armW = Math.max(gw, cw) * (1 - 0.45 * this.dz);
    if (armW > 0.01) {
      hips.updateMatrix(); spine.updateMatrix(); chest.updateMatrix();
      const Mc = _M[2].multiplyMatrices(hips.matrix, spine.matrix).multiply(chest.matrix), Mci = _M[3].copy(Mc).invert();
      const block = this.mode === 'block' && !C;
      for (let s = 0; s < 2; s++) {
        const sg = s ? -1 : 1, A = s ? R.armR : R.armL, uses = C && (C.d.arm === 'B' || (C.d.arm === 'L') === !s);
        _Qa[s].copy(A.up.quaternion); _Qb[s].copy(A.lo.quaternion);
        const gk = block ? GUARD.block : this.weapon && s ? GUARD.weapon : s ? GUARD.rear : GUARD.lead;
        const gp = _V[10].set(gk[0] * sg, gk[1], gk[2]).multiplyScalar(R.reach).add(A.up.position).applyMatrix4(Mc);
        const pole = _V[11].set((block ? 0.15 : 0.35) * sg, -1, block ? 0.1 : -0.15);
        let tgt = gp;
        if (uses) {
          const sh = _V[12].copy(A.up.position).applyMatrix4(Mc), keys = C.d.hand, n = keys.length;
          let i = 0; while (i < n - 2 && cu > keys[i + 1][0]) i++;
          const kp = j => { const k = keys[clamp(j, 0, n - 1)][1]; if (k === 'G' || k === 'W') return k === 'W' ? _V[13].set(GUARD.weapon[0] * sg, GUARD.weapon[1], GUARD.weapon[2]).multiplyScalar(R.reach).add(A.up.position).applyMatrix4(Mc).clone() : gp.clone(); return new THREE.Vector3(k[0] * sg, k[1], k[2]).multiplyScalar(R.reach).add(sh); };
          const p0 = kp(i - 1), p1 = kp(i), p2 = kp(i + 1), p3 = kp(i + 2), u = clamp((cu - keys[i][0]) / Math.max(1e-4, keys[Math.min(i + 1, n - 1)][0] - keys[i][0]), 0, 1);
          tgt = _V[13].set(cr(p0.x, p1.x, p2.x, p3.x, u), cr(p0.y, p1.y, p2.y, p3.y, u), cr(p0.z, p1.z, p2.z, p3.z, u));
          const cp = C.d.pole; pole.lerp(_V[12].set(cp[0] * sg, cp[1], cp[2]), cw);
        }
        if (this.dz > 0.01) tgt.y -= 0.12 * this.dz * R.reach;
        if (armOut) tgt.x += sg * armOut * 0.25 * R.reach;
        tgt.applyMatrix4(Mci); pole.transformDirection(Mci);
        ik2(A, tgt, pole, -1);
        A.up.quaternion.slerpQuaternions(_Qa[s], A.up.quaternion.clone(), armW);
        A.lo.quaternion.slerpQuaternions(_Qb[s], A.lo.quaternion.clone(), armW);
      }
    }
    // ---- head: steady gaze, looks at whoever it's watching -------------------------------------------
    const look = lerp(clamp(this.lookYaw, -1.1, 1.1), 0, gw), torso = chestYaw;
    b('neck').rotation.set(-lean * 0.25, (look - torso) * 0.3, 0);
    b('head').rotation.set(-lean * 0.35 + gw * 0.1 + Math.sin(t * 0.7 + this.idleSeed) * 0.03 + headX + Math.sin(t * 5) * 0.12 * this.dz, (look - torso) * 0.7 + headY, headZ + Math.sin(t * 3.7) * 0.1 * this.dz);
    // Jumping and climbing (the player's own body in third person).
    if (this.air) { b('thighL').rotation.set(-0.75, 0, 0); b('thighR').rotation.set(-0.45, 0, 0); b('shinL').rotation.set(1.1, 0, 0); b('shinR').rotation.set(0.8, 0, 0); b('footL').rotation.set(0.3, 0, 0); b('footR').rotation.set(0.3, 0, 0); aL.rotation.z = 0.55; aR.rotation.z = -0.55; }
    if (this.climbing) { aL.rotation.set(-2.7, 0, 0.2); aR.rotation.set(-2.7, 0, -0.2); fL.rotation.set(-0.4, 0, 0); fR.rotation.set(-0.4, 0, 0); b('thighL').rotation.set(-1.1, 0, 0); b('shinL').rotation.set(1.3, 0, 0); b('thighR').rotation.set(-0.3, 0, 0); b('shinR').rotation.set(0.5, 0, 0); }
  }
  // Knocked down: the knees go, they sit back and land on their back, legs slide out. Played backwards to get up.
  fallPose(T, t, b, R) {
    const k = R.k, hips = b('hips'), sc = this.mesh.scale.x || 1;
    const k1 = smoothstep(T, 0, 0.3), k2r = clamp((T - 0.14) / 0.48, 0, 1), k2 = k2r * k2r, k3 = smoothstep(T, 0.75, 1.7);
    const land = T > 0.62 ? Math.sin(clamp((T - 0.62) / 0.22, 0, 1) * Math.PI) * Math.exp(-(T - 0.62) * 4) : 0, side = this.downSide || 1;
    const hy = this.hipRest.y - 0.36 * k * k1;
    hips.position.set(this.hipRest.x, hy, this.hipRest.z);
    this.mesh.rotation.set(-k2 * Math.PI / 2 * 0.96, 0, side * 0.2 * k2);
    const hl = _V[8].set(0, hy, this.hipRest.z).multiplyScalar(sc).applyEuler(this.mesh.rotation);
    this.mesh.position.set(-hl.x, lerp(hy, 0.13 + 0.03 * land, k2) * sc - hl.y, lerp(this.hipRest.z, -0.32 * k, k2) * sc - hl.z);
    b('spine').rotation.set(0.28 * k1 - 0.25 * k2 + 0.04, 0, 0); b('chest').rotation.set(0.1 * k1 - 0.05 * k2, 0, 0);
    b('head').rotation.set(0.35 * k1 * (1 - k2) - 0.12 * k2 + 0.25 * land, side * 0.6 * k3, 0);
    const mrInv = _Q[1].setFromEuler(this.mesh.rotation).invert(), hqi = _Q[2].copy(hips.quaternion).invert();
    for (let i = 0; i < 2; i++) {
      const sg = i ? -1 : 1, leg = i ? R.legR : R.legL;
      // Feet planted where they stood (root space), carried into the falling body's frame, then sliding out.
      const p = _V[9].set(sg * 0.13 * k, R.ankleY, 0.06 * k).sub(this.mesh.position).divideScalar(sc).applyQuaternion(mrInv);
      p.lerp(_V[10].set(sg * 0.17 * k, hy - 0.8 * k, (0.12 + 0.06 * i) * k), k3 * 0.75);
      const tgt = p.sub(hips.position).applyQuaternion(hqi);
      ik2(leg, tgt, _V[11].set(sg * 0.25, 0, 1).applyQuaternion(hqi), 1);
      _Q[3].copy(hips.quaternion).multiply(leg.up.quaternion).multiply(leg.lo.quaternion).invert();
      const qf = _Q[0].copy(mrInv).slerp(_EQ.setFromEuler(_EU.set(0.5, sg * 0.3, 0, 'YXZ')), k3);
      leg.en.quaternion.copy(_Q[3]).multiply(qf);
    }
    const fl = 0.4 * k1 + 0.95 * k2 + 0.15 * land;
    b('armL').rotation.set(-0.5 * k1 * (1 - k2) - 0.2 * k2, 0, fl); b('armR').rotation.set(-0.5 * k1 * (1 - k2) - 0.2 * k2, 0, -fl);
    b('foreL').rotation.x = -0.6 + 0.35 * k2; b('foreR').rotation.x = -0.6 + 0.3 * k2;
  }
}


// Couch pose with a controller: thumbs mash while playing; react > 0 cheers, < 0 slumps (decays).
Human.prototype.seated = function (dt, t, b) {
  this.react = (this.react || 0) * Math.pow(0.35, dt);
  const cheer = Math.max(0, this.react), slump = Math.max(0, -this.react);
  b('hips').position.y = 0.53 + (this.hipRest.y - 0.95) * 0.3;
  b('thighL').rotation.set(-1.5, 0, 0.08); b('thighR').rotation.set(-1.5, 0, -0.08);
  b('shinL').rotation.set(1.42, 0, 0); b('shinR').rotation.set(1.42, 0, 0);
  b('footL').rotation.x = 0.1; b('footR').rotation.x = 0.1;
  const lean = this.playing ? 0.18 + Math.sin(t * 1.3) * 0.03 : -0.1;
  b('spine').rotation.set(lean + slump * 0.35, 0, 0); b('chest').rotation.set(0.04, Math.sin(t * 0.8) * 0.04, 0);
  const mash = this.playing ? Math.sin(t * 23) * 0.05 : 0;
  b('armL').rotation.set(-0.55 - cheer * 2.3, 0, 0.18 + cheer * 0.3); b('armR').rotation.set(-0.55 - cheer * 2.3, 0, -0.18 - cheer * 0.3);
  b('foreL').rotation.set(-1.1 + mash + cheer * 0.9, 0, -0.55 * (1 - cheer)); b('foreR').rotation.set(-1.1 - mash + cheer * 0.9, 0, 0.55 * (1 - cheer));
  b('head').rotation.x += slump * 0.4 - cheer * 0.25;
};

// First-person fists attached to the camera, held low in a guard; jab alternates hands.
// Local frame per hand: knuckles toward -y, forearm running back along +y, back of the hand toward -z.
class Fists {
  constructor(material, camera) {
    this.group = new THREE.Group(); camera.add(this.group);
    const skin = new THREE.Color(0x7a5642), sleeve = new THREE.Color(0x26292c), cuff = new THREE.Color(0x1c1e20);
    this.hands = [1, -1].map(s => {
      const parts = [];
      const palm = new THREE.BoxGeometry(0.084, 0.09, 0.07, 3, 3, 3); this.round(palm, [0.042, 0.045, 0.035], 0.022);
      parts.push(part(palm, ATLAS.skin, skin, 0));
      const curl = new THREE.BoxGeometry(0.084, 0.04, 0.045, 3, 2, 2); this.round(curl, [0.042, 0.02, 0.0225], 0.016); curl.translate(0, -0.035, 0.03);
      parts.push(part(curl, ATLAS.skin, skin, 0));
      for (let k = 0; k < 4; k++) {
        const f = new THREE.CapsuleGeometry(0.0118, 0.03, 3, 8).rotateX(Math.PI / 2);
        f.translate((k - 1.5) * 0.0205, -0.05 + Math.abs(k - 1.5) * 0.004, 0.006);
        parts.push(part(f, ATLAS.skin, skin, 0));
      }
      const thumb = new THREE.CapsuleGeometry(0.0125, 0.042, 3, 8).rotateZ(Math.PI / 2); thumb.translate(-0.008 * s, -0.03, 0.058);
      parts.push(part(thumb, ATLAS.skin, skin, 0));
      parts.push(part(limb(0.034, 0.04, 0.05, 0, 0.1), ATLAS.skin, skin, 0));
      parts.push(part(limb(0.052, 0.048, 0.05, 0, 0.13), ATLAS.cotton, cuff, 0));
      parts.push(part(limb(0.064, 0.054, 0.42, 0, 0.56), ATLAS.cotton, sleeve, 0));
      const mesh = new THREE.Mesh(mergeParts(parts), material);
      mesh.geometry.deleteAttribute('skinIndex'); mesh.geometry.deleteAttribute('skinWeight');
      mesh.frustumCulled = false; mesh.renderOrder = 10;
      const g = new THREE.Group(); g.add(mesh); g.userData.side = s;
      this.group.add(g);
      return g;
    });
    this.punch = [0, 0]; this.next = 0; this.bob = 0;
    PEOPLE.fparms().then(r => {
      if (!r) return;
      for (const g of this.hands) { const m = g.children[0]; m.geometry = r[g.userData.side > 0 ? 'R' : 'L']; m.material = r.material; }
    }).catch(() => { });
    // A held weapon (cricket bat, softball bat, pipe) gripped in the right fist (hand frame: knuckle line
    // along x, so the bat runs out of the thumb side and up past the knuckles).
    this.weapon = new THREE.Group(); this.weapon.visible = false;
    const right = this.hands.find(g => g.userData.side > 0); right.add(this.weapon);
    this.weaponBase = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-0.5, -1, 0.05).normalize());
    this.m = new THREE.Matrix4(); this.E = new THREE.Vector3(); this.B = new THREE.Vector3(); this.X = new THREE.Vector3(); this.Z = new THREE.Vector3();
  }
  round(geo, half, r) { // soften a box into a rounded block
    const p = geo.attributes.position, v = new THREE.Vector3(), h = new THREE.Vector3(half[0] - r, half[1] - r, half[2] - r);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const c = v.clone().clamp(h.clone().negate(), h), d = v.clone().sub(c);
      if (d.lengthSq() > 0) v.copy(c).add(d.normalize().multiplyScalar(r));
      p.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
  }
  play(name) { this.clip = { d: FCLIPS[name] || FCLIPS.jab, e: 0, name }; this.raised = 1.2; }
  swing() { this.play(this.next ? 'jab' : 'cross'); this.next = 1 - (this.next || 0); }
  // Hands stay out of view until you swing or a fight is on; they slide up from below the frame.
  setWeapon(kind) {
    this.weapon.clear(); this.weaponKind = kind || null;
    if (kind) { const m = weaponMesh(kind); m.traverse(o => { if (o.isMesh) { o.renderOrder = 11; o.frustumCulled = false; } }); this.weapon.add(m); }
    this.weapon.visible = !!kind;
  }
  update(dt, moving, sprint, guard, block) {
    const lab = this.lab; if (lab) { guard = true; block = !!lab.block; this.hold = !!lab.hold; this.clip = lab.name ? { d: FCLIPS[lab.name], e: lab.u || 0 } : null; this.show = 1; }
    let C = this.clip, cu = 0;
    if (C) { if (!lab) C.e += dt; cu = C.e; if (cu >= C.d.dur) { this.clip = C = null; } }
    if (this.weaponKind) guard = true;
    this.raised = Math.max(guard || block || this.hold ? 1 : 0, (this.raised || 0) - dt);
    this.show = lerp(this.show || 0, this.raised > 0 ? 1 : 0, 1 - Math.exp(-dt * 10));
    this.group.visible = this.show > 0.02;
    this.bob += dt * (moving ? (sprint ? 13 : 9) : 1.6);
    this.kick = Math.max(0, (this.kick || 0) - dt * 5);
    const twist = C && C.d.twist ? trackAt(C.d.twist, cu) : 0, dip = C && C.d.dip ? trackAt(C.d.dip, cu) : 0;
    this.group.rotation.set(-this.kick * 0.12, twist, 0);
    this.group.position.set(0, (1 - this.show) * -0.35 - dip - this.kick * 0.03, this.kick * 0.04);
    const v = this._tmp || (this._tmp = new Float32Array(9));
    this.hands.forEach((g, i) => {
      const s = g.userData.side, lead = s < 0;
      const G = block && !this.weaponKind ? FGUARD.block : this.hold ? FGUARD.hold : this.weaponKind && !lead ? FGUARD.weapon : lead ? FGUARD.lead : FGUARD.rear;
      for (let k = 0; k < 3; k++) for (let j = 0; j < 3; j++) v[k * 3 + j] = G[k][j];
      if (C && (C.d.hand === 'B' || (C.d.hand === 'L') === lead)) {
        const K = C.d.keys, n = K.length; let a = 0; while (a < n - 2 && cu > K[a + 1][0]) a++;
        const key = j => { const q = K[clamp(j, 0, n - 1)][1]; return q === 'G' ? G : q; };
        const k0 = key(a - 1), k1 = key(a), k2 = key(a + 1), k3 = key(a + 2), u = clamp((cu - K[a][0]) / Math.max(1e-4, K[Math.min(a + 1, n - 1)][0] - K[a][0]), 0, 1);
        for (let k = 0; k < 3; k++) for (let j = 0; j < 3; j++) v[k * 3 + j] = cr(k0[k][j], k1[k][j], k2[k][j], k3[k][j], u);
      }
      const bob = Math.sin(this.bob + i * Math.PI) * (moving ? 0.016 : 0.004) + (guard ? Math.sin(this.bob * 1.7 + i) * 0.004 : 0);
      g.position.set(s * v[0], v[1] + bob, v[2]);
      // Basis: forearm toward an elbow below the screen edge, back of the hand up and outward.
      this.E.set(s * v[3], v[4], v[5]).normalize();
      this.B.set(s * v[6], v[7], v[8]);
      this.B.addScaledVector(this.E, -this.B.dot(this.E)).normalize();
      this.Z.copy(this.B).negate();
      this.X.crossVectors(this.E, this.Z).normalize();
      this.m.makeBasis(this.X, this.E, this.Z);
      g.quaternion.setFromRotationMatrix(this.m);
    });
    if (this.weaponKind) {
      // The bat or pipe sweeps through the fist's frame: cocked back, through the target, follow-through.
      const sw = C && C.d.sweep ? trackAt(C.d.sweep, cu) : 0;
      this.weapon.position.set(0, -0.02, 0);
      this.weapon.quaternion.copy(this.weaponBase).premultiply(_EQ.setFromAxisAngle(V_FWD, -sw));
    }
  }
}

// Mission pickups: a holdall bag or a taped parcel, with a soft light beam to find them.
function itemProp(kind, color) {
  const root = new THREE.Group();
  const matBag = new THREE.MeshStandardMaterial({ color: kind === 'bag' ? 0x2a2a2c : 0x9b7a52, roughness: kind === 'bag' ? 0.75 : 0.9 });
  let body;
  if (kind === 'bag') { body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.42, 6, 12).rotateZ(Math.PI / 2), matBag); body.position.y = 0.2; }
  else { body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.32, 0.4), matBag); body.position.y = 0.16; const tape = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.33, 0.06), new THREE.MeshStandardMaterial({ color: 0xc9b98a, roughness: 0.4 })); tape.position.y = 0.16; root.add(tape); }
  body.castShadow = true; root.add(body);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 14, 16, 1, true), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uTime: G.uTime },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uColor; uniform float uTime; varying vec2 vUv; void main(){ float a = (1.0 - vUv.y) * (0.5 + 0.5 * sin(vUv.x * 6.2831 * 3.0 + uTime * 2.0)) * 0.22; gl_FragColor = vec4(uColor * a * 2.0, a); }',
  }));
  beam.position.y = 7; root.add(beam);
  return root;
}

// Realistic people: MakeHuman CC0 bodies, clothes and hair built by tools/people-build.py into
// assets/people/<look>.{bin,jpg,_n.jpg,_a.png}. Streamed after boot; stand-ins show until they load.
// Weapon meshes shared by the first-person view, the third-person body and pickups on the ground.
const WEAPON_DEF = { cricket: { name: 'cricket bat', dmg: 2.6, reach: 2.7, uses: 14 }, bat: { name: 'softball bat', dmg: 2.4, reach: 2.6, uses: 18 }, pipe: { name: 'steel pipe', dmg: 2.8, reach: 2.5, uses: 24 } };
function weaponMesh(kind) {
  const g = new THREE.Group(), wood = new THREE.MeshStandardMaterial({ color: 0xc8a46a, roughness: 0.6 }), grip = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 }), alu = new THREE.MeshStandardMaterial({ color: 0x9aa4ac, metalness: 0.85, roughness: 0.35 });
  if (kind === 'cricket') { const blade = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.56, 0.05), wood); blade.position.y = 0.42; const h = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.28, 8), grip); h.position.y = 0.0; g.add(blade, h); }
  else if (kind === 'bat') { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.014, 0.76, 10), alu); b.position.y = 0.3; const h = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.16, 8), grip); h.position.y = -0.1; g.add(b, h); }
  else { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.85, 8), new THREE.MeshStandardMaterial({ color: 0x6b6f72, metalness: 0.8, roughness: 0.5 })); p.position.y = 0.3; g.add(p); }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
  return g;
}
const PEOPLE = {
  enabled: true, cache: {}, bases: null,
  // Realistic first-person forearms/fists (tools/people-build.py -> people/fparms.bin), textured with the player atlas.
  fparms() {
    if (this._fp) return this._fp;
    return (this._fp = (async () => {
      const pl = await this.get('player'); if (!pl) return null;
      const buf = await this.fetchBin('people/fparms.bin'), dv = new DataView(buf), hl = dv.getUint32(4, true), head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, hl)));
      let o = 8 + hl; const take = (T, n, bytes) => { const a = new T(buf, o, n); o += Math.ceil(n * bytes / 4) * 4; return a; };
      const out = { material: new THREE.MeshStandardMaterial({ map: pl.material.map, normalMap: pl.material.normalMap, roughness: 0.62, metalness: 0 }) };
      for (const side of ['L', 'R']) {
        const h = head[side], pos = take(Float32Array, h.nV * 3, 4), n8 = take(Int8Array, h.nV * 3, 1), uv = take(Uint16Array, h.nV * 2, 2), ix = take(Uint16Array, h.nI, 2);
        const g = new THREE.BufferGeometry(), nor = new Float32Array(h.nV * 3); for (let i = 0; i < nor.length; i++) nor[i] = n8[i] / 127;
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(new Uint16Array(uv), 2, true));
        g.setIndex(new THREE.BufferAttribute(new Uint16Array(ix), 1)); g.computeBoundingSphere(); out[side] = g;
      }
      return out;
    })().catch(e => { console.info('First-person arms unavailable', e?.message); return null; }));
  },
  async fetchBin(path) {
    for (const b of this.bases) { try { const r = await fetch(b + path); if (r.ok) return await r.arrayBuffer(); } catch (_) { } }
    throw new Error('people asset unavailable: ' + path);
  },
  get(look) {
    if (!this.enabled) return Promise.resolve(null);
    this.bases = this.bases || assetBases();
    if (!this.bases.length) return Promise.resolve(null);
    return this.cache[look] || (this.cache[look] = this.load(look).catch(e => { console.info('Realistic people unavailable, keeping stand-ins.', e?.message); return null; }));
  },
  async load(look) {
    const tl = new THREE.TextureLoader();
    const tex = p => loadWithFallback(tl, p, this.bases);
    const [buf, map, normalMap, alphaMap] = await Promise.all([this.fetchBin(`people/${look}.bin`), tex(`people/${look}.jpg`), tex(`people/${look}_n.jpg`), tex(`people/${look}_a.png`)]);
    map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
    const dv = new DataView(buf), hl = dv.getUint32(4, true), head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, hl)));
    let o = 8 + hl;
    const take = (T, n, bytes) => { const a = new T(buf, o, n); o += Math.ceil(n * bytes / 4) * 4; return a; };
    const nV = head.nV, q = take(Int16Array, nV * 3, 2), n8 = take(Int8Array, nV * 4, 1), uv = take(Uint16Array, nV * 2, 2), si = take(Uint8Array, nV * 4, 1), sw = take(Uint8Array, nV * 4, 1), ix = take(Uint16Array, head.nI, 2);
    const pos = new Float32Array(nV * 3), nor = new Float32Array(nV * 3);
    for (let i = 0; i < nV; i++) { pos[i * 3] = q[i * 3] / 1000; pos[i * 3 + 1] = q[i * 3 + 1] / 1000; pos[i * 3 + 2] = q[i * 3 + 2] / 1000; nor[i * 3] = n8[i * 4] / 127; nor[i * 3 + 1] = n8[i * 4 + 1] / 127; nor[i * 3 + 2] = n8[i * 4 + 2] / 127; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2, true));
    g.setAttribute('skinIndex', new THREE.BufferAttribute(Uint16Array.from(si), 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4, true));
    g.setIndex(new THREE.BufferAttribute(ix, 1)); g.computeBoundingSphere();
    const material = new THREE.MeshStandardMaterial({ map, normalMap, normalScale: new THREE.Vector2(0.8, 0.8), alphaMap, alphaTest: 0.45, roughness: 0.68, metalness: 0, side: THREE.DoubleSide });
    material.alphaToCoverage = !!PEOPLE.msaa;
    material.name = 'person-' + look;
    return { geometry: g, material, joints: head.joints, height: head.height };
  },
};
