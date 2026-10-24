import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source=readFileSync(new URL('../src/highway-traffic.js',import.meta.url),'utf8');
const broken=readFileSync(new URL('./fixtures/traffic-ground-regression-baseline/highway-traffic.js',import.meta.url),'utf8');
const lanes=[-12.5,-7.5,-2.5,2.5,7.5,12.5],scale=1.65;
function setup(count,seed=7){
 const h=Function(source+'\nreturn highwayTraffic;')();let n=seed;const random=()=>((n=Math.imul(n,1664525)+1013904223>>>0)/2**32);
 const drivers=h.createDrivers(count,random),prior=Function(broken+'\nreturn highwayTraffic;')();let old=seed;
 assert.deepEqual(drivers,prior.createDrivers(count,()=>((old=Math.imul(old,1664525)+1013904223>>>0)/2**32)),'exact driver band distribution and targets are unchanged');
 const cars=drivers.map((d,i)=>{const lane=i%6,z=-420+i/count*760+(random()*14-7),safeZ=Math.abs(z)<22&&Math.abs(lanes[lane]-2.5)<4?z-40:z;
  return {...d,mode:'highway',laneIdx:lane,targetX:lanes[lane],speed:d.desiredSpeed,length:4.62,width:2.03,height:1.25,vx:0,vz:-d.desiredSpeed,y:0,blastTimer:0,
   mesh:{position:{x:lanes[lane],y:0,z:safeZ},rotation:{x:0,y:0,z:0},visible:true,userData:{wheels:[]}}};});
 return {h,cars,identities:[...cars],meshes:cars.map(c=>c.mesh),targets:cars.map(c=>c.desiredSpeed)};
}
function simulate(count,speed,{incidents=false,forecast=false}={}){
 const {h,cars,identities,meshes,targets}=setup(count),p={x:2.5,y:0,z:0,vx:0,vz:-speed};let minFront=Infinity,frontTotal=0,samples=0,passes=0,incidentsSeen=0,meanSpeedTotal=0;
 for(let frame=0;frame<180*30;frame++){
  if(incidents&&frame>0&&frame%(20*30)===0){const c=cars[(frame/(20*30))%count];c.blastTimer=2;c.blastVx=12;c.blastVy=20;c.blastVz=-5;c.y=3;c.mesh.position.y=3;
   if(h.respawnBehind(c,cars,lanes,p,scale)){assert.ok(c.mesh.position.z>=95&&c.mesh.position.z<=415);assert.equal(c.highwayPassEligible,false);}
   else{assert.equal(c.mesh.visible,false);assert.equal(c.highwayWaitingToSpawn,false);assert.equal(c.highwayRecycledBehind,true);}
   assert.equal(c.blastTimer,0);incidentsSeen++;
  }
  (forecast?h.forecastStep:h.step)(cars,p,1/30,lanes,scale);passes+=cars.reduce((n,c)=>n+Number(c.highwayPassedThisFrame),0);
  const live=cars.filter(c=>c.mesh.visible!==false&&c.highwayWaitingToSpawn===undefined),front=live.filter(c=>c.mesh.position.z<0&&c.mesh.position.z>=-480).length;
  if(frame>=30*30){minFront=Math.min(minFront,front);frontTotal+=front;samples++;assert.ok(front>0,`front depleted at${frame/30}s, count${count},speed${speed}`);}
  if(frame%30===0){
   for(let i=0;i<count;i++){const c=cars[i];assert.equal(c,identities[i]);assert.equal(c.mesh,meshes[i]);assert.equal(c.desiredSpeed,targets[i]);assert.ok(Number.isFinite(c.speed)&&c.speed>=0&&c.speed<=c.desiredSpeed);assert.ok(Number.isFinite(c.mesh.position.x)&&Number.isFinite(c.mesh.position.z));if(c.highwayWaitingToSpawn!==undefined)assert.equal(c.mesh.visible,false);}
   for(let i=0;i<live.length;i++)for(let j=i+1;j<live.length;j++)assert.ok(Math.abs(live[i].mesh.position.x-live[j].mesh.position.x)>=1.85||Math.abs(live[i].mesh.position.z-live[j].mesh.position.z)>=4.62,'NPC bodies must not overlap');
   meanSpeedTotal+=live.reduce((sum,c)=>sum+c.speed,0)/Math.max(1,live.length);
  }
 }
 assert.ok(frontTotal/samples>=count*.2,'continuous density, not a single token NPC');assert.ok(meanSpeedTotal/180>8,'traffic must actually move, not remain parked');if(speed>=42)assert.ok(passes>count,'ordinary later approaches recur instead of exhausting the initial pool');if(incidents)assert.equal(incidentsSeen,8);
 return {minFront,meanFront:frontTotal/samples,meanSpeedKmh:meanSpeedTotal/180*3.6,passes};
}
for(const count of [20,36,52])for(const speed of [42,100])test(`normal${count}-car stream remains populated and moving for180s at${speed*3.6}km/h`,()=>simulate(count,speed));
test('low-speed52-car stream keeps its weighted speed targets and continuous supply for180s',()=>simulate(52,10));
test('52-car stream survives eight distinct incident recoveries without draining normal forward flow over180s',()=>simulate(52,65,{incidents:true}));
test('six-lane forecast also preserves normal supply for180s with52cars',()=>simulate(52,65,{forecast:true}));
