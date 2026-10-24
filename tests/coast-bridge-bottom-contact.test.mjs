// Production CPU motion and native r128 drawn geometry, not GPU/pixel evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {motionHarness} from './helpers/motion-harness.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8'),physics=read('src/physics-main.js'),map=read('src/coast-map.js');
const oldPhysics=read('tests/fixtures/coast-bridge-bottom-baseline/physics-main.js'),oldNetwork=read('tests/fixtures/coast-bridge-bottom-baseline/coast-road-network.js'),network=read('src/coast-road-network.js');
assert.equal(createHash('sha256').update(oldPhysics).digest('hex'),'8bbb2a8e3deeb6360c2fcc193b591929f2556c792653b54d3e2e02e45e5e0b8c','immutable ac55 physics counterfactual');
assert.equal(createHash('sha256').update(oldNetwork).digest('hex'),'5279eb0f144d11562f5845d3eee058070fb2008ba000a4305a5649d6cf8f9e1d','immutable ac55 fixed-height ceiling network');
function section(text,start,end){assert.equal(text.split(start).length,2,start);const a=text.indexOf(start),b=text.indexOf(end,a+start.length);assert.ok(b>a,end);return text.slice(a,b);}
const wc=vm.createContext({window:{}});vm.runInContext(network+'\n'+map,wc);const coast=wc.window.RoadsterCoast,n=coast.network;
const oc=vm.createContext({window:{}});vm.runInContext(oldNetwork+'\n'+map,oc);const oldCoast=oc.window.RoadsterCoast;
const damage=section(physics,'function triggerPhysicsCollision(','function destroyVehicle(');assert.equal(damage,section(oldPhysics,'function triggerPhysicsCollision(','function destroyVehicle('),'existing damage constants/formula are unchanged');
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
 c.network=coast.network;
 vm.runInContext(`const group=new THREE.Group();const own=g=>g;${section(map,'    function triangleMesh(','    function exclusiveTop(')}\n${section(map,'    const paint=[],decks=[];','    const arrowRecords=[];')}\nglobalThis.deckMesh=triangleMesh('coast-viaduct-deck',decks,new THREE.MeshStandardMaterial({side:THREE.DoubleSide}));group.updateMatrixWorld(true);`,c);
 vm.runInContext(`globalThis.poseMatrix=function(state,isAirborne){const playerWorldZ=state.z,groundElevation=0,isAccelerating=true,isRearThrusterFiring=false,isFootBraking=false,isReversing=false;${section(physics,'  // Render the resolved pose after traffic contact (which can change state.y).','  RoadsterDrivingScore.segment')}\nplayerWrapper.updateMatrixWorld(true);return roadsterAttitudeGroup.matrixWorld.clone();};`,c);
 const mesh=c.deckMesh,position=mesh.geometry.attributes.position,triangles=[],allTriangles=[],grid=new Map();
 for(let face=0;face<position.count/3;face++){
  const v=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(position,face*3+k).applyMatrix4(mesh.matrixWorld));
  allTriangles.push(new T.Triangle(...v));
  const [a,b,d]=v,den=(b.z-d.z)*(a.x-d.x)+(d.x-b.x)*(a.z-d.z);if(Math.abs(den)<1e-12)continue;
  const tri={a,b,c:d,den,face,minX:Math.min(...v.map(p=>p.x)),maxX:Math.max(...v.map(p=>p.x)),minZ:Math.min(...v.map(p=>p.z)),maxZ:Math.max(...v.map(p=>p.z)),minY:Math.min(...v.map(p=>p.y)),maxY:Math.max(...v.map(p=>p.y))+.7};triangles.push(tri);
  for(let x=Math.floor(tri.minX/32);x<=Math.floor(tri.maxX/32);x++)for(let z=Math.floor(tri.minZ/32);z<=Math.floor(tri.maxZ/32);z++){const k=x+','+z;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(tri);}
 }
 // Box3.setFromObject includes hidden jets/shadow proxies. Match the existing
 // collider's visible-part geometry bounds, without shrinking it to test points.
 const localBox=new T.Box3();model.traverseVisible(part=>{if(!part.geometry||part.userData.shadowProxy)return;const mats=Array.isArray(part.material)?part.material:[part.material];if(mats.every(m=>!m||m.visible===false||m.colorWrite===false||m.transparent&&m.opacity===0))return;part.geometry.computeBoundingBox();localBox.union(part.geometry.boundingBox.clone().applyMatrix4(part.matrixWorld));});
 const pose=row=>c.poseMatrix(row.state,row.airborne).elements.slice();
 const point=(i,e)=>{const x=points[i*3],y=points[i*3+1],z=points[i*3+2];return new T.Vector3(e[0]*x+e[4]*y+e[8]*z+e[12],e[1]*x+e[5]*y+e[9]*z+e[13],e[2]*x+e[6]*y+e[10]*z+e[14]);};
 function inside(row,h){
  const body=h.context.cityPlayerBody({...row.state,y:row.state.y-(row.state.suspensionSquash||0)-(row.state.aeroSquash||0)});let near=false;
  for(let x=Math.floor((body.x-body.rx)/32);x<=Math.floor((body.x+body.rx)/32);x++)for(let z=Math.floor((body.z-body.rz)/32);z<=Math.floor((body.z+body.rz)/32);z++)for(const t of grid.get(x+','+z)||[])if(t.maxX>=body.x-body.rx&&t.minX<=body.x+body.rx&&t.maxZ>=body.z-body.rz&&t.minZ<=body.z+body.rz&&t.maxY>=body.y-body.ry&&t.minY<=body.y+body.ry)near=true;
  if(!near)return null;const e=pose(row);
  for(let i=0;i<points.length/3;i++){
   const p=point(i,e);for(const t of grid.get(Math.floor(p.x/32)+','+Math.floor(p.z/32))||[]){if(p.x<t.minX-1e-6||p.x>t.maxX+1e-6||p.z<t.minZ-1e-6||p.z>t.maxZ+1e-6)continue;
    const u=((t.b.z-t.c.z)*(p.x-t.c.x)+(t.c.x-t.b.x)*(p.z-t.c.z))/t.den,v=((t.c.z-t.a.z)*(p.x-t.c.x)+(t.a.x-t.c.x)*(p.z-t.c.z))/t.den,w=1-u-v;if(Math.min(u,v,w)<-1e-8)continue;
    const bottom=u*t.a.y+v*t.b.y+w*t.c.y,top=bottom+.7;if(p.y>bottom+1e-5&&p.y<top-1e-5)return{point:p,pointIndex:i,bottom,top,depth:Math.min(p.y-bottom,top-p.y),face:t.face};
   }
  }return null;
 }
 function crossing(previous,row,hit){const start=point(hit.pointIndex,pose(previous)),end=hit.point,delta=end.clone().sub(start),length=delta.length();return new T.Raycaster(start,delta.normalize(),0,length+1e-7).intersectObject(mesh,false)[0]||null;}
 return cachedNative={T,vehicle,points,localBox,mesh,inside,crossing,pose,c,triangles,grid,point,allTriangles};
}

// Real original damage is retained; only sound/reset/destruction presentation is
// isolated. Every proof stops on the FIRST callback, including nonfatal damage.
function motion(initial,{fps=60,old=false,seconds=.7,keys=()=>({}),stopAtVertex=true}={}){
 const w=native(),source=old?oldPhysics:physics,world=old?oldCoast:coast,h=motionHarness(initial,'coast',{'physics-main.js':source}),queries=[],records=[];
 h.context.window.RoadsterCoast=world;h.context.window.RoadsterVehicle=w.vehicle;h.context.THREE.Box3=w.T.Box3;
 h.context.resetCar=()=>{throw Error('unexpected reset');};h.context.sound.playCrash=()=>{};h.context.destroyVehicle=reason=>{h.state.isDestroyed=true;h.state.destroyReasonKey=reason;};
 vm.runInContext('Math.random=()=>.5;\n'+damage,h.context);
 for(const name of['coastBridgeBottomContact','coastBridgeSideContact'])if(h.context[name]){const query=h.context[name];h.context[name]=(world,from,to)=>{const before={...h.state},hit=query(world,from,to);if(hit)queries.push({from:{...from},to:{...to},hit,before});return hit;};}
 const trigger=h.context.triggerPhysicsCollision;h.context.triggerPhysicsCollision=(...args)=>{h.impacts.push(args);records.push({args,beforeDamage:{...h.state},query:queries.at(-1)});return trigger(...args);};
 const fullInitial={...h.state},history=[];let previous={state:fullInitial,airborne:!!initial.wasAirborne},firstInside=null;
 for(let frame=0;frame<Math.ceil(fps*seconds);frame++){
  const input=keys(frame/fps);for(const k of['Space','KeyW','KeyA','KeyD','KeyI','KeyK','KeyJ','KeyL'])h.keys[k]=!!input[k];
  const result=h.step(1/fps),row={frame,t:(frame+1)/fps,state:{...h.state},airborne:result?.isAirborne??!!h.state.wasAirborne};history.push(row);
  if(h.impacts.length)break;
  const hit=w.inside(row,h);if(hit){if(!firstInside)firstInside={row,hit,crossing:w.crossing(previous,row,hit)};if(stopAtVertex)break;}previous=row;
 }
 return{h,fullInitial,history,last:history.at(-1),firstInside,queries,records};
}
const bridgeSegments=n.segments.filter(s=>s.bridge&&!s.shared),segment=bridgeSegments[109],isolated={network:{...n,segments:[segment]}};
const route=()=>n.sampleRoute(0,3800,0);
function airStart(pitch=0,depth=3.4,vy=6){const p=route();return{x:p.x,y:p.y-depth,z:p.z,yaw:Math.atan2(-p.dx,-p.dz),pitch,roll:0,speed:0,vx:0,vy,vz:0,wasAirborne:true,airRemaining:10};}
function groundStart(){const p=route(),g=coast.support({x:p.x,z:p.z,y:0,previousY:0,grounded:true,previousSupportId:'terrain'}),yaw=Math.atan2(-p.dx,-p.dz);assert.equal(g.id,'bank-1');assert.equal(g.height,0);return{x:p.x,y:g.height,z:p.z,yaw,...n.groundAttitude(g.normal,yaw),speed:0,vx:0,vy:0,vz:0,wasAirborne:false,coastSupportId:g.id,airRemaining:10};}
function finiteClearance(row){
 const w=native(),e=w.pose(row);let min=Infinity,projected=0;
 for(let i=0;i<w.points.length/3;i++){const p=w.point(i,e);let best=null;for(const t of w.grid.get(Math.floor(p.x/32)+','+Math.floor(p.z/32))||[]){const u=((t.b.z-t.c.z)*(p.x-t.c.x)+(t.c.x-t.b.x)*(p.z-t.c.z))/t.den,v=((t.c.z-t.a.z)*(p.x-t.c.x)+(t.a.x-t.c.x)*(p.z-t.c.z))/t.den;if(Math.min(u,v,1-u-v)<-1e-8)continue;const gap=u*t.a.y+v*t.b.y+(1-u-v)*t.c.y-p.y;if(best===null||Math.abs(gap)<Math.abs(best))best=gap;}if(best!==null){projected++;min=Math.min(min,best);}}
 return{min,projected};
}
function bodyHits(row,triangles=native().allTriangles){const w=native(),inverse=new w.T.Matrix4().fromArray(w.pose(row)).invert();return triangles.some(t=>w.localBox.intersectsTriangle(new w.T.Triangle(t.a.clone().applyMatrix4(inverse),t.b.clone().applyMatrix4(inverse),t.c.clone().applyMatrix4(inverse))));}
function nativeFloor(x,z){
 const w=native();w.c.floorPoint={x,z};const meshes=vm.runInContext(`(()=>{${section(map,'    function exclusiveTop(','    const bankTops=')}
const q=floorPoint,near=t=>Math.max(t.a.x,t.b.x,t.c.x)>=q.x-3&&Math.min(t.a.x,t.b.x,t.c.x)<=q.x+3&&Math.max(t.a.z,t.b.z,t.c.z)>=q.z-3&&Math.min(t.a.z,t.b.z,t.c.z)<=q.z+3,m=new THREE.MeshStandardMaterial();return[triangleMesh('coast-road-surfaces',roadTops.filter(near),m),triangleMesh('coast-road-earth-banks',exclusiveTop(network.banks.filter(near),roadMasks),m)];})()`,w.c);for(const m of meshes)m.updateMatrixWorld(true);
 return new w.T.Raycaster(new w.T.Vector3(x,5,z),new w.T.Vector3(0,-1,0),0,10).intersectObjects(meshes,false)[0];
}
function repaired(r){assert.equal(Boolean(r.firstInside),false,'no drawn native vertex enters original slab before damage');assert.equal(native().inside(r.last,r.h),null,'inspect actual first-contact resolved row, not a later frame');assert.ok(r.h.impacts.length>=1,'actual original damage path, not only a query hook');assert.equal(r.records.filter(q=>q.beforeDamage.impactCooldown<=0).length,1,'subsequent same-frame RCS recontact respects unchanged damage cooldown');for(const q of r.records.slice(1))assert.equal(q.beforeDamage.hullIntegrity,r.last.state.hullIntegrity,'cooldown-blocked callbacks do not subtract another damage minimum');assert.ok(r.h.impacts[0][0]>0);assert.equal(r.records[0].query?.hit.kind,'bridge-bottom');assert.ok(r.records[0].query.hit.normal.y<-.9,'outward underside response, not top magnetization');}
for(const fps of[30,60,144])test(`nose-up ac55 missed REAL native bottom; repaired actual response at${fps}Hz`,{skip:!nativeAvailable},()=>{
 const initial=airStart(Math.PI/2),old=motion(initial,{fps,old:true}),current=motion(initial,{fps});
 const clear=finiteClearance({state:old.fullInitial,airborne:true});assert.equal(clear.projected,native().points.length/3);assert.ok(clear.min>.5);assert.equal(bodyHits({state:old.fullInitial,airborne:true}),false,'entire original approved rotated OBB starts clear of ALL deck triangles');
 assert.ok(old.firstInside);assert.equal(old.firstInside.crossing?.faceIndex,654);assert.ok(old.firstInside.crossing.face.normal.y>.99,'actual original BOTTOM triangle, not side');assert.equal(old.h.impacts.length,0);
 repaired(current);assert.ok(current.last.t<=old.last.t);
});
for(const fps of[30,60,144])test(`inverted ac55 invisible ceiling is >1m away; repaired clear flight at${fps}Hz`,{skip:!nativeAvailable},()=>{
 const initial=airStart(Math.PI,2.2),old=motion(initial,{fps,old:true,seconds:.12}),current=motion(initial,{fps,seconds:.12});assert.equal(old.h.impacts.length,1);
 const clearance=finiteClearance(old.last);assert.equal(clearance.projected,native().points.length/3);assert.ok(clearance.min>1.18);assert.equal(bodyHits(old.last),false,'even conservative rotated body is clear of all rendered deck triangles at old callback');
 assert.equal(current.h.impacts.length,0);assert.equal(current.firstInside,null);assert.ok(finiteClearance(current.last).min>0,'all drawn native vertices remain below actual finite bottom');assert.equal(bodyHits(current.last),false);
});
for(const fps of[30,60,144])test(`once-supported actual bank + Space and KeyI naturally reaches old bottom miss at${fps}Hz`,{skip:!nativeAvailable},()=>{
 const initial=groundStart(),floor=nativeFloor(initial.x,initial.z);assert.ok(floor);assert.equal(floor.object.name,'coast-road-earth-banks');assert.equal(floor.point.y,initial.y);assert.equal(floor.face.normal.y,1);
 const options={fps,seconds:5,keys:t=>({Space:t<6.5,KeyI:t>=3.3&&t<6.5})},old=motion(initial,{...options,old:true}),current=motion(initial,options);
 assert.equal(initial.wasAirborne,false,'once-only actual supported start near bridge, NOT default spawn traversal or seeded air');assert.equal(old.h.impacts.length,0);assert.ok(old.firstInside);assert.equal(old.firstInside.crossing?.faceIndex,654);assert.ok(old.last.t>4&&old.last.t<4.5);assert.ok(old.last.state.airRemaining<6);
 repaired(current);assert.ok(current.last.t<=old.last.t);assert.ok(current.history.some(row=>row.airborne));
});
for(const fps of[30,60,144])test(`actual altitude-hold and paid late pitch RCS: original bottom miss and repaired response at${fps}Hz`,{skip:!nativeAvailable},()=>{
 const initial=airStart(0,2.2,0);Object.assign(initial,{isAltitudeHold:true,holdTargetY:initial.y});const options={fps,seconds:.8,keys:()=>({KeyI:true})},old=motion(initial,{...options,old:true}),current=motion(initial,options);
 assert.ok(old.firstInside);assert.equal(old.h.impacts.length,0);assert.equal(old.firstInside.crossing?.faceIndex,655);assert.ok(Math.abs(old.last.state.y-initial.y)<.05,'real hold is not falsely described as mathematically stationary');
 repaired(current);const q=current.records[0].query;assert.equal(q.from.x,q.to.x);assert.equal(q.from.y,q.to.y);assert.equal(q.from.z,q.to.z,'actual AFTER-translation paid attitude segment');assert.ok(q.before.airRemaining<10);assert.ok(q.to.pitch>q.from.pitch);
});
// Native triangle intersection oracle: dense sampling + bisection, independent
// of production SAT axes/CCD. Only the approved existing model Box3 is used.
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
function bottomTriangles(){return native().allTriangles.slice(654,656);}
function oracle(from,to,triangles=bottomTriangles()){
 const w=native(),T=w.T,delta=Object.fromEntries(['pitch','yaw','roll'].map(k=>[k,wrap((to[k]||0)-(from[k]||0))])),matrix=new T.Matrix4(),inverse=new T.Matrix4(),q=new T.Quaternion(),e=new T.Euler(0,0,0,'YXZ'),p=new T.Vector3(),one=new T.Vector3(1,1,1);
 const overlaps=t=>{p.set(from.x+(to.x-from.x)*t,from.y+(to.y-from.y)*t,from.z+(to.z-from.z)*t);e.set((from.pitch||0)+delta.pitch*t,(from.yaw||0)+delta.yaw*t,(from.roll||0)+delta.roll*t,'YXZ');q.setFromEuler(e);matrix.compose(p,q,one);inverse.copy(matrix).invert();return triangles.some(t=>w.localBox.intersectsTriangle(new T.Triangle(t.a.clone().applyMatrix4(inverse),t.b.clone().applyMatrix4(inverse),t.c.clone().applyMatrix4(inverse))));};
 if(overlaps(0))return 0;let lo=0,hi=null;for(let i=1;i<=2048;i++)if(overlaps(i/2048)){lo=(i-1)/2048;hi=i/2048;break;}if(hi===null)return null;for(let i=0;i<40;i++){const mid=(lo+hi)/2;if(overlaps(mid))hi=mid;else lo=mid;}return hi;
}
function direct(){const w=native(),h=motionHarness({},'coast',{'physics-main.js':physics});h.context.window.RoadsterVehicle=w.vehicle;h.context.THREE.Box3=w.T.Box3;assert.equal(typeof h.context.coastBridgeBottomContact,'function');return h;}
function path(angles={},toAngles=angles){const w=native(),T=w.T,vertices=bottomTriangles().flatMap(t=>[t.a,t.b,t.c]),center=vertices.reduce((s,p)=>s.add(p),new T.Vector3()).multiplyScalar(1/vertices.length),normal=bottomTriangles()[0].getNormal(new T.Vector3()).multiplyScalar(-1),offset=w.localBox.getCenter(new T.Vector3()),at=(d,a)=>{const rotation=new T.Euler(a.pitch||0,a.yaw||0,a.roll||0,'YXZ'),o=offset.clone().applyEuler(rotation),p=center.clone().addScaledVector(normal,d).sub(o);return{x:p.x,y:p.y,z:p.z,pitch:0,yaw:0,roll:0,...a};};return[at(6,angles),at(-4,toAngles)];}
for(const angles of[{yaw:0},{yaw:Math.PI/2},{yaw:.7,pitch:Math.PI/2},{yaw:-.5,pitch:Math.PI},{yaw:.9,roll:Math.PI/2},{yaw:.3,pitch:.8,roll:-.6}])test(`native finite BOTTOM TOI at independent YXZ=${JSON.stringify(angles)}`,{skip:!nativeAvailable},()=>{
 const h=direct(),[from,to]=path(angles),expected=oracle(from,to),hit=h.context.coastBridgeBottomContact(isolated,from,to);assert.ok(expected!==null);assert.ok(hit);assert.ok(Math.abs(hit.t-expected)<2e-6,`${hit.t} vs native ${expected}`);assert.ok(hit.normal.y<-.98);assert.ok(hit.depth<1e-6);
 const actual=hit.box.vertices.map(v=>v.join(',')).sort();assert.ok(bottomTriangles().some(t=>JSON.stringify([t.a,t.b,t.c].map(p=>[p.x,p.y,p.z].join(',')).sort())===JSON.stringify(actual)),'contact is one exact actual Float32 bottom triangle, not a fitted infinite slab');
});
for(const[name,a,b]of[['pitch',[0,0,0],[1.3,0,0]],['fullYXZ',[.2,.6,-.8],[1.5,1.7,.4]],['Pi-short-arc',[.3,Math.PI-.25,.2],[.6,-Math.PI+.3,.5]]])test(`rotating native bottom finite TOI ${name}`,{skip:!nativeAvailable},()=>{
 const angles=q=>({pitch:q[0],yaw:q[1],roll:q[2]}),[from,to]=path(angles(a),angles(b)),expected=oracle(from,to),hit=direct().context.coastBridgeBottomContact(isolated,from,to);assert.ok(expected!==null);assert.ok(hit);assert.ok(Math.abs(hit.t-expected)<3e-6);
});
for(const fps of[30,60,144])test(`bottom split${fps}Hz, low-speed/overlap/opening, finite-clear and one-sided controls`,{skip:!nativeAvailable},()=>{
 const h=direct(),[a,b]=path({yaw:.7,pitch:.4,roll:-.3}),expected=oracle(a,b);assert.ok(expected!==null);const at=t=>({...a,x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});let first=null;
 for(let i=0;i<fps;i++){const hit=h.context.coastBridgeBottomContact(isolated,at(i/fps),at((i+1)/fps));if(hit){first=(i+hit.t)/fps;break;}}assert.ok(first!==null);assert.ok(Math.abs(first-expected)<2e-6);
 const before=at(expected-1e-5),after=at(expected+1e-5),slow=h.context.coastBridgeBottomContact(isolated,before,after);assert.ok(slow);assert.ok(Math.abs(slow.t-.5)<.002,'real0.2mm finite-face crossing');assert.equal(h.context.coastBridgeBottomContact(isolated,after,after),null);assert.equal(h.context.coastBridgeBottomContact(isolated,after,at(expected-.01)),null);assert.equal(h.context.coastBridgeBottomContact(isolated,after,at(expected+.01))?.t,0);
 assert.equal(h.context.coastBridgeBottomContact(isolated,b,a),null,'one-sided underside must not absorb car approaching from above');
 const farA={...a,x:a.x+80},farB={...b,x:b.x+80};assert.equal(oracle(farA,farB),null);assert.equal(h.context.coastBridgeBottomContact(isolated,farA,farB),null,'no infinite ceiling outside actual finite triangle');
});
test('bottom pure rotation detects intermediate hull contact with BOTH endpoints clear',{skip:!nativeAvailable},()=>{
 const initial=airStart(0,2.8,0),end={...initial,pitch:-Math.PI},expected=oracle(initial,end);assert.ok(expected!==null);assert.equal(bodyHits({state:initial,airborne:true},bottomTriangles()),false);assert.equal(bodyHits({state:end,airborne:true},bottomTriangles()),false);const hit=direct().context.coastBridgeBottomContact(isolated,initial,end);assert.ok(hit);assert.ok(Math.abs(hit.t-expected)<3e-6);
});
for(const fps of[30,60,144])test(`clear interior underpass and ordinary top landing keep EVERY ac55 state field at${fps}Hz`,{skip:!nativeAvailable},()=>{
 for(const initial of[airStart(0,4,0),{...airStart(0,-5,-8),coastSupportId:'terrain'}]){const options={fps,seconds:.8,stopAtVertex:false},old=motion(initial,{...options,old:true}),current=motion(initial,options);assert.deepEqual(structuredClone(current.history),structuredClone(old.history));assert.deepEqual(current.h.impacts,old.h.impacts);assert.deepEqual(structuredClone(current.firstInside),structuredClone(old.firstInside),'unchanged native top/wheel contact, not a new underside event');if(initial.vy<0)assert.equal(current.last.airborne,false);else assert.equal(current.firstInside,null);}
});
test('finite bottom endpoint grazing and just-clear motion agree with independent native triangles',{skip:!nativeAvailable},()=>{
 const h=direct(),[from,to]=path({yaw:.7,pitch:.4,roll:-.3}),a=segment.rows[1][0],b=segment.rows[1][4],length=Math.hypot(b.z-a.z,b.x-a.x);let nx=(b.z-a.z)/length,nz=(a.x-b.x)/length;if(nx*(segment.b.x-segment.a.x)+nz*(segment.b.z-segment.a.z)<0){nx=-nx;nz=-nz;}
 const shifted=s=>[{...from,x:from.x+nx*s,z:from.z+nz*s},{...to,x:to.x+nx*s,z:to.z+nz*s}];let lo=0,hi=16;assert.ok(oracle(...shifted(lo))!==null);assert.equal(oracle(...shifted(hi)),null);for(let i=0;i<13;i++){const m=(lo+hi)/2;if(oracle(...shifted(m))===null)hi=m;else lo=m;}
 for(const s of[lo-.001,hi+.001]){const[a,b]=shifted(s),expected=oracle(a,b),hit=h.context.coastBridgeBottomContact(isolated,a,b);if(s<lo){assert.ok(expected!==null,'actual finite endpoint graze');assert.ok(hit);assert.ok(Math.abs(hit.t-expected)<3e-6);}else{assert.equal(expected,null,'independent native geometry beyond the finite endpoint');assert.equal(hit,null);}}
});
// Pure CPU: compare the exact pre-optimization generic finite-face query, not
// ac55's incorrect fixed-height ceiling or a second copy of the pruning rule.
test('bottom whole-path clear certificate preserves every unpruned result across actual-face/rotation/chord/gap cases',()=>{
 const h=motionHarness({},'coast',{'physics-main.js':physics}),fixture=read('tests/fixtures/coast-bridge-bottom-baseline/unpruned-face-query.js');assert.equal(createHash('sha256').update(fixture).digest('hex'),'267adf4c73224d2b99b089b46ccedc028a17b5bf29005ff715d29c08af8beb6d');const eager=vm.runInContext('(()=>{'+fixture+';return coastBridgeBottomContact;})()',h.context),current=h.context.coastBridgeBottomContact;assert.equal(typeof current,'function');let count=0,hits=0,misses=0;
 const check=(label,world,a,b,mustHit=false)=>{const expected=eager(world,a,b),actual=current(world,a,b);assert.deepEqual(structuredClone(actual),structuredClone(expected),label+' preserves EVERY field/TOI/face/normal/depth/angular feature');if(expected)hits++;else misses++;if(mustHit)assert.ok(expected,label+' is nonvacuous contact');count++;return expected;};
 const angles=[{yaw:0},{yaw:Math.PI/2},{yaw:.7,pitch:Math.PI/2},{yaw:-.5,pitch:Math.PI},{yaw:.9,roll:Math.PI/2},{yaw:.3,pitch:.8,roll:-.6}],rotations=[[{pitch:0,yaw:0,roll:0},{pitch:1.3,yaw:0,roll:0}],[{pitch:.2,yaw:.6,roll:-.8},{pitch:1.5,yaw:1.7,roll:.4}],[{pitch:.3,yaw:Math.PI-.25,roll:.2},{pitch:.6,yaw:-Math.PI+.3,roll:.5}]];
 for(const ordinal of[0,37,109,153,220,300]){
  const s=bridgeSegments[ordinal],m={x:(s.a.x+s.b.x)/2,y:(s.a.y+s.b.y)/2-n.SLAB_DEPTH,z:(s.a.z+s.b.z)/2},world={network:{...n,segments:[s]}},path=(a,b=a)=>[{...m,y:m.y-6,pitch:0,yaw:0,roll:0,...a},{...m,y:m.y+4,pitch:0,yaw:0,roll:0,...b}];
  for(const a of angles){const[from,to]=path(a);check(`actual${ordinal}constant`,world,from,to,true);check(`actual${ordinal}clear`,world,{...from,x:from.x+80},{...to,x:to.x+80});}
  for(const[a,b]of rotations)check(`actual${ordinal}rotate`,world,...path(a,b),true);
  check(`actual${ordinal}from-above`,world,...path({yaw:.7}).reverse());
  const[from,to]=path({yaw:.7,pitch:.4,roll:-.3}),hit=check(`actual${ordinal}short-base`,world,from,to,true),at=t=>({...from,y:from.y+(to.y-from.y)*t});check(`actual${ordinal}0.2mm`,world,at(hit.t-.00001),at(hit.t+.00001),true);
  const tx=(s.b.x-s.a.x)/Math.hypot(s.b.x-s.a.x,s.b.z-s.a.z),tz=(s.b.z-s.a.z)/Math.hypot(s.b.x-s.a.x,s.b.z-s.a.z),fastFrom={...m,x:m.x+tz*160,y:m.y-1.25-6,z:m.z-tx*160,pitch:0,yaw:.7,roll:0},fastTo={...fastFrom,x:m.x-tz*160,y:m.y-1.25+6,z:m.z+tx*160};assert.ok(Math.abs(Math.floor(fastFrom.x/64)-Math.floor(fastTo.x/64))>=2||Math.abs(Math.floor(fastFrom.z/64)-Math.floor(fastTo.z/64))>=2);check(`actual${ordinal}320m-cross-grid`,world,fastFrom,fastTo,true);
  const rotate={...m,y:m.y-2.05,pitch:0,yaw:0,roll:0};check(`actual${ordinal}Pi-middle-only`,world,rotate,{...rotate,pitch:-Math.PI},true);
 }
 const row=z=>[-8,-4,0,4,8].map(x=>({x,y:10.7,z})),gapWorld={network:{segments:[{bridge:true,a:{x:0,y:10.7,z:-8},b:{x:0,y:10.7,z:8},rows:[row(-8),row(8)]}],SLAB_DEPTH:.7}},gap={x:0,y:10-1.25-.0000002,z:0,pitch:0,yaw:0,roll:0};assert.equal(check('strict0.2micrometre-Y-clear normal-axis rotation',gapWorld,gap,{...gap,yaw:.02}),null);
 assert.equal(count,121);assert.ok(hits>70);assert.ok(misses>=40);
});
