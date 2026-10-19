import test from 'node:test';
import assert from 'node:assert/strict';
import { simulation, car, lanes } from './helpers/demo-harness.mjs';
import { lifecycleHarness, source } from './helpers/demo-lifecycle-harness.mjs';
import vm from 'node:vm';

const wall = (distance = 80, speed = 22) => lanes.map((_, lane) => car(lane, -distance, speed));
const exclusive = (input, label = '') => {
  assert.ok(!(input.brake > 0 && (input.throttle > 0 || input.boost > 0)), `brake must release both propulsion sources ${label}`);
};

// Expose observations from the real private prediction functions in memory.
// These insertions do not replace controls, integrators, or any decisions.
function predictionProbe(h, dt) {
  const production = source('highway-demo.js').split('// UI/lifecycle adapter.')[0];
  const anchor = /const currentThreat\s*=[^;]+;/;
  const point = /points\.push\(\{t,x:p\.x,metres:p\.metres(?:,speed:p\.speed)?\}\);/;
  assert.ok(anchor.test(production) && point.test(production), 'prediction probe anchors exist');
  const instrumented = production
    .replace('const RoadsterHighwayDemoPlanner =', 'globalThis.followingPredictionFactory =')
    .replace(anchor, match => `${match} globalThis.followingPredictionProbe={trajectory,controlsFor,live};`)
    .replace(point, 'points.push({t,x:p.x,metres:p.metres,speed:p.speed,gas:p.gas,freefall:p.freefall});');
  vm.runInContext(instrumented, h.context);
  h.context.followingPredictionFactory.create(lanes, 1.65).step(h.state, h.cars, dt);
  const probe = h.context.followingPredictionProbe;
  const leader = probe.live.find(other => other.x === 2.5);
  assert.ok(leader);
  return { controls: probe.controlsFor(h.state.speed, h.state.airRemaining, h.state.airRemaining < 4.3, leader),
    prediction: probe.trajectory([3], dt).at(-1) };
}

for (const fps of [30, 60, 144]) {
  test(`boxed-in demo follows a slower wall using ordinary paid H braking at ${fps} Hz`, () => {
    const h = simulation({ speed: 65, vz: -65 }, wall());
    let braking = 0, paidRetro = 0, minimumGap = Infinity;
    for (let frame = 0; frame < 4 * fps; frame++) {
      const result = h.step(1 / fps);
      assert.ok(result, 'vehicle stays live');
      const input = result.frame.input;
      exclusive(input, `at frame ${frame}`);
      if (input.brake > 0) {
        braking++;
        assert.equal(input.throttle, 0); assert.equal(input.boost, 0);
        assert.equal(result.isRearThrusterFiring, false);
        paidRetro += result.airConsumedThisFrame;
      }
      minimumGap = Math.min(minimumGap, ...h.cars.filter(other => Math.abs(other.mesh.position.x - h.state.x) < 1.85)
        .map(other => Math.abs(other.mesh.position.z)));
      assert.equal(h.state.y, 0, 'feasible ground following never needs a hop');
      assert.ok(h.state.airRemaining >= 0 && h.state.airRemaining <= 10);
      assert.ok(Math.abs(h.state.x - 2.5) < 0.01, 'a blocked wall does not induce lane-stripe hunting');
    }
    assert.ok(braking > 0); assert.ok(paidRetro > 0, 'high-speed H burns the real shared tank');
    assert.ok(minimumGap > 4.62 / 2 + 2.15, 'real collision envelope stays clear');
    assert.ok(h.state.speed >= 20 && h.state.speed <= 24, 'settles to the ordinary NPC flow');
    assert.equal(h.launches.length, 0); assert.equal(h.impacts.length, 0); assert.equal(h.state.isDestroyed, false);
  });

  test(`clearing congestion releases following immediately and recovers 220+ with real boost at ${fps} Hz`, () => {
    const h = simulation({ speed: 65, vz: -65 }, wall());
    for (let frame = 0; frame < 4 * fps; frame++) h.step(1 / fps);
    assert.ok(h.state.speed < 220 / 3.6, 'this scenario actually slowed for congestion');
    const gas = h.state.airRemaining, before = h.state.speed;
    h.cars.length = 0;
    const released = h.step(1 / fps);
    assert.equal(released.frame.input.brake, 0);
    assert.equal(released.frame.input.throttle, 1);
    assert.notEqual(released.frame.status, 'follow');
    assert.ok(h.state.speed > before);
    let boostFrames = 0;
    for (let frame = 0; frame < 6 * fps; frame++) {
      const beforeGas = h.state.airRemaining;
      const result = h.step(1 / fps);
      exclusive(result.frame.input);
      assert.equal(result.frame.input.brake, 0);
      if (result.isRearThrusterFiring) {
        boostFrames++;
        assert.ok(Math.abs(beforeGas - h.state.airRemaining - 0.85 / fps) < 1e-9, 'each real boost frame pays its tank debit');
      }
    }
    assert.ok(boostFrames > 0); assert.ok(gas > 0);
    assert.ok(h.state.speed * 3.6 >= 220);
    assert.equal(h.launches.length, 0); assert.equal(h.impacts.length, 0); assert.equal(h.state.isDestroyed, false);
  });
}

test('empty/freefall tank retains mechanical following brakes and only ordinary grounded recharge', () => {
  for (const airRemaining of [0, 1]) {
    const h = simulation({ speed: 65, vz: -65, airRemaining, isFreefalling: true }, wall(60));
    const result = h.step(1 / 60);
    exclusive(result.frame.input);
    assert.equal(result.frame.input.brake, 1);
    assert.equal(result.frame.input.throttle, 0); assert.equal(result.frame.input.boost, 0);
    assert.equal(result.frame.jump, false); assert.equal(result.airConsumedThisFrame, 0);
    assert.ok(Math.abs(h.state.speed - (65 - 38 / 60)) < 1e-9, 'no unpaid retro impulse while freefall blocks the jets');
    assert.ok(Math.abs(h.state.airRemaining - (airRemaining + 3.4 / 60)) < 1e-9);
  }
});

test('last tank fraction pays only its proportional following-brake impulse', () => {
  const h = simulation({ speed: 65, vz: -65, airRemaining: 0.001, isFreefalling: false }, wall(60));
  const result = h.step(1 / 60);
  exclusive(result.frame.input);
  assert.equal(result.frame.input.brake, 1); assert.equal(result.frame.jump, false);
  assert.equal(result.airConsumedThisFrame, 0.001); assert.equal(h.state.airRemaining, 0);
  // Production telemetry rounds this tiny initial gas mass to 0.0 kg.
  const expected = 65 - 38 / 60 - 80000 / 1850 * (0.001 / 0.55);
  assert.ok(Math.abs(h.state.speed - expected) < 1e-9);
});

test('following trajectory matches real H impulse, fractional gas and longitudinal venue scale', () => {
  for (const [airRemaining, isFreefalling] of [[10, false], [0.001, false], [0, true], [1, true], [2.49, true]]) {
    const h = simulation({ speed: 65, vz: -65, airRemaining, isFreefalling }, wall(60));
    const dt = 0.025;
    const { prediction, controls } = predictionProbe(h, dt);
    exclusive(controls); assert.equal(controls.brake, 1);
    const result = h.step(dt);
    assert.equal(result.frame.input.brake, controls.brake);
    assert.ok(Math.abs(prediction.speed - h.state.speed) < 1e-6, `same paid speed impulse for gas=${airRemaining}, freefall=${isFreefalling}`);
    assert.ok(Math.abs(prediction.gas - h.state.airRemaining) < 1e-9);
    assert.equal(prediction.freefall, h.state.isFreefalling);
    assert.ok(Math.abs(prediction.metres - h.state.speed * dt) < 1e-6, 'predictor stores unscaled physical forward metres');
    const front = h.cars.find(other => other.laneIdx === 3);
    const expectedZ = -60 + (prediction.metres - 22 * dt) * 1.65;
    assert.ok(Math.abs(front.mesh.position.z - expectedZ) < 1e-6, 'world scale is applied exactly once to relative traffic travel');
  }
});

test('manual W/H precedence remains unchanged before and after demo ownership', async () => {
  for (const afterDemo of [false, true]) {
    const powered = lifecycleHarness();
    if (afterDemo) { await powered.demo.toggle(); powered.demo.stop(); }
    Object.assign(powered.state, { speed: 65, vz: -65, y: 0, vy: 0, airRemaining: 10, isFreefalling: false });
    powered.keys.KeyW = powered.keys.KeyH = true;
    const simultaneous = powered.context.fullMotion(1 / 60);
    const expectedCoast = powered.context.getGroundCoastSpeed(65, 1 / 60, true);
    assert.ok(Math.abs(powered.state.speed - expectedCoast) < 1e-9, 'held W keeps its established precedence over H');
    assert.equal(simultaneous.airConsumedThisFrame, 0);
    assert.equal(powered.demo.isBusy(), false);

    const braking = lifecycleHarness();
    if (afterDemo) { await braking.demo.toggle(); braking.demo.stop(); }
    Object.assign(braking.state, { speed: 65, vz: -65, y: 0, vy: 0, airRemaining: 10, isFreefalling: false });
    braking.keys.KeyH = true;
    const manualBrake = braking.context.fullMotion(1 / 60);
    assert.ok(manualBrake.airConsumedThisFrame > 0);
    assert.ok(braking.state.speed < powered.state.speed);
    assert.equal(braking.demo.isBusy(), false);
  }
});
