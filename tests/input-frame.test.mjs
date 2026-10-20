import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const hud = readFileSync(new URL('../src/ui-hud.js', import.meta.url), 'utf8');
const physics = readFileSync(new URL('../src/physics-main.js', import.meta.url), 'utf8');

test('driving key events update state synchronously and are consumed before the next frame renders', () => {
  const listeners = {}, keys = {}, observations = [], frames = [];
  const context = vm.createContext({ keys, keyBadgeMap: {}, Element: class {},
    document: { getElementById: () => ({ classList: { contains: name => name === 'hidden' } }) },
    window: { addEventListener: (name, listener) => { listeners[name] = listener; } },
    sound: { init() {} }, lastTime: 1000, currentMap:'highway', state: { isDestroyed: false }, scene: {}, camera: {},
    requestAnimationFrame: callback => frames.push(callback),
    updateSimulation: dt => observations.push({ type: 'simulation', dt, keys: { ...keys } }),
    renderer: { render: () => observations.push({ type: 'render' }) }
  });
  const input = hud.slice(hud.indexOf('function setKeyState('), hud.indexOf("document.querySelectorAll('[data-hold-key]')"));
  const animate = physics.slice(physics.indexOf('function animate('), physics.indexOf("window.addEventListener('resize'", physics.indexOf('function animate(')));
  vm.runInContext(input + '\n' + animate, context);
  const drivingKeys = ['KeyW','KeyA','KeyS','KeyD','KeyH','KeyU','Space','ShiftLeft','KeyQ','KeyE','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
  for (const code of drivingKeys) {
    listeners.keydown({ code, target: null, preventDefault() {} });
    assert.equal(keys[code], true, `${code} must not wait for a timer/frame`);
  }
  vm.runInContext('animate(1016)', context);
  assert.equal(observations[0].type, 'simulation');
  assert.equal(observations[1].type, 'render');
  assert.equal(observations[0].dt, .016);
  for (const code of drivingKeys) assert.equal(observations[0].keys[code], true);
  assert.equal(frames.length, 1, 'one RAF is scheduled by the frame loop');
  for (const code of drivingKeys) listeners.keyup({ code });
  vm.runInContext('animate(1032)', context);
  for (const code of drivingKeys) assert.equal(observations[2].keys[code], false);
  assert.equal(observations[3].type, 'render');
});
