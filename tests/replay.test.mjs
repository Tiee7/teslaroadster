import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { lifecycleHarness } from './helpers/demo-lifecycle-harness.mjs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const core = read('src/replay-core.js'), adapter = read('src/replay.js'), html = read('src/index.html');
function coreFixture(options) { const c = vm.createContext({}); vm.runInContext(core, c); return vm.runInContext('RoadsterReplayCore', c).create(options); }
const row = x => { const v = new Float32Array(18); v[0] = x; v[6] = 1; v[7] = v[8] = v[9] = v[10] = 1; return v; };
test('RAM core copies samples, orders time and brackets/clamps seek without retaining caller arrays', () => {
  const r = coreFixture(), a = row(0); r.append(0, a); a[0] = 999; r.append(.05, row(5));
  assert.equal(r.at(0).a.values[0], 0); assert.equal(r.append(.05, row(9)), false);
  assert.equal(r.at(.025).alpha, .5); assert.equal(r.at(-5).time, 0); assert.equal(r.at(100).time, .05);
  r.clear(); assert.deepEqual(JSON.parse(JSON.stringify(r.stats())), { frames: 0, bytes: 0, reason: '', stopped: false, duration: 0, maxSeconds: 300, maxBytes: 33554432 });
});
test('duration and byte limits stop and preserve the oldest samples, never overwrite or exceed reservation', () => {
  const time = coreFixture({ maxSeconds: .1 }); time.append(0, row(0)); time.append(.1, row(1));
  assert.equal(time.stats().stopped, true); assert.equal(time.append(.15, row(2)), false); assert.equal(time.at(0).a.values[0], 0);
  const memory = coreFixture({ maxBytes: 272 }); memory.append(0, row(0)); memory.append(.05, row(1));
  assert.equal(memory.append(.1, row(2)), false); assert.equal(memory.stats().reason, 'memory'); assert.equal(memory.stats().bytes, 272); assert.equal(memory.stats().frames, 2);
  assert.equal(memory.reserve(1), false); assert.equal(memory.stats().bytes, 272);
});
test('generation/visibility/teleport cuts never interpolate across respawns', () => {
  const c = vm.createContext({}); vm.runInContext(core, c); const continuous = vm.runInContext('RoadsterReplayCore.continuous', c);
  const a = row(0), b = row(1); assert.equal(continuous(a, b, 0), true);
  b[16]++; assert.equal(continuous(a, b, 0), false); b[16] = 0; b[10] = 0; assert.equal(continuous(a, b, 0), false);
  b[10] = 1; b[0] = 100; assert.equal(continuous(a, b, 0), false);
});

class Dom {
  constructor(id = '') { this.id = id; this.listeners = {}; this.hidden = false; this.value = ''; this.dataset = {}; this.classes = new Set(['hidden']); this.classList = { add: x => this.classes.add(x), remove: x => this.classes.delete(x), contains: x => this.classes.has(x), toggle: (x, yes) => yes ? this.classes.add(x) : this.classes.delete(x) }; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  emit(type, extra = {}) { const e = { target: this, preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; }, ...extra }; for (const fn of this.listeners[type] || []) { fn(e); if (e.stopped) break; } return e; }
  dispatchEvent(event) { return this.emit(event.type || 'change', event); }
  closest() { return null; }
  getContext() { return {}; }
  setPointerCapture() {}
  setAttribute() {}
  showModal() { this.open = true; }
  close() { this.open = false; }
}
function fixture(map = 'highway', count = 52) {
  const ids = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => [id, new Dom(id)]));
  const document = new Dom(), window = new Dom(), canvas = new Dom(); document.body = new Dom(); document.hidden = false;
  document.getElementById = id => ids.get(id); document.createElement = () => new Dom();
  window.innerWidth = 1280; window.innerHeight = 850; window.confirm = () => true;
  let renders = 0, inputs = 0, simulations = 0, now = 1000;
  const c = vm.createContext({ window, document, console, Event: class {}, atob: t => Buffer.from(t, 'base64').toString('binary'),
    localStorage: { getItem: () => null, setItem() { throw Error('Unexpected persistence'); } }, performance: { now: () => now },
    fetch() { throw Error('Unexpected network'); }, indexedDB: { open() { throw Error('Unexpected persistence'); } },
    sound: { update() {}, playCrash() {}, beep() {} }, clearAllInputKeys() { inputs++; }, resetChaseCamera() {}, showBanner() {},
    renderBannerText() {}, updateCockpitHudScreen() {}, renderer: { domElement: canvas, render() { renders++; } }, lastTime: 0,
    updateSimulation() { simulations++; }, requestAnimationFrame() {}, setKeyState() {},
  });
  vm.runInContext(readFileSync(process.env.ROADSTER_THREE_RUNTIME || '/tmp/roadster-three.min.js', 'utf8'), c);
  vm.runInContext(read('src/config.js') + '\n' + read('src/driving-score.js') + `\ncurrentMap='${map}'; const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(60,1,.38,4500);`, c);
  const world = read('src/world.js'); vm.runInContext(world.slice(world.indexOf('const bodyMaterial ='), world.indexOf('const highwayEnvGroup')), c);
  for (const f of ['coast-road-network', 'coast-map', 'highway-traffic', 'vehicles', 'reference-exterior', 'reference-cockpit', 'npc-traffic-assets', 'reference-traffic']) vm.runInContext(read('src/' + f + '.js'), c, { filename: f });
  const physics = read('src/physics-main.js'); vm.runInContext(physics.slice(0, physics.indexOf('// =========================================================================\n// 9. MAIN GAME')), c);
  vm.runInContext(`const rainLinesMesh=new THREE.Group();scene.add(rainLinesMesh); const scrollingProps=[new THREE.Group()];
    populateTraffic(${count}); globalThis.parts={scene,camera,playerWrapper,roadsterAttitudeGroup,carMeshGroup,trafficCars,wheels,frontWheelSteerGroups,activeWingGroup,rearNozzlesGimbalGroup,allThrusterPlumes,coldGasTime,debrisGroup,explosionGroup,tireSmokeGroup,debrisPieces,state,scrollingProps};`, c);
  vm.runInContext(read('src/city-clock.js') + '\n' + physics.slice(physics.indexOf('// Scope the fixed clock'), physics.indexOf("window.addEventListener('resize'")), c);
  const hud = read('src/ui-hud.js'); vm.runInContext(hud.slice(hud.indexOf('function resetCar()'), hud.indexOf('function applyTranslations()')), c);
  vm.runInContext(core + '\n' + adapter, c);
  const api = window.RoadsterReplay, parts = c.parts;
  function tick(dt = .05) { now += dt * 1000; api.afterTick(dt); }
  return { c, api, parts, window, document, canvas, ids, tick, evaluate: s => vm.runInContext(s, c), get renders() { return renders; }, get inputs() { return inputs; }, get simulations() { return simulations; } };
}
for (const map of ['highway', 'city', 'coast']) test(`${map}: all native vehicles, actual hierarchy animations, seek fidelity and exact live restore`, () => {
  const f = fixture(map, map === 'coast' ? 20 : 52), { api, parts: p } = f;
  assert.equal(api.record(), true); const count = p.trafficCars.length; assert.equal(api.stats().vehicles, count + 1);
  const originalState = JSON.stringify(p.state);
  for (let i = 0; i < 10; i++) {
    p.playerWrapper.position.set(i, 2 + i * .25, map === 'highway' ? 0 : -i); p.roadsterAttitudeGroup.rotation.set(.15 * i, .2 * i, -.1 * i);
    p.wheels[0].rotation.x = -i * 3.2; p.activeWingGroup.rotation.x = -.03 * i;
    p.trafficCars.forEach((car, j) => { car.mesh.position.set(j * 2 + i, j % 3, -j * 4 - i); car.mesh.rotation.y = .02 * i; });
    f.tick();
  }
  api.stop(); const clip = api.sample(.25); assert.ok(clip); const expected = clip.a;
  p.playerWrapper.position.set(93, 17, 12); p.roadsterAttitudeGroup.rotation.set(.2, .5, -.3); p.wheels[0].rotation.x = -888;
  const live = [p.playerWrapper.position.toArray(), p.roadsterAttitudeGroup.quaternion.toArray(), p.wheels[0].rotation.x, p.trafficCars.map(c => c.mesh.position.toArray())];
  assert.equal(api.play(), true); api.pause(); api.seek(.25);
  assert.deepEqual(p.playerWrapper.position.toArray(), expected.slice(0, 3));
  assert.deepEqual(p.roadsterAttitudeGroup.quaternion.toArray(), expected.slice(18 + 3, 18 + 7));
  for (let j = 0; j < count; j++) assert.deepEqual(p.trafficCars[j].mesh.position.toArray(), expected.slice((3 + j) * 18, (3 + j) * 18 + 3));
  assert.equal(JSON.stringify(p.state), originalState, 'playback never drives physical state / fuel / score');
  api.exit(); assert.deepEqual([p.playerWrapper.position.toArray(), p.roadsterAttitudeGroup.quaternion.toArray(), p.wheels[0].rotation.x, p.trafficCars.map(c => c.mesh.position.toArray())], live);
  assert.equal(api.stats().checkpoint, false); assert.equal(f.document.body.dataset.replayActive, 'false');
});
test('actual reset/respawn markers cut short teleports and hidden vehicles remain in the clip', () => {
  const f = fixture(), p = f.parts, api = f.api; api.record();
  p.playerWrapper.position.x = 10; p.roadsterAttitudeGroup.rotation.set(.8, -.5, 1.3); p.wheels[0].rotation.x = -123;
  p.trafficCars[0].mesh.position.x = 10; f.tick(); const before = api.sample(.05).a.slice(21, 25);
  api.discontinuity(); api.markCar(p.trafficCars[0]); p.playerWrapper.position.x = 0; p.roadsterAttitudeGroup.rotation.set(0, 0, 0); p.wheels[0].rotation.x = 0;
  p.trafficCars[0].mesh.position.x = 0; p.trafficCars[51].mesh.visible = false; f.tick(); api.stop();
  api.play(); api.pause(); api.seek(.075); assert.equal(p.playerWrapper.position.x, 10); assert.equal(p.trafficCars[0].mesh.position.x, 10);
  assert.deepEqual(p.roadsterAttitudeGroup.quaternion.toArray(), before); assert.equal(p.wheels[0].rotation.x, -123);
  api.seek(.1); assert.equal(p.playerWrapper.position.x, 0); assert.equal(p.trafficCars[0].mesh.position.x, 0); assert.equal(p.trafficCars[51].mesh.visible, false);
});
for (const map of ['highway', 'city', 'coast']) test(`${map}: real owner respawn/wrap forces a trajectory cut without changing its physics source`, () => {
  const f = fixture(map, map === 'coast' ? 20 : 52), api = f.api;
  if (map === 'coast') f.parts.trafficCars[0].blastTimer = 1;
  api.record();
  if (map === 'highway') f.evaluate('highwayTraffic.respawnBehind(trafficCars[0],trafficCars,LANE_CENTERS,{x:state.x,y:0,z:0,vx:0,vz:-42},WORLD_SPEED_SCALE)');
  if (map === 'coast') f.evaluate('window.RoadsterCoast.recoverTraffic(trafficCars,state)');
  if (map === 'city') {
    const source = read('src/physics-main.js'); const begin = source.indexOf('function advanceCityTraffic('), end = source.indexOf('// Near/far precision', begin);
    f.evaluate('function cityTrafficBody(){return {y:0,ry:1}} function cityPlayerBody(){return {y:0,ry:1}}\n' + source.slice(begin, end) + '\ntrafficCars[0].mesh.position.z=1190;trafficCars[0].vz=20;');
    // Establish an observed pre-wrap tick, then execute the original controller.
    f.tick(.016); f.evaluate('advanceCityTraffic(trafficCars[0],.05)');
  }
  f.tick(.016); api.stop(); const last = api.sample(api.stats().duration).a;
  assert.ok(last[3 * 18 + 16] > 0 || last[3 * 18 + 10] === 0, 'owner transition is a cut/hidden frame');
});
test('focused replay buttons cannot run original R/F/T game shortcuts; native control defaults remain available', () => {
  const f = fixture(), api = f.api; api.record(); f.tick(); api.stop(); api.play(); api.pause();
  const hud = read('src/ui-hud.js'); f.evaluate(hud.slice(hud.indexOf("window.addEventListener('keydown', (e)"), hud.indexOf("window.addEventListener('keyup', (e)")));
  const state = JSON.stringify(f.parts.state), target = { closest: () => ({}) };
  for (const code of ['KeyR', 'KeyF', 'KeyT', 'KeyM', 'Tab', 'Space']) { const e = f.window.emit('keydown', { code, target }); assert.equal(e.stopped, true); assert.notEqual(e.prevented, true); }
  assert.equal(JSON.stringify(f.parts.state), state);
  f.c.resetCar(); assert.equal(JSON.stringify(f.parts.state), state);
});
test('render-health recovery remains operable during replay and does not resume playback automatically', () => {
  const f = fixture(), api = f.api; api.record(); f.tick(); api.stop(); api.play();
  f.c.animate = () => {}; f.c.requestAnimationFrame = () => {}; f.evaluate(read('src/render-health.js'));
  f.canvas.emit('webglcontextlost'); assert.equal(api.stats().mode, 'paused'); assert.equal(f.window.RoadsterRenderHealth.isPaused(), true);
  f.canvas.emit('webglcontextrestored'); const button = f.ids.get('render-health-resume');
  button.closest = selector => selector === 'button' ? button : selector === '#render-health-overlay' ? f.ids.get('render-health-overlay') : null;
  const click = f.document.emit('click', { target: button }); assert.notEqual(click.prevented, true);
  const key = f.window.emit('keydown', { target: button, key: ' ', code: 'Space' }); assert.notEqual(key.prevented, true);
  button.emit('click'); assert.equal(f.window.RoadsterRenderHealth.isPaused(), false); assert.equal(api.stats().mode, 'paused');
});
test('FPV recordings use approved exterior yoke projection during playback and restore exact FPV presentation', () => {
  for (const model of ['reference', 'classic']) {
    const f = fixture(), api = f.api;
    f.evaluate(`window.RoadsterVehicle.setModel('${model}');window.RoadsterVehicle.setCockpit('${model}');cameraModeIndex=0;setCockpitPerspective(false);globalThis.exteriorYoke={p:yokeWheelGroup.position.toArray(),s:yokeWheelGroup.scale.toArray()};cameraModeIndex=3;setCockpitPerspective(true);globalThis.liveYoke={p:yokeWheelGroup.position.toArray(),s:yokeWheelGroup.scale.toArray()};`);
    api.record(); f.tick(); api.stop(); api.play(); api.pause();
    assert.deepEqual(f.evaluate('yokeWheelGroup.position.toArray()'), f.c.exteriorYoke.p); assert.deepEqual(f.evaluate('yokeWheelGroup.scale.toArray()'), f.c.exteriorYoke.s);
    api.exit(); assert.deepEqual(f.evaluate('yokeWheelGroup.position.toArray()'), f.c.liveYoke.p); assert.deepEqual(f.evaluate('yokeWheelGroup.scale.toArray()'), f.c.liveYoke.s);
  }
});
test('production crash creates all 34 debris pieces, records their real poses and restores original aftermath', () => {
  const f = fixture(), p = f.parts, api = f.api; api.record(); f.tick();
  f.evaluate("triggerPhysicsCollision(30,'crashReasonThreshold',0,0,0)"); f.tick(); assert.equal(api.stats().debris, 34);
  const death = api.sample(.1).a; assert.equal(death[2 * 18 + 10], 0, 'actual body hidden after destruction');
  f.evaluate('debrisPieces.forEach(p=>{p.mesh.position.x+=2;p.mesh.rotation.z+=.3})'); f.tick(); api.stop();
  const state = JSON.stringify(p.state), source = p.debrisGroup.children.map(n => n.position.toArray());
  api.play(); api.pause(); api.seek(.1);
  const replay = p.scene.getObjectByName('temporary-replay-debris'); assert.equal(replay.children.filter(n => n.visible).length, 34);
  assert.deepEqual(replay.children[0].position.toArray(), death.slice(api.stats().baseCount * 18, api.stats().baseCount * 18 + 3));
  assert.equal(p.debrisGroup.visible, false); assert.equal(p.carMeshGroup.visible, false); api.seek(0); assert.ok(replay.children.every(n => !n.visible));
  api.exit(); assert.equal(JSON.stringify(p.state), state); assert.deepEqual(p.debrisGroup.children.map(n => n.position.toArray()), source);
  assert.equal(f.ids.get('modal-destroyed').classList.contains('hidden'), false);
  api.clear(); assert.equal(replay.children.length, 0); assert.equal(api.stats().debris, 0);
});
test('pause, seek, speed, loop and free pointer / keyboard / phone dolly controls are presentation only', () => {
  const f = fixture('coast', 20), api = f.api, p = f.parts; api.record(); f.tick(); p.playerWrapper.position.y = 5; f.tick(); api.stop(); api.play(); api.pause();
  const pose = p.playerWrapper.position.toArray(), state = JSON.stringify(p.state); api.frame(.05); assert.equal(api.stats().playhead, 0); assert.deepEqual(p.playerWrapper.position.toArray(), pose);
  f.ids.get('replay-speed').emit('change', { target: { value: '2' } }); api.play(); api.frame(.02); assert.equal(api.stats().playhead, .04);
  f.ids.get('replay-loop').emit('change', { target: { checked: true } }); api.frame(.1); assert.equal(api.stats().mode, 'playing'); assert.ok(api.stats().playhead < api.stats().duration);
  api.pause(); f.ids.get('replay-camera').emit('change', { target: { value: 'free' } }); api.frame(0); const before = p.camera.position.clone();
  f.window.emit('keydown', { code: 'KeyW', target: new Dom() }); api.frame(.05); assert.ok(before.distanceTo(p.camera.position) > .1);
  f.canvas.emit('pointerdown', { pointerId: 2, clientX: 10, clientY: 10 }); f.canvas.emit('pointermove', { pointerId: 2, clientX: 70, clientY: 30 }); api.frame(0); assert.equal(api.stats().cameraMode, 'free');
  const near = p.camera.position.clone(); f.ids.get('replay-near').emit('click'); api.frame(0); assert.ok(near.distanceTo(p.camera.position) > 1);
  for (const cameraMode of ['chase', 'front', 'ground']) { f.ids.get('replay-camera').emit('change', { target: { value: cameraMode } }); api.frame(0); assert.ok(p.camera.position.y >= .12); assert.equal(api.stats().cameraMode, cameraMode); }
  assert.equal(JSON.stringify(p.state), state);
});
test('background stops recording / pauses replay; pagehide and BFCache pageshow release every clip reference', () => {
  const f = fixture(), api = f.api; api.record(); f.tick(); f.document.hidden = true; f.document.emit('visibilitychange'); assert.equal(api.stats().mode, 'drive'); assert.ok(api.stats().frames > 0);
  f.document.hidden = false; api.play(); f.document.hidden = true; f.document.emit('visibilitychange'); assert.equal(api.stats().mode, 'paused');
  f.window.emit('pagehide', { persisted: true }); assert.equal(api.stats().frames, 0); assert.equal(api.stats().bytes, 0); assert.equal(api.stats().bindings, 0); assert.equal(api.stats().checkpoint, false);
  f.window.emit('pageshow', { persisted: true }); assert.equal(api.stats().frames, 0); assert.equal(api.stats().mode, 'drive');
  f.document.hidden = false; api.record(); f.tick(); api.stop(); f.window.emit('pagehide', { persisted: false }); assert.equal(api.stats().frames, 0);
});
test('repeat record / play / clear cycles do not accumulate buffers or source/generated bindings', () => {
  const f = fixture(), api = f.api; const counts = [];
  for (let i = 0; i < 5; i++) { api.record(); f.tick(); api.stop(); counts.push(api.stats().bytes); api.play(); api.pause(); api.exit(); api.clear(); assert.equal(api.stats().bindings, 0); assert.equal(api.stats().bytes, 0); }
  assert.ok(counts.every(n => n === counts[0]));
});
test('menus cannot trap playback, and replacing traffic with the same count is refused without stale live bindings', () => {
  const f = fixture(), api = f.api;
  f.ids.get('modal-map-select').classList.remove('hidden'); assert.equal(api.record(), false);
  f.ids.get('modal-map-select').classList.add('hidden'); api.record(); f.tick(); api.stop();
  f.ids.get('modal-help').classList.remove('hidden'); assert.equal(api.play(), false); assert.equal(api.stats().mode, 'drive');
  f.ids.get('modal-help').classList.add('hidden'); f.evaluate('populateTraffic(52)');
  assert.equal(api.play(), false); assert.equal(api.stats().checkpoint, false); assert.match(f.ids.get('replay-status').textContent, /Scene changed/);
});
test('actual adapter automatically stops visibly at its buffer limit and retains its initial samples', () => {
  const f = fixture(), api = f.api; api.record(); const initial = api.sample(0).a;
  for (let i = 0; i < 6100 && api.stats().mode === 'recording'; i++) f.tick();
  const s = api.stats(); assert.equal(s.mode, 'drive'); assert.equal(s.reason, 'memory'); assert.ok(s.bytes <= 32 * 1024 * 1024); assert.ok(s.duration > 1);
  assert.deepEqual(api.sample(0).a, initial); assert.match(f.ids.get('replay-status').textContent, /limit reached/);
});
test('production animate bypasses every simulation / rank / taxi side effect throughout playback and pause', () => {
  const f = fixture(), api = f.api; api.record(); f.tick(); api.stop();
  let ranked = 0, taxi = 0, scheduled = 0;
  f.c.requestAnimationFrame = () => scheduled++;
  f.window.RoadsterRanked = { tick: () => ranked++, isActive: () => false }; f.window.RoadsterTaxi = { tick: () => taxi++, present: () => taxi++ };
  api.play(); for (let i = 0; i < 5; i++) f.c.animate(1050 + i * 10); api.pause(); f.c.animate(1200);
  f.c.updateSimulation(.05); assert.deepEqual([f.simulations, ranked, taxi], [0, 0, 0]); assert.equal(scheduled, 6); assert.ok(f.renders >= 6);
});
test('real ranked controller rejects replay-time start and submit, and independent tick cannot advance a run', async () => {
  const h = lifecycleHarness(); h.window.RoadsterReplay = { isBusy: () => true, isActive: () => true }; await h.start(); assert.equal(h.requests('/api/run').length, 0);
  h.window.RoadsterReplay = null; await h.start(); h.state.distanceBySpeed = [100, 0, 0, 0, 0, 0]; h.advance(60000); assert.equal(h.phase(), 'complete');
  h.window.RoadsterReplay = { isBusy: () => true, isActive: () => true }; await h.click('ranked-submit'); h.advance(60000); assert.equal(h.requests('/api/score').length, 0); assert.equal(h.phase(), 'complete');
});
test('implementation is RAM-only, labels cinematic limits and is bundled in the required lifecycle order', () => {
  for (const s of [core, adapter]) assert.doesNotMatch(s, /\b(?:fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB|createObjectURL|sendBeacon)\s*[.(]/);
  assert.match(adapter, /Explosion fire\/smoke, rain, audio/); assert.match(adapter, /pagehide/); assert.match(adapter, /e\.persisted/);
  assert.ok(html.indexOf('src="replay.js"') > html.indexOf('src="physics-main.js"')); assert.ok(html.indexOf('src="replay.js"') < html.indexOf('src="render-health.js"'));
  assert.match(adapter, /const runFrame = animate/); assert.match(adapter, /if \(!active\(\)\) return runFrame/);
  for (const declaration of ['function tick(now = performance.now())', 'async function start()', 'async function submit()']) {
    const s = read('src/leaderboard.js'); const i = s.indexOf(declaration); assert.match(s.slice(i, i + 170), /RoadsterReplay\?\.is(?:Active|Busy)/);
  }
});
