#!/usr/bin/env python3
"""Realistic people for the game, from MakeHuman's CC0 assets.

Builds each cast member from the MakeHuman base mesh (hm08) with macro body targets (gender, age,
muscle, weight, height, ethnicity), fits CC0 clothes, shoes, hair, eyebrows and eyes to the body,
maps MakeHuman's skin weights onto the game's 19-bone rig, reposes the arms to hang at the sides
(the rig's rest pose), and writes one compact mesh + one texture atlas per character.

Usage: python3 tools/people-build.py <makehuman/data dir> <system assets dir> <out dir>
All inputs are CC0 (MakeHuman base mesh, targets, weights, skins, clothes, hair, eyes).
"""
import json, struct, sys, os, math
import numpy as np
from PIL import Image, ImageOps

MHD, SYS, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(OUT, exist_ok=True)

# ----------------------------------------------------------------------------- loaders
def load_obj(path):
    V, T, F = [], [], []
    group = None
    for line in open(path, encoding='utf-8', errors='ignore'):
        if line.startswith('v '): V.append([float(x) for x in line.split()[1:4]])
        elif line.startswith('vt '): T.append([float(x) for x in line.split()[1:3]])
        elif line.startswith('g '): group = line.split(None, 1)[1].strip()
        elif line.startswith('f '):
            vs, ts = [], []
            for tok in line.split()[1:]:
                p = tok.split('/')
                vs.append(int(p[0]) - 1); ts.append(int(p[1]) - 1 if len(p) > 1 and p[1] else -1)
            F.append((vs, ts, group))
    return np.array(V, dtype=np.float64), np.array(T if T else [[0, 0]], dtype=np.float64), F

def load_target(path):
    idx, d = [], []
    for line in open(path):
        if line.startswith('#') or not line.strip(): continue
        p = line.split(); idx.append(int(p[0])); d.append([float(p[1]), float(p[2]), float(p[3])])
    return np.array(idx, dtype=np.int64), np.array(d, dtype=np.float64).reshape(-1, 3)

def load_mhclo(path):
    refs, ws, offs, scales, delete, obj, material = [], [], [], {}, set(), None, None
    mode = None
    for line in open(path, encoding='utf-8', errors='ignore'):
        s = line.strip()
        if not s or s.startswith('#'): continue
        p = s.split()
        if p[0] in ('x_scale', 'y_scale', 'z_scale'): scales[p[0][0]] = (int(p[1]), int(p[2]), float(p[3])); continue
        if p[0] == 'obj_file': obj = p[1]; continue
        if p[0] == 'material': material = p[1]; continue
        if p[0] == 'verts': mode = 'verts'; continue
        if p[0] == 'delete_verts': mode = 'delete'; continue
        if not (p[0].lstrip('-').replace('.', '', 1).isdigit()): continue  # other keywords (vertexboneweights_file, ...)
        if mode == 'verts':
            if len(p) == 9:
                refs.append([int(p[0]), int(p[1]), int(p[2])]); ws.append([float(p[3]), float(p[4]), float(p[5])]); offs.append([float(p[6]), float(p[7]), float(p[8])])
            elif len(p) == 1:
                refs.append([int(p[0])] * 3); ws.append([1, 0, 0]); offs.append([0, 0, 0])
            else: mode = None
        elif mode == 'delete':
            k = 0
            while k < len(p):
                if k + 2 < len(p) and p[k + 1] == '-':
                    delete.update(range(int(p[k]), int(p[k + 2]) + 1)); k += 3
                else:
                    try: delete.add(int(p[k]))
                    except ValueError: pass
                    k += 1
    return dict(refs=np.array(refs), ws=np.array(ws), offs=np.array(offs), scales=scales, delete=delete, obj=obj, material=material, dir=os.path.dirname(path))

# ----------------------------------------------------------------------------- body
base_V, base_T, base_F = load_obj(os.path.join(MHD, '3dobjs/base.obj'))
NV = len(base_V)
TG = os.path.join(MHD, 'targets/macrodetails')
_tcache = {}
def target(name):
    if name not in _tcache:
        p = os.path.join(TG, name + '.target')
        _tcache[name] = load_target(p) if os.path.exists(p) else None
    return _tcache[name]

def tri(v, names):  # 0..1 value -> weights for [min, avg, max] style triples
    if v < 0.5: return {names[0]: 1 - v * 2, names[1]: v * 2}
    return {names[1]: 1 - (v - 0.5) * 2, names[2]: (v - 0.5) * 2}

def age_weights(a):
    if a < 0.1875: return {'baby': 1 - a / 0.1875, 'child': a / 0.1875}
    if a < 0.5: t = (a - 0.1875) / (0.5 - 0.1875); return {'child': 1 - t, 'young': t}
    t = (a - 0.5) / 0.5; return {'young': 1 - t, 'old': t}

def morph(spec):
    V = base_V.copy()
    g = {'female': 1 - spec['gender'], 'male': spec['gender']}
    ages = age_weights(spec['age'])
    mus = tri(spec['muscle'], ['minmuscle', 'averagemuscle', 'maxmuscle'])
    wts = tri(spec['weight'], ['minweight', 'averageweight', 'maxweight'])
    hts = {'minheight': max(0, 1 - spec['height'] * 2), 'maxheight': max(0, spec['height'] * 2 - 1)}
    for gk, gw in g.items():
        for ak, aw in ages.items():
            for mk, mw in mus.items():
                for wk, ww in wts.items():
                    w = gw * aw * mw * ww
                    if w < 1e-4: continue
                    t = target(f'universal-{gk}-{ak}-{mk}-{wk}')
                    if t is not None: V[t[0]] += t[1] * w
                    for hk, hw in hts.items():
                        if hw < 1e-4: continue
                        t = target(f'height/{gk}-{ak}-{mk}-{wk}-{hk}')
                        if t is not None: V[t[0]] += t[1] * w * hw
            for race, rw in spec['race'].items():
                w = gw * aw * rw
                t = target(f'{race}-{gk}-{ak}')
                if t is not None and w > 1e-4: V[t[0]] += t[1] * w
    return V

# ----------------------------------------------------------------------------- rig
BONES = ['root', 'hips', 'spine', 'chest', 'neck', 'head', 'armL', 'foreL', 'handL', 'armR', 'foreR', 'handR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR']
BI = {b: i for i, b in enumerate(BONES)}
def map_bone(name):
    n = name
    side = 'L' if n.endswith('.L') else 'R' if n.endswith('.R') else ''
    if n in ('root', 'spine05') or n.startswith('pelvis'): return [('hips', 1)]
    if n in ('spine04', 'spine03'): return [('spine', 1)]
    if n in ('spine02', 'spine01') or n.startswith('breast') or n.startswith('clavicle'): return [('chest', 1)]
    if n.startswith('shoulder01'): return [('chest', 0.45), ('arm' + side, 0.55)]
    if n.startswith('neck'): return [('neck', 1)]
    if n.startswith('upperarm'): return [('arm' + side, 1)]
    if n.startswith('lowerarm'): return [('fore' + side, 1)]
    if n.startswith('wrist') or n.startswith('metacarpal') or n.startswith('finger') or n.startswith('thumb'): return [('hand' + side, 1)]
    if n.startswith('upperleg'): return [('thigh' + side, 1)]
    if n.startswith('lowerleg'): return [('shin' + side, 1)]
    if n.startswith('foot') or n.startswith('toe'): return [('foot' + side, 1)]
    return [('head', 1)]

wdata = json.load(open(os.path.join(MHD, 'rigs/default_weights.mhw')))['weights']
W_base = np.zeros((NV, len(BONES)))
for bone, lst in wdata.items():
    for tgt, f in map_bone(bone):
        for vi, w in lst: W_base[vi, BI[tgt]] += w * f
s = W_base.sum(1, keepdims=True); W_base = np.where(s > 0, W_base / np.maximum(s, 1e-9), 0)
W_base[s[:, 0] == 0, BI['hips']] = 1
skel = json.load(open(os.path.join(MHD, 'rigs/default.mhskel')))
def joint(V, name): return V[skel['joints'][name]].mean(0)
def bone_head(V, b): return joint(V, skel['bones'][b]['head'])
def bone_tail(V, b): return joint(V, skel['bones'][b]['tail'])

def rot_between(a, b):
    a = a / np.linalg.norm(a); b = b / np.linalg.norm(b)
    v = np.cross(a, b); c = float(np.dot(a, b))
    if np.linalg.norm(v) < 1e-9: return np.eye(3)
    vx = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + vx + vx @ vx * (1 / (1 + c))

def affine(R, pivot, prev=None):
    M = np.eye(4); M[:3, :3] = R; M[:3, 3] = pivot - R @ pivot
    return M @ prev if prev is not None else M

def apply(M, P): return P @ M[:3, :3].T + M[:3, 3]

# ----------------------------------------------------------------------------- build one character
def fit(proxy, V):
    sc = np.ones(3)
    for k, ax in (('x', 0), ('y', 1), ('z', 2)):
        if k in proxy['scales']:
            a, b, d = proxy['scales'][k]; sc[ax] = abs(V[a, ax] - V[b, ax]) / d
    P = (V[proxy['refs']] * proxy['ws'][..., None]).sum(1) + proxy['offs'] * sc
    W = (W_base[proxy['refs']] * proxy['ws'][..., None]).sum(1)
    return P, W

def region_uv(T, region, atlas):
    x0, y0, w, h = region; AW, AH = atlas
    u = (x0 + T[:, 0] * w) / AW; v = 1 - (y0 + (1 - T[:, 1]) * h) / AH
    return np.stack([u, v], 1)

ATLAS = (2048, 1536)
REG = {'skin': (0, 0, 1024, 1024), 'cloth': (1024, 0, 1024, 1024), 'shoes': (0, 1024, 512, 512), 'hair': (512, 1024, 512, 512), 'brow': (1024, 1024, 256, 256), 'eye': (1280, 1024, 256, 256)}

def build(name, spec):
    V = morph(spec)
    parts = []
    # Body minus whatever the clothes and shoes cover.
    proxies = {k: load_mhclo(spec[k]) for k in ('cloth', 'shoes', 'hair', 'brow', 'eyes') if spec.get(k)}
    hidden = set()
    for k in ('cloth', 'shoes'):
        if k in proxies: hidden |= proxies[k]['delete']
    bf = [f for f in base_F if f[2] == 'body' and not any(v in hidden for v in f[0])]
    parts.append(('skin', V, W_base, base_T, bf))
    for k in ('cloth', 'shoes', 'hair', 'brow', 'eyes'):
        if k not in proxies: continue
        px = proxies[k]
        PV, PT, PF = load_obj(os.path.join(px['dir'], px['obj']))
        P, W = fit(px, V)
        parts.append(({'eyes': 'eye'}.get(k, k), P, W, PT, PF))
    # Joints of the morphed body (MakeHuman dm units), before reposing.
    J = {
        'hips': bone_head(V, 'root'), 'spine': bone_head(V, 'spine03'), 'chest': bone_head(V, 'spine01'), 'neck': bone_head(V, 'neck01'), 'head': bone_head(V, 'head'),
        'armL': bone_head(V, 'upperarm01.L'), 'foreL': bone_head(V, 'lowerarm01.L'), 'handL': bone_head(V, 'wrist.L'), 'tipL': bone_tail(V, 'finger3-3.L'),
        'armR': bone_head(V, 'upperarm01.R'), 'foreR': bone_head(V, 'lowerarm01.R'), 'handR': bone_head(V, 'wrist.R'), 'tipR': bone_tail(V, 'finger3-3.R'),
        'thighL': bone_head(V, 'upperleg01.L'), 'shinL': bone_head(V, 'lowerleg01.L'), 'footL': bone_head(V, 'foot.L'),
        'thighR': bone_head(V, 'upperleg01.R'), 'shinR': bone_head(V, 'lowerleg01.R'), 'footR': bone_head(V, 'foot.R'),
    }
    # Repose: arms hang at the sides, angled out a touch so heavy builds clear the hips.
    M = {b: np.eye(4) for b in BONES}
    for side, sg in (('L', 1), ('R', -1)):
        down = np.array([0.13 * sg, -1.0, 0.03]); down /= np.linalg.norm(down)
        S, E, Wr, Tp = J['arm' + side], J['fore' + side], J['hand' + side], J['tip' + side]
        Ma = affine(rot_between(E - S, down), S)
        E1, W1, T1 = apply(Ma, E[None])[0], apply(Ma, Wr[None])[0], apply(Ma, Tp[None])[0]
        Mf = affine(rot_between(W1 - E1, down), E1, Ma)
        W2, T2 = apply(Mf, Wr[None])[0], apply(Mf, Tp[None])[0]
        Mh = affine(rot_between(T2 - W2, down), W2, Mf)
        M['arm' + side], M['fore' + side], M['hand' + side] = Ma, Mf, Mh
        J['fore' + side], J['hand' + side] = E1, W2
    def repose(P, W):
        out = np.zeros_like(P)
        for b in BONES:
            w = W[:, BI[b]]
            if not w.any(): continue
            out += apply(M[b], P) * w[:, None]
        rest = 1 - W.sum(1); out += P * rest[:, None]
        return out
    # Assemble vertices split by (position, uv) and triangulate.
    pos, nor, uv, si, sw, idx = [], [], [], [], [], []
    base = 0
    for region, P, W, T, F in parts:
        P = repose(P, W)
        # Smooth normals per part.
        N = np.zeros_like(P)
        for vs, ts, g in F:
            for k in range(1, len(vs) - 1):
                a, b, c = P[vs[0]], P[vs[k]], P[vs[k + 1]]
                n = np.cross(b - a, c - a); N[vs[0]] += n; N[vs[k]] += n; N[vs[k + 1]] += n
        N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
        UV = region_uv(T, REG[region], ATLAS)
        key = {}
        for vs, ts, g in F:
            loc = []
            for v, t in zip(vs, ts):
                k = (v, t)
                if k not in key:
                    key[k] = base + len(key)
                    pos.append(P[v]); nor.append(N[v]); uv.append(UV[max(t, 0)])
                    w = W[v]; top = np.argsort(-w)[:4]; ww = w[top]; ww = ww / max(ww.sum(), 1e-9)
                    si.append(top); sw.append(ww)
                loc.append(key[k])
            for k in range(1, len(loc) - 1): idx.append((loc[0], loc[k], loc[k + 1]))
        base += len(key)
    pos = np.array(pos) * 0.1; J = {k: v * 0.1 for k, v in J.items()}
    ground = pos[:, 1].min(); pos[:, 1] -= ground
    for k in J: J[k] = J[k] - np.array([0, ground, 0])
    nor = np.array(nor); uv = np.clip(np.array(uv), 0, 1); si = np.array(si); sw = np.array(sw); idx = np.array(idx)
    assert len(pos) < 65536, len(pos)
    # Pack: header JSON then buffers (int16 mm positions, int8 normals, uint16 uv, uint8 skin index/weight, uint16 index).
    q = np.clip(np.round(pos * 1000), -32767, 32767).astype('<i2')
    n8 = np.clip(np.round(nor * 127), -127, 127).astype('i1'); n8 = np.concatenate([n8, np.zeros((len(n8), 1), 'i1')], 1)
    u16 = np.round(uv * 65535).astype('<u2')
    sw8 = np.round(sw * 255).astype(np.int64); sw8[:, 0] += 255 - sw8.sum(1); sw8 = sw8.astype('u1')
    si8 = si.astype('u1'); ix = idx.astype('<u2').reshape(-1)
    joints = {b: [round(float(x), 4) for x in J[b]] for b in BONES if b in J}
    head = json.dumps({'v': 1, 'nV': len(pos), 'nI': len(ix), 'joints': joints, 'height': round(float(pos[:, 1].max()), 3)}).encode()
    head += b' ' * ((4 - len(head) % 4) % 4)
    with open(os.path.join(OUT, name + '.bin'), 'wb') as f:
        f.write(b'AUHM'); f.write(struct.pack('<I', len(head))); f.write(head)
        for arr in (q, n8, u16, si8, sw8, ix):
            b = arr.tobytes(); f.write(b); f.write(b'\0' * ((4 - len(b) % 4) % 4))
    atlas(name, spec, proxies)
    print(name, 'verts', len(pos), 'tris', len(idx), 'height', round(float(pos[:, 1].max()), 2), 'hips', joints['hips'])

# ----------------------------------------------------------------------------- textures
def tex_path(px, key):
    for line in open(os.path.join(px['dir'], px['material']), encoding='utf-8', errors='ignore'):
        p = line.split()
        if p and p[0] == key: return os.path.join(px['dir'], p[1])
    return None

def skin_image(spec):
    mix = None
    for path, w in spec['skin']:
        im = np.asarray(Image.open(os.path.join(SYS, path)).convert('RGB').resize((1024, 1024), Image.LANCZOS), dtype=np.float32)
        mix = im * w if mix is None else mix + im * w
    mix *= np.array(spec.get('skinTint', [1, 1, 1]), dtype=np.float32)
    return Image.fromarray(np.clip(mix, 0, 255).astype(np.uint8))

def recolour(img, rule):
    if not rule: return img
    a = np.asarray(img.convert('RGB'), dtype=np.float32) / 255
    mx, mn = a.max(2), a.min(2); sat = (mx - mn) / np.maximum(mx, 1e-6)
    mask = ((sat < rule.get('sat', 0.16)) & (mx > rule.get('val', 0.45))).astype(np.float32)[..., None]
    target = np.array(rule['to'], dtype=np.float32)
    lum = a.mean(2, keepdims=True)
    out = a * (1 - mask) + (lum * target / max(target.mean(), 1e-3) * rule.get('k', 0.6) if rule.get('keep') else target * (0.55 + 0.45 * lum)) * mask
    return Image.fromarray(np.clip(out * 255, 0, 255).astype(np.uint8))

def atlas(name, spec, proxies):
    A = Image.new('RGB', ATLAS, (128, 128, 128)); Nm = Image.new('RGB', (ATLAS[0] // 2, ATLAS[1] // 2), (128, 128, 255)); Al = Image.new('L', ATLAS, 255)
    def put(img, region, normal=None, alpha=None):
        x, y, w, h = region
        A.paste(img.convert('RGB').resize((w, h), Image.LANCZOS), (x, y))
        if normal is not None: Nm.paste(normal.convert('RGB').resize((w // 2, h // 2), Image.LANCZOS), (x // 2, y // 2))
        if alpha is not None: Al.paste(alpha.resize((w, h), Image.LANCZOS), (x, y))
    put(skin_image(spec), REG['skin'])
    for k in ('cloth', 'shoes', 'hair', 'brow'):
        if k not in proxies: continue
        px = proxies[k]; d = tex_path(px, 'diffuseTexture'); nm = tex_path(px, 'normalmapTexture')
        img = Image.open(d)
        alpha = img.getchannel('A') if img.mode in ('RGBA', 'LA') else None
        rgb = img.convert('RGB')
        if k == 'cloth': rgb = recolour(rgb, spec.get('clothColour'))
        if k == 'hair' and spec.get('hairTint'): rgb = Image.fromarray(np.clip(np.asarray(rgb, np.float32) * np.array(spec['hairTint']), 0, 255).astype(np.uint8))
        if k == 'brow': rgb = Image.new('RGB', rgb.size, tuple(spec.get('browRGB', (28, 20, 16))))
        put(rgb, REG['region' if False else {'brow': 'brow'}.get(k, k)], Image.open(nm) if nm and os.path.exists(nm) else None, alpha)
    if 'eyes' in proxies:
        put(Image.open(os.path.join(SYS, 'eyes/materials/' + spec.get('eyeColour', 'brown') + '_eye.png')), REG['eye'])
    A.save(os.path.join(OUT, name + '.jpg'), quality=84, optimize=True, progressive=True)
    Nm.save(os.path.join(OUT, name + '_n.jpg'), quality=82, optimize=True)
    Al.save(os.path.join(OUT, name + '_a.png'), optimize=True)

# ----------------------------------------------------------------------------- the cast
C = lambda n: os.path.join(SYS, 'clothes', n, n + '.mhclo')
H = lambda n: os.path.join(SYS, 'hair', n, n + '.mhclo')
BROW = os.path.join(SYS, 'eyebrows/eyebrow001/eyebrow001.mhclo')
EYES = os.path.join(MHD, 'eyes/low-poly/low-poly.mhclo')
POLY = [('skins/young_african_male/young_darkskinned_male_diffuse.png', 0.55), ('skins/young_asian_male/young_lightskinned_male_diffuse3.png', 0.45)]
POLY_MID = [('skins/middleage_african_male/middleage_darkskinned_male_diffuse.png', 0.55), ('skins/middleage_asian_male/middleage_lightskinned_male_diffuse2.png', 0.45)]
POLY_OLD = [('skins/old_african_male/old_darkskinned_male_diffuse.png', 0.55), ('skins/old_asian_male/old_lightskinned_male_diffuse2.png', 0.45)]
PAKEHA = [('skins/young_caucasian_male/young_lightskinned_male_diffuse.png', 1.0)]
POLY_RACE = {'african': 0.35, 'asian': 0.35, 'caucasian': 0.30}
BLACK = {'to': [0.07, 0.07, 0.08]}
CAST = {
    'manu':   dict(gender=1, age=0.47, muscle=0.6, weight=0.88, height=0.6, race=POLY_RACE, skin=POLY, skinTint=[1.02, 0.97, 0.92], cloth=C('male_casualsuit06'), clothColour=BLACK, shoes=C('shoes05'), hair=H('afro01'), hairTint=[0.55, 0.5, 0.48]),
    'shorty': dict(gender=1, age=0.56, muscle=0.62, weight=1.0, height=0.5, race=POLY_RACE, skin=POLY_MID, cloth=C('male_casualsuit03'), shoes=C('shoes03'), hair=H('short01')),
    'darren': dict(gender=1, age=0.5, muscle=0.45, weight=0.38, height=0.5, race={'caucasian': 0.9, 'african': 0.05, 'asian': 0.05}, skin=PAKEHA, cloth=C('male_casualsuit05'), shoes=C('shoes04'), hair=H('short02'), hairTint=[0.8, 0.7, 0.6], browRGB=(70, 52, 36), eyeColour='bluegreen'),
    'kev':    dict(gender=1, age=0.62, muscle=0.78, weight=0.7, height=0.62, race=POLY_RACE, skin=POLY_MID, skinTint=[0.95, 0.92, 0.9], cloth=C('male_worksuit01'), shoes=C('shoes03'), hair=H('short04')),
    'mikey':  dict(gender=1, age=0.42, muscle=0.4, weight=0.3, height=0.45, race={'asian': 0.45, 'african': 0.25, 'caucasian': 0.3}, skin=[(POLY[0][0], 0.35), (POLY[1][0], 0.65)], cloth=C('male_casualsuit06'), shoes=C('shoes06'), hair=H('short02'), hairTint=[0.35, 0.3, 0.28]),
    'pita':   dict(gender=1, age=0.84, muscle=0.4, weight=0.72, height=0.45, race=POLY_RACE, skin=POLY_OLD, cloth=C('male_casualsuit01'), shoes=C('shoes04'), hair=H('short01'), hairTint=[1.9, 1.9, 1.9], browRGB=(150, 145, 140)),
    'crewA':  dict(gender=1, age=0.5, muscle=0.7, weight=0.8, height=0.6, race=POLY_RACE, skin=POLY, cloth=C('male_casualsuit06'), clothColour={'to': [0.12, 0.12, 0.13]}, shoes=C('shoes04'), hair=H('short04')),
    'crewB':  dict(gender=1, age=0.55, muscle=0.6, weight=0.65, height=0.55, race=POLY_RACE, skin=POLY_MID, cloth=C('male_casualsuit05'), shoes=C('shoes03'), hair=H('short01')),
    'crewC':  dict(gender=1, age=0.45, muscle=0.5, weight=0.55, height=0.5, race={'asian': 0.4, 'african': 0.3, 'caucasian': 0.3}, skin=POLY, cloth=C('male_casualsuit03'), shoes=C('shoes05'), hair=H('afro01'), hairTint=[0.5, 0.45, 0.42]),
}
# Passers-by on the footpaths (two women, an older Pākehā man, a young guy, an aunty).
POLY_F = [('skins/young_african_female/young_darkskinned_female_diffuse.png', 0.55), ('skins/young_asian_female/young_lightskinned_female_diffuse3.png', 0.45)]
CAST.update({
    'pedF1': dict(gender=0, age=0.45, muscle=0.5, weight=0.7, height=0.5, race=POLY_RACE, skin=POLY_F, cloth=C('female_sportsuit01'), shoes=C('shoes05'), hair=H('ponytail01'), hairTint=[0.45, 0.4, 0.38], brow=os.path.join(SYS, 'eyebrows/eyebrow002/eyebrow002.mhclo')),
    'pedF2': dict(gender=0, age=0.5, muscle=0.45, weight=0.45, height=0.45, race={'caucasian': 0.6, 'asian': 0.4}, skin=[('skins/young_caucasian_female/young_lightskinned_female_diffuse.png', 1.0)], cloth=C('female_casualsuit01'), shoes=C('shoes06'), hair=H('bob01'), browRGB=(60, 45, 35), brow=os.path.join(SYS, 'eyebrows/eyebrow002/eyebrow002.mhclo'), eyeColour='brownlight'),
    'pedF3': dict(gender=0, age=0.66, muscle=0.4, weight=0.9, height=0.4, race=POLY_RACE, skin=[('skins/middleage_african_female/middleage_darkskinned_female_diffuse.png', 0.6), ('skins/middleage_asian_female/middleage_lightskinned_female_diffuse2.png', 0.4)], cloth=C('female_casualsuit02'), shoes=C('shoes04'), hair=H('bob01'), hairTint=[0.4, 0.38, 0.36], brow=os.path.join(SYS, 'eyebrows/eyebrow002/eyebrow002.mhclo')),
    'pedM1': dict(gender=1, age=0.7, muscle=0.45, weight=0.62, height=0.5, race={'caucasian': 0.95, 'asian': 0.05}, skin=[('skins/middleage_caucasian_male/middleage_lightskinned_male_diffuse.png', 1.0)], cloth=C('male_casualsuit02'), shoes=C('shoes02'), hair=H('short03'), hairTint=[1.4, 1.35, 1.3], browRGB=(110, 100, 90), eyeColour='blue'),
    'pedM2': dict(gender=1, age=0.38, muscle=0.55, weight=0.55, height=0.55, race=POLY_RACE, skin=POLY, cloth=C('male_casualsuit06'), clothColour={'to': [0.6, 0.09, 0.09]}, shoes=C('shoes06'), hair=H('short04')),
})
ONLY = [x for x in os.environ.get('PEOPLE_ONLY', '').split(',') if x]
for nm, sp in CAST.items():
    if ONLY and nm not in ONLY: continue
    sp.setdefault('brow', BROW); sp.setdefault('eyes', EYES)
    build(nm, sp)
