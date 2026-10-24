// Read-only CPU production motion/damage regression; not GPU or screenshot proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {motionHarness} from './helpers/motion-harness.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const current=read('src/physics-main.js'),old=read('tests/fixtures/coast-boundary-baseline/physics-main.js');
assert.equal(createHash('sha256').update(old).digest('hex'),'2c001737855bf9406ae29dce2c286a23d679cfe6b5a7fea9cd2e5103825432ad','exact bb73 pre-boundary-fix fixture');
const c=vm.createContext({window:{}});vm.runInContext(read('src/coast-road-network.js')+'\n'+read('src/coast-map.js'),c);
const world=c.window.RoadsterCoast,network=world.network,LIMIT=1197.8;
const faces=[{name:'east land',axis:'x',sign:1},{name:'north land',axis:'z',sign:1},{name:'south land',axis:'z',sign:-1},{name:'west water-air',axis:'x',sign:-1,air:true}];
function part(s,a,b){assert.equal(s.split(a).length,2);const start=s.indexOf(a),end=s.indexOf(b,start+a.length);assert.ok(end>start);return s.slice(start,end);}
const trigger=part(current,'function triggerPhysicsCollision(','function destroyVehicle(');
assert.equal(trigger,part(old,'function triggerPhysicsCollision(','function destroyVehicle('),'original damage law/thresholds remain unchanged');
function make(initial,text=current){
 const anchor='    const limit = CITY_HALF_BOUND - 2.2;';assert.equal(text.split(anchor).length,2);
 const tapped=text.replace(anchor,anchor+'\n    globalThis.boundaryIncoming={x:state.x,y:state.y,z:state.z,vx:state.vx,vy:state.vy,vz:state.vz,speed:state.speed,isAirborne,limit};');
 const h=motionHarness(initial,'coast',{'physics-main.js':tapped});h.context.window.RoadsterCoast=world;
 h.context.resetCar=()=>{throw Error('Boundary response must not teleport/reset this supported or high-airborne vehicle');};
 h.context.sound.playCrash=()=>{};
 h.context.destroyVehicle=reason=>{h.state.isDestroyed=true;h.state.destroyReasonKey=reason;};
 // Run actual damage code, not merely a hook assertion. Only destruction VFX
 // are stubbed. Neutral random attitude impulses keep CPU cases deterministic.
 vm.runInContext('Math.random=()=>.5;\n'+trigger,h.context);
 const realTrigger=h.context.triggerPhysicsCollision,requests=[];
 h.context.triggerPhysicsCollision=(...args)=>{const incoming=structuredClone(h.context.boundaryIncoming);
  const response={vx:h.state.vx,vz:h.state.vz};realTrigger(...args);
  requests.push({args,incoming,response,peakG:h.state.lastImpactG,destroyed:h.state.isDestroyed});};
 return {...h,requests,tick(dt){const result=h.step(dt);return {result,incoming:structuredClone(h.context.boundaryIncoming)};}};
}
function at(face,{distance=.01,inset=0,speed=40,normal=null,air=face.air}={}){
 const coordinate=face.sign*(LIMIT-distance-inset),x=face.axis==='x'?coordinate:100,z=face.axis==='z'?coordinate:100;
 const floor=network.terrainSupport(x,z);
 let vx,vz;
 if(normal===null){const yaw=face.axis==='x'?-face.sign*.05:face.sign>0?Math.PI/2+.05:-Math.PI/2+.05;vx=-Math.sin(yaw)*speed;vz=-Math.cos(yaw)*speed;}
 else{const tangent=Math.sqrt(Math.max(0,speed*speed-normal*normal));vx=face.axis==='x'?normal*face.sign:tangent;vz=face.axis==='z'?normal*face.sign:-tangent;}
 const yaw=Math.atan2(-vx,-vz),attitude=air?{pitch:0,roll:0}:network.groundAttitude(floor.normal,yaw);
 return {x,z,y:air?30:floor.height,yaw,...attitude,speed,vx,vz,
  vy:air?0:-(floor.normal.x*vx+floor.normal.z*vz)/floor.normal.y,
  airRemaining:10,wasAirborne:Boolean(air),coastSupportId:air?null:'terrain',impactCooldown:0};
}
function expectedResponse(q){
 const sx=Math.abs(q.x)>LIMIT?Math.sign(q.x):0,sz=Math.abs(q.z)>LIMIT?Math.sign(q.z):0;
 const cx=sx?Math.max(0,q.vx*sx):0,cz=sz?Math.max(0,q.vz*sz):0;
 return {vx:cx>0?q.vx-1.35*cx*sx:q.vx,vz:cz>0?q.vz-1.35*cz*sz:q.vz,normal:Math.hypot(cx,cz),sx,sz};
}
function compareResponse(h,q){
 const expected=expectedResponse(q);
 assert.equal(h.state.vx,expected.vx,'only crossed outward X normal may change');
 assert.equal(h.state.vz,expected.vz,'only crossed outward Z normal may change');
 assert.ok(Math.abs(h.state.x)<=LIMIT&&Math.abs(h.state.z)<=LIMIT,'retain the existing finite world limit');
 if(expected.normal>10){assert.equal(h.requests.length,1);assert.equal(h.requests[0].args[0],expected.normal);assert.equal(h.requests[0].args[1],'crashReasonThreshold');assert.deepEqual(h.requests[0].args.slice(2),[0,2,0],'no unrelated horizontal collision kick');}
 else assert.equal(h.requests.length,0,'tangential travel and low normal closing cannot request damage');
 return expected;
}

for(const fps of[30,60,144])for(const face of faces.filter(f=>!f.air))test(`old bb73 ${face.name} shallow graze falsely destroys, inward control does not, at${fps}Hz`,()=>{
 const hit=make(at(face,{distance:1.8}),old),control=make(at(face,{distance:1.8,inset:6}),old);let seen=false;
 for(let frame=0;frame<fps*2;frame++){
  hit.tick(1/fps);control.tick(1/fps);
  assert.equal(control.requests.length,0);assert.equal(control.state.isDestroyed,false);
  if(hit.requests.length){const event=hit.requests[0],q=event.incoming,normal=Math.abs(q[face.axis==='x'?'vx':'vz']);
   assert.ok(normal<2.1);assert.ok(event.args[0]>30);assert.ok(event.peakG>=18);assert.equal(event.destroyed,true,'actual unmodified damage law reaches fatal branch');
   const tangent=face.axis==='x'?'vz':'vx';assert.equal(event.response[tangent],q[tangent]*-.35,'retain the old unjustified tangent reversal witness');seen=true;break;}
 }
 assert.ok(seen,'do not lose the deployed pre-fix fatal counterexample');
});

for(const fps of[30,60,144])for(const face of faces)test(`${face.name} shallow normal-only response preserves tangent and stays alive at${fps}Hz`,()=>{
 const h=make(at(face)),{incoming:q}=h.tick(1/fps),expected=compareResponse(h,q);
 assert.ok(expected.normal>0&&expected.normal<2.1);assert.equal(h.state.isDestroyed,false);assert.equal(h.state.hullIntegrity,100);
 const tangent=face.axis==='x'?'vz':'vx';assert.equal(h.state[tangent],q[tangent]);
 // Continue ordinary fixed steps: the previous contact must not become repeated
 // fictitious high-energy hits, free altitude changes, or a world-edge reset.
 for(let i=0;i<fps;i++){h.tick(1/fps);assert.equal(h.requests.length,0);assert.equal(h.state.isDestroyed,false);assert.ok(Math.abs(h.state.x)<=LIMIT&&Math.abs(h.state.z)<=LIMIT);}
});

for(const fps of[30,60,144])for(const face of faces)test(`${face.name} genuine high-normal head-on/oblique hits retain fatal damage at${fps}Hz`,()=>{
 for(const normal of[40,32]){
  const h=make(at(face,{normal})),{incoming:q}=h.tick(1/fps),expected=compareResponse(h,q);
  assert.ok(expected.normal>=28);assert.equal(h.requests[0].destroyed,true);assert.ok(h.requests[0].peakG>=18);
 }
});

for(const fps of[30,60,144])for(const speed of[10.2,40])test(`coast corner combines crossed normal axes once at${fps}Hz and${speed}m/s`,()=>{
 const x=LIMIT-.01,z=LIMIT-.01,floor=network.terrainSupport(x,z),yaw=-3*Math.PI/4,attitude=network.groundAttitude(floor.normal,yaw);
 const vx=speed/Math.SQRT2,vz=speed/Math.SQRT2;
 const h=make({x,z,y:floor.height,yaw,...attitude,speed,vx,vz,vy:-(floor.normal.x*vx+floor.normal.z*vz)/floor.normal.y,wasAirborne:false,coastSupportId:'terrain',airRemaining:10}),{incoming:q}=h.tick(1/fps);
 const expected=compareResponse(h,q);assert.ok(expected.sx&&expected.sz);assert.ok(expected.normal>10);
 assert.equal(h.requests.length,1,'one combined normal event, never one full-speed event per axis');
 if(speed<28){assert.ok(Math.abs(q.vx)<10&&Math.abs(q.vz)<10,'the vector combination, not per-axis max, crosses the original10m/s threshold');assert.equal(h.state.isDestroyed,false);assert.ok(h.state.hullIntegrity<100);}
 else assert.equal(h.state.isDestroyed,true);
});

for(const fps of[30,60,144])for(const face of faces)test(`${face.name} pre-existing overlap already moving inward is clamped without reversal/damage at${fps}Hz`,()=>{
 // This intentionally seeds a transient constraint overlap, not a claimed
 // natural spawn. It must recover rather than punish existing inward motion.
 const h=make(at(face,{distance:-.2,normal:-2})),{incoming:q}=h.tick(1/fps);
 assert.ok(Math.abs(q[face.axis])>LIMIT);const expected=compareResponse(h,q);assert.equal(expected.normal,0);
 assert.equal(h.state.vx,q.vx);assert.equal(h.state.vz,q.vz);assert.equal(h.state.isDestroyed,false);
 for(let i=0;i<Math.ceil(fps*.5);i++){h.tick(1/fps);assert.equal(h.requests.length,0);assert.equal(h.state.isDestroyed,false);}
});

for(const fps of[30,60,144])test(`mixed-axis coast corner overlap preserves inward X while reflecting outward Z at${fps}Hz`,()=>{
 const x=LIMIT+.2,z=LIMIT+.2,vx=-2,vz=2,yaw=Math.atan2(-vx,-vz),floor=network.terrainSupport(x,z),attitude=network.groundAttitude(floor.normal,yaw);
 const h=make({x,z,y:floor.height,yaw,...attitude,vx,vz,speed:Math.hypot(vx,vz),vy:0,wasAirborne:false,coastSupportId:'terrain',airRemaining:10});
 const {incoming:q}=h.tick(1/fps);assert.ok(q.x>LIMIT&&q.z>LIMIT&&q.vx<0&&q.vz>0);compareResponse(h,q);assert.equal(h.state.vx,q.vx);
});

for(const fps of[30,60,144])test(`surviving east-land graze permits real W/A/H control recovery at${fps}Hz`,()=>{
 const h=make(at(faces[0]));h.tick(1/fps);let maxSteer=0,drivePeak=0,brakeEnd=Infinity;
 for(let i=0;i<fps*3;i++){
  const t=i/fps;h.keys.KeyW=t<1;h.keys.KeyA=t<.4;h.keys.KeyH=t>=1&&t<2;
  const {result}=h.tick(1/fps);assert.equal(h.state.isDestroyed,false);assert.equal(h.requests.length,0);assert.equal(result.isAirborne,false);
  maxSteer=Math.max(maxSteer,Math.abs(h.state.steerInput));
  if(h.keys.KeyW){drivePeak=Math.max(drivePeak,Math.abs(h.state.speed));assert.equal(result.isRearThrusterFiring,false,'ground W stays electric');}
  if(h.keys.KeyH)brakeEnd=Math.abs(h.state.speed);
 }
 assert.ok(maxSteer>.25);assert.ok(drivePeak>brakeEnd+5,'H still slows the surviving car');assert.ok(h.state.x<LIMIT-.1,'A can steer away from the border without a teleport');
});
