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

for(const [name,count,frames]of [['empty road',0,120],['rear-only recycled traffic',20,180],['dense rear admissions and waiting queue',52,180]]){
 test(`current pinned numeric projection matches real extracted CPU physics and complete traffic properties: ${name}`,()=>{
  const cars=Array.from({length:count},(_,i)=>car(i%6,95+Math.floor(i/6)*42,15,{id:`rear-${i}`,highwayRecycledBehind:true,highwayPassEligible:false}));
  // A real out-of-bounds car exercises the new admission path rather than
  // merely comparing unchanged straight-line integration.
  if(cars.length)cars[0].mesh.position.z=-481;
  const h=simulation({speed:32,vz:-32},cars,{seed:17}),kernel=createNumericProjectionKernel();
  fixedInputPhysics(h);
  let recycled=false,waiting=false;
  for(let frame=0;frame<frames;frame++){
   const state=plain(h.state),snapshot=plain(h.cars),actual=h.step(1/60);
   assert.ok(actual);assert.equal(h.state.isDestroyed,false);assert.equal(h.launches.length,0);
   const request={state,cars:snapshot,input:plain(actual.frame.input),external:plain(external)},before=plain({state,cars:snapshot,input:actual.frame.input,external});
   const projected=kernel.step(request);
   assert.equal(projected.supported,true,JSON.stringify(projected.unsupported||projected.contact));
   for(const key of CONTROL_PHYSICS_KEYS)assert.ok(Object.is(projected.state[key],h.state[key]),`${name} frame ${frame} state.${key}: ${projected.state[key]} vs ${h.state[key]}`);
   assert.deepEqual(projected.cars,plain(h.cars),`${name} frame ${frame}: all traffic data/visibility/admission/pass flags`);
   assert.deepEqual(request,before,'projection never mutates its lossless input snapshot');
   if(cars.length)recycled||=cars[0].mesh.position.z>65;
   waiting||=cars.some(c=>c.highwayWaitingToSpawn!==undefined);
  }
  if(count)assert.equal(recycled,true,'out-of-bounds vehicle was recycled behind the player');
  if(count===52)assert.equal(waiting,true,'dense case really exercises the hidden noncolliding admission queue');
 });
}

test('new rear lifecycle does not widen the numeric reuse domain to blasts or displayed daytime',()=>{
 const h=simulation(),kernel=createNumericProjectionKernel();
 const input={steer:0,throttle:0,boost:0,brake:0,reverse:0,handbrake:0,lift:0,descend:0,strafe:0,roll:0,pitch:0};
 const request={state:plain(h.state),cars:[car(0,100,15,{blastTimer:.1})],input,external};
 assert.equal(kernel.step(request).supported,false);
 assert.equal(kernel.step({...request,cars:[],external:{...external,weatherIndex:3}}).supported,false);
});
