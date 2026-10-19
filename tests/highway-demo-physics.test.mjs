import test from 'node:test';
import assert from 'node:assert/strict';
import { simulation, car, lanes } from './helpers/demo-harness.mjs';
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

test('sudden unbrakeable six-lane wall uses one paid low hop, no sustained airborne throttle/lift, and returns to the ground',()=>{
  const h=simulation({speed:65,vz:-65},lanes.map((_,i)=>car(i,-20,22)));
  let peak=0,airSeconds=0,airBoost=0,airGas=0,landed=false;
  for(let i=0;i<240;i++){
    const f=h.step(1/60);if(!f)break;peak=Math.max(peak,h.state.y);
    if(f.isAirborne){airSeconds+=1/60;if(f.isRearThrusterFiring)airBoost++;airGas+=f.airConsumedThisFrame;assert.equal(f.frame.input.throttle,0);assert.equal(f.frame.input.boost,0);assert.equal(f.frame.input.lift,0);}
    if(h.launches.length&&h.state.y===0)landed=true;
  }
  assert.ok(h.launches.length>=1);assert.ok(peak>=2&&peak<4);assert.ok(airSeconds<2.5);assert.equal(airBoost,0);assert.ok(airGas>1);assert.equal(landed,true);
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
