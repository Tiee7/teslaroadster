import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const scoreRules = readFileSync(new URL('../src/driving-score.js', import.meta.url), 'utf8');
const hud = readFileSync(new URL('../src/ui-hud.js', import.meta.url), 'utf8');
const reset = hud.slice(hud.indexOf('function resetCar('), hud.indexOf('function applyTranslations('));
const physics = readFileSync(new URL('../src/physics-main.js', import.meta.url), 'utf8');
function section(start, end) {
  const first = physics.indexOf(start);
  const last = physics.indexOf(end, first + start.length);
  assert.ok(first >= 0 && last > first, `Missing production section: ${start}`);
  return physics.slice(first, last);
}
const helpers = section('function wrapAnglePi(', 'function updateSimulation(');
const cameraStep = section('  // Requirement 7: Constant 60°', '\n  if (state.bannerTimer > 0)');
const trafficAndPose = section('  trafficCars.forEach((car) => {\n    if (car.mode === \'coast\'', '\n  // Calculate Real-Time G-Forces');
function point() {
  return { x: 0, y: 0, z: 0, set(x, y, z) { Object.assign(this, { x, y, z }); }, copy(v) { this.set(v.x, v.y, v.z); } };
}
function harness(map = 'city') {
  const camera = { fov: 60, near: 0.38, position: point(), up: point(), aim: point(), updateProjectionMatrix() {}, lookAt(x, y, z) { this.aim.set(x, y, z); } };
  const state = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, camZoom: 0.75, cameraShake: 0, impactCooldown: 0, steerInput: 0 };
  const context = vm.createContext({
    camera, state, currentMap: map, cameraModeIndex: 0, performance: { now: () => 1000 },
    THREE: { MathUtils: { clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)), lerp: (a, b, t) => a + (b - a) * t } },
    Math: Object.assign(Object.create(Math), { random: () => 0.5 }),
    roadsterCanopyMesh: {}, hudCombinerMesh: {}, setCockpitPerspective() {}, setCockpitExteriorDetailsVisible(visible) { state.exteriorDetailsVisible = visible; }, playerWrapper: { position: point() }, roadsterAttitudeGroup: { rotation: point() },
    trafficCars: [], WORLD_SPEED_SCALE: 1.65, CITY_WORLD_SPEED_SCALE: 1.0, CITY_HALF_BOUND: 1200, sound: { beep() {} },
    triggerPhysicsCollision() { throw new Error('Unexpected collision in focused contact test'); },
    window: {}, clearDebris() {}, carMeshGroup: {}, MAX_AIR_SECONDS: 10, renderBannerText() {},
    document: { getElementById: () => ({ classList: { add() {}, remove() {} } }) },
  });
  vm.runInContext(`${scoreRules}\n${helpers}\n${reset}
    function stepCamera(dt) {
      const isLiftFiring = false, rearActive = false, isFrontRetroFiring = false, isSupersonic = false;
      const isCockpitFpv = cameraModeIndex === 3;
      const groundElevation = 0, visualY = state.y, playerWorldZ = currentMap === 'highway' ? 0 : state.z;
      ${cameraStep}
    }
    function stepContact(dt) {
      const scoreMotionStart = RoadsterDrivingScore.motion(state, currentMap);
      const playerWorldZ = currentMap === 'highway' ? 0 : state.z, groundElevation = 0;
      const demoGroundSweep = null; // This fixture exercises ordinary airborne roof contact.
      const isAirborne = true, isAccelerating = false, isRearThrusterFiring = false, isFootBraking = false, isReversing = false;
      ${trafficAndPose}
    }
  `, context);
  return { context, camera, state, step: dt => context.stepCamera(dt) };
}
function close(actual, expected, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
}

test('city chase holds the same vehicle framing across speed changes and irregular 20–144Hz frames', () => {
  const h = harness();
  h.step(1 / 60);
  for (let i = 0; i < 500; i++) {
    const dt = [1 / 144, 1 / 60, 1 / 30, 0.05][i % 4];
    const speed = i < 200 ? 90 : i < 350 ? -24.75 : 0;
    h.state.x += 3 * dt; h.state.z -= speed * dt;
    h.step(dt);
    close(h.camera.position.x - h.state.x, 0);
    close(h.camera.position.z - h.state.z, 4.05);
    close(h.camera.aim.x - h.state.x, 0);
    close(h.camera.aim.z - h.state.z, -10);
  }
  // Original world-space 9*dt follower had different steady trailing distances
  // at the same 90m/s: 12.55m at 60Hz versus 9.55m at 20Hz.
  const legacyGap = dt => 4.05 + 90 * (1 - 9 * dt) / 9;
  close(legacyGap(1 / 60) - legacyGap(0.05), 3);
});


test('a dropped 50ms frame does not pull the camera toward a steadily moving city car', () => {
  const h = harness();
  for (let i = 0; i < 1200; i++) { h.state.z -= 42 * 1.65 / 60; h.step(1 / 60); }
  const previousGap = h.camera.position.z - h.state.z;
  h.state.z -= 42 * 1.65 * 0.05; h.step(0.05);
  close(h.camera.position.z - h.state.z, previousGap);
});

test('chase offset damping is timestep invariant, including its aim and zoom', () => {
  const poses = [];
  for (const hz of [20, 60, 144]) {
    const h = harness(); h.step(0);
    h.state.yaw = 1.1; h.state.camZoom = 1.25; h.state.pitch = 0.7;
    for (let i = 0; i < hz; i++) h.step(1 / hz);
    poses.push([h.camera.position.x, h.camera.position.y, h.camera.position.z, h.camera.aim.x, h.camera.aim.y, h.camera.aim.z]);
  }
  poses.slice(1).forEach(pose => pose.forEach((v, i) => close(v, poses[0][i])));
});

test('yaw crossing +/-180 and pitch crossing a complete loop keep camera position and aim continuous', () => {
  for (const [axis, initial, next] of [['yaw', Math.PI - 0.0001, -Math.PI + 0.0001], ['pitch', 2 * Math.PI - 0.0001, 2 * Math.PI + 0.0001]]) {
    const h = harness(); h.state[axis] = initial; h.step(0);
    const before = [h.camera.position.x, h.camera.position.y, h.camera.position.z, h.camera.aim.x, h.camera.aim.y, h.camera.aim.z];
    h.state[axis] = next; h.step(1 / 60);
    const after = [h.camera.position.x, h.camera.position.y, h.camera.position.z, h.camera.aim.x, h.camera.aim.y, h.camera.aim.z];
    after.forEach((v, i) => assert.ok(Math.abs(v - before[i]) < 0.001));
  }
});

test('render shake is bounded to the current frame and never pollutes the chase rig', () => {
  const h = harness(); h.step(0);
  const anchor = { x: 5, y: 2, z: -10 }, position = { x: 0, y: 2, z: 4 }, look = { x: 0, y: 0.65, z: -10 };
  for (let i = 0; i < 300; i++) h.context.updateChaseCamera(anchor, position, look, 1 / 144, { x: 0.07, y: -0.07, z: 0.07 });
  close(h.camera.position.x, 5.07); close(h.camera.aim.x, 5.035);
  h.context.updateChaseCamera(anchor, position, look, 1 / 144, { x: 0, y: 0, z: 0 });
  close(h.camera.position.x, 5); close(h.camera.aim.x, 5);
});

test('reset teleport and map/view switches use the new vehicle anchor without a world-space camera sweep', () => {
  const h = harness(); h.state.z = -900; h.step(0);
  h.state.yaw = Math.PI;
  for (let i = 0; i < 180; i++) h.step(1 / 60);
  h.context.resetCar(); h.step(1 / 60);
  close(h.camera.position.x - h.state.x, 0);
  close(h.camera.position.z, 4.05); close(h.camera.aim.z, -10);
  h.context.cameraModeIndex = 1; h.step(1 / 60);
  h.context.cameraModeIndex = 0; h.state.yaw = Math.PI / 2; h.step(1 / 60);
  close(h.camera.position.x - h.state.x, 4.05); close(h.camera.position.z, 0);
  h.context.currentMap = 'highway'; h.step(1 / 60);
  close(h.camera.position.x, h.state.x * 0.82); close(h.camera.position.z, 3.9);
  close(h.camera.aim.z, -9);
});

test('traffic-roof contact resolves the rendered vehicle pose in the same frame used by the camera', () => {
  const h = harness(); Object.assign(h.state, { y: 1.25, vy: -1, vx: 0, vz: 0 });
  h.context.trafficCars.push({ height: 1.2, length: 4, vx: 0, vz: 0, mesh: { userData: {}, position: point() } });
  h.context.stepContact(1 / 60);
  close(h.state.y, 1.35); close(h.state.vy, 5.5);
  close(h.context.playerWrapper.position.y, h.state.y);
  h.step(1 / 60);
  close(h.camera.aim.y - h.context.playerWrapper.position.y, 0.65);
});
