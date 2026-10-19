import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
const source = readFileSync(new URL('../src/leaderboard.js', import.meta.url), 'utf8');
const hud = readFileSync(new URL('../src/ui-hud.js', import.meta.url), 'utf8');
const physics = readFileSync(new URL('../src/physics-main.js', import.meta.url), 'utf8');
const categories = ['highway-realistic', 'highway-fantasy', 'city-realistic', 'city-fantasy'];
class Element {
  constructor(id = '') {
    this.id = id; this.listeners = {}; this.children = []; this.dataset = {}; this.attributes = {};
    this.value = ''; this.textContent = ''; this.open = false; this.disabled = false; this.hidden = false;
    this.isConnected = true; this.type = ''; this.ownerDocument = null;
    const classes = new Set();
    this.classList = { add: (...xs) => xs.forEach(x => classes.add(x)), remove: (...xs) => xs.forEach(x => classes.delete(x)), contains: x => classes.has(x), toggle: (x, on) => on ? classes.add(x) : classes.delete(x) };
  }
  addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
  async emit(type, event = {}) { for (const listener of this.listeners[type] || []) await listener({ target: this, preventDefault() {}, ...event }); }
  appendChild(child) { this.children.push(child); return child; }
  replaceChildren(...children) { this.children = children; }
  querySelectorAll(selector) { return selector === 'option' ? this.children : []; }
  setAttribute(name, value) { this.attributes[name] = value; }
  focus() { this.ownerDocument.activeElement = this; }
  showModal() { this.open = true; }
  close() { this.open = false; void this.emit('close'); }
  closest() { return this.type === 'text' ? this : null; }
}
function harness() {
  const elements = Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => [id, new Element(id)]));
  const document = new Element('document');
  document.activeElement = elements['btn-leaderboard']; document.hidden = false;
  document.getElementById = id => elements[id] || null;
  document.createElement = tag => new Element(tag);
  Object.values(elements).forEach(el => { el.ownerDocument = document; });
  elements['ranked-category'].value = categories[0];
  elements['ranked-category'].children = categories.map(value => Object.assign(new Element(), { value }));
  elements['ranked-nickname'].type = 'text';
  const calls = [];
  let now = 1000;
  let network = async (url, options) => {
    if (url.includes('/leaderboard')) return response({ category: new URL(url, 'https://example.test').searchParams.get('category'), entries: [], limit: 100 });
    if (url === '/api/end') return response({ ended: true, runId: JSON.parse(options.body).runId });
    if (url === '/api/run') return response({ runId: 'test-run', durationMs: 60000, serverNow: 1, expiresAt: 600001 });
    return response({ accepted: true, improved: true, bestScore: 222, rank: 1 });
  };
  const window = new Element('window');
  const state = { score: 899, carsCleared: 80, blastedCarsCount: 10, physicsMode: 'realistic', insaneMode: true, autoStabilizer: false, tireTemp: 99, isDestroyed: false, speed: 42 };
  const context = vm.createContext({
    window, document, Element, state, currentLang: 'en', currentMap: 'highway', trafficLevelIndex: 2, weatherIndex: 2, lastTime: 0,
    performance: { now: () => now }, TextEncoder, URL, AbortController,
    localStorage: { getItem() { throw new Error('storage blocked'); }, setItem() { throw new Error('storage blocked'); } },
    setTimeout: () => 1, clearTimeout() {}, setInterval() {},
    clearAllInputKeys: () => { context.inputClears = (context.inputClears || 0) + 1; },
    resetCar: () => { window.RoadsterRanked?.abort('reset'); state.isDestroyed = false; state.speed = 42; },
    selectWeatherMode: (index) => { window.RoadsterRanked?.abort('weather'); context.weatherIndex = index; },
    populateTraffic: (count) => { context.trafficCount = count; },
    toggleStabilizer: () => { window.RoadsterRanked?.abort('stabilizer'); state.autoStabilizer = !state.autoStabilizer; },
    applyTranslations: () => window.RoadsterRanked?.render(),
    toggleLanguage: () => { context.currentLang = context.currentLang === 'en' ? 'zh' : 'en'; window.RoadsterRanked.render(); },
    fetch: async (url, options) => { calls.push({ url, options }); return network(url, options); },
  });
  vm.runInContext(source, context);
  return {
    context, elements, state, window, document, calls,
    phase: () => elements['ranked-hud'].dataset.phase,
    setNow: value => { now = value; },
    advance: ms => { now += ms; window.RoadsterRanked.tick(now); },
    network: fn => { network = fn; },
    async start(name = '测试 Racer') { elements['ranked-nickname'].value = name; await elements['ranked-start'].emit('click'); },
    click: id => elements[id].emit('click'),
  };
}
function response(data, status = 200) { return { ok: status >= 200 && status < 300, status, json: async () => data }; }
const flush = () => new Promise(resolve => setImmediate(resolve));

test('ranked start resets score and normalized gameplay, fixed 60s score is opt-in', async () => {
  const h = harness();
  await h.start();
  assert.equal(h.phase(), 'running');
  assert.equal(h.state.score, 0); assert.equal(h.state.carsCleared, 0); assert.equal(h.state.blastedCarsCount, 0);
  assert.equal(h.state.tireTemp, 35); assert.equal(h.state.autoStabilizer, true); assert.equal(h.state.insaneMode, false);
  assert.equal(h.context.weatherIndex, 0); assert.equal(h.context.trafficLevelIndex, 1); assert.equal(h.context.trafficCount, 36);
  h.state.score = 125.4; h.state.carsCleared = 3;
  h.advance(59999); assert.equal(h.phase(), 'running');
  h.advance(1); assert.equal(h.phase(), 'complete');
  assert.match(h.elements['ranked-result'].textContent, /155/);
  assert.equal(h.calls.filter(c => c.url === '/api/score').length, 0);
  h.state.score = 99999;
  await h.click('ranked-submit');
  const sent = JSON.parse(h.calls.find(c => c.url === '/api/score').options.body);
  assert.deepEqual(sent, { runId: 'test-run', nickname: '测试 Racer', score: 155, elapsedMs: 60000 });
  assert.equal(h.phase(), 'submitted');
});

test('network-loss submission keeps exact immutable payload and retries same run', async () => {
  const h = harness();
  await h.start('Retry Name'); h.state.score = 222; h.advance(60000);
  let attempts = 0;
  h.network(async (url) => {
    if (url === '/api/score' && ++attempts === 1) throw new TypeError('Failed to fetch');
    if (url === '/api/score') return response({ accepted: true, improved: true, bestScore: 222, rank: 1 });
    return response({ category: 'highway-realistic', entries: [] });
  });
  await h.click('ranked-submit');
  assert.equal(h.phase(), 'complete'); assert.match(h.elements['ranked-error'].textContent, /same run and score/);
  const first = h.calls.find(c => c.url === '/api/score').options.body;
  h.state.score = 999; h.elements['ranked-nickname'].value = 'Changed';
  await h.click('ranked-submit');
  const submitted = h.calls.filter(c => c.url === '/api/score');
  assert.equal(submitted.length, 2); assert.equal(submitted[1].options.body, first); assert.equal(h.phase(), 'submitted');
});

test('double-click does not create duplicate runs or duplicate submissions', async () => {
  const h = harness(); let resolveStart; let resolveScore;
  h.network(async (url) => {
    if (url === '/api/run') return new Promise(resolve => { resolveStart = resolve; });
    if (url === '/api/score') return new Promise(resolve => { resolveScore = resolve; });
    return response({ category: 'highway-realistic', entries: [] });
  });
  const first = h.start(); await flush();
  await h.start(); assert.equal(h.calls.filter(c => c.url === '/api/run').length, 1);
  resolveStart(response({ runId: 'one-run', durationMs: 60000 })); await first;
  h.advance(60000);
  const submit = h.click('ranked-submit'); await flush();
  await h.click('ranked-submit'); assert.equal(h.calls.filter(c => c.url === '/api/score').length, 1);
  resolveScore(response({ accepted: true, improved: true, bestScore: 0, rank: 1 })); await submit;
});

test('crash immediately ends its server run and restart does not wait for 60 seconds', async () => {
  const h = harness(); await h.start(); h.state.score = 500; h.state.carsCleared = 2; h.state.isDestroyed = true;
  h.advance(1000); assert.equal(h.phase(), 'aborted'); assert.match(h.elements['ranked-hud-status'].textContent, /Vehicle crashed/);
  assert.equal(h.elements['ranked-submit'].hidden, true);
  const ended = h.calls.find(c => c.url === '/api/end');
  assert.deepEqual(JSON.parse(ended.options.body), { runId: 'test-run' });
  assert.equal(ended.options.credentials, 'same-origin'); assert.equal(ended.options.keepalive, true);
  await h.start(); assert.equal(h.phase(), 'running'); assert.equal(h.state.isDestroyed, false);
  assert.equal(h.calls.filter(c => c.url === '/api/run').length, 2);
  assert.equal(h.calls.filter(c => c.url === '/api/score').length, 0);
});

test('background, blur and each settings invalidation cancel active runs', async () => {
  for (const reason of ['reset', 'map', 'physics', 'weather', 'traffic', 'plaid', 'stabilizer']) {
    const h = harness(); await h.start(); h.window.RoadsterRanked.abort(reason);
    assert.equal(h.phase(), 'aborted'); h.advance(60000); assert.equal(h.phase(), 'aborted');
    assert.equal(h.calls.filter(c => c.url === '/api/score').length, 0);
    assert.equal(h.calls.filter(c => c.url === '/api/end').length, 1);
  }
  const h = harness(); await h.start(); h.document.hidden = true; await h.document.emit('visibilitychange'); assert.equal(h.phase(), 'aborted');
  const k = harness(); await k.start(); await k.window.emit('blur'); assert.equal(k.phase(), 'aborted');
  const changed = harness(); await changed.start(); changed.context.weatherIndex = 1; changed.advance(1); assert.equal(changed.phase(), 'aborted');
});

test('cancel/close during pending start cannot unexpectedly start later', async () => {
  const h = harness(); let resolve;
  h.network(async (url, options) => url === '/api/run' ? new Promise(done => { resolve = done; }) : response({ ended: true, runId: JSON.parse(options.body).runId }));
  const pending = h.start(); await flush(); await h.click('ranked-close');
  resolve(response({ runId: 'late-run', durationMs: 60000 })); await pending; await flush();
  assert.equal(h.phase(), 'aborted'); assert.equal(h.state.score, 899);
  assert.deepEqual(JSON.parse(h.calls.find(c => c.url === '/api/end').options.body), { runId: 'late-run' });
});

test('Unicode normalization and validation match nickname contract; storage denial is harmless', async () => {
  for (const bad of ['', '_name', '-name', '<script>', 'a\u200bb', 'a'.repeat(21), '😀']) {
    const h = harness(); await h.start(bad); assert.equal(h.phase(), 'idle'); assert.equal(h.calls.length, 0);
  }
  for (const good of ['测试车手', 'हिन्दी', 'ＡＢＣ Racer', 'Café-9']) {
    const h = harness(); await h.start(good); assert.equal(h.phase(), 'running', good);
  }
});

test('run_active and malformed run errors are usable and never silently retry', async () => {
  const h = harness(); h.network(async () => response({ error: { code: 'run_active', message: 'untrusted server text' } }, 409));
  await h.start(); assert.equal(h.phase(), 'idle'); assert.match(h.elements['ranked-error'].textContent, /65 seconds/);
  assert.equal(h.elements['ranked-start'].disabled, false); assert.equal(h.calls.length, 1);
  const k = harness(); k.network(async () => response({ runId: 'wrong', durationMs: 500 })); await k.start(); assert.equal(k.phase(), 'idle');
});

test('boards use cookie-free GET and text-only nickname rendering with stale-response protection', async () => {
  const h = harness();
  h.network(async (url) => response({ category: new URL(url, 'https://example.test').searchParams.get('category'), entries: [{ rank: 1, nickname: '<img onerror=evil()>', score: 123 }] }));
  await h.click('btn-leaderboard'); await flush();
  const get = h.calls.find(c => c.url.includes('/leaderboard'));
  assert.equal(get.options.credentials, 'omit');
  const cell = h.elements['ranked-entries'].children[0].children[1];
  assert.equal(cell.textContent, '<img onerror=evil()>'); assert.equal(cell.children.length, 0);
  let doneFirst; let doneSecond;
  h.network(async () => new Promise(resolve => { if (!doneFirst) doneFirst = resolve; else doneSecond = resolve; }));
  h.elements['ranked-category'].value = 'city-realistic'; const one = h.elements['ranked-category'].emit('change'); await flush();
  h.elements['ranked-category'].value = 'city-fantasy'; const two = h.elements['ranked-category'].emit('change'); await flush();
  doneSecond(response({ category: 'city-fantasy', entries: [{ rank: 1, nickname: 'Latest', score: 200 }] })); await two;
  doneFirst(response({ category: 'city-realistic', entries: [{ rank: 1, nickname: 'Stale', score: 1 }] })); await one;
  assert.equal(h.elements['ranked-entries'].children[0].children[1].textContent, 'Latest');
});

test('English/Chinese, modal dismissal and retained finished result work', async () => {
  const h = harness(); await h.click('btn-leaderboard'); await h.click('ranked-language');
  assert.equal(h.elements['ranked-title'].textContent, '60 秒挑战');
  await h.elements['ranked-dialog'].emit('cancel'); assert.equal(h.elements['ranked-dialog'].open, false);
  await h.start(); h.advance(60000); h.window.RoadsterRanked.abort('reset'); assert.equal(h.phase(), 'complete');
  await h.click('ranked-discard'); assert.equal(h.phase(), 'idle'); assert.equal(h.elements['ranked-nickname'].disabled, false);
});

test('integration guards every shared gameplay-setting pathway and ignores typing', () => {
  for (const [name, reason] of [['switchMap', 'map'], ['resetCar', 'reset'], ['togglePhysicsMode', 'physics'], ['togglePlaidMode', 'plaid'], ['toggleStabilizer', 'stabilizer']]) {
    assert.ok(hud.includes(`function ${name}(`));
    assert.match(hud.slice(hud.indexOf(`function ${name}(`), hud.indexOf(`function ${name}(`) + 120), new RegExp(`abort\\('${reason}'\\)`));
  }
  assert.match(hud, /selectWeatherMode[\s\S]{0,150}abort\('weather'\)/);
  assert.match(hud, /btn-traffic[\s\S]*?addEventListener\('click'[\s\S]{0,100}abort\('traffic'\)/);
  const listener = hud.slice(hud.indexOf("window.addEventListener('keydown'"), hud.indexOf("window.addEventListener('keyup'"));
  let resetCount = 0;
  const target = new Element(); target.type = 'text';
  const window = { addEventListener(_type, callback) { this.onKey = callback; }, RoadsterRanked: { isDialogOpen: () => false } };
  vm.runInNewContext(listener, { window, Element, document: {}, resetCar: () => resetCount++ });
  window.onKey({ target, code: 'KeyR' }); assert.equal(resetCount, 0);
  const frame = physics.slice(physics.indexOf('function animate(now)'), physics.indexOf("window.addEventListener('resize'"));
  assert.ok(frame.indexOf('RoadsterRanked?.tick(now)') < frame.indexOf('updateSimulation(dt)'));
  assert.ok(html.includes('aria-labelledby="ranked-title"'));
  assert.ok(!hud.slice(hud.indexOf('const nonMinimalBtnIds'), hud.indexOf('if (state.hudMinimal)')).includes('btn-leaderboard'));
});

test('crash overlay retains the canceled challenge status without an obsolete countdown', () => {
  const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
  assert.match(html, /id="ranked-crash-status"/);
  assert.match(source, /text\('ranked-crash-status'/);
  const destroy = physics.slice(physics.indexOf('function destroyVehicle('), physics.indexOf('function updateDestroyedScores('));
  assert.match(destroy, /RoadsterRanked\?\.abort\('crash'\)/);
});

test('submitted score status can be dismissed and reopened without losing result', async () => {
  const h = harness();
  await h.start('Keep Result'); h.state.score = 222; h.advance(60000);
  await h.click('ranked-submit');
  assert.equal(h.phase(), 'submitted');
  const result = h.elements['ranked-result'].textContent;
  await h.click('ranked-close');
  await h.click('ranked-hud-dismiss');
  assert.equal(h.elements['ranked-hud'].hidden, true);
  assert.equal(h.document.activeElement.id, 'btn-leaderboard');
  h.window.RoadsterRanked.render();
  await h.click('ranked-language');
  assert.equal(h.elements['ranked-hud'].hidden, true, 'translation must not restore a dismissed notice');
  assert.equal(h.phase(), 'submitted');
  await h.click('btn-leaderboard');
  assert.equal(h.elements['ranked-hud'].hidden, false);
  assert.equal(h.elements['ranked-dialog'].open, true);
  await h.click('ranked-language');
  assert.equal(h.elements['ranked-result'].textContent, result);
  assert.match(h.elements['ranked-status'].textContent, /Score accepted/);
  assert.equal(h.calls.filter(c => c.url === '/api/score').length, 1);
});

test('dismissal preserves a pending result and does not stop an active countdown', async () => {
  const h = harness(); await h.start();
  await h.click('ranked-hud-dismiss');
  h.advance(59000);
  assert.equal(h.phase(), 'running');
  assert.equal(h.elements['ranked-countdown'].textContent, '1s');
  assert.equal(h.elements['ranked-hud'].hidden, true);
  h.advance(1000);
  assert.equal(h.phase(), 'complete');
  await h.click('ranked-close'); await h.click('ranked-hud-dismiss');
  assert.equal(h.elements['ranked-hud'].hidden, true);
  await h.click('btn-leaderboard');
  assert.equal(h.elements['ranked-submit'].hidden, false);
  assert.equal(h.phase(), 'complete');
});


test('restart waits for end confirmation and does not duplicate pending end requests', async () => {
  const h = harness(); await h.start(); let finish;
  h.network(async (url, options) => {
    if (url === '/api/end') return new Promise(resolve => { finish = () => resolve(response({ ended: true, runId: JSON.parse(options.body).runId })); });
    return response({ runId: 'new-run', durationMs: 60000 });
  });
  h.window.RoadsterRanked.abort('crash');
  const next = h.start(); await flush();
  await h.start();
  assert.equal(h.phase(), 'starting');
  assert.equal(h.calls.filter(c => c.url === '/api/end').length, 1);
  assert.equal(h.calls.filter(c => c.url === '/api/run').length, 1);
  finish(); await next;
  assert.equal(h.phase(), 'running');
  assert.deepEqual(h.calls.map(c => c.url), ['/api/run', '/api/end', '/api/run']);
});

test('uncertain end is retried with same run ID before a new start, failures stay visible', async () => {
  const h = harness(); await h.start(); let attempts = 0;
  h.network(async (url, options) => {
    if (url === '/api/end') { attempts++; if (attempts <= 2) throw Error('network_down'); return response({ ended: true, runId: JSON.parse(options.body).runId }); }
    return response({ runId: 'new-run', durationMs: 60000 });
  });
  h.window.RoadsterRanked.abort('crash'); await flush();
  assert.match(h.elements['ranked-error'].textContent, /previous challenge ended/);
  await h.start(); assert.equal(h.phase(), 'idle');
  assert.match(h.elements['ranked-error'].textContent, /previous challenge ended/);
  assert.equal(h.calls.filter(c => c.url === '/api/run').length, 1);
  await h.start(); assert.equal(h.phase(), 'running');
  const ends = h.calls.filter(c => c.url === '/api/end');
  assert.equal(ends.length, 3); assert.ok(ends.every(c => c.options.body === ends[0].options.body));
});

test('canceled pending issuance is ended before a newer start, late callbacks cannot abort new run', async () => {
  const h = harness(); let finishStart; let finishEnd; let starts = 0;
  h.network(async (url, options) => {
    if (url === '/api/run' && ++starts === 1) return new Promise(resolve => { finishStart = resolve; });
    if (url === '/api/end') return new Promise(resolve => { finishEnd = () => resolve(response({ ended: true, runId: JSON.parse(options.body).runId })); });
    return response({ runId: 'new-run', durationMs: 60000 });
  });
  const first = h.start(); await flush(); await h.click('ranked-close');
  const second = h.start(); await flush();
  assert.equal(starts, 1);
  finishStart(response({ runId: 'old-run', durationMs: 60000 })); await first; await flush();
  assert.equal(h.phase(), 'starting'); assert.equal(starts, 1);
  assert.equal(h.calls.filter(c => c.url === '/api/end').length, 1);
  finishEnd(); await second;
  assert.equal(h.phase(), 'running'); assert.equal(starts, 2);
  assert.deepEqual(JSON.parse(h.calls.find(c => c.url === '/api/end').options.body), { runId: 'old-run' });
});

test('discarding a completed result releases its server run before playing again', async () => {
  const h = harness(); await h.start(); h.advance(60000);
  await h.click('ranked-discard'); await h.start();
  assert.equal(h.phase(), 'running');
  assert.deepEqual(h.calls.filter(c => !c.url.includes('leaderboard')).map(c => c.url), ['/api/run', '/api/end', '/api/run']);
});
