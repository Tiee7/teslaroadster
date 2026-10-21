import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const audioSource = readFileSync(new URL('../src/audio.js', import.meta.url), 'utf8');
const settingsSource = readFileSync(new URL('../src/music.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
const hud = readFileSync(new URL('../src/ui-hud.js', import.meta.url), 'utf8');
const preferenceKey = 'roadster.engineSound.enabled.v1';

class AudioParam {
  constructor() { this.value = 0; this.targets = []; }
  setTargetAtTime(value, time, constant) { this.value = value; this.targets.push({ value, time, constant }); }
  setValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
}
class AudioNode {
  constructor() { this.connections = []; this.gain = new AudioParam(); this.frequency = new AudioParam(); this.Q = new AudioParam(); }
  connect(target) { this.connections.push(target); }
  setPeriodicWave(wave) { this.wave = wave; this.type = 'custom'; }
  start() { this.started = true; }
  stop() { this.stopped = true; }
}
class Element {
  constructor() {
    this.listeners = {}; this.attributes = {}; this.paused = true; this.open = false; this.currentTime = 19;
    this.playCalls = 0; this.pauseCalls = 0; this.classList = { add() {}, remove() {} };
  }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  emit(type, event = {}) { for (const fn of this.listeners[type] || []) fn({ target: this, currentTarget: this, ...event }); }
  setAttribute(key, value) { this.attributes[key] = value; }
  play() { this.playCalls++; this.paused = false; return Promise.resolve(); }
  pause() { this.pauseCalls++; this.paused = true; }
  showModal() { this.open = true; }
  close() { this.open = false; this.emit('close'); }
  focus() { this.focused = true; }
}

function harness({ stored, blockedStorage = false, audioAvailable = true, settings = false } = {}) {
  const contexts = []; const saved = []; const values = new Map(Object.entries(stored || {}));
  class AudioContext {
    constructor() { contexts.push(this); this.sampleRate = 8; this.currentTime = 12; this.destination = {}; this.state = 'running'; this.nodes = []; this.resumeCalls = 0; }
    createBuffer() { return { getChannelData: () => new Float32Array(16) }; }
    createGain() { return this.node(); }
    createOscillator() { return this.node(); }
    createBiquadFilter() { return this.node(); }
    createWaveShaper() { return this.node(); }
    createPeriodicWave(real, imag) { return { real, imag }; }
    createBufferSource() { return this.node(); }
    node() { const node = new AudioNode(); this.nodes.push(node); return node; }
    resume() { this.resumeCalls++; this.state = 'running'; return Promise.resolve(); }
  }
  const elements = Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => [id, new Element()]));
  const document = new Element(); document.hidden = false; document.getElementById = id => elements[id];
  const window = new Element(); if (audioAvailable) window.AudioContext = AudioContext;
  const context = vm.createContext({ window, document, currentLang: 'en', Promise,
    performance: { now: () => 1000 }, setTimeout() {},
    localStorage: {
      getItem(key) { if (blockedStorage) throw Error('blocked'); return values.get(key) ?? null; },
      setItem(key, value) { if (blockedStorage) throw Error('blocked'); values.set(key, value); saved.push({ key, value }); },
    },
  });
  vm.runInContext(`${audioSource}\nglobalThis.testSound = sound;`, context);
  if (settings) vm.runInContext(settingsSource, context);
  return { context, contexts, window, document, elements, saved, values, sound: context.testSound,
    clickEngine: () => elements['engine-sound-toggle'].emit('click', { isTrusted: true }),
  };
}

test('engine preference defaults on and can be changed before audio initializes without unlocking audio', () => {
  for (const stored of [undefined, { [preferenceKey]: 'true' }, { [preferenceKey]: 'invalid' }]) {
    const h = harness({ stored }); assert.equal(h.sound.simulatedEngineEnabled, true); assert.equal(h.contexts.length, 0);
  }
  const h = harness(); h.sound.setSimulatedEngineEnabled(false);
  assert.equal(h.sound.simulatedEngineEnabled, false); assert.equal(h.contexts.length, 0);
  assert.deepEqual(h.saved, [{ key: preferenceKey, value: 'false' }]);
  h.sound.init(); assert.equal(h.contexts.length, 1); assert.equal(h.sound.simulatedEngineGain.gain.value, 0);
  assert.equal(h.sound.engineGain.gain.value, 0); assert.equal(h.sound.ctx.resumeCalls, 0);
  h.sound.init(); assert.equal(h.contexts.length, 1);
});

test('only the synthesized motor routes through the smoothly switched preference gate', () => {
  const h = harness(); const sound = h.sound; sound.init(); sound.update(.8, true, true, false, .7);
  assert.deepEqual(sound.engineGain.connections, [sound.simulatedEngineGain]);
  assert.deepEqual(sound.simulatedEngineGain.connections, [sound.ctx.destination]);
  assert.deepEqual(sound.thrusterGain.connections, [sound.ctx.destination]);
  assert.deepEqual(sound.screechGain.connections, [sound.ctx.destination]);
  const motorLevel = sound.engineGain.gain.value; const thrustLevel = sound.thrusterGain.gain.value; const tireLevel = sound.screechGain.gain.value;
  sound.setSimulatedEngineEnabled(false);
  assert.equal(sound.simulatedEngineGain.gain.value, 0);
  assert.deepEqual(sound.simulatedEngineGain.gain.targets.at(-1), { value: 0, time: 12, constant: .015 });
  assert.equal(sound.engineGain.gain.value, motorLevel); assert.equal(sound.thrusterGain.gain.value, thrustLevel); assert.equal(sound.screechGain.gain.value, tireLevel);
  for (const speed of [0, .5, 1, 1.5]) {
    sound.update(speed, true, true, false, 1);
    assert.equal(sound.simulatedEngineGain.gain.value, 0); assert.ok(sound.thrusterGain.gain.value > 0); assert.ok(sound.screechGain.gain.value > 0);
  }
  for (const method of ['beep', 'playCrash', 'playAirBrakeServo', 'playThunder', 'playSonicBoom', 'playMilestoneChime']) {
    const start = sound.ctx.nodes.length; sound[method](); const nodes = sound.ctx.nodes.slice(start);
    assert.ok(nodes.some(node => node.connections.includes(sound.ctx.destination)), `${method} should remain audible`);
    assert.ok(nodes.every(node => !node.connections.includes(sound.simulatedEngineGain)), `${method} must bypass the motor gate`);
  }
  sound.setSimulatedEngineEnabled(true);
  assert.deepEqual(sound.simulatedEngineGain.gain.targets.at(-1), { value: 1, time: 12, constant: .015 });
  assert.ok(sound.engineGain.gain.value > 0); assert.equal(h.contexts.length, 1);
});

test('SFX mute and destruction still silence motor, thrusters and tires after toggling', () => {
  const h = harness(); const sound = h.sound; sound.init(); sound.update(.9, true, false, false, 1);
  sound.enabled = false; sound.update(.9, true, false, false, 1);
  sound.setSimulatedEngineEnabled(false); sound.setSimulatedEngineEnabled(true);
  for (const gain of [sound.engineGain, sound.thrusterGain, sound.screechGain]) assert.equal(gain.gain.value, 0);
  const start = sound.ctx.nodes.length; sound.beep(); sound.playCrash(); assert.equal(sound.ctx.nodes.length, start);
  sound.enabled = true; sound.setSimulatedEngineEnabled(false); sound.update(.9, true, false, false, 1);
  assert.equal(sound.simulatedEngineGain.gain.value, 0); assert.ok(sound.engineGain.gain.value > 0);
  sound.update(.9, true, false, true, 1); sound.setSimulatedEngineEnabled(true);
  for (const gain of [sound.engineGain, sound.thrusterGain, sound.screechGain]) assert.equal(gain.gain.value, 0);
  sound.update(.9, true, false, false, 1); assert.ok(sound.engineGain.gain.value > 0);
});

test('off and on survive reload independently of BGM and storage errors or missing audio APIs remain safe', () => {
  const h = harness({ stored: { 'roadster.bgm.enabled.v1': 'false' } }); h.sound.setSimulatedEngineEnabled(false);
  const reload = harness({ stored: Object.fromEntries(h.values) });
  assert.equal(reload.sound.simulatedEngineEnabled, false); reload.sound.init(); assert.equal(reload.sound.simulatedEngineGain.gain.value, 0);
  reload.sound.setSimulatedEngineEnabled(true);
  assert.equal(harness({ stored: Object.fromEntries(reload.values) }).sound.simulatedEngineEnabled, true);
  assert.equal(reload.values.get('roadster.bgm.enabled.v1'), 'false');
  const blocked = harness({ blockedStorage: true }); assert.equal(blocked.sound.simulatedEngineEnabled, true);
  blocked.sound.setSimulatedEngineEnabled(false); blocked.sound.init(); assert.equal(blocked.sound.simulatedEngineGain.gain.value, 0);
  blocked.sound.setSimulatedEngineEnabled(true); assert.equal(blocked.sound.simulatedEngineGain.gain.value, 1);
  const unsupported = harness({ audioAvailable: false }); unsupported.sound.init(); unsupported.sound.setSimulatedEngineEnabled(false);
  assert.equal(unsupported.sound.simulatedEngineEnabled, false); assert.equal(unsupported.sound.initialized, false);
});

test('settings loads saved state before WebGL, translates and toggles only engine audio without creating a context', async () => {
  const h = harness({ settings: true, stored: { [preferenceKey]: 'false' } });
  const button = h.elements['engine-sound-toggle']; const music = h.elements['roadster-bgm'];
  assert.equal(button.attributes['aria-pressed'], 'false'); assert.equal(button.textContent, 'Engine sound: Off');
  assert.equal(h.contexts.length, 0); assert.equal(music.playCalls, 0);
  h.context.currentLang = 'zh'; h.window.RoadsterMusic.render();
  assert.equal(h.elements['engine-sound-label'].textContent, '模拟音浪'); assert.equal(button.textContent, '模拟音浪：关闭');
  assert.match(h.elements['engine-sound-note'].textContent, /关闭后不播放发动机模拟声/);
  h.clickEngine(); assert.equal(h.sound.simulatedEngineEnabled, true); assert.equal(button.attributes['aria-pressed'], 'true');
  assert.equal(button.textContent, '模拟音浪：开启'); assert.equal(h.sound.enabled, true);
  assert.equal(h.contexts.length, 0); assert.equal(music.playCalls, 0); assert.equal(music.pauseCalls, 0); assert.equal(music.currentTime, 19);
  h.document.emit('pointerdown', { isTrusted: true }); await Promise.resolve(); await Promise.resolve();
  assert.equal(music.playCalls, 1); assert.equal(music.paused, false);
  h.sound.init(); h.sound.update(.7, true, false, false, 1); h.clickEngine();
  assert.equal(h.sound.simulatedEngineGain.gain.value, 0); assert.equal(music.paused, false); assert.equal(music.playCalls, 1);
  assert.equal(h.elements['music-toggle'].attributes['aria-pressed'], 'true'); assert.equal(h.contexts.length, 1);
  const listeners = button.listeners.click.length; vm.runInContext(settingsSource, h.context); assert.equal(button.listeners.click.length, listeners);
  assert.match(html, /id="engine-sound-toggle"[^>]*aria-pressed="true"[^>]*aria-describedby="engine-sound-note"/);
  const bundle = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(bundle.indexOf('// MODULE: audio.js') < bundle.indexOf('// MODULE: music.js'));
  assert.ok(bundle.indexOf('// MODULE: music.js') < bundle.indexOf('// MODULE: world.js'));
});

test('production map switches and repeated vehicle or challenge resets retain the engine preference', () => {
  const h = harness(); h.sound.setSimulatedEngineEnabled(false); h.sound.init();
  Object.assign(h.context, { state: {}, currentMap: 'highway', MAX_AIR_SECONDS: 10, CITY_DEFAULT_LANE_OFFSET: 5.25, carMeshGroup: {}, highwayEnvGroup: {}, cityEnvGroup: {}, trafficLevelIndex: 1,
    clearDebris() {}, renderBannerText() {}, populateTraffic() {}, applyTranslations() {} });
  vm.runInContext(readFileSync(new URL('../src/driving-score.js', import.meta.url), 'utf8'), h.context);
  const config=readFileSync(new URL('../src/config.js',import.meta.url),'utf8');
  vm.runInContext(config.split('\n').find(line=>line.startsWith('function mapTrafficCounts(')),h.context);
  vm.runInContext(hud.slice(hud.indexOf('function switchMap('), hud.indexOf('function applyTranslations(')), h.context);
  for (const command of ['resetCar()', "switchMap('city')", 'resetCar()', "switchMap('highway')", 'resetCar()']) {
    vm.runInContext(command, h.context); h.sound.update(.8, true, false, false, .5);
    assert.equal(h.sound.simulatedEngineEnabled, false); assert.equal(h.sound.simulatedEngineGain.gain.value, 0);
  }
  assert.equal(h.saved.length, 1); assert.equal(h.contexts.length, 1);
});


test('original V8 voice uses two irregular exhaust banks, filtered air, bass and bounded soft saturation', () => {
  const {sound} = harness(); sound.init();
  assert.equal(sound.engineOsc.type, 'custom');
  assert.equal(sound.engineOvertoneOsc.type, 'custom');
  assert.notDeepEqual(sound.engineOsc.wave.real, sound.engineOvertoneOsc.wave.real);
  for (const osc of [sound.engineOsc, sound.engineOvertoneOsc]) {
    assert.equal(osc.wave.real.length, 97);
    assert.equal(osc.wave.real[0], 0); assert.equal(osc.wave.imag[0], 0);
    assert.ok([...osc.wave.real, ...osc.wave.imag].every(Number.isFinite));
    assert.ok(osc.wave.real.slice(1, 8).some(n => Math.abs(n) > .05), 'uneven bank firing retains a low burble');
    assert.ok(Math.hypot(osc.wave.real[8], osc.wave.imag[8]) > .5, 'eight firing events per engine cycle');
  }
  assert.equal(sound.engineBodyOsc.type, 'sine');
  assert.equal(sound.engineFilter.type, 'lowpass'); assert.equal(sound.engineFilter.Q.value, .55);
  assert.equal(sound.engineTextureFilter.type, 'bandpass');
  assert.deepEqual(sound.engineOsc.connections, [sound.engineBankGain]);
  assert.deepEqual(sound.engineBankGain.connections, [sound.engineFilter]);
  assert.deepEqual(sound.engineOvertoneOsc.connections, [sound.engineOvertoneGain]);
  assert.deepEqual(sound.engineOvertoneGain.connections, [sound.engineFilter]);
  assert.deepEqual(sound.engineTextureGain.connections, [sound.engineFilter]);
  assert.deepEqual(sound.engineFilter.connections, [sound.engineSaturator]);
  assert.deepEqual(sound.engineSaturator.connections, [sound.engineGain]);
  assert.equal(sound.engineSaturator.curve[1024], 0);
  assert.ok([...sound.engineSaturator.curve].every(n => Number.isFinite(n) && Math.abs(n) <= 1));
  assert.equal(sound.engineSaturator.curve[0], -1); assert.equal(sound.engineSaturator.curve[2048], 1);
});

test('virtual RPM and exhaust load rise smoothly with speed and analog throttle while coasting becomes quieter', () => {
  const {sound} = harness(); sound.init();
  let previous;
  for (const load of [0, .25, .5, .75, 1]) {
    sound.update(.5, false, false, false, 0, load);
    const current = {...sound.engineVoice};
    assert.equal(current.load, load);
    if (previous) for (const key of ['rpm', 'gain', 'cutoff', 'textureGain', 'bodyGain', 'bankGain']) assert.ok(current[key] > previous[key], key);
    previous = current;
    assert.equal(sound.engineOsc.frequency.value, current.rpm / 120);
    assert.equal(sound.engineOvertoneOsc.frequency.value, current.rpm / 120, 'both banks share one coherent crank speed');
    assert.equal(sound.engineBodyOsc.frequency.value, current.rpm / 60);
    assert.equal(sound.engineGain.gain.targets.at(-1).constant, .08);
    assert.equal(sound.engineOsc.frequency.targets.at(-1).constant, .10);
  }
  sound.update(.5, true, true, false, 0, .5);
  const thrustVoice = {...sound.engineVoice};
  sound.update(.5, false, false, false, 0, .5);
  assert.deepEqual({...sound.engineVoice}, thrustVoice, 'rocket status cannot override explicit motor load or jump its pitch');
  sound.update(0, false, false, false, 0, 0); assert.equal(sound.engineGain.gain.value, 0, 'silent parked EV');
  sound.update(0, false, false, false, 0, 1); assert.ok(sound.engineGain.gain.value > 0, 'stationary held throttle can rev softly');
});

test('invalid inputs and extreme speed keep V8 pitch, filter, and level finite and bounded; legacy callers remain compatible', () => {
  const {sound} = harness(); sound.init();
  for (const speed of [-10, 0, NaN, Infinity]) {
    sound.update(speed, false, false, false);
    assert.equal(sound.engineGain.gain.value, 0, 'no persistent idle drone');
  }
  for (const speed of [-10, 0, .001, .03, .06, .5, 1, 1.5, 100, NaN, Infinity]) {
    for (const load of [undefined, NaN, Infinity, -10, 0, .3, .7, 1, 100]) {
      sound.update(speed, false, false, false, 0, load);
      assert.ok(Object.values(sound.engineVoice).every(Number.isFinite));
      assert.ok(sound.engineGain.gain.value >= 0 && sound.engineGain.gain.value <= .084);
      assert.ok(sound.engineVoice.rpm >= 850 && sound.engineVoice.rpm <= 6800);
      assert.ok(sound.engineFilter.frequency.value >= 360 && sound.engineFilter.frequency.value <= 2200);
    }
  }
  sound.update(.8, false, false, false); assert.ok(sound.engineGain.gain.value > 0);
  const legacyLevel = sound.engineGain.gain.value;
  sound.update(.8, true, false, false); assert.ok(sound.engineGain.gain.value > legacyLevel);
});

test('production physics passes actual analog drive load without changing the existing SFX argument meanings', () => {
  const physics = readFileSync(new URL('../src/physics-main.js', import.meta.url), 'utf8');
  const callSite = physics.slice(physics.indexOf('  const anyAttitude ='), physics.indexOf('  // Update Live Cockpit Center'));
  assert.ok(callSite.includes('sound.update('), 'exercise the production call site');
  for (const driveInput of [
    {throttle: 0, boost: 0, reverse: 0},
    {throttle: .5, boost: 0, reverse: 0},
    {throttle: .5, boost: .7, reverse: .4},
    {throttle: 0, boost: 0, reverse: 1},
  ]) {
    let args;
    const context = vm.createContext({
      state: {speed: -40, maxSpeed: 80}, driveInput,
      rollInput: 0, pitchInput: 0, yawInput: 0, airJetLeft: false, airJetRight: false, canUseRCS: true,
      isLiftFiring: false, rearActive: true, isFrontRetroFiring: false, tireScreechIntensity: .42,
      sound: {update(...values) { args = values; }},
      cityOwnsDrivingSound: () => false,
    });
    vm.runInContext(callSite, context);
    assert.deepEqual(args, [.5, true, false, false, .42, Math.max(...Object.values(driveInput))]);
    const {sound} = harness(); sound.init(); sound.update(...args);
    assert.equal(sound.engineVoice.load, args[5]);
    assert.equal(sound.thrusterGain.gain.value, .24, 'engine load does not redefine the existing rocket audio');
  }
});
