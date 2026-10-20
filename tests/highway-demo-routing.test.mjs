import test from 'node:test';
import assert from 'node:assert/strict';
import { simulation, lanes } from './helpers/demo-harness.mjs';
import { pool } from '../scripts/verify-demo.mjs';

for (const fps of [30, 60, 144]) test(`useful final-lane routing continues past the old slow-queue stall at ${fps} Hz`, () => {
  const h = simulation({ speed: 42, vz: -42 }, [], { seed: 7 }); pool(h, 20, 7);
  let stripe = 0, longestStripe = 0;
  for (let i = 0; i < 8 * fps; i++) {
    h.step(1 / fps);
    const distance = Math.min(...lanes.map(x => Math.abs(h.state.x - x)));
    stripe = distance > .9 ? stripe + 1 / fps : 0;
    longestStripe = Math.max(longestStripe, stripe);
  }
  // Final-lane maneuvers can cross several lanes in one completion; count
  // sustained routing progress rather than rewarding intermediate stages.
  assert.ok(h.stats().completed>=4);
  assert.ok(h.state.speed*3.6>=220,'no queue-following slowdown');
  assert.ok(h.launches.length<=2); assert.equal(h.impacts.length, 0);
  assert.equal(h.state.isDestroyed, false); assert.ok(longestStripe < .8);
});
