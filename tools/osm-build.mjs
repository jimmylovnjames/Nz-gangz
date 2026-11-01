// Real-map pipeline: OpenStreetMap extract (Overpass JSON) -> compact map data embedded in the game.
// Usage: node tools/osm-build.mjs <overpass.json> [out.js]
// Map data © OpenStreetMap contributors (ODbL). Building outlines in NZ come from the LINZ import (CC BY 4.0).
import fs from 'node:fs';
import ClipperLib from 'clipper-lib';
import earcut from 'earcut';
import { Delaunay } from 'd3-delaunay';

const SRC = process.argv[2], OUT = process.argv[3] || new URL('../src/engine/05-mapdata.js', import.meta.url).pathname;
const LAT0 = -37.0275, LON0 = 174.8815;           // local origin, between Clendon and Manurewa town centre
const CROP = { x0: -1650, x1: 1750, z0: -850, z1: 960 };
const TILE = 200, KERB = 0.3;
const KX = 111320 * Math.cos(LAT0 * Math.PI / 180), KZ = 110574;
const proj = n => [(n.lon - LON0) * KX, -(n.lat - LAT0) * KZ];
const inCrop = (p, m = 0) => p[0] > CROP.x0 - m && p[0] < CROP.x1 + m && p[1] > CROP.z0 - m && p[1] < CROP.z1 + m;
const S = 100; // clipper integer scale (cm)
const CL = ClipperLib;

// ---------------------------------------------------------------- load
const raw = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const nodes = new Map(), ways = [], rels = [];
for (const e of raw.elements) {
  if (e.type === 'node') { const prev = nodes.get(e.id); nodes.set(e.id, { id: e.id, p: proj(e), tags: { ...(prev?.tags || {}), ...(e.tags || {}) } }); }
  else if (e.type === 'way') ways.push(e);
  else if (e.type === 'relation') rels.push(e);
}
const wayById = new Map(ways.map(w => [w.id, w]));
const ptsOf = w => w.nodes.map(id => nodes.get(id)?.p).filter(Boolean);
const closed = w => w.nodes.length > 3 && w.nodes[0] === w.nodes[w.nodes.length - 1];
console.log('nodes', nodes.size, 'ways', ways.length);

// ---------------------------------------------------------------- clipper helpers
const toPath = pts => pts.map(p => ({ X: Math.round(p[0] * S), Y: Math.round(p[1] * S) }));
const fromPath = path => path.map(q => [q.X / S, q.Y / S]);
function offsetOpen(lines, delta, endType = CL.EndType.etOpenRound) {
  const co = new CL.ClipperOffset(2, 0.12 * S); const out = new CL.Paths();
  for (const l of lines) if (l.length >= 2) co.AddPath(toPath(l), CL.JoinType.jtRound, endType);
  co.Execute(out, delta * S); return out;
}
function offsetPaths(paths, delta, join = CL.JoinType.jtRound) {
  const co = new CL.ClipperOffset(2, 0.12 * S); const out = new CL.Paths();
  co.AddPaths(paths, join, CL.EndType.etClosedPolygon); co.Execute(out, delta * S); return out;
}
function bool(type, subj, clip) {
  const c = new CL.Clipper(); const out = new CL.Paths();
  c.AddPaths(subj, CL.PolyType.ptSubject, true); if (clip?.length) c.AddPaths(clip, CL.PolyType.ptClip, true);
  c.Execute(type, out, CL.PolyFillType.pftNonZero, CL.PolyFillType.pftNonZero); return out;
}
const union = (a, b = []) => bool(CL.ClipType.ctUnion, a, b);
const diff = (a, b) => bool(CL.ClipType.ctDifference, a, b);
const inter = (a, b) => bool(CL.ClipType.ctIntersection, a, b);
const close = (paths, r) => offsetPaths(offsetPaths(paths, r), -r);
const clean = paths => CL.Clipper.CleanPolygons(paths, 0.05 * S) || paths;
function tree(type, subj, clip) {
  const c = new CL.Clipper(); const t = new CL.PolyTree();
  c.AddPaths(subj, CL.PolyType.ptSubject, true); if (clip?.length) c.AddPaths(clip, CL.PolyType.ptClip, true);
  c.Execute(type, t, CL.PolyFillType.pftNonZero, CL.PolyFillType.pftNonZero); return t;
}
function treePolys(t) {
  const out = [];
  const walk = node => { for (const ch of node.Childs()) { if (ch.IsHole()) { walk(ch); continue; } out.push({ outer: ch.Contour(), holes: ch.Childs().filter(h => h.IsHole()).map(h => h.Contour()) }); for (const h of ch.Childs()) walk(h); } };
  walk(t); return out;
}
// Open polylines clipped against polygons (keep = inside or outside).
function clipLines(lines, polys, keepInside) {
  const c = new CL.Clipper(); const t = new CL.PolyTree();
  for (const l of lines) if (l.length >= 2) c.AddPath(toPath(l), CL.PolyType.ptSubject, false);
  c.AddPaths(polys, CL.PolyType.ptClip, true);
  c.Execute(keepInside ? CL.ClipType.ctIntersection : CL.ClipType.ctDifference, t, CL.PolyFillType.pftNonZero, CL.PolyFillType.pftNonZero);
  return CL.Clipper.OpenPathsFromPolyTree(t).map(fromPath);
}
const rectPath = (x0, z0, x1, z1) => toPath([[x0, z0], [x1, z0], [x1, z1], [x0, z1]]);
const CROPP = [rectPath(CROP.x0, CROP.z0, CROP.x1, CROP.z1)];
const area = pts => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
const pathsArea = ps => ps.reduce((s, p) => s + CL.Clipper.Area(p) / S / S, 0);

// Point-in-polygon for plain rings, and a coarse raster for big polygon sets (distance tests).
function pip(pt, ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
class Raster {
  constructor(res = 0.5) { this.res = res; this.w = Math.ceil((CROP.x1 - CROP.x0) / res); this.h = Math.ceil((CROP.z1 - CROP.z0) / res); this.d = new Uint8Array(this.w * this.h); }
  fill(paths, v = 1) { // even-odd scanline over all rings (clipper output: holes are opposite rings -> even-odd works)
    const rings = paths.map(fromPath);
    for (let y = 0; y < this.h; y++) {
      const zc = CROP.z0 + (y + 0.5) * this.res, xs = [];
      for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const a = r[i], b = r[j];
        if ((a[1] > zc) !== (b[1] > zc)) xs.push(a[0] + (zc - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const i0 = Math.max(0, Math.ceil((xs[k] - CROP.x0) / this.res - 0.5)), i1 = Math.min(this.w - 1, Math.floor((xs[k + 1] - CROP.x0) / this.res - 0.5));
        for (let i = i0; i <= i1; i++) this.d[y * this.w + i] = v;
      }
    }
  }
  at(x, z) { const i = Math.floor((x - CROP.x0) / this.res), j = Math.floor((z - CROP.z0) / this.res); return i < 0 || j < 0 || i >= this.w || j >= this.h ? 0 : this.d[j * this.w + i]; }
}

// ---------------------------------------------------------------- roads
const PUBLIC = { primary: [3.5, 4.5, 2.0], primary_link: [4.2, 0, 1.5], secondary: [3.4, 3.5, 2.5], secondary_link: [4.2, 0, 1.5], tertiary: [3.3, 2.8, 3.0], tertiary_link: [4.0, 0, 2.0], residential: [3.0, 2.6, 3.0], unclassified: [3.0, 1.5, 2.5], living_street: [2.8, 0.4, 0.6] };
const roads = [], service = [], paths = [], rails = [], platforms = [];
for (const w of ways) {
  const t = w.tags || {}; if (!t.highway && !t.railway) continue;
  if ((t.area === 'yes' && t.railway !== 'platform') || t.tunnel === 'yes' || t.location === 'underground') continue;
  const pts = ptsOf(w); if (pts.length < 2 || !pts.some(p => inCrop(p, 60))) continue;
  const spec = PUBLIC[t.highway];
  if (spec) {
    const lanes = parseInt(t.lanes) || 0;
    let width = parseFloat(t.width) || (lanes ? lanes * spec[0] + spec[1] : 2 * spec[0] + spec[1]);
    if (t.junction === 'roundabout') width = Math.max(7.5, (lanes || 1) * 5.5);
    else if (t.oneway === 'yes' && !lanes) width = Math.max(5.5, width * 0.6);
    const cls = t.highway.replace('_link', '');
    roads.push({ id: w.id, pts, width, berm: spec[2], name: t.name || '', cls, lanes: lanes || (t.oneway === 'yes' ? 1 : 2), oneway: t.oneway === 'yes', round: t.junction === 'roundabout', nodes: w.nodes });
  } else if (t.highway === 'service') {
    const width = { driveway: 3.0, parking_aisle: 6.0, 'drive-through': 3.6 }[t.service] || 5.0;
    service.push({ pts, width, kind: t.service || 'service', closed: closed(w) });
  } else if (['footway', 'path', 'pedestrian', 'cycleway', 'steps'].includes(t.highway)) {
    if (t.footway === 'sidewalk' || t.footway === 'crossing' || t.footway === 'traffic_island') continue; // generated from the roads
    paths.push({ pts, width: t.highway === 'pedestrian' ? 4 : t.highway === 'cycleway' ? 2.5 : 1.8, closed: closed(w) && t.highway === 'pedestrian' });
  } else if (t.railway === 'rail' && t.service !== 'siding') rails.push({ pts, name: t.name || '' });
  else if (t.railway === 'platform') platforms.push(pts);
}
// Cul-de-sac heads.
const turning = [];
for (const n of nodes.values()) if ((n.tags.highway === 'turning_circle' || n.tags.highway === 'turning_loop') && inCrop(n.p, 20)) turning.push(n.p);
console.log('roads', roads.length, 'service', service.length, 'paths', paths.length, 'rails', rails.length, 'turning', turning.length);

const roadBuf = (extra, filter = () => true) => {
  const out = [];
  for (const r of roads) if (filter(r)) for (const p of offsetOpen([r.pts], r.width / 2 + extra(r))) out.push(p);
  for (const c of turning) for (const p of offsetOpen([[c, [c[0] + 0.01, c[1]]]], 9.5 + extra({ cls: 'residential', berm: 3 }))) out.push(p);
  return union(out);
};
let carriage = close(roadBuf(() => 0), 5);            // kerb-to-kerb, kerb returns rounded at 5 m
carriage = clean(carriage);
const kerbOuter = offsetPaths(carriage, KERB);
const bermInner = union(roadBuf(r => KERB + r.berm), kerbOuter);
const footOuterAll = close(roadBuf(r => KERB + r.berm + 1.6), 3);
const reserve = offsetPaths(footOuterAll, 0.6);      // property boundary just behind the footpath

// Landuse polygons.
const landuse = { retail: [], commercial: [], industrial: [], park: [], school: [], grass: [], water: [], wood: [], religious: [], pitch: [], playground: [], pool: [], parking: [], garden: [], railway: [], construction: [], wetland: [], scrub: [] };
const pitches = [];
const multipolyOuter = new Map();
for (const r of rels) if (r.tags?.type === 'multipolygon') for (const m of r.members) if (m.type === 'way' && m.role === 'outer') multipolyOuter.set(m.ref, r.tags);
for (const w of ways) {
  if (!closed(w)) continue;
  const t = { ...(multipolyOuter.get(w.id) || {}), ...(w.tags || {}) };
  const pts = ptsOf(w); if (pts.length < 4 || !pts.some(p => inCrop(p, 30))) continue;
  const P = toPath(pts);
  const add = k => landuse[k].push(P);
  if (t.landuse === 'retail') add('retail'); else if (t.landuse === 'commercial') add('commercial');
  else if (t.landuse === 'industrial') add('industrial'); else if (t.landuse === 'religious') add('religious');
  else if (t.landuse === 'grass' || t.landuse === 'recreation_ground' || t.leisure === 'park' || t.landuse === 'cemetery') add(t.leisure === 'park' ? 'park' : 'grass');
  else if (t.landuse === 'railway') add('railway'); else if (t.landuse === 'construction' || t.landuse === 'brownfield') add('construction');
  if (t.amenity === 'school' || t.amenity === 'kindergarten' || t.amenity === 'college') add('school');
  if (t.natural === 'water' || t.waterway === 'riverbank') add('water');
  if (t.natural === 'wood' || t.landuse === 'forest') add('wood');
  if (t.natural === 'scrub') add('scrub');
  if (t.natural === 'wetland') add('wetland');
  if (t.leisure === 'garden') add('garden');
  if (t.leisure === 'playground') add('playground');
  if (t.leisure === 'swimming_pool' && !t.building) add('pool');
  if (t.amenity === 'parking' && !['multi-storey', 'underground', 'rooftop'].includes(t.parking)) add('parking');
  if (t.leisure === 'pitch') { add('pitch'); pitches.push({ pts, sport: t.sport || '', surface: t.surface || '' }); }
}
const streams = [];
for (const w of ways) { const t = w.tags || {}; if (['stream', 'drain', 'ditch', 'river'].includes(t.waterway) && t.tunnel !== 'culvert' && t.layer !== '-1') { const pts = ptsOf(w); if (pts.some(p => inCrop(p))) streams.push({ pts, width: t.waterway === 'river' ? 8 : t.waterway === 'stream' ? 3 : 1.6 }); } }

// ---------------------------------------------------------------- flat surface layers (mutually exclusive)
const retailZone = union([...landuse.retail, ...landuse.commercial]);
const footRetail = diff(inter(offsetPaths(carriage, KERB + 5.0), retailZone), kerbOuter);
let foot = union(diff(footOuterAll, bermInner), footRetail);
const channel = diff(carriage, offsetPaths(carriage, -0.45));
const kerbTop = diff(kerbOuter, carriage);
const servicePolys = union(service.filter(s => s.kind !== 'driveway').flatMap(s => s.closed && s.pts.length > 3 ? [toPath(s.pts), ...offsetOpen([s.pts], s.width / 2)] : [...offsetOpen([s.pts], s.width / 2)]));
const drivewayOSM = union(service.filter(s => s.kind === 'driveway').flatMap(s => [...offsetOpen([s.pts], s.width / 2, CL.EndType.etOpenButt)]));
const pathPolys = union(paths.flatMap(p => p.closed ? [toPath(p.pts)] : [...offsetOpen([p.pts], p.width / 2)]));
const parking = union(landuse.parking);
const streamPolys = union(streams.flatMap(s => [...offsetOpen([s.pts], s.width / 2)]));

// Buildings ----------------------------------------------------------------------------------------
const BT = { house: 0, shed: 1, garage: 2, shop: 3, mall: 4, bigbox: 5, warehouse: 6, school: 7, church: 8, civic: 9, canopy: 10, apartments: 11, station: 12, fastfood: 13 };
const zoneTest = paths => { const rings = paths.map(fromPath); return p => rings.some(r => pip(p, r)); };
const inRetail = zoneTest(retailZone), inIndustrial = zoneTest(union(landuse.industrial)), inSchool = zoneTest(union(landuse.school)), inReligious = zoneTest(union(landuse.religious));
const buildings = [];
for (const w of ways) {
  const t = w.tags || {}; if (!t.building || !closed(w)) continue;
  if (['construction', 'ruins'].includes(t.building)) continue;
  let pts = ptsOf(w).slice(0, -1); if (pts.length < 3) continue;
  const c = pts.reduce((s, p) => [s[0] + p[0] / pts.length, s[1] + p[1] / pts.length], [0, 0]);
  if (!inCrop(c, -2)) continue;
  pts = simplify(pts); if (pts.length < 3) continue;
  if (area(pts) < 0) pts.reverse(); // counter-clockwise in (x, z)
  const A = Math.abs(area(pts));
  const name = t.name || '', brand = t.brand || '';
  let type = BT.house;
  if (t.shop === 'mall') type = BT.mall;
  else if (t.building === 'roof' || t.amenity === 'shelter' || t.building === 'carport') type = BT.canopy;
  else if (t.amenity === 'fast_food' && A > 120) type = BT.fastfood;
  else if (['supermarket', 'department_store'].includes(t.shop) && A > 1500) type = BT.bigbox;
  else if (t.building === 'church' || t.amenity === 'place_of_worship' || (inReligious(c) && A > 150)) type = BT.church;
  else if (t.amenity === 'community_centre' || t.amenity === 'library' || t.amenity === 'police' || t.building === 'civic' || t.amenity === 'townhall') type = BT.civic;
  else if (t.building === 'school' || t.amenity === 'school' || t.building === 'kindergarten' || inSchool(c)) type = A < 25 ? BT.shed : BT.school;
  else if (t.building === 'apartments' || (t.building === 'residential' && A > 300)) type = BT.apartments;
  else if (t.building === 'warehouse' || t.building === 'industrial' || inIndustrial(c)) type = A < 40 ? BT.shed : BT.warehouse;
  else if (t.building === 'retail' || t.building === 'commercial' || t.shop || t.amenity || inRetail(c)) type = A < 18 ? BT.shed : A > 2500 ? BT.bigbox : BT.shop;
  else if (A < 22) type = BT.shed;
  else if (A < 48 && t.building !== 'house') type = BT.garage;
  else if (A > 420) type = BT.apartments;
  const levels = parseInt(t['building:levels']) || 0;
  buildings.push({ id: w.id, pts, c, A, type, levels, name, brand, tags: t });
}
function simplify(pts) {
  let out = pts.filter((p, i) => { const q = pts[(i + 1) % pts.length]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.15; });
  let changed = true;
  while (changed && out.length > 3) {
    changed = false;
    for (let i = 0; i < out.length; i++) {
      const a = out[(i + out.length - 1) % out.length], b = out[i], c = out[(i + 1) % out.length];
      const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) * Math.hypot(c[0] - b[0], c[1] - b[1]);
      if (Math.abs(cr) < l * 0.05) { out.splice(i, 1); changed = true; break; }
    }
  }
  return out;
}
console.log('buildings', buildings.length, Object.entries(BT).map(([k, v]) => k + ':' + buildings.filter(b => b.type === v).length).join(' '));
const bldPaths = buildings.map(b => toPath(b.pts));
const bldUnion = union(bldPaths);

// Oriented bounding box and rectangle decomposition for roofs.
function hull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
function obb(pts) {
  const h = hull(pts); let best = null;
  for (let i = 0; i < h.length; i++) {
    const a = h[i], b = h[(i + 1) % h.length], ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const c = Math.cos(-ang), s = Math.sin(-ang);
    let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
    for (const p of h) { const u = p[0] * c - p[1] * s, v = p[0] * s + p[1] * c; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    const A = (u1 - u0) * (v1 - v0);
    if (!best || A < best.A - 1e-6) best = { A, ang, u0, u1, v0, v1 };
  }
  return best;
}
function roofRects(b) {
  const o = obb(b.pts), c = Math.cos(-o.ang), s = Math.sin(-o.ang);
  const loc = b.pts.map(p => [p[0] * c - p[1] * s, p[0] * s + p[1] * c]);
  const toW = (u, v) => { const C = Math.cos(o.ang), Sn = Math.sin(o.ang); return [u * C - v * Sn, u * Sn + v * C]; };
  const fill = b.A / o.A;
  const rects = [];
  if (fill > 0.86 || b.pts.length < 6) rects.push([o.u0, o.v0, o.u1, o.v1]);
  else {
    const xs = [...new Set(loc.map(p => Math.round(p[0] * 2) / 2))].sort((a, b) => a - b);
    const slabs = [];
    for (let k = 0; k + 1 < xs.length; k++) {
      if (xs[k + 1] - xs[k] < 0.3) continue;
      const mid = (xs[k] + xs[k + 1]) / 2, vs = [];
      for (let i = 0, j = loc.length - 1; i < loc.length; j = i++) { const a = loc[i], q = loc[j]; if ((a[0] > mid) !== (q[0] > mid)) vs.push(a[1] + (mid - a[0]) / (q[0] - a[0]) * (q[1] - a[1])); }
      vs.sort((a, b) => a - b);
      const iv = []; for (let m = 0; m + 1 < vs.length; m += 2) iv.push([vs[m], vs[m + 1]]);
      slabs.push({ u0: xs[k], u1: xs[k + 1], iv });
    }
    const same = (a, b) => a.length === b.length && a.every((x, i) => Math.abs(x[0] - b[i][0]) < 0.4 && Math.abs(x[1] - b[i][1]) < 0.4);
    for (let k = 0; k < slabs.length; k++) {
      let e = k; while (e + 1 < slabs.length && Math.abs(slabs[e + 1].u0 - slabs[e].u1) < 0.01 && same(slabs[e + 1].iv, slabs[k].iv)) e++;
      for (const iv of slabs[k].iv) rects.push([slabs[k].u0, iv[0], slabs[e].u1, iv[1]]);
      k = e;
    }
  }
  // Drop slivers; cap the count (complex outlines fall back to one rectangle over the whole house).
  let rs = rects.filter(r => r[2] - r[0] > 1.4 && r[3] - r[1] > 1.4).sort((a, b) => (b[2] - b[0]) * (b[3] - b[1]) - (a[2] - a[0]) * (a[3] - a[1]));
  if (!rs.length || rs.length > 6) rs = [[o.u0, o.v0, o.u1, o.v1]];
  return { ang: o.ang, rects: rs.map(r => { const cu = (r[0] + r[2]) / 2, cv = (r[1] + r[3]) / 2, w = toW(cu, cv); return [w[0], w[1], r[2] - r[0], r[3] - r[1]]; }) };
}

// ---------------------------------------------------------------- carriage raster and nearest-road index
const ras = new Raster(0.5); ras.fill(carriage, 1);
const segGrid = new Map(), SG = 40;
roads.forEach((r, ri) => { for (let i = 0; i + 1 < r.pts.length; i++) { const a = r.pts[i], b = r.pts[i + 1]; const x0 = Math.floor(Math.min(a[0], b[0]) / SG), x1 = Math.floor(Math.max(a[0], b[0]) / SG), z0 = Math.floor(Math.min(a[1], b[1]) / SG), z1 = Math.floor(Math.max(a[1], b[1]) / SG); for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { const k = x + ',' + z; if (!segGrid.has(k)) segGrid.set(k, []); segGrid.get(k).push([ri, i]); } } });
function nearestRoad(p, maxR = 80) {
  let best = null;
  const cx = Math.floor(p[0] / SG), cz = Math.floor(p[1] / SG), n = Math.ceil(maxR / SG);
  for (let x = cx - n; x <= cx + n; x++) for (let z = cz - n; z <= cz + n; z++) for (const [ri, i] of segGrid.get(x + ',' + z) || []) {
    const r = roads[ri], a = r.pts[i], b = r.pts[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2)), qx = a[0] + dx * t, qz = a[1] + dz * t, d = Math.hypot(p[0] - qx, p[1] - qz);
    if (!best || d < best.d) best = { d, r, q: [qx, qz], dir: [dx / Math.sqrt(L2), dz / Math.sqrt(L2)] };
  }
  return best;
}
// Distance from p along direction n until the carriageway (or null).
function rayToKerb(p, n, max = 16) { for (let s = 0; s <= max; s += 0.25) if (ras.at(p[0] + n[0] * s, p[1] + n[1] * s)) return s; return null; }

// ---------------------------------------------------------------- sections, fences, driveways
const blocks = diff(CROPP, reserve);
const blockPolys = treePolys(tree(CL.ClipType.ctDifference, CROPP, reserve)).map(p => ({ outer: fromPath(p.outer), holes: p.holes.map(fromPath), paths: [p.outer, ...p.holes] }));
const houses = buildings.filter(b => (b.type === BT.house || b.type === BT.apartments) && b.A >= 45);
const blockOf = p => blockPolys.findIndex(bp => pip(p, bp.outer) && !bp.holes.some(h => pip(p, h)));
const blockIndex = new Map(); // cache via grid of block bboxes
blockPolys.forEach(bp => { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const p of bp.outer) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); } bp.bb = [x0, z0, x1, z1]; });
const blockAt = p => { for (let i = 0; i < blockPolys.length; i++) { const bp = blockPolys[i], bb = bp.bb; if (p[0] < bb[0] || p[0] > bb[2] || p[1] < bb[1] || p[1] > bb[3]) continue; if (pip(p, bp.outer) && !bp.holes.some(h => pip(p, h))) return i; } return -1; };
const del = Delaunay.from(houses.map(h => h.c));
const vor = del.voronoi([CROP.x0, CROP.z0, CROP.x1, CROP.z1]);
const nonResidential = union([...landuse.retail, ...landuse.commercial, ...landuse.industrial, ...landuse.school, ...landuse.park, ...landuse.religious, ...landuse.parking, ...landuse.railway]);
const nonResRings = nonResidential.map(fromPath), inNonRes = p => nonResRings.some(r => pip(p, r));
const sections = [], frontFences = [], sideFences = [], letterboxes = [], drivewayPolys = [], driveSpots = [];
const edgeKey = (a, b) => { const k1 = Math.round(a[0] * 5) + ':' + Math.round(a[1] * 5), k2 = Math.round(b[0] * 5) + ':' + Math.round(b[1] * 5); return k1 < k2 ? k1 + '|' + k2 : k2 + '|' + k1; };
const seenSide = new Set();
const osmDriveRings = drivewayOSM.map(fromPath);
const blockBoundaryPaths = blockPolys.map(bp => bp.paths);
let genDrives = 0;
houses.forEach((h, hi) => {
  if (inNonRes(h.c)) return;
  const bi = blockAt(h.c); if (bi < 0) return;
  const cell = vor.cellPolygon(hi); if (!cell) return;
  // Section = Voronoi cell ∩ block, kept off parks/schools/shops and within ~28 m of the house.
  const near = offsetPaths([toPath(h.pts)], 28, CL.JoinType.jtSquare);
  const cellIn = diff(inter(inter([toPath(cell.slice(0, -1))], blockPolys[bi].paths), near), nonResidential);
  const sec = treePolys(tree(CL.ClipType.ctUnion, cellIn, []));
  if (!sec.length) return;
  const poly = sec.find(s => pip(h.c, fromPath(s.outer))) || sec[0];
  const ring = fromPath(poly.outer); if (Math.abs(area(ring)) < 60) return;
  const secIdx = sections.length;
  sections.push({ house: buildings.indexOf(h), ring, street: nearestRoad(h.c, 120)?.r.name || '' });
  h.section = secIdx;
  // Classify edges: on the block boundary (street side) or shared with a neighbour.
  const onBoundary = p => { const near = nearestRoad(p, 40); return near && near.d < near.r.width / 2 + KERB + near.r.berm + 1.6 + 1.6; };
  const front = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 0.4) continue;
    if (onBoundary(m) && onBoundary(a) && onBoundary(b)) front.push([a, b, L]);
    else { const k = edgeKey(a, b); if (!seenSide.has(k)) { seenSide.add(k); sideFences.push([a, b]); } }
  }
  if (!front.length) return;
  // Driveway: beside the house on the roomier side of the frontage, unless OSM already maps one.
  const hasOSM = osmDriveRings.some(r => r.some(p => pip(p, ring)));
  front.sort((p, q) => q[2] - p[2]);
  const [fa, fb, FL] = front[0];
  const t = [(fb[0] - fa[0]) / FL, (fb[1] - fa[1]) / FL];
  let n = [-t[1], t[0]]; // inward normal guess; flip toward the house
  const toH = [h.c[0] - fa[0], h.c[1] - fa[1]]; if (n[0] * toH[0] + n[1] * toH[1] < 0) n = [-n[0], -n[1]];
  const proj = p => [(p[0] - fa[0]) * t[0] + (p[1] - fa[1]) * t[1], (p[0] - fa[0]) * n[0] + (p[1] - fa[1]) * n[1]];
  const hp = h.pts.map(proj), tMin = Math.min(...hp.map(q => q[0])), tMax = Math.max(...hp.map(q => q[0])), dMin = Math.min(...hp.map(q => q[1])), dMax = Math.max(...hp.map(q => q[1]));
  let dc, depth;
  const gapL = tMin, gapR = FL - tMax;
  if (Math.max(gapL, gapR) >= 3.6) { dc = gapL > gapR ? Math.max(1.8, tMin - 1.9) : Math.min(FL - 1.8, tMax + 1.9); depth = Math.min(dMax + 2, 32); }
  else { dc = Math.max(1.6, Math.min(FL - 1.6, (tMin + tMax) / 2)); depth = Math.max(1, dMin - 0.6); }
  h.front = { t, n, a: fa };
  const P = [fa[0] + t[0] * dc, fa[1] + t[1] * dc];
  const kerbD = rayToKerb(P, [-n[0], -n[1]], 14);
  if (!hasOSM && kerbD != null) {
    const W2 = 1.5, out = kerbD + 0.15;
    const q = (s, d) => [P[0] + t[0] * s + n[0] * d, P[1] + t[1] * s + n[1] * d];
    drivewayPolys.push(toPath([q(-W2, -out), q(W2, -out), q(W2, depth), q(-W2, depth)]));
    genDrives++;
    if (depth > 5) driveSpots.push([P[0] + n[0] * Math.min(4.2, depth - 2.6), P[1] + n[1] * Math.min(4.2, depth - 2.6), Math.atan2(n[0], n[1]), P[0] - n[0] * (kerbD - 0.9), P[1] - n[1] * (kerbD - 0.9)]);
  }
  // Letterbox on the boundary beside the driveway; front fence segments with a gap for the drive.
  const lb = [fa[0] + t[0] * (dc + 2.1) - n[0] * 0.05, fa[1] + t[1] * (dc + 2.1) - n[1] * 0.05];
  letterboxes.push([lb[0], lb[1], Math.atan2(-n[0], -n[1])]);
  for (const [a, b, L] of front) {
    if (a === fa) {
      const g0 = Math.max(0, dc - 1.6), g1 = Math.min(L, dc + 1.6), path = (s0, s1) => [[a[0] + t[0] * s0, a[1] + t[1] * s0], [a[0] + t[0] * s1, a[1] + t[1] * s1]];
      if (g0 > 0.5) frontFences.push([...path(0, g0), secIdx]); if (L - g1 > 0.5) frontFences.push([...path(g1, L), secIdx]);
    } else frontFences.push([a, b, secIdx]);
  }
});
console.log('sections', sections.length, 'side fences', sideFences.length, 'front fences', frontFences.length, 'generated driveways', genDrives);
// Side fences must not run through buildings.
const bldBuf = offsetPaths(bldUnion, 0.35, CL.JoinType.jtMiter);
const sideClipped = clipLines(sideFences, bldBuf, false).filter(l => l.length >= 2);
// OSM-mapped fences and walls.
const osmFences = [];
for (const w of ways) { const t = w.tags || {}; if (['fence', 'wall', 'hedge', 'retaining_wall'].includes(t.barrier)) { const pts = ptsOf(w); if (pts.some(p => inCrop(p))) osmFences.push({ pts, kind: t.barrier }); } }
// School and park boundary fences: school grounds get the green mesh fence.
const schoolFence = clipLines(union(landuse.school).map(p => { const r = fromPath(p); return r.concat([r[0]]); }), offsetPaths(carriage, 1.0), false);

let drives = diff(union(drivewayPolys, drivewayOSM), carriage);
const pools = union(landuse.pool);
const courtPolys = union(pitches.filter(p => ['basketball', 'netball', 'tennis', 'volleyball'].includes(p.sport) || p.surface === 'paved' || p.surface === 'asphalt').map(p => toPath(p.pts)));
const skatePolys = union(pitches.filter(p => p.sport === 'skateboard').map(p => toPath(p.pts)));
const platformPolys = union(platforms.map(toPath));
const railBed = union(rails.flatMap(r => [...offsetOpen([r.pts], 2.2, CL.EndType.etOpenButt)]));

// Ground: carriageway at y = 0, land (lawn) at kerb height everywhere else, and decal layers on the land.
// Decals are mutually exclusive among themselves (first wins) so none of them z-fight.
const layerOrder = [
  ['kerb', kerbTop], ['rail', railBed], ['platform', platformPolys], ['foot', foot], ['skate', skatePolys], ['court', courtPolys],
  ['paved', union(servicePolys, parking)], ['path', pathPolys], ['drive', drives], ['pool', pools], ['water', union(landuse.water, streamPolys)],
  ['paved2', union(retailZone, union(landuse.industrial))], ['bark', union(landuse.playground)], ['dirt', union(landuse.construction)],
];
const layers = { road: carriage, grass: diff(CROPP, carriage) };
let taken = [...carriage];
for (const [name, polys] of layerOrder) {
  const own = diff(polys, taken);
  layers[name] = own; taken = union(taken, own);
}
for (const [k, v] of Object.entries(layers)) console.log('layer', k, Math.round(pathsArea(v)), 'm2');

// Triangulate per tile.
function tiles(paths) {
  const out = [];
  const bb = paths.map(p => { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const q of p) { x0 = Math.min(x0, q.X); x1 = Math.max(x1, q.X); z0 = Math.min(z0, q.Y); z1 = Math.max(z1, q.Y); } return [x0 / S, z0 / S, x1 / S, z1 / S]; });
  for (let x = CROP.x0; x < CROP.x1; x += TILE) for (let z = CROP.z0; z < CROP.z1; z += TILE) {
    const sub = paths.filter((p, i) => bb[i][2] > x && bb[i][0] < x + TILE && bb[i][3] > z && bb[i][1] < z + TILE);
    if (!sub.length) continue;
    const polys = treePolys(tree(CL.ClipType.ctIntersection, sub, [rectPath(x, z, Math.min(x + TILE, CROP.x1), Math.min(z + TILE, CROP.z1))]));
    const V = [], I = [];
    for (const p of polys) {
      const flat = [], holes = []; const base = V.length / 2;
      for (const q of p.outer) flat.push(q.X / S, q.Y / S);
      for (const h of p.holes) { holes.push(flat.length / 2); for (const q of h) flat.push(q.X / S, q.Y / S); }
      const tri = earcut(flat, holes, 2);
      for (const v of flat) V.push(v);
      for (const i of tri) I.push(base + i);
    }
    if (I.length) out.push({ x, z, V, I });
  }
  return out;
}

// ---------------------------------------------------------------- points of interest, signs, street furniture
const POI_NAMES = { // chains get stand-in names; local shops keep their category
  "PAK'nSAVE": ["PAK'N'PAY", 'bigyellow'], 'The Warehouse': ['THE STOREHOUSE', 'bigred'], 'New World': ['NU WORLD', 'red'], "McDonald's": ['BIG MAC\'S BURGERS', 'gold'], KFC: ['KUMARA FRIED CHICKEN', 'red'],
  'Super Liquor': ['SUPA LIQUOR', 'darkred'], 'the Bottle -O': ['BOTTLE STORE', 'green'], 'Pizza Hut': ['PIZZA SHACK', 'red'], Subway: ['SUB STATION', 'green'], Mobil: ['KIWI FUEL', 'blue'], 'On the Run': ['ON THE GO', 'blue'],
  'Lotto NZ': ['LOTTERY', 'blue'], CityFitness: ['CITY GYM', 'purple'], Repco: ['AUTO PARTS', 'red'], Unichem: ['PHARMACY', 'green'], 'Noodle Canteen': ['NOODLE BAR', 'red'],
};
const CAT = { convenience: 'DAIRY', bakery: 'BAKERY', alcohol: 'LIQUOR', hairdresser: 'BARBER', beauty: 'NAILS & BEAUTY', laundry: 'LAUNDROMAT', butcher: 'BUTCHERY', greengrocer: 'FRUIT & VEGE', variety_store: '$2 SHOP', clothes: 'CLOTHING', pawnbroker: 'PAWN & LOAN', charity: 'OP SHOP', jewelry: 'JEWELLERS', car_repair: 'MECHANIC', supermarket: 'SUPERMARKET', grocery: 'GROCER', seafood: 'SEAFOOD', tobacco: 'VAPE SHOP', electronics: 'PHONE REPAIRS', furniture: 'FURNITURE', money_lender: 'CASH LOANS', fast_food: 'TAKEAWAYS', restaurant: 'RESTAURANT', cafe: 'CAFE', pharmacy: 'PHARMACY', doctors: 'MEDICAL CENTRE', dentist: 'DENTAL', bar: 'BAR', library: 'LIBRARY', fitness_centre: 'GYM', travel_agency: 'TRAVEL', post_office: 'POST SHOP', bank: 'BANK', lottery: 'LOTTO', car_parts: 'AUTO PARTS', fuel: 'FUEL', gift: 'GIFTS', shoes: 'SHOES' };
// Descriptive local names are kept (they read like real signage); personal or brand names fall back to the category.
const keepName = n => /^(Clendon|Manurewa|Southmall|Great South|Southern|Grange)\b/i.test(n) && n.length < 26;
const signs = [];
const bGrid = new Map(), BG = 30;
buildings.forEach((b, bi) => { const k = Math.floor(b.c[0] / BG) + ',' + Math.floor(b.c[1] / BG); if (!bGrid.has(k)) bGrid.set(k, []); bGrid.get(k).push(bi); });
function nearBuildings(p, r = 30) { const out = []; const cx = Math.floor(p[0] / BG), cz = Math.floor(p[1] / BG); for (let x = cx - 1; x <= cx + 1; x++) for (let z = cz - 1; z <= cz + 1; z++) for (const bi of bGrid.get(x + ',' + z) || []) out.push(bi); return out; }
const segDist = (p, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2)); return [Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t), t]; };
// Which wall of a building faces the street (outward normal toward the nearest carriageway, shortest distance).
function streetEdge(b) {
  let best = null;
  for (let i = 0; i < b.pts.length; i++) {
    const a = b.pts[i], q = b.pts[(i + 1) % b.pts.length], L = Math.hypot(q[0] - a[0], q[1] - a[1]); if (L < 2) continue;
    const nx = (q[1] - a[1]) / L, nz = -(q[0] - a[0]) / L; // outward for CCW in (x,z) with z down? verified below
    const m = [(a[0] + q[0]) / 2, (a[1] + q[1]) / 2];
    const inside = pip([m[0] + nx * 0.3, m[1] + nz * 0.3], b.pts); const ox = inside ? -nx : nx, oz = inside ? -nz : nz;
    const d = rayToKerb(m, [ox, oz], 40);
    if (d != null && (!best || d < best.d)) best = { i, d, L };
  }
  return best;
}
for (const n of nodes.values()) {
  const t = n.tags; if (!inCrop(n.p)) continue;
  const kind = t.shop || t.amenity || t.leisure; if (!kind) continue;
  const known = POI_NAMES[t.name] || POI_NAMES[t.brand];
  const cat = CAT[t.shop] || CAT[t.amenity] || CAT[t.leisure]; if (!known && !cat) continue;
  if (['atm', 'post_box', 'toilets', 'bench', 'waste_basket', 'telephone', 'bicycle_parking', 'parking', 'parking_space', 'vending_machine', 'clock', 'shelter', 'taxi', 'social_facility', 'bus_station'].includes(t.amenity)) continue;
  let text = known ? known[0] : t.name && keepName(t.name) ? t.name.toUpperCase() : cat;
  const style = known ? known[1] : '';
  // Building that contains the point, else the nearest within 15 m.
  let bi = -1, bd = 1e9;
  for (const k of nearBuildings(n.p)) { const b = buildings[k]; if (pip(n.p, b.pts)) { bi = k; bd = 0; break; } for (let i = 0; i < b.pts.length; i++) { const [d] = segDist(n.p, b.pts[i], b.pts[(i + 1) % b.pts.length]); if (d < bd) { bd = d; bi = k; } } }
  if (bi < 0 || bd > 15) continue;
  const b = buildings[bi]; if ([BT.house, BT.shed, BT.garage].includes(b.type)) b.type = BT.shop;
  // Wall nearest to the POI (shops in a row each get their own stretch of the frontage).
  let ei = 0, et = 0.5, ed = 1e9;
  for (let i = 0; i < b.pts.length; i++) { const [d, tt] = segDist(n.p, b.pts[i], b.pts[(i + 1) % b.pts.length]); if (d < ed) { ed = d; ei = i; et = tt; } }
  signs.push([bi, ei, Math.round(et * 100) / 100, text, style, t.amenity === 'fast_food' || t.shop === 'convenience' ? 1 : 0]);
}
// Landmark names on their buildings.
for (const [bi, b] of buildings.entries()) {
  if (b.type === BT.mall) signs.push([bi, -1, 0.5, 'SOUTHMALL', 'mall', 0]);
  if (/Te Matariki/.test(b.name)) signs.push([bi, -1, 0.5, 'TE MATARIKI CLENDON', 'civic', 0]);
  if (/Police/.test(b.name)) signs.push([bi, -1, 0.5, 'POLICE', 'police', 0]);
  if (/Methodist|Baptist|Church/.test(b.name)) signs.push([bi, -1, 0.5, b.name.toUpperCase().slice(0, 28), 'church', 0]);
}
console.log('signs', signs.length);
// Shops and civic buildings get verandahs over the footpath on walls close to the kerb.
for (const b of buildings) {
  b.front = b.front || null;
  const se = streetEdge(b);
  b.fe = se ? se.i : 0;
  b.ver = [BT.shop, BT.fastfood].includes(b.type) && se && se.d < 7.5 && se.L > 4 ? Math.min(3.2, Math.max(1.8, se.d - 0.6)) : 0;
}

// Trees: mapped trees plus scattered bush in mapped woods and park edges.
const trees = [];
const species = n => { const s = (n.tags.species || n.tags.genus || '').toLowerCase(); return /vitex|puriri/.test(s) ? 2 : /metrosideros|pohutukawa/.test(s) ? 1 : /araucaria|norfolk/.test(s) ? 5 : /phoenix|palm/.test(s) ? 4 : /cordyline/.test(s) ? 3 : -1; };
for (const n of nodes.values()) if (n.tags.natural === 'tree' && inCrop(n.p)) trees.push([n.p[0], n.p[1], species(n)]);
const woodRings = union([...landuse.wood, ...landuse.scrub]).map(fromPath);
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (const r of woodRings) { const A = Math.abs(area(r)); let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const p of r) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); } const n = Math.min(400, A / 45); for (let k = 0; k < n * 3 && k < 1200; k++) { const p = [x0 + rnd() * (x1 - x0), z0 + rnd() * (z1 - z0)]; if (pip(p, r) && inCrop(p) && !ras.at(p[0], p[1])) trees.push([p[0], p[1], -2]); } }
// Backyard trees and shrubs, a cabbage tree or two out front.
for (const s of sections) {
  const h = buildings[s.house]; if (!h.front) continue; const { t, n, a } = h.front;
  const hd = h.pts.map(p => (p[0] - a[0]) * n[0] + (p[1] - a[1]) * n[1]), back = Math.max(...hd), ht = h.pts.map(p => (p[0] - a[0]) * t[0] + (p[1] - a[1]) * t[1]), mid = (Math.min(...ht) + Math.max(...ht)) / 2;
  for (let k = 0; k < 3; k++) {
    if (rnd() > 0.5) continue;
    const d = back + 2.5 + rnd() * 9, along = mid + (rnd() - 0.5) * 14, p = [a[0] + n[0] * d + t[0] * along, a[1] + n[1] * d + t[1] * along];
    if (pip(p, s.ring)) trees.push([p[0], p[1], rnd() < 0.2 ? 3 : -3]);
  }
  if (rnd() < 0.3) { const p = [a[0] + n[0] * 2.2 + t[0] * (1.5 + rnd() * 6), a[1] + n[1] * 2.2 + t[1] * (1.5 + rnd() * 6)]; if (pip(p, s.ring) && !pip(p, h.pts)) trees.push([p[0], p[1], 3]); }
}
console.log('trees', trees.length);

// Power poles, with minor lines where mapped; otherwise chained along the nearest street.
const poles = [], poleIdx = new Map();
for (const n of nodes.values()) if (n.tags.power === 'pole' && inCrop(n.p)) { poleIdx.set(n.id, poles.length); poles.push([n.p[0], n.p[1]]); }
const wires = [];
for (const w of ways) if (['minor_line', 'line'].includes(w.tags?.power)) for (let i = 0; i + 1 < w.nodes.length; i++) { const a = poleIdx.get(w.nodes[i]), b = poleIdx.get(w.nodes[i + 1]); if (a != null && b != null) wires.push([a, b]); }
// Generated streetlights along public roads (Auckland residential LEDs on 7-8 m poles), alternating sides.
const lights = [];
for (const r of roads) {
  if (r.round) continue;
  let acc = 12, side = 1; const step = r.cls === 'residential' ? 34 : 30;
  for (let i = 0; i + 1 < r.pts.length; i++) {
    const a = r.pts[i], b = r.pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (!L) continue; const t = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], n = [-t[1], t[0]];
    while (acc < L) {
      const off = r.width / 2 + KERB + 0.6, p = [a[0] + t[0] * acc + n[0] * off * side, a[1] + t[1] * acc + n[1] * off * side];
      if (inCrop(p) && !ras.at(p[0], p[1]) && !poles.some(q => Math.abs(q[0] - p[0]) < 6 && Math.abs(q[1] - p[1]) < 6)) lights.push([p[0], p[1], Math.atan2(-n[0] * side, -n[1] * side)]);
      acc += step; if (r.cls !== 'primary') side = -side;
    }
    acc -= L;
  }
}
for (const n of nodes.values()) if (n.tags.highway === 'street_lamp' && inCrop(n.p)) lights.push([n.p[0], n.p[1], 0]);
// Bus stops (named, with AT shelters on the busier roads), pedestrian crossings, signals.
const busStops = [], crossings = [], signals = [];
const wayDirAt = id => { for (const r of roads) { const k = r.nodes.indexOf(id); if (k >= 0) { const a = nodes.get(r.nodes[Math.max(0, k - 1)]).p, b = nodes.get(r.nodes[Math.min(r.nodes.length - 1, k + 1)]).p; return { dir: Math.atan2(b[1] - a[1], b[0] - a[0]), w: r.width }; } } return null; };
for (const n of nodes.values()) {
  if (!inCrop(n.p)) continue; const t = n.tags;
  if (t.highway === 'bus_stop') { const nr = nearestRoad(n.p, 30); if (!nr) continue; const along = nr.dir; let nx = -along[1], nz = along[0]; if ((n.p[0] - nr.q[0]) * nx + (n.p[1] - nr.q[1]) * nz < 0) { nx = -nx; nz = -nz; } const off = nr.r.width / 2 + KERB + 1.2; busStops.push([nr.q[0] + nx * off, nr.q[1] + nz * off, Math.atan2(-nx, -nz), (t.name || '').slice(0, 40), t.shelter === 'no' ? 0 : nr.r.cls === 'residential' ? 0 : 1]); }
  const zebra = ['zebra', 'uncontrolled', 'marked'].includes(t.crossing) || ['zebra', 'yes'].includes(t['crossing:markings']) || t.crossing_ref === 'zebra';
  if (t.highway === 'crossing' && (zebra || t.crossing === 'traffic_signals')) { const d = wayDirAt(n.id); if (d) crossings.push([n.p[0], n.p[1], d.dir, d.w, t.crossing === 'traffic_signals' ? 1 : 0]); }
  if (t.highway === 'traffic_signals') signals.push([n.p[0], n.p[1]]);
}
// Street name signs at junctions of differently named roads (Manukau style: white on green).
const nodeRoads = new Map();
for (const r of roads) for (const id of r.nodes) { if (!nodeRoads.has(id)) nodeRoads.set(id, new Set()); if (r.name) nodeRoads.get(id).add(r.name); }
const streetSigns = []; const signSeen = [];
for (const [id, names] of nodeRoads) {
  if (names.size < 2) continue; const p = nodes.get(id).p; if (!inCrop(p, -10)) continue;
  if (signSeen.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < 25)) continue; signSeen.push(p);
  // Stand the pole on the footpath at the nearest kerb corner.
  let best = null;
  for (let a = 0; a < 16; a++) { const th = a / 16 * Math.PI * 2, dir = [Math.cos(th), Math.sin(th)], d = (() => { for (let s = 3; s < 25; s += 0.25) if (!ras.at(p[0] + dir[0] * s, p[1] + dir[1] * s)) return s; return null; })(); if (d != null && (!best || d < best.d)) best = { d, dir }; }
  if (!best) continue;
  const q = [p[0] + best.dir[0] * (best.d + 1.0), p[1] + best.dir[1] * (best.d + 1.0)];
  const list = [...names].slice(0, 2); const dirs = list.map(nm => { const r = roads.find(r => r.name === nm && r.nodes.includes(id)); const k = r.nodes.indexOf(id); const a = nodes.get(r.nodes[Math.max(0, k - 1)]).p, b = nodes.get(r.nodes[Math.min(r.nodes.length - 1, k + 1)]).p; return Math.atan2(b[1] - a[1], b[0] - a[0]); });
  streetSigns.push([q[0], q[1], list[0], dirs[0], list[1], dirs[1]]);
}
// Rugby goalposts at the ends of rugby and league fields.
const goalposts = [];
for (const p of pitches) if (/rugby/.test(p.sport)) { const o = obb(p.pts); const C = Math.cos(o.ang), Sn = Math.sin(o.ang); const toW = (u, v) => [u * C - v * Sn, u * Sn + v * C]; const long = o.u1 - o.u0 > o.v1 - o.v0; const cu = (o.u0 + o.u1) / 2, cv = (o.v0 + o.v1) / 2; const ends = long ? [[o.u0 + 1, cv], [o.u1 - 1, cv]] : [[cu, o.v0 + 1], [cu, o.v1 - 1]]; for (const e of ends) { const w = toW(e[0], e[1]); goalposts.push([w[0], w[1], o.ang + (long ? Math.PI / 2 : 0)]); } }
// Landmarks used by the story and the art.
const findB = re => buildings.findIndex(b => re.test(b.name));
const skate = pitches.find(p => p.sport === 'skateboard');
const landmarks = {
  southmall: buildings[findB(/Southmall/)]?.c, teMatariki: buildings[findB(/Te Matariki/)]?.c,
  skatepark: skate ? skate.pts.reduce((s, p) => [s[0] + p[0] / skate.pts.length, s[1] + p[1] / skate.pts.length], [0, 0]) : null,
  skateRing: skate?.pts.slice(0, -1), station: [...nodes.values()].find(n => n.tags.railway === 'station' && n.tags.name === 'Manurewa')?.p,
  norfolkPine: [1358, -593], clendonShops: [-1185, 600], warMemorial: [1264, -739],
};
console.log('poles', poles.length, 'wires', wires.length, 'lights', lights.length, 'bus', busStops.length, 'crossings', crossings.length, 'signals', signals.length, 'streetSigns', streetSigns.length, 'rails', rails.length, 'platforms', platforms.length, 'goalposts', goalposts.length);
console.log('landmarks', JSON.stringify(landmarks).slice(0, 300));

// Context beyond the playable area: real buildings as simple boxes, real roads as ribbons.
const farB = [];
for (const w of ways) {
  const t = w.tags || {}; if (!t.building || !closed(w)) continue;
  const pts = ptsOf(w).slice(0, -1); if (pts.length < 3) continue;
  const c = pts.reduce((s, p) => [s[0] + p[0] / pts.length, s[1] + p[1] / pts.length], [0, 0]);
  if (inCrop(c, -2) || !inCrop(c, 650)) continue;
  const o = obb(pts), cu = (o.u0 + o.u1) / 2, cv = (o.v0 + o.v1) / 2, C = Math.cos(o.ang), Sn = Math.sin(o.ang);
  const A = Math.abs(area(pts)); if (A < 15) continue;
  farB.push([cu * C - cv * Sn, cu * Sn + cv * C, o.u1 - o.u0, o.v1 - o.v0, o.ang, A > 600 ? 1 : 0]);
}
const farRoads = [];
for (const w of ways) { const t = w.tags || {}; const spec = PUBLIC[t.highway]; if (!spec) continue; const pts = ptsOf(w); if (pts.length < 2 || pts.every(p => inCrop(p, -5)) || !pts.some(p => inCrop(p, 650))) continue; farRoads.push({ pts, width: (parseInt(t.lanes) || 2) * spec[0] + spec[1] }); }
// Mapped car-park stalls (Southmall and Clendon have them): centre + heading for parked cars.
const stalls = [];
for (const w of ways) { if (w.tags?.amenity !== 'parking_space' || !closed(w)) continue; const pts = ptsOf(w).slice(0, -1); if (pts.length < 3) continue; const c = pts.reduce((s, p) => [s[0] + p[0] / pts.length, s[1] + p[1] / pts.length], [0, 0]); if (!inCrop(c)) continue; const o = obb(pts); const long = o.u1 - o.u0 > o.v1 - o.v0; stalls.push([c[0], c[1], o.ang + (long ? 0 : Math.PI / 2)]); }
console.log('stalls', stalls.length);
console.log('far buildings', farB.length, 'far roads', farRoads.length, 'drive spots', driveSpots.length);

// ---------------------------------------------------------------- encode
const dm = v => Math.round(v * 10);
const i16 = arr => Buffer.from(new Int16Array(arr.map(dm)).buffer).toString('base64');
const u16 = arr => Buffer.from(new Uint16Array(arr).buffer).toString('base64');
const u32 = arr => Buffer.from(new Uint32Array(arr).buffer).toString('base64');
const kerbLines = carriage.map(fromPath).filter(r => r.length > 2);
const ringsEnc = list => ({ n: u16(list.map(r => r.length)), v: i16(list.flat(2)) });
const linesEnc = list => ({ n: u32(list.map(r => r.length)), v: i16(list.flat(2)) });
const out = {
  meta: { lat0: LAT0, lon0: LON0, crop: CROP, tile: TILE, source: 'OpenStreetMap contributors (ODbL); LINZ building outlines (CC BY 4.0)', built: new Date().toISOString().slice(0, 10) },
  layers: Object.fromEntries(Object.entries(layers).map(([k, v]) => [k, tiles(v).map(t => ({ x: t.x, z: t.z, v: i16(t.V), i: u16(t.I) }))])),
  kerb: linesEnc(kerbLines.map(r => r.concat([r[0]]))),
  roads: { ...linesEnc(roads.map(r => r.pts)), w: u16(roads.map(r => Math.round(r.width * 10))), cls: roads.map(r => r.cls[0] + (r.round ? 'R' : '') + (r.oneway ? 'O' : '') + r.lanes).join(','), names: roads.map(r => r.name) },
  buildings: {
    ...ringsEnc(buildings.map(b => b.pts)),
    type: u16(buildings.map(b => b.type)), lv: u16(buildings.map(b => b.levels)), fe: u16(buildings.map(b => b.fe)), ver: u16(buildings.map(b => Math.round(b.ver * 10))),
    roofs: buildings.map(b => { if (![BT.house, BT.garage, BT.shed, BT.school, BT.church, BT.apartments].includes(b.type)) return 0; const r = roofRects(b); return [Math.round(r.ang * 1000) / 1000, ...r.rects.flat().map(v => Math.round(v * 10) / 10)]; }),
    names: Object.fromEntries(buildings.map((b, i) => [i, b.name]).filter(([, n]) => n)),
  },
  sections: { house: u16(sections.map(s => s.house)), street: (() => { const names = [...new Set(sections.map(s => s.street))]; return { names, i: u16(sections.map(s => names.indexOf(s.street))) }; })() },
  drives: i16(driveSpots.flat()), stalls: i16(stalls.flatMap(s => [s[0], s[1], s[2] * 10])),
  far: { b: i16(farB.flatMap(b => [b[0], b[1], b[2], b[3], b[4] * 1000 / 10])), big: farB.map(b => b[5]).join(''), roads: { ...linesEnc(farRoads.map(r => r.pts)), w: u16(farRoads.map(r => Math.round(r.width * 10))) } },
  frontFences: linesEnc(frontFences.map(f => [f[0], f[1]])), frontSec: u16(frontFences.map(f => f[2])),
  sideFences: linesEnc(sideClipped), osmFences: { ...linesEnc(osmFences.map(f => f.pts)), kind: osmFences.map(f => f.kind[0]).join('') }, schoolFence: linesEnc(schoolFence),
  letterboxes: i16(letterboxes.flatMap(l => [l[0], l[1], l[2] * 10 / 10])),
  trees: { v: i16(trees.flatMap(t => [t[0], t[1]])), k: trees.map(t => String.fromCharCode(70 + t[2])).join('') },
  poles: i16(poles.flat()), wires: u16(wires.flat()), lights: i16(lights.flat()),
  busStops: busStops.map(b => [Math.round(b[0] * 10) / 10, Math.round(b[1] * 10) / 10, Math.round(b[2] * 100) / 100, b[3], b[4]]),
  crossings: crossings.map(c => c.map(v => Math.round(v * 100) / 100)), signals: signals.map(s => s.map(Math.round)),
  streetSigns: streetSigns.map(s => [Math.round(s[0] * 10) / 10, Math.round(s[1] * 10) / 10, s[2], Math.round(s[3] * 100) / 100, s[4], Math.round(s[5] * 100) / 100]),
  signs, goalposts: goalposts.map(g => g.map(v => Math.round(v * 100) / 100)),
  rails: linesEnc(rails.map(r => r.pts)), platforms: ringsEnc(platforms.map(p => p.slice(0, -1))),
  pitches: pitches.filter(p => p.pts.some(q => inCrop(q))).map(p => [p.sport, p.pts.slice(0, -1).flat().map(v => Math.round(v * 10) / 10)]),
  landmarks,
};
const js = `// Generated by tools/osm-build.mjs from OpenStreetMap (ODbL, © OpenStreetMap contributors) — do not edit.\n// Manurewa and Clendon Park, South Auckland. Local metres: x east, z south, origin ${LAT0}, ${LON0}.\nconst MAPDATA = ${JSON.stringify(out)};\n`;
fs.writeFileSync(OUT, js);
console.log('wrote', OUT, (js.length / 1024 / 1024).toFixed(2), 'MB');
const sizes = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, (JSON.stringify(v).length / 1024).toFixed(0) + 'K']));
console.log(sizes);
