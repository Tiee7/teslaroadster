import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import '../src/driving-score.js';
const scoring = globalThis.RoadsterDrivingScore;
const fresh = () => { const state = { isDestroyed: false }; scoring.reset(state); return state; };
const motion = (kmh, extra = {}) => ({ speed: kmh / 3.6, horizontal: kmh / 3.6, forward: kmh / 3.6, ...extra });
const close = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);

test('10 metres per point is rounded upward only on the cumulative weighted distance', () => {
  const state = fresh(); assert.equal(state.score, 0);
  for (let i = 0; i < 600; i++) scoring.segment(state, 1 / 60, motion(3.6), motion(3.6));
  close(state.distanceMeters, 10); assert.equal(state.score, 1);
  scoring.segment(state, 0.001, motion(3.6), motion(3.6)); assert.equal(state.score, 2);
  assert.equal(scoring.points([0, 0, 0, 0, 0, 0]), 0);
});

test('each exact km/h boundary selects the highest applicable non-stacking bonus', () => {
  for (const [kmh, band, multiplier] of [[0, 0, 1], [179.999, 0, 1], [180, 1, 1.2], [199.999, 1, 1.2], [200, 2, 1.3], [239.999, 2, 1.3], [240, 3, 1.4], [299.999, 3, 1.4], [300, 4, 1.6], [349.999, 4, 1.6], [350, 5, 1.8], [900, 5, 1.8]]) {
    assert.equal(scoring.band(kmh), band);
    const state = fresh(); scoring.segment(state, 1, motion(kmh, { horizontal: 100, forward: 100 }), motion(kmh, { horizontal: 100, forward: 100 }));
    assert.equal(state.score, 10 * multiplier, `${kmh} km/h`);
    close(state.distanceBySpeed[band], 100);
  }
});

test('accelerating or braking across every threshold is split identically at 20/30/60/144 Hz', () => {
  for (const [start, end] of [[160, 370], [370, 160]]) {
    const results = [1, 20, 30, 60, 144].map(fps => {
      const state = fresh(), seconds = 12, frames = seconds * fps;
      for (let i = 0; i < frames; i++) scoring.segment(state, 1 / fps, motion(start + (end - start) * i / frames), motion(start + (end - start) * (i + 1) / frames));
      return state;
    });
    for (const state of results) {
      close(state.distanceMeters, (start + end) / 2 / 3.6 * 12);
      assert.equal(state.score, results[0].score);
      for (let i = 0; i < 6; i++) close(state.distanceBySpeed[i], results[0].distanceBySpeed[i]);
    }
  }
});

test('speeding later never upgrades earlier mileage and slowing never removes an earned bonus', () => {
  const state = fresh();
  scoring.segment(state, 1, motion(36), motion(36)); assert.equal(state.score, 1);
  scoring.segment(state, 1, motion(360), motion(360)); assert.equal(state.score, 19);
  scoring.segment(state, 1, motion(36), motion(36)); assert.equal(state.score, 20);
  assert.deepEqual(state.distanceBySpeed, [20, 0, 0, 0, 0, 100]);
});

for (const map of ['highway', 'city']) test(`${map}: physical forward travel uses speedometer metres; idle, reverse and vertical hovering earn zero`, () => {
  const state = fresh(); Object.assign(state, { vx: 0, vz: -20, speed: 20, vy: 0, yaw: 0, wasAirborne: false });
  const tick = () => { const value = scoring.motion(state, map); scoring.segment(state, 1, value, value); };
  tick(); assert.equal(state.score, 2); close(state.distanceMeters, 20);
  Object.assign(state, { vx: 0, vz: 0, speed: 0, vy: 200, wasAirborne: true }); tick();
  Object.assign(state, { vx: 0, vz: 20, speed: -20, vy: 0, wasAirborne: false }); tick();
  Object.assign(state, { vx: 20, vz: 0, speed: 20 }); tick();
  assert.equal(state.score, 2); close(state.distanceMeters, 20);
  if (map === 'city') { state.yaw = -Math.PI / 2; tick(); close(state.distanceMeters, 40); }
  state.isDestroyed = true; scoring.reset(state); tick(); assert.equal(state.score, 0); assert.equal(state.distanceMeters, 0);
  state.isDestroyed = false; tick(); assert.ok(state.distanceMeters >= 0);
});

test('reset clears both accumulators and rendered scores, and production awards have one shared source', () => {
  const state = fresh(); scoring.segment(state, 20, motion(350), motion(350)); scoring.reset(state);
  assert.equal(state.score, 0); assert.equal(state.distanceMeters, 0); assert.deepEqual(state.distanceBySpeed, [0, 0, 0, 0, 0, 0]);
  const physics = readFileSync(new URL('../src/physics-main.js', import.meta.url), 'utf8');
  assert.equal((physics.match(/RoadsterDrivingScore.segment\(/g) || []).length, 1);
  assert.doesNotMatch(physics, /state\.score\s*\+=|state\.score\s*\+\s*state\.carsCleared/);
  assert.match(physics, /const totalAirSpeedMs = RoadsterDrivingScore.displayedSpeed\(state, isAirborne\)/);
  const hud = readFileSync(new URL('../src/ui-hud.js', import.meta.url), 'utf8');
  assert.match(hud, /function resetCar\([\s\S]*?RoadsterDrivingScore.reset\(state\)/);
});


test('highway lateral handling cannot inflate metres beyond the HUD speed-band envelope', () => {
  const state = fresh(); Object.assign(state, { vx: 25, vz: -49.9, speed: 49.9, vy: 0, yaw: 0, wasAirborne: false });
  const value = scoring.motion(state, 'highway');
  scoring.segment(state, 60, value, value);
  close(state.distanceMeters, 49.9 * 60); assert.equal(state.distanceBySpeed[0], state.distanceMeters);
  assert.ok(state.distanceMeters < 3000);
});


test('HUD and celebration copy never advertise the retired fixed-point awards', () => {
  const config = readFileSync(new URL('../src/config.js', import.meta.url), 'utf8');
  assert.doesNotMatch(config, /\+(?:300|400|500) (?:PTS|分)/);
  assert.match(config, /lblScore: "Distance Score:"/); assert.match(config, /lblScore: "里程得分:"/);
});


test('final driving snapshot copies every accumulator and late writes cannot alter it', () => {
  const state = fresh(); Object.assign(state, { carsCleared: 7, blastedCarsCount: 2 });
  scoring.segment(state, 10, motion(200), motion(200)); const originalBands = state.distanceBySpeed, before = structuredClone(state), result = scoring.freeze(state);
  assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.distanceBySpeed)); assert.notEqual(result.distanceBySpeed, originalBands);
  originalBands[0] += 123; assert.deepEqual(Array.from(result.distanceBySpeed), before.distanceBySpeed);
  state.isDestroyed = true; state.score = 9999; state.distanceMeters = 9999; state.distanceBySpeed = [9999, 0, 0, 0, 0, 0]; state.carsCleared = 900; state.blastedCarsCount = 900;
  scoring.restoreFinal(state); scoring.segment(state, 10, motion(350), motion(350));
  assert.equal(state.score, before.score); assert.equal(state.distanceMeters, before.distanceMeters); assert.deepEqual(Array.from(state.distanceBySpeed), before.distanceBySpeed);
  assert.equal(state.carsCleared, 7); assert.equal(state.blastedCarsCount, 2); assert.equal(scoring.freeze(state), result);
  scoring.reset(state); assert.equal(state.finalDrivingResult, null); assert.equal(state.score, 0); assert.deepEqual(state.distanceBySpeed, [0, 0, 0, 0, 0, 0]);
  state.isDestroyed = false; scoring.segment(state, 1, motion(36), motion(36)); assert.equal(state.score, 1);
});
