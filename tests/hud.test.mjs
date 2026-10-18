import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const hud = readFileSync(new URL('../src/ui-hud.js', import.meta.url), 'utf8');
const physics = readFileSync(new URL('../src/physics-main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

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

test('cockpit pitch horizon returns to neutral after either full flip', () => {
  const line = hud.match(/  const pitchShift = [^\n]+;/)[0];
  for (const pitch of [0, 2 * Math.PI, -2 * Math.PI, 4 * Math.PI]) {
    const value = vm.runInNewContext(`${line}\npitchShift`, { state: { pitch }, THREE: { MathUtils: { clamp: (x, min, max) => Math.min(max, Math.max(min, x)) } } });
    assert.ok(Math.abs(value) < 1e-10);
  }
  const pitchShift = pitch => vm.runInNewContext(`${line}\npitchShift`, { state: { pitch }, THREE: { MathUtils: { clamp: (x, min, max) => Math.min(max, Math.max(min, x)) } } });
  for (const boundary of [Math.PI, -Math.PI, 2 * Math.PI, -2 * Math.PI]) {
    assert.ok(Math.abs(pitchShift(boundary - 0.0001) - pitchShift(boundary + 0.0001)) < 0.02, 'no horizon jump across inverted/full-loop boundaries');
  }
});
