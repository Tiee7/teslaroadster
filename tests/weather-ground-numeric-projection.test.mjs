import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {simulation,car} from './helpers/demo-harness.mjs';
import {createNumericProjectionKernel,CONTROL_PHYSICS_KEYS} from '../verification/demo-continuous/generate-numeric-projection-kernel.mjs';

// JSON would silently turn -0 into +0. The kernel contract is lossless plain
// data, so retain every numeric bit and own undefined field across VM realms.
const plain=value=>structuredClone(value);
const external={map:'highway',active:true,busy:true,weatherIndex:0,audioInitialized:true,keys:{}};
const fixedInput={steer:0,throttle:1,boost:0,brake:0,reverse:0,handbrake:0,lift:0,descend:0,strafe:0,roll:0,pitch:0};
function fixedInputPhysics(h){
 // Compare numerical physics/traffic under an identical external input; do
 // not add planner/route equivalence to the projection's audited contract.
 const original=vm.runInContext('testStep.toString()',h.context);
 const call='frame=planner.step(state,trafficCars,dt);';
 assert.equal(original.split(call).length,2,'exact existing CPU helper boundary');
 h.context.numericFixedFrame={input:fixedInput,jump:false};
 vm.runInContext('testStep='+original.replace(call,'frame=globalThis.numericFixedFrame;'),h.context);
}

for(const [name,count,frames,kind]of [
 ['empty road',0,120,'empty'],
 ['ordinary far-forward exit with 20 cars',20,180,'behind'],
 ['ordinary far-forward exit with 52 cars',52,180,'behind'],
 ['ordinary passed-car exit refills ahead without birth credit',20,180,'ahead'],
 ['actual lateral out-of-bounds incident recovers behind',20,180,'incident'],
 ['dense 52-car front and incident admission queues',52,180,'queue']
]){
 test(`current pinned numeric projection matches real extracted CPU physics and complete traffic properties: ${name}`,()=>{
  const cars=Array.from({length:count},(_,i)=>car(i%6,95+Math.floor(i/6)*42,15,{id:`rear-${i}`,highwayRecycledBehind:true,highwayPassEligible:false}));
  // Retain the original 20/52-car trajectories exactly: -481 is a normal
  // longitudinal window exit, not an off-road incident. Exercise the other
  // normal direction and real incident admission independently.
  if(kind==='behind')cars[0].mesh.position.z=-481;
  if(kind==='ahead'){
   cars[0].mesh.position.z=65.1;cars[0].highwayRecycledBehind=false;
  }
  if(kind==='incident')cars[0].mesh.position.x=31;
  if(kind==='queue'){
   cars.length=0;
   for(let lane=0;lane<6;lane++)for(const z of [115,195,275,355,415,-470,-430])
    cars.push(car(lane,z,32,{id:`block-${lane}-${z}`,highwaySpeedInitialized:true,highwayRecycledBehind:z>65}));
   for(let i=0;i<10;i++){
    const ahead=i%2===0,c=car(i%6,ahead?-510:510,12+i*2.3,{id:`waiting-${i}`,
     highwayWaitingToSpawn:ahead,highwayRecycledBehind:!ahead,highwayPassEligible:false,highwaySpeedInitialized:true});
    c.mesh.visible=false;cars.push(c);
   }
   assert.equal(cars.length,52);
  }
  const h=simulation({speed:32,vz:-32},cars,{seed:17}),kernel=createNumericProjectionKernel();
  fixedInputPhysics(h);
  let waitingFrames=0;
  for(let frame=0;frame<frames;frame++){
   const state=plain(h.state),snapshot=plain(h.cars),actual=h.step(1/60);
   assert.ok(actual);assert.equal(h.state.isDestroyed,false);assert.equal(h.launches.length,0);
   const request={state,cars:snapshot,input:plain(actual.frame.input),external:plain(external)},before=plain({state,cars:snapshot,input:actual.frame.input,external});
   const projected=kernel.step(request);
   assert.equal(projected.supported,true,JSON.stringify(projected.unsupported||projected.contact));
   for(const key of CONTROL_PHYSICS_KEYS)assert.ok(Object.is(projected.state[key],h.state[key]),`${name} frame ${frame} state.${key}: ${projected.state[key]} vs ${h.state[key]}`);
   assert.deepEqual(projected.cars,plain(h.cars),`${name} frame ${frame}: all traffic data/visibility/admission/pass flags`);
   assert.deepEqual(request,before,'projection never mutates its lossless input snapshot');
   if(frame===0&&['behind','ahead','incident'].includes(kind)){
    const entry=cars[0];assert.equal(entry.mesh.visible,true,'fixture really admits the boundary-crossing car');
    assert.equal(entry.highwayPassedThisFrame,false,'admission itself is never a paid pass');
    assert.equal(entry.highwayRecycledBehind,kind==='incident','only an actual incident owns the rear reservoir');
    assert.equal(entry.highwayPassEligible,kind==='ahead','only a forward birth can earn a later genuine pass');
    if(kind==='behind')assert.ok(entry.mesh.position.z>=23&&entry.mesh.position.z<=55,'ordinary far-forward exit uses the normal rear window, not the 95m incident reservoir');
    if(kind==='ahead')assert.ok(entry.mesh.position.z>=-470&&entry.mesh.position.z<=-416,'ordinary passed-car exit replenishes the forward window');
    if(kind==='incident')assert.ok(entry.mesh.position.z>=95&&entry.mesh.position.z<=415,'actual off-road incident respawns safely behind');
   }
   const waiting=cars.filter(c=>c.highwayWaitingToSpawn!==undefined);
   if(waiting.length)waitingFrames++;
   for(const c of waiting)assert.equal(c.mesh.visible,false,'queued traffic remains hidden and noncolliding');
  }
  if(kind==='queue')assert.ok(waitingFrames>2,'dense mixed fixture really exercises repeated hidden noncolliding admission queues');
 });
}

test('new rear lifecycle does not widen the numeric reuse domain to blasts or displayed daytime',()=>{
 const h=simulation(),kernel=createNumericProjectionKernel();
 const input={steer:0,throttle:0,boost:0,brake:0,reverse:0,handbrake:0,lift:0,descend:0,strafe:0,roll:0,pitch:0};
 const request={state:plain(h.state),cars:[car(0,100,15,{blastTimer:.1})],input,external};
 assert.equal(kernel.step(request).supported,false);
 assert.equal(kernel.step({...request,cars:[],external:{...external,weatherIndex:3}}).supported,false);
});
