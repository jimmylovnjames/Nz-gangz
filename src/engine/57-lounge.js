// Prologue set: the cousin's lounge at night. Separate scene; the CRT shows the live mini-game canvas.
Object.assign(CANVAS_TEX, {
  carpet: () => canvasTexture(256, 256, (g, w, h) => {
    const r = mulberry32(21); g.fillStyle = '#5b4a3e'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { const v = r(); g.fillStyle = v < 0.5 ? `rgba(30,20,15,${0.25 * r()})` : `rgba(140,115,95,${0.22 * r()})`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
    g.fillStyle = 'rgba(20,12,8,0.18)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(r() * w, r() * h, 10 + r() * 30, 6 + r() * 20, r() * 3, 0, TAU); g.fill(); }
  }),
  fabric: () => canvasTexture(256, 256, (g, w, h) => {
    const r = mulberry32(4); g.fillStyle = '#4c5258'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(0,0,0,${0.08 + 0.06 * (y % 4 === 0)})`; g.fillRect(0, y, w, 1); }
    for (let x = 0; x < w; x += 2) { g.fillStyle = 'rgba(255,255,255,0.03)'; g.fillRect(x, 0, 1, h); }
    for (let i = 0; i < 25; i++) { g.fillStyle = `rgba(20,15,10,${0.15 * r()})`; g.beginPath(); g.arc(r() * w, r() * h, 4 + r() * 16, 0, TAU); g.fill(); }
  }),
  posters: () => canvasTexture(512, 256, (g, w, h) => {
    // Left: the game's own poster. Right: a local rugby team photo poster (fictional).
    let gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2b1d4a'); gr.addColorStop(1, '#e88a4a'); g.fillStyle = gr; g.fillRect(0, 0, 256, h);
    g.fillStyle = '#ffd84a'; g.font = 'bold 34px Impact, Arial Black, sans-serif'; g.textAlign = 'center'; g.fillText('KIWI KNUCKLE', 128, 52); g.fillText('KINGS 2', 128, 90);
    g.fillStyle = '#9ad8ff'; g.font = 'bold 16px Arial'; g.fillText('TURBO EDITION', 128, 112);
    g.fillStyle = '#2f5fd0'; g.fillRect(60, 130, 40, 90); g.fillStyle = '#8a5a3c'; g.fillRect(66, 112, 28, 24);
    g.fillStyle = '#d23a2a'; g.fillRect(156, 130, 40, 90); g.fillStyle = '#c99272'; g.fillRect(162, 112, 28, 24);
    g.fillStyle = '#fff'; g.font = 'bold 14px Arial'; g.fillText('2 PLAYER ACTION!', 128, 244);
    g.fillStyle = '#e9e4d8'; g.fillRect(256, 0, 256, h); g.fillStyle = '#1a3a6a'; g.fillRect(264, 8, 240, 30);
    g.fillStyle = '#fff'; g.font = 'bold 20px Arial'; g.fillText('NORTHERN KAHU RFC', 384, 30);
    g.fillStyle = '#6b8a5a'; g.fillRect(264, 44, 240, 170);
    for (let row = 0; row < 2; row++) for (let i = 0; i < 8; i++) {
      const x = 280 + i * 28, y = 90 + row * 56; g.fillStyle = '#1a3a6a'; g.fillRect(x - 9, y + 10, 20, 34); g.fillStyle = ['#6b4029', '#8a5a3c', '#c99272'][(i + row) % 3]; g.fillRect(x - 6, y - 4, 14, 14);
    }
    g.fillStyle = '#333'; g.font = 'bold 14px Arial'; g.fillText('1998 CHAMPIONS', 384, 238);
  }),
  nightWindow: () => canvasTexture(256, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0b1020'); gr.addColorStop(0.7, '#1a1a26'); gr.addColorStop(1, '#2a2018'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const s = g.createRadialGradient(180, 70, 2, 180, 70, 70); s.addColorStop(0, 'rgba(255,190,110,1)'); s.addColorStop(0.15, 'rgba(255,160,80,0.6)'); s.addColorStop(1, 'rgba(255,140,60,0)');
    g.fillStyle = s; g.fillRect(0, 0, w, h); g.fillStyle = '#05070c'; g.fillRect(0, 170, w, 86);
    g.fillStyle = '#0a0d14'; g.fillRect(20, 120, 70, 60); g.fillStyle = '#ffcf8a'; g.fillRect(34, 135, 12, 10); g.fillRect(60, 150, 10, 8);
  }),
});
Object.assign(MAT_DEFS, {
  carpet: { canvas: 'carpet', scale: 1.2 },
  fabric: { canvas: 'fabric', scale: 0.7, cast: 1 },
  lampOn: { color: 0x1d1d1d, emissive: 0xffc890, day: 2.2, night: 2.2 },
  posters: { canvas: 'posters', scale: 1 },
});

class Lounge {
  constructor(lib, charMaterial, game, renderer) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020203);
    this.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.05, 40);
    this.game = game;
    const b = new GeoBuilder(lib), W = 2.3, Z0 = -2.7, Z1 = 2.5, H = 2.45;
    const wallTint = [0.75, 0.68, 0.55];
    // Shell: carpet, painted walls, ceiling, skirting boards.
    b.rect('carpet', [-W, 0, Z1], [1, 0, 0], [0, 0, -1], W * 2, Z1 - Z0);
    b.rect('plaster', [-W, H, Z0], [1, 0, 0], [0, 0, 1], W * 2, Z1 - Z0, { tint: [0.85, 0.83, 0.78] });
    b.rect('plaster', [-W, 0, Z0], [1, 0, 0], [0, 1, 0], W * 2, H, { tint: wallTint });
    b.rect('plaster', [W, 0, Z1], [-1, 0, 0], [0, 1, 0], W * 2, H, { tint: wallTint });
    b.rect('plaster', [W, 0, Z0], [0, 0, 1], [0, 1, 0], Z1 - Z0, H, { tint: wallTint });
    // Left wall with a window opening (z -1.0 .. 0.6, y 0.9 .. 2.0).
    const wz0 = -1.0, wz1 = 0.6, wy0 = 0.9, wy1 = 2.0;
    b.rect('plaster', [-W, 0, Z1], [0, 0, -1], [0, 1, 0], Z1 - wz1, H, { tint: wallTint });
    b.rect('plaster', [-W, 0, wz0], [0, 0, -1], [0, 1, 0], wz0 - Z0, H, { tint: wallTint });
    b.rect('plaster', [-W, 0, wz1], [0, 0, -1], [0, 1, 0], wz1 - wz0, wy0, { tint: wallTint });
    b.rect('plaster', [-W, wy1, wz1], [0, 0, -1], [0, 1, 0], wz1 - wz0, H - wy1, { tint: wallTint });
    for (const [x0, z0, x1, z1] of [[-W, Z0, W, Z0 + 0.02], [-W, Z1 - 0.02, W, Z1], [-W, Z0, -W + 0.02, Z1], [W - 0.02, Z0, W, Z1]]) b.box('trim', (x0 + x1) / 2, 0, (z0 + z1) / 2, Math.max(0.03, x1 - x0), 0.1, Math.max(0.03, z1 - z0), { tint: [0.9, 0.88, 0.82] });
    b.box('trim', -W + 0.03, wy0 - 0.05, (wz0 + wz1) / 2, 0.12, 0.05, wz1 - wz0 + 0.1, { tint: [0.9, 0.88, 0.82] });
    // TV cabinet, CRT, console.
    b.box('wood', 0, 0, -2.42, 1.6, 0.5, 0.5, { aoBottom: 0.6 });
    b.box('trim', 0, 0.5, -2.42, 1.64, 0.04, 0.54, { tint: [0.3, 0.22, 0.15] });
    b.box('trim', 0, 0.54, -2.42, 0.78, 0.62, 0.56, { tint: [0.035, 0.035, 0.04] });
    b.box('trim', 0, 0.62, -2.36, 0.62, 0.48, 0.5, { tint: [0.02, 0.02, 0.025] });
    b.box('trim', -0.45, 0.1, -2.15, 0.36, 0.08, 0.26, { tint: [0.1, 0.1, 0.11] });
    b.box('lampOn', -0.34, 0.12, -2.019, 0.02, 0.02, 0.01);
    // Couch.
    const fab = [1, 1, 1];
    b.box('fabric', 0, 0, 1.62, 2.3, 0.4, 0.95, { tint: fab, aoBottom: 0.5 });
    b.box('fabric', -0.55, 0.4, 1.56, 1.06, 0.12, 0.82, { tint: [0.95, 0.95, 0.95] });
    b.box('fabric', 0.55, 0.4, 1.56, 1.06, 0.12, 0.82, { tint: [0.92, 0.92, 0.92] });
    b.box('fabric', 0, 0.4, 2.0, 2.3, 0.62, 0.22, { tint: fab });
    for (const x of [-1.22, 1.22]) b.box('fabric', x, 0, 1.62, 0.2, 0.66, 0.95, { tint: fab });
    b.box('trim', -1.18, 0.66, 1.5, 0.3, 0.12, 0.5, { tint: [0.6, 0.1, 0.1] });
    // Coffee table with cans, chips and a pizza box.
    b.box('wood', 0, 0.36, 0.45, 1.2, 0.05, 0.6);
    for (const [x, z] of [[-0.55, 0.2], [0.55, 0.2], [-0.55, 0.7], [0.55, 0.7]]) b.box('trim', x, 0, z, 0.05, 0.36, 0.05, { tint: [0.25, 0.18, 0.12] });
    const r = mulberry32(8);
    for (let i = 0; i < 7; i++) {
      const x = -0.5 + r() * 1.0, z = 0.22 + r() * 0.45, down = i > 4;
      const tint = [[0.7, 0.05, 0.05], [0.05, 0.25, 0.6], [0.8, 0.75, 0.1], [0.1, 0.5, 0.15]][i % 4];
      if (down) { b.setTransform(new THREE.Matrix4().makeRotationZ(Math.PI / 2).setPosition(x, 0.45, z)); b.cylinder('metal', 0, -0.06, 0, 0.033, 0.033, 0.12, 10, { tint, cap: true }); b.setTransform(null); }
      else b.cylinder('metal', x, 0.41, z, 0.033, 0.033, 0.12, 10, { tint, cap: true });
    }
    b.box('trim', 0.25, 0.41, 0.52, 0.4, 0.04, 0.4, { tint: [0.75, 0.6, 0.4] });
    b.box('trim', -0.2, 0.41, 0.4, 0.18, 0.08, 0.12, { tint: [0.9, 0.7, 0.1] });
    // Floor lamp in the corner, door, posters.
    b.cylinder('metal', -1.85, 0, 2.05, 0.14, 0.14, 0.03, 12, { tint: [0.1, 0.1, 0.1], cap: true });
    b.cylinder('metal', -1.85, 0.03, 2.05, 0.015, 0.015, 1.4, 8, { tint: [0.2, 0.2, 0.2] });
    b.cylinder('lampOn', -1.85, 1.35, 2.05, 0.24, 0.16, 0.3, 14);
    b.rect('trim', [W - 0.01, 0, -1.6], [0, 0, 1], [0, 1, 0], 0.86, 2.05, { tint: [0.45, 0.32, 0.22] });
    b.rect('posters', [W - 0.02, 1.15, 0.2], [0, 0, 1], [0, 1, 0], 0.62, 0.9, { uv: [0, 0, 0.5, 0, 0.5, 1, 0, 1] });
    b.rect('posters', [-0.2, 1.2, Z1 - 0.02], [-1, 0, 0], [0, 1, 0], 0.9, 0.85, { uv: [0.5, 0, 1, 0, 1, 1, 0.5, 1] });
    b.finish(this.scene);
    // Window: night view, frame and half-drawn curtains.
    const night = new THREE.Mesh(new THREE.PlaneGeometry(wz1 - wz0, wy1 - wy0), new THREE.MeshBasicMaterial({ map: CANVAS_TEX.nightWindow() }));
    night.position.set(-W - 0.05, (wy0 + wy1) / 2, (wz0 + wz1) / 2); night.rotation.y = Math.PI / 2; this.scene.add(night);
    const curtainMat = new THREE.MeshStandardMaterial({ color: 0x6a2a2a, roughness: 0.9, side: THREE.DoubleSide });
    for (const [z, w] of [[wz0 + 0.25, 0.6], [wz1 - 0.2, 0.5]]) {
      const g = new THREE.PlaneGeometry(w, 1.5, 12, 1), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 28) * 0.025);
      g.computeVertexNormals();
      const c = new THREE.Mesh(g, curtainMat); c.position.set(-W + 0.08, 1.35, z); c.rotation.y = Math.PI / 2; this.scene.add(c);
    }
    // CRT screen with the live game, slightly bulged.
    this.tex = new THREE.CanvasTexture(game.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.magFilter = THREE.NearestFilter; this.tex.minFilter = THREE.LinearFilter; this.tex.generateMipmaps = false;
    const sg = new THREE.PlaneGeometry(0.6, 0.45, 16, 12), sp = sg.attributes.position;
    for (let i = 0; i < sp.count; i++) sp.setZ(i, 0.02 * (1 - (sp.getX(i) / 0.3) ** 2) * (1 - (sp.getY(i) / 0.225) ** 2));
    this.screen = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ map: this.tex, color: new THREE.Color(1.35, 1.35, 1.35) }));
    this.screen.position.set(0, 0.87, -2.105); this.scene.add(this.screen);
    this.screenCenter = new THREE.Vector3(0, 0.87, -2.1);
    // Lights: lamp, TV glow, a little moonlight and bounce.
    // Lamp behind the player's end of the couch lights Manu's face; a cool spill from the hallway fills the room.
    this.lamp = new THREE.PointLight(0xffa35a, 3.2, 8, 1.8); this.lamp.position.set(-1.85, 1.5, 2.05); this.scene.add(this.lamp);
    this.tvLight = new THREE.PointLight(0x8aa8ff, 2, 6, 1.6); this.tvLight.position.set(0, 1.0, -1.0); this.scene.add(this.tvLight);
    const hall = new THREE.SpotLight(0xc8d4ff, 2.2, 9, 0.7, 0.8, 1.5); hall.position.set(2.1, 2.0, -1.2); hall.target.position.set(0, 0.8, 1.4); this.scene.add(hall, hall.target);
    this.scene.add(new THREE.HemisphereLight(0x2c3448, 0x1a120c, 0.35));
    const moon = new THREE.DirectionalLight(0x7d93c8, 0.35); moon.position.set(-5, 3, 0); this.scene.add(moon);
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; this.scene.environmentIntensity = 0.12;
    // Cousin on the couch with his controller.
    this.cousin = new Human(charMaterial, { seed: 4242, skin: 0x7a4b31, top: 0x2a2d33, topCell: ATLAS.cotton, pants: 0x3a3a3a, pantsCell: ATLAS.track, face: ATLAS.faceC, beanie: 0x1a1a1a, pose: 'seated', scale: 1.02 });
    this.cousin.root.position.set(0.62, 0.02, 1.6); this.cousin.root.rotation.y = Math.PI;
    this.scene.add(this.cousin.root);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.03, 0.08), new THREE.MeshStandardMaterial({ color: 0x1b1b1d, roughness: 0.5 }));
    pad.position.set(0.04, -0.06, 0.06); this.cousin.bones[BONE.handR].add(pad);
    this.seat = new THREE.Vector3(-0.7, 1.1, 1.62);
    this.camera.position.copy(this.seat);
    this.look = 'cousin'; this.q = new THREE.Quaternion(); this.qTarget = new THREE.Quaternion(); this.fov = 55; this.time = 0;
    this.glowColor = new THREE.Color(); this.glowT = 0;
    this.aimAt(this.cousinHead(), true);
  }
  cousinHead() { return new THREE.Vector3(0.6, 1.14, 1.6); }
  aimAt(p, snap) {
    const m = new THREE.Matrix4().lookAt(this.camera.position, p, new THREE.Vector3(0, 1, 0));
    this.qTarget.setFromRotationMatrix(m);
    if (snap) { this.q.copy(this.qTarget); this.camera.quaternion.copy(this.q); }
  }
  // Field of view that frames the TV (portrait phones need a narrow vertical FOV to fill the width).
  tvFov() {
    const d = this.camera.position.distanceTo(this.screenCenter), aspect = this.camera.aspect;
    const vForH = 2 * Math.atan(0.45 * 1.25 / 2 / d), vForW = 2 * Math.atan(Math.tan(Math.atan(0.6 * 1.18 / 2 / d)) / aspect);
    return THREE.MathUtils.radToDeg(Math.max(vForH, vForW));
  }
  update(dt, talking) {
    this.time += dt;
    const tv = this.look === 'tv';
    this.aimAt(tv ? this.screenCenter : this.cousinHead());
    this.q.slerp(this.qTarget, 1 - Math.exp(-dt * 3.2));
    const sway = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(this.time * 0.9) * 0.006, Math.sin(this.time * 0.6) * 0.008, 0));
    this.camera.quaternion.copy(this.q).multiply(sway);
    const want = tv ? this.tvFov() : 64;
    this.fov = lerp(this.fov, want, 1 - Math.exp(-dt * 3));
    if (Math.abs(this.camera.fov - this.fov) > 0.01) { this.camera.fov = this.fov; this.camera.updateProjectionMatrix(); }
    const h = this.cousin;
    h.lookYaw = lerp(h.lookYaw, talking && !tv ? 1.05 : (talking ? 0.4 : 0), 1 - Math.exp(-dt * 5));
    h.playing = this.game.phase === 'fight';
    h.update(dt, this.time);
    this.tex.needsUpdate = true;
    if ((this.glowT -= dt) <= 0) {
      this.glowT = 0.08;
      this.game.glow(this.glowColor);
      const lum = this.glowColor.r * 0.3 + this.glowColor.g * 0.59 + this.glowColor.b * 0.11;
      this.tvLight.color.copy(this.glowColor).multiplyScalar(1 / Math.max(lum, 0.05)).lerp(new THREE.Color(0x8aa8ff), 0.3);
      this.tvLight.intensity = 1.5 + lum * 4;
    }
  }
}
