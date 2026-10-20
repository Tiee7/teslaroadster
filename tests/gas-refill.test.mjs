import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const scoreRules = readFileSync(new URL('../src/driving-score.js', import.meta.url), 'utf8');

const read = name => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
const hud = read('ui-hud.js'), config = read('config.js'), html = read('index.html');
const ranked = read('leaderboard.js'), physics = read('physics-main.js');
const section = (text, from, to) => {
  const start = text.indexOf(from), end = text.indexOf(to, start + from.length);
  assert.ok(start >= 0 && end > start, `Missing production section: ${from}`);
  return text.slice(start, end);
};
const keyboard = section(hud, 'const keys = {};', "document.querySelectorAll('[data-hold-key]')");
const banner = section(hud, 'function renderBannerText()', 'function switchMap(');
const cockpit = section(hud, 'function updateCockpitHudScreen(', '// FULL-SCREEN DYNAMIC SPEED LINES');
const gauge = section(physics, '  const tank = getAirTankReadout(', '  const hullInt = Math.round(state.hullIntegrity);');
const flush = () => new Promise(resolve => setImmediate(resolve));
const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

class Element {
  constructor(id = '', tagName = 'DIV') {
    Object.assign(this, { id, tagName, listeners: {}, children: [], dataset: {}, attributes: {}, style: {},
      value: '', textContent: '', open: false, hidden: false, isConnected: true, contentEditable: false, parentElement: null });
    const classes = new Set(['hidden']);
    this.classList = { contains: name => classes.has(name), add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      toggle(name, active = !classes.has(name)) { if (active) classes.add(name); else classes.delete(name); return active; } };
  }
  addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
  emit(type, event = {}) { return Promise.all((this.listeners[type] || []).map(fn => fn({ target: this, preventDefault() {}, ...event }))); }
  closest() {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(this.tagName) || this.contentEditable) return this;
    return this.parentElement?.closest() || null;
  }
  querySelectorAll(selector) { return selector === 'option' ? this.children : []; }
  appendChild(child) { this.children.push(child); return child; }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this.attributes[name] = value; }
  focus() { this.ownerDocument.activeElement = this; }
  showModal() { this.open = true; }
  close() { this.open = false; void this.emit('close'); }
}

// Execute the real keyboard, canonical tank readout, both gauge renderers and
// ranked lifecycle. Only DOM/canvas, sound and server transport are replaced.
function harness(map = 'highway') {
  const elements = Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => [id, new Element(id)]));
  const document = new Element('document');
  Object.assign(document, { body: new Element('body'), activeElement: null, hidden: false,
    getElementById: id => elements[id] || null, createElement: tag => new Element('', tag.toUpperCase()) });
  for (const element of Object.values(elements)) element.ownerDocument = document;
  document.body.ownerDocument = document;
  document.activeElement = document.body;
  elements['ranked-category'].value = `${map}-realistic`;
  elements['ranked-category'].children = ['highway-realistic', 'highway-fantasy', 'city-realistic', 'city-fantasy'].map(value => Object.assign(new Element(), { value }));
  const window = new Element('window'), calls = [], audio = [], draws = [], rects = [], effects = [];
  let now = 1000, state, context, issued = 0;
  let network = async (url, options) => {
    if (url === '/api/run') return response({ runId: `run-${++issued}`, durationMs: 60000, scoreVersion: 'distance-v2' });
    if (url === '/api/end') return response({ ended: true, runId: JSON.parse(options.body).runId });
    if (url === '/api/score') return response({ accepted: true, improved: true, bestScore: JSON.parse(options.body).score, rank: 1 });
    return response({ category: `${map}-realistic`, entries: [] });
  };
  window.RoadsterMusic = { isSettingsOpen: () => false };
  window.RoadsterStart = { isPaintOpen: () => false };
  const canvas = new Proxy({ fillText: text => draws.push(text), fillRect: (x, y, width, height) => rects.push({ x, y, width, height }),
    createLinearGradient: () => ({ addColorStop() {} }) }, { get: (target, key) => key in target ? target[key] : () => {} });
  context = vm.createContext({
    window, document, Element, performance: { now: () => now }, TextEncoder, URL, AbortController,
    localStorage: { getItem: () => null, setItem() {} }, setTimeout: () => 1, clearTimeout() {}, setInterval() {}, lastTime: 0,
    sound: new Proxy({}, { get: (_target, name) => (...args) => audio.push([name, ...args]) }),
    clearAllInputKeys: () => vm.runInContext('Object.keys(keys).forEach(code => { keys[code] = false; });', context),
    resetCar() { window.RoadsterRanked?.abort('reset'); Object.assign(state, { isDestroyed: false, airRemaining: 10, airUsedContinuous: 0 }); },
    selectWeatherMode(index) { vm.runInContext(`weatherIndex = ${index}`, context); },
    toggleStabilizer() { state.autoStabilizer = !state.autoStabilizer; },
    populateTraffic() {}, applyTranslations() { window.RoadsterRanked?.render(); }, toggleLanguage() {},
    cockpitHudCtx: canvas, cockpitHudTexture: {},
    THREE: { MathUtils: { radToDeg: value => value * 180 / Math.PI, clamp: (v, min, max) => Math.min(max, Math.max(min, v)) } },
    showBanner: (...args) => effects.push(['banner', ...args]),
    fetch: async (url, options) => { calls.push({ url, options, airAtCall: state.airRemaining }); return network(url, options); },
  });
  const run = text => vm.runInContext(text, context);
  run(scoreRules + '\n' + config); state = run('state'); run(`currentMap = '${map}'`);
  run(keyboard + '\n' + banner + '\n' + cockpit + '\n' + ranked);
  return { state, elements, window, document, context, calls, audio, effects, draws, rects, run,
    network: fn => { network = fn; },
    key: (code = 'Digit0', extra = {}) => window.emit('keydown', { target: document.body, code, ...extra }),
    click: id => elements[id].emit('click'),
    async start() { elements['ranked-nickname'].value = 'Refill driver'; await elements['ranked-start'].emit('click'); },
    phase: () => elements['ranked-hud'].dataset.phase,
    advance(ms) { now += ms; window.RoadsterRanked.tick(now); },
    draw() {
      run(`{ const t = I18N[currentLang], isRetroBrakeFiring = false, isLiftFiring = false; ${gauge} }`);
      run('updateCockpitHudScreen(0, 0, false, false, false, false, false);');
    },
  };
}

for (const code of ['Digit0', 'Numpad0']) for (const map of ['highway', 'city']) {
  test(`${map} ${code}: empty/partial/full tank enables infinite synchronously; second press disables without sound or notice`, async () => {
    const h = harness(map);
    for (const remaining of [0, 1.5, 6.4, 10]) {
      Object.assign(h.state, { airRemaining: remaining, airUsedContinuous: 10 - remaining, gasMassKg: 144 * remaining / 10,
        isFreefalling: remaining === 0, isAutoDescending8s: remaining < 2, bannerType: remaining === 0 ? 'freefall' : '8s', bannerTimer: 2,
        x: 123, y: 45, z: -678, vy: -3, speed: 99, yaw: 0.7, pitch: -0.4, roll: 0.8, score: 900, carsCleared: 17 });
      const position = ['x', 'y', 'z', 'vy', 'speed', 'yaw', 'pitch', 'roll', 'score', 'carsCleared'].map(key => h.state[key]);
      void h.key(code);
      assert.equal(h.state.airRemaining, 10); assert.equal(h.state.airUsedContinuous, 0); assert.equal(h.state.gasMassKg, 144);
      assert.equal(h.state.isFreefalling, false); assert.equal(h.state.isAutoDescending8s, false);
      assert.deepEqual(['x', 'y', 'z', 'vy', 'speed', 'yaw', 'pitch', 'roll', 'score', 'carsCleared'].map(key => h.state[key]), position);
      assert.equal(h.elements['status-banner'].classList.contains('hidden'), true);
      h.draw();
      assert.equal(h.elements['air-bar-fill'].style.width, '100%'); assert.equal(h.elements['val-air-sec'].textContent, '10.0s');
      assert.equal(h.elements['val-gas-mass'].textContent, '144.0 kg');
      assert.ok(h.draws.includes('10.0s / 10.0s')); assert.ok(h.draws.includes('GAS: 144.0 kg')); assert.ok(h.draws.includes('600L'));
      assert.ok(h.rects.some(rect => rect.x === 182 && rect.y === 82 && rect.height === 24 && rect.width === 308));
      assert.equal(h.run(`Object.hasOwn(keys, '${code}')`), false, 'toggle bypasses driving keys and audio initialization');
      assert.equal(h.state.infiniteJet, true);
      await h.window.emit('keyup', { code }); await h.key(code);
      assert.equal(h.state.infiniteJet, false); assert.equal(h.state.airRemaining, 10);
      await h.window.emit('keyup', { code });
    }
    assert.deepEqual(h.audio, []); assert.deepEqual(h.effects, []); assert.deepEqual(h.calls, []);
    h.state.airRemaining = 4; await h.key(code, { repeat: true }); assert.equal(h.state.airRemaining, 4);
    await h.window.emit('keyup', { code }); await h.key(code); assert.equal(h.state.airRemaining, 10);
    assert.deepEqual(h.audio, []);
  });
}

for (const code of ['Digit0', 'Numpad0']) {
  test(`${code}: text editing, dialogs, menus, destruction and browser shortcuts never refill`, async () => {
    const h = harness(); h.state.airRemaining = 2;
    for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT', 'DIV']) {
      const target = new Element('', tagName); if (tagName === 'DIV') target.contentEditable = true;
      await h.key(code, { target });
      const nested = new Element(); nested.parentElement = target; await h.key(code, { target: nested });
      assert.equal(h.state.airRemaining, 2);
    }
    for (const id of ['modal-map-select', 'modal-help', 'modal-destroyed']) {
      h.elements[id].classList.remove('hidden'); await h.key(code); h.elements[id].classList.add('hidden'); assert.equal(h.state.airRemaining, 2, id);
    }
    h.elements['ranked-dialog'].open = true; await h.key(code); h.elements['ranked-dialog'].open = false;
    h.window.RoadsterMusic.isSettingsOpen = () => true; await h.key(code); h.window.RoadsterMusic.isSettingsOpen = () => false;
    h.window.RoadsterStart.isPaintOpen = () => true; await h.key(code); h.window.RoadsterStart.isPaintOpen = () => false;
    for (const option of ['ctrlKey', 'metaKey', 'altKey', 'isComposing']) { await h.key(code, { [option]: true }); assert.equal(h.state.airRemaining, 2); }
    h.document.hidden = true; await h.key(code); h.document.hidden = false;
    h.state.isDestroyed = true; await h.key(code); h.state.isDestroyed = false;
    assert.equal(h.state.airRemaining, 2); assert.deepEqual(h.audio, []); assert.deepEqual(h.calls, []);
    await h.key(code); assert.equal(h.state.airRemaining, 10);
  });

  test(`${code}: running ranked challenge is ineligible before refill; next run waits for exact cancellation`, async () => {
    const h = harness(); await h.start();
    const end = deferred();
    h.network(async (url, options) => url === '/api/end' ? end.promise : response({ runId: 'next-run', durationMs: 60000, scoreVersion: 'distance-v2' }));
    h.state.airRemaining = 0; h.state.score = 5432; h.state.carsCleared = 10;
    void h.key(code);
    assert.equal(h.phase(), 'idle'); assert.equal(h.state.airRemaining, 10);
    const request = h.calls.find(call => call.url === '/api/end');
    assert.deepEqual(JSON.parse(request.options.body), { runId: 'run-1' }); assert.equal(request.airAtCall, 0);
    assert.equal(request.options.keepalive, true); assert.equal(h.elements['ranked-hud'].hidden, true);
    assert.equal(h.elements['ranked-error'].textContent, ''); assert.doesNotMatch(h.elements['ranked-status'].textContent, /cancel|refill/i);
    assert.equal(h.elements['ranked-submit'].hidden, true); assert.equal(h.elements['ranked-dialog'].open, false);
    await h.key(code, { repeat: true }); h.advance(60000); await h.click('ranked-submit');
    assert.equal(h.calls.filter(call => call.url === '/api/end').length, 1); assert.equal(h.calls.filter(call => call.url === '/api/score').length, 0);
    await h.window.emit('keyup', { code }); await h.key(code); assert.equal(h.state.infiniteJet, false);
    const next = h.start(); await flush();
    assert.equal(h.phase(), 'starting'); assert.equal(h.calls.filter(call => call.url === '/api/run').length, 1);
    end.resolve(response({ ended: true, runId: 'run-1' })); await next;
    assert.equal(h.phase(), 'running'); assert.equal(h.state.score, 0); assert.equal(h.calls.filter(call => call.url === '/api/run').length, 2);
    assert.deepEqual(h.audio, []); assert.deepEqual(h.effects, []);
  });

  test(`${code}: refilling during pending server start releases late issuance before another start`, async () => {
    const h = harness(), issuance = deferred(), end = deferred(); let starts = 0;
    h.network(async (url) => {
      if (url === '/api/run') return ++starts === 1 ? issuance.promise : response({ runId: 'new-run', durationMs: 60000, scoreVersion: 'distance-v2' });
      return end.promise;
    });
    const first = h.start(); await flush(); assert.equal(h.phase(), 'starting');
    h.state.airRemaining = 1; h.state.score = 333;
    await h.key(code); assert.equal(h.state.airRemaining, 10); assert.equal(h.phase(), 'idle'); assert.equal(h.elements['ranked-hud'].hidden, true);
    await h.window.emit('keyup', { code }); await h.key(code); assert.equal(h.state.infiniteJet, false);
    const second = h.start(); await flush(); assert.equal(starts, 1);
    issuance.resolve(response({ runId: 'late-run', durationMs: 60000, scoreVersion: 'distance-v2' })); await first; await flush();
    assert.equal(h.phase(), 'starting'); assert.equal(starts, 1); assert.equal(h.state.score, 333, 'late run never applies its baseline');
    assert.deepEqual(JSON.parse(h.calls.find(call => call.url === '/api/end').options.body), { runId: 'late-run' });
    end.resolve(response({ ended: true, runId: 'late-run' })); await second;
    assert.equal(h.phase(), 'running'); assert.equal(starts, 2); assert.equal(h.state.score, 0);
    assert.equal(h.calls.filter(call => call.url === '/api/end').length, 1); assert.equal(h.calls.filter(call => call.url === '/api/score').length, 0);
    assert.deepEqual(h.audio, []);
  });
}

test('silent cancellation network failures stay silent and retry the same ID before another challenge', async () => {
  for (const pending of [false, true]) {
    const h = harness(), issuance = deferred(); let ends = 0;
    if (!pending) await h.start();
    h.network(async (url, options) => {
      if (url === '/api/run') return pending && h.calls.filter(call => call.url === '/api/run').length === 1 ? issuance.promise : response({ runId: 'new-run', durationMs: 60000, scoreVersion: 'distance-v2' });
      if (++ends === 1) throw Error('network_down');
      return response({ ended: true, runId: JSON.parse(options.body).runId });
    });
    const first = pending ? h.start() : null; await flush();
    await h.key();
    if (pending) issuance.resolve(response({ runId: 'late-run', durationMs: 60000, scoreVersion: 'distance-v2' }));
    await first; await flush();
    assert.equal(h.phase(), 'idle'); assert.equal(h.elements['ranked-error'].textContent, ''); assert.equal(h.elements['ranked-hud'].hidden, true);
    h.window.RoadsterRanked.render(); assert.equal(h.elements['ranked-error'].textContent, '');
    await h.window.emit('keyup', { code: 'Digit0' }); await h.key();
    await h.start(); assert.equal(h.phase(), 'running');
    const endCalls = h.calls.filter(call => call.url === '/api/end');
    assert.equal(endCalls.length, 2); assert.equal(endCalls[0].options.body, endCalls[1].options.body);
    assert.equal(h.calls.filter(call => call.url === '/api/score').length, 0);
  }
});

test('ordinary cancellation still shows its reason and cancellation transport error', async () => {
  const h = harness(); await h.start();
  h.network(async () => { throw Error('network_down'); });
  h.window.RoadsterRanked.abort('reset'); await flush();
  assert.equal(h.phase(), 'aborted'); assert.match(h.elements['ranked-hud-status'].textContent, /Challenge cancelled: Car reset/);
  assert.match(h.elements['ranked-error'].textContent, /previous challenge ended/); assert.equal(h.elements['ranked-hud'].hidden, false);
});

test('completed and submitting snapshots never acquire later sandbox refill scores', async () => {
  const h = harness(); await h.start(); h.state.score = 100; h.state.distanceBySpeed = [1000, 0, 0, 0, 0, 0]; h.state.carsCleared = 3; h.advance(60000);
  assert.equal(h.phase(), 'complete');
  h.state.airRemaining = 0; h.state.score = 99999;
  await h.key(); assert.equal(h.state.airRemaining, 0, 'finished-result dialog blocks gameplay input');
  await h.click('ranked-close'); await h.key();
  assert.equal(h.state.airRemaining, 10); assert.equal(h.phase(), 'complete');
  const saving = deferred(); h.network(async () => saving.promise);
  const submit = h.click('ranked-submit'); await flush(); assert.equal(h.phase(), 'submitting');
  await h.window.emit('keyup', { code: 'Digit0' });
  h.state.airRemaining = 0; h.state.score = 999999; await h.key('Numpad0');
  assert.equal(h.state.infiniteJet, false); assert.equal(h.state.airRemaining, 0); assert.equal(h.phase(), 'submitting');
  const scores = h.calls.filter(call => call.url === '/api/score');
  assert.equal(scores.length, 1); assert.equal(JSON.parse(scores[0].options.body).score, 100);
  assert.equal(h.calls.filter(call => call.url === '/api/end').length, 0, 'already-finished immutable result is unaffected');
  saving.resolve(response({ accepted: true, improved: true, bestScore: 130, rank: 1 })); await submit;
  assert.equal(h.phase(), 'submitted'); assert.deepEqual(h.audio, []);
});

test('hidden refill adds no help, badge, button, tooltip, translation or sound path', () => {
  assert.doesNotMatch(html + config + ranked, /Digit0|Numpad0|refill.*\(0\)|补气.*0.*键|0.*键.*补气/i);
  const refill = section(hud, 'function refillAirTank()', "window.addEventListener('keydown'");
  assert.doesNotMatch(refill, /sound\.|showBanner|alert\(|confirm\(|applyTranslations|resetCar\(/);
  assert.doesNotMatch(section(hud, 'const keyBadgeMap =', 'function setKeyState('), /Digit0|Numpad0/);
});

for (const code of ['Digit0', 'Numpad0']) test(`${code}: held/duplicate keys switch once and unlimited mode cannot start ranked`, async () => {
  const h = harness(); await h.key(code); assert.equal(h.state.infiniteJet, true);
  await h.key(code); await h.key(code, { repeat: true });
  assert.equal(h.state.infiniteJet, true);
  assert.equal(h.elements['ranked-start'].disabled, true);
  await h.start(); assert.equal(h.calls.filter(c => c.url === '/api/run').length, 0);
  await h.window.emit('keyup', { code }); await h.key(code);
  assert.equal(h.state.infiniteJet, false); assert.equal(h.elements['ranked-start'].disabled, false);
  await h.start(); assert.equal(h.phase(), 'running');
  assert.deepEqual(h.audio, []); assert.deepEqual(h.effects, []);
});

test('focus loss clears the shortcut latch but never creates a fresh toggle or resumes held propulsion', async () => {
  const h = harness();
  h.run(section(hud, "// Fix operational bug: clear all keys", '// Dynamic Camera Distance Zoom Controls'));
  await h.key(); assert.equal(h.state.infiniteJet, true);
  await h.window.emit('blur'); await h.key('Digit0', { repeat: true }); assert.equal(h.state.infiniteJet, true);
  await h.key(); assert.equal(h.state.infiniteJet, false);
  h.document.hidden = true; await h.document.emit('visibilitychange'); h.document.hidden = false;
  await h.key(); assert.equal(h.state.infiniteJet, true);
  assert.deepEqual(h.audio, []); assert.deepEqual(h.effects, []);
});
