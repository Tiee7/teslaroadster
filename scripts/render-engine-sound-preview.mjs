// CPU reference rendering of the production V8 graph, not a browser/device test.
// No external audio, browser launch, network access or third-party DSP packages.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';

class Param {
  constructor() { this.value = 0; this.events = []; this.cursor = 0; this.time = 0; this.target = null; this.output = null; }
  setTargetAtTime(value, time, constant) { this.events.push({value, time, constant}); }
  at(time) {
    if (this.output === null) this.output = this.value;
    const advance = to => {
      if (this.target) this.output = this.target.value + (this.output - this.target.value) * Math.exp(-(to - this.time) / this.target.constant);
      this.time = to;
    };
    while (this.cursor < this.events.length && this.events[this.cursor].time <= time) {
      const event = this.events[this.cursor++]; advance(event.time); this.target = event;
    }
    advance(time); return this.output;
  }
}
class Node {
  constructor() { this.gain = new Param(); this.frequency = new Param(); this.Q = new Param(); this.connections = []; }
  connect(target) { this.connections.push(target); }
  setPeriodicWave(wave) { this.wave = wave; }
  start() {} stop() {}
}
class Context {
  constructor() { this.sampleRate = 44100; this.currentTime = 0; this.state = 'running'; this.destination = {}; }
  createBuffer(channels, length) { const data = new Float32Array(length); return {getChannelData: () => data}; }
  createOscillator() { return new Node(); }
  createGain() { return new Node(); }
  createBiquadFilter() { return new Node(); }
  createBufferSource() { return new Node(); }
  createWaveShaper() { return new Node(); }
  createPeriodicWave(real, imag) { return {real, imag}; }
}
function tableFor(wave) {
  const table = new Float64Array(4096);
  let peak = 0;
  for (let i = 0; i < table.length; i++) {
    const phase = i / table.length * Math.PI * 2;
    for (let h = 1; h < wave.real.length; h++) table[i] += wave.real[h] * Math.cos(h * phase) + wave.imag[h] * Math.sin(h * phase);
    peak = Math.max(peak, Math.abs(table[i]));
  }
  for (let i = 0; i < table.length; i++) table[i] /= peak;
  return table;
}
function oscillator(node, sampleRate) {
  const table = node.wave ? tableFor(node.wave) : null;
  let phase = 0;
  return time => {
    let value;
    if (table) {
      const position = phase * table.length, index = Math.floor(position), fraction = position - index;
      value = table[index % table.length] * (1 - fraction) + table[(index + 1) % table.length] * fraction;
    } else value = Math.sin(phase * Math.PI * 2);
    phase = (phase + node.frequency.at(time) / sampleRate) % 1;
    return value;
  };
}
function filter(node, sampleRate) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (input, time) => {
    const omega = 2 * Math.PI * node.frequency.at(time) / sampleRate;
    const cosine = Math.cos(omega), alpha = Math.sin(omega) / (2 * node.Q.value), a0 = 1 + alpha;
    const b0 = node.type === 'bandpass' ? alpha : (1 - cosine) / 2;
    const b1 = node.type === 'bandpass' ? 0 : 1 - cosine;
    const b2 = node.type === 'bandpass' ? -alpha : b0;
    const output = (b0 * input + b1 * x1 + b2 * x2 + 2 * cosine * y1 - (1 - alpha) * y2) / a0;
    x2 = x1; x1 = input; y2 = y1; y1 = output;
    return output;
  };
}
function rangeMetrics(samples, sampleRate, from, to) {
  let power = 0, peak = 0;
  const first = Math.floor(from * sampleRate), end = Math.floor(to * sampleRate);
  for (let i = first; i < end; i++) { power += samples[i] ** 2; peak = Math.max(peak, Math.abs(samples[i])); }
  return {rms: Math.sqrt(power / (end - first)), peak};
}
export async function renderEngineSoundPreview(outputDirectory = 'verification/engine-sound-preview', options = {}) {
  const source = options.source ?? await readFile(new URL('../src/audio.js', import.meta.url), 'utf8');
  const duration = options.duration ?? 12;
  const context = new Context();
  let seed = 91827;
  const seededMath = Object.create(Math);
  seededMath.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const sandbox = vm.createContext({window: {AudioContext: function() { return context; }}, localStorage: {getItem() { return null; }, setItem() {}}, Math: seededMath});
  vm.runInContext(`${source}\nglobalThis.engineForRender = sound;`, sandbox);
  const sound = sandbox.engineForRender; sound.init(); assert.ok(sound.initialized);
  let muted = false;
  const voices = [];
  for (let frame = 0; frame <= duration * 60; frame++) {
    const t = context.currentTime = frame / 60;
    let speed = 0, load = 0;
    if (t >= .5 && t < 2.5) { speed = .08; load = .45; }
    else if (t >= 2.5 && t < 6.5) { speed = .08 + (t - 2.5) / 4 * .92; load = .95; }
    else if (t >= 6.5) { speed = .8; load = t < 8 ? 0 : .85; }
    const controls = options.controls?.(t);
    if (controls) { speed = controls.speed; load = controls.load; }
    const shouldMute = !options.controls && t >= 8 && t < 9.1;
    if (muted !== shouldMute) { sound.setSimulatedEngineEnabled(!shouldMute); muted = shouldMute; }
    sound.update(speed, false, false, !options.controls && t >= 10 && t < 11, 0, load);
    if (frame % 60 === 0) voices.push({time: t, rpm: sound.engineVoice?.rpm, gain: sound.engineGain.gain.events.at(-1).value});
  }
  const sampleRate = context.sampleRate, samples = new Float32Array(sampleRate * duration);
  const left = oscillator(sound.engineOsc, sampleRate), right = oscillator(sound.engineOvertoneOsc, sampleRate), bass = oscillator(sound.engineBodyOsc, sampleRate);
  const airFilter = filter(sound.engineTextureFilter, sampleRate), exhaustFilter = filter(sound.engineFilter, sampleRate);
  const noise = sound.noiseBuffer.getChannelData(0), curve = sound.engineSaturator.curve;
  let peak = 0, power = 0, mean = 0, maxStep = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    const air = airFilter(noise[i % noise.length], t) * sound.engineTextureGain.gain.at(t);
    const raw = left(t) * sound.engineBankGain.gain.at(t) + right(t) * sound.engineOvertoneGain.gain.at(t) + bass(t) * sound.engineBodyGain.gain.at(t) + air;
    const filtered = exhaustFilter(raw, t);
    const position = Math.max(0, Math.min(curve.length - 1, (filtered + 1) * (curve.length - 1) / 2));
    const index = Math.floor(position), fraction = position - index;
    const saturated = curve[index] * (1 - fraction) + curve[Math.min(curve.length - 1, index + 1)] * fraction;
    samples[i] = saturated * sound.engineGain.gain.at(t) * sound.simulatedEngineGain.gain.at(t);
    assert.ok(Number.isFinite(samples[i]));
    peak = Math.max(peak, Math.abs(samples[i])); power += samples[i] ** 2; mean += samples[i];
    if (i) maxStep = Math.max(maxStep, Math.abs(samples[i] - samples[i - 1]));
  }
  const segments = Object.fromEntries((options.segments ?? [['rest', .1, .4], ['lowLoad', 1.3, 2.2], ['highLoad', 5.6, 6.3], ['coast', 7.1, 7.8], ['muted', 8.5, 9], ['restarted', 9.6, 9.95], ['destroyed', 10.6, 10.95], ['recovered', 11.6, 11.95]]).map(([name, start, end]) => [name, rangeMetrics(samples, sampleRate, start, end)]));
  const audit = {
    verification: 'CPU reference DSP of production graph and automation; not native OfflineAudioContext, subjective listening, browser autoplay, device-volume or WebGL validation.',
    limits: '4096-point normalized periodic-wave tables, RBJ biquads, and production soft-clip curve; native browser oscillator interpolation and 2x WaveShaper oversampling may differ.',
    sourceSha256: createHash('sha256').update(source).digest('hex'), sampleRate, duration, peak, rms: Math.sqrt(power / samples.length), mean: mean / samples.length, maxStep, segments, voices,
  };
  assert.ok(peak > .025 && peak <= .08401, 'bounded digital peak'); assert.ok(Math.abs(audit.mean) < .001, 'no material DC offset');
  assert.ok(maxStep < .025, 'no reference-render discontinuity spike');
  if (!options.controls) {
  assert.equal(segments.rest.rms, 0);
  assert.ok(segments.highLoad.rms > segments.lowLoad.rms * 1.5); assert.ok(segments.highLoad.rms > segments.coast.rms * 1.5);
  for (const name of ['muted', 'destroyed']) assert.ok(segments[name].rms < 1e-6, `${name} fades to silence`);
  for (const name of ['restarted', 'recovered']) assert.ok(segments[name].rms > .01, `${name} resumes`);
  }
  const wav = Buffer.alloc(44 + samples.length * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) wav.writeInt16LE(Math.round(samples[i] * 32767), 44 + i * 2);
  const output = resolve(outputDirectory); await mkdir(output, {recursive: true});
  await writeFile(join(output, 'v8-ev-acceleration-cpu-preview.wav'), wav);
  await writeFile(join(output, 'audio-audit.json'), JSON.stringify(audit, null, 2) + '\n');
  return {outputDirectory: output, ...audit};
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await renderEngineSoundPreview(process.argv[2]), null, 2));
