import test from'node:test';import assert from'node:assert/strict';import vm from'node:vm';import{readFileSync}from'node:fs';
import{simulation}from'./helpers/demo-harness.mjs';import{lifecycleHarness as lifecycle}from'./helpers/demo-lifecycle-harness.mjs';
const factory=vm.runInNewContext(readFileSync(new URL('../src/highway-demo.js',import.meta.url),'utf8').split('// UI/lifecycle adapter.')[0]+'\nRoadsterHighwayDemoPlanner;');
for(const fps of[30,60,144])test(`demo fixed clock preserves elapsed time and full physical trajectory at ${fps}Hz`,()=>{
 const h=simulation({speed:0,vz:0},[],{seed:7}),clock=factory.createClock(),reference=simulation({speed:0,vz:0},[],{seed:7});
 for(let render=0;render<fps*3;render++){h.context.demoPlanner.beginRender();const out=clock.advance(1/fps,dt=>h.step(dt));assert.equal(out.overloaded,false);assert.ok(out.frameSteps<=3);}
 for(let step=0;step<180;step++)reference.step(1/60);
 const s=clock.stats();assert.equal(s.steps,180);assert.ok(Math.abs(s.elapsedSeconds-s.simulationSeconds)<1/60);assert.deepEqual(structuredClone(h.state),structuredClone(reference.state));assert.deepEqual(structuredClone(h.cars),structuredClone(reference.cars));
});
test('fixed demo clock retains bounded short debt and explicitly rejects sustained <20fps',()=>{
 const clock=factory.createClock();let ticks=0;const first=clock.advance(.06,()=>ticks++);assert.equal(first.frameSteps,3);assert.ok(first.accumulator>0);assert.equal(first.overloaded,false);
 let out;for(let frame=0;frame<20;frame++){out=clock.advance(1/15,()=>ticks++);assert.ok(out.frameSteps<=3);if(out.overloaded)break;}assert.equal(out.overloaded,true);assert.ok(out.accumulator>.15);const before=ticks;clock.clear();assert.equal(clock.stats().accumulator,0);assert.equal(ticks,before);
});
test('demo clock stops additional physics ticks immediately when ownership ends',()=>{
 const clock=factory.createClock();let active=true,ticks=0;const out=clock.advance(.05,()=>{ticks++;active=false;clock.clear();},()=>active);assert.equal(ticks,1);assert.equal(out.frameSteps,1);assert.equal(out.accumulator,0);
});
test('adapter slow-render exit restores both manual ownership flags and real keys immediately',async()=>{
 const h=lifecycle();await h.demo.toggle();assert.equal(h.demo.isActive(),true);assert.equal(h.demo.isBusy(),true);
 const before=h.state.speed;for(let frame=0;frame<12&&h.demo.isActive();frame++)h.demo.advanceFrame(1/15,dt=>h.step(dt));
 assert.equal(h.demo.isActive(),false);assert.equal(h.demo.isBusy(),false);assert.match(h.get('btn-highway-demo').title,/渲染过慢|rendering is too slow/);assert.equal(h.demo.clockStats().accumulator,0);
 await h.key('KeyW');assert.equal(h.keys.KeyW,true);h.state.speed=0;h.state.vz=0;h.context.fullMotion(1/60);assert.ok(h.state.speed>0,'real W reaches unchanged manual physics');assert.ok(before>0);
});
