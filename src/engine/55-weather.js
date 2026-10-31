// GPU rain: instanced streaks wrapped around the camera, animated entirely in the vertex shader.
class Rain {
  constructor(scene, maxDrops) {
    const base = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index; g.setAttribute('position', base.attributes.position); g.setAttribute('uv', base.attributes.uv);
    const off = new Float32Array(maxDrops * 3), rnd = new Float32Array(maxDrops), r = mulberry32(5);
    for (let i = 0; i < maxDrops; i++) { off[i * 3] = r(); off[i * 3 + 1] = r(); off[i * 3 + 2] = r(); rnd[i] = r(); }
    g.setAttribute('aOffset', new THREE.InstancedBufferAttribute(off, 3));
    g.setAttribute('aRand', new THREE.InstancedBufferAttribute(rnd, 1));
    g.instanceCount = 0;
    this.max = maxDrops;
    this.uniforms = {
      uTime: G.uTime, uCam: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(34, 22, 34) },
      uSpeed: { value: 17 }, uLen: { value: 0.6 }, uWidth: { value: 0.011 }, uWindV: { value: new THREE.Vector2(1.2, 0.5) },
      uColor: { value: new THREE.Color(0.75, 0.8, 0.85) }, uIntensity: { value: 1 },
    };
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute vec3 aOffset; attribute float aRand;
        uniform float uTime; uniform vec3 uCam; uniform vec3 uBox; uniform float uSpeed; uniform float uLen; uniform float uWidth; uniform vec2 uWindV;
        varying vec2 vQ; varying float vFade;
        void main(){
          vec3 vel = vec3(uWindV.x, -uSpeed * (0.85 + 0.3 * aRand), uWindV.y);
          vec3 p = aOffset * uBox + vel * uTime;
          p = mod(p - uCam + uBox * 0.5, uBox) + uCam - uBox * 0.5;
          vec3 dir = normalize(vel), toCam = normalize(cameraPosition - p);
          vec3 side = normalize(cross(dir, toCam)) * uWidth;
          vec3 wp = p + side * position.x * 2.0 - dir * uLen * position.y;
          float d = distance(p, cameraPosition);
          vFade = smoothstep(0.6, 3.0, d) * (1.0 - smoothstep(10.0, 17.0, d));
          vQ = vec2(position.x + 0.5, position.y);
          gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 uColor; uniform float uIntensity; varying vec2 vQ; varying float vFade;
        void main(){
          float a = (1.0 - abs(vQ.x * 2.0 - 1.0)) * smoothstep(0.0, 0.35, vQ.y) * smoothstep(1.0, 0.6, vQ.y) * vFade * 0.32 * uIntensity;
          gl_FragColor = vec4(uColor * a, a);
        }`,
    }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 5;
    scene.add(this.mesh);
  }
  set(level, quality, night) {
    const counts = [0, 0.35, 1];
    this.mesh.geometry.instanceCount = Math.floor(Math.min(this.max, quality.rain) * counts[level]);
    this.mesh.visible = level > 0;
    this.uniforms.uColor.value.setRGB(night ? 0.35 : 0.75, night ? 0.36 : 0.8, night ? 0.4 : 0.85);
    G.uWet.value = [0, 0.7, 1][level];
    G.uRain.value = [0, 0.35, 1][level];
  }
  update(camera) { this.uniforms.uCam.value.copy(camera.position); }
}
