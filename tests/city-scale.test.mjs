import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { motionHarness } from './helpers/motion-harness.mjs';
const close = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
for (const fps of [30, 60, 144]) test(`city 300m block takes 5.4s at actual 200km/h, ${fps}Hz`, () => {
  const speed = 200 / 3.6, h = motionHarness({ speed, vz: -speed }); h.keys.KeyW = true;
  const frames = Math.floor(5.4 * fps);
  for (let i = 0; i < frames; i++) h.step(1 / fps);
  const remainder = 5.4 - frames / fps; if (remainder > 1e-12) h.step(remainder);
  close(-h.state.z, 300); close(h.state.speed * 3.6, 200); assert.equal(h.impacts.length, 0);
});
for (const kind of ['ground', 'air', 'reverse', 'strafe']) test(`city ${kind}: same-frame displacement is velocity in metres per second`, () => {
  const h = motionHarness({ y: kind === 'air' || kind === 'strafe' ? 100 : 0, vx: kind === 'strafe' ? 7 : 0,
    speed: kind === 'reverse' ? -12 : 32, vz: kind === 'reverse' ? 12 : -32 });
  let x = 0, z = 0;
  for (const dt of [0, 1 / 144, 1 / 30, 0.017, 1 / 60]) { h.step(dt); x += h.state.vx * dt; z += h.state.vz * dt; }
  close(h.state.x, x); close(h.state.z, z);
});
test('city NPCs and wheel rotation use city metre scale without changing highway traffic calibration', () => {
  const physics = readFileSync(new URL('../src/physics-main.js', import.meta.url), 'utf8');
  // Follow the production helper after occupied-seam queuing was separated;
  // assert real unclipped metre displacement, not its former inline spelling.
  assert.match(physics, /advanceCityTraffic\(car,dt\)/);
  for(const[vx,vz]of[[12,0],[-12,0],[0,16],[0,-16]])for(const dt of[1/144,1/60,1/30]){
    const h=motionHarness(),car={vx,vz,speed:Math.hypot(vx,vz),mesh:{position:{x:100,y:0,z:100},rotation:{x:0,y:0,z:0},userData:{}}};
    h.context.advanceCityTraffic(car,dt);close(car.mesh.position.x,100+vx*dt);close(car.mesh.position.z,100+vz*dt);assert.equal(car.cityWrapPending,undefined);
  }
  assert.match(physics, /state\.speed \* \(currentMap === 'highway' \? WORLD_SPEED_SCALE : CITY_WORLD_SPEED_SCALE\)/);
  assert.match(physics, /highwayTraffic\.step\([^;]+WORLD_SPEED_SCALE\)/);
});
for (const map of ['highway', 'city']) for (const fps of [30, 60, 144]) test(`infinite shared tank powers rear, lift, side and retro without depletion: ${map}, ${fps}Hz`, () => {
  for (const code of ['Semicolon', 'Space', 'KeyQ', 'KeyH']) {
    const h = motionHarness({ infiniteJet: true, y: 200, speed: 45, vz: -45 }, map); h.keys[code] = true;
    let flow = 0, retro = 0;
    for (let i = 0; i < fps * 12; i++) { const frame = h.step(1 / fps); flow += frame.airConsumedThisFrame; retro += frame.retroImpulseSeconds; }
    close(h.state.airRemaining, 10); close(h.state.airUsedContinuous, 0); close(h.state.gasMassKg, 144);
    assert.equal(h.state.isFreefalling, false); assert.equal(h.state.isAutoDescending8s, false); assert.ok(flow > 0);
    if (code === 'KeyH') assert.ok(retro > 0, 'unlimited gas still produces actual retro impulse');
    assert.equal(h.alerts.some(a => a[0] === 'freefall' || a[0] === '8s'), false);
    if (code === 'Semicolon') { h.state.infiniteJet = false; const frame = h.step(1 / fps); assert.ok(frame.airConsumedThisFrame > 0); assert.ok(h.state.airRemaining < 10); }
  }
});
