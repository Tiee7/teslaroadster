import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { motionHarness } from './helpers/motion-harness.mjs';
const source = readFileSync(new URL('../src/city-clock.js', import.meta.url), 'utf8');
const api = vm.runInNewContext(`${source}\nRoadsterCityClock;`);
const close = (a, b, epsilon = 1e-8) => assert.ok(Math.abs(a - b) <= epsilon, `${a} != ${b}`);
for (const fps of [10, 15, 20, 30, 60, 144]) {
  for (const controls of ['cruise', 'accelerate', 'brake', 'boost', 'flight']) {
    test(`city wall-time clock: ${controls}, ${fps} rendered fps equals 60 Hz physics`, () => {
      const initial = controls === 'accelerate' ? { speed: 0, vz: 0 } :
        controls === 'flight' ? { speed: 45, vz: -45, y: 100, wasAirborne: true } : { speed: 200 / 3.6, vz: -200 / 3.6 };
      const actual = motionHarness(initial), reference = motionHarness(initial), clock = api.createClock();
      for (const h of [actual, reference]) {
        h.keys[controls === 'brake' ? 'KeyH' : controls === 'boost' || controls === 'flight' ? 'Semicolon' : 'KeyW'] = true;
      }
      for (let i = 0; i < fps * 3; i++) clock.advance(1 / fps, dt => { assert.ok(dt <= 1 / 60); actual.step(dt); });
      for (let i = 0; i < 180; i++) reference.step(1 / 60);
      for (const key of ['x', 'y', 'z', 'vx', 'vy', 'vz', 'speed', 'airRemaining']) close(actual.state[key], reference.state[key]);
      assert.equal(clock.stats().steps, 180);
      close(clock.stats().simulatedSeconds, 3);
      assert.equal(actual.impacts.length, reference.impacts.length);
      if (controls === 'cruise') close(-actual.state.z, 200 / 3.6 * 3);
    });
  }
}
test('city irregular 50–250 ms foreground frames preserve every second with bounded steps', () => {
  const clock = api.createClock(); let simulated = 0, elapsed = 0;
  for (const dt of [.1, .05, .075, .25, .125, .1, .2, .1]) {
    elapsed += dt; clock.advance(dt, step => { assert.ok(step <= 1 / 60); simulated += step; });
  }
  close(simulated + clock.stats().accumulator, elapsed);
  close(simulated, 1);
});
for (const fps of [10, 15, 20, 30, 60]) test(`city ${fps} fps performs only one expensive presentation per render`, () => {
  const clock = api.createClock(); let ticks = 0, presentations = 0, presentedSeconds = 0;
  for (let i = 0; i < fps; i++) clock.advance(1 / fps, (dt, presentationDt) => {
    ticks++; assert.equal(dt, 1 / 60);
    if (presentationDt !== null) { presentations++; presentedSeconds += presentationDt; }
  });
  assert.equal(ticks, 60); assert.equal(presentations, fps); close(presentedSeconds, 1);
});
test('city pauses, invalid clocks and suspended tabs discard debt instead of replaying old input', () => {
  const clock = api.createClock(); let ticks = 0, active = true;
  clock.advance(.01, () => ticks++);
  active = false;
  clock.advance(.1, () => ticks++, () => active);
  assert.equal(clock.stats().accumulator, 0); assert.equal(ticks, 0);
  active = true;
  for (const dt of [30, NaN, -1, Infinity]) assert.equal(clock.advance(dt, () => ticks++).suspended, true);
  assert.equal(ticks, 0);
  clock.advance(1 / 60, () => ticks++, () => active); assert.equal(ticks, 1);
  clock.advance(.1, () => { ticks++; active = false; }, () => active);
  assert.equal(ticks, 2); assert.equal(clock.stats().accumulator, 0);
});
test('production render integration gives map3 an independent fixed clock while map1/autopilot ownership stays unchanged', () => {
  const physics = readFileSync(new URL('../src/physics-main.js', import.meta.url), 'utf8');
  const code = physics.slice(physics.indexOf('// Scope the fixed clock'), physics.indexOf("window.addEventListener('resize'"));
  const events = {}, overlays = new Set(), steps = [], taxi = [], coast = [], demo = [], presentations = [], taxiPresent = [];
  let now = 0;
  const context = vm.createContext({ currentMap: 'city', lastTime: 0, state: {}, trafficCars: [], camera: { position: {} },
    RoadsterCityClock: api, performance: { now: () => now }, requestAnimationFrame() {}, updateSimulation: (dt, present) => { steps.push(dt); presentations.push(present); },
    updateDestroyedScores() {}, renderer: { render() {} }, scene: {}, sound: { update() {} },
    document: { hidden: false, getElementById: id => ({ classList: { contains: () => !overlays.has(id) } }),
      addEventListener: (id, fn) => { events[id] = fn; } },
    window: { addEventListener: (id, fn) => { events[id] = fn; }, RoadsterRanked: { tick() {} },
      RoadsterTaxi: { tick: present => taxi.push(present), present: () => taxiPresent.push(1) }, RoadsterCoast: { tick: dt => coast.push(dt) },
      RoadsterDemo: { isActive: () => false, advanceFrame: dt => demo.push(dt) } } });
  vm.runInContext(code, context);
  const frame = ms => { now += ms; context.animate(now); };
  frame(100); assert.equal(steps.length, 6); close(steps.reduce((a, b) => a + b, 0), .1);
  assert.deepEqual(presentations.slice(0, 5), [null, null, null, null, null]); close(presentations[5], .1);
  assert.equal(taxi.length, 6); assert.ok(taxi.every(present => present === false)); assert.equal(taxiPresent.length, 1);
  overlays.add('modal-help'); frame(100); assert.equal(steps.length, 6);
  overlays.delete('modal-help'); frame(100); assert.equal(steps.length, 12);
  events.blur(); frame(100); assert.equal(steps.length, 12);
  now += 30000; events.focus(); frame(100); assert.equal(steps.length, 18);
  context.document.hidden = true; events.visibilitychange(); frame(100); assert.equal(steps.length, 18);
  context.document.hidden = false; events.visibilitychange(); frame(100); assert.equal(steps.length, 24);
  context.currentMap = 'highway'; frame(100); close(steps.at(-1), .05);
  context.currentMap = 'coast'; const coastBefore=steps.length; frame(100); close(coast.at(-1), .05); assert.equal(steps.length-coastBefore,6); close(steps.at(-1),1/60);
  const before = steps.length;
  context.window.RoadsterDemo.isActive = () => true; frame(100);
  assert.equal(steps.length, before); close(demo.at(-1), .1);
});
