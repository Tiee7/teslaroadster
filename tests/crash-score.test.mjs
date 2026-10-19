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
  async emit(type) { for (const fn of this.listeners[type] || []) await fn({ target: this, preventDefault() {} }); }
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
  let now = 1000, state, runNumber = 0, seed = 1;
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
  Object.assign(state, { score: 12678.4, distanceMeters: 5000, distanceBySpeed: [5000, 0, 0, 0, 0, 0], carsCleared: 24, blastedCarsCount: 7 });
  run(`${taxiSource}\n${cockpitSource}\n${blastSource}\n${collisionSource}\n${resetSource}`);
  if (ranked) run(rankedSource);
  const move = point => { Object.assign(state, point); window.RoadsterTaxi.tick(); };
  const startTaxi = (occupied = true) => {
    window.RoadsterTaxi.handleKeydown({ code: 'Equal', key: '=', target: new Element(), preventDefault() {} });
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
    click: id => elements[id].emit('click'), phase: () => elements['ranked-hud'].dataset.phase,
    async startRanked() { elements['ranked-nickname'].value = 'Current driver'; await elements['ranked-start'].emit('click'); },
    advance(ms) { now += ms; window.RoadsterRanked.tick(now); } };
}

for (const map of ['highway', 'city']) {
  for (const [reason, deltaV, hull] of [['crashReasonThreshold', 30, 100], ['crashReasonGround', 38, 100], ['crashReasonCumulative', 12, 1]]) {
    test(`${map}: ${reason} immediately clears every current score and refreshes all score displays`, () => {
      const h = harness(map);
      if (map === 'city') h.startTaxi();
      const car = h.seedTraffic();
      h.state.hullIntegrity = hull;
      h.run(`triggerPhysicsCollision(${deltaV}, '${reason}', 0, 0, 0)`);
      assert.equal(h.state.isDestroyed, true); assert.equal(h.state.destroyReasonKey, reason);
      assert.equal(h.state.score, 0); assert.equal(h.state.distanceMeters, 0); assert.deepEqual(Array.from(h.state.distanceBySpeed), [0, 0, 0, 0, 0, 0]); assert.equal(h.state.carsCleared, 0); assert.equal(h.state.blastedCarsCount, 0);
      assert.equal(h.elements['val-score'].textContent, '0'); assert.equal(h.elements['val-passed'].textContent, '0');
      assert.equal(h.elements['crash-val-score'].textContent, '0'); assert.equal(h.elements['crash-val-passenger-score'].textContent, '0');
      assert.equal(h.elements['crash-passenger-score'].hidden, map !== 'city');
      assert.equal(h.elements['modal-destroyed'].classList.contains('hidden'), false);
      assert.equal(car.blastTimer, 3.2); assert.ok(car.blastVy > 0, 'crash still blasts traffic physically');
      assert.ok(h.effects.some(([kind]) => kind === 'debris')); assert.ok(h.effects.filter(([kind]) => kind === 'explosion').length >= 2);
      assert.deepEqual(h.crashSounds, [true]);
      if (map === 'city') {
        assert.equal(h.window.RoadsterTaxi.snapshot().score, 0); assert.equal(h.window.RoadsterTaxi.snapshot().passenger, null);
        assert.equal(h.elements['hud-footer'].children.at(-1).children[0].textContent, '0');
        assert.ok(h.draws.some(text => /^0 PTS/.test(text))); assert.ok(h.draws.some(text => /PASSENGER LOST.*SCORE RESET/.test(text)));
      }
      const effectCount = h.effects.length;
      for (let i = 0; i < 5; i++) { h.run(`destroyVehicle('${reason}')`); h.window.RoadsterTaxi.tick(); h.run('updateDestroyedScores()'); }
      assert.equal(h.effects.length, effectCount); assert.deepEqual(h.crashSounds, [true]); assert.equal(h.state.score, 0);
      h.run("currentLang = 'zh'; updateDestroyedModalText()");
      assert.equal(h.elements['crash-lbl-score'].textContent, '里程得分');
      assert.equal(h.elements['crash-val-score'].textContent, '0');
      if (map === 'city') assert.ok(h.draws.some(text => /接客积分 0/.test(text)));
      h.run('resetCar()');
      assert.equal(h.state.isDestroyed, false); assert.equal(h.state.hullIntegrity, 100);
      assert.equal(h.state.score, 0); assert.equal(h.state.distanceMeters, 0); assert.deepEqual(Array.from(h.state.distanceBySpeed), [0, 0, 0, 0, 0, 0]); assert.equal(h.state.carsCleared, 0); assert.equal(h.state.blastedCarsCount, 0);
      assert.equal(h.window.RoadsterTaxi.snapshot().score, 0);
      assert.equal(h.elements['modal-destroyed'].classList.contains('hidden'), true);
    });
  }

  test(`${map}: surviving collisions preserve driving and passenger scores`, () => {
    const h = harness(map); if (map === 'city') h.startTaxi();
    const before = { score: h.state.score, carsCleared: h.state.carsCleared, blastedCarsCount: h.state.blastedCarsCount,
      passenger: h.window.RoadsterTaxi.snapshot().score };
    h.run("triggerPhysicsCollision(5, 'crashReasonThreshold', 1, 1, 0)");
    assert.equal(h.state.isDestroyed, false); assert.ok(h.state.hullIntegrity < 100);
    for (const key of ['score', 'carsCleared', 'blastedCarsCount']) assert.equal(h.state[key], before[key]);
    assert.equal(h.window.RoadsterTaxi.snapshot().score, before.passenger); assert.equal(h.effects.length, 0);
  });
}

test('an empty taxi forfeits prior fares, while manual reset retains its double-fare rule', () => {
  const h = harness('city'); h.startTaxi(false); assert.ok(h.window.RoadsterTaxi.snapshot().score > 0);
  h.run("destroyVehicle('crashReasonThreshold')");
  assert.equal(h.window.RoadsterTaxi.snapshot().score, 0);
  assert.equal(h.elements['hud-footer'].children.at(-1).children[0].textContent, '0');
  assert.ok(h.draws.some(text => /^0 PTS/.test(text)));
  h.run('resetCar()');
  for (let i = 0; i < 8; i++) { const trip = h.window.RoadsterTaxi.snapshot().waiting[0]; h.move(trip.pickup); h.move(trip.destination); }
  const trip = h.window.RoadsterTaxi.snapshot().waiting[0]; h.move(trip.pickup);
  const before = h.window.RoadsterTaxi.snapshot().score;
  h.window.RoadsterTaxi.onReset(); assert.equal(h.window.RoadsterTaxi.snapshot().score, Math.max(0, before - trip.fare * 2));
  assert.ok(h.window.RoadsterTaxi.snapshot().score > 0);
});

test('same-frame stunt, roof, traffic and sonic callbacks cannot repopulate destroyed scores', () => {
  const h = harness(); h.seedTraffic(); h.run("destroyVehicle('crashReasonThreshold')");
  assert.equal([...physics.matchAll(/state\.score \+=/g)].length, 0, 'distance replaces all fixed driving rewards');
  const trafficReward = physics.match(/if \(!state\.isDestroyed\) \{\s*state\.carsCleared \+= 1;\s*\}/)?.[0];
  assert.ok(trafficReward);
  h.run(`${trafficReward}\napplyExplosionBlastToTraffic(state.x, state.y, 0, 55, 46)`);
  assert.equal(h.state.score, 0); assert.equal(h.state.distanceMeters, 0); assert.deepEqual(Array.from(h.state.distanceBySpeed), [0, 0, 0, 0, 0, 0]); assert.equal(h.state.carsCleared, 0); assert.equal(h.state.blastedCarsCount, 0);
  Object.assign(h.state, { score: 900, carsCleared: 4, blastedCarsCount: 3 });
  h.run('updateDestroyedScores()');
  assert.equal(h.state.score, 0); assert.equal(h.state.distanceMeters, 0); assert.deepEqual(Array.from(h.state.distanceBySpeed), [0, 0, 0, 0, 0, 0]); assert.equal(h.state.carsCleared, 0); assert.equal(h.state.blastedCarsCount, 0);
  assert.equal(h.elements['val-score'].textContent, '0'); assert.equal(h.elements['crash-val-score'].textContent, '0');
  // Those same production awards still work for surviving cars.
  h.state.isDestroyed = false;
  h.run(trafficReward);
  assert.equal(h.state.score, 0); assert.equal(h.state.carsCleared, 1);
});

for (const map of ['highway', 'city']) {
  test(`${map}: crash cancels the server run once, never submits its residual score, and leaves leaderboard history intact`, async () => {
    const h = harness(map, true); await h.startRanked(); assert.equal(h.phase(), 'running');
    Object.assign(h.state, { score: 7890, carsCleared: 11 }); h.seedTraffic();
    h.run("triggerPhysicsCollision(40, 'crashReasonThreshold', 0, 0, 0)");
    assert.equal(h.phase(), 'aborted'); assert.match(h.elements['ranked-crash-status'].textContent, /Vehicle crashed/);
    assert.equal(h.elements['ranked-submit'].hidden, true); assert.equal(h.state.score, 0);
    for (let i = 0; i < 4; i++) { h.run("destroyVehicle('crashReasonThreshold')"); h.advance(60000); await h.click('ranked-submit'); }
    await flush();
    const ends = h.calls.filter(call => call.url === '/api/end'); assert.equal(ends.length, 1);
    assert.deepEqual(JSON.parse(ends[0].options.body), { runId: 'run-1' }); assert.equal(ends[0].options.keepalive, true);
    assert.equal(h.calls.filter(call => call.url === '/api/score').length, 0);
    assert.deepEqual(h.history, [{ rank: 1, nickname: 'Earlier driver', score: 8750 }]);
    await h.startRanked(); assert.equal(h.phase(), 'running'); assert.equal(h.state.isDestroyed, false);
    h.state.score = 300; h.state.distanceBySpeed = [3000, 0, 0, 0, 0, 0]; h.state.carsCleared = 2; h.advance(60000); await h.click('ranked-submit'); await flush();
    assert.equal(h.phase(), 'submitted'); assert.equal(h.history.at(-1).score, 300);
    const saved = structuredClone(h.history);
    h.state.score = 1000; h.run("destroyVehicle('crashReasonGround')"); await flush();
    assert.equal(h.state.score, 0); assert.deepEqual(h.history, saved, 'previously submitted records are never deleted');
    assert.equal(h.calls.filter(call => call.url === '/api/score').length, 1);
  });
}

test('crash summary preserves live labels, ranked notice and small-screen scrolling', () => {
  const h = harness(); h.run("destroyVehicle('crashReasonThreshold')");
  h.elements['ranked-crash-status'].textContent = 'Challenge cancelled'; h.run('updateDestroyedScores()');
  assert.equal(h.elements['ranked-crash-status'].textContent, 'Challenge cancelled');
  assert.match(html, /id="ranked-crash-status"/); assert.match(html, /class="crash-dialog-content/);
  assert.match(css, /\.crash-dialog-content \{[^}]*max-height: calc\(100dvh - 32px\);[^}]*overflow-y: auto;/);
  assert.match(html, /id="crash-passenger-score"[^>]* hidden/);
  assert.match(css, /#crash-passenger-score\[hidden\] \{ display: none; \}/);
  assert.match(physics, /updateSimulation\(dt\);\s*window\.RoadsterTaxi\?\.tick\(\);\s*if \(state\.isDestroyed\) updateDestroyedScores\(\);/);
});
