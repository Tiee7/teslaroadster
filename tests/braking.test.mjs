import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const scoreRules = readFileSync(new URL('../src/driving-score.js', import.meta.url), 'utf8');

const traffic = readFileSync(new URL('../src/highway-traffic.js', import.meta.url), 'utf8');
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
const completeMotion = section(physics, '  const isRealMode =', '  const playerWorldZ =');
const groundRecharge = section(physics, '    // A firing retro jet uses the same tank;', '\n  }\n\n  // Requirement 3: All airborne attitude RCS jets');
const roadScroll = section(physics, '  // Highway road markings & arches scroll', '  trafficCars.forEach');
const trafficScroll = 'highwayTraffic.step([car], { x: state.x, y: state.y, z: 0, vx: state.vx, vz: state.vz }, dt, LANE_CENTERS, WORLD_SPEED_SCALE);';
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
    Element, document, window, testGroundElevation: 0, carMeshGroup: {}, cityBuildings: [], frontWheelSteerGroups: [], scrollingProps: [],
    THREE: { MathUtils: { clamp: (x, lo, hi) => Math.max(lo, Math.min(hi, x)), lerp: (a, b, t) => a + (b - a) * t } },
    sound: { init() {}, beep() {}, speakAlert() {}, playCrash() {} },
    showBanner: (...args) => banners.push(args), clearDebris() {}, renderBannerText() {},
    destroyVehicle() { context.gameState.isDestroyed = true; },
  });
  vm.runInContext(`${traffic}\n${scoreRules}\n${config}\n${inputHandlers}\n${helpers}\n${reset}\n${collision}
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
    function stepMovement(dt, recharge = false) {
      ${movementSetup}
      const groundElevation = testGroundElevation;
      ${input}
      ${airTank}
      ${movement}
      if (recharge && state.y <= 0) {
        const wantsHover = Boolean(keys.Space);
        ${groundRecharge}
      }
      return { isRetroBrakeFiring, retroBrakeDemand, retroImpulseSeconds, retroUsesRearNozzles,
        airConsumedThisFrame, flowLps: dt > 0 ? Math.round(airConsumedThisFrame * 60 / dt) : 0 };
    }
    function stepFrame(dt) {
      const t = I18N[currentLang];
      ${completeMotion}
      return { isRetroBrakeFiring, isRearThrusterFiring, airConsumedThisFrame, retroBrakeDemand, retroUsesRearNozzles };
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
    move: (dt, recharge = false) => context.stepMovement(dt, recharge),
    frame: dt => context.stepFrame(dt),
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

function moving(speed, map = 'highway', extra = {}) {
  return harness({ y: 0, speed, vx: 0, vz: -speed, physicsMode: 'fantasy', ...extra }, map);
}

test('200 km/h boundary uses km/h physics regardless of HUD unit, smoothly reaches full thrust at 240', () => {
  for (const map of ['highway', 'city']) {
    for (const speedUnit of ['kmh', 'mph']) {
      let previous = -1;
      for (const kmh of [199.99, 200, 200.01, 201, 210, 220, 230, 239.99, 240, 370, 576, 1234]) {
        const h = moving(kmh / 3.6, map, { speedUnit });
        h.keys.KeyH = true;
        const step = h.move(1 / 60);
        if (kmh <= 200) {
          close(h.state.airRemaining, 10);
          assert.equal(step.isRetroBrakeFiring, false);
          close(h.state.speed, kmh / 3.6 - 38 / 60);
        } else {
          assert.ok(h.state.speed < kmh / 3.6 - 38 / 60);
          assert.ok(step.isRetroBrakeFiring);
          const x = Math.min(1, (kmh - 200) / 40), duty = x * x * (3 - 2 * x);
          close(step.retroBrakeDemand, duty, 1e-12);
          close(10 - h.state.airRemaining, 0.55 * duty / 60);
          close(h.state.speed, kmh / 3.6 - 38 / 60 - 80000 / 1994 * duty / 60);
        }
        assert.ok(step.retroBrakeDemand >= previous);
        previous = step.retroBrakeDemand;
      }
      const a = moving(200 / 3.6, map), b = moving(200.01 / 3.6, map);
      a.keys.KeyH = b.keys.KeyH = true;
      a.move(1 / 60); b.move(1 / 60);
      assert.ok(Math.abs(a.state.speed - b.state.speed) < 0.003, 'no step kick at 200');
    }
  }
});

test('supersonic braking adds finite force-based thrust, shared by H and S, without double billing', () => {
  for (const map of ['highway', 'city']) {
    for (const codes of [['KeyH'], ['KeyS'], ['KeyH', 'KeyS']]) {
      const h = moving(350, map);
      for (const code of codes) h.keys[code] = true;
      const step = h.move(0.05);
      assert.ok(h.state.speed < 350 - 1.9, `${map}/${codes}: significant deceleration`);
      assert.ok(h.state.speed > 340, 'bounded thrust, no velocity snap or cap');
      close(step.airConsumedThisFrame, 0.55 * 0.05);
      assert.equal(step.flowLps, 33, 'exactly one full-duty retro charge');
      close(h.state.airUsedContinuous, 0.0275);
      assert.equal(step.retroUsesRearNozzles, false);
    }
  }
});

test('H/S throttle overlap retains W/semicolon priority on keyboard and released controls engage braking', () => {
  for (const map of ['highway', 'city']) {
    for (const throttle of ['KeyW', 'Semicolon']) {
      for (const brake of ['KeyH', 'KeyS']) {
        const h = moving(100, map);
        Object.assign(h.keys, { [throttle]: true, [brake]: true });
        const step = h.move(1 / 60);
        assert.equal(step.isRetroBrakeFiring, false);
        assert.ok(h.state.speed >= 100, `${map}/${throttle}/${brake}`);
        close(step.airConsumedThisFrame, throttle === 'Semicolon' ? 0.85 / 60 : 0);
        h.keys[throttle] = false;
        assert.equal(h.move(1 / 60).isRetroBrakeFiring, true);
      }
    }
  }
});

test('reverse, yawed, airborne and flipped travel loses kinetic speed without direction inversion', () => {
  for (const map of ['highway', 'city']) {
    for (const airborne of [false, true]) {
      for (const direction of [-1, 1]) {
        for (const pitch of [0, Math.PI / 2, Math.PI, -2 * Math.PI]) {
          const speed = 110 * direction;
          const h = moving(speed, map, { y: airborne ? 100 : 0, vy: airborne ? -7 : 0, pitch });
          h.keys.KeyH = true;
          const before = Math.hypot(h.state.vx, h.state.vy, h.state.vz);
          const step = h.move(1 / 60);
          assert.ok(Math.hypot(h.state.vx, h.state.vy, h.state.vz) < before);
          assert.equal(Math.sign(h.state.vz), -direction);
          const expectedRear = airborne
            ? (h.state.vy * Math.sin(pitch) - h.state.vz * Math.cos(pitch)) < 0
            : direction < 0;
          assert.equal(step.retroUsesRearNozzles, expectedRear);
          if (airborne) {
            assert.ok(h.state.vy > -7 && h.state.vy < 0, 'retro opposes vertical momentum too');
            close(h.state.speed, Math.hypot(h.state.vx, h.state.vz));
          } else assert.equal(Math.sign(h.state.speed), direction);
        }
      }
    }
    const yaw = 1.1, speed = 100;
    const h = moving(speed, map, { y: 100, yaw, vx: 40, vz: -50, vy: 3 });
    h.keys.KeyH = true; h.move(1 / 60);
    close(40 * h.state.vz - (-50) * h.state.vx, 0, 1e-9);
    assert.ok(h.state.vy > 0 && h.state.vy < 3);
    const stopped = moving(0, map, { y: 100 });
    stopped.keys.KeyH = true;
    assert.equal(stopped.move(0.05).isRetroBrakeFiring, false);
    close(stopped.state.speed, 0); close(stopped.state.airRemaining, 10);
  }
});

test('empty tanks retain mechanical/air drag braking, last tank fraction buys only proportional impulse', () => {
  for (const map of ['highway', 'city']) {
    for (const airborne of [false, true]) {
      const empty = moving(120, map, { y: airborne ? 100 : 0, airRemaining: 0, airUsedContinuous: 10, isFreefalling: true });
      empty.keys.KeyH = true;
      const step = empty.move(0.05);
      assert.equal(step.isRetroBrakeFiring, false);
      assert.ok(empty.state.speed < 120, 'ordinary braking persists with empty COPV');
      close(empty.state.airRemaining, 0);
      const partial = moving(120, map, { y: airborne ? 100 : 0, airRemaining: 0.01, airUsedContinuous: 9.99 });
      partial.keys.KeyH = true;
      const last = partial.move(0.05);
      close(last.airConsumedThisFrame, 0.01);
      close(last.retroImpulseSeconds, 0.01 / 0.55);
      close(empty.state.speed - partial.state.speed, (80000 / 1850.1) * 0.01 / 0.55, 1e-8);
      assert.equal(partial.state.isFreefalling, true);
      close(partial.state.vy, 0, 1e-12, 'depletion does not invent downward velocity');
      assert.equal(partial.move(0.05).isRetroBrakeFiring, false);
      assert.ok(partial.state.airRemaining >= 0);
    }
  }
});

test('retro and handbrake together keep foot braking in both directions and maps', () => {
  for (const map of ['highway', 'city']) {
    for (const direction of [-1, 1]) {
      const h = moving(100 * direction, map);
      Object.assign(h.keys, { KeyH: true, KeyU: true, KeyA: false });
      for (let i = 0; i < 120; i++) {
        const before = Math.abs(h.state.speed);
        h.move(1 / 60);
        assert.ok(Math.abs(h.state.speed) <= before + 1e-9);
        if (h.state.speed !== 0) assert.equal(Math.sign(h.state.speed), direction);
      }
      assert.ok(Math.abs(h.state.speed) < 38, 'ordinary foot brake persists below jet threshold');
    }
  }
});

test('ground tank cannot recharge over retro thrust, resumes normally after releasing brake', () => {
  for (const map of ['highway', 'city']) {
    const h = moving(100, map, { airRemaining: 5 });
    h.keys.KeyH = true;
    const step = h.move(0.05, true);
    assert.equal(step.isRetroBrakeFiring, true);
    close(h.state.airRemaining, 5 - 0.0275);
    h.keys.KeyH = false; h.move(0.05, true);
    close(h.state.airRemaining, 5 - 0.0275 + 3.4 * 0.05);
    h.keys.KeyH = true; h.state.speed = 40; h.state.vz = -40;
    assert.equal(h.move(0.05, true).isRetroBrakeFiring, false);
    close(h.state.airRemaining, 5 - 0.0275 + 2 * 3.4 * 0.05);
  }
});

test('mobile brake and reverse buttons share demand/consumption, release/cancel and focus loss clear input', () => {
  for (const code of ['KeyH', 'KeyS']) {
    for (const endEvent of ['pointerup', 'pointercancel', 'pointerleave']) {
      const h = moving(100);
      const button = h.touch.find(el => el.tag === 'button' && el.getAttribute('data-hold-key') === code);
      assert.ok(button, `mobile ${code}`);
      button.emit('pointerdown');
      assert.equal(h.move(1 / 60).isRetroBrakeFiring, true);
      button.emit(endEvent);
      assert.equal(h.keys[code], false);
      assert.equal(h.move(1 / 60).isRetroBrakeFiring, false);
    }
  }
  assert.match(hud, /window.addEventListener\('blur'[\s\S]*?setKeyState\(k, false\)/);
  const render = section(physics, '  // Rendering reads the already-paid brake request.', '  // Paid attitude and strafe');
  assert.doesNotMatch(render, /consumeAirTank/, 'rendering cannot charge the tank again');
  const flow = section(physics, "  const flowEl = document.getElementById('val-air-flow');", '  if (mph > 225)');
  assert.match(flow, /airConsumedThisFrame \* 60 \/ dt/);
  assert.doesNotMatch(flow, /flowLps \+=/, 'visual nozzle groups cannot double count retro flow');
});

test('30/60/144 Hz maintain consistent threshold fade and supersonic stopping, with no reversal', () => {
  for (const map of ['highway', 'city']) {
    const results = [];
    for (const hz of [30, 60, 144]) {
      const h = moving(160, map);
      h.keys.KeyH = true;
      for (let i = 0; i < hz * 2; i++) h.move(1 / hz);
      results.push({ speed: h.state.speed, air: h.state.airRemaining });
      for (let i = 0; i < hz * 3; i++) h.move(1 / hz);
      close(h.state.speed, 0);
      assert.ok(h.state.airRemaining > 8.9, 'only high-speed segment burns gas');
    }
    assert.ok(Math.max(...results.map(r => r.speed)) - Math.min(...results.map(r => r.speed)) < 0.5, `${map}: <1.8km/h fps variation`);
    assert.ok(Math.max(...results.map(r => r.air)) - Math.min(...results.map(r => r.air)) < 0.02, `${map}: <1.2L fps variation`);
  }
});


test('rooftop and helipad replenishment cannot cancel any active retro burn', () => {
  const recharge = section(physics, '          // Roofs/helipads obey', '          if (b.isHelipad && !state.hasTriggeredHelipad)');
  for (const isHelipad of [false, true]) {
    for (const isRetroBrakeFiring of [false, true]) {
      const state = { airRemaining: 5, airUsedContinuous: 5, isFreefalling: false };
      vm.runInNewContext(recharge, { state, b: { isHelipad }, isRetroBrakeFiring,
        isRearThrusterFiring: false, isLiftFiring: false, isDescendFiring: false, MAX_AIR_SECONDS: 10, dt: 0.05 });
      close(state.airRemaining, 5 + (isRetroBrakeFiring ? 0 : (isHelipad ? 10 : 4) * 0.05));
      close(state.airUsedContinuous, 10 - state.airRemaining);
    }
  }
});


test('S brakes fast reverse landings progressively before retaining normal low-speed reverse drive', () => {
  for (const map of ['highway', 'city']) {
    const h = moving(-100, map);
    h.keys.KeyS = true;
    const step = h.move(1 / 60);
    assert.equal(step.isRetroBrakeFiring, true);
    assert.ok(h.state.speed > -100 && h.state.speed < -98);
    assert.ok(h.state.vz > 98, 'backward momentum retained without speed-limit snap');
    h.state.speed = -20; h.state.vz = 20;
    assert.equal(h.move(1 / 60).isRetroBrakeFiring, false);
    close(h.state.speed, -20 + 38 / 60);
    h.state.speed = 0; h.state.vz = 0;
    h.move(1 / 60);
    close(h.state.speed, -16 / 60, 1e-10);
  }
});


test('complete movement/altitude/attitude path debits every combined jet from one shared tank', () => {
  for (const map of ['highway', 'city']) {
    const h = moving(100, map, { y: 100, airRemaining: 5, airUsedContinuous: 5 });
    Object.assign(h.keys, { KeyH: true, KeyS: true, KeyQ: true, KeyI: true, Space: true });
    const step = h.frame(1 / 60);
    assert.equal(step.isRetroBrakeFiring, true);
    assert.equal(step.isRearThrusterFiring, false);
    close(step.airConsumedThisFrame, (0.55 + 0.45 + 1 + 0.38) / 60);
    close(h.state.airRemaining, 5 - step.airConsumedThisFrame);
    close(h.state.airUsedContinuous, 10 - h.state.airRemaining);
    assert.ok(h.state.speed < 100);
  }
});

test('complete airborne control retains passive drag when empty and finite gravity at retro depletion', () => {
  for (const map of ['highway', 'city']) {
    for (const airRemaining of [0, 0.0001, 0.01, 2, 10]) {
      const h = moving(160, map, { y: 100, airRemaining, vy: 0, isFreefalling: airRemaining === 0 });
      h.keys.KeyH = true;
      const step = h.frame(1 / 60);
      assert.ok(h.state.speed < 160, 'empty tank cannot remove aerodynamic braking');
      close(h.state.vy, -9.81 / 60, 1e-9, 'retro depletion transitions directly to Earth gravity');
      assert.ok(Number.isFinite(h.state.speed) && Number.isFinite(h.state.vy));
      assert.ok(h.state.airRemaining >= 0);
      close(airRemaining - h.state.airRemaining, step.airConsumedThisFrame);
    }
  }
});

test('normal-mode boost release keeps 250/300 km/h momentum with or without W held', () => {
  for (const map of ['highway', 'city']) {
    for (const kmh of [250, 300]) {
      for (const keepW of [false, true]) {
        for (const dt of [0, 1 / 144, 1 / 60, 1 / 30, 0.05]) {
          const h = moving(kmh / 3.6, map, { physicsMode: 'realistic' });
          Object.assign(h.keys, { Semicolon: true, KeyW: keepW });
          assert.equal(h.frame(1 / 60).isRearThrusterFiring, true);
          const speedBefore = h.state.speed, airBefore = h.state.airRemaining;
          h.keys.Semicolon = false;
          const result = h.frame(dt);
          const baselineDecel = 0.35 + 0.00012 * speedBefore ** 2;
          close(h.state.speed, speedBefore - baselineDecel * 1.3 * dt, 1e-10);
          assert.ok(h.state.speed > 200 / 3.6, `${map}/${kmh}/W=${keepW}: no cap snap`);
          assert.equal(result.isRearThrusterFiring, false);
          assert.equal(result.isRetroBrakeFiring, false);
          close(result.airConsumedThisFrame, 0);
          // Ordinary ground refill may resume, but release cannot debit gas.
          assert.ok(h.state.airRemaining >= airBefore);
        }
      }
    }
  }
});

test('normal overspeed coast uses exactly 1.3 times the existing aero-plus-roll baseline', () => {
  for (const map of ['highway', 'city']) {
    for (const kmh of [100, 199, 200, 201, 250, 300, 370]) {
      const speed = kmh / 3.6, dt = 1 / 60;
      const h = moving(speed, map, { physicsMode: 'realistic' });
      const baseline = 0.35 + 0.00012 * speed ** 2;
      h.move(dt);
      close(speed - h.state.speed, baseline * (kmh > 200 ? 1.3 : 1) * dt);
      close(h.state.airRemaining, 10);
    }
  }
});

test('coasting crosses 200 continuously and W returns to its electric-drive ceiling without a jump', () => {
  const limit = 200 / 3.6;
  for (const map of ['highway', 'city']) {
    for (const dt of [1 / 144, 1 / 60, 1 / 30, 0.05]) {
      for (const keepW of [false, true]) {
        const before = limit + 0.0001;
        const h = moving(before, map, { physicsMode: 'realistic' });
        h.keys.KeyW = keepW;
        h.move(dt);
        const aboveDt = (before - limit) / ((0.35 + 0.00012 * before ** 2) * 1.3);
        const expected = keepW ? limit : limit - (0.35 + 0.00012 * limit ** 2) * (dt - aboveDt);
        close(h.state.speed, expected);
        assert.ok(h.state.speed <= before && before - h.state.speed < 0.05);
        const after = h.state.speed;
        h.move(dt);
        if (keepW) close(h.state.speed, limit);
        else close(h.state.speed, after - (0.35 + 0.00012 * after ** 2) * dt);
      }
    }
  }
});

test('boost release coasting stays consistent at 30/60/144 Hz and variable frame times', () => {
  for (const map of ['highway', 'city']) {
    for (const keepW of [false, true]) {
      const speeds = [];
      for (const frameTimes of [[1 / 30], [1 / 60], [1 / 144], [0.007, 0.019, 0.033, 0.011, 0.05]]) {
        const h = moving(250 / 3.6, map, { physicsMode: 'realistic' });
        h.keys.KeyW = keepW;
        let elapsed = 0, index = 0;
        while (elapsed < 20 - 1e-10) {
          const dt = Math.min(frameTimes[index++ % frameTimes.length], 20 - elapsed);
          const before = h.state.speed;
          h.move(dt);
          assert.ok(h.state.speed <= before + 1e-10);
          assert.ok(before - h.state.speed < 0.1, 'no discontinuity in any frame');
          // Keep this straight-road physics test away from the unrelated city wall.
          h.state.x = 0; h.state.z = 0;
          elapsed += dt;
        }
        speeds.push(h.state.speed);
        if (keepW) close(h.state.speed, 200 / 3.6, 1e-8);
        else assert.ok(h.state.speed < 200 / 3.6);
      }
      assert.ok(Math.max(...speeds) - Math.min(...speeds) < 0.01, `${map}/W=${keepW}: <0.036 km/h frame-rate variation: ${speeds}`);
    }
  }
});

test('normal overspeed retains active H/S retro braking, empty-tank brakes and throttle priority', () => {
  for (const map of ['highway', 'city']) {
    for (const key of ['KeyH', 'KeyS']) {
      for (const airRemaining of [0, 5]) {
        const h = moving(300 / 3.6, map, { physicsMode: 'realistic', airRemaining, isFreefalling: airRemaining === 0 });
        const coast = moving(300 / 3.6, map, { physicsMode: 'realistic', airRemaining, isFreefalling: airRemaining === 0 });
        h.keys[key] = true;
        const result = h.move(1 / 60);
        coast.move(1 / 60);
        assert.ok(h.state.speed < coast.state.speed);
        assert.ok(h.state.speed > 200 / 3.6, 'active braking also preserves momentum');
        assert.equal(result.isRetroBrakeFiring, airRemaining > 0);
        close(result.airConsumedThisFrame, airRemaining > 0 ? 0.55 / 60 : 0);
        const overlap = moving(300 / 3.6, map, { physicsMode: 'realistic' });
        Object.assign(overlap.keys, { KeyW: true, [key]: true });
        assert.equal(overlap.move(1 / 60).isRetroBrakeFiring, false);
        close(overlap.state.speed, coast.state.speed);
      }
    }
  }
});

test('boost release while W and handbrake are held cannot snap existing overspeed to the drift limit', () => {
  for (const map of ['highway', 'city']) {
    const h = moving(300 / 3.6, map, { physicsMode: 'realistic' });
    Object.assign(h.keys, { KeyW: true, KeyU: true, Semicolon: true });
    h.move(1 / 60);
    h.keys.Semicolon = false;
    const before = h.state.speed;
    h.move(1 / 60);
    close(h.state.speed, before - (0.35 + 0.00012 * before ** 2) * 1.3 / 60);
    assert.ok(h.state.speed > 200 / 3.6);
  }
});

test('Plaid, Fantasy and normal EV acceleration stay unchanged; sustained air release is responsive', () => {
  for (const map of ['highway', 'city']) {
    for (const mode of [{ physicsMode: 'realistic', insaneMode: true }, { physicsMode: 'fantasy' }]) {
      const h = moving(250 / 3.6, map, mode);
      const before = h.state.speed;
      h.move(1 / 60);
      close(h.state.speed, before - (0.35 + 0.00012 * before ** 2) / 60);
      h.keys.KeyW = true;
      const coast = h.state.speed;
      h.move(1 / 60);
      assert.ok(h.state.speed > coast);
    }
    const electric = moving(199.9 / 3.6, map, { physicsMode: 'realistic' });
    electric.keys.KeyW = true;
    electric.move(1 / 60);
    close(electric.state.speed, 200 / 3.6);
    const air = moving(300 / 3.6, map, { y: 100, physicsMode: 'realistic' });
    const before = air.state.speed, dt = 1 / 60;
    air.move(dt);
    assert.ok(air.state.speed < before - 2 && air.state.speed > before - 3, 'established flight restores its stronger release curve');
  }
});
