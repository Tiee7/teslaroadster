import test from 'node:test';
import assert from 'node:assert/strict';
import { simulation, car } from './helpers/demo-harness.mjs';
import { candidateHarness } from './helpers/demo-candidate-harness.mjs';
import { lifecycleHarness } from './helpers/demo-lifecycle-harness.mjs';
for (const infiniteJet of [false, true]) test(`clear road keeps jet lit without speed-limiter chatter: gas=${infiniteJet}`, () => {
  const h = simulation({ speed: 65, vz: -65, infiniteJet });
  const segments = []; let current = null, frames = 0;
  for (let i = 0; i < 60 * 9; i++) {
    const result = h.step(1 / 60), boost = result.frame.input.boost > 0;
    if (current !== boost) { if (current !== null) segments.push({ boost: current, frames }); current = boost; frames = 0; }
    frames++;
    assert.equal(h.state.isDestroyed, false); assert.ok(h.state.speed * 3.6 >= 220);
  }
  segments.push({ boost: current, frames });
  if (infiniteJet) { assert.equal(segments.length, 1); assert.equal(segments[0].boost, true); assert.equal(h.state.airRemaining, 10); }
  else { assert.ok(segments.length <= 4, JSON.stringify(segments)); for (const segment of segments.slice(0, -1)) assert.ok(segment.frames >= 30, 'finite replenishment uses broad hysteresis, not frame pulses'); }
  assert.ok(h.state.speed * 3.6 > 350);
});
for (const infiniteJet of [false, true]) test(`hazard stops normal boost, clearance restores it, following demand is continuous: gas=${infiniteJet}`, () => {
  const u = candidateHarness({ speed: 80, vz: -80, infiniteJet });
  const lead = { car: car(3, -30, 35), x: 2.5, z: -30, speed: 35, acceleration: 0, halfLength: 4.46 };
  const blocked = u.api.controlsFor(80, 10, false, lead); assert.equal(blocked.boost, 0); assert.equal(blocked.jumpNeeded, true);
  const entry = u.api.controlsFor(200 / 3.6, 10, false, lead); assert.equal(entry.boost, 1, 'a slow queue cannot strand zero-start W at the200 EV ceiling below the220 hop entry');
  const clear = u.api.controlsFor(80, 10, false, null); assert.equal(clear.boost, 1); assert.equal(clear.throttle, 1);
  // Small changes around a following envelope cannot request alternating full-power pulses.
  const samples = [];
  for (const z of [-49, -48.9, -48.8, -48.7, -48.6]) { const leader = { ...lead, speed: 65, z, car: { ...lead.car, speed: 65 } }; samples.push(u.api.controlsFor(80, 10, false, leader).boost); }
  for (let i = 1; i < samples.length; i++) assert.ok(Math.abs(samples[i] - samples[i - 1]) < 0.15);
  const floor = u.api.controlsFor(220 / 3.6, 10, false, lead); assert.ok(u.api.brakeResult(220 / 3.6, 10, floor.brake, 1 / 60, false).speed >= 220 / 3.6);
});
test('all autopilot button states and ranked ownership copy use the requested name', async () => {
  const h = lifecycleHarness();
  for (const lang of ['en', 'zh']) { h.context.setLanguage(lang); h.demo.render(); assert.match(h.get('btn-highway-demo').textContent, lang === 'zh' ? /自动驾驶/ : /Autopilot/); await h.demo.toggle(); assert.match(h.get('btn-highway-demo').textContent, lang === 'zh' ? /自动驾驶/ : /Autopilot/); h.demo.stop(); }
});

for (const infiniteJet of [false, true]) test(`fractional follow prediction cannot invent electric acceleration above200: gas=${infiniteJet}`, () => {
  const u = candidateHarness({ speed: 80, vz: -80, infiniteJet });
  const gap = (82 ** 2 - 70 ** 2) * 1.65 / 64;
  const z = -(gap + 4.46 + 0.3);
  const leader = { car: car(3, z, 70), x: 2.5, z, speed: 70, acceleration: 0, halfLength: 4.46 };
  const drive = u.api.controlsFor(80, 10, false, leader);
  assert.ok(drive.boost > 0 && drive.boost < 1);
  const points = u.api.trajectory([3], 0.025, true, u.h.state, [leader], false, 0);
  u.h.context.demoPlanner.step = () => ({ input: { ...u.h.context.candidateUnitFactory.neutral(), ...drive }, jump: false, status: 'drive', targetLane: 3 });
  u.h.step(0.025);
  assert.ok(Math.abs(points.at(-1).speed - u.h.state.speed) < 1e-10);
});
