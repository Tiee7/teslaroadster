import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/highway-traffic.js', import.meta.url), 'utf8');
const physics = readFileSync(new URL('../src/physics-main.js', import.meta.url), 'utf8');
const vehicles = readFileSync(new URL('../src/vehicles.js', import.meta.url), 'utf8');
const lanes = [-12.5, -7.5, -2.5, 2.5, 7.5, 12.5];
const scale = 1.65;
const away = () => ({ x: 30, y: 0, z: 0, vx: 0, vz: -22 });
const close = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
function car(lane, z, speed, extra = {}) {
  return { mode: 'highway', laneIdx: lane, targetX: lanes[lane], speed, desiredSpeed: speed,
    length: 4.62, height: 1.25, vx: 0, vz: -speed, y: 0, blastTimer: 0,
    mesh: { position: { x: lanes[lane], y: 0, z }, rotation: { x: 0, y: 0, z: 0 }, userData: { wheels: [] } }, ...extra };
}
function harness() {
  const math = Object.create(Math);
  math.random = () => { throw new Error('Traffic movement must never pick random speeds or lanes'); };
  const context = vm.createContext({ Math: math });
  vm.runInContext(`${source}\nglobalThis.controller = highwayTraffic;`, context);
  return { step: (cars, player, dt) => context.controller.step(cars, player, dt, lanes, scale) };
}
function run(h, cars, seconds, player = away(), fps = 60, check = () => {}) {
  for (let i = 0; i < Math.round(seconds * fps); i++) { h.step(cars, player, 1 / fps); check(i); }
}
function blockedScene() {
  return [car(2, 0, 28), car(2, -70, 16), car(1, -30, 16), car(3, -30, 16)];
}

test('an unblocked driver keeps its own exact cruise speed and lane without randomness', () => {
  const h = harness(), a = car(2, 0, 23.75);
  run(h, [a], 25, { ...away(), vz: -23.75 });
  assert.equal(a.speed, 23.75); assert.equal(a.desiredSpeed, 23.75);
  assert.equal(a.laneIdx, 2); assert.equal(a.mesh.position.x, lanes[2]);
  assert.equal(a.laneChange, undefined); assert.equal(a.vx, 0);
});

test('same-speed traffic and distant slower traffic never justify overtaking', () => {
  for (const [z, speed] of [[-75, 25], [-220, 16]]) {
    const h = harness(), cars = [car(2, 0, 25), car(2, z, speed)];
    run(h, cars, 1);
    assert.equal(cars[0].laneIdx, 2); assert.ok(!cars[0].laneChange);
    assert.equal(cars[0].blockedTime, 0);
  }
});

test('a blocked driver brakes smoothly and follows when both adjacent lanes are occupied', () => {
  const h = harness(), cars = blockedScene(); let previous = cars[0].speed, minimumGap = Infinity;
  run(h, cars, 8, { ...away(), vz: -16 }, 60, () => {
    const a = cars[0], leader = cars[1];
    assert.ok(a.speed >= previous - 8.5 / 60 - 1e-10); previous = a.speed;
    minimumGap = Math.min(minimumGap, a.mesh.position.z - leader.mesh.position.z - 4.62);
    assert.ok(!a.laneChange); assert.equal(a.laneIdx, 2);
  });
  assert.ok(minimumGap > 20); assert.ok(cars[0].speed < 18);
  assert.equal(cars[0].desiredSpeed, 28, 'braking cannot erase the personal cruise speed');
});

test('a slower nearby leader triggers one smooth adjacent overtake and no automatic return', () => {
  const h = harness(), a = car(2, 0, 28), b = car(2, -70, 16); const cars = [a, b];
  let changes = 0, previousX = a.mesh.position.x, previousLane = a.laneIdx;
  run(h, cars, 12, away(), 60, () => {
    if (a.laneIdx !== previousLane) { changes++; previousLane = a.laneIdx; }
    assert.ok(Math.abs(a.mesh.position.x - previousX) < 0.061, 'continuous eased lateral movement');
    assert.ok(a.mesh.position.x >= lanes[1] && a.mesh.position.x <= lanes[2]);
    assert.ok(Math.abs(a.mesh.rotation.y) <= 0.14 && Math.abs(a.mesh.rotation.z) <= 0.06);
    previousX = a.mesh.position.x;
  });
  assert.equal(changes, 1); assert.equal(a.laneIdx, 1); close(a.mesh.position.x, lanes[1]);
  assert.ok(a.speed > 26); assert.equal(a.desiredSpeed, 28); assert.equal(a.vx, 0);
});

test('an adjacent lane with equally slow traffic has no useful passing advantage', () => {
  const h = harness(), cars = [car(2, 0, 28), car(2, -70, 16), car(1, -80, 16), car(3, -80, 16)];
  run(h, cars, 0.6);
  assert.ok(!cars[0].laneChange); assert.equal(cars[0].laneIdx, 2);
});

test('a too-close front car or a fast rear NPC prevents a cut-in', () => {
  for (const unsafe of [car(1, -26, 16), car(1, 60, 50)]) {
    const h = harness(), cars = [car(2, 0, 28), car(2, -70, 16), unsafe, car(3, 0, 28)];
    run(h, cars, 0.55);
    assert.ok(!cars[0].laneChange); assert.equal(cars[0].laneIdx, 2);
  }
});

test('a grounded player alongside or closing fast from behind prevents an NPC merge', () => {
  for (const player of [{ x: lanes[1], y: 0, z: 0, vx: 0, vz: -28 }, { x: lanes[1], y: 0, z: 60, vx: 0, vz: -70 }]) {
    const h = harness(), cars = [car(2, 0, 28), car(2, -70, 16), car(3, 0, 28)];
    run(h, cars, 0.55, player);
    assert.ok(!cars[0].laneChange); assert.equal(cars[0].laneIdx, 2);
  }
});

test('rear safety includes braking during the merge, even for an initially equal-speed player or wreck', () => {
  for (const obstacle of ['player', 'wreck']) {
    const h = harness(), own = car(0, -35, 20, { blockedTime: 0.35 }), leader = car(0, -60, 10);
    const player = obstacle === 'player' ? { x: lanes[1], y: 0, z: 0, vx: 0, vz: -20 } : { ...away(), vz: -20 };
    const wreck = car(1, 0, 20, { blastTimer: 3.2, blastVz: 0 });
    const cars = obstacle === 'wreck' ? [own, leader, wreck] : [own, leader];
    run(h, cars, 3, player, 60, () => {
      assert.ok(!own.laneChange, 'braking for the source leader must not cut off equal-speed rear traffic');
      assert.equal(own.laneIdx, 0); assert.equal(own.mesh.position.x, lanes[0]);
    });
  }
});

test('player lateral sweep reserves the destination lane; high flight does not block the road', () => {
  for (const y of [0, 10]) {
    const h = harness(), cars = [car(2, 0, 28), car(2, -70, 16), car(3, 0, 28)];
    run(h, cars, 0.55, { x: 2.5, y, z: 15, vx: -3, vz: -30 });
    assert.equal(Boolean(cars[0].laneChange), y === 10);
  }
});

test('simultaneous opposite-side requests cannot reserve the same passing gap', () => {
  for (const reverse of [false, true]) {
    const h = harness(), a = car(1, 0, 28), b = car(3, 0, 28);
    const cars = [a, b, car(1, -70, 16), car(3, -70, 16), car(0, 0, 28), car(4, 0, 28)];
    run(h, reverse ? cars.reverse() : cars, 0.6);
    const merging = [a, b].filter(a => a.laneChange);
    assert.equal(merging.length, 1); assert.equal(merging[0].laneChange.to, 2);
  }
});

test('an in-progress merge occupies its source and destination until completion', () => {
  const h = harness(), a = car(1, 0, 28), b = car(3, 0, 28);
  const cars = [a, car(1, -70, 16), car(0, 0, 28)];
  run(h, cars, 0.6); assert.equal(a.laneChange.to, 2);
  cars.push(b, car(3, -70, 16), car(4, 0, 28));
  run(h, cars, 0.6);
  assert.ok(!b.laneChange); assert.equal(b.laneIdx, 3);
});

test('cooldown and sustained-blockage hysteresis prevent transient/ping-pong changes', () => {
  const h = harness(), a = car(2, 0, 28), b = car(2, -70, 16); const cars = [a, b];
  run(h, cars, 0.2); assert.ok(!a.laneChange);
  b.mesh.position.z = -250;
  run(h, cars, 0.2); assert.equal(a.blockedTime, 0); assert.ok(!a.laneChange);
  b.mesh.position.z = a.mesh.position.z - 70;
  run(h, cars, 3); assert.equal(a.laneIdx, 1); assert.ok(!a.laneChange); assert.ok(a.laneChangeCooldown > 2);
  const slow = car(1, a.mesh.position.z - 50, 10); cars.push(slow);
  run(h, cars, 1);
  assert.equal(a.laneIdx, 1); assert.ok(!a.laneChange);
});

test('both road ends respawn safely, cancel old merge state and retain cruise speed', () => {
  for (const [z, vz, ahead] of [[64.9, -60, true], [-479.9, 0, false]]) {
    const h = harness(), a = car(2, z, 25);
    a.laneChange = { from: 2, to: 1, startX: lanes[2], elapsed: 1 };
    const occupied = car(2, ahead ? -452 : 55, 25);
    h.step([a, occupied], away(), 0.01); // Explicit velocity below controls which road end is crossed.
    a.mesh.position.z = z;
    h.step([a, occupied], { ...away(), vz }, 0.05);
    assert.equal(a.highwayPassedThisFrame, ahead);
    assert.ok(!a.laneChange); assert.equal(a.desiredSpeed, 25); assert.ok(a.laneChangeCooldown > 2.9);
    assert.equal(a.mesh.position.x, lanes[a.laneIdx]);
    assert.ok(Math.abs(a.mesh.position.x - occupied.mesh.position.x) > 1.85 || Math.abs(a.mesh.position.z - occupied.mesh.position.z) > 24);
    assert.ok(a.mesh.position.z >= -480 && a.mesh.position.z <= 65);
    h.step([a, occupied], { ...away(), vz: -25 }, 0.01);
    assert.equal(a.highwayPassedThisFrame, false, 'a wrap scores at most once');
  }
});

test('rear respawn accounts for a stopped player and never spawns a fast car into its stopping gap', () => {
  const h = harness(), a = car(2, -479.9, 30);
  h.step([a], { x: lanes[2], y: 0, z: 0, vx: 0, vz: 0 }, 0.05);
  assert.notEqual(a.laneIdx, 2); assert.equal(a.desiredSpeed, 30);
});

test('a completely occupied respawn area waits out of view and retries without duplicate rewards', () => {
  const h = harness(), a = car(2, 64.9, 30);
  const blockers = lanes.flatMap((_, lane) => [-452, -470, -434, -416].map(z => car(lane, z, 0)));
  h.step([a, ...blockers], { ...away(), vz: -60 }, 0.05);
  assert.equal(a.highwayPassedThisFrame, true); assert.equal(a.highwayWaitingToSpawn, true); assert.equal(a.mesh.position.z, -510); assert.equal(a.mesh.visible, false);
  h.step([a, ...blockers], { ...away(), vz: -60 }, 0.05);
  assert.equal(a.highwayPassedThisFrame, false); assert.equal(a.highwayWaitingToSpawn, true);
  h.step([a], { ...away(), vz: -30 }, 0.05);
  assert.equal(a.highwayWaitingToSpawn, undefined); assert.equal(a.mesh.visible, true); assert.ok(a.mesh.position.z > -480 && a.mesh.position.z < -400);
});

test('blast motion is excluded from driver control and lane recovery is smooth', () => {
  const h = harness(), a = car(2, -50, 28, { blastTimer: 1, blastVx: 5 });
  a.laneChange = { from: 2, to: 1, startX: lanes[2], elapsed: 1 };
  h.step([a], away(), 0.05); assert.equal(a.mesh.position.z, -50); assert.ok(!a.laneChange);
  a.mesh.position.x = -4; a.blastTimer = 0;
  h.step([a], away(), 1 / 60);
  assert.ok(Math.abs(a.mesh.position.x + 4) < 0.001); assert.ok(a.laneChange); assert.ok(a.laneChangeCooldown > 2);
});

test('blast recovery waits for a safe lane instead of recentering into an adjacent NPC', () => {
  const h = harness(), a = car(0, -100, 20, { recoverHighwayLane: true }), b = car(0, -100, 20);
  a.mesh.position.x = -10.1;
  run(h, [a, b], 2, { ...away(), y: 10, vz: -20 }, 60, () => {
    assert.ok(Math.abs(a.mesh.position.x - b.mesh.position.x) >= 2.4 - 1e-8);
    assert.ok(!a.laneChange); assert.equal(a.recoverHighwayLane, true);
  });
  b.mesh.position.z = -350;
  h.step([a, b], { ...away(), y: 10, vz: -20 }, 1 / 60);
  assert.ok(a.laneChange); assert.ok(!a.recoverHighwayLane);
});

test('a low blasted wreck uses the unchanged blast path when predicting a rear closing gap', () => {
  const h = harness(), own = car(0, -450, 20, { blockedTime: 0.35 }), leader = car(0, -475, 10);
  const wreck = car(1, -330, 20, { blastTimer: 3.2, blastVz: 0 });
  const player = { ...away(), vz: -100 };
  run(h, [own, leader, wreck], 2.2, player, 60, i => {
    wreck.mesh.position.z += (-player.vz - wreck.speed + wreck.blastVz) / 60;
    if (i < 30) assert.ok(!own.laneChange, 'the actual closing wreck blocks the initial merge');
    assert.ok(Math.abs(own.mesh.position.x - wreck.mesh.position.x) >= 1.85 || Math.abs(own.mesh.position.z - wreck.mesh.position.z) >= 4.62);
  });
});

test('rear wreck safety includes damping-driven acceleration through repeated real ground bounces', () => {
  const h = harness(), own = car(0, -100, 20, { blockedTime: 0.35 }), leader = car(0, -117, 10);
  const wreck = car(1, -81.5, 20, { blastTimer: 3.2, blastVz: 20, blastVy: 0, y: 0 });
  const player = { ...away(), x: 100, vz: -20 };
  run(h, [own, leader, wreck], 2.8, player, 60, () => {
    wreck.blastTimer -= 1 / 60;
    wreck.mesh.position.z += (-player.vz - wreck.speed + wreck.blastVz) / 60;
    wreck.y += wreck.blastVy / 60;
    wreck.blastVy -= 22 / 60;
    if (wreck.y <= 0) { wreck.y = 0; wreck.blastVy = -wreck.blastVy * 0.42; wreck.blastVz *= Math.pow(0.22, 1 / 60); }
    assert.ok(!own.laneChange, 'the rear wreck can accelerate as its positive impulse damps');
    assert.equal(own.laneIdx, 0);
    assert.ok(Math.abs(own.mesh.position.x - wreck.mesh.position.x) >= 1.85 || Math.abs(own.mesh.position.z - wreck.mesh.position.z) >= 4.62);
  });
});

test('highway lateral collision velocity matches the actual unscaled path derivative', () => {
  const h = harness(), a = car(2, 0, 28), b = car(2, -70, 16);
  run(h, [a, b], 1.5);
  const before = a.mesh.position.x, dt = 0.00001;
  h.step([a, b], away(), dt);
  close(a.vx, (a.mesh.position.x - before) / dt, 0.0001);
});

test('overtaking, following and lane easing agree across 20/30/60/144 Hz', () => {
  const outcomes = [20, 30, 60, 144].map(fps => {
    const h = harness(), a = car(2, 0, 28), b = car(2, -70, 16);
    run(h, [a, b], 5, away(), fps);
    return { x: a.mesh.position.x, z: a.mesh.position.z, speed: a.speed, lane: a.laneIdx };
  });
  for (const value of outcomes) {
    assert.equal(value.lane, 1); close(value.x, outcomes[0].x, 0.001);
    close(value.z, outcomes[0].z, 0.2); close(value.speed, outcomes[0].speed, 0.08);
  }
});

// Execute the complete production traffic update and player-collision block.
// Mesh/wheel/DOM rendering is stubbed; driver control and map branches are real.
function integrated(cars, overrides = {}, map = 'highway') {
  const start = physics.indexOf("  if (currentMap === 'highway') {\n    highwayTraffic.step");
  const end = physics.indexOf('  // Render the resolved pose after traffic contact', start);
  assert.ok(start > 0 && end > start);
  const impacts = [];
  const state = { x: 30, y: 0, z: 0, vx: 0, vy: 0, vz: -22, speed: 22, carsCleared: 0, score: 0, isDestroyed: false, ...overrides };
  const context = vm.createContext({ state, trafficCars: cars, currentMap: map, LANE_CENTERS: lanes, WORLD_SPEED_SCALE: scale,
    scrollingProps: [], CITY_HALF_BOUND: 1200, sound: { beep() {} }, triggerPhysicsCollision: (...args) => impacts.push(args) });
  vm.runInContext(`${source}\nfunction tick(dt) { const demoGroundSweep = null; const playerWorldZ = currentMap === 'highway' ? 0 : state.z; const isAirborne = state.y > 0.5; ${physics.slice(start, end)} }`, context);
  return { state, impacts, step: dt => context.tick(dt) };
}

test('actual runtime traffic block moves once, preserves score/destruction guard and city movement', () => {
  const a = car(2, 0, 22), h = integrated([a]); h.step(0.05); close(a.mesh.position.z, 0);
  const pass = car(2, 64.9, 20), scored = integrated([pass], { vz: -60, y: 10 }); scored.step(0.05);
  assert.equal(scored.state.carsCleared, 1); assert.equal(scored.state.score, 0);
  scored.step(0); assert.equal(scored.state.carsCleared, 1, 'zero-duration frames cannot award a pass twice');
  scored.step(0.05); assert.equal(scored.state.carsCleared, 1);
  const dead = integrated([car(2, 64.9, 20)], { vz: -60, isDestroyed: true }); dead.step(0.05);
  assert.equal(dead.state.carsCleared, 0); assert.equal(dead.state.score, 0);
  const city = car(2, 20, 22, { mode: 'city', vx: 12, vz: -7 }); const cityRun = integrated([city], {}, 'city');
  cityRun.step(0.05); close(city.mesh.position.x, lanes[2] + 12 * scale * 0.05); close(city.mesh.position.z, 20 - 7 * scale * 0.05);
  assert.equal(city.desiredSpeed, 22); assert.equal(city.highwayPassedThisFrame, undefined);
});

test('spawn code assigns one personal cruise speed and the controller is bundled before physics', () => {
  const spawn = vehicles.slice(vehicles.indexOf('function populateTraffic('), vehicles.indexOf('// =========================================================================', vehicles.indexOf('function populateTraffic(')));
  let seed = 4; const math = Object.create(Math); math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const context = vm.createContext({ Math: math, currentMap: 'highway', trafficCars: [], trafficGroup: { add() {}, remove() {} },
    LANE_COUNT: lanes.length, LANE_CENTERS: lanes, WORLD_SPEED_SCALE: scale, createTrafficVehicleMesh: () => ({ position: { set(x, y, z) { Object.assign(this, { x, y, z }); } }, rotation: {}, userData: { length: 4.62, height: 1.25 } }) });
  vm.runInContext(`${source}\n${spawn}\npopulateTraffic(52);`, context);
  assert.equal(context.trafficCars.length, 52); assert.ok(new Set(context.trafficCars.map(c => c.desiredSpeed)).size > 45);
  for (const a of context.trafficCars) { assert.ok(a.speed <= a.desiredSpeed && a.speed >= 0); assert.ok(a.desiredSpeed >= 70 / 3.6 && a.desiredSpeed <= 180 / 3.6); assert.equal(a.changeTimer, undefined); }
  const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
  assert.ok(html.indexOf('src="highway-traffic.js"') < html.indexOf('src="physics-main.js"'));
  const bundle = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(bundle.includes(source)); assert.ok(!physics.includes('car.changeTimer'));
});

test('dense seeded 52-car runtime remains collision-free through following, overtakes and both wraps', () => {
  const cars = Array.from({ length: 52 }, (_, i) => car(i % 6, -420 + i / 52 * 760, 16 + ((i * 137 + 43) % 140) / 10));
  const h = integrated(cars, { x: 30, vz: -24 }); let wraps = 0, merges = 0;
  for (let i = 0; i < 60 * 60; i++) {
    h.step(1 / 60);
    for (const a of cars) { if (a.highwayPassedThisFrame) wraps++; if (a.laneChange) merges++; }
    for (let a = 0; a < cars.length; a++) for (let b = a + 1; b < cars.length; b++) {
      const first = cars[a], second = cars[b];
      if (first.highwayWaitingToSpawn !== undefined || second.highwayWaitingToSpawn !== undefined) continue;
      assert.ok(Math.abs(first.mesh.position.x - second.mesh.position.x) >= 1.85 || Math.abs(first.mesh.position.z - second.mesh.position.z) >= 4.62,
        `NPC overlap at frame ${i}: ${a}/${b}`);
    }
  }
  assert.ok(wraps > 15); assert.ok(merges > 100); assert.equal(h.impacts.length, 0);
  for (let i = 0; i < cars.length; i++) assert.equal(cars[i].desiredSpeed, 16 + ((i * 137 + 43) % 140) / 10);
});

function spawned(count, seed = 4, player = { x: 2.5, y: 0, z: 0, vz: -42 }) {
  const spawn = vehicles.slice(vehicles.indexOf('function populateTraffic('), vehicles.indexOf('// =========================================================================', vehicles.indexOf('function populateTraffic(')));
  const math = Object.create(Math); math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const context = vm.createContext({ Math: math, state: player, currentMap: 'highway', trafficCars: [], trafficGroup: { add() {}, remove() {} },
    LANE_COUNT: lanes.length, LANE_CENTERS: lanes, WORLD_SPEED_SCALE: scale, createTrafficVehicleMesh: () => ({ position: { set(x, y, z) { Object.assign(this, { x, y, z }); } }, rotation: { x: 0, y: 0, z: 0 }, userData: { length: 4.62, height: 1.25 } }) });
  vm.runInContext(`${source}\n${spawn}\npopulateTraffic(${count});`, context);
  return context.trafficCars;
}

test('all traffic presets keep the four weighted pools within one car, stable random km/h targets, and balanced lanes', () => {
  const ranges = [[160, 180], [70, 80], [80, 90], [90, 120]], shares = [0.1, 0.4, 0.3, 0.2];
  for (const count of [20, 36, 52]) for (const seed of [1, 4, 77]) {
    const cars = spawned(count, seed), counts = [0, 0, 0, 0], laneCounts = lanes.map(() => 0);
    assert.equal(cars.length, count);
    for (const a of cars) {
      counts[a.speedBand]++; laneCounts[a.laneIdx]++;
      const kmh = a.desiredSpeed * 3.6, [min, max] = ranges[a.speedBand];
      assert.ok(kmh >= min && kmh <= max); assert.ok(a.speed <= a.desiredSpeed && a.speed >= 0);
      assert.equal(a.driverType, a.speedBand === 0 ? 'racer' : 'cruise');
    }
    for (let i = 0; i < counts.length; i++) assert.ok(Math.abs(counts[i] - count * shares[i]) < 1);
    assert.ok(Math.max(...laneCounts) - Math.min(...laneCounts) <= 1);
    assert.equal(new Set(cars.map(a => a.desiredSpeed)).size, count);
  }
});

test('racers react faster and merge continuously while ordinary drivers also actively pass', () => {
  const normal = car(2, 0, 45, { driverType: 'cruise' }), racer = car(2, 0, 45, { driverType: 'racer' });
  const n = harness(), r = harness(), normalLeader = car(2, -160, 22), racerLeader = car(2, -160, 22);
  run(n, [normal, normalLeader], 0.2, away()); run(r, [racer, racerLeader], 0.2, away());
  assert.ok(!normal.laneChange); assert.ok(racer.laneChange); assert.equal(racer.desiredSpeed, 45);
  run(n, [normal, normalLeader], 3.0, away()); run(r, [racer, racerLeader], 3.0, away());
  assert.equal(normal.laneIdx, 1); assert.equal(racer.laneIdx, 1); assert.ok(racer.speed > normal.speed);
  assert.ok(normal.laneChangeCooldown > racer.laneChangeCooldown);
});

test('new mixed-speed seeded traffic actually overtakes, uses every lane, retains identities, and never overlaps', () => {
  for (const count of [36, 52]) {
    const cars = spawned(count, 77), targets = cars.map(a => [a.desiredSpeed, a.speedBand, a.driverType]);
    const h = integrated(cars, { x: 30, vz: -30 }), laneVisits = lanes.map(() => 0), emptyFrames = lanes.map(() => 0), longestEmpty = lanes.map(() => 0);
    let merges = 0, racerMerges = 0, wraps = 0, previous = new Set();
    for (let i = 0; i < 35 * 30; i++) {
      h.step(1 / 30); const changing = new Set();
      for (const a of cars) {
        if (a.highwayPassedThisFrame) wraps++;
        if (a.highwayWaitingToSpawn !== undefined) continue;
        laneVisits[a.laneIdx]++;
        if (a.laneChange) { changing.add(a); if (!previous.has(a)) { merges++; if (a.driverType === 'racer') racerMerges++; } }
      }
      previous = changing;
      for (let lane = 0; lane < lanes.length; lane++) {
        const occupied = cars.some(a => a.highwayWaitingToSpawn === undefined && a.laneIdx === lane && a.mesh.position.z >= -480 && a.mesh.position.z <= 65);
        emptyFrames[lane] = occupied ? 0 : emptyFrames[lane] + 1;
        longestEmpty[lane] = Math.max(longestEmpty[lane], emptyFrames[lane]);
      }
      for (let a = 0; a < cars.length; a++) for (let b = a + 1; b < cars.length; b++) {
        const first = cars[a], second = cars[b];
        if (first.highwayWaitingToSpawn !== undefined || second.highwayWaitingToSpawn !== undefined) continue;
        assert.ok(Math.abs(first.mesh.position.x - second.mesh.position.x) >= 1.85 || Math.abs(first.mesh.position.z - second.mesh.position.z) >= 4.62,
          `new pool NPC overlap: count${count} frame${i} cars${a}/${b}`);
      }
    }
    assert.ok(merges >= 8, `active ordinary/racer overtakes: ${merges}`); assert.ok(racerMerges >= 2); assert.ok(merges > racerMerges, 'ordinary drivers also pass');
    assert.ok(wraps > 10); assert.ok(laneVisits.every(value => value > 100));
    assert.ok(longestEmpty.every(value => value <= 3 * 30), `long lane vacancy: ${longestEmpty}`);
    for (let i = 0; i < cars.length; i++) assert.deepEqual([cars[i].desiredSpeed, cars[i].speedBand, cars[i].driverType], targets[i]);
    console.log(`mixed traffic ${count}: ${merges} overtakes (${racerMerges} racer), ${wraps} safe wraps, longest lane vacancy ${(Math.max(...longestEmpty) / 30).toFixed(2)}s`);
  }
});


test('a racer born behind slower traffic starts inside a safe braking envelope without changing its target', () => {
  const cars = spawned(52, 6), racer = cars[12], front = cars[6];
  assert.equal(racer.driverType, 'racer'); assert.ok(racer.desiredSpeed > 49); assert.ok(racer.speed < racer.desiredSpeed);
  const h = integrated(cars, { x: 30, vz: -24 });
  for (let i = 0; i < 5 * 60; i++) {
    h.step(1 / 60);
    for (let a = 0; a < cars.length; a++) for (let b = a + 1; b < cars.length; b++) {
      const first = cars[a], second = cars[b];
      if (first.highwayWaitingToSpawn !== undefined || second.highwayWaitingToSpawn !== undefined) continue;
      assert.ok(Math.abs(first.mesh.position.x - second.mesh.position.x) >= 1.85 || Math.abs(first.mesh.position.z - second.mesh.position.z) >= 4.62, `birth seed6 overlap at${i}: ${a}/${b}`);
    }
  }
  assert.ok(racer.desiredSpeed > 49); assert.ok(front.desiredSpeed > 19);
});


test('traffic refresh at a stopped player uses the live lane and safely slows approaching newborn drivers', () => {
  for (const x of [2.5, -2.5, -12.5, 10]) {
    const player = { x, y: 0, z: 0, vx: 0, vz: 0 }, cars = spawned(36, 1, player), h = harness();
    for (let i = 0; i < 3 * 60; i++) {
      h.step(cars, player, 1 / 60);
      for (const a of cars) {
        if (a.highwayWaitingToSpawn !== undefined) continue;
        assert.ok(Math.abs(a.mesh.position.x - x) >= 1.85 || Math.abs(a.mesh.position.z) >= 4.62, `stopped player overlap lane${x} frame${i}`);
      }
    }
  }
});
