import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/highway-traffic.js', import.meta.url), 'utf8');
const lanes = [-12.5, -7.5, -2.5, 2.5, 7.5, 12.5], scale = 1.65;
const clone = value => structuredClone(value);
const controller = () => Function(`${source}\nreturn highwayTraffic;`)();
function car(lane, z, speed, extra = {}) {
  return { mode: 'highway', laneIdx: lane, targetX: lanes[lane], speed, desiredSpeed: speed,
    length: 4.62, height: 1.25, vx: 0, vz: -speed, y: 0, blastTimer: 0,
    mesh: { position: { x: lanes[lane], y: 0, z }, rotation: { x: 0, y: 0, z: 0 }, visible: true }, ...extra };
}
function mixedScene(count) {
  const cars = Array.from({ length: count }, (_, i) => car(i % 6, -32 - Math.floor(i / 6) * 61 - (i % 6) * 3,
    19 + (i * 7 % 24), { driverType: i % 5 === 0 ? 'racer' : 'cruise', laneChangeCooldown: i % 3 ? 0 : 0.05 }));
  cars[0] = car(2, -8, 39, { driverType: 'racer', blockedTime: 0.3 });
  cars[1] = car(2, -63, 16);
  cars[2] = car(1, 4, 28, { blastTimer: 0.3, blastVz: 17, blastVx: 3, y: 2.5 });
  cars[3] = car(4, -87, 31, { driverType: 'racer', laneChange: { from: 4, to: 3, elapsed: 0.7, startX: lanes[4] } });
  cars[4] = car(0, -510, 24, { highwayWaitingToSpawn: true }); cars[4].mesh.visible = false;
  cars[5] = car(5, 95, 23, { highwayWaitingToSpawn: false }); cars[5].mesh.visible = false;
  cars[6].mesh.position.z = 65.1;
  cars[7].mesh.position.z = -480.1;
  cars[8].mode = 'city';
  delete cars[9].desiredSpeed; delete cars[9].laneIdx;
  cars[10] = car(1, -64, 20, { blastTimer: 0.7, blastVz: -13, y: 5 });
  return cars;
}
function playerAt(frame, fps) {
  const t = frame / fps;
  return { x: -7.5 + Math.sin(t * 3) * 6, y: t < 0.3 ? 0 : t < 0.65 ? 5 : 0,
    z: 0, vx: Math.cos(t * 3) * 18, vz: -64 + Math.sin(t) * 3 };
}
function evolveBlast(cars, frame, fps) {
  if (frame === Math.ceil(fps * 0.2)) { cars[2].blastTimer = 0; cars[2].y = 0; cars[2].mesh.position.x += 1.7; }
  if (frame === Math.ceil(fps * 0.6)) { cars[10].blastTimer = 0; cars[10].y = 0; }
}
for (const fps of [30, 60, 144]) for (const count of [20, 36, 52]) {
  test(`forecastStep exactly matches ordinary step at ${fps}Hz with ${count} mixed-state cars`, () => {
    const ordinary = controller(), forecast = controller(), normalCars = mixedScene(count), predictedCars = clone(normalCars);
    let respawned = false, changed = false, recovered = false;
    for (let frame = 0; frame < Math.ceil(fps * 1.2); frame++) {
      evolveBlast(normalCars, frame, fps); evolveBlast(predictedCars, frame, fps);
      const player = playerAt(frame, fps), predictedPlayer = clone(player), originalPlayer = clone(player);
      ordinary.step(normalCars, player, 1 / fps, lanes, scale);
      forecast.forecastStep(predictedCars, predictedPlayer, 1 / fps, lanes, scale);
      assert.deepStrictEqual(predictedCars, normalCars, `all properties after frame ${frame}`);
      assert.deepStrictEqual(player, originalPlayer, 'ordinary player is read-only');
      assert.deepStrictEqual(predictedPlayer, originalPlayer, 'forecast player is read-only');
      respawned ||= normalCars.some(c => c.highwayPassedThisFrame);
      changed ||= normalCars.some(c => c.laneChange);
      recovered ||= normalCars.some(c => c.recoverHighwayLane);
    }
    assert.ok(respawned && changed && recovered, 'exercise respawn, lane-change and blast recovery');
  });
}

test('forecast initialization, reserved-lane order and safety-speed ties match exactly', () => {
  const marker = 'return Object.freeze({ step, forecastStep, createDrivers, initializeSpeeds });';
  assert.equal(source.split(marker).length, 2);
  const inspect = Function(`${source.replace(marker, 'return { step, forecastStep, snapshot, forecastSnapshot, leaderFor, forecastLeaderFor };')}\nreturn highwayTraffic;`)();
  for (let from = 0; from < 6; from++) for (let to = 0; to < 6; to++) for (const x of [-16.85, -12.5, -8.15, -3.15, 0, 3.15, 8.15, 12.5, 16.85]) {
    const a = car(from, -20, 24, { laneChange: { from, to, elapsed: 0.2, startX: lanes[from] } }); a.mesh.position.x = x;
    const b = clone(a);
    assert.deepStrictEqual(inspect.forecastSnapshot(b, lanes), inspect.snapshot(a, lanes));
  }
  const own = { z: 0, length: 4.62, lanes: [2], speed: 30 };
  const first = { z: -20, length: 4.62, lanes: [2], speed: 28, frontSafetySpeed: 0 };
  const equal = { z: -20, length: 4.62, lanes: [2], speed: 18, frontSafetySpeed: 11 };
  for (const traffic of [[own, first, equal], [own, equal, first]]) {
    const expected = inspect.leaderFor(own, 2, traffic), actual = inspect.forecastLeaderFor(own, 2, traffic);
    assert.deepStrictEqual(actual, { speed: expected.speed, gap: expected.gap });
  }
});

test('forecastStep retains ordinary zero/negative-dt and non-six-lane behavior', () => {
  for (const centers of [lanes, [-5, 0, 5]]) for (const dt of [0, -1, 1 / 30]) {
    const a = mixedScene(20), b = clone(a), p = playerAt(0, 60), q = clone(p), h = controller();
    h.step(a, p, dt, centers, scale); h.forecastStep(b, q, dt, centers, scale);
    assert.deepStrictEqual(b, a); assert.deepStrictEqual(q, p);
  }
});

test('52 dense cars reuse repeated waiting geometry without sharing per-driver spawn decisions', () => {
  for (const fps of [30, 60, 144]) {
    const a = [], waiting = [];
    for (let lane = 0; lane < 6; lane++) for (const z of [-453, -430, -407, 15, 38, 61])
      a.push(car(lane, z, 64, { highwaySpeedInitialized: true }));
    for (let i = 0; i < 16; i++) {
      const c = car(i % 6, i % 2 ? 95 : -510, 12 + i * 2.3,
        { length: [3.7, 4.62, 5.4, 9.2][i % 4], driverType: i % 3 ? 'cruise' : 'racer',
          highwayWaitingToSpawn: i % 2 === 0, highwaySpeedInitialized: true });
      c.mesh.visible = false; a.push(c); waiting.push(a.length - 1);
    }
    const b = clone(a), normal = controller(), predicted = controller();
    let allWaitingFrames = 0, successfulSpawns = 0;
    for (let frame = 0; frame < Math.ceil(fps * 1.0); frame++) {
      if (frame === Math.ceil(fps * 0.45)) {
        // A fresh opening must invalidate any earlier failure geometry.
        for (let i = 0; i < 6; i++) { a[i].mode = 'city'; b[i].mode = 'city'; }
      }
      if (frame === Math.ceil(fps * 0.65)) {
        // Live reservations/recovery can change between waiting attempts.
        for (const cars of [a, b]) {
          cars[9].laneChange = { from: 1, to: 0, startX: lanes[1], elapsed: 0.2 };
          cars[9].blastTimer = 0.1; cars[9].blastVz = 8; cars[9].y = 1;
          cars[17].recoverHighwayLane = true; cars[17].mesh.position.x = lanes[1] + 0.8;
        }
      }
      const player = { x: lanes[5], y: 0, z: 0, vx: 0, vz: -64 };
      normal.step(a, clone(player), 1 / fps, lanes, scale);
      predicted.forecastStep(b, clone(player), 1 / fps, lanes, scale);
      assert.deepStrictEqual(b, a, `${fps}Hz dense retry frame ${frame}`);
      if (waiting.every(i => a[i].highwayWaitingToSpawn !== undefined)) allWaitingFrames++;
      successfulSpawns = Math.max(successfulSpawns, waiting.filter(i => a[i].highwayWaitingToSpawn === undefined).length);
    }
    assert.ok(allWaitingFrames > 2, 'exercise repeated full-density failures');
    assert.ok(successfulSpawns > 0, 'exercise success and later-driver cache invalidation');
  }
});

test('captured 52-car terminal fixture traffic is exactly equivalent through repeated spawn retries', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/demo-terminal-backup.json', import.meta.url), 'utf8'));
  for (const fps of [30, 60, 144]) {
    const a = clone(fixture.cars), b = clone(fixture.cars), h = controller();
    for (let frame = 0; frame < Math.ceil(fps * 1.1); frame++) {
      const player = { ...fixture.state, y: frame / fps > 0.3 ? 4.5 : 0 };
      h.step(a, clone(player), 1 / fps, lanes, scale); h.forecastStep(b, clone(player), 1 / fps, lanes, scale);
      assert.deepStrictEqual(b, a, `${fps}Hz captured fixture frame ${frame}`);
    }
  }
});

test('indexed lane queries preserve original ordinal, own-reference exclusion, lengths and speed overrides', () => {
  const marker = 'return Object.freeze({ step, forecastStep, createDrivers, initializeSpeeds });';
  const h = Function(`${source.replace(marker, 'return { forecastIndexLanes, leaderFor, forecastLeaderFor, safeAdjacentGap, forecastSafeAdjacentGap };')}\nreturn highwayTraffic;`)();
  const own = { car: { driverType: 'racer' }, z: 0, length: 4.62, lanes: [2], speed: 30 };
  const farLong = { z: -20, length: 14, lanes: [2], speed: 22, frontSafetySpeed: 0, rearSafetySpeed: 41 };
  const nearShort = { z: -17, length: 4, lanes: [2], speed: 29, frontSafetySpeed: 27, rearSafetySpeed: 35 };
  const tied = { ...farLong, speed: 15, frontSafetySpeed: 11, rearSafetySpeed: 46 };
  const sameZ = { z: 0, length: 5.4, lanes: [2], speed: 19 };
  const duplicateCar = { ...own, z: -4, lanes: [2] }; // Same car identity is still another snapshot reference.
  for (const traffic of [[own, farLong, nearShort, tied], [tied, nearShort, own, farLong],
    [own, duplicateCar, farLong], [farLong, own, sameZ], [own]]) {
    h.forecastIndexLanes(traffic);
    for (const lane of [-1, 0, 1, 2, 3, 4, 5, 6]) {
      const expected = h.leaderFor(own, lane, traffic), actual = h.forecastLeaderFor(own, lane, traffic);
      assert.deepStrictEqual(actual, expected && { speed: expected.speed, gap: expected.gap });
      assert.equal(h.forecastSafeAdjacentGap(own, lane, traffic, scale), h.safeAdjacentGap(own, lane, traffic, scale));
    }
  }
  const traffic = [own, nearShort, farLong];
  h.forecastIndexLanes(traffic);
  nearShort.lanes = [2, 3]; h.forecastIndexLanes(traffic);
  const expected = h.leaderFor(own, 3, traffic);
  assert.deepStrictEqual(h.forecastLeaderFor(own, 3, traffic), { speed: expected.speed, gap: expected.gap });
});

test('approved simultaneous reservations immediately update forecast lane indexes in original order', () => {
  for (const fps of [30, 60, 144]) for (const reverse of [false, true]) {
    const a = [car(1, 0, 28), car(3, 0, 28), car(1, -70, 16), car(3, -70, 16), car(0, 0, 28), car(4, 0, 28)];
    if (reverse) a.reverse();
    const b = clone(a), h = controller(), player = { x: 30, y: 0, z: 0, vx: 0, vz: -22 };
    let sawReservation = false;
    for (let frame = 0; frame < Math.ceil(fps * 1.1); frame++) {
      h.step(a, clone(player), 1 / fps, lanes, scale); h.forecastStep(b, clone(player), 1 / fps, lanes, scale);
      assert.deepStrictEqual(b, a, `${fps}Hz order=${reverse} frame=${frame}`);
      const merging = a.filter(c => c.laneChange?.to === 2);
      assert.ok(merging.length <= 1); sawReservation ||= merging.length === 1;
    }
    assert.ok(sawReservation, 'the first reservation is observed by the later opposing request');
  }
});
