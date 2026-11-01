// Canvas textures, instanced street props, trees, parked cars, overhead wires and the hills backdrop.
function canvasTexture(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
const CANVAS_TEX = {
  picket: () => canvasTexture(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const px = 256 / 1.2; // pixels per metre
    g.fillStyle = '#f3f1ea';
    for (let i = 0; i < 8; i++) {
      const x = (i * 0.15 + 0.03) * px, pw = 0.09 * px, top = h - 1.0 * px;
      g.beginPath(); g.moveTo(x, h); g.lineTo(x, top + 10); g.lineTo(x + pw / 2, top); g.lineTo(x + pw, top + 10); g.lineTo(x + pw, h); g.fill();
    }
    g.fillRect(0, h - 0.75 * px, w, 0.06 * px); g.fillRect(0, h - 0.25 * px, w, 0.06 * px);
  }),
  chainlink: () => canvasTexture(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = '#b9bfc3'; g.lineWidth = 3;
    for (let i = -2; i < 6; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32 + 128, 128); g.stroke(); g.beginPath(); g.moveTo(i * 32 + 128, 0); g.lineTo(i * 32, 128); g.stroke(); }
  }),
  leaves: () => canvasTexture(512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const r = mulberry32(7);
    for (let i = 0; i < 950; i++) {
      const a = r() * TAU, d = Math.pow(r(), 0.6) * 236, x = 256 + Math.cos(a) * d, y = 256 + Math.sin(a) * d * 0.92;
      const l = 15 + r() * 17, gr = 85 + r() * 70, rr = 45 + r() * 45;
      g.fillStyle = `rgb(${rr},${gr},${25 + r() * 25})`;
      g.save(); g.translate(x, y); g.rotate(r() * TAU); g.beginPath(); g.ellipse(0, 0, l, l * 0.42, 0, 0, TAU); g.fill(); g.restore();
    }
  }),
  strap: () => canvasTexture(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const r = mulberry32(3);
    for (let i = 0; i < 70; i++) {
      const a = (i / 70) * TAU + r() * 0.1, len = 90 + r() * 38;
      g.strokeStyle = `rgb(${60 + r() * 40},${95 + r() * 50},${35 + r() * 20})`; g.lineWidth = 3 + r() * 2;
      g.beginPath(); g.moveTo(128, 128); g.quadraticCurveTo(128 + Math.cos(a) * len * 0.6, 128 + Math.sin(a) * len * 0.6 + 8, 128 + Math.cos(a) * len, 128 + Math.sin(a) * len + 18); g.stroke();
    }
  }),
  needles: () => canvasTexture(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const r = mulberry32(11);
    for (let i = 0; i < 900; i++) {
      const a = r() * TAU, d = Math.sqrt(r()) * 118, x = 128 + Math.cos(a) * d, y = 128 + Math.sin(a) * d;
      g.strokeStyle = `rgb(${20 + r() * 20},${45 + r() * 30},${25 + r() * 15})`; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 14, y + (r() - 0.5) * 14); g.stroke();
    }
  }),
};
Object.assign(MAT_DEFS, {
  picket: { canvas: 'picket', scale: 1.2, alphaTest: 0.5, side: 2, cast: 1 },
  chainlink: { canvas: 'chainlink', scale: 1.0, alphaTest: 0.4, side: 2 },
});
const _origGet = MaterialLib.prototype.get;
MaterialLib.prototype.get = function (key) {
  const d = MAT_DEFS[key];
  if (d && d.canvas && !this.cache[key]) {
    const tex = CANVAS_TEX[d.canvas]();
    const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, metalness: 0, vertexColors: !d.signs, alphaTest: d.alphaTest || 0 });
    if (d.alphaTest && this.q.msaa) m.alphaToCoverage = true;
    if (d.side === 2) m.side = THREE.DoubleSide;
    if (d.emissive) { m.emissiveMap = tex; this.addNightEmissive(m, d, key); }
    m.userData.cast = !!d.cast; m.name = key;
    return (this.cache[key] = m);
  }
  return _origGet.call(this, key);
};

// Builds a small merged geometry from GeoBuilder primitives for use as an instanced prototype.
function protoGeometry(lib, fn) {
  const b = new GeoBuilder(lib); fn(b);
  const parts = {};
  for (const bk of b.buckets.values()) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(bk.pos.view().slice(), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(bk.nor.view().slice(), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(bk.uv.view().slice(), 2));
    g.setAttribute('color', new THREE.BufferAttribute(bk.col.view().slice(), 3));
    g.setIndex(new THREE.BufferAttribute(bk.idx.view().slice(), 1));
    (parts[bk.key] = parts[bk.key] || []).push(g);
  }
  const out = {};
  for (const k in parts) out[k] = parts[k].length > 1 ? mergeGeo(parts[k]) : parts[k][0];
  return out;
}
function mergeGeo(list) {
  let n = 0, idx = 0; for (const g of list) { n += g.attributes.position.count; idx += g.index.count; }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), colA = new Float32Array(n * 3), ind = new Uint32Array(idx);
  let o = 0, io = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); uv.set(g.attributes.uv.array, o * 2); colA.set(g.attributes.color.array, o * 3);
    const gi = g.index.array; for (let i = 0; i < gi.length; i++) ind[io + i] = gi[i] + o;
    o += g.attributes.position.count; io += gi.length;
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  m.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); m.setAttribute('color', new THREE.BufferAttribute(colA, 3));
  m.setIndex(new THREE.BufferAttribute(ind, 1));
  return m;
}
function instanced(scene, geometry, material, placements, matrixFn, opts = {}) {
  if (!placements.length) return null;
  // Split into 200 m cells for distance culling; each cell is one InstancedMesh.
  if (!opts.noSplit && placements.length > 24) {
    const cells = new Map(), cs = opts.cell || 300;
    for (const p of placements) { const k = Math.floor(p.x / cs) + ',' + Math.floor(p.z / cs); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(p); }
    if (cells.size > 1) { let last = null; for (const list of cells.values()) last = instanced(scene, geometry, material, list, matrixFn, { ...opts, noSplit: true }); return last; }
  }
  const mesh = new THREE.InstancedMesh(geometry, material, placements.length);
  mesh.userData.cull = CULL_DIST[opts.cullClass || 'props'];
  const m = new THREE.Matrix4();
  placements.forEach((p, i) => { matrixFn(m, p); mesh.setMatrixAt(i, m); if (opts.color) mesh.setColorAt(i, opts.color(p)); });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = opts.cast ?? true; mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  scene.add(mesh);
  return mesh;
}
const placeMatrix = (m, p) => m.compose(new THREE.Vector3(p.x, p.y || 0, p.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rot || 0), new THREE.Vector3(p.s || 1, p.s || 1, p.s || 1));

class PropBuilder {
  constructor(lib, scene, city, quality) { this.lib = lib; this.scene = scene; this.city = city; this.q = quality; }
  build() {
    this.streetFurniture();
    this.trees();
    this.cars();
    this.wires();
    this.hills();
  }
  addProto(name, placements, fn, opts) {
    const parts = protoGeometry(this.lib, fn);
    for (const key in parts) instanced(this.scene, parts[key], this.lib.get(key), placements, placeMatrix, { cast: this.lib.get(key).userData.cast, ...opts });
  }
  streetFurniture() {
    const I = this.city.instances;
    this.addProto('streetlight', I.streetlight || [], b => {
      b.cylinder('steel', 0, 0, 0, 0.11, 0.07, 7.8, 8, { ao: 1 });
      b.box('steel', 0, 7.55, 1.05, 0.08, 0.08, 2.1);
      b.box('steel', 0, 7.45, 2.1, 0.34, 0.14, 0.7);
      b.box('lamp', 0, 7.42, 2.1, 0.26, 0.03, 0.55, { faces: 'y' });
      b.box('concrete', 0, 0, 0, 0.36, 0.25, 0.36);
    });
    const poles = I.pole || [];
    this.addProto('pole', poles, b => {
      b.cylinder('timber', 0, 0, 0, 0.17, 0.12, 10.2, 8, { cap: true });
      b.box('timber', 0, 9.3, 0, 0.12, 0.12, 2.0);
      for (const z of [-0.85, -0.3, 0.3, 0.85]) b.cylinder('white', 0, 9.42, z, 0.04, 0.035, 0.16, 6, { cap: true, tint: [0.9, 0.9, 0.88] });
    });
    this.addProto('poleLight', poles.filter(p => p.light), b => {
      b.box('steel', 0, 8.3, 0.95, 0.07, 0.07, 1.9);
      b.box('steel', 0, 8.2, 1.9, 0.3, 0.13, 0.6);
      b.box('lamp', 0, 8.17, 1.9, 0.24, 0.03, 0.48, { faces: 'y' });
    });
    this.addProto('plazaLamp', I.plazaLamp || [], b => {
      b.cylinder('darkMetal', 0, 0, 0, 0.13, 0.08, 3.6, 8, { cap: true });
      b.cylinder('darkMetal', 0, 0, 0, 0.22, 0.18, 0.5, 8, { cap: true });
      b.cylinder('lamp', 0, 3.65, 0, 0.2, 0.26, 0.5, 8, { cap: true });
      b.cylinder('darkMetal', 0, 4.15, 0, 0.3, 0.05, 0.25, 8, { cap: true });
    });
    this.addProto('zebraPost', I.zebraPost || [], b => {
      for (let i = 0; i < 6; i++) b.cylinder('trim', 0, i * 0.5, 0, 0.055, 0.055, 0.5, 8, { tint: i % 2 ? [0.05, 0.05, 0.05] : [0.92, 0.92, 0.9] });
      b.cylinder('neon', 0, 3.0, 0, 0.22, 0.22, 0.4, 10, { cap: true, tint: [1, 0.45, 0.05] });
    });
    // Letterboxes: three common NZ styles (painted box on a post, brick pillar, steel drum).
    const lbs = I.letterbox || [];
    this.addProto('letterbox0', lbs.filter(p => p.v === 0), b => { b.box('timber', 0, 0, 0, 0.09, 1.0, 0.09); b.box('trim', 0, 1.0, 0, 0.36, 0.3, 0.46, { tint: [0.85, 0.2, 0.15] }); });
    this.addProto('letterbox1', lbs.filter(p => p.v === 1), b => { b.box('brick', 0, 0, 0, 0.45, 1.15, 0.45); b.box('darkMetal', 0, 0.8, -0.23, 0.3, 0.2, 0.02); });
    this.addProto('letterbox2', lbs.filter(p => p.v === 2), b => { b.box('steel', 0, 0, 0, 0.06, 0.95, 0.06); b.cylinder('trim', 0, 0.95, 0, 0.18, 0.18, 0.3, 10, { cap: true, tint: [0.2, 0.32, 0.55] }); });
    // Auckland Transport bus stop flag and shelter.
    this.addProto('busSign', I.busSign || [], b => { b.cylinder('steel', 0, 0, 0, 0.04, 0.04, 2.9, 6, { cap: true }); b.box('trim', 0.22, 2.25, 0, 0.42, 0.6, 0.03, { tint: [0.05, 0.3, 0.62] }); b.box('trim', 0.22, 2.42, 0.017, 0.36, 0.12, 0.005, { tint: [1, 1, 1] }); b.box('trim', 0.22, 2.06, 0.017, 0.3, 0.06, 0.005, { tint: [1, 0.8, 0.1] }); });
    this.addProto('busShelter', I.busShelter || [], b => {
      for (const x of [-1.7, 1.7]) for (const z of [-0.5, 0.5]) b.box('darkMetal', x, 0, z, 0.08, 2.5, 0.08);
      b.box('trim', 0, 2.5, 0, 3.8, 0.1, 1.4, { tint: [0.2, 0.22, 0.24] });
      b.box('glassRoof', 0, 0.15, 0.5, 3.4, 2.2, 0.02); b.box('glassRoof', -1.7, 0.15, 0, 0.02, 2.2, 0.95);
      b.box('timber', 0, 0.45, 0.25, 2.4, 0.06, 0.35);
    });
    this.addProto('signal', I.signal || [], b => { b.cylinder('darkMetal', 0, 0, 0, 0.07, 0.07, 3.3, 8, { cap: true }); b.box('trim', 0, 2.3, 0.12, 0.34, 1.0, 0.22, { tint: [0.95, 0.75, 0.05] }); b.box('rubber', 0, 2.38, 0.24, 0.24, 0.82, 0.02); for (const [y, c] of [[3.0, [1, 0.1, 0.05]], [2.72, [1, 0.6, 0.05]], [2.44, [0.1, 1, 0.3]]]) b.cylinder('trim', 0, y, 0.26, 0.09, 0.09, 0.02, 10, { tint: c.map(v => v * 0.6) }); });
    this.addProto('goalpost', I.goalpost || [], b => { for (const x of [-2.8, 2.8]) { b.cylinder('white', x, 0, 0, 0.08, 0.07, 12, 8, { cap: true }); b.cylinder('trim', x, 0, 0, 0.25, 0.25, 1.8, 10, { cap: true, tint: [0.1, 0.3, 0.7] }); } b.box('white', 0, 3.0, 0, 5.6, 0.12, 0.12); });
    this.addProto('hoop', I.hoop || [], b => { b.cylinder('darkMetal', 0, 0, -0.9, 0.06, 0.06, 3.0, 8, { cap: true }); b.box('darkMetal', 0, 2.95, -0.45, 0.06, 0.06, 0.9); b.box('white', 0, 2.75, 0, 1.6, 1.0, 0.04); b.cylinder('trim', 0, 3.05, 0.3, 0.23, 0.23, 0.02, 12, { tint: [0.9, 0.3, 0.05] }); });
    this.addProto('sleeper', I.sleeper || [], b => b.box('concrete', 0, 0, 0, 2.2, 0.16, 0.24, { tint: [0.65, 0.63, 0.6] }));
    this.addProto('mast', I.mast || [], b => { b.box('steel', 0, 0, 0, 0.25, 7.2, 0.25); b.box('steel', 0, 6.4, -1.8, 0.08, 0.08, 3.6); b.box('steel', 0, 5.6, -1.6, 0.06, 0.06, 3.2); b.cylinder('white', 0, 5.7, -3.2, 0.06, 0.06, 0.4, 6); });
    const bins = I.bin || [];
    this.addProto('bin', bins, b => {
      b.box('trim', 0, 0, 0, 0.58, 1.0, 0.72, { tint: [0.16, 0.17, 0.18] });
      b.cylinder('rubber', -0.25, 0.1, -0.3, 0.1, 0.1, 0.05, 8, { cap: true });
    });
    for (const lid of [0, 1]) this.addProto('binLid', bins.filter(p => p.lid === lid), b => b.box('trim', 0, 1.0, 0, 0.62, 0.06, 0.78, { tint: lid ? [0.85, 0.65, 0.08] : [0.6, 0.08, 0.06] }));
  }

  // ---------------------------------------------------------------- trees
  treeMaterial(tex, key) {
    if (this.lib.cache[key]) return this.lib.cache[key];
    const m = new THREE.MeshStandardMaterial({ map: CANVAS_TEX[tex](), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.82, metalness: 0 });
    if (this.q.msaa) m.alphaToCoverage = true;
    patchMaterial(m, 'foliage', s => {
      // Keep canopies solid at distance (mipmaps average alpha away) and let low sun glow through leaves.
      s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\n' + fragUniforms('uSunDir'))
        .replace('#include <map_fragment>', `#include <map_fragment>
          float lod = max(0.0, log2(max(length(dFdx(vMapUv * 512.0)), length(dFdy(vMapUv * 512.0)))));
          diffuseColor.a *= 1.0 + lod * 0.38;`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          vec3 sunV = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
          float through = pow(max(dot(normalize(-vViewPosition), sunV), 0.0), 3.0);
          totalEmissiveRadiance += diffuseColor.rgb * (vec3(1.0, 0.86, 0.6) * through * 1.6 + vec3(0.05, 0.06, 0.05));`);
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uWind;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float ph = 0.0;
          #ifdef USE_INSTANCING
            ph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.23;
          #endif
          float sway = max(position.y - 1.5, 0.0) * 0.022 * (0.4 + uWind);
          transformed.x += sin(uTime * 1.3 + ph + position.y * 0.4) * sway;
          transformed.z += cos(uTime * 1.1 + ph * 1.3 + position.x) * sway * 0.8;
          transformed += normal * sin(uTime * 3.1 + position.x * 3.0 + position.z * 2.0 + ph) * 0.03 * uWind;`);
    });
    m.userData.cast = true;
    return (this.lib.cache[key] = m);
  }
  // Leaf card: three crossed quads around a centre, normals pushed outward from the canopy centre.
  leafCard(pos, nor, uv, idx, c, size, canopy, rnd, aspect = 1) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * TAU, rnd() * TAU, rnd() * TAU));
    for (let k = 0; k < 3; k++) {
      const axisA = new THREE.Vector3(...[[1, 0, 0], [0, 1, 0], [0, 0, 1]][k]).applyQuaternion(q);
      const axisB = new THREE.Vector3(...[[0, 1, 0], [0, 0, 1], [1, 0, 0]][k]).applyQuaternion(q);
      const base = pos.length / 3;
      for (const [a, bb, u, v] of [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]]) {
        const p = c.clone().addScaledVector(axisA, a * size / 2).addScaledVector(axisB, bb * size * aspect / 2);
        pos.push(p.x, p.y, p.z);
        const n = p.clone().sub(canopy).normalize(); nor.push(n.x, n.y, n.z);
        uv.push(u, v);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  treeProto(kind, seed) {
    const rnd = mulberry32(seed), lib = this.lib;
    const leaves = { pos: [], nor: [], uv: [], idx: [] };
    const bark = protoGeometry(lib, b => {
      const branch = (x, y, z, dx, dy, dz, len, r0, r1, seg = 6) => {
        const dir = new THREE.Vector3(dx, dy, dz).normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1));
        b.setTransform(m); b.cylinder('bark', 0, 0, 0, r0, r1, len, seg); b.setTransform(null);
        return new THREE.Vector3(x, y, z).addScaledVector(dir, len);
      };
      if (kind === 'broad') {
        const h = 2.0 + rnd() * 0.8;
        branch(0, 0, 0, 0, 1, 0, h + 0.3, 0.2, 0.15, 8);
        const canopy = new THREE.Vector3(0, h + 2.6, 0);
        const n = 4 + Math.floor(rnd() * 2);
        for (let i = 0; i < n; i++) {
          const a = i / n * TAU + rnd() * 0.5, lean = 0.6 + rnd() * 0.5;
          const tip = branch(0, h, 0, Math.cos(a) * lean, 1, Math.sin(a) * lean, 2.4 + rnd(), 0.12, 0.06);
          for (let j = 0; j < 2; j++) {
            const a2 = a + (rnd() - 0.5) * 1.6;
            const tip2 = branch(tip.x, tip.y, tip.z, Math.cos(a2) * 0.8, 0.9, Math.sin(a2) * 0.8, 1.2 + rnd() * 0.8, 0.06, 0.03, 5);
            for (let k = 0; k < 3; k++) this.leafCard(leaves.pos, leaves.nor, leaves.uv, leaves.idx, tip2.clone().add(new THREE.Vector3((rnd() - 0.5) * 1.6, (rnd() - 0.3) * 1.2, (rnd() - 0.5) * 1.6)), 1.9 + rnd() * 0.8, canopy, rnd);
          }
        }
        for (let k = 0; k < 10; k++) {
          const a = rnd() * TAU, d = rnd() * 2.2;
          this.leafCard(leaves.pos, leaves.nor, leaves.uv, leaves.idx, canopy.clone().add(new THREE.Vector3(Math.cos(a) * d, (rnd() - 0.2) * 1.6, Math.sin(a) * d)), 2.2 + rnd(), canopy, rnd);
        }
      } else if (kind === 'cabbage') {
        const h = 1.6 + rnd() * 1.2, top = branch(0, 0, 0, (rnd() - 0.5) * 0.2, 1, (rnd() - 0.5) * 0.2, h, 0.16, 0.12, 7);
        const n = 2 + Math.floor(rnd() * 3);
        for (let i = 0; i < n; i++) {
          const a = i / n * TAU + rnd(), len = 1.2 + rnd() * 1.4;
          const tip = branch(top.x, top.y, top.z, Math.cos(a) * 0.35, 1, Math.sin(a) * 0.35, len, 0.1, 0.07, 6);
          const tuft = tip.clone().add(new THREE.Vector3(0, 0.35, 0));
          for (let k = 0; k < 3; k++) this.leafCard(leaves.pos, leaves.nor, leaves.uv, leaves.idx, tuft, 1.7 + rnd() * 0.4, tip, rnd);
        }
      } else {
        const h = 9 + rnd() * 4;
        branch(0, 0, 0, 0, 1, 0, h * 0.7, 0.32, 0.15, 8);
        const canopy = new THREE.Vector3(0, h * 0.55, 0);
        for (let k = 0; k < 26; k++) {
          const y = 1.5 + rnd() * (h - 1.5), rr = Math.sin(Math.min(1, (h - y) / h * 1.4) * Math.PI * 0.5) * 3.2 * (0.6 + rnd() * 0.4), a = rnd() * TAU;
          this.leafCard(leaves.pos, leaves.nor, leaves.uv, leaves.idx, new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr), 2.6 + rnd() * 1.2, canopy, rnd);
        }
      }
    });
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(leaves.pos, 3));
    lg.setAttribute('normal', new THREE.Float32BufferAttribute(leaves.nor, 3));
    lg.setAttribute('uv', new THREE.Float32BufferAttribute(leaves.uv, 2));
    lg.setIndex(leaves.idx);
    return { bark: bark.bark, leaves: lg };
  }
  trees() {
    const tex = { broad: 'leaves', cabbage: 'strap', conifer: 'needles' };
    for (const kind of ['broad', 'cabbage', 'conifer']) {
      const all = this.city.trees.filter(t => t.kind === kind);
      for (let v = 0; v < 2; v++) {
        const list = all.filter((_, i) => i % 2 === v).map(t => ({ ...t, rot: (t.x * 13.1 + t.z * 7.7) % TAU }));
        if (!list.length) continue;
        const proto = this.treeProto(kind, 101 + v * 17 + kind.length);
        instanced(this.scene, proto.bark, this.lib.get('bark'), list, placeMatrix, { cast: true, cullClass: 'trees', cell: 450 });
        const lm = this.treeMaterial(tex[kind], 'leaf-' + kind);
        const tint = { broad: 0xffffff, cabbage: 0xe8f0d0, conifer: 0xc8d4c0 }[kind];
        instanced(this.scene, proto.leaves, lm, list, placeMatrix, { cast: true, cullClass: 'trees', cell: 450, color: p => new THREE.Color(tint).multiplyScalar(0.85 + ((p.x * 3.3 + p.z) % 1 + 1) % 1 * 0.3) });
      }
    }
  }

  // ---------------------------------------------------------------- cars
  carProto(type) {
    const P = [
      { L: 4.0, W: 1.74, body: [[0, .32], [0, .95], [.15, 1.05], [.32, 1.43], [1.0, 1.5], [2.3, 1.48], [3.05, 1.0], [3.9, .86], [4.0, .62], [4.0, .32]], glass: [[.17, 1.07], [.34, 1.45], [2.3, 1.45], [3.09, 1.0]], wb: [.72, 3.28] },
      { L: 4.6, W: 1.78, body: [[0, .34], [0, .95], [.1, 1.02], [.85, 1.06], [1.35, 1.44], [2.9, 1.45], [3.55, 1.0], [4.5, .86], [4.6, .62], [4.6, .34]], glass: [[.83, 1.06], [1.36, 1.46], [2.9, 1.46], [3.59, 1.0]], wb: [.9, 3.65] },
      { L: 5.2, W: 1.85, body: [[0, .45], [0, 1.08], [1.9, 1.08], [1.95, 1.12], [2.25, 1.8], [3.4, 1.82], [3.95, 1.18], [5.1, 1.02], [5.2, .7], [5.2, .45]], glass: [[2.1, 1.12], [2.28, 1.83], [3.4, 1.83], [3.99, 1.18]], wb: [1.0, 4.15] },
      { L: 4.7, W: 1.86, body: [[0, .42], [0, 1.05], [.05, 1.6], [.3, 1.74], [3.1, 1.74], [3.7, 1.15], [4.6, 1.02], [4.7, .7], [4.7, .42]], glass: [[.02, 1.08], [.29, 1.76], [3.1, 1.76], [3.74, 1.15]], wb: [.85, 3.75] },
    ][type];
    const shape = pts => { const s = new THREE.Shape(); pts.forEach((p, i) => i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])); s.closePath(); return s; };
    const orient = g => { g.translate(-P.L / 2, 0, -P.W / 2); g.rotateY(-Math.PI / 2); return g; };
    const bevel = 0.05;
    const body = new THREE.ExtrudeGeometry(shape(P.body), { depth: P.W - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: 0.04, bevelSegments: 2, curveSegments: 4 });
    body.translate(0, 0, bevel);
    const glass = new THREE.ExtrudeGeometry(shape(P.glass), { depth: P.W + 0.03, bevelEnabled: false });
    glass.translate(0, 0, -0.015);
    const wheels = [], rims = [];
    for (const x of P.wb) for (const z of [0.16, P.W - 0.16]) {
      const t = new THREE.CylinderGeometry(0.33, 0.33, 0.22, 16); t.rotateX(Math.PI / 2); t.translate(x, 0.33, z); wheels.push(t);
      const r = new THREE.CylinderGeometry(0.21, 0.21, 0.235, 12); r.rotateX(Math.PI / 2); r.translate(x, 0.33, z); rims.push(r);
    }
    const lights = [], tails = [];
    for (const z of [0.28, P.W - 0.28]) {
      const h = new THREE.BoxGeometry(0.06, 0.13, 0.32); h.translate(P.L - 0.01, P.body[P.body.length - 2][1] + 0.06, z); lights.push(h);
      const t = new THREE.BoxGeometry(0.06, 0.16, 0.3); t.translate(0.01, P.body[1][1] - 0.05, z); tails.push(t);
    }
    const trim = [new THREE.BoxGeometry(0.12, 0.2, P.W + 0.04), new THREE.BoxGeometry(0.12, 0.2, P.W + 0.04)];
    trim[0].translate(-0.02, P.body[0][1] + 0.05, P.W / 2); trim[1].translate(P.L + 0.02, P.body[0][1] + 0.05, P.W / 2);
    const merge = list => { const g = list.map(x => x.index ? x.toNonIndexed() : x); return orient(mergeNonIndexed(g)); };
    const flat = g => g.index ? g.toNonIndexed() : g;
    return { body: orient(flat(body)), glass: orient(flat(glass)), tires: merge(wheels), rims: merge(rims), lights: merge(lights), tails: merge(tails), trim: merge(trim) };
  }
  cars() {
    const paints = [0xf2f2f0, 0xf2f2f0, 0xf2f2f0, 0xb8bcc0, 0xb8bcc0, 0x6e7276, 0x6e7276, 0x15171a, 0x15171a, 0x1f3f78, 0x8a1414, 0x3a4a3a, 0x7a6a4a, 0xc8b89a];
    const physical = this.q.post && this.q.msaa;
    const paint = physical
      ? new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.45, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.06 })
      : new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.5, roughness: 0.3 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x0a0d10, metalness: 0.1, roughness: 0.05 });
    const tyre = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.92 });
    const rim = new THREE.MeshStandardMaterial({ color: 0xb4b9bc, metalness: 0.9, roughness: 0.3 });
    const plastic = new THREE.MeshStandardMaterial({ color: 0x1b1c1d, roughness: 0.7 });
    const lights = new THREE.MeshStandardMaterial({ color: 0xe8e4dc, metalness: 0.2, roughness: 0.15, vertexColors: false });
    const tail = new THREE.MeshStandardMaterial({ color: 0x8a0f0f, roughness: 0.2 });
    for (let type = 0; type < 4; type++) {
      const list = this.city.cars.filter(c => c.type === type).map(c => ({ ...c, y: c.y || 0 }));
      if (!list.length) continue;
      const p = this.carProto(type);
      const C = { cullClass: 'cars', cell: 300 };
      instanced(this.scene, p.body, paint, list, placeMatrix, { ...C, color: c => new THREE.Color(paints[Math.floor(c.color * paints.length)]) });
      // Glass, tyres, rims, lamps and trim share one vertex-coloured material: two draw calls per car type.
      const colored = (g, hex) => { const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); if (g.attributes.uv) g.deleteAttribute('uv'); return g; };
      const rest = mergeNonIndexedColored([colored(p.glass, 0x0a0d10), colored(p.tires, 0x141414), colored(p.rims, 0xb4b9bc), colored(p.lights, 0xe8e4dc), colored(p.tails, 0x8a0f0f), colored(p.trim, 0x1b1c1d)]);
      instanced(this.scene, rest, this.carRest || (this.carRest = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.35 })), list, placeMatrix, C);
    }
  }

  wires() {
    const pos = [], nor = [], idx = [];
    const sag = 0.55, w = 0.018;
    for (const [a, b] of this.city.poles) {
      const dir = new THREE.Vector3(b.x - a.x, 0, b.z - a.z), len = dir.length(); if (len > 90 || len < 2) continue;
      dir.normalize();
      const side = new THREE.Vector3(-dir.z, 0, dir.x);
      for (const off of [-0.85, -0.3, 0.3, 0.85]) {
        const pa = new THREE.Vector3(a.x, ROAD.kerbH + 9.55, a.z).addScaledVector(side, off), pb = new THREE.Vector3(b.x, ROAD.kerbH + 9.55, b.z).addScaledVector(side, off);
        const N = 10;
        for (let i = 0; i < N; i++) {
          const f0 = i / N, f1 = (i + 1) / N;
          const p0 = pa.clone().lerp(pb, f0); p0.y -= sag * 4 * f0 * (1 - f0);
          const p1 = pa.clone().lerp(pb, f1); p1.y -= sag * 4 * f1 * (1 - f1);
          for (const o of [side.clone().multiplyScalar(w), new THREE.Vector3(0, w, 0)]) {
            const base = pos.length / 3;
            for (const q of [p0.clone().sub(o), p1.clone().sub(o), p1.clone().add(o), p0.clone().add(o)]) pos.push(q.x, q.y, q.z);
            for (let k = 0; k < 4; k++) nor.push(0, 1, 0);
            idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
          }
        }
      }
    }
    if (!pos.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.6, side: THREE.DoubleSide }));
    mesh.matrixAutoUpdate = false; mesh.frustumCulled = true; this.scene.add(mesh);
  }

  // Regional backdrop seen from Manurewa: the Hunua Ranges to the south-east, low hills south and east,
  // the Manukau Harbour's Pahurehure Inlet to the west and Mangere Mountain far to the north-west.
  hills() {
    const C = MAPDATA.meta.crop, cx = (C.x0 + C.x1) / 2, cz = (C.z0 + C.z1) / 2;
    const segs = 180, rings = 10, pos = [], colArr = [], idx = [];
    const azDeg = a => ((90 - a * 180 / Math.PI) % 360 + 360) % 360; // math angle in xz (x east, z south) -> compass bearing
    const bump = (az, c, w) => { let d = Math.abs(az - c); d = Math.min(d, 360 - d); return Math.max(0, 1 - d / w); };
    const profile = az => 30 + 170 * Math.pow(bump(az, 140, 45), 1.2) + 60 * bump(az, 95, 30) + 45 * bump(az, 190, 30) + 70 * Math.pow(bump(az, 318, 6), 0.7) + 25 * bump(az, 30, 40);
    const water = az => bump(az, 255, 55) > 0.35;
    for (let j = 0; j <= rings; j++) {
      const t = j / rings, rad = 2300 + Math.pow(t, 1.4) * 3200;
      for (let i = 0; i <= segs; i++) {
        const a = i / segs * TAU, ex = Math.cos(a), ez = Math.sin(a), az = (Math.atan2(ex, -ez) * 180 / Math.PI + 360) % 360;
        const rough = 0.85 + 0.15 * Math.sin(a * 23 + j * 1.7) * Math.sin(a * 7 - j);
        const h = water(az) && j < rings * 0.6 ? -0.4 : j === 0 ? -0.3 : Math.pow(t, 0.9) * profile(az) * rough;
        pos.push(cx + ex * rad, h, cz + ez * rad);
        const forest = bump(az, 140, 40) > 0.2 && t > 0.4;
        const c = water(az) && j < rings * 0.6 ? new THREE.Color(0.16, 0.24, 0.27) : new THREE.Color(0.19, 0.27, 0.13).lerp(new THREE.Color(0.08, 0.14, 0.08), forest ? 0.8 : 0.2).multiplyScalar(0.85 + 0.25 * t);
        colArr.push(c.r, c.g, c.b);
      }
    }
    for (let j = 0; j < rings; j++) for (let i = 0; i < segs; i++) { const a = j * (segs + 1) + i, b = a + segs + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colArr, 3));
    g.setIndex(idx); g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    mesh.matrixAutoUpdate = false; mesh.receiveShadow = false; mesh.frustumCulled = false;
    this.scene.add(mesh);
    // Lawn apron under the playable area and the context ring of real streets around it.
    const apron = new THREE.Mesh(new THREE.CircleGeometry(2400, 64), this.lib.get('grass'));
    apron.rotation.x = -Math.PI / 2; apron.position.set(cx, -0.04, cz); apron.updateMatrix(); apron.matrixAutoUpdate = false; apron.receiveShadow = true;
    const ag = apron.geometry, cols = new Float32Array(ag.attributes.position.count * 3).fill(0.92);
    ag.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const uvs = ag.attributes.uv; for (let i = 0; i < uvs.count; i++) uvs.setXY(i, ag.attributes.position.getX(i) / 2.5, ag.attributes.position.getY(i) / 2.5);
    this.scene.add(apron);
  }
}
function mergeNonIndexedColored(list) {
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), colA = new Float32Array(n * 3);
  let o = 0;
  for (const g of list) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); colA.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); m.setAttribute('color', new THREE.BufferAttribute(colA, 3));
  return m;
}
function mergeNonIndexed(list) {
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    o += g.attributes.position.count;
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); m.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return m;
}
