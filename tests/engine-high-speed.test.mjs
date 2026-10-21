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

test('original V8 reference fixture is exact and low-register RPM retains its original mapping', () => {
  assert.equal(createHash('sha256').update(original).digest('hex'), '5ef67352c4680a1b24c2f3e10a9caa584f8280ed2196bf7fbda67a4cfc35e2ee');
  for (const speed of [0, .08, .2, .4]) for (const load of [0, .25, .5, 1]) {
    if (oldVoice(speed, load).rpm <= 3200) close(voice(speed, load).rpm, oldVoice(speed, load).rpm);
  }
});
test('high-speed rev knee is continuous, monotonic and bounded below 4100 RPM with a darker exhaust', () => {
  for (const load of [0, .5, 1]) {
    let previous = 0;
    for (let speed = 0; speed <= 2; speed += .001) {
      const v = voice(speed, load);
      assert.ok(v.rpm >= previous && v.rpm < 4100); previous = v.rpm;
      assert.ok(v.cutoff <= 1450 && v.textureGain <= .093001 && v.gain <= .084001);
    }
    const boundary = (3200 - 850 - load * 950) / 3100;
    close(voice(boundary + 1e-8, load).rpm - voice(boundary - 1e-8, load).rpm, .000062, 1e-8);
  }
  const high = voice(1.85, 1), oldHigh = oldVoice(1.85, 1);
  assert.ok(high.rpm < oldHigh.rpm * .65);
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
        cityOwnsDrivingSound: () => false, sound: { update(...values) { args = values; } } });
      close(args[0], kmh / 200); pitches.push(voice(args[0], args[5]).rpm);
    }
    assert.equal(new Set(pitches).size, 1);
    assert.ok(voice(kmh / 200, 0).rpm <= pitches[0], 'releasing all drive input must not raise revs');
  }
});
