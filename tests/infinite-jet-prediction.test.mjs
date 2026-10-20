import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { simulation, car } from './helpers/demo-harness.mjs';
import { candidateHarness } from './helpers/demo-candidate-harness.mjs';
import { lifecycleHarness, deferred, flush } from './helpers/demo-lifecycle-harness.mjs';
import { createNumericProjectionKernel, CONTROL_PHYSICS_KEYS } from '../verification/demo-continuous/generate-numeric-projection-kernel.mjs';
import { RoadsterDemoNumericProjection } from '../verification/demo-continuous/browser-static-projection.generated.mjs';
import { declaredUpdateSimulation } from '../verification/demo-continuous/browser-static-projection-identity.generated.mjs';
const read = name => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
function staticKernel(h) {
  const helpers = ['wrapAnglePi', 'getAirCoastSpeed', 'advanceAirHandling', 'getResponsiveAirCoastSpeed', 'addAirThrust', 'getGroundCoastSpeed',
    'accelerateGroundSpeed', 'getRetroBrakeDemand', 'integrateFreefall', 'readDriveInput', 'readAttitudeInput', 'advanceAttitudeIdle', 'triggerJump6m'];
  const config = read('config.js').split('const ROAD_WIDTH =')[1].split('const state =')[0];
  const extra = read('physics-main.js').split('function wrapAnglePi(')[1].split('// Keep the chase rig')[0];
  const names = ['ROAD_WIDTH', ...[...config.matchAll(/^const ([A-Z][A-Z0-9_]*) =/gm)].map(m => m[1]), ...[...extra.matchAll(/^const ([A-Z][A-Z0-9_]*) =/gm)].map(m => m[1])];
  const refs = vm.runInContext(`({functions:{${helpers.join(',')},trafficStep:highwayTraffic.step,trafficForecastStep:highwayTraffic.forecastStep,demoSweptContact:RoadsterHighwayDemoPlanner.sweptContact},math:{clamp:THREE.MathUtils.clamp,lerp:THREE.MathUtils.lerp},constants:{${names.join(',')}},handling:RoadsterHighwayDemoPlanner.handling})`, h.context);
  refs.functions.updateSimulation = declaredUpdateSimulation;
  return RoadsterDemoNumericProjection.createForVerification(() => refs);
}
const cases = [
  ['boost', { speed: 80, vz: -80 }, { throttle: 1, boost: 1 }],
  ['fractional-boost', { speed: 80, vz: -80 }, { throttle: 1, boost: 0.25 }],
  ['retro', { speed: 80, vz: -80 }, { brake: 1 }],
  ['electric', { speed: 42, vz: -42 }, { throttle: 1 }],
  ['air-coast', { speed: 65, vz: -65, y: 20, wasAirborne: true }, {}],
  ['air-strafe', { speed: 65, vz: -65, y: 20, wasAirborne: true }, { strafe: 0.25 }],
];
for (const infiniteJet of [false, true]) for (const [name, state, requested] of cases) test(`fuel epoch ${infiniteJet}/${name}: production, Node and static mirrors agree for every physical field`, () => {
  const h = simulation({ ...state, infiniteJet }, [car(0, -200, 30, { laneChangeCooldown: 100 })]);
  const input = { steer: 0, throttle: 0, boost: 0, brake: 0, reverse: 0, handbrake: 0, lift: 0, descend: 0, strafe: 0, roll: 0, pitch: 0, ...requested };
  h.context.demoPlanner.step = () => ({ input, jump: false, status: 'drive', targetLane: 3 });
  const node = createNumericProjectionKernel(), browser = staticKernel(h);
  for (let step = 0; step < 30; step++) {
    const request = { state: structuredClone(h.state), cars: structuredClone(h.cars), input, dt: 1 / 60,
      external: { map: 'highway', active: true, busy: true, requestingJump: false, weatherIndex: 0, audioInitialized: true, keys: {} } };
    const a = node.step(request), b = browser.step(request), actual = h.step(1 / 60);
    for (const projected of [a, b]) {
      assert.equal(projected.supported, true, JSON.stringify(projected.unsupported));
      for (const key of CONTROL_PHYSICS_KEYS) assert.ok(Object.is(projected.state[key], h.state[key]), `${name}/${infiniteJet}/${step}/${key}`);
      assert.deepEqual(structuredClone(projected.cars), structuredClone(h.cars));
      assert.ok(Object.is(projected.airConsumedThisFrame, actual.airConsumedThisFrame));
    }
  }
});
for (const infiniteJet of [false, true]) test(`candidate gas/handoff/approximate ground obey the same ${infiniteJet} fuel mode`, () => {
  for (const height of [2.3, 4.5, 7.5, 10]) {
    const u = candidateHarness({ speed: 65, vz: -65, prevSpeed: 65, infiniteJet });
    const { option } = u.candidate(height, 3); assert.ok(option);
    assert.equal(option.endpoint.infiniteJet, infiniteJet);
    if (infiniteJet) { assert.equal(option.cost, 0); assert.equal(option.requiredNextAir, 0); assert.equal(option.endpoint.airRemaining, 10); assert.equal(option.endpoint.gasMassKg, 144); assert.equal(u.api.entryAir(height), 0); }
    else { assert.ok(option.cost > 0); assert.ok(option.endpoint.airRemaining < 10); assert.ok(u.api.entryAir(height) > 0); }
  }
  const u = candidateHarness({ speed: 80, vz: -80, prevSpeed: 80, infiniteJet });
  const before = structuredClone(u.h.state); u.api.projectedGroundStep(before, [], 1 / 60); u.h.step(1 / 60);
  for (const key of CONTROL_PHYSICS_KEYS) assert.ok(Object.is(before[key], u.h.state[key]), `approximate ground ${key}`);
});
for (const code of ['Digit0', 'Numpad0']) test(`${code} toggles active/pending demo without losing ownership, pose or airborne route`, async () => {
  for (const pending of [false, true]) {
    const h = lifecycleHarness(), ready = deferred();
    if (pending) h.window.RoadsterRanked.prepareForDemo = () => ready.promise;
    const activating = h.demo.toggle(); if (!pending) await activating; else await flush();
    if (!pending) { Object.assign(h.state, { y: 2, vy: -1, wasAirborne: true }); h.demo.step(1 / 60); }
    const fields = ['x', 'y', 'z', 'vx', 'vy', 'vz', 'speed', 'yaw', 'isJumping6m'];
    const pose = fields.map(key => h.state[key]);
    const original = h.context.adapterPlannerForTest.stats();
    await h.key(code); assert.equal(h.state.infiniteJet, true); assert.equal(h.demo.isBusy(), true); assert.equal(h.demo.isActive(), !pending);
    const changed = h.context.adapterPlannerForTest.stats();
    assert.equal(changed.fuelMode, true); assert.equal(changed.planEpoch, original.planEpoch + 1); assert.equal(changed.certifiedNextLane, null);
    assert.equal(changed.targetLane, original.targetLane); assert.deepEqual(fields.map(key => h.state[key]), pose);
    await h.key(code, { repeat: true }); await h.key(code); assert.equal(h.state.infiniteJet, true);
    await h.window.emit('keyup', { code }); await h.key(code); assert.equal(h.state.infiniteJet, false); assert.equal(h.demo.isBusy(), true);
    if (pending) { ready.resolve(); await activating; assert.equal(h.demo.isActive(), true); }
  }
});
test('demo keeps running beyond 60 seconds; only ranked challenges have that deadline', async () => {
  const h = lifecycleHarness(); await h.demo.toggle(); h.advance(61000);
  assert.equal(h.demo.isActive(), true); assert.equal(h.demo.isBusy(), true);
});
