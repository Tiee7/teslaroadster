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
  constructor(id = '') { this.id = id; this.listeners = {}; this.hidden = false; this.value = ''; this.dataset = {}; this.style = { setProperty() {} }; this.classes = new Set(['hidden']); this.classList = { add: x => this.classes.add(x), remove: x => this.classes.delete(x), contains: x => this.classes.has(x), toggle: (x, yes) => yes ? this.classes.add(x) : this.classes.delete(x) }; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  emit(type, extra = {}) { const e = { target: this, preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; }, ...extra }; for (const fn of this.listeners[type] || []) { fn(e); if (e.stopped) break; } return e; }
  dispatchEvent(event) { return this.emit(event.type || 'change', event); }
  closest() { return null; }
  getContext() { return { fillRect() {}, fillText() {} }; }
  setPointerCapture() {}
  setAttribute() {}
  showModal() { this.open = true; }
  close() { this.open = false; }
}
function fixture(map = 'highway', count = 52, { autopilot = false, adapterSource = adapter } = {}) {
  const ids = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => [id, new Dom(id)]));
  const document = new Dom(), window = new Dom(), canvas = new Dom(); document.body = new Dom(); document.hidden = false;
  document.getElementById = id => ids.get(id); document.createElement = () => new Dom();
  window.innerWidth = 1280; window.innerHeight = 850; window.confirm = () => true;
  let renders = 0, inputs = 0, simulations = 0, now = 1000;
  const c = vm.createContext({ window, document, console, keys: {}, Event: class {}, atob: t => Buffer.from(t, 'base64').toString('binary'),
    localStorage: { getItem: () => null, setItem() { throw Error('Unexpected persistence'); } }, performance: { now: () => now },
    fetch() { throw Error('Unexpected network'); }, indexedDB: { open() { throw Error('Unexpected persistence'); } },
    sound: { update() {}, playCrash() {}, beep() {}, playAirBrakeServo() {}, playMilestoneChime() {}, playSonicBoom() {}, playThunder() {}, speakAlert() {} }, clearAllInputKeys() { inputs++; for (const key of Object.keys(c.keys)) c.keys[key] = false; }, resetChaseCamera() {}, showBanner() {},
    renderBannerText() {}, updateCockpitHudScreen() {}, updateSpeedAndWeatherOverlay() {}, updateWindshieldRain() {}, renderer: { domElement: canvas, render() { renders++; } }, lastTime: 0,
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
  if (autopilot) {
    // Execute the actual production physics owner, not the lightweight counter
    // used by the presentation-only cases above. Keep the requested NPC count.
    vm.runInContext(physics.slice(physics.indexOf('function wrapAnglePi('), physics.indexOf('// Scope the fixed clock')), c);
    c.lastTime = now;
    // Explicit safe, populated highway witness, not a default-spawn survival
    // claim: every native NPC remains present and is advanced by real physics.
    vm.runInContext(`trafficCars.forEach((car,i)=>{car.mesh.position.set(LANE_CENTERS[i%6],0,-90-35*Math.floor(i/6));car.mesh.rotation.set(0,0,0);car.mesh.visible=true;car.speed=30;car.vz=-30;car.vx=0;car.y=0;car.blastTimer=0;car.laneChange=null;delete car.highwayWaitingToSpawn;});`, c);
    window.RoadsterRanked = { tick() {}, render() {}, abort() {}, isActive: () => false, isDialogOpen: () => false, prepareForDemo: async () => {} };
    vm.runInContext(read('src/demo-numeric-projection.js') + '\n' + read('src/highway-demo.js'), c);
  }
  vm.runInContext(core + '\n' + adapterSource, c);
  const api = window.RoadsterReplay, parts = c.parts;
  function tick(dt = .05) { now += dt * 1000; api.afterTick(dt); }
  function frame(dt = 1 / 60) { now += dt * 1000; c.animate(now); }
  function elapse(seconds) { now += seconds * 1000; }
  return { c, api, parts, window, document, canvas, ids, tick, frame, elapse, evaluate: s => vm.runInContext(s, c), get renders() { return renders; }, get inputs() { return inputs; }, get simulations() { return simulations; } };
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

const plain = value => JSON.parse(JSON.stringify(value));
const flushAutopilot = () => new Promise(resolve => setImmediate(resolve));
async function clickAutopilot(f) {
  const button = f.ids.get('btn-highway-demo');
  button.closest = selector => selector === 'button' ? button : null;
  const event = f.document.emit('click', { target: button });
  if (!event.stopped) button.emit('click');
  await flushAutopilot();
  return event;
}
function assertVehicleSample(f, sample) {
  const nodes = [f.parts.playerWrapper, f.parts.roadsterAttitudeGroup, f.parts.carMeshGroup, ...f.parts.trafficCars.map(car => car.mesh)];
  for (let i = 0; i < nodes.length; i++) {
    assert.deepEqual(plain(nodes[i].position.toArray()), plain(sample.slice(i * 18, i * 18 + 3)), `vehicle binding ${i} position`);
    assert.deepEqual(plain(nodes[i].quaternion.toArray()), plain(sample.slice(i * 18 + 3, i * 18 + 7)), `vehicle binding ${i} attitude`);
    assert.deepEqual(plain(nodes[i].scale.toArray()), plain(sample.slice(i * 18 + 7, i * 18 + 10)), `vehicle binding ${i} scale`);
    assert.equal(Number(nodes[i].visible), sample[i * 18 + 10], `vehicle binding ${i} visibility`);
  }
}
function assertPostPhysicsCapture(f) {
  const sample = f.api.sample(f.api.stats().duration).a;
  const nodes = [f.parts.playerWrapper, f.parts.roadsterAttitudeGroup, f.parts.carMeshGroup, ...f.parts.trafficCars.map(car => car.mesh)];
  nodes.forEach((node, i) => {
    assert.deepEqual(plain(sample.slice(i * 18, i * 18 + 3)), plain(node.position.toArray().map(Math.fround)), `post-physics binding ${i} position`);
    assert.deepEqual(plain(sample.slice(i * 18 + 3, i * 18 + 7)), plain(node.quaternion.toArray().map(Math.fround)), `post-physics binding ${i} attitude`);
  });
  assert.equal(sample[nodes.length * 18 + 17], Math.fround(f.parts.wheels[0].rotation.x), 'actual wheel phase, not input-derived approximation');
}
test('autopilot already active: record real post-physics vehicle/traffic/attitude state, never replay driver inputs', async () => {
  const f = fixture('highway', 52, { autopilot: true }), api = f.api, demo = f.window.RoadsterDemo;
  await demo.toggle(); assert.equal(demo.isActive(), true);
  assert.equal(api.record(), true, 'an active autopilot must be recordable');
  const initial = api.sample(0).a, initialSpeed = f.parts.state.speed;
  for (let i = 0; i < 12; i++) { const count = api.stats().frames; f.frame(); if (api.stats().frames > count) assertPostPhysicsCapture(f); }
  api.stop(); assert.ok(api.stats().duration > 0); assert.equal(api.stats().vehicles, 53);
  assert.ok(demo.clockStats().steps >= 12, 'actual production autopilot fixed clock ran');
  assert.ok(demo.input().throttle > 0); assert.notEqual(f.parts.state.speed, initialSpeed);
  assert.equal(f.evaluate('Object.values(keys).some(Boolean)'), false, 'autopilot actually drove with no keyboard recording');
  const end = api.sample(api.stats().duration).a;
  assert.equal(end.length, initial.length, 'manual and autopilot use the same complete sample fields');
  assert.notDeepEqual(plain(end.slice(0, 55 * 18)), plain(initial.slice(0, 55 * 18)), 'real physics moved the player/traffic without recorded keyboard input');
  for (let i = 0; i < 3; i++) f.frame();
  f.frame(1 / 120); assert.ok(demo.clockStats().accumulator > 0, 'retain a genuine pre-entry fractional clock accumulator');
  const liveState = JSON.stringify(f.parts.state), livePose = plain([f.parts.playerWrapper.position.toArray(), f.parts.trafficCars.map(car => car.mesh.position.toArray())]);
  const liveClock = plain(demo.clockStats()), liveInput = plain(demo.input());
  assert.equal(api.play(), true); api.pause(); api.seek(api.stats().duration); assertVehicleSample(f, end);
  for (let i = 0; i < 40; i++) f.frame(.1);
  // Public entry points cannot bypass playback isolation either.
  demo.step(.1); demo.advanceFrame(.1, f.c.updateSimulation); await demo.toggle();
  assert.equal(JSON.stringify(f.parts.state), liveState); assert.deepEqual(plain(demo.clockStats()), liveClock); assert.deepEqual(plain(demo.input()), liveInput); assert.equal(demo.isActive(), true);
  api.exit(); assert.deepEqual(plain([f.parts.playerWrapper.position.toArray(), f.parts.trafficCars.map(car => car.mesh.position.toArray())]), livePose);
  assert.deepEqual(plain(demo.clockStats()), liveClock);
  f.frame(); assert.equal(demo.isActive(), true); assert.equal(demo.clockStats().steps, liveClock.steps + 1, 'no replay wall-time debt or planner restart on return');
});
test('autopilot UI can switch manual/auto/manual/auto during one recording without replacing its population or fields', async () => {
  const f = fixture('highway', 52, { autopilot: true }), api = f.api, demo = f.window.RoadsterDemo;
  assert.equal(api.record(), true); const population = f.parts.trafficCars, size = api.sample(0).a.length;
  for (let i = 0; i < 3; i++) f.frame();
  assert.notEqual((await clickAutopilot(f)).prevented, true); assert.equal(demo.isActive(), true);
  for (let i = 0; i < 6; i++) f.frame();
  assert.notEqual((await clickAutopilot(f)).prevented, true); assert.equal(demo.isBusy(), false);
  for (let i = 0; i < 3; i++) f.frame();
  await clickAutopilot(f); assert.equal(demo.isActive(), true); for (let i = 0; i < 6; i++) f.frame();
  assert.equal(api.stats().mode, 'recording'); assert.equal(f.parts.trafficCars, population); api.stop();
  const end = api.sample(api.stats().duration).a; assert.equal(end.length, size);
  assert.equal(api.play(), true); api.pause(); api.seek(api.stats().duration); assertVehicleSample(f, end);
  assert.equal((await clickAutopilot(f)).prevented, true, 'switching is blocked only during actual playback');
  assert.equal(demo.isActive(), true); api.exit();
});
test('autopilot pending preparation cannot race into record/playback; cancellation cannot late-start it', async () => {
  const f = fixture('highway', 52, { autopilot: true }), api = f.api, demo = f.window.RoadsterDemo;
  api.record(); f.tick(); api.stop(); let finishPreparation;
  f.window.RoadsterRanked.prepareForDemo = () => new Promise(resolve => { finishPreparation = resolve; });
  const pending = demo.toggle(); assert.equal(demo.isBusy(), true); assert.equal(demo.isActive(), false);
  assert.equal(api.record(), false); assert.equal(api.play(), false);
  demo.stop(); finishPreparation(); await pending; assert.equal(demo.isBusy(), false);
  assert.equal(api.play(), true); api.pause(); const blocked = demo.toggle(); assert.equal(demo.isBusy(), false, 'playback cannot start a new async preparation'); await blocked; api.exit();
});
test('autopilot slow replacement confirmation accepts/cancels without overload and never resets its private clock', async () => {
  for (const accept of [false, true]) {
    const f = fixture('highway', 52, { autopilot: true }), api = f.api, demo = f.window.RoadsterDemo;
    await demo.toggle(); api.record(); f.frame(); f.frame(); f.frame(); api.stop();
    const before = plain(demo.clockStats()); f.window.confirm = () => { f.elapse(2); return accept; };
    assert.equal(api.record(), accept); assert.deepEqual(plain(demo.clockStats()), before);
    f.frame(); assert.equal(demo.isActive(), true, 'the confirmation modal must not cause a wall-time overload stop'); assert.equal(demo.clockStats().steps, before.steps + 1);
  }
});
test('autopilot preparation begun inside recording stays captured and must settle before playback entry', async () => {
  const f = fixture('highway', 52, { autopilot: true }), api = f.api, demo = f.window.RoadsterDemo;
  api.record(); for (let i = 0; i < 3; i++) f.frame(); let release;
  f.window.RoadsterRanked.prepareForDemo = () => new Promise(resolve => { release = resolve; });
  await clickAutopilot(f); assert.equal(demo.isBusy(), true); assert.equal(demo.isActive(), false);
  for (let i = 0; i < 3; i++) f.frame(); assert.equal(api.stats().mode, 'recording'); api.stop();
  assert.equal(api.play(), false); release(); await flushAutopilot(); assert.equal(demo.isActive(), true);
  const state = JSON.stringify(f.parts.state), clock = plain(demo.clockStats());
  assert.equal(api.play(), true); assert.match(f.ids.get('replay-status').textContent, /autopilot.*frozen/);
  f.frame(.1); assert.equal(JSON.stringify(f.parts.state), state); assert.deepEqual(plain(demo.clockStats()), clock); api.exit();
});
test('autopilot airborne live checkpoint is preserved; blur safety cancellation is never silently re-armed', async () => {
  const f = fixture('highway', 52, { autopilot: true }), api = f.api, demo = f.window.RoadsterDemo;
  await demo.toggle(); api.record(); for (let i = 0; i < 3; i++) f.frame();
  // Explicit airborne witness after normal activation, not a claim that this
  // fixture proves a planner-generated jump or a default-spawn journey.
  f.evaluate('state.y=3;state.vy=-2;state.pitch=-.2;state.roll=.35;state.wasAirborne=true;');
  for (let i = 0; i < 6; i++) f.frame(); api.stop(); assert.equal(demo.isActive(), true); assert.ok(f.parts.state.y > .15);
  const state = JSON.stringify(f.parts.state), pose = plain([f.parts.playerWrapper.position.toArray(), f.parts.roadsterAttitudeGroup.quaternion.toArray()]), clock = plain(demo.clockStats());
  assert.equal(api.play(), true); api.pause(); api.seek(0); f.frame(.1); api.exit();
  assert.equal(JSON.stringify(f.parts.state), state); assert.deepEqual(plain([f.parts.playerWrapper.position.toArray(), f.parts.roadsterAttitudeGroup.quaternion.toArray()]), pose); assert.deepEqual(plain(demo.clockStats()), clock); assert.equal(demo.isActive(), true);
  api.play(); f.window.emit('blur'); assert.equal(api.stats().mode, 'paused'); assert.equal(demo.isBusy(), false);
  assert.equal(f.ids.get('btn-highway-demo').textContent, 'Autopilot', 'existing UI reports that safety stopped the owner');
  api.exit(); assert.equal(demo.isBusy(), false, 'never call toggle to re-arm an airborne/background-stopped driver'); assert.equal(JSON.stringify(f.parts.state), state);
});
test('autopilot collision/debris and normal performance-stop transitions keep the recording valid', async () => {
  const crash = fixture('highway', 52, { autopilot: true }); await crash.window.RoadsterDemo.toggle(); crash.api.record(); for (let i = 0; i < 3; i++) crash.frame();
  crash.evaluate("triggerPhysicsCollision(30,'crashReasonThreshold',0,0,0)"); crash.frame();
  assert.equal(crash.window.RoadsterDemo.isBusy(), false); assert.equal(crash.api.stats().mode, 'recording'); assert.equal(crash.api.stats().debris, 34); crash.api.stop();
  const state = JSON.stringify(crash.parts.state); assert.equal(crash.api.play(), true); crash.api.pause(); crash.api.seek(crash.api.stats().duration);
  assert.equal(crash.parts.scene.getObjectByName('temporary-replay-debris').children.filter(n => n.visible).length, 34); crash.api.exit(); assert.equal(JSON.stringify(crash.parts.state), state); assert.equal(crash.window.RoadsterDemo.isBusy(), false);
  const slow = fixture('highway', 52, { autopilot: true }); await slow.window.RoadsterDemo.toggle(); slow.api.record(); for (let i = 0; i < 3; i++) slow.frame();
  slow.frame(.2); assert.equal(slow.window.RoadsterDemo.isBusy(), false); assert.equal(slow.api.stats().mode, 'recording'); slow.frame(); slow.api.stop(); assert.ok(slow.api.stats().duration > 0); assert.equal(slow.api.play(), true); slow.api.exit();
});

function cameraChoice(f, value) { const select = f.ids.get('replay-camera'); select.value = value; select.emit('change'); }
function nearVector(actual, expected, message) { assert.ok(actual.distanceTo(expected) < 1e-8, message + ': ' + actual.toArray() + ' / ' + expected.toArray()); }
test('replay camera successor: low right-front-door mount is rigid in all maps/models, outside the native body and independent of zoom', () => {
  for (const map of ['highway', 'city', 'coast']) for (const model of ['reference', 'classic']) {
    const f = fixture(map), p = f.parts, T = f.c.THREE, api = f.api;
    f.window.RoadsterVehicle.setModel(model); api.record();
    p.playerWrapper.position.set(14, 8, -32); p.roadsterAttitudeGroup.rotation.set(.22, 1.1, -.18); p.carMeshGroup.rotation.set(.03, 0, .02); f.tick(); api.stop();
    api.play(); api.pause(); cameraChoice(f, 'ground'); api.seek(.05); p.scene.updateMatrixWorld(true);
    const expected = new T.Vector3(1.3, .42, -.35).applyMatrix4(p.carMeshGroup.matrixWorld);
    nearVector(p.camera.position, expected, map + '/' + model + ' door mount');
    nearVector(p.camera.up, new T.Vector3(0, 1, 0).transformDirection(p.carMeshGroup.matrixWorld), 'full roll/pitch inherited');
    assert.equal(p.camera.near, .06);
    const ray = new T.Raycaster(p.camera.position, p.camera.getWorldDirection(new T.Vector3()), 0, .08);
    const visible = node => { for (let n = node; n; n = n.parent) if (!n.visible) return false; return true; };
    assert.equal(ray.intersectObject(p.playerWrapper, true).filter(hit => visible(hit.object)).length, 0, 'lens/near interval is not inside the actual model');
    f.ids.get('replay-near').emit('click'); api.seek(.05); nearVector(p.camera.position, expected, 'not a variable-distance chase'); api.exit();
  }
});
test('replay camera successor: NPC door clearance uses its preserved near/far bounds, terrain is a safety floor', () => {
  const f = fixture('coast'), p = f.parts, T = f.c.THREE, api = f.api; api.record(); p.trafficCars[0].mesh.position.set(0, 8, 0); p.trafficCars[0].mesh.rotation.set(.1, .7, -.2); f.tick(); api.stop(); api.play(); api.pause();
  const target = f.ids.get('replay-target'); target.value = '1'; target.emit('change'); cameraChoice(f, 'ground'); api.seek(.05); p.scene.updateMatrixWorld(true);
  const bounds = f.window.RoadsterTrafficAssets.cityContactBounds(p.trafficCars[0].mesh), local = p.trafficCars[0].mesh.worldToLocal(p.camera.position.clone());
  assert.ok(local.x >= bounds.maxX + .24, 'outside every preserved LOD, not a fixed sedan width'); assert.ok(local.z < 0);
  target.value = '0'; target.emit('change'); p.playerWrapper.position.y = -10; api.clear(); api.record(); f.tick(); api.stop(); api.play(); api.pause(); cameraChoice(f, 'ground'); api.seek(0);
  const floor = f.window.RoadsterCoast.surface(p.camera.position.x, p.camera.position.z).height;
  assert.ok(p.camera.position.y >= floor + .119999, 'do not bury lens in terrain; rigid mount has an explicit clearance exception');
});
test('replay camera successor: landing fixed point never translates across seek, target, playback speed, loop or zoom', () => {
  const f = fixture(), p = f.parts, T = f.c.THREE, api = f.api; api.record(); p.playerWrapper.position.set(0, 15, -30); f.tick(); p.playerWrapper.position.set(4, 0, -75); f.tick(); api.stop(); api.play(); api.pause(); api.seek(.1); cameraChoice(f, 'fixed');
  const point = p.camera.position.clone(); api.seek(0); nearVector(p.camera.position, point, 'world point survives rewind to the approach');
  const desired = p.playerWrapper.position.clone().add(new T.Vector3(0, .65, 0)).sub(point).normalize(); nearVector(p.camera.getWorldDirection(new T.Vector3()), desired, 'only direction tracks');
  f.ids.get('replay-far').emit('click'); api.frame(0); nearVector(p.camera.position, point, 'zoom cannot move fixed camera');
  const target = f.ids.get('replay-target'); target.value = '1'; target.emit('change'); api.seek(.05); nearVector(p.camera.position, point, 'target switch cannot move point');
  f.ids.get('replay-speed').value = '2'; f.ids.get('replay-speed').emit('change'); f.ids.get('replay-loop').checked = true; f.ids.get('replay-loop').emit('change'); api.play(); for (let i = 0; i < 4; i++) api.frame(.1); nearVector(p.camera.position, point, 'loop cannot move point');
  api.pause(); cameraChoice(f, 'free'); f.canvas.emit('wheel', { deltaY: -1 }); api.frame(0); const adjusted = p.camera.position.clone(); f.ids.get('replay-fixed-here').emit('click'); assert.equal(api.stats().cameraMode, 'fixed'); api.seek(0); nearVector(p.camera.position, adjusted, 'explicit free-view placement captured'); api.clear(); assert.equal(api.stats().fixedPoint, null);
});
test('replay camera successor: real cockpit pose, view visibility and replay-only instruments restore across every model/cabin combination', () => {
  for (const model of ['reference', 'classic']) for (const cockpit of ['reference', 'classic']) {
    const f = fixture(), p = f.parts, T = f.c.THREE, api = f.api; f.window.RoadsterVehicle.setModel(model); f.window.RoadsterVehicle.setCockpit(cockpit);
    f.evaluate('cameraModeIndex=3;setCockpitPerspective(true);setCockpitExteriorDetailsVisible(false);');
    const originalMap = f.evaluate('cockpitHudTexture'), live = f.evaluate('[yokeWheelGroup.position.toArray(),yokeWheelGroup.scale.toArray()]'); const visible = []; p.playerWrapper.traverse(n => visible.push([n, n.visible]));
    api.record(); p.playerWrapper.position.set(8, 7, 12); p.roadsterAttitudeGroup.rotation.set(.24, -.8, .21); p.wheels[0].rotation.x = -7; f.tick(); api.stop(); const state = JSON.stringify(p.state);
    api.play(); api.pause(); const target = f.ids.get('replay-target'); target.value = '1'; target.emit('change'); cameraChoice(f, 'cockpit'); api.seek(.05); p.scene.updateMatrixWorld(true);
    nearVector(p.camera.position, new T.Vector3(0, 1.04, -.15).applyMatrix4(p.roadsterAttitudeGroup.matrixWorld), 'same calibrated eye as real driving');
    nearVector(p.camera.getWorldDirection(new T.Vector3()), new T.Vector3(0, -.04, -1).transformDirection(p.roadsterAttitudeGroup.matrixWorld), 'six-DOF cabin forward');
    assert.equal(target.value, '0'); assert.equal(target.disabled, true); assert.equal(f.evaluate('cockpitPerspectiveActive'), true); assert.equal(f.evaluate('roadsterCanopyMesh.visible'), false);
    assert.notEqual(f.evaluate('screenDisplay.material.map'), originalMap, 'do not misrepresent frozen live telemetry as recorded telemetry');
    cameraChoice(f, 'ground'); api.seek(.05); assert.equal(f.evaluate('cockpitPerspectiveActive'), false); assert.equal(f.evaluate('screenDisplay.material.map'), originalMap);
    cameraChoice(f, 'cockpit'); api.seek(0); const texture = f.evaluate('screenDisplay.material.map'); let disposed = 0; texture.addEventListener('dispose', () => disposed++); api.exit(); assert.equal(f.evaluate('screenDisplay.material.map'), originalMap); assert.deepEqual(f.evaluate('[yokeWheelGroup.position.toArray(),yokeWheelGroup.scale.toArray()]'), live); assert.ok(visible.every(([n, v]) => n.visible === v)); assert.equal(JSON.stringify(p.state), state); f.window.emit('pagehide'); assert.equal(disposed, 1); assert.equal(api.stats().frames, 0); assert.equal(f.evaluate('screenDisplay.material.map'), originalMap);
  }
});
test('replay camera successor: existing live C cockpit shortcut remains reachable outside playback and blocked during it', () => {
  const f = fixture(), hud = read('src/ui-hud.js'); f.c.Element = Dom; f.c.applyTranslations = () => {}; f.evaluate(hud.slice(hud.indexOf("window.addEventListener('keydown', (e)"), hud.indexOf("window.addEventListener('keyup', (e)")));
  f.window.emit('keydown', { code: 'KeyC', target: { closest: () => null } }); assert.equal(f.evaluate('cameraModeIndex'), 3);
  f.api.record(); f.tick(); f.api.stop(); f.api.play(); f.api.pause(); f.window.emit('keydown', { code: 'KeyC', target: { closest: () => null } }); assert.equal(f.evaluate('cameraModeIndex'), 3); f.api.exit();
  f.window.emit('keydown', { code: 'KeyC', target: { closest: () => null } }); assert.equal(f.evaluate('cameraModeIndex'), 0);
});
test('replay camera successor: highway fixed point stays roadside through actual 840m wraps, forward/reverse, seek and camera switches', () => {
  const f = fixture(), p = f.parts, api = f.api; p.scrollingProps[0].position.z = 419; api.record();
  for (const z of [-419, -409, -419, 419, 409]) { p.scrollingProps[0].position.z = z; f.tick(); } api.stop(); api.play(); api.pause(); api.seek(.1); cameraChoice(f, 'fixed');
  const roadIndex = f.evaluate('scrollingProps[0]'), lock = api.stats().fixedPoint.slice(), initialCamera = p.camera.position.z;
  const scroll = t => { const sample = api.sample(t); return sample.a[(api.stats().baseCount - 1) * 18 + 17] + (sample.b[(api.stats().baseCount - 1) * 18 + 17] - sample.a[(api.stats().baseCount - 1) * 18 + 17]) * sample.alpha; };
  for (const t of [0, .05, .075, .1, .15, .2, .25, 0]) { api.seek(t); assert.ok(Math.abs(p.camera.position.z - scroll(t) - lock[2]) < 1e-8, 'world roadside point, not render-origin point'); }
  api.seek(.05); assert.notEqual(p.camera.position.z, initialCamera, 'highway render coordinate must compensate road motion'); assert.ok(Math.abs(roadIndex.position.z + 419) < 1e-8);
  cameraChoice(f, 'front'); cameraChoice(f, 'fixed'); assert.deepEqual(api.stats().fixedPoint, lock); assert.ok(Math.abs(p.camera.position.z - scroll(.05) - lock[2]) < 1e-8);
  const aux = time => api.sample(time).a[(api.stats().baseCount - 1) * 18 + 17]; assert.equal(aux(.05), 2); assert.equal(aux(.1), 12); assert.equal(aux(.2), 0); assert.equal(aux(.25), -10);
});
test('replay camera successor: unsupported highway-origin data cannot pretend to be fixed and replaced road owners stop recording safely', () => {
  const f = fixture('highway', 52, { adapterSource: adapter.replace('roadScrollVersion: 1', 'roadScrollVersion: 0') }); f.api.record(); f.tick(); f.api.stop(); f.api.play(); f.api.pause(); cameraChoice(f, 'fixed'); assert.equal(f.api.stats().cameraMode, 'free'); assert.match(f.ids.get('replay-status').textContent, /no verified highway/); f.ids.get('replay-fixed-here').emit('click'); assert.equal(f.api.stats().fixedPoint, null);
  const g = fixture(); g.api.record(); g.tick(); const initial = g.api.sample(0).a; g.parts.scrollingProps[0] = new g.c.THREE.Group(); g.tick(); assert.equal(g.api.stats().mode, 'drive'); assert.deepEqual(g.api.sample(0).a, initial); assert.match(g.ids.get('replay-status').textContent, /Scene changed/); g.api.clear(); assert.equal(g.api.stats().fixedPoint, null);
});
test('replay camera successor: shader incompatibility discovered during replay cannot be undone by historical lamp samples or live checkpoint restoration', () => {
  const f = fixture(), { api } = f, ui = read('src/ui-hud.js'); f.evaluate('const roadMat=new THREE.MeshStandardMaterial(),cityAsphaltMat=roadMat.clone(),cityAsphaltEWMat=roadMat.clone();' + ui.slice(ui.indexOf('function syncVehicleWeatherLights('), ui.indexOf('function cycleWeatherMode(')) + read('src/headlight-projection.js'));
  f.window.RoadsterWeatherLights.sync(); api.record(); f.tick(); api.stop(); api.play(); api.pause();
  f.evaluate("roadMat.onBeforeCompile({fragmentShader:'missing lights include'},{});");
  for (const time of [0, .05, 0]) { api.seek(time); api.frame(0); assert.equal(f.evaluate('headlightSpotL.intensity'), 0); assert.equal(f.evaluate('headlightSpotR.visible'), false); }
  api.exit(); assert.equal(f.evaluate('headlightSpotL.intensity'), 0); assert.equal(f.evaluate('headlightSpotR.visible'), false); assert.equal(f.window.RoadsterWeatherLights.status().compatible, false);
});
test('replay camera successor: actual autopilot recording with the production light adapter survives every new view and preserves its live driver clock', async () => {
  const f = fixture('highway', 52, { autopilot: true }), { api, parts: p } = f, ui = read('src/ui-hud.js');
  f.evaluate('const roadMat=new THREE.MeshStandardMaterial(),cityAsphaltMat=roadMat.clone(),cityAsphaltEWMat=roadMat.clone();' + ui.slice(ui.indexOf('function syncVehicleWeatherLights('), ui.indexOf('function cycleWeatherMode(')) + read('src/headlight-projection.js'));
  f.window.RoadsterWeatherLights.sync(); await f.window.RoadsterDemo.toggle(); assert.equal(api.record(), true); for (let i = 0; i < 12; i++) f.frame(); api.stop();
  const physical = JSON.stringify(p.state), clock = JSON.stringify(f.window.RoadsterDemo.clockStats()); assert.equal(api.stats().vehicles, 53); api.play(); api.pause();
  for (const mode of ['ground', 'fixed', 'cockpit', 'free', 'front', 'chase', 'fixed']) { cameraChoice(f, mode); api.seek(api.stats().duration / 2); api.frame(.05); assert.equal(JSON.stringify(p.state), physical); assert.equal(JSON.stringify(f.window.RoadsterDemo.clockStats()), clock); }
  assert.equal(f.window.RoadsterWeatherLights.status().compatible, true); api.exit(); assert.equal(f.window.RoadsterDemo.isActive(), true); assert.equal(JSON.stringify(p.state), physical); assert.equal(JSON.stringify(f.window.RoadsterDemo.clockStats()), clock);
  f.frame(); assert.ok(f.window.RoadsterDemo.clockStats().steps > JSON.parse(clock).steps); f.window.emit('pagehide'); assert.equal(api.stats().frames, 0); assert.equal(f.window.RoadsterDemo.isActive(), false);
});
