// 15-minute deterministic NPC-step CPU stress. Not player-driving/WebGL/FPS proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/highway-traffic.js',import.meta.url),'utf8');
const lanes=[-12.5,-7.5,-2.5,2.5,7.5,12.5],scale=1.65,fps=30,seconds=900;
function setup(count){
 const h=Function(source+'\nreturn highwayTraffic;')();let seed=7;
 const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/2**32);
 const drivers=h.createDrivers(count,random);
 const cars=drivers.map((d,i)=>{const lane=i%6,z=-420+i/count*760+(random()*14-7);
  const material=Object.freeze({approved:'material',i}),geometry=Object.freeze({approved:'geometry',i}),size=Object.freeze({x:1,y:1,z:1});
  return {...d,mode:'highway',laneIdx:lane,targetX:lanes[lane],speed:d.desiredSpeed,length:4.62,width:2.03,height:1.25,
   vx:0,vz:-d.desiredSpeed,y:0,blastTimer:0,mesh:{position:{x:lanes[lane],y:0,z:Math.abs(z)<22&&lane===3?z-40:z},
    rotation:{x:0,y:0,z:0},visible:true,userData:{wheels:[]},material,geometry,scale:size}};});
 return {h,cars,identities:[...cars],meshes:cars.map(c=>c.mesh),targets:cars.map(c=>c.desiredSpeed),assets:cars.map(c=>[c.mesh.material,c.mesh.geometry,c.mesh.scale])};
}
const live=c=>c.mesh.visible!==false&&c.highwayWaitingToSpawn===undefined;
function separated(cars,label){
 for(let i=0;i<cars.length;i++)for(let j=i+1;j<cars.length;j++){
  const a=cars[i],b=cars[j];
  assert.ok(Math.abs(a.mesh.position.x-b.mesh.position.x)>=1.85||Math.abs(a.mesh.position.z-b.mesh.position.z)>=4.62,label);
 }
}
for(const [count,playerSpeed]of [[20,0],[52,10],[52,100]])test(`${count}cars at player${playerSpeed}m/s retain safe moving front supply for900s with periodic incident rear recovery`,()=>{
 const {h,cars,identities,meshes,targets,assets}=setup(count),p={x:2.5,y:0,z:0,vx:0,vz:-playerSpeed};
 let samples=0,frontSum=0,minFront=Infinity,speedSum=0,speedSamples=0,passes=0,incidents=0,admissions=0,hiddenFrames=0,physicalSamples=0;
 const previous=cars.map(()=>({}));
 for(let frame=0;frame<seconds*fps;frame++){
  // Exercise the real blast-expiry API used by active/destroyed physics. This
  // is an expiry handoff, not a substitute claim to integrate the blast arc.
  if(frame>0&&frame%(60*fps)===0){
   const start=(incidents*7)%count,c=cars.find((_,i)=>i>=start&&live(cars[i]))||cars.find(live);assert.ok(c);
   c.blastTimer=.001;c.blastVx=12;c.blastVy=20;c.blastVz=-5;c.y=c.mesh.position.y=3;
   c.mesh.rotation.x=.7;c.mesh.rotation.z=1.2;
   const admitted=h.respawnBehind(c,cars,lanes,p,scale);
   assert.equal(c.highwayPassedThisFrame,false,'incident birth never awards a pass');assert.equal(c.highwayPassEligible,false);
   assert.equal(c.blastTimer,0);assert.equal(c.y,0);assert.equal(c.mesh.position.y,0);
   if(admitted){assert.ok(c.mesh.position.z>=95&&c.mesh.position.z<=415);separated(cars.filter(live),'incident admission must not overlap a live body');}
   else{assert.equal(c.mesh.visible,false);assert.equal(c.highwayWaitingToSpawn,false);assert.equal(c.highwayRecycledBehind,true);assert.equal(c.mesh.position.z,510);}
   incidents++;
  }
  for(let i=0;i<count;i++){const c=cars[i];Object.assign(previous[i],{z:c.mesh.position.z,speed:c.speed,waiting:c.highwayWaitingToSpawn,incident:c.highwayRecycledBehind,eligible:c.highwayPassEligible});}
  h.step(cars,p,1/fps,lanes,scale);
  let front=0;
  for(let i=0;i<count;i++){
   const c=cars[i],old=previous[i],z=c.mesh.position.z;
   assert.ok(Number.isFinite(z)&&Number.isFinite(c.mesh.position.x));assert.ok(c.speed>=0&&c.speed<=c.desiredSpeed);
   if(c.highwayPassedThisFrame){passes++;assert.equal(old.eligible,true,'only a previously eligible real approach is scoreable');assert.notEqual(old.incident,true);assert.equal(old.waiting,undefined,'queue admission is not a pass');assert.ok(old.z<=65&&z< -400,'pass needs the actual rear-exit crossing and normal front refill');}
   if(c.highwayWaitingToSpawn!==undefined){
    hiddenFrames++;assert.equal(c.mesh.visible,false);assert.equal(c.highwayPassEligible,false);
    assert.equal(z,c.highwayWaitingToSpawn?-510:510,'hidden queue is parked out of the collision/render window');
    if(old.waiting!==undefined){assert.equal(c.highwayWaitingToSpawn,old.waiting);assert.equal(c.highwayRecycledBehind,old.incident,'retry retains incident/normal direction');}
   }else{
    assert.equal(c.mesh.visible,true);assert.equal(c.vz,-c.speed,'physical NPC speed does not become player-relative world speed');
    if(z<0&&z>=-480)front++;
    if(old.waiting!==undefined){
     admissions++;assert.equal(c.highwayPassedThisFrame,false,'newly visible queue birth cannot score');
     if(old.waiting)assert.ok(z< -400,'front queue must not switch to behind');
     else if(old.incident)assert.ok(z>=90&&z<=422,'incident queue stays behind on admission');
     else assert.ok(z>=17&&z<=61,'normal rear queue retains its23–55m entry policy');
     separated(cars.filter(live),'new queue admission must not overlap a live body');
    }else if(Math.abs(z-old.z)<20){
     const physical=playerSpeed-(z-old.z)/(scale/fps);physicalSamples++;
     assert.ok(physical>=-1e-6&&physical<=c.desiredSpeed+1e-6,'continuous world displacement must retain real driver speed');
    }else if(old.z< -470){assert.equal(c.highwayPassedThisFrame,false,'normal forward exit/rear birth is not an overtake');}
   }
  }
  if(frame>=30*fps){assert.ok(front>0,`front depleted at${frame/fps}s for${count}cars/${playerSpeed}m/s`);minFront=Math.min(minFront,front);frontSum+=front;samples++;}
  if(frame%fps===0){
   const present=cars.filter(live);separated(present,'visible NPC bodies must remain separated over the whole15-minute run');
   speedSum+=present.reduce((sum,c)=>sum+c.speed,0)/Math.max(1,present.length);speedSamples++;
   for(let i=0;i<count;i++){const c=cars[i];assert.equal(c,identities[i]);assert.equal(c.mesh,meshes[i]);assert.equal(c.desiredSpeed,targets[i]);assert.equal(c.mesh.material,assets[i][0]);assert.equal(c.mesh.geometry,assets[i][1]);assert.equal(c.mesh.scale,assets[i][2]);}
  }
 }
 assert.equal(incidents,14);assert.ok(physicalSamples>seconds*fps,'measure movement repeatedly, not only target numbers');
 assert.ok(frontSum/samples>=count*.2,'sustained front density, not a token NPC');assert.ok(speedSum/speedSamples>8,'NPCs really move rather than park to preserve headcount');
 if(playerSpeed>=42)assert.ok(passes>count,'later real approaches recur instead of exhausting the initial population');
 // Queue use depends on actual gaps; do not invent a crowd or force an unsafe
 // admission merely to require a nonzero queue count in every traffic regime.
 console.log(JSON.stringify({scope:'NPC-step CPU only',seconds,count,playerSpeed,minFront,meanFront:frontSum/samples,meanNpcKmH:speedSum/speedSamples*3.6,passes,incidents,admissions,hiddenFrames}));
});
