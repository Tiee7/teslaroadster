import { replayPins, replayHistoricalPath, readLiveSource } from './helpers/replay-source-epoch.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync,readdirSync}from'node:fs';import{createHash}from'node:crypto';
const read=p=>readFileSync(new URL('../' + replayHistoricalPath(p), import.meta.url),'utf8'),sha=s=>createHash('sha256').update(s).digest('hex');
const stability=JSON.parse(read('verification/drive-stability-20261022/source-epoch.json'));
const bridgeSide=JSON.parse(read('verification/coast-bridge-side-contact-20261022/source-epoch.json')),bridgeBottom=JSON.parse(read('verification/coast-bridge-bottom-contact-20261022/source-epoch.json')),pier=JSON.parse(read('verification/coast-pier-contact-20261022/source-epoch.json'));
const boundary=JSON.parse(read('verification/coast-boundary-20261022/source-epoch.json'));
const e=JSON.parse(read('verification/traffic-ground-regressions-20261022/source-epoch.json')),hullRepair=JSON.parse(read('verification/coast-hull-contact-20261022/source-epoch.json')),pins={...e.frozenSourceSha256,...e.authorizedSourceSha256,...hullRepair.authorizedSourceSha256,...stability.authorizedSourceSha256, ...boundary.authorizedSourceSha256,...pier.authorizedSourceSha256,...bridgeSide.authorizedSourceSha256,...bridgeBottom.authorizedSourceSha256,...JSON.parse(read('verification/highway-blast-height-20261022/source-epoch.json')).authorizedSourceSha256,...JSON.parse(read('verification/coast-building-separation-20261023/source-epoch.json')).authorizedSourceSha256, ...replayPins };
function verify(overrides={}){for(const p of Object.keys(overrides))assert.ok(Object.hasOwn(pins,p),'unknown source '+p);for(const[p,s]of Object.entries(pins))assert.equal(sha(Object.hasOwn(overrides,p)?overrides[p]:readLiveSource(p)),s,p);}
test('traffic repair explicitly succeeds3417 and keeps all old source epochs plus exact deployed counterexamples immutable',()=>{
 assert.equal(e.basePreview,'3417fa07d357b4231c36ac439caeb9460371cc31');assert.equal(e.mainUnchanged,'4451a11c9c09d031a9da037ce63afe4bb7f062e5');assert.match(e.publicationScope,/^preview-only; same PR20;/);
 assert.equal(sha(read(e.inheritedSinglePassengerEpoch)),'68442ed1df46856ee113e0bc900d9dcfa867fd6e92644bd562a0dfeb52460dff');assert.equal(e.inheritedSinglePassengerEpochSha256,sha(read(e.inheritedSinglePassengerEpoch)));
 for(const [p,f]of Object.entries(e.baselineSourceFixtures))assert.equal(sha(read(f.path)),f.sha256,p);
 for(const [p,f]of Object.entries(hullRepair.baselineSourceFixtures)){assert.equal(f.sha256,e.authorizedSourceSha256[p]);assert.equal(sha(read(f.path)),f.sha256,p);}
 assert.equal(e.baselineSourceFixtures['src/highway-traffic.js'].sha256,'ed27891b39a2f63e87134140cfc2abd54381a185e546f52c49c1cecde4c49b9a');
});
test('all live sources including single-seat, four prior improvements, approved assets and render safeguards stay pinned',()=>{verify();assert.deepEqual(Object.keys(pins).filter(p=>p.startsWith('src/')).sort(),readdirSync(new URL('../src/',import.meta.url)).map(f=>'src/'+f).sort());assert.equal(sha(read('src/taxi.js')),'5a228e3dd438fbcc0d4f5b5216608b09717ee6b975d05f094b879cc93aa0f88a');});
test('historical traffic-epoch physics delta is only queue intent routing in destroyed NPC aftermath, not driving or collision calculations',()=>{
 const before=read(e.baselineSourceFixtures['src/physics-main.js'].path),after=read(hullRepair.baselineSourceFixtures['src/physics-main.js'].path),strip=s=>s.replace(/\/\/[^\n]*/g,'').replace(/\s+/g,'');
 const addition='const refill = car.highwayWaitingToSpawn !== undefined ? highwayTraffic.retrySpawn : highwayTraffic.respawnBehind;';assert.equal(after.split(addition).length,2);
 assert.equal(strip(after.replace(addition,'').replace('refill(car, trafficCars, LANE_CENTERS,','highwayTraffic.respawnBehind(car, trafficCars, LANE_CENTERS,')),strip(before));
});
test('negative guards reject regression to finite rear-only traffic and any asset/physics/weather/passenger/ground drift',()=>{
 for(const p of ['src/highway-traffic.js','src/physics-main.js','src/vehicles.js','src/world.js','src/config.js','src/taxi.js','src/coast-road-network.js','src/coast-map.js','src/render-health.js'])assert.throws(()=>verify({[p]:p==='src/highway-traffic.js'?read(e.baselineSourceFixtures[p].path):read(p)+'\n// unauthorized drift\n'}),x=>x.code==='ERR_ASSERTION'&&x.message.includes(p));assert.throws(()=>verify({'src/new-gameplay.js':''}),/unknown source/);
});
