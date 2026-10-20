import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {simulation,car,lanes} from './helpers/demo-harness.mjs';
const current=fs.readFileSync(new URL('../src/highway-demo.js',import.meta.url),'utf8').split('// UI/lifecycle adapter.')[0];
const frozen=fs.readFileSync(new URL('../verification/demo-continuous/pre-cpu-optimization/highway-demo.js',import.meta.url),'utf8').split('// UI/lifecycle adapter.')[0];
function factory(h,source,name){
 const anchor='      if (target === null) reset(player.x);';
 assert.equal(source.split(anchor).length,2);
 vm.runInContext(source.replace('const RoadsterHighwayDemoPlanner =',`globalThis.${name} =`).replace(anchor,`${anchor}
      if(globalThis.__waitFixture){const f=globalThis.__waitFixture;target=f.target;changing=f.changing;dwell=f.dwell;jumpCooldown=f.jumpCooldown;charging=f.charging;refillTarget=f.refillTarget;decisionCooldown=f.decisionCooldown??0;globalThis.__waitFixture=null;}`),h.context);
 return h.context[name].create(lanes,1.65);
}
function assertSameGroundControlsAndBookkeeping(next,old,currentPlanner,oldPlanner){
 // Additional scheduling diagnostics are not part of the frozen controller's
 // route/completion contract. Check every original field, including key presence
 // and Object.is semantics, instead of comparing two different stats schemas.
 assert.deepEqual(next,old);
 const expected=oldPlanner.stats(),actual=currentPlanner.stats();
 assert.deepEqual(Object.keys(expected),['started','completed','jumps','multiLane','maxLaneSpan','targetLane','changing','certifiedNextLane','certifiedNextHeight','certifiedHandoffs','invalidatedCertificates','releasedCertificates','backupHops']);
 for(const key of Object.keys(expected)){assert.ok(Object.hasOwn(actual,key),key);assert.ok(Object.is(actual[key],expected[key]),`legacy bookkeeping: ${key}`);}
 assert.equal(actual.planningWorkLimit,192);assert.equal(actual.planningBudgetMs,20);
 assert.ok(Number.isInteger(actual.backgroundWork)&&actual.backgroundWork>=0&&actual.backgroundWork<=192);
 assert.ok(actual.maxBackgroundWork<=192);assert.ok(actual.preparedWork<=actual.backgroundWork);assert.ok(actual.maxPreparedWork<=192);
}
test('protected ground wait keeps exact previous per-frame controls and completion bookkeeping',()=>{
 for(const lane of [0,3,5])for(const charging of [false,true])for(const changing of [false,true]){
  const h=simulation({x:lanes[lane]+.1,speed:67,vz:-67,vx:.2,airRemaining:3.3},lanes.map((_,i)=>car(i,-70,25)));
  const a=factory(h,frozen,'oldWaitFactory'),b=factory(h,current,'newWaitFactory');
  const fixture={target:lane,changing,dwell:.075,jumpCooldown:.2,charging,refillTarget:3.6};
  const before=JSON.stringify({state:h.state,cars:h.cars});
  h.context.__waitFixture={...fixture};const old=a.step(h.state,h.cars,1/60);
  h.context.__waitFixture={...fixture};const next=b.step(h.state,h.cars,1/60);
  assertSameGroundControlsAndBookkeeping(next,old,b,a);
  assert.equal(JSON.stringify({state:h.state,cars:h.cars}),before);
  assert.equal(next.input.throttle,1);assert.equal(next.input.boost,0);assert.equal(next.input.brake,0);
 }
});
test('route-decision cooldown skips unused long paths without delaying per-frame real controls',()=>{
 for(const lane of [0,3,5])for(const gas of [3.3,8])for(const vx of [-7,0,7]){
  const h=simulation({x:lanes[lane]+.1,speed:67,vz:-67,vx,airRemaining:gas},lanes.map((_,i)=>car(i,-160,25)));
  const a=factory(h,frozen,'oldRouteFactory'),b=factory(h,current,'newRouteFactory');
  const fixture={target:lane,changing:true,dwell:0,jumpCooldown:0,charging:gas<4.3,refillTarget:0,decisionCooldown:.08};
  h.context.__waitFixture={...fixture};const old=a.step(h.state,h.cars,1/60);
  h.context.__waitFixture={...fixture};const next=b.step(h.state,h.cars,1/60);
  assertSameGroundControlsAndBookkeeping(next,old,b,a);
 }
});
test('urgent collision validation reuses the exact complete-trajectory prefix',()=>{
 const anchor='      const immediate=live.length ?';assert.equal(current.split(anchor).length,2);
 for(const mode of ['realistic','fantasy'])for(const gas of [3,8])for(const vx of [-8,0,8]){
  const h=simulation({physicsMode:mode,speed:66,vz:-66,vx,airRemaining:gas},[]);
  const source=current.replace('const RoadsterHighwayDemoPlanner =','globalThis.prefixFactory =').replace(anchor,`      globalThis.__prefixProbe={short:trajectory([target],.85),prefix:pathFor(target).filter(point=>point.t<=.85+1e-6)};\n${anchor}`);
  vm.runInContext(source,h.context);h.context.prefixFactory.create(lanes,1.65).step(h.state,h.cars,1/60);
  assert.equal(JSON.stringify(h.context.__prefixProbe.short),JSON.stringify(h.context.__prefixProbe.prefix));
 }
});
