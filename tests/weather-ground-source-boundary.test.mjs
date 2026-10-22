import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const sha = value => createHash('sha256').update(value).digest('hex');
const epoch = JSON.parse(read('verification/weather-ground-traffic-20261022/source-epoch.json'));
const single = JSON.parse(read('verification/single-passenger-20261022/source-epoch.json'));
const repair = JSON.parse(read('verification/traffic-ground-regressions-20261022/source-epoch.json'));
const hullRepair = JSON.parse(read('verification/coast-hull-contact-20261022/source-epoch.json'));
const stability=JSON.parse(read('verification/drive-stability-20261022/source-epoch.json'));
const boundary=JSON.parse(read('verification/coast-boundary-20261022/source-epoch.json'));
const weatherSource = path => path === single.baselineFixture.sourcePath ? read(single.baselineFixture.path) : repair.baselineSourceFixtures[path] ? read(repair.baselineSourceFixtures[path].path) : stability.baselineSourceFixtures[path] ? read(stability.baselineSourceFixtures[path].path) : read(path);
const exact4451Baseline = {
  "coast-map.js": "ee0a881e0d1647de70d4403002a0f0f9fbadddceca5c15ad758cf25a13dd91de",
  "config.js": "fc0d2ee01f9201cb218afab912bb64ed69ac1de786a0ca4574df9a9dbb30a0c4",
  "demo-numeric-projection.js": "f0619bb3d1bec313a1ad612219d903fb49b0d1a5965e55d21e64e6f0faf9b90b",
  "emit-browser-static-projection.mjs": "7d81343ac9d3c4779c6502c0b2f411cfa5847b459d5028efc34df9ac9ff48bb8",
  "generate-numeric-projection-kernel.mjs": "44b4b92b6296891233a3aa55df91e98c9080d2da7c82f7f8f13b547f66236fd1",
  "highway-traffic.js": "faf6b646391504ea3661ec2e816b9b162ea3214fd0fea11c6d0f019b6cdfb108",
  "index.html": "4ca460865f868d06c3d92f5eacf210ff2450e5418dfc8f0a9be89be1a9bbb4f0",
  "physics-main.js": "ca6dd107d4d81f3b628d7752d1ed6422e4e2e0495263aa4768da58e739907302",
  "start-screen.js": "c716db5e4726bcae7830ff978fbf2302788df5f7a794d1088dd4697545b4c58d",
  "ui-hud.js": "6481528ea36f007ddb206b387a263764436c11c7e3192431c60974510773ca05",
  "world.js": "c58a5fd0e7ec712452dba8214178afeb58e509ee96e7fa1fa62cce61684bee23"
};
const approved = [
  'src/coast-map.js', 'src/config.js', 'src/demo-numeric-projection.js', 'src/highway-traffic.js',
  'src/index.html', 'src/physics-main.js', 'src/start-screen.js', 'src/ui-hud.js', 'src/world.js',
  'verification/demo-continuous/emit-browser-static-projection.mjs',
  'verification/demo-continuous/generate-numeric-projection-kernel.mjs'
].sort();
const renderPath = 'verification/render-instance-20261022/source-epoch.json';
const inheritedRenderHash = 'ef00b4e5cbec254f0daadd69ff39141958bb31ef17120a10244dc6385197e529';
function verifyCurrent(overrides = {}) {
  const historicalPins = { ...epoch.authorizedSourceSha256, ...epoch.frozenUnchangedSourceSha256, ...epoch.frozenApprovedVehicleAssetSourceSha256 };
  for (const [path, expected] of Object.entries(historicalPins)) assert.equal(sha(weatherSource(path)), expected, 'weather epoch baseline: ' + path);
  const pins = { ...historicalPins, ...single.authorizedSourceSha256, ...repair.authorizedSourceSha256, ...hullRepair.authorizedSourceSha256, ...stability.authorizedSourceSha256, ...boundary.authorizedSourceSha256 };
  for (const path of Object.keys(overrides)) assert.ok(Object.hasOwn(pins, path), 'unknown override: ' + path);
  for (const [path, expected] of Object.entries(pins)) assert.equal(sha(Object.hasOwn(overrides, path) ? overrides[path] : read(path)), expected, path);
}
test('weather/ground/traffic epoch succeeds production4451 explicitly and keeps all historical fixtures/epochs immutable', () => {
  assert.equal(epoch.schema, 'weather-ground-traffic-source-epoch-v1');
  assert.equal(epoch.baseMain, '4451a11c9c09d031a9da037ce63afe4bb7f062e5');
  assert.equal(epoch.baselineFixtureSourceCommit, epoch.baseMain);
  assert.equal(epoch.inheritedRenderEpoch, renderPath);
  assert.equal(epoch.inheritedRenderEpochSha256, inheritedRenderHash);
  assert.equal(sha(read(renderPath)), inheritedRenderHash);
  assert.deepEqual(epoch.baselineFixtureSha256, exact4451Baseline);
  assert.deepEqual(readdirSync(new URL('./fixtures/weather-ground-traffic-baseline/', import.meta.url)).sort(), Object.keys(exact4451Baseline).sort());
  for (const [name, expected] of Object.entries(exact4451Baseline)) {
    assert.equal(sha(read(epoch.baselineFixtureDirectory + name)), expected, name);
    const path = name.endsWith('.mjs') ? 'verification/demo-continuous/' + name : 'src/' + name;
    assert.equal(epoch.baselineFixtureSourcePath[name], path);
  }
  assert.deepEqual(Object.keys(epoch.authorizedSourceSha256).sort(), approved);
  assert.equal(epoch.scope.length, 4, 'only the four requested improvements');
  assert.match(epoch.publicationScope, /^preview-only;.*no main\/production authorization$/);
});
test('latest epoch checks actual current sources and preserves all approved asset modules and both render safeguards', () => {
  verifyCurrent();
  const render = JSON.parse(read(renderPath));
  const assets = ['vehicles', 'reference-exterior', 'reference-cockpit', 'npc-traffic-assets', 'reference-traffic'];
  const frozen = Object.fromEntries(assets.map(name => ['src/' + name + '.js', render.frozenCoreSourceSha256[name]]));
  assert.deepEqual(epoch.frozenApprovedVehicleAssetSourceSha256, frozen);
  const liveSourcePaths = readdirSync(new URL('../src/', import.meta.url)).map(name => 'src/' + name).sort();
  const pinnedSourcePaths = [...Object.keys(epoch.authorizedSourceSha256).filter(path => path.startsWith('src/')), ...Object.keys(epoch.frozenUnchangedSourceSha256)].sort();
  assert.deepEqual(pinnedSourcePaths, liveSourcePaths, 'every source file is authorized or remains frozen, none disappears from verification');
  assert.match(read('src/world.js'), /mesh\.setColorAt\(i,color\.setHex\(record\.color\?\?0xffffff\)\)/);
  assert.equal(sha(read('src/render-health.js')), render.authorizedSourceSha256['render-health']);
  assert.match(read('src/render-health.js'), /if \(!window\.RoadsterRenderHealth\.isPaused\(\)\) return runFrame/);
});
test('epoch negative guards reject unapproved core-asset, authorized-source and projection-pin drift', () => {
  for (const path of ['src/taxi.js', 'src/vehicles.js', 'src/config.js', 'src/physics-main.js', 'src/demo-numeric-projection.js', 'verification/demo-continuous/generate-numeric-projection-kernel.mjs']) {
    assert.throws(() => verifyCurrent({ [path]: read(path) + '\n// unauthorized drift\n' }), error => error.code === 'ERR_ASSERTION' && error.message.includes(path));
  }
  assert.throws(() => verifyCurrent({ 'unlisted-module.js': '' }), /unknown override/);
});
