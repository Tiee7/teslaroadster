import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const audio = readFileSync(new URL('../src/audio.js', import.meta.url), 'utf8');
const original = readFileSync(new URL('./fixtures/v8-original-audio.js', import.meta.url), 'utf8');
const physics = readFileSync(new URL('../src/physics-main.js', import.meta.url), 'utf8');
const voice = vm.runInNewContext(`${audio}\ngetRoadsterEngineVoice;`);
const oldVoice = vm.runInNewContext(`${original}\ngetRoadsterEngineVoice;`);
const close = (a, b, epsilon = 1e-8) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);

test('original V8 waveform fixture is exact; requested deep voice deliberately lowers the old mapping', () => {
  assert.equal(createHash('sha256').update(original).digest('hex'), '5ef67352c4680a1b24c2f3e10a9caa584f8280ed2196bf7fbda67a4cfc35e2ee');
  for (const speed of [0, .08, .2, .4]) for (const load of [0, .25, .5, 1]) assert.ok(voice(speed,load).rpm < oldVoice(speed,load).rpm);
});
test('deep exhaust knee is continuous and bounded below 2300 RPM; quieter low-pass voice suppresses hiss', () => {
  for (const load of [0, .5, 1]) {
    let previous = 0;
    for (let speed = 0; speed <= 2; speed += .001) {
      const v = voice(speed, load);
      assert.ok(v.rpm >= previous && v.rpm < 2300); previous = v.rpm;
      assert.ok(v.cutoff <= 680 && v.textureGain <= .013001 && v.gain <= .047001);
    }
    const boundary = (1800 - 780 - load * 260) / 900;
    close(voice(boundary + 1e-8, load).rpm - voice(boundary - 1e-8, load).rpm, .000018, 1e-8);
  }
  const high = voice(1.85, 1), oldHigh = oldVoice(1.85, 1);
  assert.ok(high.rpm < oldHigh.rpm * .4);
  assert.ok(high.cutoff < oldHigh.cutoff && high.textureGain < oldHigh.textureGain && high.bodyGain > oldHigh.bodyGain);
});
test('production sound uses absolute road speed, so 200/370 performance caps cannot pitch-shift the engine', () => {
  const call = physics.slice(physics.indexOf('  const anyAttitude ='), physics.indexOf('  // Update Live Cockpit Center'));
  for (const kmh of [0, 50, 100, 200, 300, 370]) {
    const pitches = [];
    for (const maxKmh of [200, 370, 576]) {
      let args;
      vm.runInNewContext(call, { state: { speed: kmh / 3.6, maxSpeed: maxKmh / 3.6 }, driveInput: { throttle: 1, boost: 0, reverse: 0 },
        rollInput: 0, pitchInput: 0, yawInput: 0, airJetLeft: false, airJetRight: false, canUseRCS: true,
        isLiftFiring: false, rearActive: false, isFrontRetroFiring: false, tireScreechIntensity: 0,
        cityOwnsDrivingSound: () => false, coastOwnsDrivingSound: () => false, sound: { update(...values) { args = values; } } });
      close(args[0], kmh / 200); pitches.push(voice(args[0], args[5]).rpm);
    }
    assert.equal(new Set(pitches).size, 1);
    assert.ok(voice(kmh / 200, 0).rpm <= pitches[0], 'releasing all drive input must not raise revs');
  }
});

const previousSource = readFileSync(new URL('./fixtures/v8-before-deep-20261021.js', import.meta.url), 'utf8');
const previousVoice = vm.runInNewContext(`${previousSource}\ngetRoadsterEngineVoice;`);
test('deep revision reduces the actual last published voice, not only the historical original',()=>{
 assert.equal(createHash('sha256').update(previousSource).digest('hex'),'750417514b6621bea049cbe92d5ea5b2a12c97c0c369cf44a4d7a6dc4beb087a');
 for(const speed of[0,.1,.3,.6,1,1.5,1.85])for(const load of[0,.25,.5,1]){
  const old=previousVoice(speed,load),next=voice(speed,load);
  assert.ok(next.rpm<old.rpm);assert.ok(next.cutoff<old.cutoff);assert.ok(next.textureGain<=old.textureGain/5);assert.ok(next.bodyGain>old.bodyGain);
  if(old.gain>0)assert.ok(next.gain<old.gain*.8);
 }
});
test('throttle transients change deep-voice RPM by at most 260, without changing firing-wave or audio ownership',()=>{
 for(const speed of[0,.3,.6,1,1.5])assert.ok(voice(speed,1).rpm-voice(speed,0).rpm<=260.000001);
 const wave=s=>s.slice(s.indexOf('function createRoadsterV8Wave('),s.indexOf('function getRoadsterEngineVoice('));assert.equal(wave(audio),wave(previousSource));
});
