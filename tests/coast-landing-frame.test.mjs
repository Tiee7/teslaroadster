// CPU-only production motion: no WebGL, native asset creation, or screenshot claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {motionHarness} from './helpers/motion-harness.mjs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const current=read('src/physics-main.js');
const old=read('tests/fixtures/drive-stability-baseline/physics-main.js');
assert.equal(createHash('sha256').update(old).digest('hex'),'5b9714605d3360890996ffe12afadcdf78949f5e059baa47fcd220a954611ee7','exact723ad63 pre-frame-state fixture');
const c=vm.createContext({window:{}});
vm.runInContext(read('src/coast-road-network.js')+'\n'+read('src/coast-map.js'),c);
const world=c.window.RoadsterCoast;
function section(s,from,to){assert.equal(s.split(from).length,2);const a=s.indexOf(from),b=s.indexOf(to,a+from.length);assert.ok(b>a);return s.slice(a,b);}
const suspension=section(current,'  // 2nd-order critically damped suspension recovery:','  // Dynamic Tire Drift Smoke Puffs');
const pose=section(current,'  // Render the resolved pose after traffic contact (which can change state.y).','  RoadsterDrivingScore.segment');
assert.equal(suspension,section(old,'  // 2nd-order critically damped suspension recovery:','  // Dynamic Tire Drift Smoke Puffs'));
assert.equal(pose,section(old,'  // Render the resolved pose after traffic contact (which can change state.y).','  RoadsterDrivingScore.segment'));
function make(p,text){
 const h=motionHarness(p,'coast',{'physics-main.js':text});h.context.window.RoadsterCoast=world;
 const point=(x,y,z)=>({x,y,z,set(x,y,z){Object.assign(this,{x,y,z});}});
 h.context.playerWrapper={position:point(p.x,p.y,p.z)};
 h.context.roadsterAttitudeGroup={rotation:point(p.pitch,p.yaw,p.roll)};
 h.context.resetCar=()=>{throw Error('No reset/teleport is permitted during these natural solid-road flights');};
 // Scalar stubs execute the exact presentation pose/suspension sections, so the
 // next real cityPlayerBody sweep sees its preceding rendered contactPose.
 vm.runInContext(`function landingFramePresent(r,dt){
  const {isAirborne,isRearThrusterFiring}=r,driveInput=r.audioState.driveInput;
  const isAccelerating=driveInput.throttle>0||(driveInput.boost>0&&r.audioState.canUseRCS);
  const isFootBraking=driveInput.brake>0&&!isAccelerating,isReversing=driveInput.reverse>0&&!isAccelerating;
  const playerWorldZ=state.z;${suspension}${pose}
 }`,h.context);
 return h;
}
const cases=[
 {name:'flat roll',route:1,distance:400,lift:.8,key:'KeyJ',attitude:1.6},
 {name:'flat pitch',route:1,distance:400,lift:.8,key:'KeyI',attitude:1.8},
 {name:'uphill roll',route:0,distance:1900,lift:.8,key:'KeyJ',attitude:1.6},
 {name:'bridge roll',route:0,distance:3800,lift:.8,key:'KeyJ',attitude:1.6},
 {name:'bridge upright',route:0,distance:4400,lift:.8},
 {name:'flat W held through landing',route:0,distance:400,lift:.8,heldW:true,seconds:6},
 {name:'moving slope upright',route:0,distance:1900,speed:25,lift:.4,seconds:5}
];
const physical=['x','y','z','vx','vy','vz','speed','yaw','pitch','roll','vYaw','vPitch','vRoll','airRemaining','airUsedContinuous'];
for(const fps of [30,60,144])for(const spec of cases)test(`${spec.name}: same-frame coast landing/support and unchanged motion/tank at${fps}Hz`,()=>{
 const p=world.pose(spec.route,spec.distance,0),speed=spec.speed||0;
 const initial={...p,speed,vx:-Math.sin(p.yaw)*speed,vz:-Math.cos(p.yaw)*speed,vy:p.dy*speed,
  airRemaining:10,wasAirborne:false,coastSupportId:p.supportId};
 const before=make(initial,old),after=make(initial,current);
 let flew=false,land=null,oldLag=0,newLag=0,postW=0,postH=0,maxSteer=0,drivePeak=0,brakeEnd=Infinity;
 for(let frame=0;frame<fps*(spec.seconds||8);frame++){
  const time=frame/fps,since=land===null?-1:(frame-land)/fps;
  for(const h of [before,after]){
   for(const key of Object.keys(h.keys))h.keys[key]=false;
   h.keys.Space=time<spec.lift;if(spec.key)h.keys[spec.key]=time<spec.attitude;
   h.keys.KeyW=spec.heldW||(since>.1&&since<1.1);
   if(!spec.heldW){h.keys.KeyA=since>.25&&since<.4;h.keys.KeyH=since>1.1&&since<1.8;}
  }
  const a=before.step(1/fps),b=after.step(1/fps);
  before.context.landingFramePresent(a,1/fps);after.context.landingFramePresent(b,1/fps);
  for(const key of physical)assert.equal(after.state[key],before.state[key],`${key} must remain bit-exact at frame${frame}`);
  for(const key of ['coastSupportId','coastDetached','wasAirborne','isAutoLandingSave','isJumping6m','isFreefalling','isAutoDescending8s'])assert.equal(after.state[key],before.state[key],key);
  assert.ok(after.state.airRemaining>=0&&after.state.airRemaining<=10);
  assert.equal(after.impacts.length,0,'natural safe landing/continued controls must not become an impact');
  assert.equal(before.impacts.length,0);
  if(a.isAirborne!==before.state.wasAirborne)oldLag++;
  if(b.isAirborne!==after.state.wasAirborne)newLag++;
  if(after.state.wasAirborne)flew=true;
  if(flew&&!after.state.wasAirborne&&after.state.coastSupportId&&land===null){
   land=frame;
   assert.equal(a.isAirborne,true,'retain the exact old723 landing-frame AIR counterexample');
   assert.equal(b.isAirborne,false,'accepted support must also own this frame local mode');
   assert.equal(before.state.wasAirborne,false,'old persistent state already knew it had landed');
  }
  if(land!==null){
   assert.equal(b.isAirborne,false);assert.equal(after.state.wasAirborne,false);
   assert.ok(after.state.coastSupportId);assert.equal(after.state.isAutoLandingSave,false,'do not re-arm landing save while attached');
   const support=world.support({...after.state,grounded:true});
   assert.ok(support.solid);assert.ok(Math.abs(after.state.y-support.height)<1e-8,'finite physical support owns the root');
   if(frame>land&&after.keys.KeyW){postW++;assert.equal(b.isRearThrusterFiring,false,'ground W is electric, not a flight jet');assert.equal(b.airConsumedThisFrame,0);drivePeak=Math.max(drivePeak,Math.abs(after.state.speed));}
   if(frame>land&&after.keys.KeyH){postH++;brakeEnd=Math.abs(after.state.speed);}
   maxSteer=Math.max(maxSteer,Math.abs(after.state.steerInput));
  }
 }
 assert.ok(flew&&land!==null,'real Space lift and later landing must both happen');
 assert.equal(oldLag,1,'old mismatch is exactly one fixed step, not persistent loss of control');
 assert.equal(newLag,0);assert.ok(postW>fps*.5,'continue driving after landing, do not stop at the first green frame');
 if(!spec.heldW){assert.ok(maxSteer>.25,'real A ground steering resumes');assert.ok(postH>fps*.3);assert.ok(drivePeak>brakeEnd+1,'real H braking resumes after electric acceleration');}
});
