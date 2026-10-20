import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {simulation,car,lanes} from './helpers/demo-harness.mjs';
import {candidateHarness} from './helpers/demo-candidate-harness.mjs';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/demo-successor-handoff.json',import.meta.url),'utf8'));
const source=fs.readFileSync(new URL('../src/highway-demo.js',import.meta.url),'utf8').split('// UI/lifecycle adapter.')[0];
const clone=v=>JSON.parse(JSON.stringify(v));
function prepared(state={},cars=fixture.actualCars){
 const h=simulation({...clone(fixture.actualState),...state},clone(cars));
 const anchor='      if (target === null) reset(player.x);';assert.equal(source.split(anchor).length,2);
 const instrumented=source.replace('const RoadsterHighwayDemoPlanner =','globalThis.certificateFactory =').replace(anchor,`${anchor}
      if(globalThis.__certificateFixture){const f=globalThis.__certificateFixture,p=f.privateState;target=p.target;changing=p.changing;dwell=p.dwell;jumpCooldown=p.jumpCooldown;charging=p.charging;decisionCooldown=p.decisionCooldown;refillTarget=p.refillTarget;landingLane=p.landingLane;
        for(let i=0;i<cars.length;i++)if(typeof p.previousSpeeds[i]==='number')previous.set(cars[i],p.previousSpeeds[i]);
        certifiedNext={lane:f.expectedB.lane,height:f.expectedB.height,physicsMode:player.physicsMode,insaneMode:!!player.insaneMode,infiniteJet:!!player.infiniteJet,frameDt:f.dt};globalThis.__certificateFixture=null;}`);
 vm.runInContext(instrumented,h.context);h.context.__certificateFixture=clone(fixture);
 const p=h.context.certificateFactory.create(lanes,1.65);h.context.demoPlanner.step=p.step;h.stats=p.stats;h.reset=p.reset;
 return h;
}

test('the captured safe B executes at handoff without inventing a new C requirement or epsilon frame delay',()=>{
 const h=prepared(),first=h.step(fixture.dt);assert.equal(first.frame.jump,true);assert.equal(first.frame.certificateSource,'revalidated');
 assert.equal(first.frame.targetLane,fixture.expectedB.lane);assert.equal(first.frame.jumpHeight,fixture.expectedB.height);
 assert.equal(h.stats().certifiedHandoffs,1);assert.equal(h.stats().invalidatedCertificates,0);
 assert.equal(h.stats().preparedChecks,1);assert.equal(h.stats().preparedCommits,1,'the current B paid arc is freshly checked before dispatch');
 let landed=false;for(let i=1;i<60&&!h.state.isDestroyed;i++){const f=h.step(fixture.dt);assert.ok(f);if(h.state.y===0){landed=true;break;}assert.equal(f.frame.input.boost,0);assert.equal(f.frame.input.lift,0);}
 assert.ok(landed);assert.equal(h.impacts.length,0);assert.equal(h.state.isDestroyed,false);assert.ok(h.state.airRemaining>0);
});

test('a saved B cannot override a real gas loss or a newly occupied takeoff corridor',()=>{
 const low=prepared({airRemaining:0,isFreefalling:true});const f=low.step(fixture.dt);
 assert.equal(f.frame.jump,false);assert.equal(low.launches.length,0);assert.equal(low.stats().certifiedHandoffs,0);assert.equal(low.stats().preparedCommits,0);
 const occupied=prepared({},[...fixture.actualCars,car(2,0,70)]);const hit=occupied.step(fixture.dt);
 assert.equal(hit.frame.jump,false);assert.equal(occupied.stats().certifiedHandoffs,0);assert.equal(occupied.stats().preparedCommits,0);assert.equal(occupied.launches.length,0);
 assert.ok(occupied.impacts.length>0,'ordinary real collision remains enabled');
});

test('a due certificate waits for actual ground contact and reset invalidates it',()=>{
 const h=prepared({y:1,vy:-1,isJumping6m:false});const airborne=h.step(fixture.dt);
 assert.equal(airborne.frame.jump,false);assert.equal(h.stats().certifiedNextLane,fixture.expectedB.lane);assert.equal(h.launches.length,0);
 h.reset(h.state.x);assert.equal(h.stats().certifiedNextLane,null);assert.equal(h.stats().certifiedHandoffs,0);
});

// Explicit candidate dispatch below isolates the real post-hop ground route.
// It supplies no evidence for the finite planner's initial admission timing.
test('a physically dispatched isolated-wall arc releases its checked successor after safe ground continuation',()=>{
 const u=candidateHarness({speed:65,vz:-65,airRemaining:8},lanes.map((_,i)=>car(i,-20,22))),{h}=u;
 const {option}=u.candidate(2.3,3);assert.ok(option);
 option.successor=u.drain(u.api.candidateSteps(option.endpoint,option.forecast,2.3,3,true));assert.ok(option.successor);
 u.dispatch(option);
 const first=h.step(1/60);assert.equal(first.frame.jump,true);assert.notEqual(first.frame.nextJumpLane,null);
 for(let i=0;i<2*60&&!h.state.isDestroyed;i++)h.step(1/60);
 assert.equal(h.launches.length,1);assert.equal(h.stats().releasedCertificates,1);assert.equal(h.stats().certifiedHandoffs,0);assert.equal(h.impacts.length,0);
});

test('the captured complete current arc remains physically safe through paid preparation without a farther certificate',()=>{
 const f=JSON.parse(fs.readFileSync(new URL('./fixtures/demo-terminal-backup.json',import.meta.url),'utf8'));
 const u=candidateHarness(clone(f.state),clone(f.cars),{dt:f.dt}),{h}=u;
 const {option}=u.candidate(f.expectedHop.height,f.expectedHop.lane);assert.ok(option,'the unchanged captured geometry still has a complete paid arc');
 assert.equal(option.successor,undefined);u.dispatch(option);
 const first=h.step(f.dt);assert.equal(first.frame.jump,true);assert.equal(first.frame.nextJumpLane,null);assert.equal(first.frame.targetLane,f.expectedHop.lane);assert.equal(first.frame.jumpHeight,f.expectedHop.height);
 let landed=false,minimum=h.state.speed*3.6;
 const steps=Math.round((option.duration+option.groundWait)/f.dt);
 for(let i=1;i<steps;i++){const out=h.step(f.dt);assert.ok(out);minimum=Math.min(minimum,h.state.speed*3.6);if(h.state.y===0)landed=true;if(out.isAirborne){assert.equal(out.frame.input.boost,0);assert.equal(out.frame.input.lift,0);assert.equal(out.frame.input.throttle,0);}}
 assert.ok(landed);assert.equal(h.launches.length,1);assert.equal(h.impacts.length,0);assert.equal(h.state.isDestroyed,false);assert.ok(minimum>=220);
 const end=option.endpoint;assert.ok(Math.abs(h.state.x-end.x)<.1);assert.ok(Math.abs(h.state.speed-end.speed)<.1);assert.ok(h.state.airRemaining>=end.airRemaining-.02&&h.state.airRemaining-end.airRemaining<.1);
});
