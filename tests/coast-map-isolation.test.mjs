import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{createHash}from'node:crypto';import{motionHarness}from'./helpers/motion-harness.mjs';
import { replayHistoricalPath } from './helpers/replay-source-epoch.mjs';
const baselineDir=new URL('./fixtures/driving-feedback-baseline/',import.meta.url);
const baseline=Object.fromEntries(['physics-main.js','config.js'].map(file=>[file,readFileSync(new URL(file,baselineDir),'utf8')]));
const hash=s=>createHash('sha256').update(s).digest('hex');
const successor=JSON.parse(readFileSync(new URL('../verification/weather-ground-traffic-20261022/source-epoch.json',import.meta.url)));
// Exact production4451 and previewb580 fixtures retain historical bytes; current sources have explicit successor guards.
const stability=JSON.parse(readFileSync(new URL('../verification/drive-stability-20261022/source-epoch.json',import.meta.url)));
const historicalSource=file=>new URL(file==='coast-road-network'?'./fixtures/coast-pier-baseline/coast-road-network.js':file==='taxi'?'./fixtures/single-passenger-baseline/taxi.js':Object.hasOwn(successor.baselineFixtureSha256,file+'.js')?'./fixtures/weather-ground-traffic-baseline/'+file+'.js':stability.baselineSourceFixtures['src/'+file+'.js']?'../'+stability.baselineSourceFixtures['src/'+file+'.js'].path:'../'+replayHistoricalPath('src/'+file+'.js'),import.meta.url);

const repairEpoch=JSON.parse(readFileSync(new URL('../verification/traffic-ground-regressions-20261022/source-epoch.json',import.meta.url),'utf8'));
const weatherEpochSource=file=>readFileSync(new URL('../'+(file==='src/coast-map.js'?'tests/fixtures/coast-building-separation-baseline/coast-map.js':file==='src/coast-road-network.js'?'tests/fixtures/coast-pier-baseline/coast-road-network.js':repairEpoch.baselineSourceFixtures[file]?.path||stability.baselineSourceFixtures[file]?.path||file),import.meta.url),'utf8');
test('driving-feedback epoch explicitly owns authorized changes and freezes prior-main baseline',()=>{
 const contract=JSON.parse(readFileSync(new URL('../verification/driving-feedback-20261021/source-epoch.json',import.meta.url)));
 const quiet=JSON.parse(readFileSync(new URL('../verification/quiet-h-brake-20261021/source-epoch.json',import.meta.url)));assert.equal(quiet.baseMain,'42db2bb744c8b4c42bebb34360030ff05cd10484');assert.equal(hash(readFileSync(new URL('../'+quiet.inheritedSourceEpoch,import.meta.url))),quiet.inheritedSourceEpochSha256);
 const perf=JSON.parse(readFileSync(new URL('../verification/performance-passengers-20261021/source-epoch.json',import.meta.url)));assert.equal(perf.baseMain,'17dda06f0c417c6c01f8e066cb7897be75969f1a');assert.equal(hash(readFileSync(new URL('../'+perf.inheritedSourceEpoch,import.meta.url))),perf.inheritedSourceEpochSha256);
 const city=JSON.parse(readFileSync(new URL('../verification/city-contact-skyline-20261021/source-epoch.json',import.meta.url)));assert.equal(city.baseMain,'39169ed88babd1089954212c499c6b0a94eb55d8');assert.equal(hash(readFileSync(new URL('../'+city.inheritedSourceEpoch,import.meta.url))),city.inheritedSourceEpochSha256);for(const[file,want]of Object.entries(city.baselineFixtureSha256))assert.equal(hash(readFileSync(new URL('./fixtures/city-contact-baseline/'+file,import.meta.url))),want);
 const cyber=JSON.parse(readFileSync(new URL('../verification/city-cyber-20261021/source-epoch.json',import.meta.url)));assert.equal(cyber.baseMain,'e95abccd1c0931cfa82c936415f517d3282edba3');assert.equal(hash(readFileSync(new URL('../'+cyber.inheritedSourceEpoch,import.meta.url))),cyber.inheritedSourceEpochSha256);
 for(const[file,want]of Object.entries(cyber.baselineFixtureSha256))assert.equal(hash(readFileSync(new URL('./fixtures/city-cyber-baseline/'+file,import.meta.url))),want);for(const[file,want]of Object.entries(cyber.unchangedSourceSha256))assert.equal(hash(readFileSync(historicalSource(file))),want);
 const contact=JSON.parse(readFileSync(new URL('../verification/contact-sky-20261021/source-epoch.json',import.meta.url)));assert.equal(contact.baseMain,'13b9f5372034cd6ba3e14144433792c525989f63');assert.equal(hash(readFileSync(new URL('../'+contact.inheritedSourceEpoch,import.meta.url))),contact.inheritedSourceEpochSha256);for(const[file,want]of Object.entries(contact.baselineFixtureSha256))assert.equal(hash(readFileSync(new URL('./fixtures/contact-sky-baseline/'+file,import.meta.url))),want);
 const render=JSON.parse(readFileSync(new URL('../verification/render-instance-20261022/source-epoch.json',import.meta.url)));assert.equal(render.basePreview,'853f7a24e4b9c24969b9e64e4455c8b34caa6c7d');assert.equal(hash(readFileSync(new URL('../'+render.inheritedContactEpoch,import.meta.url))),render.inheritedContactEpochSha256);assert.equal(hash(readFileSync(new URL('./fixtures/render-instance-baseline/world.js',import.meta.url))),render.priorWorldSha256);
 for(const[file,expected]of Object.entries({...contract.currentSourceSha256,...quiet.authorizedSourceSha256,...perf.authorizedSourceSha256,...city.authorizedSourceSha256,...cyber.authorizedSourceSha256,...contact.authorizedSourceSha256,...render.inheritedDiagnosticSourceSha256,...render.authorizedSourceSha256}))assert.equal(hash(readFileSync(historicalSource(file))),expected,file);
 for(const[file,expected]of Object.entries(contract.baselineFixtureSha256))assert.equal(hash(baseline[file]),expected,file);
 assert.equal(contract.baseMain,'2efc2477d329b4aaef873a014f2dc8331a13fbc3');
 assert.equal(successor.baseMain,'4451a11c9c09d031a9da037ce63afe4bb7f062e5');assert.equal(hash(readFileSync(new URL('../'+successor.inheritedRenderEpoch,import.meta.url))),successor.inheritedRenderEpochSha256);for(const[file,expected]of Object.entries(successor.authorizedSourceSha256))assert.equal(hash(weatherEpochSource(file)),expected,file);
});
test('historical highway planner/traffic/clock bytes remain frozen; authorized Map1 rear-respawn has a separate current epoch',()=>{
 const identities=JSON.parse(readFileSync(new URL('../verification/coast-terrain-v2/unchanged-source-identities.json',import.meta.url))).sha256;
 for(const file of['highway-demo','highway-traffic','city-clock'])assert.equal(hash(readFileSync(historicalSource(file))),identities[file],file);
});
for(const map of['highway','city'])for(const mode of['realistic','fantasy'])for(const control of['coast','throttle','brake','boost','steer','reverse','jump','lift','freefall','retro'])test(`actual ${map}/${mode}/${control} retains every numeric field Object.is for 300 fixed ticks`,()=>{
 const flying=['lift','freefall','retro'].includes(control),initial={x:map==='city'?5.25:2.5,y:flying?80:0,z:0,physicsMode:mode,speed:40,vx:0,vz:-40,vy:flying?-2:0,wasAirborne:flying,isFreefalling:control==='freefall',airRemaining:control==='freefall'?0:8};
 const before=motionHarness(initial,map,baseline),after=motionHarness(initial,map);
 for(const h of[before,after]){if(control==='throttle'||control==='steer')h.keys.KeyW=true;if(control==='boost')h.keys.Semicolon=true;if(control==='brake')h.keys.KeyH=true;if(control==='reverse')h.keys.KeyS=true;if(control==='steer')h.keys.KeyD=true;if(control==='lift')h.keys.Space=true;if(control==='retro')h.keys.KeyH=true;if(control==='jump'){h.state.isJumping6m=true;h.state.jumpStartY=0;h.state.jumpTargetY=6;h.state.vy=20.15;}}
 for(let tick=0;tick<300;tick++){
  if(tick===120){before.keys.KeyD=after.keys.KeyD=false;before.keys.KeyW=after.keys.KeyW=false;}
  before.step(1/60);after.step(1/60);
  for(const[key,value]of Object.entries(before.state))if(typeof value==='number'||typeof value==='boolean')assert.ok(Object.is(after.state[key],value),`${map}/${mode}/${control} tick${tick} ${key}: ${value} != ${after.state[key]}`);
  assert.deepEqual(after.impacts,before.impacts);
 }
});
