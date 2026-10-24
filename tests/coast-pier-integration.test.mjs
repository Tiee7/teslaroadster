import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import{readFileSync}from'node:fs';import{motionHarness}from'./helpers/motion-harness.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8'),oldPhysics=read('tests/fixtures/coast-pier-baseline/physics-main.js'),physics=read('src/physics-main.js');
function coast(text=read('src/coast-road-network.js')){const c=vm.createContext({window:{}});vm.runInContext(text+'\n'+read('src/coast-map.js'),c);return c.window.RoadsterCoast;}
const before=coast(read('tests/fixtures/coast-pier-baseline/coast-road-network.js')),after=coast();
function harness(world,source,initial,weather){const h=motionHarness(initial,'coast',{'physics-main.js':source});h.context.window.RoadsterCoast=world;vm.runInContext('weatherIndex='+weather,h.context);h.context.resetCar=()=>{throw Error('No boundary reset is part of these legal paths');};return h;}
for(const fps of[30,144])for(const weather of[0,1])for(const airborne of[false,true])test(`clear coast trajectory retains every state field/tank/input at ${fps} Hz, weather ${weather}, airborne ${airborne}`,()=>{
 const x=airborne?0:1100,z=airborne?0:-1000,y=airborne?100:before.network.terrainSupport(x,z).height,yaw=0,vx=0,vz=airborne?-20:-40,attitude=airborne?{pitch:.1,roll:.05}:before.network.groundAttitude(before.network.terrainSupport(x,z).normal,yaw);
 const initial={x,y,z,yaw,...attitude,speed:airborne?20:40,vx,vz,vy:0,wasAirborne:airborne,coastSupportId:airborne?null:'terrain',airRemaining:8};const a=harness(before,oldPhysics,initial,weather),b=harness(after,physics,initial,weather);
 for(let frame=0;frame<fps*2;frame++){
  for(const h of[a,b]){h.keys.KeyW=frame<fps;h.keys.KeyA=frame<fps*.25;h.keys.Space=airborne&&frame<fps*.8;h.keys.KeyH=frame>=fps*1.3;}
  const ar=a.step(1/fps),br=b.step(1/fps);assert.deepEqual(Object.keys(a.state).sort(),Object.keys(b.state).sort());
  for(const[k,v]of Object.entries(a.state)){if(typeof v==='number')assert.ok(Object.is(v,b.state[k]),`${k}, frame ${frame}`);else assert.deepEqual(structuredClone(b.state[k]),structuredClone(v),`${k}, frame ${frame}`);}
  assert.equal(ar.isAirborne,br.isAirborne);assert.equal(ar.airConsumedThisFrame,br.airConsumedThisFrame);assert.equal(a.impacts.length,0);assert.equal(b.impacts.length,0);
 }
});
test('combined real rail/pier/ceiling sweeps choose the earliest event and retain non-pier geometry',()=>{
 const legacy=coast(read('tests/fixtures/coast-pier-baseline/coast-road-network.js')).network;
 legacy.structures.splice(0,legacy.structures.length,...legacy.structures.filter(s=>s.kind!=='pier'));
 const n=after.network;let both=0,otherFirst=0,pierFirst=0;
 for(const p of n.structures.filter(s=>s.kind==='pier'))for(const [dx,dz]of[[1,0],[0,1],[Math.SQRT1_2,Math.SQRT1_2],[-Math.SQRT1_2,Math.SQRT1_2]]){
  const cx=(p.minX+p.maxX)/2,cz=(p.minZ+p.maxZ)/2,a={x:cx-dx*35,z:cz-dz*35,y:p.maxY-.1,yaw:.37},b={...a,x:cx+dx*35,z:cz+dz*35};
  const old=legacy.sweepStructures(a,b),pier=n.sweepPiers(a,b),all=n.sweepStructures(a,b),want=Math.min(old?.t??Infinity,pier?.t??Infinity);
  if(want===Infinity){assert.equal(all,null);continue;}assert.ok(all);assert.ok(Math.abs(all.t-want)<1e-8);
  if(old&&pier){both++;if(old.t<pier.t-1e-8){otherFirst++;assert.equal(all.kind,old.kind);}if(pier.t<old.t-1e-8){pierFirst++;assert.equal(all.kind,'pier');}}
 }
 assert.ok(both>=4,'real structure candidates coexist on the same swept chords');assert.ok(otherFirst>0&&pierFirst>0,'neither structure type has hard-coded priority');
});
function triggerPart(s){return s.slice(s.indexOf('function triggerPhysicsCollision('),s.indexOf('function destroyVehicle('));}
for(const fps of[30,60,144])test(`actual low-speed repeated pier approach preserves positive-only damage and local recovery at ${fps} Hz`,()=>{
 const n=after.network,p=n.structures.filter(s=>s.kind==='pier')[6],x=p.minX-6,z=(p.minZ+p.maxZ)/2,floor=n.terrainSupport(x,z),yaw=-Math.PI/2;
 const h=harness(after,physics,{x,y:floor.height,z,yaw,...n.groundAttitude(floor.normal,yaw),speed:3,vx:3,vy:0,vz:0,wasAirborne:false,coastSupportId:'terrain',airRemaining:10},0);h.context.sound.playCrash=()=>{};h.context.destroyVehicle=()=>{h.state.isDestroyed=true;};
 vm.runInContext('Math.random=()=>.5;\n'+triggerPart(physics),h.context);const original=h.context.triggerPhysicsCollision;
 h.context.triggerPhysicsCollision=(...args)=>{h.impacts.push(args);original(...args);};h.keys.KeyW=true;let damagedFrames=0,previousHull=100;
 for(let frame=0;frame<fps*2&&!h.state.isDestroyed;frame++){
  h.state.impactCooldown=Math.max(0,h.state.impactCooldown-1/fps);h.step(1/fps);
  if(h.state.hullIntegrity<previousHull)damagedFrames++;previousHull=h.state.hullIntegrity;
  assert.ok(h.state.y>=-.001,'no contact correction pushes the grounded player below terrain');assert.ok(Number.isFinite(h.state.x)&&Number.isFinite(h.state.speed));
 }
 assert.ok(h.impacts.length>=2,'continuous throttle legitimately approaches the real column again');assert.ok(h.impacts.every(a=>a[0]>0),'no zero-energy overlap damage requests');assert.ok(damagedFrames>=1);assert.ok(h.state.hullIntegrity<100&&h.state.hullIntegrity>0);assert.equal(h.state.isDestroyed,false);assert.equal(h.state.airRemaining,10);
});
