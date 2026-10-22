import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const sha = value => createHash('sha256').update(value).digest('hex');
const path = 'verification/single-passenger-20261022/source-epoch.json';
const epoch = JSON.parse(read(path));
const inherited = JSON.parse(read(epoch.inheritedWeatherEpoch));
const repair = JSON.parse(read('verification/traffic-ground-regressions-20261022/source-epoch.json'));
const hullRepair = JSON.parse(read('verification/coast-hull-contact-20261022/source-epoch.json'));
const stability=JSON.parse(read('verification/drive-stability-20261022/source-epoch.json'));
const pins = { ...epoch.frozenPreviewSourceSha256, ...epoch.authorizedSourceSha256, ...repair.authorizedSourceSha256, ...hullRepair.authorizedSourceSha256, ...stability.authorizedSourceSha256 };
function verify(overrides = {}) {
  for (const key of Object.keys(overrides)) assert.ok(Object.hasOwn(pins, key), 'unknown override: ' + key);
  for (const [key, want] of Object.entries(pins)) assert.equal(sha(Object.hasOwn(overrides, key) ? overrides[key] : read(key)), want, key);
}
test('single-seat epoch explicitly succeeds previewb580 while preserving its exact baseline and prior four-change source epoch', () => {
  assert.equal(epoch.schema, 'single-passenger-source-epoch-v1');
  assert.equal(epoch.basePreview, 'b58060ad60df3e46fa93f953f4441ce5b4388029');
  assert.equal(epoch.mainUnchanged, '4451a11c9c09d031a9da037ce63afe4bb7f062e5');
  assert.equal(epoch.inheritedWeatherEpochSha256, 'e8fba7c5d5ed507e9a28cfe5c7e07d636d6904d5ab05319220c564fa06e28eb9');
  assert.equal(sha(read(epoch.inheritedWeatherEpoch)), epoch.inheritedWeatherEpochSha256);
  assert.equal(epoch.baselineFixture.sourceCommit, epoch.basePreview);
  assert.equal(epoch.baselineFixture.sourcePath, 'src/taxi.js');
  assert.equal(epoch.baselineFixture.sha256, inherited.frozenUnchangedSourceSha256['src/taxi.js']);
  assert.equal(sha(read(epoch.baselineFixture.path)), '9c72de76b21486b8f08e5abd08bc326c1920b02362448d597feaf12ceff879d2');
  assert.deepEqual(Object.keys(epoch.authorizedSourceSha256), ['src/taxi.js']);
  assert.match(epoch.publicationScope, /^preview-only; same PR20; no main\/production authorization$/);
});
test('capacity is the sole model behavior delta; scene lifecycle, collision/fare/arrival rules and all non-help adapter code remain exact', () => {
  const before = read(epoch.baselineFixture.path), after = read('src/taxi.js'), marker = '// Scene adapter:';
  assert.equal(after.split('const CAPACITY = 1;').length - 1, 1);
  const model = s => s.slice(0, s.indexOf(marker)).replace(/\/\/[^\n]*/g, '');
  assert.equal(model(after).replace('const CAPACITY = 1;', 'const CAPACITY = 10;'), model(before));
  const adapter = s => {
    const code = s.slice(s.indexOf(marker)), start = code.indexOf('const instructions = isZh()');
    const end = code.indexOf('\n    if (help) help.textContent = instructions;', start);
    assert.ok(start >= 0 && end > start); return code.slice(0, start) + '// AUTHORIZED HELP TEXT' + code.slice(end);
  };
  assert.equal(adapter(after), adapter(before));
});
test('every live source stays pinned through the explicit traffic repair successor; approved assets, passenger and render safeguards stay unchanged', () => {
  verify();
  const prior = { ...inherited.authorizedSourceSha256, ...inherited.frozenUnchangedSourceSha256, ...inherited.frozenApprovedVehicleAssetSourceSha256 };
  delete prior['src/taxi.js']; assert.deepEqual(epoch.frozenPreviewSourceSha256, prior);
  const actual = readdirSync(new URL('../src/', import.meta.url)).map(name => 'src/' + name).sort();
  assert.deepEqual(Object.keys(pins).filter(name => name.startsWith('src/')).sort(), actual);
});
test('negative guards reject restored multiseat capacity, vehicle/physics/weather/traffic drift and unlisted source changes', () => {
  for (const key of ['src/taxi.js', 'src/vehicles.js', 'src/physics-main.js', 'src/config.js', 'src/coast-map.js', 'src/highway-traffic.js', 'src/render-health.js']) {
    const value = key === 'src/taxi.js' ? read(key).replace('const CAPACITY = 1;', 'const CAPACITY = 10;') : read(key) + '\n// unapproved drift\n';
    assert.throws(() => verify({ [key]: value }), error => error.code === 'ERR_ASSERTION' && error.message.includes(key));
  }
  assert.throws(() => verify({ 'src/new-passenger-gameplay.js': '' }), /unknown override/);
});
