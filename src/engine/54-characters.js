// Procedural skinned humans. One SkinnedMesh (one draw call) per character, textured from a shared
// 4x4 canvas atlas, animated procedurally (walk, idle, guard, punch, hit, knockout).
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
    this.mesh = mesh; this.real = true;
  }
  punch() { this.punchT = 0.45; }
  hit() { this.hitT = 0.35; }
  knockDown() { this.downT = 0.0001; }
  reset() { this.downT = 0; this.hitT = 0; this.punchT = 0; this.mesh.rotation.set(0, 0, 0); this.mesh.position.set(0, 0, 0); }
  update(dt, t) {
    const B = this.bones, b = n => B[BONE[n]];
    for (const bone of B) bone.rotation.set(0, 0, 0);
    b('hips').position.copy(this.hipRest);
    if (this.downT > 0) {
      this.downT = Math.min(this.downT + dt, 3);
      const k = smoothstep(this.downT, 0, 0.55);
      this.mesh.rotation.x = -k * Math.PI / 2 * 0.98; this.mesh.position.y = k * 0.12; this.mesh.position.z = -k * 0.25;
      b('armL').rotation.z = k * 1.2; b('armR').rotation.z = -k * 1.2; b('head').rotation.x = k * 0.3;
      b('thighL').rotation.x = -k * 0.15; b('shinL').rotation.x = k * 0.4;
      return;
    }
    const sp = this.speed, walk = clamp(sp / 1.6, 0, 1), run = clamp((sp - 2.5) / 3, 0, 1);
    this.phase += dt * (sp > 0.05 ? 4.2 + sp * 1.25 : 0);
    const ph = this.phase, sw = Math.sin(ph), cw = Math.cos(ph);
    const breath = Math.sin(t * 1.6 + this.idleSeed) * 0.02;
    // Legs and arms swing opposite; knees bend on the recovering leg.
    const amp = 0.55 * walk + 0.35 * run;
    b('thighL').rotation.x = -sw * amp; b('thighR').rotation.x = sw * amp;
    b('shinL').rotation.x = Math.max(0, cw) * amp * 1.3 + 0.05; b('shinR').rotation.x = Math.max(0, -cw) * amp * 1.3 + 0.05;
    b('footL').rotation.x = -Math.max(0, -sw) * amp * 0.4; b('footR').rotation.x = -Math.max(0, sw) * amp * 0.4;
    b('hips').position.y = this.hipRest.y - Math.abs(cw) * 0.035 * walk - run * 0.05;
    b('hips').rotation.y = sw * 0.12 * walk; b('chest').rotation.y = -sw * 0.18 * walk;
    b('spine').rotation.x = 0.05 * walk + 0.15 * run + breath;
    let armL = sw * amp * 0.9, armR = -sw * amp * 0.9, foreL = -0.25 - 0.5 * run, foreR = -0.25 - 0.5 * run;
    b('armL').rotation.z = 0.12; b('armR').rotation.z = -0.12;
    if (this.pose === 'crossed' && sp < 0.1 && this.mode === 'idle') {
      // Forearms fold across the chest: swing about z to point across the body, then forward about y.
      armL = -0.4; armR = -0.4; foreL = 0; foreR = 0;
      b('armL').rotation.z = 0.06; b('armR').rotation.z = -0.06;
      b('foreL').rotation.set(0, 0.55, -1.72); b('foreR').rotation.set(0, -0.48, 1.68);
    }
    if (this.mode === 'guard') {
      armL = -0.9; armR = -0.75; foreL = -2.0; foreR = -2.1;
      b('armL').rotation.z = 0.35; b('armR').rotation.z = -0.35; b('spine').rotation.x += 0.12;
    }
    if (this.punchT > 0) {
      this.punchT = Math.max(0, this.punchT - dt);
      const p = Math.sin((1 - this.punchT / 0.45) * Math.PI);
      armR = lerp(armR, -1.55, p); foreR = lerp(foreR, -0.1, p); b('chest').rotation.y += p * 0.45; b('armR').rotation.z = -0.1;
    }
    b('armL').rotation.x = armL; b('armR').rotation.x = armR;
    b('foreL').rotation.x = foreL; b('foreR').rotation.x = foreR;
    // Idle weight shift and head look.
    if (sp < 0.1) { b('hips').rotation.z = Math.sin(t * 0.45 + this.idleSeed) * 0.03; b('thighL').rotation.z = -b('hips').rotation.z; b('thighR').rotation.z = -b('hips').rotation.z; }
    b('head').rotation.y = clamp(this.lookYaw, -1.1, 1.1) * 0.75; b('neck').rotation.y = clamp(this.lookYaw, -1.1, 1.1) * 0.25;
    b('head').rotation.x = Math.sin(t * 0.7 + this.idleSeed) * 0.04;
    if (this.pose === 'seated') this.seated(dt, t, b);
    // Jumping and climbing (the player's own body in third person).
    if (this.air) { b('thighL').rotation.x = -0.75; b('thighR').rotation.x = -0.45; b('shinL').rotation.x = 1.1; b('shinR').rotation.x = 0.8; b('armL').rotation.z = 0.55; b('armR').rotation.z = -0.55; }
    if (this.climbing) { b('armL').rotation.x = -2.7; b('armR').rotation.x = -2.7; b('foreL').rotation.x = -0.4; b('foreR').rotation.x = -0.4; b('thighL').rotation.x = -1.1; b('shinL').rotation.x = 1.3; }
    if (this.weapon && this.mode === 'guard') { b('armR').rotation.x = -0.6; b('foreR').rotation.x = -1.4; }
    if (this.hitT > 0) {
      this.hitT = Math.max(0, this.hitT - dt);
      const h = Math.sin(this.hitT / 0.35 * Math.PI);
      b('spine').rotation.x -= h * 0.35; b('head').rotation.x -= h * 0.5; b('armL').rotation.x -= h * 0.5; b('armR').rotation.x -= h * 0.4;
    }
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
    // A held weapon (cricket bat, softball bat, pipe) on the right, swung with the punch.
    this.weapon = new THREE.Group(); this.weapon.visible = false; this.group.add(this.weapon);
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
  swing() { const i = this.next; this.punch[i] = 1; this.next = 1 - i; this.raised = 1.2; }
  // Hands stay out of view until you swing or a fight is on; they slide up from below the frame.
  setWeapon(kind) {
    this.weapon.clear(); this.weaponKind = kind || null;
    if (kind) { const m = weaponMesh(kind); m.traverse(o => { if (o.isMesh) { o.renderOrder = 11; o.frustumCulled = false; } }); this.weapon.add(m); }
    this.weapon.visible = !!kind;
  }
  update(dt, moving, sprint, guard) {
    if (this.weaponKind) {
      // Bat held up off the right shoulder; a swing sweeps it across the view.
      const p = this.punch[0] > this.punch[1] ? this.punch[0] : this.punch[1], sw = p > 0 ? Math.sin((1 - p) * Math.PI) : 0;
      this.weapon.position.set(lerp(0.26, -0.05, sw), lerp(-0.32, -0.12, sw), lerp(-0.45, -0.7, sw));
      this.weapon.rotation.set(lerp(0.25, -1.1, sw), lerp(-0.3, 0.8, sw), lerp(-0.35, 1.25, sw));
      guard = true;
    }
    this.raised = Math.max(guard ? 1 : 0, (this.raised || 0) - dt);
    this.show = lerp(this.show || 0, this.raised > 0 ? 1 : 0, 1 - Math.exp(-dt * 10));
    this.group.visible = this.show > 0.02; this.group.position.y = (1 - this.show) * -0.35;
    this.bob += dt * (moving ? (sprint ? 13 : 9) : 1.6);
    this.hands.forEach((g, i) => {
      const s = g.userData.side;
      this.punch[i] = Math.max(0, this.punch[i] - dt * 3.6);
      const p = this.punch[i] > 0 ? Math.sin((1 - this.punch[i]) * Math.PI) : 0;
      const bob = Math.sin(this.bob + i * Math.PI) * (moving ? 0.016 : 0.004);
      g.position.set(s * lerp(0.19, 0.05, p), lerp(-0.2, -0.11, p) + bob, lerp(-0.37, -0.68, p));
      // Basis: forearm toward an elbow below the screen edge, back of the hand up and outward.
      this.E.set(s * lerp(0.22, 0.08, p), lerp(-0.72, -0.2, p), lerp(0.62, 1.0, p)).normalize();
      this.B.set(s * 0.35, 0.75, lerp(0.55, 0.1, p)).normalize();
      this.B.addScaledVector(this.E, -this.B.dot(this.E)).normalize();
      this.Z.copy(this.B).negate();
      this.X.crossVectors(this.E, this.Z).normalize();
      this.m.makeBasis(this.X, this.E, this.Z);
      g.quaternion.setFromRotationMatrix(this.m);
    });
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
