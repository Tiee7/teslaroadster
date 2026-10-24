import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {motionHarness} from './helpers/motion-harness.mjs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const old=read('tests/fixtures/coast-hull-contact-baseline/physics-main.js');
const current=read('src/physics-main.js');
const context=vm.createContext({window:{}});
vm.runInContext(read('src/coast-road-network.js')+'\n'+read('src/coast-map.js'),context);
const world=context.window.RoadsterCoast,network=world.network;
const section=(s,a,b)=>{assert.equal(s.split(a).length,2);return s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)+a.length));};
const suspension=section(current,'  // 2nd-order critically damped suspension recovery:','  // Dynamic Tire Drift Smoke Puffs');
assert.equal(suspension,section(old,'  // 2nd-order critically damped suspension recovery:','  // Dynamic Tire Drift Smoke Puffs'));
function make(p,source=current,map='coast'){
 const h=motionHarness(p,map,{'physics-main.js':source});h.context.window.RoadsterCoast=world;
 h.context.resetCar=()=>{throw Error('No reset/teleport is permitted in a real solid-road landing');};
 vm.runInContext(`function presentSuspension(isAirborne,dt){${suspension}}\nfunction testHull(){const q={...state,y:state.y-(state.suspensionSquash||0)-(state.aeroSquash||0)},b=cityPlayerBody(q);return {minimumY:b.y-b.ry,eyeY:q.y+b.axes[1][1]*1.04-b.axes[2][1]*.15};}`,h.context);
 return h;
}
function initial(route=1,distance=400){const p=world.pose(route,distance,0);return {...p,speed:0,vx:0,vy:0,vz:0,airRemaining:10,wasAirborne:false,coastSupportId:p.supportId};}
function present(h,step,dt){h.context.presentSuspension(step.isAirborne,dt);return h.context.testHull();}
function keyboardFlight(source,fps=60){
 const start=initial(),h=make(start,source);let minEye=Infinity,minBody=Infinity,maxY=start.y,tookOff=false,landed=false;
 for(let frame=0;frame<fps*8;frame++){
  const t=frame/fps;h.keys.Space=t<.8;h.keys.KeyJ=t<1.6;
  const step=h.step(1/fps),hull=present(h,step,1/fps);
  minEye=Math.min(minEye,hull.eyeY-start.y);minBody=Math.min(minBody,hull.minimumY-start.y);maxY=Math.max(maxY,h.state.y);
  tookOff||=h.state.wasAirborne;
  if(tookOff&&!h.state.wasAirborne&&t>1.6){landed=true;break;}
 }
 return {h,minEye,minBody,maxY,tookOff,landed};
}

test('frozen2c natural Space+J landing puts the cockpit and rotated hull below the real flat road before root touchdown',()=>{
 const p=initial(),tri=network.candidates(p.x,p.z).find(s=>s.road)?.triangle;
 assert.ok(tri);assert.equal(tri.a.y,0);assert.equal(tri.b.y,0);assert.equal(tri.c.y,0);
 const r=keyboardFlight(old);assert.ok(r.tookOff&&r.landed);assert.ok(r.minEye<-.5);assert.ok(r.minBody<-.8);assert.equal(r.h.impacts.length,0);
});
for(const fps of [30,60,144])test(`natural coast Space+J still flies but cannot bury its cockpit/hull at ${fps}Hz`,()=>{
 const before=keyboardFlight(old,fps),after=keyboardFlight(current,fps);
 assert.ok(after.tookOff&&after.landed);assert.ok(after.maxY>5);assert.equal(after.maxY,before.maxY,'takeoff/lift trajectory is not suppressed');
 assert.ok(after.minEye>.2);assert.ok(after.minBody>=-.05,'only the existing bounded suspension compression remains');
 assert.equal(after.h.impacts.length,0);assert.ok(after.h.state.airRemaining>0&&after.h.state.airRemaining<=10);
});

for(const fps of [30,60,144])for(const [surface,route,distance]of [['flat',1,400],['slope',0,1900],['bridge',0,3800]]){
 for(const [pose,pitch,roll]of [['upright',0,0],['inverted roll',0,Math.PI],['inverted pitch',Math.PI,0],['sideways',0,Math.PI/2]]){
  test(`${surface} ${pose} coast landing contacts the rotated body at ${fps}Hz`,()=>{
   const start=initial(route,distance),h=make({...start,y:start.y+3,pitch,roll,wasAirborne:true,coastSupportId:null});let landed=false;
   for(let frame=0;frame<fps*5;frame++){
    const step=h.step(1/fps);present(h,step,1/fps);
    if(!h.state.wasAirborne){landed=true;break;}
   }
   assert.ok(landed);const support=world.support({...h.state,grounded:true});assert.ok(Math.abs(h.state.y-support.height)<1e-8);
   const plane=network.groundAttitude(support.normal,h.state.yaw);assert.ok(Math.abs(h.state.pitch-plane.pitch)<1e-8);assert.ok(Math.abs(h.state.roll-plane.roll)<1e-8);
   assert.equal(h.impacts.length,0);assert.equal(h.state.isDestroyed,false);assert.ok(Number.isFinite(h.state.vy));
  });
 }
}

for(const fps of [30,60,144])test(`rotated landing below an actual bridge never attaches to its distant deck at ${fps}Hz`,()=>{
 const start=initial(1,1039),deck=network.candidates(start.x,start.z).find(s=>s.bridge);assert.ok(deck&&deck.height>start.y+6);
 const h=make({...start,y:start.y+3,roll:Math.PI,wasAirborne:true,coastSupportId:null});let landed=false;
 for(let i=0;i<fps*5;i++){
  const step=h.step(1/fps);present(h,step,1/fps);assert.notEqual(h.state.coastSupportId,deck.id);assert.ok(h.state.y<deck.height-2);
  if(!h.state.wasAirborne){landed=true;break;}
 }
 assert.ok(landed);assert.ok(Math.abs(h.state.y-start.y)<1e-8);assert.equal(h.impacts.length,0);
});

for(const fuel of [0,.001])test(`coast hull contact retains real hard-landing damage when fuel=${fuel}`,()=>{
 const start=initial(),h=make({...start,y:start.y+5,vy:-25,roll:Math.PI,airRemaining:fuel,isFreefalling:true,wasAirborne:true,coastSupportId:null});
 for(let i=0;i<60&&!h.impacts.length;i++)h.step(1/120);
 assert.ok(h.impacts.length>0);assert.equal(h.impacts[0][1],'crashReasonGround');assert.ok(h.impacts[0][0]>25*1.85);
 assert.ok(h.state.y>=start.y);assert.equal(h.state.wasAirborne,false);assert.equal(h.state.isJumping6m,false);
});

for(const map of ['highway','city'])for(const fps of [30,60,144])test(`${map} full motion state stays bit-exact against frozen2c at ${fps}Hz`,()=>{
 const before=make({speed:28,vz:-28},old,map),after=make({speed:28,vz:-28},current,map);
 for(let i=0;i<fps*8;i++){
  for(const h of [before,after]){h.keys.KeyW=i<fps*2;h.keys.Space=i>=fps&&i<fps*2;h.keys.KeyJ=i>=fps*1.4&&i<fps*3;h.keys.KeyI=i>=fps*3&&i<fps*4;h.keys.KeyA=i>=fps*4&&i<fps*5;h.keys.ShiftLeft=i>=fps*5&&i<fps*5.4;}
  const a=before.step(1/fps),b=after.step(1/fps);assert.deepEqual(structuredClone(after.state),structuredClone(before.state));assert.deepEqual(structuredClone(b),structuredClone(a));assert.deepEqual(after.impacts,before.impacts);
 }
});
