import { replayPins, replayHistoricalPath, readLiveSource } from './helpers/replay-source-epoch.mjs';
import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{createHash}from'node:crypto';import vm from'node:vm';
const read=p=>readFileSync(new URL('../' + replayHistoricalPath(p), import.meta.url),'utf8'),sha=s=>createHash('sha256').update(s).digest('hex'),base=p=>read('tests/fixtures/performance-passengers-baseline/'+p);
const successor=JSON.parse(read('verification/weather-ground-traffic-20261022/source-epoch.json'));
const stability=JSON.parse(read('verification/drive-stability-20261022/source-epoch.json'));
const historical=file=>read(file==='coast-road-network'?'tests/fixtures/coast-pier-baseline/coast-road-network.js':Object.hasOwn(successor.baselineFixtureSha256,file+'.js')?'tests/fixtures/weather-ground-traffic-baseline/'+file+'.js':stability.baselineSourceFixtures['src/'+file+'.js']?.path||'src/'+file+'.js');
// Normalize only these exact requested weather labels and the default's comment,
// never its numeric value, plus the already weather-owned preset region.
function weather(s){
 const allowed=[
  ['weathers: ["Night (T)", "Rainy Night (T)", "Dusk (T)", "Day (T)"]','weathers: ["Cyber Night (T)", "Cyber Neon Rain (T)", "Mars Sunset Dusk (T)", "Daylight (T)"]'],
  ['weathers: ["黑夜", "雨夜", "黄昏", "白天"]','weathers: ["星际暗夜 (T)", "赛博霓虹雨夜 (T)", "火星落日黄昏 (T)", "清朗日间 (T)"]'],
  ['let weatherIndex = 0;  // Night by default; keep legacy indices: night0/rain1/dusk2/day3.','let weatherIndex = 0;  // 0: Cyber Night, 1: Cyber Neon Rain, 2: Mars Sunset Dusk']
 ];
 for(const[next,prior]of allowed){assert.equal((s.split(next).length-1)+(s.split(prior).length-1),1,'unrecognized or duplicate weather-only delta');s=s.replace(next,prior);}
 const a=s.indexOf('const WEATHER_PRESETS ='),b=s.indexOf('\n];',a)+3;assert.ok(a>=0&&b>a);return s.slice(0,a)+'// WEATHER_OWNERSHIP\n'+s.slice(b);
}
const presets=s=>{const a=s.indexOf('const WEATHER_PRESETS ='),b=s.indexOf('\n];',a)+3,c=vm.createContext({});vm.runInContext(s.slice(a,b)+';globalThis.result=WEATHER_PRESETS;',c);return JSON.parse(JSON.stringify(c.result));};
const repairEpoch=JSON.parse(readFileSync(new URL('../verification/traffic-ground-regressions-20261022/source-epoch.json',import.meta.url),'utf8'));
const weatherEpochSource=file=>readFileSync(new URL('../'+(file==='src/coast-map.js'?'tests/fixtures/coast-building-separation-baseline/coast-map.js':repairEpoch.baselineSourceFixtures[file]?.path||stability.baselineSourceFixtures[file]?.path||file),import.meta.url),'utf8');
test('historical performance epoch is frozen; new city contact/skyline changes have an explicit authorized successor',()=>{
 const epoch=JSON.parse(read('verification/performance-passengers-20261021/source-epoch.json'));assert.equal(epoch.baseMain,'17dda06f0c417c6c01f8e066cb7897be75969f1a');for(const[file,want]of Object.entries(epoch.baselineFixtureSha256))assert.equal(sha(base(file)),want);
 const before=base('physics-main.js'),after=read('tests/fixtures/city-contact-baseline/physics-main.js'),marker='// Scope the fixed clock';assert.equal(after.slice(0,after.indexOf(marker)),before.slice(0,before.indexOf(marker)),'all shared/map3 force, collision response, score, visual jet and audio argument code exact');
 assert.equal(weather(read('src/config.js')),weather(base('config.js')),'only explicit weather labels/comment/presets changed, not metres/speed/control constants');
 const now=presets(read('src/config.js')),prior=presets(historical('config'));for(const list of[now,prior])for(const p of list){delete p.menuOrder;delete p.nameEn;delete p.nameZh;}assert.deepEqual(now,prior,'current request does not alter preset physical/lighting values or internal IDs');
 assert.notEqual(weather(read('src/config.js').replace('const WORLD_SPEED_SCALE = 1.65;','const WORLD_SPEED_SCALE = 1.66;')),weather(base('config.js')),'negative guard: physical scale cannot hide in weather ownership');
 assert.throws(()=>weather(read('src/config.js').replace('let weatherIndex = 0;','let weatherIndex = 3;')),/unrecognized/,'negative guard: default numeric value is not normalized');
 const oldHud=base('ui-hud.js'),hud=read('tests/fixtures/city-contact-baseline/ui-hud.js'),call='  window.RoadsterTaxi?.onReset();\n';assert.equal(hud.replace(call,'').replace('  if(coastSpawn){',call+'  if(coastSpawn){'),oldHud,'only move taxi reset behind real coast spawn/recovery');
 const next=JSON.parse(read('verification/city-contact-skyline-20261021/source-epoch.json'));assert.equal(next.baseMain,'39169ed88babd1089954212c499c6b0a94eb55d8');for(const[file,want]of Object.entries(next.authorizedSourceSha256))assert.equal(sha(read('tests/fixtures/city-cyber-baseline/'+file+'.js')),want);
 const cyber=JSON.parse(read('verification/city-cyber-20261021/source-epoch.json'));assert.equal(cyber.baseMain,'e95abccd1c0931cfa82c936415f517d3282edba3');for(const[file,want]of Object.entries(cyber.authorizedSourceSha256))assert.equal(sha(read('tests/fixtures/contact-sky-baseline/'+file+'.js')),want);
 const contact=JSON.parse(read('verification/contact-sky-20261021/source-epoch.json'));assert.equal(contact.baseMain,'13b9f5372034cd6ba3e14144433792c525989f63');for(const[file,want]of Object.entries(contact.authorizedSourceSha256))assert.equal(sha((file==='world'?read('tests/fixtures/render-instance-baseline/world.js'):historical(file))),want);
 const render=JSON.parse(read('verification/render-instance-20261022/source-epoch.json'));assert.equal(render.basePreview,'853f7a24e4b9c24969b9e64e4455c8b34caa6c7d');assert.equal(render.inheritedContactEpochSha256,sha(read('verification/contact-sky-20261021/source-epoch.json')));for(const[file,want]of Object.entries(render.inheritedDiagnosticSourceSha256))assert.equal(sha(historical(file)),want);for(const[file,want]of Object.entries(render.authorizedSourceSha256))assert.equal(sha(historical(file)),want);for(const[file,want]of Object.entries(render.frozenCoreSourceSha256))assert.equal(sha(historical(file)),want);
 assert.equal(successor.baseMain,'4451a11c9c09d031a9da037ce63afe4bb7f062e5');assert.equal(successor.inheritedRenderEpochSha256,sha(read('verification/render-instance-20261022/source-epoch.json')));for(const[file,want]of Object.entries(successor.authorizedSourceSha256))assert.equal(sha(weatherEpochSource(file)),want,file);
});
