import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fixture } from './helpers/reference-fixture.mjs';
import { installJetPhysics } from './helpers/jet-physics-harness.mjs';
const phys=readFileSync(new URL('../src/physics-main.js',import.meta.url),'utf8');
const src=readFileSync(new URL('../src/vehicles.js',import.meta.url),'utf8');
const read=(f,expression)=>vm.runInContext(expression,f.context);
const active=(f,list)=>Array.from(read(f,`${list}.map(p=>thrusterPlumeState.get(p).power)`));
const positive=a=>a.map((p,i)=>p>0?i:-1).filter(i=>i>=0);

test('one open shared envelope per outlet has finite bounded topology, unlit alpha and no solid disks',()=>{
 const f=fixture();
 assert.equal(read(f,'allThrusterPlumes.length'),18);
 assert.equal(read(f,'new Set(allThrusterPlumes.map(p=>p.children[0].geometry)).size'),1);
 assert.equal(read(f,'allThrusterPlumes.every(p=>p.children.length===1)'),true);
 assert.equal(read(f,'allThrusterPlumes.every(p=>p.children[0].material.depthWrite===false&&p.children[0].material.side===THREE.DoubleSide&&p.children[0].material.uniforms.uOpacity.value<=.34)'),true);
 assert.equal(read(f,'coldGasEnvelopeGeometry.index.array.length/3'),288);
 const positions=read(f,'Array.from(coldGasEnvelopeGeometry.attributes.position.array)');
 assert.ok(positions.every(Number.isFinite));
 for(let i=2;i<positions.length;i+=3)assert.ok(positions[i]>=0&&positions[i]<=1,'envelopes start at mouth and only extend outward');
 assert.doesNotMatch(src,/machDiamondMat|heatShimmerMat|machVaporRing|Math.random\(\).*plume/);
});

test('body selection places actual mouth coordinates; view changes preserve selected layout',()=>{
 const f=fixture();
 for(const model of ['reference','classic','reference']){
  f.api.setModel(model);
  assert.equal(read(f,'rearPlumes[0].position.z'),model==='reference'?.047:.17);
  assert.equal(read(f,'rearPlumes[0].position.y'),model==='reference'?-.06:0);
  assert.equal(read(f,'frontRetroPlumes[0].position.z'),model==='reference'?-2.205:-2.32);
  assert.equal(read(f,'coldGasNozzlesGroup.parent===carMeshGroup'),true);
  for(const view of [true,false,true,false]){f.setCockpitPerspective(view);assert.equal(read(f,'rearPlumes[0].position.z'),model==='reference'?.047:.17);}
 }
});

test('roll/pitch/yaw/strafe reuse the correctly directed physical ports without duplicate plumes',()=>{
 const f=fixture();
 const step=(roll=0,pitch=0,yaw=0,strafe=0)=>read(f,`updateColdGasVisuals(.016,false,0,0,false,0,0,${roll},${pitch},${yaw},${strafe})`);
 step(1);assert.deepEqual(positive(active(f,'liftPlumes')),[1,3]);assert.deepEqual(positive(active(f,'descendPlumes')),[0,2]);
 step(-1);assert.deepEqual(positive(active(f,'liftPlumes')),[0,2]);assert.deepEqual(positive(active(f,'descendPlumes')),[1,3]);
 step(0,1);assert.deepEqual(positive(active(f,'liftPlumes')),[0,1]);assert.deepEqual(positive(active(f,'descendPlumes')),[2,3]);
 step(0,-1);assert.deepEqual(positive(active(f,'liftPlumes')),[2,3]);assert.deepEqual(positive(active(f,'descendPlumes')),[0,1]);
 step(0,0,1);assert.deepEqual(positive(active(f,'sideRcsPlumes')),[1,2]);
 step(0,0,-1);assert.deepEqual(positive(active(f,'sideRcsPlumes')),[0,3]);
 step(0,0,0,-1);assert.deepEqual(positive(active(f,'sideRcsPlumes')),[1,3]);
 step(0,0,0,1);assert.deepEqual(positive(active(f,'sideRcsPlumes')),[0,2]);
 step(1,1,1,-1);assert.ok(active(f,'allThrusterPlumes').every(p=>p>=0&&p<=1));
});

const scenarios=[
 {name:'EV ground W',keys:['KeyW'],state:{y:0},kind:'none'},
 {name:'ground boost',keys:['Semicolon'],state:{y:0},kind:'rear'},
 {name:'forward retro H',keys:['KeyH'],state:{y:0,speed:80,vz:-80},kind:'front'},
 {name:'forward retro S',keys:['KeyS'],state:{y:0,speed:80,vz:-80},kind:'front'},
 {name:'air rear W',keys:['KeyW'],kind:'rear'},
 {name:'air rear boost',keys:['Semicolon'],kind:'rear'},
 {name:'lift',keys:['Space'],kind:'lift'},
 {name:'jump',state:{y:.01,vy:1,isJumping6m:true,jumpStartY:0,jumpTargetY:6},kind:'lift'},
 {name:'altitude hold',state:{isAltitudeHold:true,holdTargetY:100},kind:'hold'},
 {name:'active descent',keys:['ShiftLeft'],kind:'top'},
 ...[['KeyJ','roll+'],['KeyL','roll-'],['KeyI','pitch+'],['KeyK','pitch-'],['KeyA','yaw+'],['KeyD','yaw-'],['KeyQ','strafe-'],['KeyE','strafe+']].map(([key,kind])=>({name:kind,keys:[key],kind})),
 {name:'backward air retro',keys:['KeyH'],state:{speed:80,vz:80},kind:'rearRetro'},
 {name:'combined requests',keys:['Space','KeyW','KeyA','KeyJ','KeyQ'],kind:'combined'},
 {name:'release',keys:[],kind:'none'}
];
for(const map of ['highway','city'])for(const mode of ['realistic','fantasy']){
 test(`${map}/${mode}: accepted production requests, both bodies/cabins, 30/60/144/irregular frames and gas boundaries`,()=>{
  const f=fixture(),h=installJetPhysics(f.context);h.setMap(map);
  let count=0;
  for(const model of ['reference','classic'])for(const cabin of ['reference','classic']){
   f.api.setModel(model);f.api.setCockpit(cabin);
   for(const dt of [1/30,1/60,1/144,.023])for(const air of [0,.001,.006,2,10])for(const scene of scenarios){
    h.reset({physicsMode:mode,airRemaining:air,airUsedContinuous:10-air,...scene.state});
    for(const key of scene.keys||[])h.keys[key]=true;
    const result=h.step(dt),powers=h.powers();count++;
    assert.ok(powers.every(p=>Number.isFinite(p.power)&&p.power>=0&&p.power<=1),`${scene.name}/${air}/${dt}`);
    if(scene.kind==='none')assert.ok(powers.every(p=>!p.visible),scene.name);
    if(air===0&&scene.state?.y!==0)assert.ok(powers.every(p=>!p.visible),'empty air cannot show thrust');
    if(air===10){
     if(scene.kind==='rear')assert.ok(active(f,'rearPlumes').every(p=>p===1),scene.name);
     if(scene.kind==='rearRetro')assert.ok(active(f,'rearPlumes').every(p=>p>0),scene.name);
     if(scene.kind==='front')assert.ok(active(f,'frontRetroPlumes').every(p=>p>0),scene.name);
     if(scene.kind==='lift')assert.ok(active(f,'liftPlumes').every(p=>p===1),scene.name);
     if(scene.kind==='hold')assert.ok(active(f,'liftPlumes').every(p=>p===.22),scene.name);
     if(scene.kind==='top')assert.ok(active(f,'descendPlumes').every(p=>p===1),scene.name);
    }
    if(!result.isRearThrusterFiring&&!(result.isRetroBrakeFiring&&result.retroUsesRearNozzles))assert.ok(active(f,'rearPlumes').every(p=>p===0));
   }
  }
  assert.equal(count,1680);
 });
}

test('analog requests scale the correct longitudinal axis, release immediately and hide every FPV plume',()=>{
 const f=fixture(),h=installJetPhysics(f.context);let touch={};f.window.RoadsterTouch={readInput:()=>touch};
 for(const p of [.1,.25,.5,1]){
  h.reset({y:0});touch={boost:p};h.step(1/60);assert.ok(active(f,'rearPlumes').every(power=>power===p));
  const scales=read(f,'rearPlumes[0].children[0].scale');assert.ok(scales.z>.3&&scales.z<=1.35);assert.ok(scales.y<=.092);
  touch={};h.step(1/60);assert.ok(h.powers().every(p=>!p.visible));
 }
 h.setView(3);h.reset();touch={throttle:1,lift:1,strafe:1,pitch:1,roll:1};h.step(1/60);
 assert.ok(h.powers().some(p=>p.power>0));assert.ok(h.powers().every(p=>!p.visible),'accepted thrust remains instrumented but never covers FPV road');
 h.resetVisuals();assert.ok(h.powers().every(p=>p.power===0&&!p.visible));
 assert.doesNotMatch(phys.slice(phys.indexOf('  const isCockpitFpv ='),phys.indexOf('  let activeCount =')),/consumeAirTank|state\.[a-zA-Z]+\s*=/);
});


test('emergency lift uses its accepted full command at low tank, and 3D retro chooses paid travel components',()=>{
 const f=fixture(),h=installJetPhysics(f.context);
 h.reset({y:1.5,vy:-8,airRemaining:1.8,airUsedContinuous:8.2});
 const emergency=h.step(1/60);assert.equal(emergency.isLiftFiring,true);assert.equal(h.state.isAutoLandingSave,true);assert.ok(active(f,'liftPlumes').every(p=>p===1));
 for(const velocity of [[70,-20,0],[-70,20,0],[0,-20,0],[0,20,0]]){
  h.reset({vx:velocity[0],vy:velocity[1],vz:velocity[2],speed:Math.hypot(velocity[0],velocity[2])});h.keys.KeyH=true;
  const result=h.step(1/144);assert.equal(result.isRetroBrakeFiring,true);
  if(velocity[0]>0)assert.ok(active(f,'sideRcsPlumes')[1]>0&&active(f,'sideRcsPlumes')[3]>0);
  if(velocity[0]<0)assert.ok(active(f,'sideRcsPlumes')[0]>0&&active(f,'sideRcsPlumes')[2]>0);
  if(velocity[1]<0)assert.ok(active(f,'liftPlumes').every(p=>p>0));
  if(velocity[1]>0)assert.ok(active(f,'descendPlumes').every(p=>p>0));
 }
});
