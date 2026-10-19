// Rain belongs outside the closed cabin. These are conservative bounds around
// both preserved cabins, including the fixed FPV eye, dashboard and side glass.
// Test whole streaks, not just endpoints: a long/slanted line can cross the cabin
// with both endpoints outside it. All buffers and scratch vectors are reused.
const RAIN_CABIN = Object.freeze({ minX: -.96, maxX: .96, minY: .20, maxY: 1.36, minZ: -1.32, maxZ: 1.76 });
function rainSegmentIntersectsCabin(ax, ay, az, bx, by, bz) {
  let near = 0, far = 1;
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  if (Math.abs(dx) < 1e-10) { if (ax < RAIN_CABIN.minX || ax > RAIN_CABIN.maxX) return false; }
  else {
    const a = (RAIN_CABIN.minX - ax) / dx, b = (RAIN_CABIN.maxX - ax) / dx;
    near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b));
    if (near > far) return false;
  }
  if (Math.abs(dy) < 1e-10) { if (ay < RAIN_CABIN.minY || ay > RAIN_CABIN.maxY) return false; }
  else {
    const a = (RAIN_CABIN.minY - ay) / dy, b = (RAIN_CABIN.maxY - ay) / dy;
    near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b));
    if (near > far) return false;
  }
  if (Math.abs(dz) < 1e-10) { if (az < RAIN_CABIN.minZ || az > RAIN_CABIN.maxZ) return false; }
  else {
    const a = (RAIN_CABIN.minZ - az) / dz, b = (RAIN_CABIN.maxZ - az) / dz;
    near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b));
    if (near > far) return false;
  }
  return true;
}
const rainCabinInverse = new THREE.Matrix4();
const rainCabinCenter = new THREE.Vector3();
const rainCabinHead = new THREE.Vector3(), rainCabinTail = new THREE.Vector3();
function updateExteriorRain(dt) {
  if (weatherIndex !== 1 || !rainLinesMesh.visible) return;
  rainLinesMesh.position.set(state.x, Math.max(0, state.y - 20), currentMap === 'highway' ? 0 : state.z);
  roadsterAttitudeGroup.updateWorldMatrix(true, false);
  rainCabinInverse.copy(roadsterAttitudeGroup.matrixWorld).invert();
  rainCabinCenter.set(0, .78, .22).applyMatrix4(roadsterAttitudeGroup.matrixWorld);
  const offset = rainLinesMesh.position, arr = rainPositions;
  const slantZ = (currentMap === 'highway' ? -state.vz : state.vz) * .04;
  for (let i = 0; i < rainCount; i++) {
    const p = i * 6;
    const y = ((arr[p + 1] - 62 * dt) % 90 + 90) % 90;
    arr[p + 1] = y; arr[p + 3] = arr[p]; arr[p + 4] = y - 2.8; arr[p + 5] = arr[p + 2] + slantZ;
    const x = arr[p] + offset.x, headY = y + offset.y, z = arr[p + 2] + offset.z;
    // A radius enclosing the cabin rejects the distant 1500-line field cheaply.
    if (Math.abs(x - rainCabinCenter.x) > 2.2 || headY < rainCabinCenter.y - 2.2 || headY - 2.8 > rainCabinCenter.y + 2.2
      || Math.min(z, z + slantZ) > rainCabinCenter.z + 2.2 || Math.max(z, z + slantZ) < rainCabinCenter.z - 2.2) continue;
    rainCabinHead.set(x, headY, z).applyMatrix4(rainCabinInverse);
    rainCabinTail.set(x, headY - 2.8, z + slantZ).applyMatrix4(rainCabinInverse);
    if (rainSegmentIntersectsCabin(rainCabinHead.x, rainCabinHead.y, rainCabinHead.z, rainCabinTail.x, rainCabinTail.y, rainCabinTail.z)) {
      // Degenerate just this frame's crossing streak; the next frame rebuilds
      // its tail from its retained particle head. No respawn/allocation churn.
      arr[p + 3] = arr[p]; arr[p + 4] = y; arr[p + 5] = arr[p + 2];
    }
  }
  rainLinesMesh.geometry.attributes.position.needsUpdate = true;
}

// Eight small beads/trails, one 32-vertex draw. The vertices are sampled from
// the selected production glass triangles, not a camera overlay or cabin volume.
// The reference pane remains the original flat raked windshield; the classic
// pane follows its preserved curved canopy. No textures or per-frame allocations.
function createRainPane(mesh) {
  const position = mesh.geometry.attributes.position, normal = mesh.geometry.attributes.normal;
  let stride = 1;
  while (stride < position.count && Math.abs(position.getZ(stride) - position.getZ(0)) < 1e-6) stride++;
  return { position, normal, stride, rows: position.count / stride };
}
const rainPanes = {
  reference: createRainPane(carMeshGroup.getObjectByName('referencePanoramicCanopy')),
  classic: createRainPane(roadsterCanopyMesh)
};
function sampleRainPane(pane, u, z, output, offset) {
  const p = pane.position, n = pane.normal, stride = pane.stride;
  let low = 0, high = pane.rows - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (p.getZ(middle * stride) <= z) low = middle; else high = middle;
  }
  const tz = Math.max(0, Math.min(1, (z - p.getZ(low * stride)) / (p.getZ(high * stride) - p.getZ(low * stride))));
  const column = Math.max(0, Math.min(stride - 1.000001, u * (stride - 1))), cell = Math.floor(column), tx = column - cell;
  const a = low * stride + cell, d = high * stride + cell + 1;
  // Production grids split each cell along a--d. Triangle interpolation keeps
  // the water exactly outside the visible surface even on the curved classic.
  const b = tx <= tz ? high * stride + cell : low * stride + cell + 1;
  const wa = 1 - Math.max(tx, tz), wd = Math.min(tx, tz), wb = Math.abs(tz - tx);
  let nx = n.getX(a) * wa + n.getX(d) * wd + n.getX(b) * wb;
  let ny = n.getY(a) * wa + n.getY(d) * wd + n.getY(b) * wb;
  let nz = n.getZ(a) * wa + n.getZ(d) * wd + n.getZ(b) * wb;
  const lift = .0012 / Math.hypot(nx, ny, nz);
  output[offset] = p.getX(a) * wa + p.getX(d) * wd + p.getX(b) * wb + nx * lift;
  output[offset + 1] = p.getY(a) * wa + p.getY(d) * wd + p.getY(b) * wb + ny * lift;
  output[offset + 2] = p.getZ(a) * wa + p.getZ(d) * wd + p.getZ(b) * wb + nz * lift;
}
const glassRainCount = 8;
const glassRainPositions = new Float32Array(glassRainCount * 12);
const glassRainOpacities = new Float32Array(glassRainCount * 4);
const glassRainUvs = new Float32Array(glassRainCount * 8);
const glassRainIndices = [];
const glassRainDrops = [];
for (let i = 0; i < glassRainCount; i++) {
  glassRainUvs.set([0, 1, 1, 1, 0, 0, 1, 0], i * 8);
  const a = i * 4; glassRainIndices.push(a, a + 2, a + 3, a, a + 3, a + 1);
  glassRainDrops.push({ phase: (i + .5) / glassRainCount, startU: .5, endU: .5, startZ: -.4, endZ: -.5, speed: .10 + (i % 3) * .018 });
}
const glassRainGeometry = new THREE.BufferGeometry();
glassRainGeometry.setAttribute('position', new THREE.BufferAttribute(glassRainPositions, 3).setUsage(THREE.DynamicDrawUsage));
glassRainGeometry.setAttribute('uv', new THREE.BufferAttribute(glassRainUvs, 2));
glassRainGeometry.setAttribute('waterOpacity', new THREE.BufferAttribute(glassRainOpacities, 1).setUsage(THREE.DynamicDrawUsage));
glassRainGeometry.setIndex(glassRainIndices);
const glassRainMaterial = new THREE.ShaderMaterial({
  transparent: true, depthTest: true, depthWrite: false, side: THREE.DoubleSide,
  vertexShader: `attribute float waterOpacity; varying vec2 waterUv; varying float waterAlpha;
    void main() { waterUv = uv; waterAlpha = waterOpacity;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `varying vec2 waterUv; varying float waterAlpha;
    void main() {
      float distanceFromBead = length((waterUv - vec2(.5, .19)) / vec2(.47, .18));
      float bead = 1.0 - smoothstep(.64, 1.0, distanceFromBead);
      float rim = bead * smoothstep(.25, .78, distanceFromBead);
      float trail = (1.0 - smoothstep(.035, .16, abs(waterUv.x - .5)))
        * smoothstep(.15, .3, waterUv.y) * (1.0 - smoothstep(.6, 1.0, waterUv.y));
      float alpha = (bead * .07 + rim * .20 + trail * .13) * waterAlpha;
      if (alpha < .003) discard;
      gl_FragColor = vec4(.68, .85, .94, alpha);
    }`
});
const glassRainMesh = new THREE.Mesh(glassRainGeometry, glassRainMaterial);
glassRainMesh.name = 'exterior-windshield-water';
glassRainMesh.frustumCulled = false;
glassRainMesh.visible = false;
carMeshGroup.add(glassRainMesh);
let glassRainActive = false, glassRainModel = '', glassRainWidth = 0, glassRainHeight = 0;
const glassRainSample = new Float32Array(3);
function rainGlassScreenX(point, aspect) {
  const depth = (COCKPIT_VIEW.eyeZ - point[2] - (point[1] - COCKPIT_VIEW.eyeHeight) * COCKPIT_VIEW.downwardSlope) / Math.hypot(1, COCKPIT_VIEW.downwardSlope);
  return .5 + point[0] / (2 * depth * Math.tan(Math.PI / 6) * aspect);
}
function rainGlassScreenY(point) {
  const dy = point[1] - COCKPIT_VIEW.eyeHeight, dz = point[2] - COCKPIT_VIEW.eyeZ, slope = COCKPIT_VIEW.downwardSlope;
  return .5 - (dy - slope * dz) / (2 * (-dz - slope * dy) * Math.tan(Math.PI / 6));
}
function findRainGlassPoint(pane, aspect, screenX, screenY, drop, start) {
  let nearZ = -.365, farZ = -1.10, u = .5, z = -.5;
  for (let step = 0; step < 18; step++) {
    z = (nearZ + farZ) * .5;
    let low = .03, high = .97;
    for (let j = 0; j < 16; j++) {
      u = (low + high) * .5;
      sampleRainPane(pane, u, z, glassRainSample, 0);
      if (rainGlassScreenX(glassRainSample, aspect) < screenX) low = u; else high = u;
    }
    if (rainGlassScreenY(glassRainSample) > screenY) farZ = z; else nearZ = z;
  }
  if (start) { drop.startU = u; drop.startZ = z; }
  else { drop.endU = u; drop.endZ = z; }
}
function positionRainDrop(drop, index, pane, aspect, model) {
  // The original FPV eye stays fixed. Reference glass is visible below the road
  // focus, while the classic canopy reaches higher. Both use true glass in the
  // empty side bands, clear of the centered pod and left wheel on tall screens.
  const side = .060 + (Math.floor(index / 2) % 2) * .040;
  const screenX = index % 2 ? 1 - side : side;
  findRainGlassPoint(pane, aspect, screenX, model === 'reference' ? .704 : .555, drop, true);
  findRainGlassPoint(pane, aspect, screenX, model === 'reference' ? .738 : .630, drop, false);
}
function updateWindshieldRain(dt) {
  const active = weatherIndex === 1 && cameraModeIndex === 3 && !state.isDestroyed;
  glassRainMesh.visible = active;
  if (!active) { glassRainActive = false; return; }
  const model = window.RoadsterVehicle.getModel(), pane = rainPanes[model];
  const width = Math.max(1, window.innerWidth), height = Math.max(1, window.innerHeight), aspect = width / height;
  const reset = !glassRainActive || glassRainModel !== model || glassRainWidth !== width || glassRainHeight !== height;
  glassRainActive = true; glassRainModel = model; glassRainWidth = width; glassRainHeight = height;
  const speedFactor = 1 + Math.min(1, Math.abs(state.speed || 0) / 90) * .35;
  for (let i = 0; i < glassRainCount; i++) {
    const drop = glassRainDrops[i];
    if (reset) { drop.phase = (i + .5) / glassRainCount; positionRainDrop(drop, i, pane, aspect, model); }
    drop.phase += Math.max(0, dt) * drop.speed * speedFactor;
    if (drop.phase >= 1) { drop.phase %= 1; positionRainDrop(drop, i, pane, aspect, model); }
    const z = drop.startZ + (drop.endZ - drop.startZ) * drop.phase;
    const u = drop.startU + (drop.endU - drop.startU) * drop.phase;
    // Pixel-sized beads stay subtle on both desktop and portrait phones.
    sampleRainPane(pane, u - .001, z, glassRainSample, 0);
    const left = rainGlassScreenX(glassRainSample, aspect);
    sampleRainPane(pane, u + .001, z, glassRainSample, 0);
    const du = Math.min(.003, ((1.25 + (i % 3) * .2) / width) * .002 / (rainGlassScreenX(glassRainSample, aspect) - left));
    sampleRainPane(pane, u, z - .001, glassRainSample, 0);
    const bottom = rainGlassScreenY(glassRainSample);
    sampleRainPane(pane, u, z + .001, glassRainSample, 0);
    const halfLength = Math.min(.012, ((4 + i % 3) / height) * .002 / Math.abs(rainGlassScreenY(glassRainSample) - bottom));
    const p = i * 12;
    sampleRainPane(pane, u - du, z + halfLength, glassRainPositions, p);
    sampleRainPane(pane, u + du, z + halfLength, glassRainPositions, p + 3);
    sampleRainPane(pane, u - du, z - halfLength, glassRainPositions, p + 6);
    sampleRainPane(pane, u + du, z - halfLength, glassRainPositions, p + 9);
    const fade = Math.min(1, drop.phase * 10, (1 - drop.phase) * 7);
    glassRainOpacities.fill(fade, i * 4, i * 4 + 4);
  }
  glassRainGeometry.attributes.position.needsUpdate = true;
  glassRainGeometry.attributes.waterOpacity.needsUpdate = true;
}
