import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const read = name => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
const physics = read('physics-main.js'), audio = read('audio.js'), hud = read('ui-hud.js');
const section = (source, from, to) => {
  const start = source.indexOf(from), end = source.indexOf(to, start + from.length);
  assert.ok(start >= 0 && end > start, from);
  return source.slice(start, end);
};
const capture = section(physics, '  // Capture resolved thrust,', '  // The physics, contact, scoring,');
const legacyCall = section(physics, '  const anyAttitude =', '  // Update Live Cockpit Center');
const renderLoop = section(physics, '// Scope the fixed clock', "window.addEventListener('resize'");
const readInput = section(physics, 'function readDriveInput(', 'function readAttitudeInput(');
const clearKeys = section(hud, '// Fix operational bug: clear all keys', '// Dynamic Camera Distance');

class Param {
  constructor() { this.value = 0; this.targets = []; }
  setTargetAtTime(value, time, constant) { this.value = value; this.targets.push({ value, time, constant }); }
}
class Node {
  constructor() { this.gain = new Param(); this.frequency = new Param(); this.Q = new Param(); }
  connect() {} setPeriodicWave(wave) { this.wave = wave; } start() {} stop() {}
}
class AudioContext {
  constructor() { this.sampleRate = 8; this.currentTime = 0; this.state = 'running'; this.destination = {}; this.resumeCalls = 0; }
  createBuffer() { return { getChannelData: () => new Float32Array(16) }; }
  createGain() { return new Node(); } createOscillator() { return new Node(); }
  createBiquadFilter() { return new Node(); } createWaveShaper() { return new Node(); }
  createBufferSource() { return new Node(); } createPeriodicWave(real, imag) { return { real, imag }; }
  resume() { this.resumeCalls++; this.state = 'running'; return Promise.resolve(); }
}

// Execute production animate, clock, input, capture/call sites and the original
// V8 graph. Physics and WebGL scene work are stubs; motion has separate real-path tests.
function harness(map = 'city') {
  const events = {}, overlays = new Set(), calls = [], steps = [], renders = [];
  const on = (name, fn) => (events[name] ||= []).push(fn);
  let now = 0, rankedOpen = false, musicOpen = false, demoActive = false;
  const context = vm.createContext({
    currentMap: map, lastTime: 0, state: { speed: 35, maxSpeed: 100, isDestroyed: false },
    keys: {}, localStorage: { getItem: () => null }, performance: { now: () => now },
    infiniteJetShortcutDown: new Set(), updateAutopilotKeyBadges() {},
    document: { hidden: false, addEventListener: on, getElementById: id => ({ classList: { contains: () => !overlays.has(id) } }) },
    window: { AudioContext, addEventListener: on,
      RoadsterRanked: { tick() {}, isDialogOpen: () => rankedOpen },
      RoadsterMusic: { isSettingsOpen: () => musicOpen },
      RoadsterDemo: { isActive: () => demoActive, isBusy: () => false,
        advanceFrame(seconds, step) { for (let i = 0; i < 3; i++) step(seconds / 3); } },
      RoadsterCoast: { tick() {} }, RoadsterTaxi: { tick() {}, present() {} } },
    trafficCars: [], camera: { position: {} }, scene: {}, requestAnimationFrame() {}, updateDestroyedScores() {},
    renderer: { render() { renders.push(calls.length); } },
  });
  context.setKeyState = (key, value) => { context.keys[key] = value; };
  vm.runInContext(`${audio}\n${read('city-clock.js')}\n${readInput}\n${clearKeys}\n${renderLoop}
    function recordPhysicsSound(presentationDt) {
      const input = readDriveInput();
      const isLiftFiring = input.lift > 0, isRearThrusterFiring = input.boost > 0, rearActive = isRearThrusterFiring, isRetroBrakeFiring = false, isFrontRetroFiring = false;
      const rollInput = 0, pitchInput = 0, yawInput = 0, airJetLeft = false, airJetRight = false, canUseRCS = true;
      const tireScreechIntensity = 0, driveInput = input;
      ${capture}
      if (presentationDt === null) return;
      ${legacyCall}
    }
    sound.init(); globalThis.audio = sound; globalThis.expectedVoice = getRoadsterEngineVoice;
  `, context);
  const originalUpdate = context.audio.update.bind(context.audio);
  context.audio.update = (...args) => { calls.push(args); originalUpdate(...args); };
  context.updateSimulation = (dt, presentationDt) => {
    steps.push(dt);
    if (context.state.isDestroyed) {
      vm.runInContext('if (!cityOwnsDrivingSound() && !coastOwnsDrivingSound()) sound.update(0, false, false, true);', context);
    } else context.recordPhysicsSound(presentationDt);
  };
  return { context, calls, steps, renders, overlays,
    frame(ms) { now += ms; context.audio.ctx.currentTime = now / 1000; context.animate(now); },
    emit(name) { for (const fn of events[name] || []) fn(); },
    pause(kind, value) { if (kind === 'ranked') rankedOpen = value; else if (kind === 'music') musicOpen = value;
      else if (value) overlays.add(kind); else overlays.delete(kind); },
    demo(value) { demoActive = value; },
  };
}
const silent = h => {
  assert.equal(h.context.audio.engineGain.gain.value, 0);
  assert.equal(h.context.audio.thrusterGain.gain.value, 0);
  assert.equal(h.context.audio.screechGain.gain.value, 0);
};

test('V8 pulse-bank waveform remains byte-identical to the original; capture precedes the presentation return', () => {
  const wave = section(audio, 'function createRoadsterV8Wave(', '\nfunction getRoadsterEngineVoice(');
  assert.equal(createHash('sha256').update(wave).digest('hex'), 'eff5640ecbfa2ebb1ee925003968d0fe863ad068395107ad3aaf69ed80f270d9');
  assert.ok(physics.indexOf(capture) < physics.indexOf('  if (!presentFrame) {'));
});
for(const map of ['city','coast']) {
for (const fps of [10, 15, 60, 144]) test(`production ${map} animate+clock updates original V8 once per ${fps} fps render`, () => {
  const h = harness(map); h.context.keys.KeyW = true;
  for (let i = 0; i < fps; i++) h.frame(1000 / fps);
  assert.equal(h.steps.length, 60); assert.equal(h.calls.length, fps); assert.equal(h.renders.length, fps);
  assert.ok(h.renders.every((count, i) => count === i + 1), 'audio update occurs before each render');
  assert.equal(h.context.audio.engineVoice.rpm, h.context.expectedVoice(35 / (200 / 3.6), 1).rpm);
  assert.ok(h.calls.slice(2).every(args => args[5] === 1));
});
test('144 fps zero-tick frames consume fresh throttle release and SFX mute without extra physics', () => {
  const h = harness(map); h.context.keys.KeyW = true;
  for (let i = 0; i < 3; i++) h.frame(1000 / 144);
  assert.equal(h.steps.length, 1); assert.equal(h.context.audio.engineVoice.load, 1);
  h.context.keys.KeyW = false; h.frame(1000 / 144);
  assert.equal(h.steps.length, 1); assert.equal(h.context.audio.engineVoice.load, 0);
  assert.equal(h.context.audio.engineVoice.rpm, h.context.expectedVoice(35 / (200 / 3.6), 0).rpm);
  h.context.audio.enabled = false; h.frame(0); silent(h);
});
for (const event of ['blur', 'hidden']) test(`${event} mutes immediately without RAF or resuming a suspended context`, () => {
  const h = harness(map); h.context.keys.KeyW = h.context.keys.Semicolon = true; h.frame(100);
  assert.ok(h.context.audio.thrusterGain.gain.value > 0);
  h.context.audio.ctx.state = 'suspended';
  if (event === 'hidden') { h.context.document.hidden = true; h.emit('visibilitychange'); } else h.emit('blur');
  silent(h); assert.equal(h.context.audio.ctx.resumeCalls, 0); assert.equal(h.context.keys.Semicolon, false);
  const steps = h.steps.length; h.frame(100); assert.equal(h.steps.length, steps); silent(h);
  if (event === 'hidden') { h.context.document.hidden = false; h.emit('visibilitychange'); } else h.emit('focus');
  h.frame(1); silent(h); assert.equal(h.steps.length, steps);
  h.frame(17); assert.equal(h.context.audio.engineVoice.load, 0); assert.equal(h.context.audio.thrusterGain.gain.value, 0);
});
for (const kind of ['modal-map-select', 'modal-help', 'ranked', 'music']) test(`${kind} pause clears the city sound snapshot and resumes without old boost`, () => {
  const h = harness(map); h.context.keys.Semicolon = true; h.frame(100);
  h.pause(kind, true); const steps = h.steps.length; h.frame(100); silent(h); assert.equal(h.steps.length, steps);
  h.context.keys.Semicolon = false; h.pause(kind, false); h.frame(1); silent(h);
  h.frame(17); assert.equal(h.context.audio.engineVoice.load, 0); assert.equal(h.context.audio.thrusterGain.gain.value, 0);
});
test('suspended frames, reset and destruction never keep the last active city voice', () => {
  const h = harness(map); h.context.keys.Semicolon = true; h.frame(100);
  const steps = h.steps.length; h.frame(1500); assert.equal(h.steps.length, steps); silent(h);
  h.context.keys.Semicolon = false; h.frame(1); silent(h); h.frame(17);
  h.context.keys.Semicolon = true; h.frame(100); h.context.window[map==='city'?'RoadsterCityFrame':'RoadsterCoastFrame'].reset(); silent(h);
  h.frame(1); silent(h);
  h.context.state.isDestroyed = true; h.frame(100); silent(h);
  assert.equal(h.calls.at(-1)[3], true);
});
}
for (const map of ['highway']) test(`${map} retains one legacy sound update per render and no city event mute`, () => {
  const h = harness(map); h.context.keys.KeyW = true;
  for (let i = 0; i < 144; i++) h.frame(1000 / 144);
  assert.equal(h.steps.length, 144); assert.equal(h.calls.length, 144);
  h.emit('blur'); assert.equal(h.calls.length, 144);
});
test('autopilot retains its original substep sound ownership without a second city render update', () => {
  for (const map of ['highway', 'city']) {
    const h = harness(map); h.demo(true); h.frame(100);
    assert.equal(h.steps.length, 3); assert.equal(h.calls.length, 3);
  }
});
