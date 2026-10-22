import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { motionHarness } from './helpers/motion-harness.mjs';

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const physics = read('src/physics-main.js'), health = read('src/render-health.js');
const section = (from, to) => {
  const a = physics.indexOf(from), b = physics.indexOf(to, a + from.length);
  assert.ok(a >= 0 && b > a, from); return physics.slice(a, b);
};
function target(extra = {}) {
  const listeners = new Map();
  return Object.assign({
    listeners,
    addEventListener(type, callback, options) { const rows = listeners.get(type) || []; rows.push({ callback, capture: options === true || options?.capture === true }); listeners.set(type, rows); },
    emit(type, extra = {}) {
      const event = { target: this, defaultPrevented: false, stopped: false,
        preventDefault() { this.defaultPrevented = true; }, stopImmediatePropagation() { this.stopped = true; }, ...extra };
      for (const row of [...(listeners.get(type) || [])].sort((a, b) => Number(b.capture) - Number(a.capture))) {
        row.callback(event); if (event.stopped) break;
      }
      return event;
    }
  }, extra);
}

// Execute the production RAF owner, both real fixed clocks, movement kernel,
// clock-reset functions, and incident recorder. Scene/audio presentation are
// mocks: this is CPU safety coverage, not GPU rendering/device acceptance.
function fixture({ map = 'city', lost = false, install = true } = {}) {
  const h = motionHarness({ x: 6, z: -200, vz: -60, speed: 60 }, map);
  let now = 0, contextLost = lost, clearCount = 0, demoActive = false, demoStops = 0, queuedFrame;
  const counts = { raf: 0, ticks: 0, renders: 0, ranked: 0, taxi: 0, lod: 0, coast: 0, demo: 0, mutes: 0 };
  const canvas = target(), previewCanvas = target();
  const nodes = Object.fromEntries(['render-health-overlay', 'render-health-title', 'render-health-message', 'render-health-resume'].map(id => [id, target({ hidden: true, open: false, disabled: false, isConnected: true, textContent: '', focus() {}, showModal() { this.open = true; }, close() { this.open = false; }, setAttribute(name) { this[name] = true; } })]));
  const modal = { classList: { contains: () => true } };
  const document = target({ hidden: false, activeElement: null, getElementById: id => nodes[id] || modal });
  Object.assign(h.context.window, target(), {
    RoadsterRanked: { tick() { counts.ranked++; }, isDialogOpen: () => false },
    RoadsterDemo: { isActive: () => demoActive, isBusy: () => demoActive, stop() { demoActive = false; demoStops++; }, advanceFrame() { counts.demo++; } },
    RoadsterTaxi: { tick() { counts.taxi++; }, present() { counts.taxi++; } },
    RoadsterTrafficAssets: { updateLods() { counts.lod++; } },
    RoadsterTouch: { clear() { clearCount++; }, readInput: () => ({}) }
  });
  const renderer = { domElement: canvas, getContext: () => ({ isContextLost: () => contextLost }), render() { counts.renders++; } };
  Object.assign(h.context, { document, renderer, performance: { now: () => now }, requestAnimationFrame(callback) { counts.raf++; queuedFrame = callback; },
    camera: { position: Object.freeze({ x: 6, y: 2, z: -195 }) }, scene: Object.freeze({}),
    clearAllInputKeys() { for (const code in h.keys) h.keys[code] = false; h.context.window.RoadsterTouch.clear(); },
    sound: { init() {}, update(...args) { assert.equal(args[3], true); counts.mutes++; } }
  });
  // Real production begin call at the beginning of the movement step; no
  // contact resolution/presentation is needed to establish a suspended tick.
  vm.runInContext(read('src/city-clock.js') + '\n' + read('src/city-diagnostics.js') + `
    let lastTime = 0;
    function updateSimulation(dt) { counts.ticks++; if(currentMap==='city')window.RoadsterCityDiagnostics?.begin(state,dt,{}); motionApi.step(dt); }
    function updateDestroyedScores() {}
    ${section('const cityFrameClock =', "window.addEventListener('resize'")}
    globalThis.frameApi = { animate: now => animate(now), binding: () => animate, clocks: () => ({city:cityFrameClock.stats(),coast:coastFrameClock.stats()}), time: () => lastTime };
  `, Object.assign(h.context, { counts }));
  const installHealth = () => vm.runInContext(health, h.context);
  if (install) installHealth();
  const advance = time => { now = time; h.context.frameApi.animate(now); };
  return { ...h, canvas, previewCanvas, nodes, counts, document, renderer, installHealth, advance,
    queued: () => queuedFrame,
    advanceQueued(time) { now = time; assert.equal(typeof queuedFrame, 'function'); queuedFrame(now); },
    setNow(value) { now = value; }, setLost(value) { contextLost = value; }, setDemo(value) { demoActive = value; },
    get clearCount() { return clearCount; }, get demoStops() { return demoStops; },
    api: () => h.context.window.RoadsterRenderHealth,
    clocks: () => JSON.parse(JSON.stringify(h.context.frameApi.clocks())),
    recorder: () => JSON.parse(JSON.stringify(h.context.window.RoadsterCityDiagnostics.stats())),
    loss() { contextLost = true; return canvas.emit('webglcontextlost'); },
    restore() { contextLost = false; canvas.emit('webglcontextrestored'); },
    resume() { nodes['render-health-resume'].emit('click'); }
  };
}

test('only loss on the main canvas pauses; it permits restoration, clears controls/demo, mutes and prompts', () => {
  const f = fixture(); f.keys.KeyW = true; f.setDemo(true);
  f.previewCanvas.emit('webglcontextlost'); assert.equal(f.api().isPaused(), false);
  assert.equal(f.loss().defaultPrevented, true);
  assert.equal(f.api().snapshot().phase, 'lost'); assert.equal(f.api().isPaused(), true);
  assert.equal(f.keys.KeyW, false); assert.ok(f.clearCount > 0); assert.equal(f.demoStops, 1); assert.ok(f.counts.mutes > 0);
  assert.equal(f.nodes['render-health-overlay'].open, true); assert.equal(f.nodes['render-health-resume'].disabled, true);
  assert.equal(f.nodes['render-health-overlay'].emit('cancel').defaultPrevented, true);
  f.resume(); assert.equal(f.api().isPaused(), true, 'a synthetic click cannot bypass an unrestored context');
});

for (const map of ['city', 'coast', 'highway']) test(`production ${map} animate suspends every step and discards paused/resume debt`, () => {
  const f = fixture({ map }); f.advance(1000 / 60); f.advance(25);
  assert.ok(f.counts.ticks > 0); f.loss();
  const stateBefore = JSON.stringify(f.state), historyBefore = f.recorder(), countsBefore = { ...f.counts };
  for (let n = 1; n <= 120; n++) f.advance(25 + n * 1000);
  assert.equal(JSON.stringify(f.state), stateBefore); assert.deepEqual(f.recorder(), historyBefore);
  for (const key of ['ticks', 'renders', 'ranked', 'taxi', 'lod', 'coast', 'demo']) assert.equal(f.counts[key], countsBefore[key], key);
  assert.equal(f.counts.raf - countsBefore.raf, 120, 'RAF remains scheduled to observe recovery');
  assert.equal(f.clocks().city.accumulator, 0); assert.equal(f.clocks().coast.accumulator, 0);
  f.restore(); f.advance(121025); assert.equal(JSON.stringify(f.state), stateBefore, 'restore is not resume');
  f.setNow(181025); f.resume(); assert.equal(f.api().isPaused(), false);
  assert.equal(f.context.frameApi.time(), 181025, 'explicit resume resets the interval since the last paused RAF');
  f.advance(181025 + 1000 / 60);
  assert.equal(f.counts.ticks, countsBefore.ticks + 1, 'only one fresh tick, never a pause catch-up burst');
  const beforePose = JSON.parse(stateBefore);
  assert.ok(Math.hypot(f.state.x - beforePose.x, f.state.z - beforePose.z) < 2, 'only fresh-frame motion after the three-minute pause');
});

test('held keys stay neutral through explicit resume until released and freshly pressed', () => {
  const f = fixture(); f.keys.KeyW = true;
  f.context.window.addEventListener('keydown', event => { if (event.code === 'Space') event.preventDefault(); f.keys[event.code] = true; });
  f.loss();
  assert.equal(f.context.window.emit('keydown', { key: 'a', code: 'KeyA' }).defaultPrevented, true);
  f.restore(); assert.equal(f.nodes['render-health-resume'].disabled, false);
  assert.equal(f.context.window.emit('keydown', { key: ' ', code: 'Space', target: f.nodes['render-health-resume'] }).defaultPrevented, false);
  assert.notEqual(f.keys.Space, true, 'native button activation cannot bubble into the existing driving Space handler');
  f.resume(); assert.equal(f.keys.KeyW, false); assert.notEqual(f.keys.Space, true);
  for (const code of ['KeyW', 'KeyA']) assert.equal(f.context.window.emit('keydown', { key: 'w', code, repeat: true }).defaultPrevented, true);
  assert.equal(f.keys.KeyW, false); assert.notEqual(f.keys.KeyA, true);
  f.context.window.emit('keyup', { code: 'KeyW' });
  assert.equal(f.context.window.emit('keydown', { key: 'w', code: 'KeyW' }).defaultPrevented, false);
  assert.equal(f.keys.KeyW, true);
});

test('the unmodified production owner schedules the wrapped binding across active, paused and resumed RAFs', () => {
  const f = fixture(); f.advance(1000 / 60);
  const wrapped = f.context.frameApi.binding(); assert.equal(f.queued(), wrapped);
  const ticks = f.counts.ticks; f.loss(); f.advanceQueued(2000);
  assert.equal(f.counts.ticks, ticks); assert.equal(f.queued(), wrapped);
  f.restore(); f.advanceQueued(3000); assert.equal(f.counts.ticks, ticks);
  f.setNow(4000); f.resume(); f.advanceQueued(4000 + 1000 / 60);
  assert.equal(f.counts.ticks, ticks + 1); assert.equal(f.queued(), wrapped);
});

test('already-lost context is caught before Ranked.tick or the first simulation; repeated install is harmless', () => {
  const f = fixture({ lost: true }); const installed = f.api(); f.installHealth(); assert.equal(f.api(), installed);
  assert.equal(f.canvas.listeners.get('webglcontextlost').length, 1);
  f.advance(1000 / 60); assert.equal(f.counts.ticks, 0); assert.equal(f.counts.ranked, 0);
  assert.equal(f.api().snapshot().losses, 1);
  f.loss(); assert.equal(f.api().snapshot().losses, 1);
  f.restore(); f.setLost(true); f.resume(); assert.equal(f.api().isPaused(), true);
  assert.equal(f.api().snapshot().phase, 'lost'); assert.equal(f.api().snapshot().losses, 2);
});

test('without the health module, actual RAF/motion still advances under context loss (old-path counterexample)', () => {
  const f = fixture({ lost: true, install: false }); const before = f.state.z;
  for (let n = 1; n <= 30; n++) f.advance(n * 1000 / 60);
  assert.equal(f.counts.ticks, 30); assert.equal(f.counts.renders, 30);
  assert.ok(Math.abs(f.state.z - before) > 25);
  // Native r128's independent recording/real-GL proof establishes that these
  // render attempts may issue zero commands after loss. This mock does not.
});

test('healthy context does not alter production motion, fixed-clock or recorder outputs', () => {
  const guarded = fixture(), reference = fixture({ install: false });
  guarded.keys.KeyW = reference.keys.KeyW = true;
  for (const time of [8, 16, 24, 50, 66, 100, 167, 200]) { guarded.advance(time); reference.advance(time); }
  assert.equal(JSON.stringify(guarded.state), JSON.stringify(reference.state));
  assert.deepEqual(guarded.clocks(), reference.clocks()); assert.deepEqual(guarded.recorder(), reference.recorder());
  assert.deepEqual(guarded.counts, reference.counts);
});

test('module is loaded after physics, included in the deterministic bundle, and has a labelled non-dismissible prompt', () => {
  const html = read('src/index.html'), bundler = read('bundle_app.py');
  assert.ok(html.indexOf('src="physics-main.js"') < html.indexOf('src="render-health.js"'));
  assert.ok(bundler.includes("'render-health.js'"));
  assert.match(html, /<dialog id="render-health-overlay"[^>]+aria-labelledby="render-health-title"[^>]+aria-describedby="render-health-message"/);
  assert.match(html, /id="render-health-resume"[^>]+disabled/);
  assert.match(read('src/styles.css'), /\.render-health-overlay\[hidden\]/);
});
