// CPU production motion/contact + native r128 visible geometry. No GPU claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {motionHarness} from './helpers/motion-harness.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const physics=read('src/physics-main.js'),map=read('src/coast-map.js');
const oldNetwork=read('tests/fixtures/coast-pier-baseline/coast-road-network.js');
const oldPhysics=read('tests/fixtures/coast-pier-baseline/physics-main.js');
assert.equal(createHash('sha256').update(oldPhysics).digest('hex'),'582245adaa9b5bb140ba22f22968865dceda94554fb11ec555756bb381926489');
assert.equal(createHash('sha256').update(oldNetwork).digest('hex'),'96f19c1fab8709937275aeac7afd5e658f84c30d9d9ca11db8c52075b2dfe9b7');
function section(text,start,end){assert.equal(text.split(start).length,2,start);const a=text.indexOf(start),b=text.indexOf(end,a+start.length);assert.ok(b>a,end);return text.slice(a,b);}
function world(text){const c=vm.createContext({window:{}});vm.runInContext(text+'\n'+map,c);return c.window.RoadsterCoast;}
const before=world(oldNetwork),current=world(read('src/coast-road-network.js'));
const pier=before.network.structures.filter(s=>s.kind==='pier')[0];
assert.equal(JSON.stringify(current.network.structures.filter(s=>s.kind==='pier')[0]),JSON.stringify(pier),'unchanged rendered pier location/size');
const damage=section(physics,'function triggerPhysicsCollision(','function destroyVehicle(');
assert.equal(damage,section(oldPhysics,'function triggerPhysicsCollision(','function destroyVehicle('),'unchanged damage law');
const runtime=process.env.ROADSTER_THREE_RUNTIME||'/tmp/roadster-three.min.js',nativeAvailable=existsSync(runtime);
let cachedNative;
function native(){
 if(cachedNative)return cachedNative;
 const c=vm.createContext({console,window:{innerWidth:1440,innerHeight:900,addEventListener(){},dispatchEvent(){}},Event:class{},localStorage:{getItem:()=>null,setItem(){}},document:{createElement:()=>({getContext:()=>({})})}});
 vm.runInContext(readFileSync(runtime,'utf8'),c);const T=c.THREE;assert.equal(T.REVISION,'128');
 vm.runInContext(`const scene=new THREE.Scene();let currentMap='coast';const WORLD_SPEED_SCALE=1.65;${section(read('src/world.js'),'const bodyMaterial =','const highwayEnvGroup')}`,c);
 for(const name of['highway-traffic','vehicles','reference-exterior','reference-cockpit'])vm.runInContext(read('src/'+name+'.js'),c,{filename:name});
 const vehicle=c.window.RoadsterVehicle;vehicle.setModel('reference');vehicle.setCockpit('reference');const model=vehicle.getPreviewModel();model.updateMatrixWorld(true);
 const xyz=[],visible=m=>m&&m.visible!==false&&m.colorWrite!==false&&!(m.transparent&&m.opacity===0);
 model.traverseVisible(mesh=>{
  if(!mesh.geometry||mesh.userData.shadowProxy)return;
  const g=mesh.geometry,p=g.attributes.position,ix=g.index,total=ix?.count??p.count,start=g.drawRange.start,end=Math.min(total,start+g.drawRange.count),ids=new Set();
  const add=(a,b)=>{for(let i=Math.max(start,a);i<Math.min(end,b);i++)ids.add(ix?ix.getX(i):i);};
  if(Array.isArray(mesh.material)){for(const group of g.groups)if(visible(mesh.material[group.materialIndex]))add(group.start,group.start+group.count);}
  else if(visible(mesh.material))add(0,total);
  for(const id of ids){const p0=new T.Vector3().fromBufferAttribute(p,id).applyMatrix4(mesh.matrixWorld);xyz.push(p0.x,p0.y,p0.z);}
 });
 assert.ok(xyz.length/3>1000,'real visible reference model, not an invented test box');const points=new Float64Array(xyz);
 // Instantiate the exact production pier batch function and creation expression,
 // without constructing the unrelated full coastal art scene. Inspect actual
 // BufferGeometry/instance matrices; a solid basic material suffices for geometry.
 c.network=before.network;
 const line=map.split('\n').find(s=>s.includes("batch('coast-viaduct-piers'"));assert.ok(line);
 vm.runInContext(`const group=new THREE.Group(),instances=new Set(),batches=[],box=new THREE.BoxGeometry(1,1,1),material=color=>new THREE.MeshBasicMaterial({color});${section(map,'    function batch(','    function unionRectangles(')}\n${line}\nglobalThis.pierMesh=batches[0];`,c);
 const mesh=c.pierMesh,matrix=new T.Matrix4();mesh.getMatrixAt(0,matrix);mesh.updateMatrixWorld(true);matrix.premultiply(mesh.matrixWorld);
 const vertices=[];for(let i=0;i<mesh.geometry.attributes.position.count;i++)vertices.push(new T.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i).applyMatrix4(matrix));
 const box=new T.Box3().setFromPoints(vertices);for(const a of['x','y','z']){assert.ok(Math.abs(box.min[a]-pier['min'+a.toUpperCase()])<1e-5);assert.ok(Math.abs(box.max[a]-pier['max'+a.toUpperCase()])<1e-5);}
 vm.runInContext(`globalThis.poseMatrix=function(state,isAirborne){const playerWorldZ=state.z,groundElevation=0,isAccelerating=true,isRearThrusterFiring=false,isFootBraking=false,isReversing=false;${section(physics,'  // Render the resolved pose after traffic contact (which can change state.y).','  RoadsterDrivingScore.segment')}\nplayerWrapper.updateMatrixWorld(true);return roadsterAttitudeGroup.matrixWorld.clone();};`,c);
 function measure(row){
  const e=c.poseMatrix(row.state,row.airborne).elements;let maxZ=-Infinity,inside=null;
  for(let i=0;i<points.length;i+=3){const x=points[i],y=points[i+1],z=points[i+2],wx=e[0]*x+e[4]*y+e[8]*z+e[12],wy=e[1]*x+e[5]*y+e[9]*z+e[13],wz=e[2]*x+e[6]*y+e[10]*z+e[14];
   maxZ=Math.max(maxZ,wz);if(!inside&&wx>=box.min.x&&wx<=box.max.x&&wy>=box.min.y&&wy<=box.max.y&&wz>=box.min.z&&wz<=box.max.z)inside={x:wx,y:wy,z:wz};
  }return {signedZClearance:box.min.z-maxZ,inside};
 }
 return cachedNative={T,vehicle,measure};
}
function motion(coast,{fps=60,gap=1.8,speed=40,reverse=false,centered=false,away=false}={}){
 const {T,vehicle}=native(),n=coast.network;
 const z=centered?(pier.minZ+pier.maxZ)/2:pier.minZ-gap;
 const x=away?(reverse?pier.minX-1.2:pier.maxX+1.2):(reverse?pier.maxX+9:pier.minX-9),yaw=reverse?Math.PI/2:-Math.PI/2;
 const ground=coast.support({x,z,y:n.terrainSupport(x,z).height,previousY:n.terrainSupport(x,z).height,grounded:true,previousSupportId:'terrain'}),vx=(reverse?-1:1)*speed;
 const initial={x,z,y:ground.height,yaw,...n.groundAttitude(ground.normal,yaw),speed,vx,vz:0,vy:-ground.normal.x*vx/ground.normal.y,wasAirborne:false,coastSupportId:ground.id,airRemaining:10};
 assert.equal(initial.coastSupportId,'terrain','once-only legal supported start, not seeded overlap or an invented flat road');
 const h=motionHarness(initial,'coast',{'physics-main.js':coast===before?oldPhysics:physics});h.context.window.RoadsterCoast=coast;h.context.window.RoadsterVehicle=vehicle;h.context.THREE.Box3=T.Box3;
 h.context.resetCar=()=>{throw Error('unexpected reset during the bounded pier path');};
 h.context.sound.playCrash=()=>{};h.context.destroyVehicle=reason=>{h.state.isDestroyed=true;h.state.destroyReasonKey=reason;};
 vm.runInContext('Math.random=()=>.5;\n'+damage,h.context);const real=h.context.triggerPhysicsCollision;
 h.context.triggerPhysicsCollision=(...args)=>{h.impacts.push(args);real(...args);};
 h.keys.KeyW=true;const history=[];
 for(let frame=0;frame<fps*2;frame++){
  const result=h.step(1/fps);history.push({frame,t:(frame+1)/fps,state:{...h.state},airborne:result?.isAirborne??h.state.wasAirborne,impacts:h.impacts.length});
  if(h.impacts.length)break;
 }
 return {h,initial,history,last:history.at(-1)};
}
for(const fps of[30,60,144])for(const reverse of[false,true])test(`native terrain W pier bypass: preserve old noncontact fatal witness and repaired clear path at${fps}Hz reverse=${reverse}`,{skip:!nativeAvailable},()=>{
 const old=motion(before,{fps,reverse}),next=motion(current,{fps,reverse});
 if(fps===30&&!reverse)assert.equal(old.h.impacts.length,0,'preserve the original bounded negative too; do not manufacture universal reproduction');
 else{
  assert.equal(old.h.impacts.length,1);assert.equal(old.h.state.isDestroyed,true,'execute the original production fatal damage law, with destruction VFX only stubbed');assert.ok(old.h.state.lastImpactG>=18);
  assert.ok(native().measure(old.last).signedZClearance>.59,'the ENTIRE actual drawn car remains separated from the actual pier instance');
 }
 assert.equal(next.h.impacts.length,0);assert.equal(next.h.state.isDestroyed,false);assert.equal(next.h.state.hullIntegrity,100);
 assert.ok(next.history.every(row=>Number.isFinite(row.state.y)&&Number.isFinite(row.state.x)));
});
for(const fps of[30,60,144])for(const reverse of[false,true])test(`native pier far-gap and moving-away controls stay clear old/current at${fps}Hz reverse=${reverse}`,{skip:!nativeAvailable},()=>{
 for(const option of[{gap:2.5},{away:true}]){
  const a=motion(before,{fps,reverse,...option}),b=motion(current,{fps,reverse,...option});
  for(const r of[a,b]){assert.equal(r.h.impacts.length,0);assert.equal(r.h.state.isDestroyed,false);assert.equal(r.h.state.hullIntegrity,100);}
  assert.deepEqual(structuredClone(b.history),structuredClone(a.history),'ALL no-contact state fields retain old production values, not merely position/fuel');
 }
});
for(const fps of[30,60,144])for(const reverse of[false,true])test(`native visible car enters the real pier before the OLD late contact; repaired real collision remains at${fps}Hz reverse=${reverse}`,{skip:!nativeAvailable},()=>{
 const old=motion(before,{fps,reverse,centered:true,speed:15}),next=motion(current,{fps,reverse,centered:true,speed:15});
 const early=old.history.find(row=>row.impacts===0&&native().measure(row).inside);
 assert.ok(early,'preserve real visible-vertex penetration before the pre-fix callback');assert.ok(old.last.frame>early.frame);
 assert.equal(next.h.impacts.length,1,'correcting false contacts must not remove the actual pier');assert.ok(next.h.impacts[0][0]>10);assert.equal(next.h.state.isDestroyed,false,'a true subcritical contact retains the original damage threshold');
 assert.ok(next.last.t<old.last.t,'recover the former long-axis late contact, not merely suppress damage');
});

// Independent static convex-polygon oracle: materialize both rectangles, then
// derive separating axes from their actual edges. Locate the FIRST contact by
// dense temporal search + bisection, not by duplicating production swept slabs.
const center={x:(pier.minX+pier.maxX)/2,z:(pier.minZ+pier.maxZ)/2};
const solid=[{x:pier.minX,z:pier.minZ},{x:pier.maxX,z:pier.minZ},{x:pier.maxX,z:pier.maxZ},{x:pier.minX,z:pier.maxZ}];
function carPolygon(p){return [[-1.1,-2.31],[1.1,-2.31],[1.1,2.31],[-1.1,2.31]].map(([x,z])=>({x:p.x+Math.cos(p.yaw)*x+Math.sin(p.yaw)*z,z:p.z-Math.sin(p.yaw)*x+Math.cos(p.yaw)*z}));}
function overlap(a,b){
 for(const polygon of[a,b])for(let i=0;i<polygon.length;i++){
  const p=polygon[i],q=polygon[(i+1)%polygon.length],nx=-(q.z-p.z),nz=q.x-p.x;
  const projection=list=>list.map(v=>v.x*nx+v.z*nz),ap=projection(a),bp=projection(b);
  if(Math.max(...ap)<Math.min(...bp)||Math.max(...bp)<Math.min(...ap))return false;
 }return true;
}
function oracle(from,to){
 const wrap=a=>((a+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;
 const at=t=>({...from,x:from.x+(to.x-from.x)*t,z:from.z+(to.z-from.z)*t,yaw:from.yaw+wrap(to.yaw-from.yaw)*t});
 assert.equal(overlap(carPolygon(from),solid),false,'clear geometric start');let lo=0,hi=null;
 for(let i=1;i<=4096;i++){const t=i/4096;if(overlap(carPolygon(at(t)),solid)){hi=t;lo=(i-1)/4096;break;}}
 if(hi===null)return null;
 for(let i=0;i<48;i++){const m=(lo+hi)/2;if(overlap(carPolygon(at(m)),solid))hi=m;else lo=m;}return hi;
}
const y=pier.minY+.5;
for(const yaw of[0,Math.PI/8,Math.PI/4,Math.PI/2,3*Math.PI/4,Math.PI,-Math.PI/2])for(const fps of[30,60,144])for(const direction of[-1,1])test(`constant-yaw actual pier sweep agrees with independent polygon FIRST-contact oracle yaw=${yaw} at${fps}Hz direction=${direction}`,()=>{
 const dx=-Math.sin(yaw)*direction,dz=-Math.cos(yaw)*direction,from={x:center.x-dx*9,z:center.z-dz*9,y,yaw},to={...from,x:center.x+dx*9,z:center.z+dz*9};
 const t=oracle(from,to);assert.ok(t!==null);let found=null;
 for(let frame=0;frame<fps*2;frame++){
  const a={...from,x:from.x+dx*10*frame/fps,z:from.z+dz*10*frame/fps},b={...a,x:from.x+dx*10*(frame+1)/fps,z:from.z+dz*10*(frame+1)/fps};
  const hit=current.network.sweepStructures(a,b,1.25);if(hit){found={distance:(frame+hit.t)*10/fps,hit};break;}
 }
 assert.ok(found);assert.equal(found.hit.kind,'pier');assert.ok(Math.abs(found.distance-t*18)<1e-7,'time comes from independent static polygon overlap, not the implementation formula');assert.ok(found.hit.normal.x*dx+found.hit.normal.z*dz<0);
 // A parallel lane beyond the exact solid projection + original1.1m half-width
 // is genuinely clear, regardless of yaw. Preserve the original dimensions.
 const rx=Math.cos(yaw),rz=-Math.sin(yaw),offset=.9*(Math.abs(rx)+Math.abs(rz))+1.1+.25;
 const a={...from,x:from.x+rx*offset,z:from.z+rz*offset},b={...to,x:to.x+rx*offset,z:to.z+rz*offset};
 assert.equal(oracle(a,b),null);assert.equal(current.network.sweepStructures(a,b,1.25),null);
});
test('diagonal pier corner is genuinely clear: replacing fixed extents with only a rotated AABB is insufficient',()=>{
 const from={x:center.x-5,z:center.z+3.1,y,yaw:Math.PI/4},to={...from,x:center.x-1};
 assert.equal(oracle(from,to),null,'body edge normal separates these polygons for the ENTIRE chord');
 assert.equal(before.network.sweepStructures(from,to,1.25)?.kind,'pier','preserve the old corner false contact');
 assert.equal(current.network.sweepStructures(from,to,1.25),null);
 const rotatedAabbHalf=.9+(1.1+2.31)/Math.SQRT2;
 assert.ok(Math.abs(to.x-center.x)<rotatedAabbHalf&&Math.abs(to.z-center.z)<rotatedAabbHalf,'a merely rotated world AABB would still report overlap');
});

const wrap=a=>((a+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;
const angularChords=[
 ['rotate toward east face',{x:center.x-3,z:center.z,y,yaw:0},{x:center.x-3,z:center.z,y,yaw:Math.PI/2}],
 ['rotate toward west face',{x:center.x+3,z:center.z,y,yaw:0},{x:center.x+3,z:center.z,y,yaw:Math.PI/2}],
 ['translate while widening',{x:center.x-7,z:center.z,y,yaw:0},{x:center.x-.5,z:center.z,y,yaw:Math.PI/2}],
 ['translate while narrowing',{x:center.x-7,z:center.z,y,yaw:Math.PI/2},{x:center.x-.5,z:center.z,y,yaw:0}],
 ['positive Pi short-arc clear',{x:center.x-2.65,z:center.z,y,yaw:Math.PI-.25},{x:center.x-2.65,z:center.z,y,yaw:-Math.PI+.25}],
 ['negative Pi short-arc clear',{x:center.x+2.65,z:center.z,y,yaw:-Math.PI+.25},{x:center.x+2.65,z:center.z,y,yaw:Math.PI-.25}],
 ['equivalent full-turn representation is not a revolution',{x:center.x-2.65,z:center.z,y,yaw:0},{x:center.x-2.65,z:center.z,y,yaw:2*Math.PI}]
];
for(const[name,from,to]of angularChords)test(`changing-yaw pier CCD agrees with independent polygon search: ${name}`,()=>{
 const expected=oracle(from,to),hit=current.network.sweepPiers(from,to,1.25);
 if(expected===null)assert.equal(hit,null,'do not replace the shortest yaw path with a spurious long revolution');
 else{assert.ok(hit);assert.equal(hit.kind,'pier');assert.ok(Math.abs(hit.t-expected)<1e-6,`first angular contact ${hit.t} vs ${expected}`);}
});
for(const side of[-1,1])test(`initial shallow pier overlap moving ${side<0?'away':'deeper'} is handled by closing motion, not recurring zero-speed damage`,()=>{
 const from={x:pier.minX-1.09,z:center.z,y,yaw:0},to={...from,x:from.x+side*.5};
 assert.equal(overlap(carPolygon(from),solid),true,'explicit transient overlap, not claimed legal spawn');
 const hit=current.network.sweepPiers(from,to,1.25);
 if(side<0)assert.equal(hit,null,'already separating overlap is not a new closing impact');
 else{assert.ok(hit);assert.equal(hit.t,0);assert.ok(hit.normal.x<0);}
});
for(const [dx,dz]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]])test(`all face/corner high-speed chords retain first actual pier contact direction=${dx},${dz}`,()=>{
 const size=Math.hypot(dx,dz),ux=dx/size,uz=dz/size;
 const from={x:center.x-ux*10,z:center.z-uz*10,y,yaw:.37},to={...from,x:center.x+ux*10,z:center.z+uz*10};
 const expected=oracle(from,to),hit=current.network.sweepPiers(from,to,1.25);assert.ok(expected!==null&&hit);assert.equal(hit.kind,'pier');assert.ok(Math.abs(hit.t-expected)<1e-6);
});
function yawLift(coast,fps,text){
 const {T,vehicle}=native(),target=coast.network.structures.filter(s=>s.kind==='pier')[6];assert.ok(target);
 const x=target.minX-1.35,z=(target.minZ+target.maxZ)/2,ground=coast.network.terrainSupport(x,z);
 assert.equal(ground.height,0);assert.equal(ground.normal.x,0);assert.equal(ground.normal.y,1);
 const h=motionHarness({x,z,y:0,yaw:0,pitch:0,roll:0,vx:0,vy:0,vz:0,speed:0,wasAirborne:false,coastSupportId:'terrain',airRemaining:10},'coast',{'physics-main.js':text});
 h.context.THREE.Box3=T.Box3;h.context.window.RoadsterVehicle=vehicle;h.context.window.RoadsterCoast=coast;h.context.resetCar=()=>{throw Error('unexpected reset');};
 const trace=[],n=coast.network;
 h.context.window.RoadsterCoast={...coast,network:{...n,sweepStructures(...args){const hit=n.sweepStructures(...args);trace.push({phase:'early',from:{...args[0]},to:{...args[1]},hit});return hit;},...(n.sweepPiers?{sweepPiers(...args){const hit=n.sweepPiers(...args);trace.push({phase:'late',from:{...args[0]},to:{...args[1]},hit});return hit;}}:{})}};
 h.keys.Space=true;h.keys.KeyA=true;
 return {h,target,trace,step(){const result=h.step(1/fps);return {state:{...h.state},airborne:result?.isAirborne,impacts:h.impacts.length};}};
}
for(const fps of[30,60,144])test(`actual supported Space+A reaches a late airborne yaw/pier contact at${fps}Hz; early-only counterfactual misses it`,{skip:!nativeAvailable},()=>{
 const old=yawLift(before,fps,oldPhysics),earlyOnly=yawLift(current,fps,oldPhysics),next=yawLift(current,fps,physics);let witness=null;
 for(let frame=0;frame<fps;frame++){
  const a=old.step(),b=earlyOnly.step(),c=next.step();
  if(next.trace.some(row=>row.phase==='late'&&row.hit?.kind==='pier')){witness={frame,a,b,c};break;}
 }
 assert.ok(witness,'legal stationary ground start, only Space+A throughout; no seeded angular velocity, forced flight, or per-frame pose assignments');
 assert.equal(witness.c.airborne,true);assert.ok(witness.c.state.airRemaining<10);assert.equal(old.h.impacts.length,0);assert.equal(earlyOnly.h.impacts.length,0);
 const late=next.trace.find(row=>row.phase==='late'&&row.hit?.kind==='pier');assert.ok(late,'actual production invokes the late observer after attitude integration');
 assert.ok(Math.abs(wrap(late.to.yaw-late.from.yaw))>0);assert.equal(late.from.x,late.to.x);assert.equal(late.from.y,late.to.y);assert.equal(late.from.z,late.to.z);
 assert.ok(Math.abs(witness.c.state.yaw)<Math.abs(witness.b.state.yaw),'constrain the real yaw at the earliest geometry contact, not only emit an impact hook');
 const target=next.target,targetPolygon=[{x:target.minX,z:target.minZ},{x:target.maxX,z:target.minZ},{x:target.maxX,z:target.maxZ},{x:target.minX,z:target.maxZ}];
 assert.equal(overlap(carPolygon(witness.b.state),targetPolygon),true,'old timing with new geometry really leaves the proxy inside, rather than merely lacking an event');
 assert.equal(overlap(carPolygon(witness.c.state),targetPolygon),false,'the actual resolved pose, not only the callback, stays out of the column');
});
for(const fps of[30,60,144])test(`existing shallow overlap opening under actual D yaw preserves health and recovers control at${fps}Hz`,()=>{
 // Explicit transient overlap recovery, NOT a claimed legal fresh spawn.
 // At this angle negative yaw decreases the support feature's X extent.
 const target=current.network.structures.filter(s=>s.kind==='pier')[6],yaw=.8,extent=1.1*Math.cos(yaw)+2.31*Math.sin(yaw);
 const initial={x:target.minX-extent+.01,z:(target.minZ+target.maxZ)/2,y:2,yaw,pitch:0,roll:0,vx:0,vz:0,vy:0,speed:0,vYaw:-.3,wasAirborne:true,coastSupportId:null,airRemaining:10};
 const h=motionHarness(initial,'coast',{'physics-main.js':physics}),n=current.network,late=[];
 h.context.window.RoadsterCoast={...current,network:{...n,sweepPiers(...args){const hit=n.sweepPiers(...args);late.push(hit);return hit;}}};
 h.context.resetCar=()=>{throw Error('unexpected reset');};h.context.sound.playCrash=()=>{};h.context.destroyVehicle=()=>{h.state.isDestroyed=true;};
 vm.runInContext('Math.random=()=>.5;\n'+damage,h.context);const real=h.context.triggerPhysicsCollision;
 h.context.triggerPhysicsCollision=(...args)=>{h.impacts.push(args);real(...args);};h.keys.KeyD=true;
 h.step(1/fps);
 assert.ok(late.some(hit=>hit?.kind==='pier'&&hit.depth>0&&hit.angularClosingPerFraction<0),'real late branch sees the initially overlapping but OPENING feature');
 assert.equal(h.impacts.length,0,'do not call the original minimum-six-damage law with zero new impact');assert.equal(h.state.hullIntegrity,100);assert.equal(h.state.isDestroyed,false);
 // A small geometric depenetration is legitimate. We do not demand that the
 // existing overlap be allowed to tunnel, or that its recovery pose be ignored.
 for(let i=0;i<Math.ceil(fps*.15);i++)h.step(1/fps);
 assert.ok(h.state.yaw<yaw,'continued available D input really rotates away after local separation');assert.equal(h.impacts.length,0);assert.equal(h.state.hullIntegrity,100);assert.equal(h.state.isDestroyed,false);
});
