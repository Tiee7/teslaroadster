import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const scoreRules = readFileSync(new URL('../src/driving-score.js', import.meta.url), 'utf8');

const physics = readFileSync(new URL('../src/physics-main.js', import.meta.url), 'utf8');
const config = readFileSync(new URL('../src/config.js', import.meta.url), 'utf8');
const hud = readFileSync(new URL('../src/ui-hud.js', import.meta.url), 'utf8');
const jump = hud.slice(hud.indexOf('function triggerJump6m() {'), hud.indexOf('function toggleAltitudeHold() {'));
assert.ok(jump.length > 0);
function section(start, end) {
  const first = physics.indexOf(start), last = physics.indexOf(end, first + start.length);
  assert.ok(first >= 0 && last > first, `Missing production section: ${start}`);
  return physics.slice(first, last);
}
const helpers = section('function wrapAnglePi(', 'function updateSimulation(');
const motion = section('  const isRealMode =', '  const playerWorldZ =');
const collision = section('function triggerPhysicsCollision(', 'function destroyVehicle(');
const g = 9.81;
const close = (actual, expected, tolerance = 1e-8) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

// Execute the complete production map movement, tank, altitude, attitude and
// road/roof collision paths; only rendering/DOM and explosion effects are stubs.
function harness(overrides = {}, map = 'highway', buildings = []) {
  const banners = [], impacts = [], alerts = [];
  const context = vm.createContext({
    cityBuildings: buildings, frontWheelSteerGroups: [], carMeshGroup: {},
    THREE: { MathUtils: { clamp: (x, lo, hi) => Math.max(lo, Math.min(hi, x)), lerp: (a, b, t) => a + (b - a) * t } },
    document: { getElementById: () => ({ classList: { remove() {} } }) },
    sound: { init() {}, speakAlert: (...args) => alerts.push(args), beep() {}, playCrash() {} },
    showBanner: (...args) => banners.push(args),
    destroyVehicle() { context.gameState.isDestroyed = true; },
    recordImpact: (...args) => impacts.push(args),
  });
  vm.runInContext(`${scoreRules}\n${config}\nconst keys = {};\n${helpers}\n${collision}\n${jump}
    const actualCollision = triggerPhysicsCollision;
    triggerPhysicsCollision = (...args) => { recordImpact(...args); actualCollision(...args); };
    function step(dt) { const t = I18N[currentLang]; ${motion}
      return { prevY, prevVy, isLiftFiring, isDescendFiring, isRearThrusterFiring, airConsumedThisFrame };
    }
    function setMap(map) { currentMap = map; }
    globalThis.gameState = state; globalThis.gameKeys = keys;
    globalThis.ballisticStep = integrateFreefall;
  `, context);
  context.setMap(map);
  Object.assign(context.gameState, { x: 0, z: 0, y: 300, vx: 0, vy: 0, vz: 0, speed: 0, ...overrides });
  return { state: context.gameState, keys: context.gameKeys, context, banners, impacts, alerts,
    step: dt => context.step(dt), launch: () => context.triggerJump6m(),
    advance(seconds, fps) {
      const count = Math.floor(seconds * fps);
      let result;
      for (let i = 0; i < count; i++) result = context.step(1 / fps);
      const remaining = seconds - count / fps;
      if (remaining > 1e-12) result = context.step(remaining);
      return result;
    } };
}

test('freefall alarm belongs to sustained flight, never road depletion or the complete O-hop',()=>{
  for(const map of ['highway','city'])for(const physicsMode of ['realistic','fantasy'])for(const fps of [30,60,144]){
    for(const key of ['Semicolon','KeyH']){
      const road=harness({y:0,speed:80,vz:-80,airRemaining:.006,physicsMode},map);
      road.keys[key]=true;for(let frame=0;frame<3;frame++)road.step(1/fps);
      assert.equal(road.state.isFreefalling,true,'empty tank still disables thrust normally');
      assert.ok(!road.banners.some(x=>x[0]==='freefall'));
      assert.ok(!road.alerts.some(x=>x[0]==='freefall'));
    }
    for(const hop of [
      {y:1,vy:10,isJumping6m:true,groundHopActive:true,jumpInertiaSeconds:.1},
      {y:3,vy:-2,isJumping6m:false,groundHopActive:true,jumpInertiaSeconds:null},
      {y:3,vy:2,isJumping6m:false,groundHopActive:false,jumpInertiaSeconds:.1}
    ]){
      const h=harness({...hop,speed:80,vz:-80,airRemaining:.006,physicsMode},map);
      h.keys.Semicolon=true;h.step(1/fps);
      assert.equal(h.state.isFreefalling,true);
      assert.ok(!h.banners.some(x=>x[0]==='freefall'),'O ascent, descent and finite grace remain silent');
      assert.ok(!h.alerts.some(x=>x[0]==='freefall'));
    }
    const flight=harness({y:100,speed:80,vz:-80,airRemaining:.006,physicsMode,jumpInertiaSeconds:null},map);
    flight.keys.Semicolon=true;flight.step(1/fps);
    assert.equal(flight.banners.filter(x=>x[0]==='freefall').length,1);
    assert.equal(flight.alerts.filter(x=>x[0]==='freefall').length,1);
    flight.step(1/fps);assert.equal(flight.alerts.filter(x=>x[0]==='freefall').length,1,'no repeated empty-tank voice');
  }
});

test('ground O marks its whole arc; deliberate sustained lift leaves that alert-only classification',()=>{
  const hop=harness({y:0});hop.launch();hop.state.airRemaining=.006;
  assert.equal(hop.state.groundHopActive,true);hop.step(1/60);
  assert.ok(!hop.alerts.some(x=>x[0]==='freefall'));
  const flight=harness({y:100,groundHopActive:true,isJumping6m:false,airRemaining:.006,jumpInertiaSeconds:null});
  flight.keys.Space=true;flight.step(1/60);
  assert.equal(flight.state.groundHopActive,false);
  assert.equal(flight.alerts.filter(x=>x[0]==='freefall').length,1);
  const landed=harness({y:0,groundHopActive:true});landed.step(0);
  assert.equal(landed.state.groundHopActive,false,'touchdown clears stale classification');
});

for (const seconds of [1, 2, 3]) {
  test(`from rest, ${seconds}s follows y=y0−½gt² and vy=−gt at every FPS/map/tank/mode`, () => {
    for (const map of ['highway', 'city']) for (const physicsMode of ['realistic', 'fantasy']) {
      for (const airRemaining of [0, 10]) for (const fps of [30, 60, 144]) {
        const h = harness({ airRemaining, physicsMode, isFreefalling: airRemaining === 0 }, map);
        h.advance(seconds, fps);
        close(h.state.y, 300 - 0.5 * g * seconds ** 2);
        close(h.state.vy, -g * seconds);
        close(h.state.airRemaining, airRemaining);
      }
    }
  });
}

test('initial upward/downward velocities and arbitrary attitudes do not change gravity or create a terminal cap', () => {
  for (const vy of [12, -8, -80]) for (const fps of [30, 60, 144]) {
    const h = harness({ vy, pitch: 7 * Math.PI, roll: 0.5, airRemaining: 0, isFreefalling: true });
    h.advance(2, fps);
    close(h.state.y, 300 + vy * 2 - 0.5 * g * 4);
    close(h.state.vy, vy - g * 2);
  }
});

test('variable frame lengths, zero dt, and sub-centimeter clearance retain exact ballistics', () => {
  const h = harness({ y: 250, vy: 7, airRemaining: 0, isFreefalling: true });
  let elapsed = 0;
  for (let i = 0; i < 100; i++) {
    const dt = [0, 1 / 144, 1 / 60, 1 / 30, 0.05][i % 5];
    h.step(dt); elapsed += dt;
    close(h.state.y, 250 + 7 * elapsed - 0.5 * g * elapsed ** 2);
    close(h.state.vy, 7 - g * elapsed);
  }
  const low = harness({ y: 0.005, airRemaining: 0, isFreefalling: true });
  low.step(1 / 30); close(low.state.y, 0); close(low.state.vy, 0);
});

test('Space climb and pitched rear thrust release preserve initial velocity through the apex', () => {
  for (const map of ['highway', 'city']) for (const fps of [30, 60, 144]) {
    for (const code of ['Space', 'KeyW', 'Semicolon']) {
      const h = harness({ y: 100, vy: 4, pitch: Math.PI / 2 }, map);
      h.keys[code] = true; h.advance(0.3, fps);
      assert.ok(h.state.vy > 0);
      h.keys[code] = false;
      const { y, vy } = h.state;
      h.advance(1.5, fps);
      close(h.state.y, y + vy * 1.5 - 0.5 * g * 1.5 ** 2);
      close(h.state.vy, vy - g * 1.5);
    }
  }
});

test('every depletion path preserves velocity and receives gravity in the same unpowered frame', () => {
  for (const map of ['highway', 'city']) for (const fps of [30, 60, 144]) {
    for (const code of ['Space', 'KeyW', 'Semicolon', 'KeyQ', 'KeyN', 'ShiftLeft']) {
      for (const vy of [-3, 0, 5]) {
        const dt = ['KeyW', 'Semicolon', 'KeyQ'].includes(code) ? 0.05 : 1 / fps;
        const airRemaining = dt === 0.05 ? 0.0051 : 0.0001;
        const h = harness({ y: 100, vy, airRemaining }, map);
        h.keys[code] = true;
        const result = h.step(dt);
        assert.equal(h.state.isFreefalling, true);
        assert.equal(result.isLiftFiring, false); assert.equal(result.isDescendFiring, false);
        close(h.state.y, 100 + vy * dt - 0.5 * g * dt ** 2);
        close(h.state.vy, vy - g * dt);
        h.keys[code] = false; h.advance(1, fps);
        close(h.state.y, 100 + vy * (dt + 1) - 0.5 * g * (dt + 1) ** 2);
        close(h.state.vy, vy - g * (dt + 1));
      }
    }
    const jump = harness({ y: 100, vy: 5, isJumping6m: true, jumpTargetY: 106, jumpStartY: 100, airRemaining: 0.0001 }, map);
    jump.step(1 / fps); close(jump.state.vy, 5 - g / fps);
    close(jump.state.y, 100 + 5 / fps - 0.5 * g / fps ** 2);
  }
});

test('depleting an emergency-save tank grants no unpaid braking frame', () => {
  for (const fps of [30, 60, 144]) {
    const dt = 1 / fps, h = harness({ y: 1, vy: -10, airRemaining: dt / 2, isAutoLandingSave: true });
    const result = h.step(dt);
    assert.equal(result.isLiftFiring, false); assert.equal(h.state.isFreefalling, true);
    close(h.state.vy, -10 - g * dt); close(h.state.y, 1 - 10 * dt - 0.5 * g * dt ** 2);
  }
});

test('roads/roofs contact at analytic fall time and impact speed without tunneling', () => {
  for (const map of ['highway', 'city']) for (const fps of [30, 60, 144]) {
    const surface = map === 'city' ? 25 : 0;
    for (const height of [0.05, 1, 6, 20, 100, 380 - surface]) {
      const building = { minX: -10, maxX: 10, minZ: -10, maxZ: 10, height: surface, isHelipad: false };
      const h = harness({ y: surface + height, airRemaining: 0, isFreefalling: true }, map, surface ? [building] : []);
      const landingTime = Math.sqrt(2 * height / g), contactSpeed = Math.sqrt(2 * g * height);
      let elapsed = 0, result;
      while (h.state.y > surface && elapsed < landingTime + 1 / fps) {
        result = h.step(1 / fps); elapsed += 1 / fps;
      }
      close(h.state.y, surface);
      assert.ok(elapsed >= landingTime - 1e-10 && elapsed <= landingTime + 1 / fps + 1e-10, `${map}/${fps}/${height}: ${elapsed} vs ${landingTime}`);
      close(result?.prevVy ?? -contactSpeed, -contactSpeed);
      if (contactSpeed > 15.5) close(h.impacts[0][0], contactSpeed * 1.15);
      else { assert.equal(h.impacts.length, 0); close(h.state.vy, 0); }
    }
  }
});

test('roof contact waits for the physical surface, while ordinary powered controls remain active', () => {
  const building = { minX: -10, maxX: 10, minZ: -10, maxZ: 10, height: 25 };
  const roof = harness({ y: 25.06, vy: -0.2, airRemaining: 0, isFreefalling: true }, 'city', [building]);
  roof.step(1 / 144); assert.ok(roof.state.y > 25); assert.ok(roof.state.vy < 0);
  for (const code of ['Space', 'ShiftLeft', 'KeyN']) {
    const h = harness({ y: 100 }); h.keys[code] = true;
    const step = h.step(1 / 60);
    assert.ok(step.airConsumedThisFrame > 0);
    if (code === 'Space') { assert.equal(step.isLiftFiring, true); assert.ok(h.state.vy > 0); }
    if (code === 'ShiftLeft') { assert.equal(step.isDescendFiring, true); assert.ok(h.state.vy < -g / 60); }
    if (code === 'KeyN') { assert.equal(step.isLiftFiring, true); close(h.state.y, 100); close(h.state.vy, 0); }
  }
});


test('actual O launch preserves the complete prior horizontal vector on both maps', () => {
  for (const map of ['highway', 'city']) for (const fps of [30, 60, 144]) {
    for (const kmh of [50, 200, 300]) for (const reverse of [false, true]) {
      const vx = 2, vz = (reverse ? 1 : -1) * kmh / 3.6, speed = Math.hypot(vx, vz);
      const h = harness({ y: 0, vx, vz, speed, yaw: 0.3, driftAngle: 0.4, wasHandbraking: true }, map);
      h.launch(); close(h.state.vx, vx); close(h.state.vz, vz); close(h.state.speed, speed);
      assert.equal(h.state.isJumping6m, true);
      h.step(0); close(h.state.vx, vx); close(h.state.vz, vz);
      assert.equal(h.state.wasAirborne, true, 'O launch skips another tire grip/drive frame');
      h.step(1 / fps);
      const factor = 1 / (1 + 0.00012 * speed / fps);
      close(h.state.vx, vx * factor); close(h.state.vz, vz * factor);
      close(h.state.speed, speed * factor); assert.ok(h.state.y > 0);
      assert.ok(h.state.speed > speed * 0.999, 'takeoff cannot apply a stall brake');
    }
  }
});

test('established unpowered flight regains the previous release braking without changing vertical gravity', () => {
  const outcomes = [];
  for (const map of ['highway', 'city']) for (const fps of [30, 60, 144]) {
    const vx = 2, vz = -300 / 3.6, speed = Math.hypot(vx, vz);
    const h = harness({ vx, vz, speed, roll: 1.2, pitch: Math.PI, yaw: 0.8, airRemaining: 0, isFreefalling: true }, map);
    h.advance(1, fps);
    assert.ok(h.state.speed < speed * 0.3, 'sustained flight must no longer carry almost all launch speed');
    close(vx * h.state.vz - vz * h.state.vx, 0);
    close(h.state.y, 300 - 0.5 * g); close(h.state.vy, -g);
    outcomes.push(h.state.speed);
    const before = { vx: h.state.vx, vz: h.state.vz };
    h.state.yaw += Math.PI; h.state.roll = -0.8; h.state.pitch += 2 * Math.PI;
    h.step(1 / fps);
    close(before.vx * h.state.vz - before.vz * h.state.vx, 0);
  }
  for (const speed of outcomes) close(speed, outcomes[0]);
});

test('W/semicolon and mode changes limit added air thrust without clipping inherited overspeed', () => {
  for (const map of ['highway', 'city']) for (const code of ['KeyW', 'Semicolon']) {
    for (const kmh of [200, 300, 500]) {
      const speed = kmh / 3.6, h = harness({ y: 0, vz: -speed, speed }, map);
      h.launch(); h.keys[code] = true;
      const result = h.step(1 / 60);
      assert.equal(result.isRearThrusterFiring, true); close(h.state.vz, -speed); close(h.state.speed, speed);
      h.state.insaneMode = true; h.step(1 / 60); close(h.state.vz, -speed);
      h.state.insaneMode = false; h.step(1 / 60); close(h.state.vz, -speed);
    }
    const reverse = harness({ vz: 100, speed: 100 }, map); reverse.keys[code] = true;
    reverse.step(1 / 60);
    assert.ok(reverse.state.vz > reverse.state.airMaxSpeed && reverse.state.vz < 100, 'opposed thrust and the governor change velocity continuously');
  }
});

test('city ground, O launch and free flight share one metre-per-second horizontal scale', () => {
  for (const kind of ['ground', 'jump', 'air']) {
    const h = harness({ y: kind === 'air' ? 100 : 0, vx: 2, vz: -50, speed: Math.hypot(2, 50) }, 'city');
    if (kind === 'jump') h.launch();
    h.step(1 / 60);
    close(h.state.z / (h.state.vz / 60), 1.0);
    close(h.state.x / (h.state.vx / 60), 1.0);
  }
});

test('banked/yawed O plus rear thrust changes travel only by its finite nose impulse', () => {
  for (const map of ['highway', 'city']) for (const code of ['KeyW', 'Semicolon']) {
    for (const yaw of [Math.PI / 4, -Math.PI / 2, Math.PI]) for (const roll of [Math.PI / 3, -Math.PI / 2]) {
      const speed = 200 / 3.6, dt = 1 / 60;
      const h = harness({ y: 0, vx: 0, vz: -speed, speed, yaw, roll }, map);
      h.launch(); h.keys[code] = true; h.step(dt);
      assert.ok(Math.hypot(h.state.vx, h.state.vz + speed) <= 24 * dt + 1e-8, 'no bank-target velocity rewrite');
      assert.ok(h.state.speed >= speed - 24 * dt - 1e-8, 'only finite opposing thrust may decelerate');
    }
  }
});

test('rear thrust cannot clip an existing upward velocity or inject lift while level', () => {
  for (const map of ['highway', 'city']) for (const pitch of [0, Math.PI / 2, -Math.PI / 2]) {
    const h = harness({ y: 100, vy: 20, pitch }, map); h.keys.KeyW = true;
    h.step(1 / 60);
    const impulse = 9.5 * Math.sin(pitch) * 0.55 / 60;
    close(h.state.vy, 20 + Math.min(0, impulse) - g / 60);
  }
});

test('established powered flight promptly removes sideslip toward the aimed nose on both maps', () => {
  for (const map of ['highway', 'city']) for (const yaw of [Math.PI / 2, -Math.PI / 2]) {
    const h = harness({ vz: -50, speed: 50, yaw }, map); h.keys.KeyW = true;
    h.step(1 / 60);
    assert.ok(h.state.vz > -50 && h.state.vz < -35, 'first-frame correction is continuous');
    assert.ok(h.state.vx * -Math.sin(yaw) > 0, 'thrust still follows the nose');
    h.advance(0.4, 60);
    assert.ok(Math.abs(h.state.vz) < 0.9, `old forward drift clears rapidly after a flight turn: ${map}/${yaw}: ${h.state.vz}`);
    assert.ok(h.state.vx * -Math.sin(yaw) > 1, 'travel now follows the selected heading');
  }
});

function launchedFlight(overrides = {}, map = 'highway') {
  const h = harness({ y: 0, ...overrides }, map);
  h.launch();
  // Isolate horizontal transition high above support/collision geometry.
  h.state.y = 100; h.state.isJumping6m = false; h.state.vy = 0;
  return h;
}

test('O carries the full inherited vector for 0.25 seconds before smoothly restoring flight release braking', () => {
  const results = [];
  for (const map of ['highway', 'city']) for (const fps of [30, 60, 144]) {
    const speed = 300 / 3.6, h = launchedFlight({ vz: -speed, speed }, map);
    h.advance(0.25, fps);
    close(h.state.speed, speed / (1 + 0.00012 * speed * 0.25));
    const before = h.state.speed;
    h.step(1 / fps);
    assert.ok(h.state.speed < before && h.state.speed > before * 0.99, 'transition starts without a braking kick');
    h.advance(1.2 - 0.25 - 1 / fps, fps);
    assert.ok(h.state.speed < speed * 0.5, 'sustained coast is responsive again');
    assert.equal(h.state.jumpInertiaSeconds, null);
    close(h.state.y, 100 - 0.5 * g * 1.2 ** 2); close(h.state.vy, -g * 1.2);
    results.push(h.state.speed);
  }
  for (const speed of results) close(speed, results[0], 0.03);
});

test('smoothstep transition integrates frame crossings, zero dt and irregular frame lengths exactly', () => {
  for (const frames of [[0.25, 0.6, 0.4], [0, 0.13, 0.14, 0.3, 0.05, 0.63], [1.25]]) {
    const h = harness({ jumpInertiaSeconds: 0 });
    let handlingSeconds = 0;
    for (const dt of frames) handlingSeconds += h.context.advanceAirHandling(dt, true);
    close(handlingSeconds, 0.7);
    assert.equal(h.state.jumpInertiaSeconds, null);
  }
  const h = harness({ jumpInertiaSeconds: 0.2 });
  close(h.context.advanceAirHandling(0, true), 0); close(h.state.jumpInertiaSeconds, 0.2);
  close(h.context.advanceAirHandling(0, false), 0); assert.equal(h.state.jumpInertiaSeconds, null);
});

test('powered O overspeed settles after the launch grace without instantaneous clipping or mode-switch steps', () => {
  for (const map of ['highway', 'city']) for (const code of ['KeyW', 'Semicolon']) for (const fps of [30, 60, 144]) {
    const speed = 500 / 3.6, h = launchedFlight({ vz: -speed, speed }, map);
    h.keys[code] = true; h.advance(0.25, fps); close(h.state.speed, speed);
    const before = h.state.speed;
    h.step(1 / fps); assert.ok(h.state.speed < before && h.state.speed > before * 0.99);
    h.state.insaneMode = true; const plaidBefore = h.state.speed;
    h.step(0); close(h.state.speed, plaidBefore);
    h.state.insaneMode = false; h.step(0); close(h.state.speed, plaidBefore);
    h.advance(1.5, fps);
    assert.ok(h.state.speed > h.state.airMaxSpeed && h.state.speed < h.state.airMaxSpeed + 5);
  }
});

test('midair O cannot restart launch inertia, while a fresh grounded O can', () => {
  const h = launchedFlight(); h.advance(0.4, 60);
  const age = h.state.jumpInertiaSeconds;
  h.launch(); close(h.state.jumpInertiaSeconds, age);
  h.advance(0.5, 60); assert.equal(h.state.jumpInertiaSeconds, null);
  h.launch(); assert.equal(h.state.jumpInertiaSeconds, null);
  Object.assign(h.state, { y: 0, vy: 0, isJumping6m: false });
  h.launch(); close(h.state.jumpInertiaSeconds, 0);
});

test('bank assist returns after the hop on both maps and cannot supply empty-tank side jets', () => {
  for (const map of ['highway', 'city']) {
    const h = launchedFlight({ roll: Math.PI / 3, vz: -20, speed: 20 }, map);
    h.advance(0.25, 60); close(h.state.vx, 0);
    h.advance(0.6, 60); assert.ok(h.state.vx > 5 && h.state.vx < 9);
    const empty = harness({ roll: Math.PI / 3, vz: -20, speed: 20, airRemaining: 0, isFreefalling: true }, map);
    empty.advance(0.2, 60); close(empty.state.vx, 0);
    close(empty.state.vy, -g * 0.2);
  }
});

test('actual A/W and D/W flight turns keep the velocity close to the changing heading across FPS and maps', () => {
  for (const map of ['highway', 'city']) for (const code of ['KeyA', 'KeyD']) for (const fps of [30, 60, 144]) {
    const h = harness({ y: 100, vz: -30, speed: 30 }, map);
    h.keys.KeyW = true; h.keys[code] = true;
    h.advance(0.8, fps);
    const sideways = h.state.vx * Math.cos(h.state.yaw) - h.state.vz * Math.sin(h.state.yaw);
    assert.ok(Math.abs(h.state.yaw) > 0.25, 'keyboard yaw still rotates the nose');
    assert.ok(Math.abs(sideways) < h.state.speed * 0.15, `flight follows the turn instead of carrying old drift: ${map}/${code}/${fps}/${sideways}/${h.state.speed}`);
    assert.ok(h.state.vx * (code === 'KeyA' ? -1 : 1) > 4, 'travel turns in the requested direction');
    assert.ok(h.state.airRemaining < 10, 'powered steering uses the shared tank');
  }
});
