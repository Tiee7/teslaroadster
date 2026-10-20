import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Unit seams are inserted only in this isolated test realm. Physical safety is
// covered separately by production-body trajectory replays, not these stubs.
function planner(reset=true,clock){
  let source=fs.readFileSync(new URL('../src/highway-demo.js',import.meta.url),'utf8').split('// UI/lifecycle adapter.')[0];
  const anchor='return { step, reset, invalidateFuelMode, beginRender, endRender, stats:';
  assert.equal(source.split(anchor).length,2);
  source=source.replace('const RoadsterHighwayDemoPlanner =','globalThis.factory =').replace(anchor,`return { test:{prepareAdmissionSteps,prepareActualAdmission,actualCheckpoint,certificatePhase,invalidateAdmission,consumePreparedSource,beforeControlStep,exactDifference,advancePlanJob,
    epoch(){return planEpoch;},schema(){return controlPhysicsSchema;},
    frame(value){simulationFrame=value;},certificate(value){certifiedNext=value;},source(value){planJob=value;},admission(value){admissionJob=value;},airborne(value){lastFrameAirborne=value;},
    seed(value){stepSeed=value;},probe(value){globalThis.__budgetProbe=value;},state(){return {planJob,admissionJob,certifiedNext};}}, step, reset, invalidateFuelMode, beginRender, endRender, stats:`);
  const stepAnchor='      beforeControlStep(player,cars,dt);';assert.equal(source.split(stepAnchor).length,2);
  source=source.replace(stepAnchor,`      if(globalThis.__budgetProbe){spendWork(globalThis.__budgetProbe[0]);spendWork(globalThis.__budgetProbe[1]);return {input:neutral(),jump:false};}beforeControlStep(player,cars,dt);`);
  const realm=vm.createContext({performance:clock});vm.runInContext(source,realm);
  const p=realm.factory.create([-12.5,-7.5,-2.5,2.5,7.5,12.5],1.65);if(reset)p.reset(2.5);return p;
}
const state=()=>({physicsMode:'realistic',insaneMode:false,infiniteJet:false,isDestroyed:false,isFreefalling:false,impactCooldown:0,speed:70,airRemaining:8,x:2.5,y:0,z:0,vx:0,vy:0,vz:-70});
function api(){return {entryAir:()=>3.6,prepareProjectedGroundSteps:function*(){},projectedImmediate:()=>Infinity,
  projectedGroundStep(){},groundSweepBefore:()=>[],groundSweepClear:()=>true,
  candidateSteps:function*(){throw Error('not expected');},groundTerminalSteps:function*(){throw Error('not expected');}};}
function finish(iterator){let next;do{next=iterator.next();}while(!next.done);return next.value;}

test('a trigger-free strict prefix is deferred without rejecting its ranking geometry',()=>{
  const p=planner(),seed=p.test.actualCheckpoint(state(),[],0),job={dt:1/60,geometry:[{height:2.3,lane:3}],checkpoints:new Map(),minimumAnchorFrame:0,work:0,nodes:0};
  const result=finish(p.test.prepareAdmissionSteps(job,api(),seed));
  assert.equal(result.deferred,true);assert.equal(result.retryFrame,72);assert.equal(job.anchor,undefined);assert.equal(job.checkpoints.size,145);
  const source={origin:'ground',readyGoal:{path:[{height:2.3,lane:3}]}};p.test.source(source);p.test.frame(0);
  Object.assign(job,{sourceJob:source,promised:false,result,done:true,invalid:false,identities:[]});p.test.admission(job);
  assert.equal(p.test.prepareActualAdmission(api(),state(),[],1/60,Infinity),null);
  assert.equal(p.test.state().planJob,source);assert.equal(p.stats().preparedDeferred,1);
});

test('a late promised retry prepares and sweeps future ground instead of reusing offset zero',()=>{
  const p=planner(),certificate={lane:3,height:4.5,requiredNextAir:3.6,physicsMode:'realistic',insaneMode:false,infiniteJet:false,frameDt:1/60,phase:1};p.test.certificate(certificate);p.test.frame(0);
  p.test.admission({promised:true,work:192,pendingWorkStart:0,pendingAnchor:{frame:0}});p.test.invalidateAdmission('anchor-not-ready');
  assert.equal(certificate.retryLeadFrames,5);
  const seed=p.test.actualCheckpoint(state(),[],0),job={dt:1/60,promised:true,geometry:[certificate],minimumAnchorFrame:certificate.retryLeadFrames,checkpoints:new Map(),work:0,nodes:0};
  let groundedFrames=0,arcs=0;const a=api();a.projectedGroundStep=()=>{groundedFrames++;};a.candidateSteps=function*(){arcs++;yield null;return {height:4.5,lane:3,endpoint:{},forecast:[]};};
  const result=finish(p.test.prepareAdmissionSteps(job,a,seed));assert.ok(result.root);assert.equal(job.anchor.frame,5);assert.equal(groundedFrames,5);assert.equal(arcs,1);
});

test('a promised B retains only the ranking job bound to its complete certificate phase',()=>{
  for(const stale of [false,true]){
    const p=planner(),car=state(),certificate={lane:3,height:4.5,requiredNextAir:4.2,physicsMode:'realistic',insaneMode:false,infiniteJet:false,frameDt:1/60,phase:7};p.test.certificate(certificate);p.test.frame(10);
    const source={afterCertificate:{...p.test.certificatePhase(certificate),phase:stale?6:7},readyGoal:{path:[{height:2.3,lane:4}]}};p.test.source(source);
    const root={height:4.5,lane:3,requiredNextAir:4.2};p.test.admission({dt:1/60,promised:true,sourceJob:source,done:true,invalid:false,result:{root},anchor:p.test.actualCheckpoint(car,[],10),work:0});
    const option=p.test.prepareActualAdmission(api(),car,[],1/60,Infinity);
    assert.equal(option,root);assert.equal(option.fromCertificate,true);assert.equal(p.stats().certifiedHandoffs,1);
    assert.equal(option.retainedPlanJob,stale?undefined:source);
    if(!stale)assert.equal(source.afterCertificate,null);
  }
});


test('direct step and multi-tick render share one192-work allowance across every role',()=>{
  const job=()=>({work:0,done:false,iterator:(function*(){for(let i=0;i<1000;i++)yield null;})()});
  const p=planner(),a=job(),b=job();p.test.probe([a,b]);p.step(state(),[],1/60);
  assert.equal(a.work+b.work,192);assert.equal(p.stats().maxBackgroundWork,192);
  p.step(state(),[],1/60);assert.equal(a.work+b.work,384,'the next standalone step is a new render');
  const q=planner(),c=job(),d=job();q.test.probe([c,d]);q.beginRender();q.step(state(),[],1/60);q.step(state(),[],1/60);q.step(state(),[],1/60);
  assert.equal(c.work+d.work,192,'three simulation ticks do not multiply render budget');q.beginRender();q.step(state(),[],1/60);assert.equal(c.work+d.work,384);
});

test('selected future geometry is not retried at every earlier transient trigger',()=>{
  const p=planner(),car=state();p.test.frame(100);p.test.seed(p.test.actualCheckpoint(car,[],100));
  p.test.source({origin:'ground',createdFrame:100,age:0,candidateLaunchAge:1.5,readyGoal:{launchDelay:.1,path:[{height:2.3,lane:3}]}});
  const a=api(),anchors=[];a.projectedImmediate=()=>.1;a.candidateSteps=function*(){anchors.push(p.test.state().admissionJob.pendingAnchor.frame);return null;};
  assert.equal(p.test.prepareActualAdmission(a,car,[],1/60,.1),null);
  assert.equal(p.test.state().admissionJob.minimumAnchorFrame,196);assert.equal(anchors[0],196);assert.ok(anchors.every(frame=>frame>=196),'all earlier physical frames are swept as normal ground, not candidates');
});

test('air-origin geometry alone never starts an actual admission or takes its budget',()=>{
  for(const origin of ['post-certificate','continuation','handoff']){
    const p=planner(),source={origin,rootHint:{height:7.5,lane:1},readyGoal:{path:[{height:7.5,lane:1}]}};p.test.source(source);
    assert.equal(p.test.prepareActualAdmission(api(),state(),[],1/60,.1),null);assert.equal(p.stats().preparedJobs,0);assert.equal(p.test.state().planJob,source);
  }
});

test('inline ranking work preserves the current-hop and physical-phase priorities',()=>{
  for(const strictSource of [false,true])for(const sourceInvalid of [false,true])for(const airborne of [false,true])for(const promised of [false,true]){
    const p=planner(),job={strictSource,sourceInvalid,work:0,done:false,iterator:(function*(){while(true)yield null;})()};
    p.test.source(job);p.test.airborne(airborne);p.test.certificate(promised?{phase:1}:null);p.beginRender();p.test.advancePlanJob();
    const allowed=strictSource&&!sourceInvalid&&!airborne&&!promised;
    assert.equal(job.work,allowed?192:0,JSON.stringify({strictSource,sourceInvalid,airborne,promised}));
    assert.equal(p.stats().backgroundWork,job.work);assert.equal(p.test.state().planJob,job);
  }
});


test('the first implicit reset preserves the caller render allowance across three ticks',()=>{
  const q=planner(false),job=()=>({work:0,done:false,iterator:(function*(){for(let i=0;i<1000;i++)yield null;})()}),a=job(),b=job();
  q.test.probe([a,b]);q.beginRender();for(let i=0;i<3;i++)q.step(state(),[],1/60);assert.equal(a.work+b.work,192);
});

function strictSource(p,car,cars=[],anchorFrame=1){
  p.test.frame(0);const root={lane:3,height:4.5},goal={path:[root,{lane:4,height:2.3}],terminal:{seconds:2.4}};
  return {origin:'ground',dt:1/60,epoch:p.test.epoch(),sourceSchema:p.test.schema(),strictSource:true,sourceValidatedUntil:0,identities:[...cars],
    sourceCheckpoints:new Map([[1,p.test.actualCheckpoint(car,cars,1)]]),sourceAnchor:p.test.actualCheckpoint(car,cars,anchorFrame),readyGoal:goal};
}
test('an exact complete actual-ground prefix and prepared anchor commit the original full proof once',()=>{
  const p=planner(),car=state(),job=strictSource(p,car);p.test.source(job);p.test.beforeControlStep(car,[],1/60);
  const result=p.test.consumePreparedSource(car,[],1/60,.1);assert.equal(result.root,job.readyGoal.path[0]);assert.equal(result.root.successor,job.readyGoal.path[1]);
  assert.equal(result.root.rankingTerminal,job.readyGoal.terminal);assert.equal(p.stats().cachedSourceCommits,1);assert.equal(p.stats().sourceStartChecks,1);assert.equal(p.stats().sourceAnchorChecks,1);
  assert.equal(p.test.consumePreparedSource(car,[],1/60,.1),null);assert.equal(p.test.state().planJob,null);assert.equal(p.stats().backgroundWork,0);
});
test('a future ready source waits without synchronous work and a missed anchor loses authority',()=>{
  const p=planner(),car=state(),job=strictSource(p,car,[],2);p.test.source(job);p.test.beforeControlStep(car,[],1/60);
  assert.equal(p.test.consumePreparedSource(car,[],1/60,.1).waiting,true);assert.equal(p.stats().backgroundWork,0);
  p.test.frame(3);job.sourceValidatedUntil=3;assert.equal(p.test.consumePreparedSource(car,[],1/60,.1),null);
  assert.equal(job.sourceInvalid,true);assert.equal(p.stats().lastSourceFailure.reason,'missed-source-anchor');assert.equal(p.stats().cachedSourceCommits,0);
  assert.equal(p.stats().sourceInvalidations,1);assert.equal(p.stats().sourceAnchorChecks,0);assert.equal(p.stats().backgroundWork,0);
  assert.equal(p.test.consumePreparedSource(car,[],1/60,.1),null);assert.equal(p.stats().sourceInvalidations,1);
});
test('a promised current hop takes priority over an otherwise exact ready source',()=>{
  const p=planner(),car=state(),certificate={lane:3,height:4.5,requiredNextAir:3.6,physicsMode:'realistic',insaneMode:false,infiniteJet:false,frameDt:1/60,phase:1};
  p.test.certificate(certificate);const job=strictSource(p,car);p.test.source(job);p.test.beforeControlStep(car,[],1/60);
  assert.equal(p.test.consumePreparedSource(car,[],1/60,.1),null);assert.equal(p.test.state().planJob,job);assert.equal(p.test.state().certifiedNext,certificate);
  assert.equal(job.sourceInvalid,undefined);assert.equal(p.stats().sourceStartChecks,1);assert.equal(p.stats().sourceAnchorChecks,0);assert.equal(p.stats().cachedSourceCommits,0);assert.equal(p.stats().backgroundWork,0);
});
test('every control/physics/NPC/history dependency and phase guard invalidates source authority exactly',()=>{
  const npc=()=>({mode:'highway',speed:40,mesh:{position:{x:7.5,y:0,z:-30},rotation:{x:0,y:0,z:0},visible:true}});
  const changes=[
    ['state.lateralG',(p,c)=>{c.lateralG=.01;}],['state.airRemaining',(p,c)=>{c.airRemaining-=.01;}],['state.infiniteJet',(p,c)=>{c.infiniteJet=true;}],['state.roll',(p,c)=>{c.roll=-0;}],
    ['cars.0.mesh.position.z',(p,c,n)=>{n[0].mesh.position.z+=.01;}],['route.previousSpeeds.0',(p,c,n,j)=>{j.sourceCheckpoints.get(1).route.previousSpeeds[0]=0;}],
    ['external.keys.0',(p,c,n,j)=>{j.sourceCheckpoints.get(1).external.keys[0]=true;}],['state.physicsMode',(p,c)=>{c.physicsMode='fantasy';}],
    ['source-version',(p,c,n,j)=>{j.epoch++;}],['source-version',(p,c,n,j)=>{j.dt=1/30;}],['source-version',(p,c,n,j)=>{j.identities=[npc()];}],
    ['source-version',(p,c,n,j)=>{j.sourceSchema='old';}],['source-prefix-not-ready',(p,c,n,j)=>{j.sourceCheckpoints.clear();}],['source-prefix-gap',(p,c,n,j)=>{j.sourceValidatedUntil=-1;}],
  ];
  for(const [failure,change] of changes){const p=planner(),car={...state(),roll:0,lateralG:0},cars=[npc()],job=strictSource(p,car,cars);p.test.source(job);change(p,car,cars,job);
    p.test.beforeControlStep(car,cars,1/60);assert.equal(job.sourceInvalid,true,change.toString());assert.equal(p.test.consumePreparedSource(car,cars,1/60,.1),null);assert.equal(p.stats().cachedSourceCommits,0);assert.ok(job.readyGoal,'invalid proof remains only geometry');
    const prefixMismatch=!failure.startsWith('source-');assert.equal(p.stats().lastSourceFailure.reason,prefixMismatch?'source-prefix-mismatch':failure);
    if(prefixMismatch)assert.equal(p.stats().lastSourceFailure.difference,failure);assert.equal(p.stats().sourceInvalidations,1);}
});
test('the prepared anchor independently checks all dependencies after normal route preparation',()=>{
  const p=planner(),car=state(),job=strictSource(p,car);p.test.source(job);p.test.beforeControlStep(car,[],1/60);car.vYaw=.00001;
  assert.equal(p.test.consumePreparedSource(car,[],1/60,.1),null);assert.equal(p.stats().lastSourceFailure.reason,'source-anchor-mismatch');assert.equal(p.stats().cachedSourceCommits,0);
});


test('a proof completed within the anchor step can be consumed without a second work slice',()=>{
  const p=planner(),car=state(),job=strictSource(p,car);delete job.readyGoal;delete job.sourceAnchor;
  const launch=p.test.actualCheckpoint(car,[],1),projected={...car,demoControlExternal:launch.external,demoTarget:launch.route.target,demoChanging:launch.route.changing,demoDwell:launch.route.dwell,demoJumpCooldown:launch.route.jumpCooldown,demoCharging:launch.route.charging,demoDecisionCooldown:launch.route.decisionCooldown,demoRefillTarget:launch.route.refillTarget,demoLandingLane:launch.route.landingLane,demoCertificate:false,demoNpcSpeeds:[]};
  Object.assign(job,{work:0,candidateLaunchFrame:1,iterator:(function*(){return {path:[{lane:3,height:4.5}],terminal:{seconds:2.4},launchFrames:0,launchState:projected,launchCars:[],launchCheckpoints:[]};})()});
  p.test.source(job);p.test.beforeControlStep(car,[],1/60);assert.equal(p.test.consumePreparedSource(car,[],1/60,.1),null);
  p.test.advancePlanJob();assert.equal(p.stats().backgroundWork,1);assert.equal(p.test.consumePreparedSource(car,[],1/60,.1).root.height,4.5);assert.equal(p.stats().backgroundWork,1);
});


test('all roles and ticks stop additional prediction at the real render deadline',()=>{
  let now=0;const p=planner(true,{now:()=>now}),job=()=>({work:0,done:false,iterator:(function*(){for(let i=0;i<1000;i++){now+=21;yield null;}})()}),a=job(),b=job();
  p.test.probe([a,b]);p.beginRender();for(let i=0;i<3;i++)p.step(state(),[],1/60);assert.equal(a.work+b.work,1,'no sibling or later tick receives another time allowance');assert.ok(p.stats().renderTimeLimitHits>0);
  p.beginRender();p.step(state(),[],1/60);assert.equal(a.work+b.work,2,'the next render may resume, never synchronously drain');
});
