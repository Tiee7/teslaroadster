import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, existsSync } from 'node:fs';
import { motionHarness } from './helpers/motion-harness.mjs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const runtime = process.env.ROADSTER_THREE_RUNTIME || '/tmp/roadster-three.min.js';
const skip = !existsSync(runtime) && 'Native Three r128 required';
const physics = read('src/physics-main.js');
const section = (a,b) => physics.slice(physics.indexOf(a),physics.indexOf(b,physics.indexOf(a)+a.length));
let cached;
function native() {
 if (cached) return cached;
 const c=vm.createContext({console,Math,atob:s=>Buffer.from(s,'base64').toString('binary'),window:{innerWidth:1440,innerHeight:900,addEventListener(){},dispatchEvent(){}},Event:class{},localStorage:{getItem(){return null;},setItem(){}},document:{createElement(){return{getContext(){return{};}};}}});
 vm.runInContext(readFileSync(runtime,'utf8'),c);vm.runInContext(read('src/config.js'),c);
 const w=read('src/world.js');vm.runInContext(`const scene=new THREE.Scene();${w.slice(w.indexOf('const bodyMaterial ='),w.indexOf('const highwayEnvGroup'))}`,c);
 for(const f of ['highway-traffic','vehicles','reference-exterior','reference-cockpit','npc-traffic-assets','reference-traffic']) vm.runInContext(read('src/'+f+'.js'),c);
 vm.runInContext('globalThis.makeNpc=createTrafficVehicleMesh;',c);
 c.window.RoadsterVehicle.setModel('reference');return cached=c;
}
for (const [number,vx,vz,yaw] of [[2,0,-20,0],[3,-14,0,Math.PI/2]]) {
 const j=JSON.parse(read(`tests/fixtures/city-invisible-traffic-20261021/incident-${number}.json`));
 test(`incident${number} preserves the road-middle NPC report without inventing missing render/build state`,()=>{
  assert.equal(j.contact.kind,'traffic-body');assert.equal(j.previous.y,0);
  assert.equal(j.deltaVKmh,j.deltaV*3.6);assert.equal(j.runtime,undefined);
  assert.equal(j.camera,undefined);assert.equal(j.build,undefined);
  assert.ok(!('trace' in j));
 });
 test(`incident${number} constrained motion/contact reconstruction matches the uploaded NPC collision; screen visibility remains unknown`,{skip},t=>{
  const c=native(),p=j.previous,dt=1/60,vForward=-p.vx*Math.sin(p.yaw)-p.vz*Math.cos(p.yaw);
  const steer=-(j.pose.yaw-p.yaw)/dt/2.35*(1+Math.abs(vForward)*.015),targetRoll=(j.pose.roll-p.roll*(1-11*dt))/(11*dt),lateralG=(targetRoll+steer*.048)/.012;
  const h=motionHarness({...p,speed:Math.hypot(p.vx,p.vz),steerInput:steer,lateralG});
  Object.assign(h.context.THREE,{Box3:c.THREE.Box3});h.context.window.RoadsterVehicle=c.window.RoadsterVehicle;h.context.window.RoadsterTrafficAssets=c.window.RoadsterTrafficAssets;
  h.context.window.RoadsterTouch={readInput:()=>({steer,boost:1})};
  const mesh=c.makeNpc(0,j.contact.variant);mesh.position.set(j.contact.position.x-vx*dt,0,j.contact.position.z-vz*dt);mesh.rotation.y=yaw;
  const car={mesh,mode:'city',length:4.62,height:1.25,width:1.96,vx,vz,y:0,speed:Math.hypot(vx,vz),blastTimer:0};
  h.context.trafficCars=[car];Object.assign(h.context,{hoverRingMat:{opacity:1},spawnDestructionDebris(){},spawnExplosionEffect(){},applyExplosionBlastToTraffic(){},updateDestroyedModalText(){}});h.context.sound.playCrash=()=>{};
  vm.runInContext(read('src/city-diagnostics.js'),h.context);vm.runInContext(section('function triggerPhysicsCollision(','function updateDestroyedScores()'),h.context);
  vm.runInContext(`function trafficStep(dt,isAirborne){const playerWorldZ=state.z,demoGroundSweep=null;${section("  if (currentMap === 'coast') globalThis.window?.RoadsterCoast?.stepTraffic",'  // Render the resolved pose')}}`,h.context);
  const result=h.step(dt);h.context.trafficStep(dt,result.isAirborne);
  for(const k of ['x','y','z','vx','vy','vz','yaw','pitch','roll'])assert.ok(Math.abs(h.state[k]-j.pose[k])<1e-11,`${k}: ${h.state[k]} vs ${j.pose[k]}`);
  const report=h.context.window.RoadsterCityDiagnostics.snapshot();assert.equal(report.contact.variant,j.contact.variant);assert.ok(Math.abs(report.deltaV-j.deltaV)<1e-11);assert.equal(h.state.isDestroyed,true);
  assert.ok(Math.abs(report.contact.normal.depth-j.contact.normal.depth)<1e-11);
  t.diagnostic(JSON.stringify({scope:'CPU constrained reproduction, not proof NPC appeared on user GPU; NPC speed/yaw and hidden rack/lateralG inferred',variant:j.contact.variant,deltaV:report.deltaV,poseFieldsMatched:9}));
 });
}
