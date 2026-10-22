// Historical stress fixture, NOT the current game's refill policy. Execute the
// unchanged production CPU harness, overriding only its highway-traffic read.
// No global fs monkeypatch, live state assignment, or production front refill.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const harnessUrl = new URL('./demo-harness.mjs', import.meta.url);
const trafficUrl = new URL('../fixtures/weather-ground-traffic-baseline/highway-traffic.js', import.meta.url);
const harness = readFileSync(harnessUrl, 'utf8'), traffic = readFileSync(trafficUrl, 'utf8');
const sha = value => createHash('sha256').update(value).digest('hex');
export const historicalTrafficFixture = Object.freeze({
  commit: '4451a11c9c09d031a9da037ce63afe4bb7f062e5',
  harnessSha256: '69868deb4aed37cc25c78828fdc9ef34eae4ffae217396b965807f7277f3feff',
  trafficSha256: 'faf6b646391504ea3661ec2e816b9b162ea3214fd0fea11c6d0f019b6cdfb108'
});
assert.equal(sha(harness), historicalTrafficFixture.harnessSha256, 'original harness must stay frozen; review adapter explicitly after any change');
assert.equal(sha(traffic), historicalTrafficFixture.trafficSha256, 'historical forward-refill traffic must be the exact4451 fixture');
let adapted = harness;
function replaceOnce(from, to) {
  assert.equal(adapted.split(from).length, 2, 'historical harness adapter exact anchor: ' + from);
  adapted = adapted.replace(from, to);
}
// A data-URL module needs an absolute base for its unchanged math import/read.
replaceOnce("import * as threeMathUtils from './vendor/three-r128-MathUtils.mjs';",
  `import * as threeMathUtils from ${JSON.stringify(new URL('./vendor/three-r128-MathUtils.mjs', harnessUrl).href)};`);
replaceOnce("const read = n => readFileSync(new URL(`../../src/${n}`, import.meta.url), 'utf8');",
  `const read = n => readFileSync(new URL(n === 'highway-traffic.js' ? ${JSON.stringify(trafficUrl.href)} : '../../src/' + n, ${JSON.stringify(harnessUrl.href)}), 'utf8');`);
// Every other source read still resolves to current src/. Only the historical
// test imports this isolated module; ordinary simulation stays untouched.
const historical = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(adapted));
export const historicalTrafficSimulation = historical.simulation;
