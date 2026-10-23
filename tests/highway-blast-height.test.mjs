// Regression of a real explosion/reset/continuous-input path, CPU/native only.
import test from 'node:test';import assert from 'node:assert/strict';
import{highwayRun,nativeAssets,nativeAvailable,physics,oldPhysics}from'./helpers/highway-blast-harness.mjs';
import vm from'node:vm';import{readFileSync}from'node:fs';
const epoch=JSON.parse(readFileSync(new URL('../verification/highway-blast-height-20261022/source-epoch.json',import.meta.url),'utf8'));
function nativeGap(contact,variant){
 const w=nativeAssets(),q=contact.car.mesh,p=contact.state,npc=w.npcs.get(variant),r=q.rotation;
 const matrix=new w.T.Matrix4().compose(new w.T.Vector3(q.position.x,q.position.y,q.position.z),new w.T.Quaternion().setFromEuler(new w.T.Euler(r.x,r.y,r.z,'XYZ')),new w.T.Vector3(1,1,1));
 const low=Math.min(...npc.near.map(v=>v.clone().applyMatrix4(matrix).y));
 // These continuous boost witnesses stay upright at ground0; the sphere tests
 // below independently cover all orientations, all archive variants and LODs.
 assert.equal(p.y,0);assert.equal(p.pitch,0);assert.equal(p.roll,0);
 const top=Math.max(...w.playerPoints.map(v=>v.y));return low-top;
}
for(const fps of[30,60,144])for(const delay of[0,.2])test(`actual fatal contact/blast, ${delay}s aftermath, reset, continuous W+; at${fps}Hz cannot hit a wreck over10m above it`,{skip:!nativeAvailable},()=>{
 const before=highwayRun({old:true,fps,delay}),after=highwayRun({fps,delay});
 assert.equal(before.h.impacts.length,1);assert.equal(before.h.state.isDestroyed,true);assert.equal(before.contacts.length,1);
 const first=before.contacts[0];assert.ok(nativeGap(first,before.variant)>10,'real archived mesh stays far above the real visible player, not only a root-height mock');
 assert.ok(before.h.impacts[0][0]>70);assert.ok(before.rows.at(-1).t>1.4&&before.rows.at(-1).t<1.9);
 assert.deepEqual(after.blasted,before.blasted);assert.deepEqual(after.start,before.start,'reset never erases or moves the blast');
 assert.equal(after.h.impacts.length,0);assert.equal(after.h.state.isDestroyed,false);assert.equal(after.car.blastTimer,0);
 assert.equal(after.car.mesh.visible,true);assert.equal(after.car.highwayRecycledBehind,true);assert.equal(after.car.highwayPassEligible,false);
 assert.ok(after.car.mesh.position.z>=95&&after.car.mesh.position.z<=415,'normal incident-only rear recovery still occurs after the real arc');
 assert.ok(after.h.state.airRemaining<10&&after.h.state.airRemaining>6,'ordinary paid boost, no fuel rescue');
 // Before the first false-contact frame, every physics/NPC/input output is exact.
 for(let i=0;i<first.frame;i++)assert.deepEqual(after.rows[i],before.rows[i],`unaffected whole-state frame${i}`);
});
for(const fps of[30,60,144]){
 test(`ordinary road contact and damage are bit-exact at${fps}Hz`,{skip:!nativeAvailable},()=>{const o={fps,blast:false,reset:false,distance:3,delay:0,seconds:.1};const a=highwayRun({...o,old:true}),b=highwayRun(o);assert.ok(a.h.impacts.length);assert.deepEqual(b.rows,a.rows);});
 test(`a genuine low blasted-car hit is not disabled at${fps}Hz`,{skip:!nativeAvailable},()=>{const o={fps,blast:false,reset:false,distance:3,delay:0,seconds:.1,carInitial:{blastTimer:2,blastVx:0,blastVz:0,blastVy:0,blastVRoll:0,blastVPitch:0,blastVYaw:0}};const a=highwayRun({...o,old:true}),b=highwayRun(o);assert.ok(a.h.impacts.length);assert.deepEqual(b.rows,a.rows);});
 test(`ordinary no-contact continuous driving retains every state at${fps}Hz`,{skip:!nativeAvailable},()=>{const o={fps,blast:false,reset:false,distance:100,delay:0,seconds:.5};const a=highwayRun({...o,old:true}),b=highwayRun(o);assert.equal(a.h.impacts.length,0);assert.deepEqual(b.rows,a.rows);});
}
test('all actual near/far archived meshes and player vertices fit the conservative orientation-independent root radii',{skip:!nativeAvailable},()=>{
 const w=nativeAssets(),h=highwayRun({seconds:0,blast:false,reset:false});
 const a=h.h.context.cityPlayerBody(h.h.state),radius=(body,p)=>Math.hypot(...body.half)+Math.hypot(body.x-p.x,body.y-p.y,body.z-p.z),rp=radius(a,h.h.state);
 for(const p of w.playerPoints)assert.ok(p.length()<=rp+1e-6);
 for(const [variant,npc]of w.npcs){
  const b=npc.bounds,r=Math.hypot((b.maxX-b.minX)/2,(b.maxY-b.minY)/2,(b.maxZ-b.minZ)/2)+Math.hypot((b.maxX+b.minX)/2,(b.maxY+b.minY)/2,(b.maxZ+b.minZ)/2);
  for(const points of[npc.far,npc.near])for(const p of points){assert.ok(p.x>=b.minX-1e-6&&p.x<=b.maxX+1e-6&&p.y>=b.minY-1e-6&&p.y<=b.maxY+1e-6&&p.z>=b.minZ-1e-6&&p.z<=b.maxZ+1e-6,variant);assert.ok(p.length()<=r+1e-6);}
  for(let i=0;i<21;i++){const q=new w.T.Quaternion().setFromEuler(new w.T.Euler(i*.27,-i*.61,i*.39,'XYZ'));for(const points of[npc.far,npc.near])for(const p of points)assert.ok(Math.abs(p.clone().applyQuaternion(q).y)<=r+1e-6);}
 }
 assert.ok(w.playerPoints.length>1000);assert.ok(w.npcs.size>=4);
});
test('strict envelope boundary rejects only certified gaps and uses the actual squashed highway visual root',()=>{
 const run=(difference,{blast=1,map='highway',overlap=true,demo=false,squash=0,aero=0}={})=>{const state={x:0,y:difference,z:0,suspensionSquash:squash,aeroSquash:aero},car={blastTimer:blast,mesh:{position:{x:0,y:0,z:0}}},body=p=>({x:p.x,y:p.y,z:p.z,half:[1,1,1]}),c=vm.createContext({state,car,currentMap:map,bodyOverlap:overlap,demoSweptHit:demo,cityPlayerBody:body,cityTrafficBody:()=>body(car.mesh.position)});return vm.runInContext(`(()=>{${epoch.collisionGuard}return 'keep';})()`,c);};
 const r=2*Math.sqrt(3)+1e-7;assert.equal(run(r),'keep');assert.equal(run(r+1e-6),undefined);assert.equal(run(r+1e-6,{squash:.01,aero:.02}),'keep');
 for(const options of[{blast:0},{map:'city'},{map:'coast'},{overlap:false}])assert.equal(run(100,options),'keep');assert.equal(run(100,{overlap:false,demo:true}),undefined);
});
