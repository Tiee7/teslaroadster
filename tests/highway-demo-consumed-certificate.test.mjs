import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {simulation,lanes} from './helpers/demo-harness.mjs';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/demo-consumed-certificate-terminal.json',import.meta.url),'utf8'));
const clone=value=>JSON.parse(JSON.stringify(value));

test('a fresh C proof does not carry the consumed B certificate into its terminal ground route',()=>{
  const h=simulation(clone(fixture.state),clone(fixture.cars));
  let source=fs.readFileSync(new URL('../src/highway-demo.js',import.meta.url),'utf8').split('// UI/lifecycle adapter.')[0];
  const anchor='const preparedSource=consumePreparedSource(player,cars,dt,immediate);';assert.equal(source.split(anchor).length,2);
  source=source.replace('const RoadsterHighwayDemoPlanner =','globalThis.terminalFactory =').replace(anchor,'globalThis.terminalApi=admissionApi;'+anchor);
  vm.runInContext(source,h.context);const planner=h.context.terminalFactory.create(lanes,1.65);h.context.demoPlanner.step=planner.step;h.step(fixture.dt);
  const drain=iterator=>{let next;do{next=iterator.next();}while(!next.done);return next.value;},api=h.context.terminalApi;
  assert.equal(fixture.state.demoCertificate,true,'the inherited old contract is present in the witness');
  const c=drain(api.candidateSteps(clone(fixture.state),clone(fixture.cars),fixture.hint.height,fixture.hint.lane,true,null,fixture.hint.requiredNextAir));
  assert.ok(c,'complete paid C arc and wait are safe');
  assert.equal(c.endpoint.demoCertificate,false);assert.equal(c.endpoint.demoCertificatePhase,null);assert.equal(c.endpoint.demoJumpCooldown,0);assert.equal(c.endpoint.demoLandingLane,null);
  assert.equal(c.endpoint.demoRefillTarget,c.endpoint.airRemaining>=c.requiredNextAir?0:c.requiredNextAir);assert.equal(c.endpoint.demoRoutePrepared,false);
  const terminal=drain(api.groundTerminalSteps(c.endpoint,c.forecast));assert.ok(terminal,'the following full normal ground route must remain viable');
  assert.equal(terminal.frames,144);assert.ok(terminal.minSpeed*3.6>=220);assert.ok(terminal.minGas>0);
});
