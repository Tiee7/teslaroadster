import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const source = read('src/highway-traffic.js'), physics = read('src/physics-main.js');
const baseline = 'tests/fixtures/weather-ground-traffic-baseline/';
const lanes = [-12.5, -7.5, -2.5, 2.5, 7.5, 12.5], scale = 1.65;
const player = (speed = 20) => ({ x: 30, y: 0, z: 0, vx: 0, vz: -speed });
const controller = () => Function(source + '\nreturn highwayTraffic;')();
function car(lane = 2, z = -40, speed = 20, extra = {}) {
  return { mode: 'highway', laneIdx: lane, targetX: lanes[lane], speed, desiredSpeed: speed,
    length: 4.62, height: 1.25, vx: 0, vz: -speed, y: 0, blastTimer: 0,
    mesh: { position: { x: lanes[lane], y: 0, z }, rotation: { x: 0, y: 0, z: 0 }, visible: true, userData: { wheels: [] } }, ...extra };
}
function blockedRear() {
  return lanes.flatMap((_, lane) => [95, 155, 215, 275, 335, 395].map(z => car(lane, z, 0, { highwayRecycledBehind: true })));
}
function separated(cars) {
  const live = cars.filter(car => car.mode === 'highway' && car.mesh.visible !== false && car.highwayWaitingToSpawn === undefined);
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) assert.ok(
    Math.abs(live[i].mesh.position.x - live[j].mesh.position.x) >= 1.85 || Math.abs(live[i].mesh.position.z - live[j].mesh.position.z) >= 4.62,
    `overlap ${i}/${j} at ${live[i].mesh.position.z}/${live[j].mesh.position.z}`);
}

test('API places only behind without replacing identity/assets and neutralizes an unadmitted wreck', () => {
  const h = controller(), c = car(2, -40, 30, { blastTimer: 2, blastVx: 8, blastVy: 15, blastVz: -4, blastVRoll: 5, blastVPitch: 4, blastVYaw: -2, y: 3 });
  c.mesh.position.y = 3; c.mesh.rotation.x = .5; c.mesh.rotation.z = .8;
  const mesh = c.mesh, material = c.mesh.material = Object.freeze({ approved: 'material' }), geometry = c.mesh.geometry = Object.freeze({ approved: 'geometry' });
  const size = c.mesh.scale = Object.freeze({ x: 1, y: 1, z: 1 });
  assert.equal(h.respawnBehind(c, [c], lanes, player(), scale), true);
  assert.equal(c.mesh, mesh); assert.equal(c.mesh.material, material); assert.equal(c.mesh.geometry, geometry); assert.equal(c.mesh.scale, size);
  assert.ok(c.mesh.position.z >= 95 && c.mesh.position.z <= 415); assert.equal(c.highwayPassEligible, false);
  assert.equal(c.desiredSpeed, 30); assert.equal(c.speed, 30);
  const blockers = blockedRear(); c.blastTimer = 1; c.blastVy = 12;
  assert.equal(h.respawnBehind(c, [c, ...blockers], lanes, player(), scale), false);
  assert.equal(c.highwayWaitingToSpawn, false); assert.equal(c.mesh.visible, false); assert.equal(c.mesh.position.z, 510);
  for (const field of ['y', 'blastTimer', 'blastVx', 'blastVy', 'blastVz', 'blastVRoll', 'blastVPitch', 'blastVYaw']) assert.equal(c[field], 0, field);
  assert.deepEqual(c.mesh.rotation, { x: 0, y: 0, z: 0 }); assert.equal(c.mesh.position.y, 0);
});

test('boundary predicate is strict, player-relative and requires the entire body beyond the buffered road edge', () => {
  const h = controller(), c = car();
  for (const [z, recycled, outside] of [[-480, false, false], [-480.001, false, true], [65, false, false], [65.001, false, true], [95, true, false], [480, true, false], [480.001, true, true]]) {
    c.mesh.position.z = z; c.highwayRecycledBehind = recycled; assert.equal(h.isOutOfBounds(c, lanes), outside, `${z}/${recycled}`);
  }
  c.mesh.position.z = -40; c.highwayRecycledBehind = false;
  for (const sign of [-1, 1]) {
    c.mesh.position.x = sign * 15.2; assert.equal(h.isOutOfBounds(c, lanes), false, 'a crossed lane/pavement line is not a despawn');
    const edge = 15 + Math.hypot(c.length, 2.03, c.height) / 2 + 1;
    c.mesh.position.x = sign * (edge + .001); assert.equal(h.isOutOfBounds(c, lanes), true);
    c.mesh.position.x = sign * edge; assert.equal(h.isOutOfBounds(c, lanes), false);
  }
  c.mesh.position.x = 0; c.mesh.position.z = 165; assert.equal(h.isOutOfBounds(c, lanes, { z: 100 }), false);
  c.mesh.position.z += .001; assert.equal(h.isOutOfBounds(c, lanes, { z: 100 }), true);
});

test('a rotated long vehicle is not recycled while any conservative body extent can still reach the road', () => {
  const h = controller(), c = car(2, -30, 20, { width: 3, length: 12, height: 4, blastTimer: 2 });
  c.mesh.rotation = { x: 1.2, y: Math.PI / 2, z: .8 };
  c.mesh.position.x = 20; assert.equal(h.isOutOfBounds(c, lanes), false, 'yawed 12 m body can extend back onto pavement');
  const edge = 15 + Math.hypot(c.length, c.width, c.height) / 2 + 1;
  c.mesh.position.x = edge; assert.equal(h.isOutOfBounds(c, lanes), false);
  c.mesh.position.x = edge + .001; assert.equal(h.isOutOfBounds(c, lanes), true);
});

test('spawn admission reserves the full radius of a rotated long wreck, not only its center lane', () => {
  const h = controller(), entry = car(1, -40, 0), wreck = car(0, 95, 0, { length: 12, width: 3, height: 4, blastTimer: 3 });
  wreck.mesh.rotation.y = Math.PI / 2;
  assert.equal(h.respawnBehind(entry, [entry, wreck], lanes, player(0), scale), true);
  assert.ok(Math.abs(entry.mesh.position.x - wreck.mesh.position.x) >= (12 + 2.03) / 2 ||
    Math.abs(entry.mesh.position.z - wreck.mesh.position.z) >= (3 + 4.62) / 2, 'actual yaw90 body boxes must not intersect');
});

for (const fps of [30, 60, 144]) test(`normal longitudinal loops and true lateral incidents retain distinct placement at ${fps}Hz`, () => {
  for (const [x, z, recycled, placement] of [[lanes[2], -481, false, 'behind'], [lanes[2], 66, false, 'ahead'],
    [lanes[2], 481, true, 'ahead'], [-20, -30, false, 'incident'], [20, -30, false, 'incident']]) {
    const h = controller(), c = car(2, z, 20, { highwayRecycledBehind: recycled }); c.mesh.position.x = x;
    h.step([c], player(), 1 / fps, lanes, scale);
    assert.equal(c.highwayWaitingToSpawn, undefined); assert.equal(c.highwayRecycledBehind, placement === 'incident');
    const low = placement === 'ahead' ? -470 : placement === 'behind' ? 23 : 95;
    const high = placement === 'ahead' ? -416 : placement === 'behind' ? 55 : 415;
    assert.ok(c.mesh.position.z >= low && c.mesh.position.z <= high, placement);
    const admittedZ = c.mesh.position.z;
    for (let frame = 0; frame < 2 * fps; frame++) {
      h.step([c], player(), 1 / fps, lanes, scale);
      assert.equal(c.highwayPassedThisFrame, false); assert.equal(c.mesh.position.z, admittedZ);
      assert.equal(h.isOutOfBounds(c, lanes), false);
    }
  }
});

test('pass rewards require a genuine forward approach, not initial rear placement or an incident spawn', () => {
  const h = controller(), bornBehind = car(1, 64.9), original = car(2, -10); let passes = 0;
  h.step([original, bornBehind], player(60), 1 / 60, lanes, scale);
  assert.equal(bornBehind.highwayPassedThisFrame, false, 'a behind-born entry cannot manufacture a pass');
  assert.ok(bornBehind.mesh.position.z < -400, 'ordinary first loop restores forward traffic');
  for (let frame = 0; frame < 60 * 45; frame++) {
    const before = [original, bornBehind].map(c => ({ z:c.mesh.position.z, eligible:c.highwayPassEligible, incident:c.highwayRecycledBehind }));
    h.step([original, bornBehind], player(60), 1 / 60, lanes, scale);
    for (let i=0;i<2;i++) if ([original,bornBehind][i].highwayPassedThisFrame) {
      assert.equal(before[i].eligible,true); assert.equal(before[i].incident,false); assert.ok(before[i].z<=65);
      assert.ok([original,bornBehind][i].mesh.position.z < -400); passes++;
    }
  }
  assert.ok(passes > 4, 'legitimate later normal-loop approaches remain scoreable');
  const incident=car(2,-30);h.respawnBehind(incident,[incident],lanes,player(60),scale);
  for(let frame=0;frame<2*60;frame++){h.step([incident],player(60),1/60,lanes,scale);assert.equal(incident.highwayPassedThisFrame,false);}
  assert.equal(incident.highwayPassEligible,false);
  for(let frame=0;frame<15*60&&!incident.highwayPassEligible;frame++)h.step([incident],player(0),1/60,lanes,scale);
  assert.equal(incident.highwayPassEligible,true);assert.ok(incident.mesh.position.z < -4.62);
  let second=0;for(let frame=0;frame<4*60;frame++){h.step([incident],player(60),1/60,lanes,scale);second+=Number(incident.highwayPassedThisFrame);}
  assert.equal(second,1);
});

test('52-car safe-admission queue includes wreck footprints and retries after an actual opening', () => {
  const h = controller(), blockers = blockedRear(); blockers[1].blastTimer = 3; blockers[1].blastVz = 10; blockers[1].mesh.position.x += 2.5;
  const waiting = Array.from({ length: 16 }, (_, i) => car(i % 6, -50, 12 + i, { blastTimer: .001, length: i % 3 ? 4.62 : 9.2 }));
  const cars = [...blockers, ...waiting]; assert.equal(cars.length, 52);
  for (let frame = 0; frame < 10; frame++) for (const c of waiting) {
    assert.equal(h.respawnBehind(c, cars, lanes, player(), scale), false); assert.equal(c.mesh.visible, false);
  }
  // Release lane 0, including the straddling wreck; no retry success is cached.
  for (let i = 0; i < 6; i++) blockers[i].mode = 'city';
  let admitted = 0;
  for (const c of waiting) { admitted += Number(h.respawnBehind(c, cars, lanes, player(), scale)); separated(cars); }
  assert.ok(admitted > 0 && admitted < waiting.length, 'safe entries become visible, crowded entries remain hidden');
});

test('frozen3417 counterexample depleted front traffic while ordinary normal loops now keep it populated', () => {
  const broken=Function(read('tests/fixtures/traffic-ground-regression-baseline/highway-traffic.js')+'\nreturn highwayTraffic;')();
  const seedCars=()=>Array.from({length:52},(_,i)=>car(i%6,-40-Math.floor(i/6)*43,19+i%25));
  const before=seedCars(),after=seedCars(),fixed=controller();
  for(let frame=0;frame<45*30;frame++){broken.step(before,player(100),1/30,lanes,scale);fixed.step(after,player(100),1/30,lanes,scale);}
  assert.equal(before.filter(c=>c.mesh.visible&&c.mesh.position.z<0).length,0,'preserve the actual deployed depletion failure');
  assert.ok(after.filter(c=>c.mesh.visible&&c.mesh.position.z<0).length>=20,'normal forward supply is restored, not merely total pool count');
});

test('city/coast objects are never modified by Map1-only lifecycle APIs', () => {
  const h = controller();
  for (const mode of ['city', 'coast']) {
    const c = car(2, 800, 20, { mode, blastTimer: 2 }); const before = structuredClone(c);
    assert.equal(h.isOutOfBounds(c, lanes), false); assert.equal(h.respawnBehind(c, [c], lanes, player(), scale), false);
    assert.deepEqual(c, before);
  }
});

// The actual explosion source destroys the player. Exercise that production
// early-return branch, not just a controller hook the destroyed path bypasses.
function destroyed(cars, mode = 'highway', physicsSource = physics, trafficSource = source) {
  const start = physicsSource.indexOf('  if (state.isDestroyed) {', physicsSource.indexOf('function updateSimulation('));
  const end = physicsSource.indexOf('  const scoreMotionStart =', start); assert.ok(start > 0 && end > start);
  const state = { ...player(0), isDestroyed: true, carsCleared: 0 };
  const context = vm.createContext({ state, trafficCars: cars, currentMap: mode, LANE_CENTERS: lanes, WORLD_SPEED_SCALE: scale,
    debrisPieces: [], sound: { update() {} }, cityOwnsDrivingSound: () => false, coastOwnsDrivingSound: () => false,
    document: { getElementById: () => ({ style: {} }) } });
  vm.runInContext(trafficSource + `\nfunction aftereffect(dt) { const t = {modeDestroyed:'destroyed'}; ${physicsSource.slice(start, end)} }`, context);
  return { state, tick: dt => context.aftereffect(dt) };
}
for (const fps of [30, 60, 144]) test(`production destroyed aftereffect refills an expired blast behind on the same ${fps}Hz frame`, () => {
  const c = car(2, -30, 20, { blastTimer: .001, blastVx: 0, blastVy: 0, blastVz: 0, blastVPitch: 2, blastVYaw: 3, blastVRoll: 1 });
  const h = destroyed([c]); h.tick(1 / fps);
  assert.equal(c.blastTimer, 0); assert.ok(c.mesh.position.z >= 95 && c.mesh.position.z <= 415); assert.equal(c.highwayPassEligible, false);
  for (let frame = 0; frame < fps; frame++) h.tick(1 / fps);
  assert.equal(c.highwayWaitingToSpawn, undefined); assert.equal(h.state.carsCleared, 0); assert.equal(c.mesh.visible, true);
});

test('production destroyed aftereffect does not forget a hidden behind queue or keep integrating its expired blast', () => {
  const c = car(2, -30, 20, { blastTimer: .001, blastVx: 0, blastVy: 0, blastVz: 0, blastVPitch: 0, blastVYaw: 0, blastVRoll: 0 });
  const blockers = blockedRear(), h = destroyed([c, ...blockers]); h.tick(1 / 60);
  assert.equal(c.highwayWaitingToSpawn, false); assert.equal(c.mesh.visible, false); assert.equal(c.blastTimer, 0);
  for (let frame = 0; frame < 5; frame++) { h.tick(1 / 60); assert.equal(c.mesh.position.z, 510); }
  for (let i = 0; i < 6; i++) blockers[i].mode = 'city';
  h.tick(1 / 60); assert.equal(c.highwayWaitingToSpawn, undefined); assert.equal(c.mesh.visible, true); assert.ok(c.mesh.position.z >= 95);
  separated([c, ...blockers]);
});


test('production destroyed blast crosses each buffered boundary and is recycled behind in the same frame', () => {
  for (const [x, z, blastVx, blastVz, recycled] of [[-18.55, -30, -10, 0, false], [18.55, -30, 10, 0, false],
    [lanes[2], -479.9, 0, -10, false], [lanes[2], 64.9, 0, 10, false], [lanes[2], 479.9, 0, 10, true]]) {
    const c = car(2, z, 20, { blastTimer: 2, blastVx, blastVy: 0, blastVz, blastVPitch: 0, blastVYaw: 0, blastVRoll: 0, highwayRecycledBehind: recycled }); c.mesh.position.x = x;
    const h = destroyed([c]); h.tick(1 / 60);
    assert.equal(c.blastTimer, 0); assert.ok(c.mesh.position.z >= 95 && c.mesh.position.z <= 415);
    assert.equal(c.highwayPassEligible, false); assert.equal(h.state.carsCleared, 0);
  }
});

test('frozen production counterexamples: ordinary rear exit used to refill ahead; destroyed blast expiry stayed in front', () => {
  const oldTraffic = read(baseline + 'highway-traffic.js'), oldPhysics = read(baseline + 'physics-main.js');
  const old = Function(oldTraffic + '\nreturn highwayTraffic;')(), previous = car(2, 64.9), next = structuredClone(previous);
  old.step([previous], player(60), 1 / 30, lanes, scale); controller().step([next], player(60), 1 / 30, lanes, scale);
  assert.ok(previous.mesh.position.z < -400, 'real previous road-end policy refilled forward');
  assert.ok(next.mesh.position.z < -400, 'ordinary rear exit again refills ahead, just as4451');
  const expired = car(2, -30, 20, { blastTimer: .001, blastVx: 0, blastVy: 0, blastVz: 0, blastVPitch: 0, blastVYaw: 0, blastVRoll: 0 });
  const fixed = structuredClone(expired);
  destroyed([expired], 'highway', oldPhysics, oldTraffic).tick(1 / 60); destroyed([fixed]).tick(1 / 60);
  assert.equal(expired.blastTimer, 0); assert.equal(expired.mesh.position.z, -30);
  assert.ok(fixed.mesh.position.z >= 95); assert.equal(fixed.blastTimer, 0);
});

test('a normal front-admission queue retains its direction even during the production destroyed branch', () => {
  const h=controller(),entry=car(2,66),blockers=lanes.flatMap((_,lane)=>[-470,-430].map(z=>car(lane,z,0)));
  h.step([entry,...blockers],player(20),1/60,lanes,scale);
  assert.equal(entry.highwayWaitingToSpawn,true);assert.equal(entry.highwayRecycledBehind,false);assert.equal(entry.mesh.visible,false);assert.equal(entry.mesh.position.z,-510);
  for(const c of blockers)c.mode='city';
  const aftermath=destroyed([entry,...blockers]);aftermath.tick(1/60);
  assert.equal(entry.highwayWaitingToSpawn,undefined);assert.equal(entry.mesh.visible,true);assert.ok(entry.mesh.position.z < -400);
  assert.equal(entry.highwayPassEligible,true);assert.equal(aftermath.state.carsCleared,0);
});
