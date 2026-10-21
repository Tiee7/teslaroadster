import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{createHash}from'node:crypto';import{motionHarness}from'./helpers/motion-harness.mjs';
const old=readFileSync(new URL('./fixtures/coast-terrain-v2-baseline/physics-main.js',import.meta.url),'utf8');
const hash=s=>createHash('sha256').update(s).digest('hex');
test('terrain-v2 preserves original V8 and existing world/taxi/vehicles/city-clock source identities',()=>{
 const identities=JSON.parse(readFileSync(new URL('../verification/coast-terrain-v2/unchanged-source-identities.json',import.meta.url))).sha256;
 for(const[file,expected]of Object.entries(identities))assert.equal(hash(readFileSync(new URL(`../src/${file}.js`,import.meta.url))),expected,file);
 assert.equal(hash(old),'c45d58b9fce4fb19b5928ca5d96700f7c332a9d737b60ba9b0ceee72dde007db');
});
for(const map of['highway','city'])for(const mode of['realistic','fantasy'])for(const control of['coast','throttle','brake','boost','steer','reverse','jump','lift','freefall','retro'])test(`actual ${map}/${mode}/${control} retains every numeric field Object.is for 300 fixed ticks`,()=>{
 const flying=['lift','freefall','retro'].includes(control),initial={x:map==='city'?5.25:2.5,y:flying?80:0,z:0,physicsMode:mode,speed:40,vx:0,vz:-40,vy:flying?-2:0,wasAirborne:flying,isFreefalling:control==='freefall',airRemaining:control==='freefall'?0:8};
 const before=motionHarness(initial,map,{'physics-main.js':old}),after=motionHarness(initial,map);
 for(const h of[before,after]){if(control==='throttle'||control==='steer')h.keys.KeyW=true;if(control==='boost')h.keys.Semicolon=true;if(control==='brake')h.keys.KeyH=true;if(control==='reverse')h.keys.KeyS=true;if(control==='steer')h.keys.KeyD=true;if(control==='lift')h.keys.Space=true;if(control==='retro')h.keys.KeyH=true;if(control==='jump'){h.state.isJumping6m=true;h.state.jumpStartY=0;h.state.jumpTargetY=6;h.state.vy=20.15;}}
 for(let tick=0;tick<300;tick++){
  if(tick===120){before.keys.KeyD=after.keys.KeyD=false;before.keys.KeyW=after.keys.KeyW=false;}
  before.step(1/60);after.step(1/60);
  for(const[key,value]of Object.entries(before.state))if(typeof value==='number'||typeof value==='boolean')assert.ok(Object.is(after.state[key],value),`${map}/${mode}/${control} tick${tick} ${key}: ${value} != ${after.state[key]}`);
  assert.deepEqual(after.impacts,before.impacts);
 }
});
