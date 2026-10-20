/** Isolated physical-model unit seam, NOT production admission/E2E coverage.
 * A test explicitly drains the production pure complete candidate and dispatches
 * that already-validated option through the unchanged final-hop/input/O block.
 * No live pose, velocity, tank, NPC, source proof or clock is assigned here.
 * Real finite preparation/admission behavior is covered by separate clock runs.
 */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {simulation,lanes} from './demo-harness.mjs';
const original=readFileSync(new URL('../../src/highway-demo.js',import.meta.url),'utf8').split('// UI/lifecycle adapter.')[0];
export function candidateHarness(overrides={},cars=[],options={}){
 const h=simulation(overrides,cars,options),dt=options.dt??1/60;
 let source=original;
 const replace=(a,b)=>{assert.equal(source.split(a).length,2,'candidate unit seam: '+a);source=source.replace(a,b);};
 replace('const RoadsterHighwayDemoPlanner =','globalThis.candidateUnitFactory =');
 replace('const preparedSource=consumePreparedSource(player,cars,dt,immediate);','globalThis.__candidateUnitApi={...admissionApi,controlsFor,boostFor,brakeResult,trajectory};const preparedSource=consumePreparedSource(player,cars,dt,immediate);');
 replace('          const motion=playerMotion(start,profile,lane,prepare,nextRequiredAir);','          const motion=playerMotion(start,profile,lane,prepare,nextRequiredAir);if(start===player)globalThis.__candidateUnitMotion={height,lane,profile,motion};');
 replace('        if(plannedHop){\n          if(plannedHop.fromCertificate', '        if(globalThis.__candidateUnitDispatch){plannedHop=globalThis.__candidateUnitDispatch;globalThis.__candidateUnitDispatch=null;}\n        if(plannedHop){\n          if(plannedHop.fromCertificate');
 vm.runInContext(source,h.context);
 const planner=h.context.candidateUnitFactory.create(lanes,1.65);
 h.context.demoPlanner.step=planner.step;h.stats=planner.stats;
 // Capture pure current-phase API without stepping physical state. This call is
 // not counted as a physical frame or a successful autonomous admission.
 const before=JSON.stringify({state:h.state,cars:h.cars});planner.step(h.state,h.cars,dt);
 assert.equal(JSON.stringify({state:h.state,cars:h.cars}),before,'API capture is read-only');
 const drain=iterator=>{let next;do{next=iterator.next();}while(!next.done);return next.value;};
 return {h,planner,dt,drain,api:h.context.__candidateUnitApi,
  candidate(height,lane,nextRequiredAir=3.6){
   const before=JSON.stringify({state:h.state,cars:h.cars});
   const option=drain(h.context.__candidateUnitApi.candidateSteps(h.state,h.cars,height,lane,true,null,nextRequiredAir));
   assert.equal(JSON.stringify({state:h.state,cars:h.cars}),before,'candidate speculation cannot mutate live state/NPC');
   return {option,...h.context.__candidateUnitMotion};
  },
  dispatch(option){assert.ok(option?.endpoint&&option?.forecast,'Complete validated candidate required by physical-model unit');h.context.__candidateUnitDispatch=option;}
 };
}
