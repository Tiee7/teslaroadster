// Independent epoch proof. Historical source is read only, never edited or promoted.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as threeMathUtils from '../../tests/helpers/vendor/three-r128-MathUtils.mjs';
import { simulation, car } from '../../tests/helpers/demo-harness.mjs';
import { createNumericProjectionKernel, CONTROL_PHYSICS_KEYS } from '../demo-continuous/generate-numeric-projection-kernel.mjs';
let base = process.env.ROADSTER_BASELINE_COMMIT || 'fb64ac15eaf01ba5ac9f6eb061b9955bfce8a7f5';
try { execFileSync('git', ['cat-file', '-e', `${base}^{commit}`], { stdio: 'ignore' }); }
catch { if (process.env.ROADSTER_BASELINE_COMMIT) throw Error('Requested baseline commit is unavailable'); base = '47036ce914d4e322e2550b8cd5be36f1e8fbcab9'; }
assert.equal(execFileSync('git', ['show', '-s', '--format=%T', base], { encoding: 'utf8' }).trim(), '239aa694da5cf8048896c271a2d80d8199979aff', 'Historical baseline must be the published reviewed tree');
const historical = name => execFileSync('git', ['show', `${base}:src/${name}`], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const baselineText = readFileSync('tests/helpers/demo-harness.mjs', 'utf8').replace(/^import .*;\n/gm, '').replace(/^const read =.*;$/m, 'const read = sourceReader;').replaceAll('export ', '');
const baselineRealm = vm.createContext({ vm, sourceReader: historical, threeMathUtils });
vm.runInContext(baselineText + '\nglobalThis.makeSimulation = simulation;', baselineRealm);
const oldFactory = baselineRealm.makeSimulation;
const kernel = createNumericProjectionKernel();
const neutral = { steer: 0, throttle: 0, boost: 0, brake: 0, reverse: 0, handbrake: 0, lift: 0, descend: 0, strafe: 0, roll: 0, pitch: 0 };
const cases = [
  { name: 'ground-boost', state: { speed: 80, vz: -80 }, input: { throttle: 1, boost: 1 } },
  { name: 'ground-fractional-boost', state: { speed: 80, vz: -80 }, input: { throttle: 1, boost: 0.25 } },
  { name: 'ground-retro', state: { speed: 80, vz: -80 }, input: { brake: 1 } },
  { name: 'ground-electric', state: { speed: 42, vz: -42 }, input: { throttle: 1 } },
  { name: 'air-neutral', state: { speed: 65, vz: -65, y: 20, wasAirborne: true }, input: {} },
  { name: 'air-strafe', state: { speed: 65, vz: -65, y: 20, wasAirborne: true }, input: { strafe: 0.25 } },
];
const rows = [];
for (const infiniteJet of [false, true]) for (const spec of cases) {
  const traffic = () => [car(0, -200, 30, { laneChangeCooldown: 100 })];
  const h = simulation({ ...spec.state, infiniteJet }, traffic());
  const old = infiniteJet ? null : oldFactory(spec.state, traffic());
  const input = { ...neutral, ...spec.input };
  const control = () => ({ input, jump: false, status: 'drive', targetLane: 3 });
  h.context.demoPlanner.step = control; if (old) old.context.demoPlanner.step = control;
  for (let i = 0; i < 30; i++) {
    const request = { state: structuredClone(h.state), cars: structuredClone(h.cars), input: { ...input }, dt: 1 / 60,
      external: { map: 'highway', active: true, busy: true, requestingJump: false, weatherIndex: 0, audioInitialized: true, keys: {} } };
    const projected = kernel.step(request); assert.equal(projected.supported, true, JSON.stringify(projected.unsupported));
    const actual = h.step(1 / 60); if (old) old.step(1 / 60);
    for (const key of CONTROL_PHYSICS_KEYS) {
      assert.ok(Object.is(projected.state[key], h.state[key]), `${spec.name}/${infiniteJet}/${i} projection.${key}: ${projected.state[key]} != ${h.state[key]}`);
      if (old && key !== 'infiniteJet') assert.ok(Object.is(old.state[key], h.state[key]), `${spec.name}/${i} finite regression.${key}`);
    }
    assert.deepEqual(structuredClone(projected.cars), structuredClone(h.cars));
    if (old) assert.deepEqual(structuredClone(old.cars), structuredClone(h.cars));
    assert.ok(Object.is(projected.airConsumedThisFrame, actual.airConsumedThisFrame));
    if (infiniteJet) { assert.equal(h.state.airRemaining, 10); assert.equal(h.state.airUsedContinuous, 0); assert.equal(h.state.gasMassKg, 144); }
  }
  rows.push({ ...spec, infiniteJet, steps: 30, comparedControlFields: CONTROL_PHYSICS_KEYS.length, exactNodeAndProduction: true, exactPriorFinitePhysics: Boolean(old) });
}
const report = { passed: true, historicalLocalReviewCommit: base, publishedEquivalentTree: '239aa694da5cf8048896c271a2d80d8199979aff',
  historicalPhysicsSha256: createHash('sha256').update(historical('physics-main.js')).digest('hex'),
  cases: rows, totalPhysicalSteps: rows.length * 30, strictObjectIsFieldComparisons: rows.length * 30 * CONTROL_PHYSICS_KEYS.length,
  boundary: 'Extracted production motion/contact/G only; no WebGL, render, full-page RNG or collision-free autopilot claim.' };
writeFileSync('verification/controls-city-scale/fuel-node-equivalence.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ passed: report.passed, cases: rows.length, totalPhysicalSteps: report.totalPhysicalSteps, strictObjectIsFieldComparisons: report.strictObjectIsFieldComparisons }));
