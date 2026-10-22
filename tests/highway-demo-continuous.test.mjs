import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {simulation,car,lanes} from './helpers/demo-harness.mjs';
import {source} from './helpers/demo-lifecycle-harness.mjs';
import {pool} from '../scripts/verify-demo.mjs';
import {candidateHarness} from './helpers/demo-candidate-harness.mjs';
import {historicalTrafficSimulation} from './helpers/demo-historical-traffic-harness.mjs';
const drain=iterator=>{let next;do{next=iterator.next();}while(!next.done);return next.value;};
const intervals=[1/30,1/80,1/144,1/45,1/60];
for(const fps of [30,60,144,'irregular'])test(`two-lane escape holds one final target and steering through the intermediate center at ${fps}`,()=>{
 const h=simulation({speed:65,vz:-65},[car(3,-40,22),car(2,-40,22),car(4,0,65)]);
 let elapsed=0,initialTarget=null,crossed=false,peakStep=0,oldX=h.state.x,commands=[];
 while(elapsed<1.5&&!h.state.isDestroyed){
  const dt=fps==='irregular'?intervals[Math.floor(elapsed*97)%intervals.length]:1/fps;
  const f=h.step(dt);elapsed+=dt;
  if(initialTarget===null){initialTarget=f.frame.targetLane;assert.equal(initialTarget,1,'choose final free lane directly');}
  assert.equal(f.frame.targetLane,initialTarget,'no intermediate retarget/reselection');
  if(oldX>-2.5&&h.state.x<=-2.5){crossed=true;assert.ok(h.state.vx < -15,'cross intermediate center without centering');assert.ok(f.frame.input.steer<-.5);assert.equal(h.stats().completed,0);}
  peakStep=Math.max(peakStep,Math.abs(h.state.x-oldX));assert.ok(Math.abs(h.state.x-oldX)<=24*dt+1e-8);oldX=h.state.x;
  if(h.state.x>-5)commands.push(f.frame.input.steer);
  assert.ok(h.state.speed*3.6>=220);
 }
 assert.equal(crossed,true);assert.ok(commands.every(v=>v<0));assert.equal(h.stats().started,1);assert.equal(h.stats().completed,1);
 assert.equal(h.stats().multiLane,1);assert.equal(h.stats().maxLaneSpan,2);
 assert.equal(h.impacts.length,0);assert.equal(h.launches.length,0);assert.equal(h.state.isDestroyed,false);
});

test('full final-lane sweep rejects an intermediate hazard beyond the old short validation prefix',()=>{
 // Keep the original obstacle and add the crossing witness for continuous
 // acceleration: at1.05s the new path is atx=-7.444,zTravel=87.465m;
 // z=-106.2 intersects that intermediate lane, still after the.75s prefix.
 const h=simulation({x:12.5,speed:65,vz:-65},[car(1,-80,22),car(1,-106.2,22)]);
 const production=source('highway-demo.js').split('// UI/lifecycle adapter.')[0]
  .replace('const RoadsterHighwayDemoPlanner =','globalThis.finalSweepFactory =')
  .replace(/const currentThreat\s*=[^;]+;/,m=>m+' if(!globalThis.finalSweepProbe)globalThis.finalSweepProbe={trajectory,collisionTime,safePath,live};');
 vm.runInContext(production,h.context);h.context.finalSweepFactory.create(lanes,1.65).step(h.state,h.cars,1/60);
 const {trajectory,collisionTime,safePath,live}=h.context.finalSweepProbe;
 const path=trajectory([0],2.4,false),prefix=path.filter(p=>p.t<=.75);
 assert.ok(path.arrival>1.4);assert.equal(collisionTime(prefix),Infinity);
 assert.equal(collisionTime(path,.35,2.03,.12,[live[0]]),Infinity,'the original obstacle is now truly passed before crossing; do not invent a collision');
 assert.ok(collisionTime(path)>.75&&collisionTime(path)<path.arrival,'intervening lane hit before final arrival');
 assert.equal(drain(safePath(0)),false,'clear final lane is insufficient');
});

for(const count of [20,36,52])test(`demo starts from zero normally with ${count} real seeded traffic drivers`,()=>{
 const h=simulation({speed:0,vz:0},[],{seed:7});pool(h,count,7);
 assert.equal(h.state.speed,0);let previous=0;
 for(let i=0;i<120&&!h.state.isDestroyed;i++){
  h.step(1/60);assert.ok(h.state.speed-previous<=40/60+.01,'no initial speed injection');previous=h.state.speed;
  assert.ok(h.state.airRemaining>=0&&h.state.airRemaining<=10);
 }
 assert.equal(h.state.isDestroyed,false);assert.ok(h.state.speed>0);
});

test('high-speed low hop selects a reachable clear landing lane instead of chaining into the next car',()=>{
 const h=simulation({x:12.5,y:.3358333333,vy:20.15,speed:69,vz:-69,vx:0,isJumping6m:true,jumpStartY:0,jumpTargetY:2.3,jumpInertiaSeconds:0,jumpInertiaGraceSeconds:.95},[car(5,-120,20)]);
 const first=h.step(1/60);assert.equal(first.frame.targetLane,4,'high speed does not disable landing-gap selection');
 assert.ok(first.frame.input.strafe<0);
 let landed=false,minimum=Infinity;
 for(let i=0;i<120&&!h.state.isDestroyed;i++){
  const f=h.step(1/60);minimum=Math.min(minimum,h.state.speed*3.6);
  if(f.isAirborne){assert.equal(f.frame.input.throttle,0);assert.equal(f.frame.input.boost,0);assert.equal(f.frame.input.lift,0);}
  if(h.state.y===0)landed=true;
 }
 assert.equal(landed,true);assert.equal(h.impacts.length,0);assert.equal(h.launches.length,0);assert.equal(h.state.isDestroyed,false);
 assert.ok(minimum>=220);assert.ok(Math.abs(h.state.x-7.5)<.4);
});

test('a late final arrival cannot borrow unpredicted hold time beyond the fixed horizon',()=>{
 const h=simulation({x:14.75,speed:0,vz:0,vx:24,airRemaining:0,isFreefalling:true},[]);
 const production=source('highway-demo.js').split('// UI/lifecycle adapter.')[0]
  .replace('const RoadsterHighwayDemoPlanner =','globalThis.horizonFactory =')
  .replace(/const currentThreat\s*=[^;]+;/,m=>m+' if(!globalThis.horizonProbe)globalThis.horizonProbe={trajectory,safePath};');
 vm.runInContext(production,h.context);h.context.horizonFactory.create(lanes,1.65).step(h.state,h.cars,1/60);
 const p=h.context.horizonProbe,path=p.trajectory([0],2.4,false);
 assert.ok(path.arrival>2.15&&path.arrival<2.4);assert.equal(drain(p.safePath(0)),false);
});

test('landing sweep rejects the roof-rebound band even while the body envelope is clear',()=>{
 const h=simulation({x:2.5,y:1.3,vy:-.1,vx:20,vz:-69,speed:Math.hypot(20,69),airRemaining:10},[car(3,0,69)]);
 const production=source('highway-demo.js').split('// UI/lifecycle adapter.')[0]
  .replace('const RoadsterHighwayDemoPlanner =','globalThis.roofFactory =')
  .replace('        if (landingLane === null && room(target) < 18)','        globalThis.roofProbe={landingSweepClear};if (landingLane === null && room(target) < 18)');
 vm.runInContext(production,h.context);h.context.roofFactory.create(lanes,1.65).step(h.state,h.cars,1/60);
 assert.equal(h.context.roofProbe.landingSweepClear(4),false,'0.30m roof-contact band must not be called clear');
 // Observe the unchanged real roof response with neutral input; this confirms
 // why a body-only 1.10m filter was insufficient for touchdown selection.
 h.context.demoPlanner.step=()=>({input:h.context.roofFactory.neutral(),jump:false,status:'jump',targetLane:4});
 h.step(1/60);assert.equal(h.state.y,1.4);assert.equal(h.state.vy,5.5);
});

test('historical4451 forward-refill traffic fixture: dense zero-start seed7 preserves the former12.8s complete-arc regression',()=>{
 // Preserve every original assertion under its original constant-front stream.
 // This is an explicit historical stress fixture, not current refill behavior.
 const h=historicalTrafficSimulation({speed:0,vz:0},[],{seed:7});pool(h,52,7);
 let landings=0,previousY=0,longAir=0,air=0,peak=0,warmMin=Infinity,higher=false;
 for(let i=0;i<20*60;i++){
  const f=h.step(1/60);assert.ok(f,'fixed failing seed remains live');
  if(f.frame.jump){assert.ok(f.frame.jumpHeight>=2.3&&f.frame.jumpHeight<=10);higher ||= f.frame.jumpHeight>2.3;}
  if(f.isAirborne){assert.equal(f.frame.input.throttle,0);assert.equal(f.frame.input.boost,0);assert.equal(f.frame.input.lift,0);}
  air=h.state.y>.005?air+1/60:0;longAir=Math.max(longAir,air);peak=Math.max(peak,h.state.y);
  if(previousY>.005&&h.state.y===0)landings++;previousY=h.state.y;
  if(i>=300)warmMin=Math.min(warmMin,h.state.speed*3.6);
 }
 assert.equal(h.impacts.length,0);assert.equal(h.state.isDestroyed,false);assert.ok(higher);assert.ok(landings>=3);
 assert.ok(longAir<2.4);assert.ok(peak<=10);assert.ok(warmMin>=220);
});

test('current rear-only dense zero-start seed7 stays safe for the complete20s as forward traffic clears without front refills',()=>{
 const h=simulation({speed:0,vz:0},[],{seed:7});pool(h,52,7);
 const identities=[...h.cars],meshes=h.cars.map(c=>c.mesh);
 let landings=0,previousY=0,longAir=0,air=0,peak=0,warmMin=Infinity,higher=false,rearRefreshes=0,clearTailFrames=0;
 for(let i=0;i<20*60;i++){
  const before=h.cars.map(c=>({z:c.mesh.position.z,recycled:!!c.highwayRecycledBehind,waiting:c.highwayWaitingToSpawn!==undefined}));
  const f=h.step(1/60);assert.ok(f,'all1200 actual frames must remain live; empty road is not an early-exit excuse');
  if(f.frame.jump){assert.ok(f.frame.jumpHeight>=2.3&&f.frame.jumpHeight<=10);higher ||= f.frame.jumpHeight>2.3;}
  if(f.isAirborne){assert.equal(f.frame.input.throttle,0);assert.equal(f.frame.input.boost,0);assert.equal(f.frame.input.lift,0);}
  assert.ok(h.state.airRemaining>=0&&h.state.airRemaining<=10,'finite tank remains within its physical bounds');
  assert.ok(Math.abs(h.state.x)<=15,'player stays on the actual30m pavement');
  assert.ok(h.state.y>=0&&h.state.y<=10,'no below-ground or unbounded flight');
  air=h.state.y>.005?air+1/60:0;longAir=Math.max(longAir,air);peak=Math.max(peak,h.state.y);
  if(previousY>.005&&h.state.y===0)landings++;previousY=h.state.y;
  if(i>=300)warmMin=Math.min(warmMin,h.state.speed*3.6);
  let front=0;
  for(let j=0;j<h.cars.length;j++){
   const c=h.cars[j],old=before[j],waiting=c.highwayWaitingToSpawn!==undefined;
   assert.equal(c,identities[j]);assert.equal(c.mesh,meshes[j]);
   if(waiting){assert.equal(c.mesh.visible,false);assert.equal(c.mesh.position.z,510);assert.equal(c.highwayRecycledBehind,true);}
   const refreshed=(!old.recycled&&c.highwayRecycledBehind)||(old.waiting&&!waiting)||Math.abs(c.mesh.position.z-old.z)>12;
   if(refreshed){rearRefreshes++;assert.ok(c.mesh.position.z>65,'every observed refill/queue transition stays behind, never negative-Z ahead');assert.equal(c.highwayPassEligible,false);}
   if(waiting||c.mesh.visible===false)continue;
   if(c.mesh.position.z<0)front++;
   // Same static Map1 fatal-body envelope as production. The production
   // swept/collision path also runs in the harness and must report no impact.
   assert.ok(Math.abs(h.state.x-c.mesh.position.x)>=1.85||Math.abs(c.mesh.position.z)>=c.length/2+2.15||h.state.y>=c.height-.15,
    'no admitted visible NPC may overlap the low player body');
  }
  if(i>=15*60){assert.equal(front,0,'this finite rear-only stream really clears ahead');clearTailFrames++;}
 }
 assert.equal(h.impacts.length,0);assert.equal(h.state.isDestroyed,false);assert.ok(higher);
 assert.ok(landings>=1,'the real high hop must finish; a clear road does not require three artificial hops');
 assert.equal(landings,h.launches.length,'no unfinished final jump');
 assert.ok(rearRefreshes>0);assert.equal(clearTailFrames,5*60);
 assert.ok(longAir<2.4);assert.ok(peak<=10);assert.ok(warmMin>=220);
});

test('current rear-only real-O unit: two initial obstacle rows preserve landing, finite refill wait and an ordinary safe successor hop',()=>{
 // Unit seam: dispatch ONLY the first already-complete validated candidate.
 // The second hop is the ordinary planner's decision; no front cars injected.
 const cars=lanes.flatMap((_,lane)=>[car(lane,-20,22),car(lane,-200,22)]);
 const u=candidateHarness({speed:65,vz:-65,airRemaining:4,isFreefalling:false},cars),h=u.h;
 const {option}=u.candidate(2.3,3);assert.ok(option);u.dispatch(option);
 let previousY=0,landings=0,firstLandingGas=null,firstLandingTime=null,successorGas=null,successorTime=null,refillFrames=0,minSpeed=Infinity;
 for(let i=0;i<6*60;i++){
  const gas=h.state.airRemaining,f=h.step(1/60);assert.ok(f);
  assert.ok(h.state.airRemaining>=0&&h.state.airRemaining<=10);assert.ok(Math.abs(h.state.x)<=15);assert.ok(h.state.y>=0&&h.state.y<=10);
  minSpeed=Math.min(minSpeed,h.state.speed*3.6);
  if(f.frame.jump&&h.launches.length===2){successorTime=i/60;successorGas=gas;}
  if(f.isAirborne){assert.equal(f.frame.input.throttle,0);assert.equal(f.frame.input.boost,0);assert.equal(f.frame.input.lift,0);}
  if(previousY>.005&&h.state.y===0){landings++;if(firstLandingGas===null){firstLandingGas=h.state.airRemaining;firstLandingTime=i/60;}}
  if(firstLandingGas!==null&&h.state.y===0&&h.launches.length<2&&h.state.airRemaining>gas){
   refillFrames++;assert.ok(Math.abs(h.state.airRemaining-gas-3.4/60)<1e-9,'ordinary finite ground recharge only');
  }
  previousY=h.state.y;
  for(const c of h.cars)if(c.highwayRecycledBehind)assert.ok(c.mesh.position.z>65,'static rows recycle only behind');
 }
 assert.equal(h.impacts.length,0);assert.equal(h.state.isDestroyed,false);assert.ok(h.launches.length>=2);assert.ok(landings>=2);
 assert.ok(firstLandingGas<option.requiredNextAir,'first landing actually needs the reserved refill');
 assert.ok(refillFrames>0);assert.ok(successorTime>firstLandingTime+.4);assert.ok(successorGas>=option.requiredNextAir);
 assert.ok(minSpeed>=220);
});

test('complete candidate real-O unit: low-tank landing reserves the real refill wait before the next launch can clear a roof',()=>{
 const dt=1/60,u=candidateHarness({speed:65,vz:-65,airRemaining:4,isFreefalling:false},lanes.map((_,i)=>car(i,-20,22))),h=u.h;
 const {option}=u.candidate(2.3,3);assert.ok(option,'pure complete paid candidate exists');u.dispatch(option);
 const first=h.step(dt),plan=first.frame;assert.equal(plan.jump,true);assert.equal(plan.jumpHeight,2.3);
 assert.ok(plan.nextJumpAir>=3.6);assert.ok(plan.groundPreparationSeconds>.40,'cooldown alone is insufficient');
 let landingGas=null;
 for(let i=0;i<120&&landingGas===null;i++){h.step(dt);if(h.state.y===0)landingGas=h.state.airRemaining;}
 assert.notEqual(landingGas,null);
 const rise=Math.ceil(1.45/(20.15*dt))*dt,refill=Math.max(0,plan.nextJumpAir-landingGas)/3.4;
 assert.ok(plan.groundPreparationSeconds>=Math.max(.12,refill)+rise+3*dt-1e-8,'validated window covers paid refill, discrete rise and frame buffer');
 while(h.state.airRemaining<plan.nextJumpAir){
  const gas=h.state.airRemaining,f=h.step(dt);assert.ok(f);assert.equal(f.frame.input.boost,0);
  assert.ok(Math.abs(h.state.airRemaining-gas-3.4*dt)<1e-9,'recovery uses ordinary ground recharge');
 }
 assert.equal(h.impacts.length,0);assert.equal(h.state.isDestroyed,false);
});

test('speculative hop traffic uses independent reservations, poses and spawn state',()=>{
 const cars=lanes.map((_,i)=>car(i,-20,22));
 cars.push(car(1,-510,25,{highwayWaitingToSpawn:true}));cars.at(-1).mesh.visible=false;
 const u=candidateHarness({speed:65,vz:-65,airRemaining:10},cars),h=u.h;
 const beforeCars=JSON.stringify(cars),beforePlayer=JSON.stringify(h.state);
 const {option}=u.candidate(2.3,3);
 assert.ok(option,'pure complete arc exists; no claim of first-tick autonomous admission');assert.equal(JSON.stringify(cars),beforeCars,'speculation cannot mutate actual NPC, mesh or reservation');
 assert.equal(JSON.stringify(h.state),beforePlayer,'speculation cannot mutate player');
});

test('complete candidate real-O unit: pending real refill cannot be interrupted by optional paid braking',()=>{
 const dt=1/60,u=candidateHarness({speed:65,vz:-65,airRemaining:4},lanes.map((_,i)=>car(i,-20,22))),h=u.h;
 const {option}=u.candidate(2.3,3);assert.ok(option);u.dispatch(option);
 const plan=h.step(dt).frame;assert.equal(plan.jump,true);
 for(let i=0;i<120&&h.state.y>0;i++)h.step(dt);
 assert.ok(h.state.airRemaining<plan.nextJumpAir);
 Object.assign(h.state,{speed:75,vz:-75,vx:0,x:2.5,y:0,vy:0,isJumping6m:false});
 h.cars.splice(0,h.cars.length,...lanes.map((_,i)=>car(i,-80,62)));
 const gas=h.state.airRemaining,result=h.step(dt);
 assert.equal(result.frame.jump,false);assert.equal(result.frame.input.boost,0);assert.equal(result.frame.input.brake,0);
 assert.equal(result.frame.input.throttle,1);assert.ok(Math.abs(h.state.airRemaining-gas-3.4*dt)<1e-9);
});

test('complete candidate real-O unit: the admitted preparation interval stays unpowered and conservatively transfers paid successor state',()=>{
 const dt=1/60,u=candidateHarness({speed:65,vz:-65,airRemaining:8},lanes.map((_,i)=>car(i,-20,22))),h=u.h;
 const {option}=u.candidate(2.3,3);assert.ok(option);u.dispatch(option);
 const first=h.step(dt);assert.equal(first.frame.jump,true);const predicted=option;
 assert.ok(predicted.groundWait<predicted.preparation,'rise clearance and frame buffer are validation, not extra ground waiting');
 const remembered=predicted.endpoint.distanceBySpeed[0];h.state.distanceBySpeed[0]=123;assert.equal(predicted.endpoint.distanceBySpeed[0],remembered,'handoff evidence cannot alias mutable actual state');
 const steps=Math.round((predicted.duration+predicted.groundWait)/dt);let groundFrames=0;
 for(let i=1;i<steps;i++){
  const gas=h.state.airRemaining,f=h.step(dt);assert.ok(f);
  assert.equal(f.frame.input.boost,0);assert.equal(f.frame.input.brake,0);
  if(f.frame.input.throttle===1){groundFrames++;assert.ok(Math.abs(h.state.airRemaining-gas-3.4*dt)<1e-9);}
 }
 assert.ok(groundFrames>=Math.floor(predicted.groundWait/dt)-2);assert.equal(h.launches.length,1);assert.equal(h.impacts.length,0);
 assert.ok(h.state.airRemaining>=predicted.endpoint.airRemaining-1e-9,'successor cannot count nonexistent refill gas');
 assert.ok(h.state.airRemaining-predicted.endpoint.airRemaining<=3.4*dt+1e-8);
 assert.ok(Math.abs(h.state.speed-predicted.endpoint.speed)<.10);
 assert.ok(Math.abs(h.state.x-predicted.endpoint.x)<.10);assert.ok(Math.abs(h.state.yaw-predicted.endpoint.yaw)<.01);
 for(let i=0;i<h.cars.length;i++){assert.ok(predicted.forecast[i].mesh.position.z>0&&predicted.forecast[i].mesh.position.z<65,'handoff precedes the respawn in the later validation tail');assert.ok(Math.abs(h.cars[i].mesh.position.z-predicted.forecast[i].mesh.position.z)<.2);}
});
