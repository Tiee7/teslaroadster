import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { simulation, car, lanes } from './helpers/demo-harness.mjs';
import { lifecycleHarness, source } from './helpers/demo-lifecycle-harness.mjs';
const context=vm.createContext({});
vm.runInContext(source('highway-demo.js').split('// UI/lifecycle adapter.')[0]+'\nglobalThis.api=RoadsterHighwayDemoPlanner;',context);
const swept=context.api.sweptContact;

test('manual comparison harness releases both demo ownership flags and reads real keyboard controls',()=>{
  const h=simulation({speed:42,vz:-42});
  h.context.window.RoadsterDemo.isActive=()=>false;
  h.context.window.RoadsterDemo.isBusy=()=>false;
  h.context.testKeys.KeyW=h.context.testKeys.KeyD=h.context.testKeys.Semicolon=true;
  const input=JSON.parse(vm.runInContext('JSON.stringify(readDriveInput())',h.context));
  assert.equal(input.throttle,1);assert.equal(input.steer,1);assert.equal(input.boost,1);
  h.context.demoPlanner.step=()=>({input:context.api.neutral(),jump:false,status:'drive',targetLane:3});
  h.step(1/60);
  assert.ok(h.state.steerInput>0,'neutral demo frame cannot mask actual manual steering');
});

test('continuous sweep catches a brief corner contact with clear endpoints',()=>{
  assert.ok(swept(0,-8,3,8,1.85,4.46)>0);
  assert.equal(swept(2.1,-8,2.1,8,1.85,4.46),null);
  assert.equal(swept(0,-8,0,-5,1.85,4.46),null);
  assert.equal(swept(1.85,-2,1.85,2,1.85,4.46),null,'edge tangency has no penetration');
  assert.equal(swept(0,0,0,0,1.85,4.46),0);
});

test('real demo collisions include swept contact and retain fatal damage',()=>{
  const h=simulation({speed:100,vz:-100},[car(3,-8,0)]);
  h.context.demoPlanner.step=()=>({input:{...context.api.neutral(),steer:1,throttle:1},jump:false,targetLane:4});
  h.step(.1);
  assert.equal(h.impacts.length,1);assert.equal(h.state.isDestroyed,true);
});

for(const fps of [30,60,144,'irregular'])test(`demo changes whole lanes quickly with a continuous bounded trajectory at ${fps}`,()=>{
  const h=simulation({speed:65,vz:-65},[car(3,-30,22)]);
  let elapsed=0,started=null,finished=null,previousX=h.state.x,maxStep=0,stripe=0,maxStripe=0;
  while(elapsed<3&&!h.state.isDestroyed){
    const dt=fps==='irregular'?[1/30,1/80,1/144,1/45,1/60][Math.floor(elapsed*97)%5]:1/fps;
    const before=h.stats();h.step(dt);elapsed+=dt;const after=h.stats();
    assert.ok(Math.abs(h.state.x-previousX)<=24*dt+1e-8,'position integrates bounded real lateral velocity');
    maxStep=Math.max(maxStep,Math.abs(h.state.x-previousX));previousX=h.state.x;
    if(started===null&&after.started>before.started)started=elapsed-dt;
    if(finished===null&&after.completed>before.completed)finished=elapsed;
    stripe=Math.min(...lanes.map(x=>Math.abs(x-h.state.x)))>.9?stripe+dt:0;maxStripe=Math.max(maxStripe,stripe);
  }
  assert.notEqual(started,null);assert.notEqual(finished,null);
  assert.ok(finished-started>=.3&&finished-started<=.65,`settled maneuver: ${finished-started}s`);
  assert.ok(maxStripe<.25);assert.ok(maxStep<.81);assert.equal(h.impacts.length,0);assert.equal(h.launches.length,0);
  assert.equal(h.state.isDestroyed,false);
});

for(const boost of [false,true])test(`manual rack and ground response remain unchanged ${boost?'with':'without'} rear boost, including after demo exit`,async()=>{
  for(const afterDemo of [false,true]){
    const h=lifecycleHarness();if(afterDemo){await h.demo.toggle();h.demo.stop();}
    Object.assign(h.state,{speed:42,vz:-42,yaw:0,vx:0,steerInput:0});
    h.keys.KeyD=h.keys.KeyW=true;if(boost)h.keys.Semicolon=true;
    const dt=1/60;h.context.fullMotion(dt);
    assert.ok(Math.abs(h.state.steerInput-8*dt)<1e-12,'original 8/s manual rack');
    const factor=Math.min(1.25,h.state.speed/14);
    const expectedVx=boost?0:h.state.steerInput*13.5*factor*14*dt;
    assert.ok(Math.abs(h.state.vx-expectedVx)<1e-10,'original manual tire/boost coupling');
    assert.equal(h.demo.isActive(),false);
  }
});
