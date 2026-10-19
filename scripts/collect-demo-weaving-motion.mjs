#!/usr/bin/env node
import vm from 'node:vm';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
const repo=resolve(process.env.REPO || process.argv[2] || process.cwd());
const prefix=resolve(process.env.OUTPUT_PREFIX || 'verification/demo-close-weaving/demo-lane-change-motion');
const hashes=()=>Object.fromEntries(['src/highway-demo.js','src/physics-main.js','src/highway-traffic.js','tests/helpers/demo-harness.mjs','scripts/verify-demo.mjs'].map(p=>[p,createHash('sha256').update(readFileSync(join(repo,p))).digest('hex')]));
const initialHashes=hashes();
const {simulation,car,lanes}=await import(pathToFileURL(join(repo,'tests/helpers/demo-harness.mjs')));
const {pool}=await import(pathToFileURL(join(repo,'scripts/verify-demo.mjs')));
const seed=7,count=36,fps=60;
const snap=h=>({x:h.state.x,y:h.state.y,vx:h.state.vx||0,vz:h.state.vz||0,speed:h.state.speed,
 cars:h.cars.map(c=>({ref:c,x:c.mesh.position.x,z:c.mesh.position.z,height:c.height||1.25,halfZ:(c.length||4.62)/2+2.15,speed:c.speed||0,
 live:c.mode==='highway'&&c.mesh.visible!==false&&c.highwayWaitingToSpawn===undefined,passed:!!c.highwayPassedThisFrame}))});
function trace(scenario){
 const fixture=scenario==='fixture';
 const h=simulation({speed:fixture?65:42,vz:fixture?-65:-42,physicsMode:'realistic'},fixture?[car(3,-150,22)]:[],{seed});
 if(!fixture)pool(h,count,seed);
 const swept=vm.runInContext('RoadsterHighwayDemoPlanner.sweptContact',h.context);
 let geometry;
 h.context.__motionGeometryProbe=()=>{geometry=snap(h);};
 const source=vm.runInContext('testStep.toString()',h.context),marker='trafficCars.forEach(car=>{';
 if(source.split(marker).length!==2)throw Error('Unsupported harness collision probe anchor');
 vm.runInContext(`testStep=(${source.replace(marker,'__motionGeometryProbe();\n'+marker)});`,h.context);
 const stats=()=>({...h.stats()});
 const gap=()=>{
  let nearest=Infinity;
  for(const c of h.cars)if(c.mode==='highway'&&c.mesh.visible!==false&&c.highwayWaitingToSpawn===undefined&&c.mesh.position.z<0&&Math.abs(c.mesh.position.x-h.state.x)<1.85)
   nearest=Math.min(nearest,-c.mesh.position.z-(c.length||4.62)/2-2.15);
  return Number.isFinite(nearest)?nearest:null;
 };
 const rows=[],events=[];let elapsed=0,previousStats=stats(),pending=null,sweptOverlaps=0;
 const record=()=>rows.push({t:elapsed,x:h.state.x,y:h.state.y,vx:h.state.vx,speedKmh:h.state.speed*3.6,targetLane:stats().targetLane,targetX:lanes[stats().targetLane],nearestAheadBumperGapM:gap(),impacts:h.impacts.length,hops:h.launches.length});
 record();
 const seconds=fixture?6:12;
 while(elapsed<seconds-1e-9&&!h.state.isDestroyed){
  const from=snap(h),start=elapsed,dt=1/fps;geometry=null;
  const result=h.step(dt);if(!result||!geometry)break;
  const nextStats=stats();
  if(nextStats.completed>previousStats.completed&&pending){events.push({...pending,completedAtSeconds:start,durationSeconds:start-pending.startedAtSeconds});pending=null;}
  if(nextStats.targetLane!==previousStats.targetLane)pending={fromLane:previousStats.targetLane,targetLane:nextStats.targetLane,startedAtSeconds:start};
  for(let i=0;i<from.cars.length;i++){
   const a=from.cars[i],b=geometry.cars[i];
   if(!a.live||!b.live||b.passed||Math.abs(b.z-a.z)>2+dt*(Math.abs(from.vz)+Math.abs(geometry.vz)+a.speed+b.speed)*1.65)continue;
   if(from.y<a.height-.15&&geometry.y<b.height-.15&&typeof swept==='function'&&swept(a.x-from.x,a.z,b.x-geometry.x,b.z,1.85,b.halfZ)!==null)sweptOverlaps++;
  }
  elapsed+=dt;record();previousStats=nextStats;
 }
 const safe=!h.state.isDestroyed&&h.impacts.length===0&&sweptOverlaps===0&&h.launches.length===0;
 const event=safe?events.find(e=>e.durationSeconds>.2&&e.durationSeconds<2&&rows.filter(r=>r.t>=e.startedAtSeconds-1e-9&&r.t<=e.completedAtSeconds+1e-9).every(r=>r.y<=.005)):null;
 return {scenario:fixture?'Single slow-ahead-car fixture':'Seeded highway traffic',seed,trafficCount:fixture?1:count,fps,observedSeconds:elapsed,
  crashed:!!h.state.isDestroyed,impacts:h.impacts.length,hops:h.launches.length,sweptOverlapFrames:sweptOverlaps,safe,event,rows};
}
let run=trace(process.env.SCENARIO==='fixture'?'fixture':'traffic');
let fallbackReason=null;
if(!run.safe||!run.event){
 fallbackReason='Seeded trace did not meet the no-impact/no-hop/no-swept-overlap complete-change criterion; use an explicitly labelled controlled fixture.';
 run=trace('fixture');
}
if(!run.safe||!run.event)throw Error('No safe completed lane-change trace; no diagram published');
const finalHashes=hashes();
if(JSON.stringify(initialHashes)!==JSON.stringify(finalHashes))throw Error('Source changed while collecting diagram; no diagram published');
const event=run.event,paddingBefore=.2,paddingAfter=.15;
const selectedRows=run.rows.filter(r=>r.t>=event.startedAtSeconds-paddingBefore-1e-9&&r.t<=event.completedAtSeconds+paddingAfter+1e-9);
const payload={title:'One complete demo lane change',label:'CPU production simulation · not WebGL',repo,sourceHashes:initialHashes,sourceFilesStable:true,
 method:'Real imported production harness, controls, motion, seeded pool and collision code. Selected only from an entire observed no-crash/no-impact/no-hop/no-swept-overlap run. Gap is the nearest visible ahead bumper with |dx| < 1.85m; a changed leader may cause a discontinuity; no leader is left blank.',
 scenario:run.scenario,seed:run.seed,trafficCount:run.trafficCount,fps,observedSeconds:run.observedSeconds,
 safety:{crashed:run.crashed,impacts:run.impacts,hops:run.hops,sweptOverlapFrames:run.sweptOverlapFrames},fallbackReason,
 event:{...event,fromX:lanes[event.fromLane],targetX:lanes[event.targetLane]},lanes,rows:selectedRows};
mkdirSync(dirname(prefix),{recursive:true});writeFileSync(prefix+'.json',JSON.stringify(payload,null,2)+'\n');
execFileSync('python3',[join(repo,'scripts/render-demo-weaving-motion.py'),prefix+'.json',prefix],{stdio:'inherit'});
