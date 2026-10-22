import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, existsSync } from 'node:fs';
import { motionHarness } from './helpers/motion-harness.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const incident = JSON.parse(read('tests/fixtures/city-user-wall-20261021/incident.json'));
const runtime = process.env.ROADSTER_THREE_RUNTIME || '/tmp/roadster-three.min.js';
const skip = !existsSync(runtime) && 'Native Three r128 required; this is CPU geometry, not GPU QA';
const physics = read('src/physics-main.js');
const section = (a, b) => physics.slice(physics.indexOf(a), physics.indexOf(b, physics.indexOf(a) + a.length));
let cached;
function native() {
  if (cached) return cached;
  const c = vm.createContext({ console, Math, atob: s => Buffer.from(s, 'base64').toString('binary'),
    window: { innerWidth: 1440, innerHeight: 900, addEventListener() {}, dispatchEvent() {} },
    localStorage: { getItem() { return null; }, setItem() {} }, Event: class {},
    document: { createElement() { return { getContext() { return {}; } }; } } });
  vm.runInContext(readFileSync(runtime, 'utf8'), c);
  vm.runInContext(read('src/config.js'), c);
  const world = read('src/world.js');
  vm.runInContext(`const scene=new THREE.Scene();${world.slice(world.indexOf('const bodyMaterial ='), world.indexOf('const highwayEnvGroup'))}`, c);
  for (const file of ['highway-traffic', 'vehicles', 'reference-exterior', 'reference-cockpit', 'npc-traffic-assets', 'reference-traffic'])
    vm.runInContext(read('src/' + file + '.js'), c, { filename: file });
  vm.runInContext(`const cityEnvGroup=new THREE.Group(),cityBuildings=[];let cityAsphaltMat=null,cityAsphaltEWMat=null;const createWetRoadDetail=()=>({});
    ${world.slice(world.indexOf('function buildOpenWorldCity()'), world.indexOf('buildOpenWorldCity();') + 21)}
    globalThis.layout={root:cityEnvGroup,buildings:cityBuildings};`, c);
  c.window.RoadsterVehicle.setModel('reference');
  return cached = { c, T: c.THREE, ...c.layout };
}

// The v2 recorder omits rack position and lateralG. Reconstruct those two
// hidden states from observed yaw/roll deltas; do not claim a full input replay.
function reconstructedInitial() {
  const p = incident.previous, dt = incident.dt;
  const vForward = -p.vx * Math.sin(p.yaw) - p.vz * Math.cos(p.yaw);
  const rackAfter = -(incident.pose.yaw - p.yaw) / dt / 2.35 * (1 + Math.abs(vForward) * .015);
  const steerInput = (rackAfter + 8 * dt) / (1 - 8 * dt); // KeyA held for this frame.
  const targetRoll = (incident.pose.roll - p.roll * (1 - 11 * dt)) / (11 * dt);
  const lateralG = (targetRoll + rackAfter * .048) / .012;
  return { ...p, speed: Math.hypot(p.vx, p.vz), steerInput, lateralG };
}
function drive({ buildings = true, trigger = true, offsetX = 0 } = {}) {
  const { c, T, root, buildings: solids } = native();
  const h = motionHarness({ ...reconstructedInitial(), x: incident.previous.x + offsetX });
  h.context.THREE.Box3 = T.Box3;
  h.context.window.RoadsterVehicle = c.window.RoadsterVehicle;
  if (buildings) h.context.cityBuildings.push(...solids);
  if (trigger) {
    Object.assign(h.context, { hoverRingMat: { opacity: 1 }, spawnDestructionDebris() {}, spawnExplosionEffect() {}, applyExplosionBlastToTraffic() {}, updateDestroyedModalText() {} });
    h.context.sound.playCrash = () => {};
    vm.runInContext(read('src/city-diagnostics.js'), h.context);
    vm.runInContext(section('function triggerPhysicsCollision(', 'function updateDestroyedScores()'), h.context);
  }
  h.keys.KeyA = true;
  h.keys.Semicolon = true;
  h.step(incident.dt);
  return { ...h, T, root, building: solids.find(b => b.id === incident.contact.id) };
}
function visibleVertexWitness(model, T, pose, building) {
  const matrix = new T.Matrix4().compose(new T.Vector3(pose.x, pose.y, pose.z),
    new T.Quaternion().setFromEuler(new T.Euler(pose.pitch || 0, pose.yaw || 0, pose.roll || 0, 'YXZ')), new T.Vector3(1, 1, 1));
  model.updateWorldMatrix(true, true);
  const vertex = new T.Vector3();
  let maxZ = -Infinity, inside = 0, foremost = null;
  model.traverseVisible(part => {
    if (!part.geometry || part.userData.shadowProxy) return;
    const draws = m => m && m.visible !== false && m.colorWrite !== false && !(m.transparent && m.opacity === 0);
    const geometry = part.geometry, positions = geometry.attributes.position, index = geometry.index;
    const total = index ? index.count : positions.count, start = Math.max(0, geometry.drawRange.start), end = Math.min(total, start + geometry.drawRange.count);
    const indices = new Set(), add = (lo, hi) => { for (let n = Math.max(start, lo); n < Math.min(end, hi); n++) indices.add(index ? index.getX(n) : n); };
    if (Array.isArray(part.material)) { for (const group of geometry.groups) if (draws(part.material[group.materialIndex])) add(group.start, group.start + group.count); }
    else if (draws(part.material)) add(0, total);
    for (const i of indices) {
      vertex.fromBufferAttribute(positions, i).applyMatrix4(part.matrixWorld).applyMatrix4(matrix);
      if (vertex.z > maxZ) { maxZ = vertex.z; foremost = part.name; }
      if (vertex.x >= building.minX && vertex.x <= building.maxX && vertex.y >= building.minY && vertex.y <= building.height && vertex.z >= building.minZ && vertex.z <= building.maxZ) inside++;
    }
  });
  return { maxZ, inside, foremost };
}

test('minimal incident distinguishes inbound normal speed from already-rebounded reported pose', () => {
  assert.equal(incident.contact.kind, 'building-wall');
  assert.equal(incident.deltaVKmh, incident.deltaV * 3.6);
  assert.ok(Math.abs(incident.pose.vz + .3 * incident.deltaV) < 1e-13);
  assert.ok(incident.deltaV > 28, 'same existing destruction threshold, not changed to hide this event');
  assert.equal(incident.source.revision, 'city-cyber-v2-20261021');
  assert.ok(!('trace' in incident), 'do not publish the unnecessary full user trace');
});

test('incident520 collider is exactly the visible opaque native rendered podium, not an invisible envelope', { skip }, () => {
  const { T, root, buildings } = native(), b = buildings.find(b => b.id === incident.contact.id);
  assert.equal(b.logicalId, incident.contact.logicalId);
  assert.equal(b.renderBatch, 'city-building-batch-1');
  assert.equal(b.renderIndex, 80);
  const mesh = root.getObjectByName(b.renderBatch), matrix = new T.Matrix4();
  assert.equal(mesh.visible, true);
  assert.equal(root.visible, true);
  assert.equal(mesh.material.visible, true);
  assert.equal(mesh.material.transparent, false);
  assert.equal(mesh.material.opacity, 1);
  assert.equal(mesh.material.colorWrite, true);
  assert.equal(mesh.frustumCulled, false);
  assert.equal(mesh.userData.cityInstances[b.renderIndex], b.id);
  mesh.getMatrixAt(b.renderIndex, matrix);mesh.geometry.computeBoundingBox();
  const bounds = mesh.geometry.boundingBox.clone().applyMatrix4(matrix), logged = incident.contact.bounds;
  for (const [actual, expected] of [[bounds.min.x, logged.minX], [bounds.max.x, logged.maxX], [bounds.min.y, logged.minY], [bounds.max.y, logged.height], [bounds.min.z, logged.minZ], [bounds.max.z, logged.maxZ]]) assert.equal(actual, expected);
});

test('constrained last production-motion frame reconstructs all nine recorded pose fields and fatal contact exactly', { skip }, t => {
  const h = drive();
  for (const key of ['x', 'y', 'z', 'vx', 'vy', 'vz', 'yaw', 'pitch', 'roll']) assert.ok(Object.is(h.state[key], incident.pose[key]), key);
  const result = h.context.window.RoadsterCityDiagnostics.snapshot();
  assert.equal(result.contact.id, incident.contact.id);
  assert.equal(result.contact.logicalId, incident.contact.logicalId);
  assert.equal(result.contact.normal.depth, incident.contact.normal.depth);
  assert.equal(result.contact.normal.x, incident.contact.normal.x);
  assert.equal(result.contact.normal.z, incident.contact.normal.z);
  assert.equal(result.deltaV, incident.deltaV);
  assert.equal(result.deltaVKmh, incident.deltaVKmh);
  assert.equal(result.destroyed, true);
  assert.equal(h.state.hullIntegrity, 0);
  t.diagnostic(JSON.stringify({ scope: 'native CPU single-frame reconstruction; two hidden states inferred, not whole-run input capture or GPU driving', contact: result.contact, deltaV: result.deltaV, matchedPoseFields: 9 }));
});

test('actual frozen reference vertices reach the rendered wall before push-out; preceding and resolved poses are clear', { skip }, t => {
  const h = drive({ buildings: false, trigger: false }), { c } = native(), model = c.window.RoadsterVehicle.getPreviewModel();
  h.context.before = incident.previous;h.context.atContact = h.state;h.context.after = incident.pose;h.context.box = h.building;
  assert.equal(vm.runInContext('cityBuildingContact(before,box)', h.context), null);
  const contact = vm.runInContext('cityBuildingContact(atContact,box)', h.context);
  assert.equal(contact.depth, incident.contact.normal.depth);
  assert.equal(vm.runInContext('cityBuildingContact(after,box)', h.context), null);
  const statePose = visibleVertexWitness(model, h.T, h.state, h.building);
  const visualPose = visibleVertexWitness(model, h.T, { ...h.state, pitch: h.state.pitch + .032, roll: h.state.roll - h.state.steerInput * .032 }, h.building);
  assert.ok(statePose.inside > 0 && statePose.maxZ > h.building.minZ);
  assert.ok(visualPose.inside > 0 && visualPose.maxZ > h.building.minZ, 'known boost squat and inferred rack lean still reach wall; unrecorded squash/wing animation is not a GPU reconstruction');
  t.diagnostic(JSON.stringify({ scope: 'actual visible native mesh vertices, not just OBB overlap', wallZ: h.building.minZ, statePose, visualPose }));
});

test('reconstructed high-speed motion remains clear beside the podium without disabling the real wall', { skip }, () => {
  for (const offsetX of [-50, -37.5]) {
    const h = drive({ offsetX });
    assert.equal(h.state.isDestroyed, false);
    assert.equal(h.state.hullIntegrity, 100);
    assert.equal(h.context.window.RoadsterCityDiagnostics.snapshot(), null);
    assert.ok(h.state.vz > 100);
    h.context.box = h.building;
    assert.equal(vm.runInContext('cityBuildingContact(state,box)', h.context), null);
    const body = vm.runInContext('cityPlayerBody(state)', h.context);
    assert.ok(body.x + body.rx < h.building.minX, 'native OBB retains positive side clearance, including the close-margin pass');
  }
});
