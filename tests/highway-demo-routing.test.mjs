import test from 'node:test';
import assert from 'node:assert/strict';
import { simulation, lanes } from './helpers/demo-harness.mjs';
import { pool } from '../scripts/verify-demo.mjs';

for (const fps of [30, 60, 144]) test(`useful safe three-stage route is not suppressed behind a slow queue at ${fps} Hz`, () => {
  const h = simulation({ speed: 42, vz: -42 }, [], { seed: 7 }); pool(h, 20, 7);
  let stripe = 0, longestStripe = 0;
  for (let i = 0; i < 8 * fps; i++) {
    h.step(1 / fps);
    const distance = Math.min(...lanes.map(x => Math.abs(h.state.x - x)));
    stripe = distance > .9 ? stripe + 1 / fps : 0;
    longestStripe = Math.max(longestStripe, stripe);
  }
  // Before the route-cost correction this reproduction completed only its
  // initial three stages, then rejected a safe useful escape for six seconds.
  assert.ok(h.stats().completed >= 6);
  assert.equal(h.launches.length, 0); assert.equal(h.impacts.length, 0);
  assert.equal(h.state.isDestroyed, false); assert.ok(longestStripe < .8);
});
