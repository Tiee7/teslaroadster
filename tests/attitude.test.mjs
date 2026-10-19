import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const physics = readFileSync(new URL('../src/physics-main.js', import.meta.url), 'utf8');
const config = readFileSync(new URL('../src/config.js', import.meta.url), 'utf8');
const hud = readFileSync(new URL('../src/ui-hud.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');

function section(source, start, end, from = 0) {
  const first = source.indexOf(start, from);
  const last = source.indexOf(end, first + start.length);
  assert.ok(first >= 0 && last > first, `Missing production section: ${start}`);
  return source.slice(first, last);
}

// Run production input, air-tank, attitude and complete map-specific movement paths.
// Scene geometry and the separate gravity/altitude controller are outside this focused harness.
const helpers = section(physics, 'function wrapAnglePi(', 'function updateSimulation(');
const input = section(physics, '  const isAirborne =', '  // Unified COPV Air Tank');
const airTank = section(physics, '  let airConsumedThisFrame =', '  let canUseRCS =');
const movementSetup = section(physics, '  const isRealMode =', '  let groundElevation =');
const movement = section(physics, '  let canUseRCS =', '  const wantsHover =');
const roadScroll = section(physics, '  // Highway road markings & arches scroll', '  trafficCars.forEach');
const trafficScroll = section(physics, '      const relSpeed =', '      car.changeTimer -=');
const blastScroll = physics.match(/      car\.mesh\.position\.z \+= \(currentMap === 'highway'[^\n]+/)[0];
const collision = section(physics, 'function triggerPhysicsCollision(', 'function destroyVehicle(');
const trafficCollision = section(physics, '        const relVx = state.vx', '\n      }\n    }\n  });');
const buildingCollision = section(physics, '          const impactSpeed = Math.hypot', '\n        }\n      }\n    }\n  }');
const attitude = section(physics, '  // Requirement 3: All airborne attitude RCS jets', "  if (currentMap === 'city') {");
const emergency = section(physics, '  if (needsEmergencyLandingSave) {', '  } else {\n    state.isAutoLandingSave = false;').replace('  if (needsEmergencyLandingSave) {', '');
const inputHandlers = section(hud, 'const keys = {};', 'function showBanner(');
const reset = section(hud, 'function resetCar(', 'function applyTranslations(');

class Element {
  constructor(attributes = {}, tag = '') {
    this.attributes = attributes; this.tag = tag; this.listeners = {};
    this.classList = { add() {}, remove() {}, toggle() {}, contains: () => true };
  }
  addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
  emit(type, event = {}) {
    for (const listener of this.listeners[type] || []) listener({ target: this, preventDefault() {}, pointerId: 1, ...event });
  }
  getAttribute(name) { return this.attributes[name]; }
  setPointerCapture() {}
  releasePointerCapture() {}
  closest() { return null; }
}

function harness(overrides = {}, map = 'highway') {
  const elements = new Map();
  const touch = [...html.matchAll(/<(button|span)\b([^>]*\bdata-hold-key="([^"]+)"[^>]*)>/g)]
    .map(([, tag, attributes, code]) => new Element({ 'data-hold-key': code, id: /\bid="([^"]+)"/.exec(attributes)?.[1] }, tag));
  const document = new Element();
  document.querySelectorAll = () => touch;
  document.getElementById = id => {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id);
  };
  const window = new Element();
  const banners = [];
  const context = vm.createContext({
    Element, document, window, testGroundElevation: 0, carMeshGroup: {}, frontWheelSteerGroups: [], scrollingProps: [],
    THREE: { MathUtils: { clamp: (x, lo, hi) => Math.max(lo, Math.min(hi, x)), lerp: (a, b, t) => a + (b - a) * t } },
    sound: { init() {}, beep() {}, speakAlert() {}, playCrash() {} },
    showBanner: (...args) => banners.push(args), clearDebris() {}, renderBannerText() {},
    destroyVehicle() { context.gameState.isDestroyed = true; },
  });
  vm.runInContext(`${config}\n${inputHandlers}\n${helpers}\n${reset}\n${collision}
    function stepAttitude(dt) {
      const groundElevation = testGroundElevation;
      ${input}
      ${airTank}
      let canUseRCS = false;
      ${attitude}
    }
    function stepEmergency(dt) {
      const groundElevation = testGroundElevation;
      ${input}
      ${airTank}
      const AUTO_BRAKE_ACCEL = 58.0;
      const agl = 2.0;
      let isLiftFiring = false;
      ${emergency}
      return isLiftFiring;
    }
    function stepMovement(dt) {
      ${movementSetup}
      const groundElevation = testGroundElevation;
      ${input}
      ${airTank}
      ${movement}
    }
    function stepTraffic(dt, car) { ${trafficScroll} }
    function stepBlast(dt, car) { ${blastScroll} }
    function stepRoad(dt) { ${roadScroll} }
    function collideTraffic(car) {
      const isAirborne = state.wasAirborne;
      ${trafficCollision}
    }
    function collideBuilding(b) {
      const isAirborne = state.wasAirborne;
      ${buildingCollision}
    }
    function setMap(map) { currentMap = map; }
    globalThis.gameState = state;
    globalThis.gameKeys = keys;
  `, context);
  context.setMap(map);
  Object.assign(context.gameState, { y: 100, speed: 0, vx: 0, vy: 0, vz: 0, ...overrides });
  return {
    context, state: context.gameState, keys: context.gameKeys, window, touch, banners,
    step: dt => context.stepAttitude(dt), emergency: dt => context.stepEmergency(dt),
    move: dt => context.stepMovement(dt),
    advance(seconds, dt = 0.01) {
      const steps = Math.floor(seconds / dt);
      for (let i = 0; i < steps; i++) context.stepAttitude(dt);
      const remainder = seconds - steps * dt;
      if (remainder > 1e-12) context.stepAttitude(remainder);
    },
  };
}

function close(actual, expected, epsilon = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
}

test('keyboard I/K, arrow aliases and opposing controls retain their attitude mapping', () => {
  for (const [code, direction] of [['KeyI', 1], ['ArrowUp', 1], ['KeyK', -1], ['ArrowDown', -1]]) {
    const h = harness();
    h.window.emit('keydown', { code }); h.step(0.05);
    assert.equal(Math.sign(h.state.vPitch), direction, code);
    assert.equal(h.state.attitudeIdleSeconds, 0);
    h.window.emit('keyup', { code }); assert.equal(h.keys[code], false);
  }
  const h = harness({ pitch: 0.8, roll: 0.6, attitudeIdleSeconds: 2 });
  Object.assign(h.keys, { KeyI: true, KeyK: true }); h.step(0.05);
  close(h.state.pitch, 0.8); close(h.state.roll, 0.6);
  assert.equal(h.state.attitudeIdleSeconds, 0);
});

test('held forward/back pitch completes repeated 360-degree loops without 74/180/360-degree stops', () => {
  for (const physicsMode of ['realistic', 'fantasy']) {
    for (const map of ['highway', 'city']) {
      for (const [code, direction] of [['KeyI', 1], ['KeyK', -1]]) {
        const h = harness({ physicsMode, attitudeIdleSeconds: 2, speed: 90 }, map);
        h.keys[code] = true;
        let previous = h.state.pitch;
        for (let i = 0; i < 480; i++) {
          h.step(1 / 60);
          const change = (h.state.pitch - previous) * direction;
          assert.ok(change > 0 && change < 0.05, `${physicsMode}/${map}/${code}: smooth continuous pitch`);
          assert.ok(Number.isFinite(h.state.vPitch));
          previous = h.state.pitch;
        }
        assert.ok(h.state.pitch * direction > Math.PI * 4, `${physicsMode}/${map}/${code}: at least two loops`);
        close(h.state.airRemaining, 10 - 8 * 0.38, 1e-9);
        assert.equal(h.state.attitudeIdleSeconds, 0);
      }
    }
  }
});

test('auto-level and high-speed wing assist wait the full two seconds after release', () => {
  const h = harness({ pitch: 0.9, roll: 0.6, speed: 100 });
  h.keys.KeyI = true; h.step(0.01); h.keys.KeyI = false;
  Object.assign(h.state, { pitch: 0.9, roll: 0.6, vPitch: 0, vRoll: 0 });
  h.advance(1.999);
  close(h.state.pitch, 0.9); close(h.state.roll, 0.6); close(h.state.vPitch, 0);
  h.step(0.001);
  close(h.state.pitch, 0.9); close(h.state.roll, 0.6);
  h.step(0.001);
  assert.ok(h.state.pitch < 0.9 && h.state.roll < 0.6);
  assert.ok(h.state.pitch > 0.89 && h.state.roll > 0.59, 'first correction is gradual');
});

test('a frame crossing the deadline uses only its post-deadline fraction for restoring torque', () => {
  const h = harness({ pitch: 0.9, attitudeIdleSeconds: 1.99 });
  h.step(0.05);
  close(h.state.vPitch, -0.9 * 6.5 * 0.04 * Math.pow(0.20, 0.05));
  assert.equal(h.state.attitudeIdleSeconds, 2);
});

test('every held attitude/strafe control disables both auto-level axes, even if jets are unavailable', () => {
  for (const codes of [['KeyJ'], ['KeyL'], ['KeyI'], ['KeyK'], ['ArrowLeft'], ['ArrowRight'], ['ArrowUp'], ['ArrowDown'], ['KeyA'], ['KeyD'], ['KeyQ'], ['KeyE'], ['KeyJ', 'KeyL'], ['KeyI', 'KeyK']]) {
    for (const airRemaining of [10, 0]) {
      const enabled = harness({ pitch: 0.9, roll: 0.6, speed: 100, attitudeIdleSeconds: 2, airRemaining });
      const disabled = harness({ pitch: 0.9, roll: 0.6, speed: 100, attitudeIdleSeconds: 2, airRemaining, autoStabilizer: false });
      for (const code of codes) { enabled.keys[code] = true; disabled.keys[code] = true; }
      enabled.advance(2.5); disabled.advance(2.5);
      for (const name of ['pitch', 'roll', 'vPitch', 'vRoll']) close(enabled.state[name], disabled.state[name]);
      assert.equal(enabled.state.attitudeIdleSeconds, 0);
    }
  }
});

test('renewed input interrupts active correction and restarts a fresh full two-second grace period', () => {
  const h = harness({ pitch: 0.9, attitudeIdleSeconds: 2 });
  h.step(0.05); assert.ok(h.state.vPitch < 0);
  h.keys.KeyJ = true; h.step(0.05); assert.equal(h.state.attitudeIdleSeconds, 0);
  h.keys.KeyJ = false; Object.assign(h.state, { pitch: 0.9, vPitch: 0 });
  h.advance(1.999); close(h.state.pitch, 0.9);
  h.step(0.001); close(h.state.pitch, 0.9);
  h.step(0.01); assert.ok(h.state.pitch < 0.9);
});

test('stabilizer-off keeps a released airborne attitude, including above wing-assist speed', () => {
  const h = harness({ pitch: 1.8, roll: 0.6, speed: 100, autoStabilizer: false });
  h.advance(6);
  close(h.state.pitch, 1.8); close(h.state.roll, 0.6);
  close(h.state.vPitch, 0); close(h.state.vRoll, 0);
});

test('pitch correction takes the nearest level path across +/-180 and completed +/-360 loops', () => {
  for (const pitch of [Math.PI - 0.00001, Math.PI + 0.00001, -Math.PI - 0.00001, -Math.PI + 0.00001, 2 * Math.PI - 0.1, 2 * Math.PI + 0.1, -2 * Math.PI - 0.1, -2 * Math.PI + 0.1]) {
    const h = harness({ pitch, attitudeIdleSeconds: 2, speed: 90 });
    const error = h.context.wrapAnglePi(pitch);
    h.step(1 / 60);
    assert.equal(Math.sign(h.state.vPitch), -Math.sign(error));
    assert.ok(Math.abs(h.state.pitch - pitch) < 0.02, 'no snap or representation wrap at 180');
    h.advance(8);
    assert.ok(Math.abs(h.context.wrapAnglePi(h.state.pitch)) < 0.001, 'settles level smoothly');
    assert.ok(Math.abs(h.state.pitch - pitch) <= Math.PI + 0.01, 'does not unwind completed loops');
  }
});

test('landing after either full pitch loop preserves the equivalent ground attitude and resets idle', () => {
  for (const direction of [1, -1]) {
    const h = harness({ pitch: direction * (2 * Math.PI + 0.03), attitudeIdleSeconds: 2 });
    h.state.y = 0; h.step(0.01);
    assert.ok(Math.abs(h.state.pitch - direction * 2 * Math.PI) < 0.04);
    assert.equal(h.state.attitudeIdleSeconds, 0);
    h.state.pitch = direction * (2 * Math.PI + 0.9); h.state.vPitch = 0; h.step(0.01);
    assert.ok(Math.abs(h.context.wrapAnglePi(h.state.pitch)) <= 0.140000001, 'ground contact envelope retained');
    h.state.y = 100; h.state.vPitch = 0; h.state.pitch = direction * (2 * Math.PI + 0.1);
    h.advance(1.99); close(h.state.pitch, direction * (2 * Math.PI + 0.1));
  }
});

test('emergency descent braking keeps working while its attitude correction respects controls and delay', () => {
  const h = harness({ pitch: 0.9, roll: 0.6, vy: -10, attitudeIdleSeconds: 2 });
  h.keys.KeyI = true;
  assert.equal(h.emergency(0.05), true);
  assert.ok(h.state.vy > -10, 'vertical emergency braking remains active');
  close(h.state.pitch, 0.9); close(h.state.roll, 0.6);
  h.keys.KeyI = false;
  h.emergency(1.999); close(h.state.pitch, 0.9); close(h.state.roll, 0.6);
  h.emergency(0.001); close(h.state.pitch, 0.9); close(h.state.roll, 0.6);
  h.emergency(0.01); assert.ok(h.state.pitch < 0.9 && h.state.roll < 0.6);
});

test('reset clears the delayed-stabilizer state together with all angular motion', () => {
  const h = harness({ pitch: 9, roll: 2, vPitch: 1, vRoll: 1, attitudeIdleSeconds: 2 });
  h.context.resetCar();
  for (const key of ['pitch', 'roll', 'vPitch', 'vRoll', 'attitudeIdleSeconds']) assert.equal(h.state[key], 0);
});

test('mobile touch pitch/roll buttons use the keyboard mapping and release/cancel without stuck input', () => {
  for (const [code, direction] of [['KeyI', 1], ['KeyK', -1], ['KeyJ', 1], ['KeyL', -1]]) {
    for (const endEvent of ['pointerup', 'pointercancel', 'pointerleave']) {
      const h = harness({ attitudeIdleSeconds: 2 });
      const button = h.touch.find(el => el.tag === 'button' && el.getAttribute('data-hold-key') === code);
      assert.ok(button, `Missing mobile touch control ${code}`);
      button.emit('pointerdown'); h.step(0.05);
      const velocity = code === 'KeyI' || code === 'KeyK' ? h.state.vPitch : h.state.vRoll;
      assert.equal(Math.sign(velocity), direction);
      assert.equal(h.state.attitudeIdleSeconds, 0);
      button.emit(endEvent); assert.equal(h.keys[code], false);
      h.step(0.05); assert.ok(h.state.attitudeIdleSeconds > 0);
    }
  }
});

test('complete movement paths project thrust through +/-90/180/270/360 without reversing on release', () => {
  const dt = 1 / 60;
  for (const physicsMode of ['realistic', 'fantasy']) {
    for (const map of ['highway', 'city']) {
      for (const yaw of [0, 0.7]) {
        for (const turn of [-2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2]) {
          const pitch = turn * Math.PI;
          const h = harness({ physicsMode, pitch, yaw }, map);
          const accel = physicsMode === 'realistic' ? 9.5 : map === 'city' ? 145 : 92;
          h.keys.KeyW = true; h.move(dt);
          close(h.state.vx, -Math.sin(yaw) * Math.cos(pitch) * accel * dt);
          close(h.state.vz, -Math.cos(yaw) * Math.cos(pitch) * accel * dt);
          close(h.state.vy, Math.sin(pitch) * accel * 0.55 * dt);
          close(h.state.speed, Math.hypot(h.state.vx, h.state.vz));
          close(h.state.airRemaining, 10 - 0.65 * dt);
          const vx = h.state.vx, vz = h.state.vz;
          h.keys.KeyW = false; h.move(dt);
          assert.ok(vx * h.state.vx + vz * h.state.vz >= 0, `${map}/${physicsMode}/${turn}: release preserves direction`);
          close(vx * h.state.vz - vz * h.state.vx, 0);
          assert.ok(Math.hypot(h.state.vx, h.state.vz) <= Math.hypot(vx, vz) + 1e-10);
          close(h.state.speed, Math.hypot(h.state.vx, h.state.vz));
          close(h.state.airRemaining, 10 - 0.65 * dt, 1e-9);
        }
      }
    }
  }
});

test('coasting momentum is independent of pitch rotation and yaw input on either map', () => {
  for (const map of ['highway', 'city']) {
    const h = harness({ vx: 3, vz: 20, speed: Math.hypot(3, 20), yaw: 0.4 }, map);
    h.keys.KeyA = true;
    for (const pitch of [0, Math.PI / 2, Math.PI, Math.PI * 1.5, Math.PI * 2, -Math.PI, -Math.PI * 2]) {
      h.state.pitch = pitch;
      const vx = h.state.vx, vz = h.state.vz;
      h.step(1 / 60); h.move(1 / 60);
      assert.ok(vx * h.state.vx + vz * h.state.vz > 0);
      close(vx * h.state.vz - vz * h.state.vx, 0, 1e-9);
      assert.equal(h.state.attitudeIdleSeconds, 0);
    }
    assert.ok(h.state.yaw > 0.4, 'A still produces aerial yaw');
  }
});

test('thrusting while holding pitch keeps velocity changes continuous through two full loops', () => {
  for (const map of ['highway', 'city']) {
    for (const direction of [1, -1]) {
      const h = harness({}, map);
      h.keys.KeyW = true; h.keys[direction > 0 ? 'KeyI' : 'KeyK'] = true;
      for (let i = 0; i < 480; i++) {
        const previousVz = h.state.vz;
        h.move(1 / 60); h.step(1 / 60);
        assert.ok(Math.abs(h.state.vz - previousVz) <= 9.5 / 60 + 1e-9, 'pitch causes acceleration, never remaps velocity');
        close(h.state.speed, Math.hypot(h.state.vx, h.state.vz));
      }
      assert.ok(h.state.pitch * direction > 4 * Math.PI);
      assert.equal(h.state.attitudeIdleSeconds, 0);
    }
  }
});

test('air braking and Q/E strafe remain responsive in either travel direction without release inversion', () => {
  for (const map of ['highway', 'city']) {
    for (const code of ['KeyH', 'KeyS']) {
      for (const direction of [1, -1]) {
        const h = harness({ pitch: Math.PI, vz: direction * 20, speed: 20 }, map);
        h.keys[code] = true; h.move(1 / 60);
        const passiveSpeed = 20 / (1 + 0.00012 * 20 / 60);
        close(h.state.vz, direction * (passiveSpeed - (80000 / (1850 + 144)) / 60));
        close(h.state.speed, Math.abs(h.state.vz));
      }
    }
    for (const [code, direction] of [['KeyQ', -1], ['KeyE', 1]]) {
      const h = harness({ pitch: Math.PI, yaw: 0.7 }, map);
      h.keys[code] = true; h.move(1 / 60);
      const rightX = Math.cos(h.state.yaw), rightZ = -Math.sin(h.state.yaw);
      assert.equal(Math.sign(h.state.vx * rightX + h.state.vz * rightZ), direction);
      close(h.state.airRemaining, 10 - 0.45 / 60);
      const vx = h.state.vx, vz = h.state.vz;
      h.keys[code] = false; h.move(1 / 60);
      assert.ok(vx * h.state.vx + vz * h.state.vz > 0, 'releasing strafe coasts without reversal');
      close(vx * h.state.vz - vz * h.state.vx, 0);
    }
  }
});

test('backward flight hands signed momentum into ground driving after touchdown', () => {
  for (const map of ['highway', 'city']) {
    const h = harness({ pitch: Math.PI, vz: 20, speed: 20 }, map);
    h.move(0); assert.equal(h.state.wasAirborne, true);
    h.state.y = 0; h.state.pitch = 2 * Math.PI;
    h.move(1 / 60);
    assert.ok(h.state.vz > 19, `${map}: touchdown retains backward velocity`);
    assert.ok(h.state.speed < 0, `${map}: existing ground reverse convention restored`);
    assert.equal(h.state.wasAirborne, false);
    h.state.wasAirborne = true; h.context.resetCar();
    assert.equal(h.state.wasAirborne, false);
  }
});

test('highway road, traffic and blast scrolling follow actual vz rather than positive HUD speed', () => {
  for (const vz of [20, -20]) {
    const h = harness({ vz, speed: 999 });
    const prop = { position: { z: 0 } };
    h.context.scrollingProps.push(prop); h.context.stepRoad(0.1);
    close(prop.position.z, -vz * 1.65 * 0.1);
    const car = { speed: 10, blastVz: 5, mesh: { position: { z: 0 } } };
    h.context.stepTraffic(0.1, car);
    close(car.mesh.position.z, (-vz - 10) * 1.65 * 0.1);
    car.mesh.position.z = 0; h.context.stepBlast(0.1, car);
    close(car.mesh.position.z, (-vz - 10 + 5) * 0.1);
  }
  assert.match(physics, /const scrollDz = \(currentMap === 'highway' \? \(-state\.vz\)/, 'tire smoke follows actual highway travel');
  assert.match(physics, /const slantZ = \(currentMap === 'highway' \? -state\.vz/, 'rain follows reverse travel');
});

test('real airborne traffic collision slowdown/rebound survives the next movement frame on both maps', () => {
  for (const map of ['highway', 'city']) {
    const h = harness({ vz: -20, speed: 20, wasAirborne: true }, map);
    const car = { vx: 0, vz: 0, mesh: { position: { x: h.state.x, z: 0 } } };
    h.context.collideTraffic(car);
    assert.equal(h.state.isDestroyed, false);
    close(h.state.vz, map === 'highway' ? -14 : 7);
    close(h.state.speed, Math.hypot(h.state.vx, h.state.vz));
    const vx = h.state.vx, vz = h.state.vz, speed = h.state.speed;
    h.move(1 / 60);
    assert.equal(Math.sign(h.state.vz), Math.sign(vz), `${map}: collision direction survives coasting`);
    assert.ok(Math.abs(h.state.vz) < Math.abs(vz));
    assert.ok(h.state.speed < speed);
    close(vx * h.state.vz - vz * h.state.vx, 0, 1e-9);
    close(h.state.speed, Math.hypot(h.state.vx, h.state.vz));
  }
});

test('real city building and outer-boundary rebounds keep authoritative airborne velocity and magnitude', () => {
  const building = harness({ x: 5, z: 5, vz: -20, speed: 20, wasAirborne: true }, 'city');
  building.context.collideBuilding({ minX: 0, maxX: 10, minZ: 0, maxZ: 10, height: 200 });
  assert.equal(building.state.isDestroyed, false);
  close(building.state.vz, 6);
  close(building.state.speed, 6);
  building.move(1 / 60);
  assert.ok(building.state.vz > 0 && building.state.vz < 6);
  close(building.state.speed, Math.hypot(building.state.vx, building.state.vz));

  const boundary = harness({ x: 1197.9, vz: -20, speed: 20 }, 'city');
  boundary.move(1 / 60);
  assert.equal(boundary.state.isDestroyed, false);
  assert.ok(boundary.state.vz > 0 && boundary.state.vz < 7);
  close(boundary.state.speed, Math.hypot(boundary.state.vx, boundary.state.vz));
  const speed = boundary.state.speed;
  boundary.move(1 / 60);
  assert.ok(boundary.state.vz > 0 && boundary.state.speed < speed);
  close(boundary.state.speed, Math.hypot(boundary.state.vx, boundary.state.vz));
});

test('generic collision applies longitudinal bounce in air while preserving the existing ground response', () => {
  for (const wasAirborne of [false, true]) {
    const h = harness({ vx: 3, vz: -20, speed: 20, wasAirborne });
    h.context.triggerPhysicsCollision(12, 'crashReasonThreshold', -1, 2, 5);
    close(h.state.vx, 2);
    close(h.state.vz, wasAirborne ? -15 : -20);
    close(h.state.speed, wasAirborne ? Math.hypot(2, -15) : 20);
    if (wasAirborne) {
      h.move(1 / 60);
      assert.ok(h.state.vz > -15 && h.state.vz < 0);
      close(h.state.speed, Math.hypot(h.state.vx, h.state.vz));
    }
  }
});

test('ground traffic and building collision scalar responses remain unchanged', () => {
  for (const map of ['highway', 'city']) {
    const h = harness({ y: 0, vz: -20, speed: 20 }, map);
    h.context.collideTraffic({ vx: 0, vz: 0, mesh: { position: { x: h.state.x, z: 0 } } });
    close(h.state.speed, map === 'highway' ? 14 : -7);
    close(h.state.vz, -20);
  }
  const h = harness({ y: 0, vz: -20, speed: 20 }, 'city');
  h.context.collideBuilding({ minX: 0, maxX: 10, minZ: 0, maxZ: 10, height: 200 });
  close(h.state.speed, -6);
  close(h.state.vz, -20);
});


test('highway landing and ground steering preserve the equivalent yaw after complete aerial turns', () => {
  for (const turns of [-2, -1, 0, 1, 2]) {
    for (const yawOffset of [-0.2, 0, 0.2]) {
      const yaw = turns * Math.PI * 2 + yawOffset;
      const h = harness({ y: 0, yaw, speed: 0, vx: 0, vz: 0 });
      h.step(1 / 60);
      close(h.state.yaw, yaw);
      h.move(1 / 60);
      assert.ok(Math.abs(h.state.yaw - yaw) < 0.04, 'ground spring must not unwind completed turns');
      assert.ok(Math.abs(h.context.wrapAnglePi(h.state.yaw)) <= Math.abs(yawOffset) + 1e-10);
    }
  }
});

test('highway rails and city boundaries use the same shortest yaw correction for every equivalent turn', () => {
  for (const map of ['highway', 'city']) {
    const results = [];
    for (const turns of [-2, -1, 0, 1, 2]) {
      const yaw = turns * Math.PI * 2 + 0.2;
      const h = harness({ x: 5000, yaw, speed: 0, vx: 0, vz: 0 }, map);
      h.move(1 / 60);
      const delta = h.state.yaw - yaw;
      assert.ok(Math.abs(delta) < 0.02, `${map}: boundary response must not unwind turns`);
      results.push(delta);
    }
    results.forEach(delta => close(delta, results[0]));
  }
});
