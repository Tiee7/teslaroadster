import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const read = name => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
const physics = read('physics-main.js'), html = read('index.html'), css = read('styles.css'), config = read('config.js');
const source = physics.slice(physics.indexOf('function updateDestroyedScores('), physics.indexOf('function updateDestroyedModalText('));
const I18N = vm.runInNewContext(`${config.slice(config.indexOf('const I18N'), config.indexOf('let currentLang'))}\nI18N`);

test('destruction overlay shows current driving total and separately gated post-penalty passenger score', () => {
  const elements = Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => [id, { hidden: false, textContent: '' }]));
  const state = { score: 123.7, carsCleared: 12 }; let passenger = { active: false, score: 9999 };
  const c = vm.createContext({ state, I18N, currentLang: 'en', document: { getElementById: id => elements[id] }, window: { RoadsterTaxi: { snapshot: () => passenger } } });
  vm.runInContext(source, c); c.updateDestroyedScores();
  assert.equal(elements['crash-val-score'].textContent, '244');
  assert.equal(elements['crash-passenger-score'].hidden, true); assert.equal(elements['crash-val-passenger-score'].textContent, '0');
  for (const score of [7000, 4000, 0]) { passenger = { active: true, score }; c.updateDestroyedScores(); assert.equal(elements['crash-val-passenger-score'].textContent, String(score)); assert.equal(elements['crash-passenger-score'].hidden, false); assert.equal(elements['crash-val-score'].textContent, '244'); }
  state.score = 1400; state.carsCleared = 3; c.updateDestroyedScores(); assert.equal(elements['crash-val-score'].textContent, '1430');
  c.currentLang = 'zh'; c.updateDestroyedScores(); assert.equal(elements['crash-lbl-score'].textContent, '驾驶总分'); assert.match(elements['crash-lbl-passenger-score'].textContent, /独立/);
  delete c.window.RoadsterTaxi; c.updateDestroyedScores(); assert.equal(elements['crash-passenger-score'].hidden, true);
});

test('score render follows crash penalty and explosion rewards, refreshes while crashed, preserves ranked notice', () => {
  const destroy = physics.slice(physics.indexOf('function destroyVehicle('), physics.indexOf('function updateDestroyedScores('));
  assert.ok(destroy.indexOf('RoadsterTaxi?.onDestroyed()') < destroy.indexOf('updateDestroyedModalText()'));
  assert.ok(destroy.indexOf('applyExplosionBlastToTraffic(') < destroy.indexOf('updateDestroyedModalText()'));
  assert.match(physics, /function updateDestroyedModalText\(\) \{\s*updateDestroyedScores\(\);/);
  assert.match(physics, /RoadsterTaxi\?\.tick\(\);\s*if \(state\.isDestroyed\) updateDestroyedScores\(\);/);
  assert.match(physics, /'val-score'\)\.textContent = Math\.round\(state\.score \+ state\.carsCleared \* 10\)/);
  assert.match(html, /id="ranked-crash-status"/);
  assert.doesNotMatch(source, /ranked-crash-status|state\.score\s*[+\-*/]?=|fetch\(/);
});

test('destruction summary can scroll on a small screen and hides passenger-only details by default', () => {
  assert.match(html, /class="crash-dialog-content/);
  assert.match(css, /\.crash-dialog-content \{[^}]*max-height: calc\(100dvh - 32px\);[^}]*overflow-y: auto;/);
  assert.match(html, /id="crash-passenger-score"[^>]* hidden/);
  assert.match(css, /#crash-passenger-score\[hidden\] \{ display: none; \}/);
});
