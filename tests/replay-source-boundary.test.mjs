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
  assert.deepEqual(Object.keys(epoch.authorizedSourceSha256).sort(), ['bundle_app.py', 'index.html', 'src/index.html', 'src/leaderboard.js', 'src/mobile-controls.js', 'src/replay-core.js', 'src/replay.js', 'src/styles.css', 'src/taxi.js', 'src/headlight-projection.js'].sort());
  assert.equal(read('src/taxi.js').replace("    markerGroup.name = 'taxi-passenger-markers';\n", ''), base('src/taxi.js'));
  let ranked = read('src/leaderboard.js'); for (const guard of ['    if (window.RoadsterReplay?.isActive?.()) return;\n', '    if (window.RoadsterReplay?.isBusy?.()) return;\n', '    if (window.RoadsterReplay?.isBusy?.()) return;\n']) { assert.ok(ranked.includes(guard)); ranked = ranked.replace(guard, ''); }
  assert.equal(ranked, base('src/leaderboard.js'));
  assert.equal(read('src/mobile-controls.js').replace('    if (window.RoadsterReplay?.isActive?.()) return true;\n', ''), base('src/mobile-controls.js'));
  const css = read('src/styles.css'), marker = '\n/* Local temporary replay controls;'; assert.equal(css.split(marker).length, 2); assert.equal(css.slice(0, css.indexOf(marker)), base('src/styles.css'));
  let html = read('src/index.html').replace('        <span id="headlight-status" class="text-xs text-amber-300" role="status" hidden></span>\n', ''); const start = html.indexOf('  <section id="replay-panel"'), end = html.indexOf('  <!-- Modular Functional Scripts -->', start); assert.ok(start > 0 && end > start); html = html.slice(0, start) + html.slice(end);
  for (const line of ['      <button id="btn-replay" type="button" class="ranked-button" aria-controls="replay-panel">Replay</button>\n', '  <script src="replay-core.js"></script>\n', '  <script src="replay.js"></script>\n', '  <script src="headlight-projection.js"></script>\n']) { assert.ok(html.includes(line)); html = html.replace(line, ''); }
  assert.equal(html, base('src/index.html'));
  assert.equal(read('bundle_app.py').replace("'ui-hud.js', 'headlight-projection.js'", "'ui-hud.js'").replace("'physics-main.js', 'replay-core.js', 'replay.js', 'render-health.js'", "'physics-main.js', 'render-health.js'"), base('bundle_app.py'));
});
test('negative live guards reject every declared/frozen source drift and additional unknown gameplay modules', () => {
  for (const p of Object.keys(pins)) assert.throws(() => verify({ [p]: read(p) + '\n// unauthorized drift\n' }), e => e.code === 'ERR_ASSERTION' && e.message.includes(p));
  assert.throws(() => verify({ 'src/unapproved-extra.js': '' }), /Unknown replay scope/);
  assert.deepEqual(epoch.limits, { seconds: 300, bufferBytes: 33554432, npcMaximum: 52, sampleHz: 20, overwrite: false });
});
test('autopilot replay succeeds the immutable first RAM epoch without changing its sample fields or numerical owners', () => {
  const epoch = JSON.parse(read('verification/ram-replay-autopilot-20261024/source-epoch.json'));
  assert.equal(epoch.baseCommit, '2e47ce901e0bf5a52bc18cebde601d045042371c');
  const oldText = read(epoch.inheritedReplayEpoch), old = JSON.parse(oldText);
  assert.equal(sha(oldText), epoch.inheritedReplayEpochSha256);
  assert.deepEqual(epoch.iterationChangedSources, ['index.html', 'src/replay.js']);
  assert.deepEqual(Object.keys(epoch.authorizedSourceSha256).filter(p => epoch.authorizedSourceSha256[p] !== old.authorizedSourceSha256[p]).sort(), epoch.iterationChangedSources);
  assert.deepEqual(epoch.frozenSourceSha256, old.frozenSourceSha256);
  const previous = read(epoch.previousReplaySourceFixture.path), current = read('tests/fixtures/replay-camera-lighting-baseline/replay.js');
  assert.equal(sha(previous), epoch.previousReplaySourceFixture.sha256); assert.equal(sha(previous), old.authorizedSourceSha256['src/replay.js']);
  const unchanged = [['function buildBindings()', 'const trafficToken'], ['function dataFor(', 'function applyOne('], ['function applyOne(', 'function snapshotLive('], ['function capture(', 'function afterTick('], ['function afterTick(', 'function releaseClip('], ['function renderFrame(', 'function frame('], ['function frame(', 'function renderUi(']];
  for (const [start, end] of unchanged) {
    const section = source => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
    assert.ok(section(previous).length > 20); assert.equal(section(current), section(previous), start);
  }
  assert.equal(sha(read('src/highway-demo.js')), old.frozenSourceSha256['src/highway-demo.js']);
  assert.equal(sha(read('src/physics-main.js')), old.frozenSourceSha256['src/physics-main.js']);
});

test('camera/lighting successor preserves immutable autopilot evidence, model/numerical owners and every vehicle sample field', () => {
  assert.equal(epoch.baseCommit, '26984ab7c8938235b42f8c9bfdc0dab49d670a22');
  const oldText = read(epoch.inheritedAutopilotReplayEpoch), old = JSON.parse(oldText); assert.equal(sha(oldText), epoch.inheritedAutopilotReplayEpochSha256);
  assert.deepEqual(epoch.iterationChangedSources, ['bundle_app.py', 'index.html', 'src/headlight-projection.js', 'src/index.html', 'src/replay.js']);
  assert.deepEqual(Object.keys(epoch.authorizedSourceSha256).filter(p => epoch.authorizedSourceSha256[p] !== old.authorizedSourceSha256[p]).sort(), epoch.iterationChangedSources);
  for (const [p,h] of Object.entries(epoch.frozenSourceSha256)) assert.equal(h, old.frozenSourceSha256[p], p);
  for (const [p,f] of Object.entries(epoch.cameraLightingBaselineSourceFixtures)) { assert.equal(sha(read(f.path)), f.sha256, p); assert.equal(f.sha256, old.authorizedSourceSha256[p] || old.frozenSourceSha256[p]); }
  const previous = read(epoch.cameraLightingBaselineSourceFixtures['src/replay.js'].path), current = read('src/replay.js');
  const section = (source, start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
  for (const [a,b] of [['function buildBindings()', 'const trafficToken'], ['function applyOne(', 'function snapshotLive('], ['function capture(', 'function afterTick('], ['function frame(', 'function renderUi(']]) assert.equal(section(current,a,b),section(previous,a,b),a);
  const data = section(current, 'function dataFor(', 'function applyOne(').replace('    // Wrapped road props have no wheel/steering animation: use their existing\n    // auxiliary slot for unwrapped road translation, without a new sample row.\n','').replace('binding.wrap ? roadScroll : ',''); assert.equal(data, section(previous, 'function dataFor(', 'function applyOne('));
  const oldHud = read(epoch.cameraLightingBaselineSourceFixtures['src/ui-hud.js'].path), hud = read('src/ui-hud.js'), a = 'function syncVehicleWeatherLights(', b = 'function cycleWeatherMode(';
  assert.equal(hud, oldHud, 'immutable UI / numeric identity');
  assert.doesNotMatch(read('src/headlight-projection.js'), /(?:state\.[a-zA-Z]+\s*=|resetCar\s*\(|updateSimulation\s*\(|fetch\s*\(|localStorage)/);
  assert.equal(sha(read('src/replay-core.js')),old.authorizedSourceSha256['src/replay-core.js']); verify();
});
