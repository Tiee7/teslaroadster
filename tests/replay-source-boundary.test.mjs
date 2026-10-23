import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { replayEpoch as epoch, readLiveSource as read } from './helpers/replay-source-epoch.mjs';
const sha = s => createHash('sha256').update(s).digest('hex');
const pins = { ...epoch.frozenSourceSha256, ...epoch.authorizedSourceSha256 };
const base = p => read(epoch.baselineSourceFixtures[p].path);
function verify(overrides = {}) {
  for (const p of Object.keys(overrides)) assert.ok(Object.hasOwn(pins, p), 'Unknown replay scope: ' + p);
  for (const [p, h] of Object.entries(pins)) assert.equal(sha(overrides[p] ?? read(p)), h, p);
}
test('RAM replay explicitly succeeds f2, preserves production/main and every immutable numerical source', () => {
  assert.equal(epoch.basePreview, 'f2cbd9b3557e242ff40f2291df02fa3e224f7c61');
  assert.equal(epoch.mainUnchanged, '4451a11c9c09d031a9da037ce63afe4bb7f062e5');
  assert.equal(epoch.productionPreserved, 'dpl_7sJARPobcCozbJP8bGqRGS5uehci');
  assert.match(epoch.publicationScope, /^preview-only; same PR20; no main merge or production deployment$/);
  const parentText = read(epoch.inheritedEpoch), parent = JSON.parse(parentText);
  assert.equal(sha(parentText), epoch.inheritedEpochSha256);
  const parentPins = { ...parent.frozenSourceSha256, ...parent.authorizedSourceSha256 };
  for (const [p, h] of Object.entries(epoch.frozenSourceSha256)) assert.equal(h, parentPins[p], p);
  for (const [p, f] of Object.entries(epoch.baselineSourceFixtures)) { assert.equal(sha(read(f.path)), f.sha256, p); if (parentPins[p]) assert.equal(f.sha256, parentPins[p], p); }
  verify();
  for (const p of epoch.unchangedNumericalSources) { assert.ok(Object.hasOwn(epoch.frozenSourceSha256, p)); assert.equal(sha(read(p)), parentPins[p], p); }
  assert.deepEqual(Object.keys(pins).filter(p => p.startsWith('src/')).sort(), readdirSync(new URL('../src/', import.meta.url)).map(p => 'src/' + p).sort());
});
test('only the declared replay UI/adapter files advance; taxi rules and ranked algorithms are byte exact outside guards', () => {
  assert.deepEqual(Object.keys(epoch.authorizedSourceSha256).sort(), ['bundle_app.py', 'index.html', 'src/index.html', 'src/leaderboard.js', 'src/mobile-controls.js', 'src/replay-core.js', 'src/replay.js', 'src/styles.css', 'src/taxi.js'].sort());
  assert.equal(read('src/taxi.js').replace("    markerGroup.name = 'taxi-passenger-markers';\n", ''), base('src/taxi.js'));
  let ranked = read('src/leaderboard.js'); for (const guard of ['    if (window.RoadsterReplay?.isActive?.()) return;\n', '    if (window.RoadsterReplay?.isBusy?.()) return;\n', '    if (window.RoadsterReplay?.isBusy?.()) return;\n']) { assert.ok(ranked.includes(guard)); ranked = ranked.replace(guard, ''); }
  assert.equal(ranked, base('src/leaderboard.js'));
  assert.equal(read('src/mobile-controls.js').replace('    if (window.RoadsterReplay?.isActive?.()) return true;\n', ''), base('src/mobile-controls.js'));
  const css = read('src/styles.css'), marker = '\n/* Local temporary replay controls;'; assert.equal(css.split(marker).length, 2); assert.equal(css.slice(0, css.indexOf(marker)), base('src/styles.css'));
  let html = read('src/index.html'); const start = html.indexOf('  <section id="replay-panel"'), end = html.indexOf('  <!-- Modular Functional Scripts -->', start); assert.ok(start > 0 && end > start); html = html.slice(0, start) + html.slice(end);
  for (const line of ['      <button id="btn-replay" type="button" class="ranked-button" aria-controls="replay-panel">Replay</button>\n', '  <script src="replay-core.js"></script>\n', '  <script src="replay.js"></script>\n']) { assert.ok(html.includes(line)); html = html.replace(line, ''); }
  assert.equal(html, base('src/index.html'));
  assert.equal(read('bundle_app.py').replace("'physics-main.js', 'replay-core.js', 'replay.js', 'render-health.js'", "'physics-main.js', 'render-health.js'"), base('bundle_app.py'));
});
test('negative live guards reject every declared/frozen source drift and additional unknown gameplay modules', () => {
  for (const p of Object.keys(pins)) assert.throws(() => verify({ [p]: read(p) + '\n// unauthorized drift\n' }), e => e.code === 'ERR_ASSERTION' && e.message.includes(p));
  assert.throws(() => verify({ 'src/unapproved-extra.js': '' }), /Unknown replay scope/);
  assert.deepEqual(epoch.limits, { seconds: 300, bufferBytes: 33554432, npcMaximum: 52, sampleHz: 20, overwrite: false });
});
