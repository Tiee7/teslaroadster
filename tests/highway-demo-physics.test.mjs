import test from 'node:test';
import assert from 'node:assert/strict';
import { simulation, car, lanes } from './helpers/demo-harness.mjs';
import { candidateHarness } from './helpers/demo-candidate-harness.mjs';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../src/highway-demo.js',import.meta.url),'utf8').split('// UI/lifecycle adapter.')[0];
const modes=[30,60,144];
for(const fps of modes) test(`real input from rest, full ground throttle, paid boost and centered cruise at ${fps} Hz`,()=>{
  const h=simulation();let previous=0,peak=0,burn=0,recharge=0;
  for(let i=0;i<fps*30;i++){
    const gas=h.state.airRemaining,frame=h.step(1/fps);
    assert.equal(frame.frame.input.throttle,1);assert.equal(frame.frame.input.lift,0);assert.equal(frame.frame.input.brake,0);
    assert.ok(h.state.speed-previous<=40/fps+.01,'normal propulsion bounds acceleration');
    previous=h.state.speed;peak=Math.max(peak,previous*3.6);
    if(h.state.airRemaining<gas)burn++;else if(h.state.airRemaining>gas)recharge++;
    assert.ok(h.state.airRemaining>=0&&h.state.airRemaining<=10);
    assert.ok(Math.abs(h.state.x-2.5)<1e-9);assert.equal(h.state.isDestroyed,false);
  }
  assert.ok(peak>=360);assert.ok(h.state.speed*3.6>220);assert.ok(burn>0&&recharge>0);assert.equal(h.launches.length,0);
});
for(const fps of modes) test(`slow front driver uses a complete adjacent lane rather than a stripe at ${fps} Hz`,()=>{
  const h=simulation({speed:65,vz:-65},[car(3,-150,22)]);let maxStripe=0,stripe=0;
  for(let i=0;i<fps*6;i++){
    h.step(1/fps);const gap=Math.min(...lanes.map(x=>Math.abs(x-h.state.x)));
    stripe=gap>.9?stripe+1/fps:0;maxStripe=Math.max(maxStripe,stripe);
  }
  assert.equal(h.state.isDestroyed,false);assert.equal(h.impacts.length,0);assert.equal(h.launches.length,0);
  assert.ok(h.stats().completed>=1);assert.ok(maxStripe<.8);assert.ok(Math.min(...lanes.map(x=>Math.abs(x-h.state.x)))<.4);
});

test('fast rear approach blocks its target lane while the other adjacent gap is used',()=>{
  const h=simulation({speed:65,vz:-65},[car(3,-30,22),car(2,20,100)]);
  for(let i=0;i<60&&h.stats().started===0;i++)h.step(1/60);assert.equal(h.stats().targetLane,4);
  for(let i=0;i<180;i++)h.step(1/60);
  assert.equal(h.impacts.length,0);assert.equal(h.state.isDestroyed,false);assert.ok(h.stats().completed>=1);
});

// Physical-model unit: the pure complete candidate is explicitly dispatched.
// This does not claim that a cold finite-budget planner admits it in one step.
test('a complete low candidate clears the unchanged 20m wall through paid O and ordinary airborne inputs',()=>{
  const u=candidateHarness({speed:65,vz:-65},lanes.map((_,i)=>car(i,-20,22))),{h}=u;
  const {option}=u.candidate(2.3,3);assert.ok(option);u.dispatch(option);
  let peak=0,airSeconds=0,airBoost=0,airGas=0,landed=false;
  for(let i=0;i<240;i++){
    const f=h.step(1/60);if(!f)break;peak=Math.max(peak,h.state.y);
    if(f.isAirborne){airSeconds+=1/60;if(f.isRearThrusterFiring)airBoost++;airGas+=f.airConsumedThisFrame;assert.equal(f.frame.input.throttle,0);assert.equal(f.frame.input.boost,0);assert.equal(f.frame.input.lift,0);}
    if(h.launches.length&&h.state.y===0)landed=true;
  }
  assert.equal(h.launches.length,1);assert.ok(peak>=2&&peak<4);assert.ok(airSeconds<2.5);assert.equal(airBoost,0);assert.ok(airGas>1);assert.equal(landed,true);
  assert.equal(h.impacts.length,0);assert.equal(h.state.isDestroyed,false);assert.ok(h.state.speed*3.6>=220);
});

test('cold 20m wall boundary keeps real collisions when the finite proof is not ready',()=>{
  const h=simulation({speed:65,vz:-65},lanes.map((_,i)=>car(i,-20,22)));
  const first=h.step(1/60);assert.equal(first.frame.jump,false);assert.equal(h.stats().preparedCommits,0);
  assert.ok(h.stats().maxBackgroundWork<=192,'an urgent wall cannot force a synchronous drain');
  for(let i=1;i<60&&!h.state.isDestroyed;i++)h.step(1/60);
  assert.equal(h.launches.length,0);assert.ok(h.impacts.length>0,'known cold-start safety boundary remains observable');
  assert.equal(h.state.isDestroyed,true,'the real fatal collision is not suppressed');
});

test('empty tank cannot create boost, jump or refill; ordinary grounded recharge is bounded',()=>{
  const h=simulation({speed:65,vz:-65,airRemaining:0,isFreefalling:true});
  let previous=0;
  for(let i=0;i<60;i++){
    const f=h.step(1/60);assert.equal(f.frame.jump,false);assert.equal(f.isRearThrusterFiring,false);
    assert.ok(h.state.airRemaining-previous<=3.4/60+1e-9);previous=h.state.airRemaining;
  }
  assert.ok(h.state.airRemaining>2.5&&h.state.airRemaining<3.5);assert.equal(h.state.isFreefalling,false);
});

test('planner is read-only, ignores waiting/hidden traffic and always targets whole lane centers',()=>{
  const context=vm.createContext({});vm.runInContext(source+'\nglobalThis.api=RoadsterHighwayDemoPlanner;',context);
  const planner=context.api.create(lanes,1.65),player=Object.freeze({x:2.5,y:0,vx:0,vz:-65,speed:65,airRemaining:10,physicsMode:'realistic'});
  const obstacle=car(3,-2,0,{highwayWaitingToSpawn:true});obstacle.mesh.visible=false;
  const before=JSON.stringify(obstacle);const frame=planner.step(player,[obstacle],1/60);
  assert.equal(JSON.stringify(obstacle),before);assert.equal(frame.jump,false);assert.equal(frame.input.throttle,1);assert.equal(frame.input.boost,1);assert.equal(frame.targetLane,3);
});

for(const fps of [30,60,144])test(`planned finite hop covers the real paid arc through touchdown at ${fps} Hz`,()=>{
 const h=simulation({speed:65,vz:-65},lanes.map((_,i)=>car(i,-80,22)));
 let launch=null,land=null,planned=null,air=0;
 for(let i=0;i<4*fps&&!h.state.isDestroyed;i++){
  const result=h.step(1/fps);
  if(result.frame.jump&&launch===null){launch=i/fps;planned=result.frame;}
  if(result.isAirborne){air+=1/fps;assert.equal(result.frame.input.throttle,0);assert.equal(result.frame.input.boost,0);assert.equal(result.frame.input.lift,0);}
  if(launch!==null&&h.state.y===0){land=(i+1)/fps;break;}
 }
 assert.notEqual(launch,null);assert.notEqual(land,null);assert.ok(planned.jumpHeight>=2.3&&planned.jumpHeight<=7.5);
 assert.ok(Math.abs((land-launch)-(planned.jumpGraceSeconds-.18))<=1/fps+1e-8,'profile uses the real frame-time landing phases');
 assert.ok(land-launch<2.4);assert.ok(h.state.airRemaining<10);assert.equal(h.impacts.length,0);
});

for(const fps of [30,60,144])for(const height of [2.3,4.5,7.5,10])test(`finite ${height}m demo profile matches actual O touchdown and every paid lift unit at ${fps}Hz`,()=>{
 const h=simulation({speed:65,vz:-65}),dt=1/fps;
 const instrumented=source.replace('const RoadsterHighwayDemoPlanner =','globalThis.profileFactory =')
  .replace('function step(player, cars, dt) {','globalThis.profileReader=hopProfile;function step(player, cars, dt) {');
 vm.runInContext(instrumented,h.context);h.context.profileFactory.create(lanes,1.65);
 const profile=h.context.profileReader(height,true,dt);let first=true,steps=0,paid=0,peak=0;
 h.context.demoPlanner.step=()=>{const jump=first;first=false;return {input:h.context.profileFactory.neutral(),jump,jumpHeight:height,jumpGraceSeconds:profile.duration+.18,status:'jump',targetLane:3};};
 do{const f=h.step(dt);assert.ok(f);paid+=f.airConsumedThisFrame;peak=Math.max(peak,h.state.y);steps++;assert.equal(f.frame.input.boost,0);assert.equal(f.frame.input.lift,0);}while(h.state.y>0&&steps<fps*4);
 assert.ok(Math.abs(steps*dt-profile.duration)<1e-9);assert.ok(Math.abs(paid-profile.cost)<1e-9,'ascent and landing-save gas are both paid by the ordinary pipeline');
 assert.ok(profile.duration+.18<2.4);assert.ok(peak<=height+1e-8&&peak>height-.01);
 assert.equal(h.state.y,0);assert.equal(h.state.isDestroyed,false);assert.equal(h.impacts.length,0);
});
