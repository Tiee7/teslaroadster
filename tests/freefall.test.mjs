import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

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
  const banners = [], impacts = [];
  const context = vm.createContext({
    cityBuildings: buildings, frontWheelSteerGroups: [], carMeshGroup: {},
    THREE: { MathUtils: { clamp: (x, lo, hi) => Math.max(lo, Math.min(hi, x)), lerp: (a, b, t) => a + (b - a) * t } },
    document: { getElementById: () => ({ classList: { remove() {} } }) },
    sound: { init() {}, speakAlert() {}, beep() {}, playCrash() {} },
    showBanner: (...args) => banners.push(args),
    destroyVehicle() { context.gameState.isDestroyed = true; },
    recordImpact: (...args) => impacts.push(args),
  });
  vm.runInContext(`${config}\nconst keys = {};\n${helpers}\n${collision}\n${jump}
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
  return { state: context.gameState, keys: context.gameKeys, context, banners, impacts,
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

test('air coasting preserves world direction through attitude changes and stays FPS independent', () => {
  for (const map of ['highway', 'city']) for (const fps of [30, 60, 144]) {
    const vx = 2, vz = -300 / 3.6, speed = Math.hypot(vx, vz);
    const h = harness({ vx, vz, speed, roll: 1.2, pitch: Math.PI, yaw: 0.8 }, map);
    h.advance(2, fps);
    const factor = 1 / (1 + 0.00012 * speed * 2);
    close(h.state.vx, vx * factor); close(h.state.vz, vz * factor); close(h.state.speed, speed * factor);
    assert.ok(h.state.speed > speed * 0.98, 'only gradual aerodynamic drag is applied');
    const before = { vx: h.state.vx, vz: h.state.vz };
    h.state.yaw += Math.PI; h.state.roll = -0.8; h.state.pitch += 2 * Math.PI;
    h.step(1 / fps);
    close(before.vx * h.state.vz - before.vz * h.state.vx, 0);
  }
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
    assert.ok(reverse.state.vz > 99 && reverse.state.vz < 100, 'opposed thrust changes velocity continuously');
  }
});

test('city ground, O launch and free flight share the same horizontal world speed scale', () => {
  for (const kind of ['ground', 'jump', 'air']) {
    const h = harness({ y: kind === 'air' ? 100 : 0, vx: 2, vz: -50, speed: Math.hypot(2, 50) }, 'city');
    if (kind === 'jump') h.launch();
    h.step(1 / 60);
    close(h.state.z / (h.state.vz / 60), 1.65);
    close(h.state.x / (h.state.vx / 60), 1.65);
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

test('perpendicular rear thrust can redirect overspeed flight without erasing the inherited component', () => {
  for (const map of ['highway', 'city']) for (const yaw of [Math.PI / 2, -Math.PI / 2]) {
    const h = harness({ vz: -100, speed: 100, yaw }, map); h.keys.KeyW = true;
    h.step(1 / 60);
    close(h.state.vz, -100); close(h.state.vx, -Math.sin(yaw) * 9.5 / 60);
    assert.ok(h.state.speed >= 100, 'new sideways thrust may add energy to inherited forward momentum');
  }
});
