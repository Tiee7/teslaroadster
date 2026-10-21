import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{createHash}from'node:crypto';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8'),sha=s=>createHash('sha256').update(s).digest('hex'),base=p=>read('tests/fixtures/performance-passengers-baseline/'+p);
test('performance epoch freezes its exact prior-main fixtures and does not change any physical force kernel',()=>{
 const epoch=JSON.parse(read('verification/performance-passengers-20261021/source-epoch.json'));assert.equal(epoch.baseMain,'17dda06f0c417c6c01f8e066cb7897be75969f1a');for(const[file,want]of Object.entries(epoch.baselineFixtureSha256))assert.equal(sha(base(file)),want);
 const before=base('physics-main.js'),after=read('src/physics-main.js'),marker='// Scope the fixed clock';assert.equal(after.slice(0,after.indexOf(marker)),before.slice(0,before.indexOf(marker)),'all shared/map3 force, collision response, score, visual jet and audio argument code exact');
 const weather=s=>{const a=s.indexOf('const WEATHER_PRESETS ='),b=s.indexOf('\n];',a)+3;assert.ok(a>=0&&b>a);return s.slice(0,a)+'// WEATHER_OWNERSHIP\n'+s.slice(b);};assert.equal(weather(read('src/config.js')),weather(base('config.js')),'only weather energy changed, not metres/speed/control constants');
 const oldHud=base('ui-hud.js'),hud=read('src/ui-hud.js'),call='  window.RoadsterTaxi?.onReset();\n';assert.equal(hud.replace(call,'').replace('  if(coastSpawn){',call+'  if(coastSpawn){'),oldHud,'only move taxi reset behind real coast spawn/recovery');
});
