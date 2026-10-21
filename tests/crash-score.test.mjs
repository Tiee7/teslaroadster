import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const scoreRules = readFileSync(new URL('../src/driving-score.js', import.meta.url), 'utf8');

const read = name => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
const physics = read('physics-main.js'), html = read('index.html'), css = read('styles.css');
const taxiSource = read('taxi.js'), rankedSource = read('leaderboard.js'), config = read('config.js'), hud = read('ui-hud.js');
const section = (text, from, to) => {
  const start = text.indexOf(from), end = text.indexOf(to, start + from.length);
  assert.ok(start >= 0 && end > start, `Missing production section: ${from}`);
  return text.slice(start, end);
};
const collisionSource = section(physics, 'function triggerPhysicsCollision(', '// =========================================================================\n// 9.');
const blastSource = section(physics, 'function applyExplosionBlastToTraffic(', 'function spawnDestructionDebris(');
const cockpitSource = section(hud, 'function updateCockpitHudScreen(', '// =========================================================================\n// FULL-SCREEN');
const resetSource = section(hud, 'function resetCar(', 'function applyTranslations(');
const flush = () => new Promise(resolve => setImmediate(resolve));

class Element {
  constructor() {
    this.children = []; this.attributes = {}; this.textContent = ''; this.style = {}; this.dataset = {};
    this.hidden = false; this.open = false; this.parent = null; this.listeners = {}; this.value = ''; this.isConnected = true;
    const classes = new Set(['hidden']);
    this.classList = { contains: key => classes.has(key), add: key => classes.add(key), remove: key => classes.delete(key),
      toggle(key, active = !classes.has(key)) { if (active) classes.add(key); else classes.delete(key); } };
  }
  appendChild(child) { child.remove(); child.parent = this; this.children.push(child); return child; }
  insertBefore(child, reference) { child.remove(); child.parent = this; this.children.splice(this.children.indexOf(reference), 0, child); }
  remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; }
  replaceChildren(...children) { this.children = children; }
  setAttribute(key, value) { this.attributes[key] = value; }
  closest() { return null; }
  addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
  async emit(type, event = {}) { for (const fn of this.listeners[type] || []) await fn({ target: this, preventDefault() {}, ...event }); }
  querySelectorAll(selector) { return selector === 'option' ? this.children : []; }
  focus() { this.ownerDocument.activeElement = this; }
  showModal() { this.open = true; }
  close() { this.open = false; void this.emit('close'); }
}
class Object3D {
  constructor() { this.children = []; this.visible = true; this.rotation = {}; this.position = { x: 0, y: 0, z: 0, set(x, y, z) { Object.assign(this, { x, y, z }); } }; }
  add(...children) { this.children.push(...children); }
  remove(child) { this.children = this.children.filter(value => value !== child); }
}
class Geometry { dispose() {} }
class Material { constructor(options) { Object.assign(this, options); } dispose() {} }
class Mesh extends Object3D { constructor(geometry, material) { super(); this.geometry = geometry; this.material = material; } }

// Execute production collision, taxi model/adapter, cockpit drawing and ranked lifecycle.
// Only scene geometry, sound and the remote transport are replaced with test doubles.
function harness(map = 'highway', ranked = false) {
  const elements = Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => [id, new Element()]));
  const document = new Element();
  Object.assign(document, { body: new Element(), hidden: false, getElementById: id => elements[id] || null, createElement: () => new Element() });
  document.activeElement = elements['btn-leaderboard'];
  for (const element of Object.values(elements)) element.ownerDocument = document;
  elements['hud-top-container'].appendChild(elements['hud-main']);
  const categories = ['highway-realistic', 'highway-fantasy', 'city-realistic', 'city-fantasy'];
  elements['ranked-category'].children = categories.map(value => Object.assign(new Element(), { value }));
  elements['ranked-category'].value = `${map}-realistic`;
  const window = new Element(), calls = [], effects = [], crashSounds = [], draws = [];
  const history = [{ rank: 1, nickname: 'Earlier driver', score: 8750 }];
  window.confirm = () => true;
  window.RoadsterMusic = { isSettingsOpen: () => false };
  let now = 1000, state, runNumber = 0, seed = 1, endGate = null;
  const deterministicMath = Object.assign(Object.create(Math), { random: () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) });
  const canvas = { clearRect() { draws.length = 0; }, fillRect() {}, strokeRect() {}, save() {}, restore() {},
    fillText(text) { draws.push(String(text)); }, createLinearGradient() { return { addColorStop() {} }; } };
  const context = vm.createContext({
    window, document, Element, Math: deterministicMath, performance: { now: () => now }, TextEncoder, URL, AbortController,
    localStorage: { getItem: () => null, setItem() {} }, setTimeout: () => 1, clearTimeout() {}, setInterval() {},
    lastTime: 0, keys: {}, cityBuildings: [], cityEnvGroup: new Object3D(), carMeshGroup: { visible: true }, hoverRingMat: { opacity: 1 },
    cockpitHudCtx: canvas, cockpitHudTexture: { needsUpdate: false },
    THREE: { DoubleSide: 2, Group: Object3D, Mesh, CylinderGeometry: Geometry, RingGeometry: Geometry, MeshBasicMaterial: Material },
    trafficCars: [], spawnDestructionDebris: (...args) => effects.push(['debris', ...args]),
    spawnExplosionEffect: (...args) => effects.push(['explosion', ...args]),
    sound: { beep() {}, playCrash: fatal => crashSounds.push(fatal), playSonicBoom() {}, speakAlert() {} },
    showBanner() {}, clearAllInputKeys() {}, populateTraffic() {}, clearDebris() {}, renderBannerText() {},
    resetCar() { window.RoadsterRanked?.abort('reset'); state.isDestroyed = false; state.speed = 42; },
    selectWeatherMode(index) { vm.runInContext(`weatherIndex = ${index}`, context); },
    toggleStabilizer() { state.autoStabilizer = !state.autoStabilizer; },
    applyTranslations() { window.RoadsterRanked?.render(); }, toggleLanguage() {},
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (url === '/api/end' && endGate) await endGate;
      let data;
      if (url === '/api/run') data = { runId: `run-${++runNumber}`, durationMs: 60000, scoreVersion: 'distance-v2' };
      else if (url === '/api/end') data = { ended: true, runId: JSON.parse(options.body).runId };
      else if (url === '/api/score') {
        const payload = JSON.parse(options.body);
        history.push({ rank: history.length + 1, nickname: payload.nickname, score: payload.score });
        data = { accepted: true, improved: true, bestScore: payload.score, rank: history.length };
      } else data = { category: new URL(url, 'https://test.example').searchParams.get('category'), entries: history };
      return { ok: true, status: 200, json: async () => data };
    },
  });
  const run = code => vm.runInContext(code, context);
  run(scoreRules + '\n' + config); state = run('state'); run(`currentMap = '${map}'`);
  Object.assign(state, { score: 500, distanceMeters: 5000, distanceBySpeed: [5000, 0, 0, 0, 0, 0], carsCleared: 24, blastedCarsCount: 7 });
  run(`${taxiSource}\n${cockpitSource}\n${blastSource}\n${collisionSource}\n${resetSource}`);
  if (ranked) run(rankedSource);
  run(section(hud, "window.addEventListener('keydown'", "window.addEventListener('keyup'"));
  run("document.getElementById('btn-crash-respawn').addEventListener('click', resetCar); document.getElementById('btn-reset').addEventListener('click', resetCar);");
  const move = point => { Object.assign(state, point); window.RoadsterTaxi.tick(); };
  const startTaxi = (occupied = true) => {
    window.RoadsterTaxi.ensureDefault();
    for (let i = 0; i < 8; i++) {
      const trip = window.RoadsterTaxi.snapshot().waiting[0]; move(trip.pickup); move(trip.destination);
    }
    if (occupied) move(window.RoadsterTaxi.snapshot().waiting[0].pickup);
    assert.ok(window.RoadsterTaxi.snapshot().score > 0);
    assert.equal(Boolean(window.RoadsterTaxi.snapshot().passenger), occupied);
  };
  const seedTraffic = () => {
    const car = { mesh: new Object3D() }; car.mesh.position.set(state.x + 3, state.y, map === 'highway' ? 0 : state.z);
    context.trafficCars.push(car); return car;
  };
  return { context, window, document, elements, state, calls, effects, crashSounds, draws, history, run, move, startTaxi, seedTraffic,
    pressR: () => window.emit('keydown', { target: document.body, code: 'KeyR' }),
    deferEnd() { let release; endGate = new Promise(resolve => { release = resolve; }); return () => { endGate = null; release(); }; },
    click: id => elements[id].emit('click'), phase: () => elements['ranked-hud'].dataset.phase,
    async startRanked() { elements['ranked-nickname'].value = 'Current driver'; await elements['ranked-start'].emit('click'); },
    advance(ms) { now += ms; window.RoadsterRanked.tick(now); } };
}

const driving = state => ({ score: state.score, distanceMeters: state.distanceMeters, distanceBySpeed: Array.from(state.distanceBySpeed), carsCleared: state.carsCleared, blastedCarsCount: state.blastedCarsCount });
const zeroDriving = { score: 0, distanceMeters: 0, distanceBySpeed: [0, 0, 0, 0, 0, 0], carsCleared: 0, blastedCarsCount: 0 };

for (const map of ['highway', 'city']) {
  for (const [reason, deltaV, hull] of [['crashReasonThreshold', 30, 100], ['crashReasonGround', 38, 100], ['crashReasonCumulative', 12, 1]]) {
    test(`${map}: ${reason} freezes final scores through wreck frames and clears only on respawn`, async () => {
      const h = harness(map); if (map === 'city') h.startTaxi();
      const before = driving(h.state), passenger = h.window.RoadsterTaxi.snapshot();
      const finalFare = passenger.active ? Math.max(0, passenger.score - passenger.passenger.fare * 2) : 0;
      const car = h.seedTraffic(); h.state.hullIntegrity = hull;
      h.run(`triggerPhysicsCollision(${deltaV}, '${reason}', 0, 0, 0)`);
      assert.equal(h.state.isDestroyed, true); assert.equal(h.state.destroyReasonKey, reason);
      assert.deepEqual(driving(h.state), before);
      assert.ok(Object.isFrozen(h.state.finalDrivingResult)); assert.ok(Object.isFrozen(h.state.finalDrivingResult.distanceBySpeed));
      assert.equal(h.elements['val-score'].textContent, String(before.score)); assert.equal(h.elements['val-passed'].textContent, String(before.carsCleared));
      assert.equal(h.elements['crash-val-score'].textContent, String(before.score)); assert.equal(h.elements['crash-val-passenger-score'].textContent, String(finalFare));
      assert.equal(h.elements['crash-passenger-score'].hidden, map !== 'city'); assert.equal(h.elements['modal-destroyed'].classList.contains('hidden'), false);
      assert.equal(car.blastTimer, 3.2); assert.ok(car.blastVy > 0); assert.deepEqual(h.crashSounds, [true]);
      if (map === 'city') {
        assert.equal(h.window.RoadsterTaxi.snapshot().score, finalFare); assert.equal(h.window.RoadsterTaxi.snapshot().passenger, null);
        assert.equal(h.window.RoadsterTaxi.snapshot().delivered, passenger.delivered);
        assert.ok(h.draws.some(text => text.startsWith(`${finalFare} PTS`))); assert.ok(h.draws.some(text => /FINAL SCORE KEPT/.test(text)));
      }
      const effects = h.effects.length;
      for (let i = 0; i < 20; i++) {
        h.run(`destroyVehicle('${reason}'); RoadsterDrivingScore.segment(state, 1, { speed: 100, horizontal: 100, forward: 100 }, { speed: 100, horizontal: 100, forward: 100 }); updateDestroyedScores();`);
        h.window.RoadsterTaxi.tick();
      }
      assert.equal(h.effects.length, effects); assert.deepEqual(h.crashSounds, [true]); assert.deepEqual(driving(h.state), before);
      assert.equal(h.window.RoadsterTaxi.snapshot().score, finalFare);
      h.run("currentLang = 'zh'; updateDestroyedModalText()"); assert.equal(h.elements['crash-lbl-score'].textContent, '里程得分');
      assert.equal(h.elements['crash-val-score'].textContent, String(before.score));
      await h.click('btn-crash-respawn');
      assert.equal(h.state.isDestroyed, false); assert.equal(h.state.hullIntegrity, 100); assert.deepEqual(driving(h.state), zeroDriving); assert.equal(h.state.finalDrivingResult, null);
      assert.equal(h.elements['val-score'].textContent, '0'); assert.equal(h.elements['val-passed'].textContent, '0');
      assert.equal(h.window.RoadsterTaxi.snapshot().score, 0); assert.equal(h.window.RoadsterTaxi.snapshot().delivered, 0);
      assert.equal(h.elements['modal-destroyed'].classList.contains('hidden'), true);
    });
  }
  test(`${map}: surviving collisions preserve scores and do not create a final snapshot`, () => {
    const h = harness(map); if (map === 'city') h.startTaxi(); const before = driving(h.state), fare = h.window.RoadsterTaxi.snapshot().score;
    h.run("triggerPhysicsCollision(5, 'crashReasonThreshold', 1, 1, 0)");
    assert.equal(h.state.isDestroyed, false); assert.ok(h.state.hullIntegrity < 100); assert.deepEqual(driving(h.state), before);
    assert.equal(h.state.finalDrivingResult, null); assert.equal(h.window.RoadsterTaxi.snapshot().score, fare); assert.equal(h.effects.length, 0);
  });
  for (const reset of ['keyboard', 'button', 'caller']) test(`${map}: ${reset} reset starts mileage and passenger totals from zero`, async () => {
    const h = harness(map); if (map === 'city') h.startTaxi();
    h.run("destroyVehicle('crashReasonThreshold')"); assert.equal(h.state.score, 500);
    if (reset === 'keyboard') await h.pressR(); else if (reset === 'button') await h.click('btn-reset'); else h.run('resetCar()');
    assert.deepEqual(driving(h.state), zeroDriving); assert.equal(h.state.isDestroyed, false); assert.equal(h.state.finalDrivingResult, null);
    assert.equal(h.window.RoadsterTaxi.snapshot().score, 0); assert.equal(h.window.RoadsterTaxi.snapshot().delivered, 0);
    h.run('RoadsterDrivingScore.segment(state, 1, { speed: 20, horizontal: 20, forward: 20 }, { speed: 20, horizontal: 20, forward: 20 })');
    assert.equal(h.state.score, 2); assert.equal(h.state.distanceMeters, 20);
    await h.pressR(); assert.deepEqual(driving(h.state), zeroDriving);
  });
}

test('an empty taxi retains settled fares through death and clears them on the next round', () => {
  const h = harness('city'); h.startTaxi(false); const before = h.window.RoadsterTaxi.snapshot();
  h.run("destroyVehicle('crashReasonThreshold')"); assert.equal(h.window.RoadsterTaxi.snapshot().score, before.score);
  assert.equal(h.elements['crash-val-passenger-score'].textContent, String(before.score));
  h.run('resetCar()'); assert.equal(h.window.RoadsterTaxi.snapshot().score, 0); assert.equal(h.window.RoadsterTaxi.snapshot().delivered, 0);
  assert.ok(h.draws.some(text => /^0 PTS/.test(text))); assert.ok(h.draws.every(text => !/PASSENGER LOST/.test(text)));
});

test('late callbacks cannot change frozen mileage, final score or clear/blast counts', () => {
  const h = harness(); h.seedTraffic(); const before = driving(h.state); h.run("destroyVehicle('crashReasonThreshold')");
  assert.equal([...physics.matchAll(/state\.score \+=/g)].length, 0);
  const trafficReward = physics.match(/if \(!state\.isDestroyed\) \{\s*state\.carsCleared \+= 1;\s*\}/)?.[0]; assert.ok(trafficReward);
  h.run(`${trafficReward}\napplyExplosionBlastToTraffic(state.x, state.y, 0, 55, 46)`); assert.deepEqual(driving(h.state), before);
  Object.assign(h.state, { score: 999999, distanceMeters: 999999, distanceBySpeed: [999999, 0, 0, 0, 0, 0], carsCleared: 900, blastedCarsCount: 900 });
  h.run('updateDestroyedScores()'); assert.deepEqual(driving(h.state), before);
  assert.equal(h.elements['val-score'].textContent, String(before.score)); assert.equal(h.elements['crash-val-score'].textContent, String(before.score));
});

for (const map of ['highway', 'city']) {
  test(`${map}: crash releases ranked session immediately while final score remains until restart`, async () => {
    const h = harness(map, true); await h.startRanked(); const release = h.deferEnd();
    Object.assign(h.state, { score: 789, distanceMeters: 7890, distanceBySpeed: [7890, 0, 0, 0, 0, 0], carsCleared: 11 });
    h.run("triggerPhysicsCollision(40, 'crashReasonThreshold', 0, 0, 0)");
    assert.equal(h.phase(), 'aborted'); assert.equal(h.state.score, 789); assert.equal(h.elements['crash-val-score'].textContent, '789');
    assert.match(h.elements['ranked-crash-status'].textContent, /Vehicle crashed/); assert.equal(h.elements['ranked-submit'].hidden, true);
    for (let i = 0; i < 4; i++) { h.run("destroyVehicle('crashReasonThreshold')"); await h.click('ranked-submit'); }
    const ends = h.calls.filter(call => call.url === '/api/end'); assert.equal(ends.length, 1); assert.equal(ends[0].options.keepalive, true);
    assert.deepEqual(JSON.parse(ends[0].options.body), { runId: 'run-1' }); assert.equal(h.calls.filter(call => call.url === '/api/score').length, 0);
    const restarting = h.startRanked(); await flush(); assert.equal(h.calls.filter(call => call.url === '/api/run').length, 1); assert.equal(h.state.score, 789);
    release(); await restarting; assert.equal(h.phase(), 'running'); assert.deepEqual(driving(h.state), zeroDriving); assert.equal(h.state.isDestroyed, false);
    assert.equal(h.calls.filter(call => call.url === '/api/run').length, 2, 'restart follows acknowledged end without a 65-second wait');
    h.state.score = 300; h.state.distanceBySpeed = [3000, 0, 0, 0, 0, 0]; h.advance(60000); await h.click('ranked-submit'); await flush();
    assert.equal(h.phase(), 'submitted'); assert.equal(h.history.at(-1).score, 300);
    const saved = structuredClone(h.history); h.state.score = 1000; h.run("destroyVehicle('crashReasonGround')");
    assert.equal(h.state.score, 1000); assert.deepEqual(h.history, saved); assert.equal(h.calls.filter(call => call.url === '/api/score').length, 1);
  });
  test(`${map}: completed ranked payload survives later death and R before explicit submission`, async () => {
    const h = harness(map, true); await h.startRanked();
    Object.assign(h.state, { score: 301, distanceMeters: 3001, distanceBySpeed: [3001, 0, 0, 0, 0, 0] }); h.advance(60000);
    assert.equal(h.phase(), 'complete');
    h.state.score = 999; h.state.distanceBySpeed = [9990, 0, 0, 0, 0, 0]; h.run("destroyVehicle('crashReasonThreshold'); resetCar()");
    assert.deepEqual(driving(h.state), zeroDriving); assert.equal(h.phase(), 'complete');
    await h.click('ranked-submit'); const payload = JSON.parse(h.calls.find(call => call.url === '/api/score').options.body);
    assert.equal(payload.score, 301); assert.deepEqual(payload.distanceBySpeed, [3001, 0, 0, 0, 0, 0]); assert.equal(payload.runId, 'run-1');
    assert.equal(h.phase(), 'submitted');
  });
}

test('crash summary preserves ranked notice, language switching and small-screen scrolling', () => {
  const h = harness(); h.run("destroyVehicle('crashReasonThreshold')");
  h.elements['ranked-crash-status'].textContent = 'Challenge cancelled'; h.run('updateDestroyedScores()');
  assert.equal(h.elements['ranked-crash-status'].textContent, 'Challenge cancelled');
  assert.match(html, /id="ranked-crash-status"/); assert.match(html, /class="crash-dialog-content/);
  assert.match(css, /\.crash-dialog-content \{[^}]*max-height: calc\(100dvh - 32px\);[^}]*overflow-y: auto;/);
  assert.match(html, /id="crash-passenger-score"[^>]* hidden/);
  assert.match(physics, /if \(window\.RoadsterDemo\?\.isActive\(\)\) \{\s*coastFrameClock\.clear\(\);coastSoundFrame=null;\s*window\.RoadsterDemo\.advanceFrame\(frameSeconds, updateSimulation\);\s*\} else if \(currentMap === 'city'\)/);
  assert.match(physics, /else window\.RoadsterTaxi\?\.tick\(\);\s*if \(state\.isDestroyed\) updateDestroyedScores\(\);/);
});
