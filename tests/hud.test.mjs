import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const hud = readFileSync(new URL('../src/ui-hud.js', import.meta.url), 'utf8');
const physics = readFileSync(new URL('../src/physics-main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const config = readFileSync(new URL('../src/config.js', import.meta.url), 'utf8');
const tankReader = config.slice(config.indexOf('function getAirTankReadout('), config.indexOf('const VEHICLE_MASS_KG'));
const getAirTankReadout = vm.runInNewContext(`${tankReader}\ngetAirTankReadout`, { MAX_AIR_SECONDS: 10 });

function drawCockpitTank(tankState) {
  const renderer = hud.slice(hud.indexOf('function updateCockpitHudScreen('), hud.indexOf('// FULL-SCREEN DYNAMIC SPEED LINES'));
  const text = [], rects = [];
  const ctx = new Proxy({
    fillText(value, x, y) { text.push({ value, x, y, font: this.font, align: this.textAlign }); },
    createLinearGradient() { return { addColorStop() {} }; },
    fillRect(x, y, width, height) { rects.push({ x, y, width, height }); },
  }, { get: (target, key) => key in target ? target[key] : () => {} });
  const texture = {};
  const state = {
    yaw: 0, roll: 0, pitch: 0, speedUnit: 'kmh', speed: 0,
    lateralG: 0, longitudinalG: 0, ...tankState,
  };
  const context = vm.createContext({
    cockpitHudCtx: ctx, cockpitHudTexture: texture, state, keys: {},
    MAX_AIR_SECONDS: 10, VEHICLE_MASS_KG: 1850, getAirTankReadout,
    THREE: { MathUtils: { radToDeg: value => value * 180 / Math.PI,
      clamp: (value, min, max) => Math.min(max, Math.max(min, value)) } },
    performance: { now: () => 0 },
    // Exercise the existing reserved passenger strip after all instruments.
    window: { RoadsterTaxi: { drawCockpit(c) { c.fillRect(16, 237, 480, 26); } } },
  });
  vm.runInContext(`${renderer}\nupdateCockpitHudScreen(0, 0, false, false, false, false, false);`, context);
  assert.equal(texture.needsUpdate, true);
  return { text, rects };
}

test('cockpit gas, seconds, liters and fill use the current air tank, including empty and recharge frames', () => {
  for (const [airRemaining, gasMassKg, seconds, liters, mass] of [
    [10, 144, '10.0', 600, '144.0'],
    [5, 144, '5.0', 300, '72.0'],
    [2, 72, '2.0', 120, '28.8'],
    [0.001, 0.2, '0.0', 0, '0.0'],
    [0, 144, '0.0', 0, '0.0'],
    [0, 0, '0.0', 0, '0.0'],
    [0.5, 0, '0.5', 30, '7.2'],
    [10, 0, '10.0', 600, '144.0'],
  ]) {
    const { text, rects } = drawCockpitTank({ airRemaining, gasMassKg });
    assert.equal(text.find(draw => draw.value.endsWith('s / 10.0s')).value,
      `${seconds}s / 10.0s`);
    assert.deepEqual(text.filter(draw => draw.value.includes('GAS:')).map(draw => draw.value), [`GAS: ${mass} kg`]);
    assert.ok(text.some(draw => draw.value === `${liters}L REMAINING`));
    assert.ok(rects.some(draw => draw.x === 18 && draw.y === 134 && draw.width === 476 && draw.height === 40));
    const fill = rects.find(draw => draw.x === 22 && draw.y === 138 && draw.height === 32);
    assert.ok(Math.abs(fill.width - 468 * airRemaining / 10) < 1e-10);
  }
});

test('cockpit tank bounds and gas text stay inside their reserved area without overlapping the passenger strip', () => {
  for (const [airRemaining, seconds, liters, mass, pct] of [
    [-1, '0.0', 0, '0.0', 0], [11, '10.0', 600, '144.0', 1],
    [NaN, '0.0', 0, '0.0', 0], [undefined, '0.0', 0, '0.0', 0],
  ]) {
    const { text, rects } = drawCockpitTank({ airRemaining });
    const tank = text.find(draw => draw.value.endsWith('s / 10.0s'));
    const gas = text.find(draw => draw.value.startsWith('GAS:'));
    assert.equal(tank.value, `${seconds}s / 10.0s`);
    assert.equal(gas.value, `GAS: ${mass} kg`);
    assert.equal(tank.y, 120);
    assert.equal(gas.y, 198); assert.equal(gas.x, 494); assert.equal(gas.align, 'right');
    assert.match(gas.font, /16px/);
    assert.ok(text.some(draw => draw.value === `${liters}L REMAINING`));
    const fill = rects.find(draw => draw.x === 22 && draw.y === 138 && draw.height === 32);
    assert.equal(fill.width, 468 * pct);
    assert.ok(rects.some(draw => draw.x === 22 + 468 * 0.2 && draw.y === 134 && draw.height === 40));
    assert.ok(text.every(draw => draw.y < 237), 'instruments remain above passenger band');
    assert.ok(rects.some(draw => draw.x === 16 && draw.y === 237 && draw.height === 26), 'passenger strip remains rendered');
  }
});

test('external telemetry updates gas mass and matches cockpit seconds/liters/mass on the same frame', () => {
  const footerTank = physics.slice(physics.indexOf('  const tank = getAirTankReadout('), physics.indexOf("  const barFill = document.getElementById('air-bar-fill');"));
  for (const airRemaining of [10, 5, 2, 0.001, 0, 0.5, 10]) {
    const elements = Object.fromEntries(['val-gas-mass', 'val-air-sec', 'val-air-liters', 'val-burn-used'].map(id => [id, {}]));
    vm.runInNewContext(footerTank, {
      state: { airRemaining, airUsedContinuous: 10 - airRemaining, gasMassKg: 144 },
      MAX_AIR_SECONDS: 10, getAirTankReadout, document: { getElementById: id => elements[id] },
    });
    const { text } = drawCockpitTank({ airRemaining, gasMassKg: 144 });
    assert.equal(text.find(draw => draw.value.startsWith('GAS:')).value, `GAS: ${elements['val-gas-mass'].textContent}`);
    assert.ok(text.find(draw => draw.value.endsWith('s / 10.0s')).value.includes(elements['val-air-sec'].textContent));
    assert.ok(text.some(draw => draw.value === `${elements['val-air-liters'].textContent.slice(1, -1)} REMAINING`));
  }
});

test('cockpit and footer use identical speed, units and rounded values with readable Canvas digits', () => {
  const cockpit = hud.slice(hud.indexOf("  const isUnitKmh = (state.speedUnit === 'kmh');"), hud.indexOf('  // Cockpit Turn Signal Blinkers'));
  const footer = physics.slice(physics.indexOf("  if (state.speedUnit === 'kmh') {"), physics.indexOf("  const gForceEl = document.getElementById('val-g-force');"));
  for (const speedMs of [0, 0.4, 12, 27.5, 100 / 3.6, 220, 300]) {
    for (const speedUnit of ['kmh', 'mph']) {
      const draws = [];
      let font = 'bold 12px monospace';
      const ctx = {
        textAlign: 'left', fillStyle: '',
        set font(value) {
          // Invalid Canvas font assignments are ignored, as in a real browser.
          if (/^(?:bold|[1-9]00) \d+px /.test(value)) font = value;
        },
        get font() { return font; },
        fillText(text, x, y) { draws.push({ text, x, y, font, align: this.textAlign }); },
      };
      const speedEl = {}, unitEl = {}, subSpeedEl = {};
      const mph = Math.round(speedMs * 2.23694), kmh = Math.round(speedMs * 3.6);
      vm.runInNewContext(cockpit, { ctx, state: { speedUnit }, mph, kmh });
      vm.runInNewContext(footer, { speedEl, unitEl, subSpeedEl, state: { speedUnit }, mph, kmh, modeTag: 'test' });
      assert.equal(draws[0].text, String(speedEl.textContent));
      assert.equal(draws[1].text, unitEl.textContent);
      assert.equal(draws[2].text, subSpeedEl.textContent.split(' • ')[0]);
      assert.match(draws[0].font, /^(?:bold|[1-9]00) 54px /);
      assert.equal(draws[0].align, 'right');
      assert.ok(draws[0].x > 115 && draws[0].x < draws[1].x);
      assert.equal(draws[1].align, 'left'); assert.equal(draws[2].align, 'left');
    }
  }
  assert.match(physics, /const totalAirSpeedMs[\s\S]*?const mph = Math.round\(totalAirSpeedMs \* 2\.23694\);\s*const kmh = Math.round\(totalAirSpeedMs \* 3\.6\);/);
  assert.match(physics, /updateCockpitHudScreen\(mph, kmh,/);
});

test('notifications are independent of the side-panel flow on desktop and mobile', () => {
  assert.match(html, /id="hud-main"[\s\S]*id="hud-notifications"/);
  const notices = html.slice(html.indexOf('id="hud-notifications"'), html.indexOf('id="hud-side-panels"'));
  assert.ok(notices.includes('id="ranked-hud"'));
  assert.ok(notices.includes('id="status-banner"'));
  assert.ok(!notices.includes('id="hud-left"') && !notices.includes('id="hud-right"'));
  assert.match(css, /#hud-notifications\s*\{\s*position: absolute;/);
  assert.match(css, /@media \(max-width: 1100px\)[\s\S]*?--hud-notice-space: 100px;/);
  assert.match(css, /\.ranked-hud\[hidden\]\s*\{\s*display: none;/);
  assert.match(css, /#hud-left, #hud-right\s*\{[^}]*min-width: 0;/);
  assert.match(css, /#hud-notifications\s*\{[^}]*max-height: var\(--hud-notice-space\);[^}]*overflow-y: auto;/);
  assert.match(css, /@media \(max-width: 1100px\) and \(max-height: 600px\)[\s\S]*?#hud-footer[^}]*max-height: 32dvh;/);
  assert.match(css, /max-height: max\(0px, calc\(100dvh/);
});

test('HUD bounds observe only permanent header/footer, never transient alerts', () => {
  const source = hud.slice(0, hud.indexOf('function toggleHudMode()'));
  const props = {};
  const elements = {
    'hud-top-container': { style: { setProperty: (key, value) => { props[key] = value; } } },
    'hud-header': { getBoundingClientRect: () => ({ height: 123 }) },
    'hud-footer': { getBoundingClientRect: () => ({ height: 87 }) },
  };
  const observed = [];
  const context = { document: { getElementById: id => elements[id] }, window: { addEventListener() {} }, ResizeObserver: class { observe(el) { observed.push(el); } } };
  vm.runInNewContext(source, context);
  assert.deepEqual(props, { '--hud-header-height': '123px', '--hud-footer-height': '87px' });
  assert.deepEqual(observed, [elements['hud-header'], elements['hud-footer']]);
});

test('cockpit essentials have separate speed, tank, telemetry and passenger bands', () => {
  const { text, rects } = drawCockpitTank({ airRemaining: 2 });
  assert.ok(text.find(t => t.value === '0').y < 100);
  const track = rects.find(r => r.x === 18 && r.y === 134);
  assert.equal(track.height, 40);
  assert.ok(text.filter(t => t.y >= 108 && t.y <= 120).every(t => t.y < track.y));
  assert.ok(text.filter(t => t.y > 174).every(t => t.y < 237));
  assert.ok(rects.find(r => r.y === 237 && r.height === 26));
});

test('FPV switches duplicate floating information off immediately while preserving side controls', () => {
  const start = hud.indexOf('function syncHudPerspective()');
  const sync = hud.slice(start, hud.indexOf('function toggleHudMode()', start));
  const classes = new Set(); let updates = 0;
  const context = vm.createContext({ cameraModeIndex: 0, updateHudBounds() { updates++; }, document: { body: { classList: {
    toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); },
  } } } });
  vm.runInContext(sync, context);
  for (const mode of [0, 3, 3, 2, 3, 1, 0]) {
    context.cameraModeIndex = mode; vm.runInContext('syncHudPerspective()', context);
    assert.equal(classes.has('cockpit-view'), mode === 3);
  }
  assert.equal(updates, 7);
  assert.match(hud, /function applyTranslations\(\) \{\s*syncHudPerspective\(\)/);
  const selectors = css.match(/\.cockpit-view[^}]+\}/g).filter(rule => /display:\s*none/.test(rule)).join('');
  assert.match(selectors, /#hud-cluster/); assert.match(selectors, /\.city-taxi-hud/);
  assert.doesNotMatch(selectors, /#hud-left|#hud-right|#touch-controls/);
});

test('actual continuous consumption, depletion and reset immediately update the cockpit bar with exterior readings', () => {
  const consume = physics.slice(physics.indexOf('  function consumeAirTank('), physics.indexOf('  let canUseRCS'));
  const reset = hud.slice(hud.indexOf('function resetCar('), hud.indexOf('function applyTranslations('));
  const state = { airRemaining: 10, airUsedContinuous: 0, isFreefalling: false, vy: 0 };
  const context = vm.createContext({ state, MAX_AIR_SECONDS: 10, AUTO_DESCENT_USED_SECONDS: 8,
    showBanner() {}, sound: { speakAlert() {}, beep() {} }, window: {}, clearDebris() {}, carMeshGroup: {},
    currentMap: 'city', renderBannerText() {}, document: { getElementById: () => ({ classList: { add() {}, remove() {} } }) },
  });
  vm.runInContext(`${consume}\n${reset}`, context);
  for (let frame = 0; frame <= 50; frame++) {
    const reading = getAirTankReadout(state.airRemaining);
    const { text, rects } = drawCockpitTank({ ...state, gasMassKg: 144 });
    const fill = rects.find(r => r.x === 22 && r.y === 138 && r.height === 32);
    assert.equal(fill.width, 468 * reading.fraction);
    assert.ok(text.some(t => t.value === `${reading.seconds.toFixed(1)}s / 10.0s`));
    assert.ok(text.some(t => t.value === `${reading.liters}L REMAINING`));
    if (frame < 50) context.consumeAirTank(0.2, true);
  }
  assert.equal(state.airRemaining, 0); assert.equal(state.isFreefalling, true);
  context.resetCar(); assert.equal(state.airRemaining, 10); assert.equal(state.isFreefalling, false);
  const full = drawCockpitTank(state); assert.equal(full.rects.find(r => r.x === 22 && r.y === 138).width, 468);
});
