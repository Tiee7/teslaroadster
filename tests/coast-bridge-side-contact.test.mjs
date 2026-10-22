// Production CPU motion and native r128 drawn geometry, not GPU/pixel evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {motionHarness} from './helpers/motion-harness.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8'),physics=read('src/physics-main.js'),map=read('src/coast-map.js');
const oldPhysics=read('tests/fixtures/coast-bridge-side-baseline/physics-main.js');
assert.equal(createHash('sha256').update(oldPhysics).digest('hex'),'6b1ee3737b7e1115d2bc7080d9a3374f77f0b9062a0ecca6d537df057ebd2ca8');
const network=read('src/coast-road-network.js');
const priorNetwork=read('tests/fixtures/coast-bridge-bottom-baseline/coast-road-network.js');assert.equal(createHash('sha256').update(priorNetwork).digest('hex'),'5279eb0f144d11562f5845d3eee058070fb2008ba000a4305a5649d6cf8f9e1d');
const removeBottomSwitch=network.replace('function sweepStructures(previous,next,height=1.25,includeCeiling=true){','function sweepStructures(previous,next,height=1.25){').replace('    if(includeCeiling){\n    const count=','    const count=').replace('    }\n    return hit;\n  }\n  const trafficPathCache=','    return hit;\n  }\n  const trafficPathCache=');assert.equal(removeBottomSwitch,priorNetwork,'only default-preserving coarse-ceiling opt-out is authorized; all prior data/structure bytes stay exact');
function section(text,start,end){assert.equal(text.split(start).length,2,start);const a=text.indexOf(start),b=text.indexOf(end,a+start.length);assert.ok(b>a,end);return text.slice(a,b);}
const wc=vm.createContext({window:{}});vm.runInContext(network+'\n'+map,wc);const coast=wc.window.RoadsterCoast,n=coast.network;
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
 const mesh=c.deckMesh,position=mesh.geometry.attributes.position,triangles=[],grid=new Map();
 for(let face=0;face<position.count/3;face++){
  const v=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(position,face*3+k).applyMatrix4(mesh.matrixWorld));
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
 const faces=ordinal=>[2,3,4,5].map(face=>new T.Triangle(...[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(position,(ordinal*6+face)*3+k).applyMatrix4(mesh.matrixWorld))));
 function terrainAt(x,z){
  const subjects=[];for(let i=0;i<n.terrain.indices.length;i+=3){const v=n.terrain.indices.slice(i,i+3).map(j=>n.terrain.vertices[j]);if(x<Math.min(...v.map(p=>p.x))||x>Math.max(...v.map(p=>p.x))||z<Math.min(...v.map(p=>p.z))||z>Math.max(...v.map(p=>p.z)))continue;subjects.push({a:v[0],b:v[1],c:v[2]});}
  assert.ok(subjects.length);assert.ok(subjects.every(t=>[t.a,t.b,t.c].some(p=>Math.abs(p.y)>1e-5)),'actual exclusiveTop leaves these nonflat terrain triangles unchanged');
  const ground=c.triangleMesh('native-ground-start',subjects,new T.MeshBasicMaterial({side:T.DoubleSide}));ground.updateMatrixWorld(true);
  const hit=new T.Raycaster(new T.Vector3(x,200,z),new T.Vector3(0,-1,0),0,400).intersectObject(ground,false)[0];assert.ok(hit,'actual Float32 production terrain triangles below the once-only start');return hit.point.y;
 }
 return cachedNative={T,vehicle,points,localBox,mesh,inside,crossing,faces,terrainAt};
}

function motion(initial,{fps=60,old=false,seconds=.6,keys=()=>({}),stopAtVertex=false}={}){
 const w=native(),h=motionHarness(initial,'coast',{'physics-main.js':old?oldPhysics:physics});h.context.window.RoadsterCoast=coast;h.context.window.RoadsterVehicle=w.vehicle;h.context.THREE.Box3=w.T.Box3;
 h.context.resetCar=()=>{throw Error('unexpected reset during bounded bridge side path');};h.context.sound.playCrash=()=>{};h.context.destroyVehicle=reason=>{h.state.isDestroyed=true;h.state.destroyReasonKey=reason;};
 vm.runInContext('Math.random=()=>.5;\n'+damage,h.context);const real=h.context.triggerPhysicsCollision;h.context.triggerPhysicsCollision=(...args)=>{h.impacts.push(args);real(...args);};
 const queries=[],damageRecords=[];if(h.context.coastBridgeSideContact){const query=h.context.coastBridgeSideContact;h.context.coastBridgeSideContact=(world,from,to)=>{const stateBefore={...h.state},hit=query(world,from,to);if(hit)queries.push({from:{...from},to:{...to},hit,stateBefore});return hit;};}const trigger=h.context.triggerPhysicsCollision;h.context.triggerPhysicsCollision=(...args)=>{damageRecords.push({args,beforeDamage:{...h.state},query:queries.at(-1)});return trigger(...args);};
 const fullInitial={...h.state},history=[];let previous={state:fullInitial,airborne:!!initial.wasAirborne},firstInside=null;
 for(let frame=0;frame<Math.ceil(fps*seconds);frame++){
  const input=keys(frame/fps);for(const k of['Space','KeyW','KeyA','KeyD','KeyI','KeyK','KeyJ','KeyL'])h.keys[k]=!!input[k];
  const result=h.step(1/fps),row={frame,t:(frame+1)/fps,state:{...h.state},airborne:result.isAirborne,impacts:h.impacts.length};history.push(row);
  // Any original damage callback ends the proof, including a nonfatal one.
  if(h.impacts.length)break;
  const hit=w.inside(row,h);if(hit&&!firstInside){firstInside={row,hit,crossing:w.crossing(previous,row,hit)};if(stopAtVertex)break;}
  previous=row;
 }
 return{h,initial,fullInitial,history,last:history.at(-1),firstInside,queries,damageRecords};
}
function airStart(side,depth=1.6){
 const p=n.sampleRoute(0,3800,0),offset=side*(p.halfWidth+4),vx=p.dz*30*side,vz=-p.dx*30*side;
 return{x:p.x-p.dz*offset,y:p.y-depth,z:p.z+p.dx*offset,yaw:Math.atan2(-vx,-vz),pitch:0,roll:0,speed:30,vx,vy:0,vz,wasAirborne:true,airRemaining:10};
}
for(const fps of[30,60,144])for(const side of[-1,1])test(`native real slab SIDE counterexample and actual repaired response at${fps}Hz side=${side}`,{skip:!nativeAvailable},()=>{
 const initial=airStart(side),old=motion(initial,{fps,old:true,stopAtVertex:true}),next=motion(initial,{fps});
 assert.equal(old.h.impacts.length,0);assert.ok(old.firstInside,'retain the 9414 visible-vertex slab penetration');
 assert.equal(old.firstInside.crossing?.face.normal.y,0,'actual finite rendered vertical SIDE, not shared support helper or bottom');assert.ok(old.firstInside.hit.depth>0);
 assert.equal(next.firstInside,null,'response prevents a drawn vertex entering the slab before any contact callback');assert.equal(native().inside(next.last,next.h),null,'inspect the ACTUAL first-contact rollback row, without advancing after damage');assert.equal(next.h.impacts.length,1);assert.ok(next.h.impacts[0][0]>0);
 assert.ok(next.last.t<=old.last.t,'do not merely postpone the old miss');
});
for(const fps of[30,60,144])for(const side of[-1,1])test(`original rail real contact and clear underpass retain ALL state fields at${fps}Hz side=${side}`,{skip:!nativeAvailable},()=>{
 for(const option of[{depth:1.2},{depth:2.2},{depth:1.6,away:true},{depth:-10}]){const initial=airStart(side,option.depth);if(option.away){initial.vx*=-1;initial.vz*=-1;}const a=motion(initial,{fps,old:true}),b=motion(initial,{fps});
  assert.deepEqual(structuredClone(b.history),structuredClone(a.history),'side pass must not shift original rail/clear-underpass motion, fuel, hull or flags');assert.deepEqual(b.h.impacts,a.h.impacts);
  if(option.depth===1.2)assert.equal(a.h.impacts.length,1);else{assert.equal(a.h.impacts.length,0);assert.equal(a.firstInside,null);}
 }
});
function groundStart(){
 const p=n.sampleRoute(0,4600,0),side=-1,offset=side*(p.halfWidth+40),x=p.x-p.dz*offset,z=p.z+p.dx*offset,terrain=n.terrainSupport(x,z),g=coast.support({x,z,y:terrain.height,previousY:terrain.height,grounded:true,previousSupportId:'terrain'}),vx=p.dz*15*side,vz=-p.dx*15*side,yaw=Math.atan2(-vx,-vz);
 assert.equal(g.id,'terrain');return{x,z,y:g.height,yaw,...n.groundAttitude(g.normal,yaw),speed:15,vx,vz,vy:-(g.normal.x*vx+g.normal.z*vz)/g.normal.y,wasAirborne:false,coastSupportId:g.id,airRemaining:10};
}
for(const fps of[30,60,144])test(`supported nearby terrain + actual timed Space/W reaches old SIDE miss and repaired collision at${fps}Hz`,{skip:!nativeAvailable},()=>{
 const initial=groundStart(),options={fps,seconds:2,keys:t=>({Space:t<1.6,KeyW:t<2})},a=motion(initial,{...options,old:true,stopAtVertex:true}),b=motion(initial,options);
 assert.equal(initial.wasAirborne,false,'single actual nearby ground initialization, NOT the old seeded air pose nor default spawn');assert.ok(Math.abs(native().terrainAt(initial.x,initial.z)-initial.y)<1e-7,'native Raycaster/actual production Float32 terrain height independently supports the start');
 assert.equal(a.h.impacts.length,0);assert.ok(a.firstInside);assert.equal(a.firstInside.crossing?.face.normal.y,0,'strict real side-face crossing, never relabel bottom cases');
 assert.equal(b.firstInside,null);assert.equal(native().inside(b.last,b.h),null,'natural-input first-contact resolved pose is not inside the actual slab');assert.equal(b.h.impacts.length,1);assert.ok(b.h.impacts[0][0]>0);assert.ok(b.last.t<=a.last.t);assert.ok(b.history.some(row=>row.airborne),'real lift/tank path, not pose assignments');
});
// Independent oracle: inverse-transform the ACTUAL Float32 rendered triangles
// into the native model's local Box3, then use native Box3.intersectsTriangle.
// Dense time sampling and bisection do not reuse production CCD axes/formulas.
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
function oracle(from,to,triangles){
 const{T,localBox}=native(),delta=Object.fromEntries(['pitch','yaw','roll'].map(k=>[k,wrap((to[k]||0)-(from[k]||0))])),matrix=new T.Matrix4(),inverse=new T.Matrix4(),quaternion=new T.Quaternion(),scale=new T.Vector3(1,1,1),position=new T.Vector3(),euler=new T.Euler(0,0,0,'YXZ');
 const overlaps=t=>{position.set(from.x+(to.x-from.x)*t,from.y+(to.y-from.y)*t,from.z+(to.z-from.z)*t);euler.set((from.pitch||0)+delta.pitch*t,(from.yaw||0)+delta.yaw*t,(from.roll||0)+delta.roll*t,'YXZ');quaternion.setFromEuler(euler);matrix.compose(position,quaternion,scale);inverse.copy(matrix).invert();return triangles.some(triangle=>localBox.intersectsTriangle(new T.Triangle(triangle.a.clone().applyMatrix4(inverse),triangle.b.clone().applyMatrix4(inverse),triangle.c.clone().applyMatrix4(inverse))));};
 if(overlaps(0))return 0;let lo=0,hi=null;for(let i=1;i<=2048;i++)if(overlaps(i/2048)){lo=(i-1)/2048;hi=i/2048;break;}if(hi===null)return null;for(let i=0;i<40;i++){const m=(lo+hi)/2;if(overlaps(m))hi=m;else lo=m;}return hi;
}
function direct(){const w=native(),h=motionHarness({},'coast');h.context.window.RoadsterVehicle=w.vehicle;h.context.THREE.Box3=w.T.Box3;assert.equal(typeof h.context.coastBridgeSideContact,'function');return h;}
const bridgeSegments=n.segments.filter(s=>s.bridge&&!s.shared),segment=bridgeSegments[109],isolated={network:{...n,segments:[segment]}};
function faceCenter(edge=0){const a=segment.rows[0][edge],b=segment.rows[1][edge];let nx=b.z-a.z,nz=a.x-b.x;const l=Math.hypot(nx,nz),sign=((a.x+b.x-segment.a.x-segment.b.x)*nx+(a.z+b.z-segment.a.z-segment.b.z)*nz)<0?-1:1;return{x:(a.x+b.x)/2,y:(a.y+b.y)/2-.35,z:(a.z+b.z)/2,nx:nx*sign/l,nz:nz*sign/l,tx:(b.x-a.x)/l,tz:(b.z-a.z)/l,length:l};}
function path(edge,angles,toAngles=angles){const w=native(),m=faceCenter(edge),center=w.localBox.getCenter(new w.T.Vector3()),pose=(d,angle)=>{const e=new w.T.Euler(angle.pitch||0,angle.yaw||0,angle.roll||0,'YXZ'),offset=center.clone().applyEuler(e);return{x:m.x+m.nx*d,y:m.y-offset.y,z:m.z+m.nz*d,...angle};};return[pose(6,angles),pose(-4,toAngles)];}
for(const edge of[0,4])for(const angles of[{yaw:0},{yaw:Math.PI/4},{yaw:Math.PI/2},{yaw:-Math.PI/2},{yaw:Math.PI,pitch:.35,roll:-.4},{yaw:.7,pitch:1.15,roll:.85},{yaw:-.4,pitch:-.7,roll:Math.PI/2}])test(`finite actual side triangle/native OBB FIRST contact agrees yaw/pitch/roll=${JSON.stringify(angles)} edge=${edge}`,{skip:!nativeAvailable},()=>{
 const h=direct(),[a,b]=path(edge,angles),expected=oracle(a,b,native().faces(109)),hit=h.context.coastBridgeSideContact(isolated,a,b);assert.ok(expected!==null);assert.ok(hit);assert.ok(Math.abs(hit.t-expected)<2e-6,`${hit.t} vs native triangle oracle ${expected}`);assert.ok(hit.depth<1e-6,'finite first contact must not invent half-meter plane penetration');
});
for(const[name,a,b]of[
 ['yaw widen',{yaw:0},{yaw:1.4}],['pitch and roll',{yaw:.6,pitch:-.65,roll:.8},{yaw:1.8,pitch:.9,roll:-.5}],['positive Pi short arc',{yaw:Math.PI-.25},{yaw:-Math.PI+.3}],['negative Pi short arc',{yaw:-Math.PI+.25},{yaw:Math.PI-.3}],['roll turnover',{yaw:1,pitch:.2,roll:0},{yaw:1,pitch:.2,roll:2.2}]
])test(`rotating finite side CCD agrees with independent native triangle time oracle: ${name}`,{skip:!nativeAvailable},()=>{const h=direct(),[from,to]=path(0,a,b),expected=oracle(from,to,native().faces(109)),hit=h.context.coastBridgeSideContact(isolated,from,to);assert.ok(expected!==null);assert.ok(hit);assert.ok(Math.abs(hit.t-expected)<3e-6,`${hit.t} vs ${expected}`);});
for(const fps of[30,60,144])test(`finite side frame-split time, low-speed and no-contact semantic controls at${fps}Hz`,{skip:!nativeAvailable},()=>{
 const h=direct(),[a,b]=path(0,{yaw:.7,pitch:.25,roll:-.15}),expected=oracle(a,b,native().faces(109));let first=null;
 for(let i=0;i<fps;i++){const at=t=>({...a,x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t}),hit=h.context.coastBridgeSideContact(isolated,at(i/fps),at((i+1)/fps));if(hit){first=(i+hit.t)/fps;break;}}
 assert.ok(first!==null);assert.ok(Math.abs(first-expected)<2e-6);
 const m=faceCenter(0),far={...a,x:a.x+m.tx*(m.length+8),z:a.z+m.tz*(m.length+8)},farTo={...b,x:b.x+m.tx*(m.length+8),z:b.z+m.tz*(m.length+8)};
 for(const[from,to]of[[far,farTo],[{...a,y:a.y+8},{...b,y:b.y+8}],[{...a,y:a.y-8},{...b,y:b.y-8}],[a,{...a,x:a.x+m.nx,z:a.z+m.nz}]]){assert.equal(oracle(from,to,native().faces(109)),null);assert.equal(h.context.coastBridgeSideContact(isolated,from,to),null,'no infinite wall/end cap or high/low ghost face');}
 const inside={...a,x:m.x-m.nx*4,z:m.z-m.nz*4,y:a.y-8};assert.equal(h.context.coastBridgeSideContact(isolated,inside,{...inside,y:inside.y+16}),null,'an underside-only vertical approach is outside this side-entry change');
});

for(const edge of[0,4])test(`finite quad endpoint, upper/lower edge, shallow overlap/opening and very slow contact edge=${edge}`,{skip:!nativeAvailable},()=>{
 const h=direct(),w=native(),m=faceCenter(edge),[a,b]=path(edge,{yaw:.7,pitch:.25,roll:-.15}),triangles=w.faces(109),t=oracle(a,b,triangles);assert.ok(t!==null);
 const at=u=>({...a,x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,z:a.z+(b.z-a.z)*u});
 const smallFrom=at(t-1e-5),smallTo=at(t+1e-5),small=h.context.coastBridgeSideContact(isolated,smallFrom,smallTo);
 assert.ok(small);assert.ok(Math.abs(small.t-.5)<.001,'0.2mm movement (0.012m/s at60Hz) still has a real finite-face contact');
 const overlapped=at(t+1e-5);assert.equal(h.context.coastBridgeSideContact(isolated,overlapped,overlapped),null,'resting contact must not re-hit');assert.equal(h.context.coastBridgeSideContact(isolated,overlapped,at(t-.01)),null,'initial shallow overlap opening must recover without a new impact');assert.equal(h.context.coastBridgeSideContact(isolated,overlapped,at(t+.01))?.t,0,'closing initial overlap remains a real contact');
 const matrix=new w.T.Matrix4().makeRotationFromEuler(new w.T.Euler(a.pitch,a.yaw,a.roll,'YXZ')),vertices=[];
 for(const x of[w.localBox.min.x,w.localBox.max.x])for(const y of[w.localBox.min.y,w.localBox.max.y])for(const z of[w.localBox.min.z,w.localBox.max.z])vertices.push(new w.T.Vector3(x,y,z).applyMatrix4(matrix));
 const tangentMin=Math.min(...vertices.map(v=>v.x*m.tx+v.z*m.tz)),endShift=m.length/2-tangentMin+.001;
 for(const shift of[endShift,endShift-.025]){const from={...a,x:a.x+m.tx*shift,z:a.z+m.tz*shift},to={...b,x:b.x+m.tx*shift,z:b.z+m.tz*shift},expected=oracle(from,to,triangles),hit=h.context.coastBridgeSideContact(isolated,from,to);if(shift===endShift)assert.equal(expected,null,'whole OBB misses the ACTUAL finite endpoint by1mm');else assert.ok(expected!==null,'finite endpoint grazing is a real collision, not an infinite-plane test');if(expected===null)assert.equal(hit,null);else{assert.ok(hit);assert.ok(Math.abs(hit.t-expected)<2e-6);assert.ok(hit.depth<1e-6);}}
 const minY=Math.min(...triangles.flatMap(t=>[t.a.y,t.b.y,t.c.y])),maxY=Math.max(...triangles.flatMap(t=>[t.a.y,t.b.y,t.c.y])),bodyMin=Math.min(...vertices.map(v=>v.y)),bodyMax=Math.max(...vertices.map(v=>v.y));
 for(const y of[minY-bodyMax-.001,maxY-bodyMin+.001]){const from={...a,y},to={...b,y};assert.equal(oracle(from,to,triangles),null,'whole oriented body clears the real finite vertical range by1mm');assert.equal(h.context.coastBridgeSideContact(isolated,from,to),null);}
});

test('vertical motion distinguishes a real outer finite-quad shared edge from bridge-interior bottom policy',{skip:!nativeAvailable},()=>{
 const h=direct(),w=native(),m=faceCenter(0),[a]=path(0,{yaw:.7,pitch:.25,roll:-.15}),matrix=new w.T.Matrix4().makeRotationFromEuler(new w.T.Euler(a.pitch,a.yaw,a.roll,'YXZ')),vertices=[];for(const x of[w.localBox.min.x,w.localBox.max.x])for(const y of[w.localBox.min.y,w.localBox.max.y])for(const z of[w.localBox.min.z,w.localBox.max.z])vertices.push(new w.T.Vector3(x,y,z).applyMatrix4(matrix));
 const inward=Math.min(...vertices.map(v=>v.x*m.nx+v.z*m.nz)),outer={...a,x:m.x+m.nx*(-inward-.15),z:m.z+m.nz*(-inward-.15),y:a.y-6},up={...outer,y:a.y+6},expected=oracle(outer,up,w.faces(109)),hit=h.context.coastBridgeSideContact(isolated,outer,up);
 assert.ok(expected!==null,'the oriented OUTER corner really meets a rendered finite side shared lower edge');assert.ok(hit);assert.ok(Math.abs(hit.t-expected)<2e-6);
 const inner={...outer,x:m.x-m.nx*5,z:m.z-m.nz*5},innerUp={...inner,y:up.y};assert.equal(oracle(inner,innerUp,w.faces(109)),null);assert.equal(h.context.coastBridgeSideContact(isolated,inner,innerUp),null,'do not invent interior underside/top collision planes');
});
function lateStart(axis){
 const w=native(),m=faceCenter(0),yaw=axis==='pitch'?Math.atan2(m.nx,m.nz):Math.atan2(-m.tx,-m.tz),angles={pitch:0,yaw,roll:0},rotation=new w.T.Matrix4().makeRotationFromEuler(new w.T.Euler(0,yaw,0,'YXZ')),corners=[];
 for(const x of[w.localBox.min.x,w.localBox.max.x])for(const y of[w.localBox.min.y,w.localBox.max.y])for(const z of[w.localBox.min.z,w.localBox.max.z])corners.push(new w.T.Vector3(x,y,z).applyMatrix4(rotation));const support=Math.min(...corners.map(v=>v.x*m.nx+v.z*m.nz)),distance=-support+.002;
 return{x:m.x+m.nx*distance,y:m.y+.35-1.5,z:m.z+m.nz*distance,...angles,speed:0,vx:0,vy:0,vz:0,wasAirborne:true,airRemaining:10};
}
for(const fps of[30,60,144])for(const axis of['yaw','pitch','roll'])test(`actual paid ${axis} RCS late full-attitude side response preserves tangent velocity at${fps}Hz`,{skip:!nativeAvailable},()=>{
 const input=axis==='yaw'?{KeyA:true}:axis==='pitch'?{KeyK:true}:{KeyL:true},r=motion(lateStart(axis),{fps,seconds:.5,keys:()=>input});
 assert.equal(r.firstInside,null);assert.equal(native().inside(r.last,r.h),null,'late-RCS actual contact-row rollback does not leave visible vertices inside slab');assert.equal(r.h.impacts.length,1,'a real late attitude collision, not only a query hook');
 const record=r.damageRecords[0],q=record.query;assert.ok(q);assert.equal(q.from.x,q.to.x);assert.equal(q.from.y,q.to.y);assert.equal(q.from.z,q.to.z,'this is the actual AFTER-translation pure-attitude segment');
 assert.ok(Math.abs(q.from[axis==='yaw'?'yaw':axis==='pitch'?'pitch':'roll']-q.to[axis==='yaw'?'yaw':axis==='pitch'?'pitch':'roll'])>0);assert.ok(q.stateBefore.airRemaining<10,'real RCS tank burn');
 const{normal:n,angularClosingPerFraction:angular}=q.hit,dt=1/fps,before=q.stateBefore,after=record.beforeDamage,dot=v=>v.vx*n.x+v.vy*n.y+v.vz*n.z,inward=dot(before)-angular/dt,impact=Math.max(0,-inward);assert.ok(impact>0);assert.ok(Math.abs(record.args[0]-impact)<1e-8);assert.ok(Math.abs(dot(after)-(dot(before)+1.25*impact))<1e-7,'existing normal response law, including actual angular-feature closing');
 for(const k of['x','y','z']){const key='v'+k,change=after[key]-before[key];assert.ok(Math.abs(change-1.25*impact*n[k])<1e-7,'no spurious tangent impulse or energy');}assert.equal(after.vYaw,0);assert.equal(after.vPitch,0);assert.equal(after.vRoll,0);
});

// Controlled candidate adapters verify production phase ordering, NOT invented
// map geometry. Real side/pier geometry is covered independently above/elsewhere.
function arbitration({old=false,late=false,sideT=.2,pierT=.8}={}){
 const h=motionHarness({x:200,y:60,z:200,pitch:0,yaw:0,roll:0,speed:Math.hypot(10,5),vx:-10,vy:0,vz:-5,wasAirborne:true,airRemaining:10},'coast',{'physics-main.js':old?oldPhysics:physics}),records=[];
 const pier=()=>({kind:'pier',t:pierT,normal:{x:0,y:0,z:1},depth:0,angularClosingPerFraction:late?.02:0});
 const network={...n,sweepStructures:()=>late?null:pier(),sweepPiers:()=>late?pier():null};h.context.window.RoadsterCoast={...coast,network};h.context.sound.playCrash=()=>{};h.context.destroyVehicle=()=>h.state.isDestroyed=true;
 let sideCalls=0,incoming=null;h.context.coastBridgeSideContact=(world,from,to)=>{const same=from.x===to.x&&from.y===to.y&&from.z===to.z;if(same!==late)return null;if(late&&sideCalls++)return null;incoming={...h.state};return{kind:'bridge-side',t:sideT,normal:{x:1,y:0,z:0},depth:0,angularClosingPerFraction:late?.03:0};};
 vm.runInContext('Math.random=()=>.5;\n'+damage,h.context);const real=h.context.triggerPhysicsCollision;h.context.triggerPhysicsCollision=(...args)=>{records.push({args,state:{...h.state}});real(...args);};if(late)h.keys.KeyA=true;h.step(1/60);return{state:{...h.state},records,incoming};
}
for(const late of[false,true])for(const[name,sideT,pierT]of[['side before old pier',.2,.8],['old pier before side',.8,.2],['exact tie retains old pier',.5,.5]])test(`production ${late?'late attitude':'early translation'} candidate TOI ordering: ${name}`,()=>{
 const r=arbitration({late,sideT,pierT});assert.equal(r.records.length,1,'resolve the earliest candidate, not both obsolete full trajectories');
 if(sideT<pierT){assert.ok(r.incoming);assert.ok(Math.abs(r.records[0].state.vz-r.incoming.vz)<1e-12,'side-normal response, not the later pier normal');assert.ok(r.records[0].state.vx>r.incoming.vx);}
 else{const old=arbitration({old:true,late,sideT,pierT});assert.deepEqual(structuredClone(r.records),structuredClone(old.records),'earlier/tied pier executes its unchanged production path');assert.deepEqual(structuredClone(r.state),structuredClone(old.state),'old-pier winner preserves all state fields/fuel/damage');}
});
// A finite axis-aligned diagnostic quad and the EXISTING no-native fallback
// collider isolate a certified fixed separating axis; no game asset is changed.
test('normal-axis rotation preserves a real0.2-micrometre gap without exhausting CCD interval certificates',t=>{
 const h=motionHarness({},'coast'),a={x:-8,y:10,z:-100},b={x:-8,y:10,z:100},row=z=>[0,-4,-8,-12,-16].map(x=>({x,y:10,z})),world={network:{segments:[{bridge:true,a,b,rows:[row(-100),row(100)]}],SLAB_DEPTH:.7}},from={x:.9800002,y:8.8,z:0,pitch:0,yaw:0,roll:0},to={...from,pitch:.02};
 assert.ok(from.x-.98>1e-7,'rotation around X leaves every fallback-box X coordinate unchanged and strictly outside the contact tolerance');const start=performance.now();assert.equal(h.context.coastBridgeSideContact(world,from,to),null);t.diagnostic(`certified near-parallel null in${(performance.now()-start).toFixed(3)}ms (informational, no brittle wall-clock assertion)`);
});

// CPU-only cache/optimization contracts. Use the unchanged fallback body in
// BOTH query versions; native geometry/contact-row regressions remain above.
function cpuSideFrame(ordinal,edge){
 const segment=bridgeSegments[ordinal],a=segment.rows[0][edge],b=segment.rows[1][edge];let nx=b.z-a.z,nz=a.x-b.x;const length=Math.hypot(nx,nz),sign=((a.x+b.x-segment.a.x-segment.b.x)*nx+(a.z+b.z-segment.a.z-segment.b.z)*nz)<0?-1:1;
 return{x:(a.x+b.x)/2,y:(a.y+b.y)/2-.975,z:(a.z+b.z)/2,nx:nx*sign/length,nz:nz*sign/length,tx:(b.x-a.x)/length,tz:(b.z-a.z)/length};
}
function cpuSidePath(ordinal,edge,angles={yaw:0,pitch:0,roll:0},nextAngles=angles,fromDistance=6,toDistance=-4){const m=cpuSideFrame(ordinal,edge),at=(d,a)=>({x:m.x+m.nx*d,y:m.y,z:m.z+m.nz*d,pitch:0,yaw:0,roll:0,...a});return[at(fromDistance,angles),at(toDistance,nextAngles)];}
function cacheData(h){return vm.runInContext('({network:coastBridgeSideNetwork,grid:coastBridgeSideGrid,segments:coastBridgeSideSegments,faces:coastBridgeSideFaces})',h.context);}
test('lazy side cache indexes602 actual faces numerically, builds only nearby quads, reuses them and clears on world replacement',()=>{
 const h=motionHarness({},'coast'),query=h.context.coastBridgeSideContact,center=n.sampleRoute(0,3800,0),pose={x:center.x,y:center.y,z:center.z,pitch:0,yaw:0,roll:0};assert.equal(bridgeSegments.length*2,602);
 for(let i=0;i<8;i++)assert.equal(query(coast,pose,{...pose,z:pose.z+i*.01}),null);
 let data=cacheData(h);assert.equal(data.network,n);assert.equal(data.segments.length,301);assert.equal(data.faces.size,0,'central driving must not eagerly materialize any of602 quads');
 const numericCodes=[...data.grid.values()].flat();assert.ok(numericCodes.every(code=>Number.isInteger(code)&&code>=0&&code<602));assert.equal(new Set(numericCodes).size,602,'the complete spatial index contains every real side, but only numeric codes');
 const[from,to]=cpuSidePath(109,0);assert.ok(query(coast,from,to));data=cacheData(h);assert.ok(data.faces.size>0&&data.faces.size<602,'only geometrically nearby faces become SAT quads');const oldFaces=data.faces,entries=[...oldFaces];
 for(let i=0;i<12;i++)assert.ok(query(coast,from,to));assert.equal(cacheData(h).faces,oldFaces);assert.equal(oldFaces.size,entries.length);for(const[code,face]of entries)assert.equal(oldFaces.get(code),face,'repeat queries reuse the exact bounded cached quad');
 const replacement={...coast,network:{...n}};assert.equal(query(replacement,pose,pose),null);data=cacheData(h);assert.equal(data.network,replacement.network);assert.notEqual(data.faces,oldFaces);assert.equal(data.faces.size,0,'valid replacement world drops all previously materialized face cache entries');assert.equal(new Set([...data.grid.values()].flat()).size,602);
});
test('lazy rotational-radius broadphase preserves complete eager Ada query values across196 real-face YXZ/chord cases',()=>{
 const h=motionHarness({},'coast'),fixture=read('tests/fixtures/coast-bridge-side-baseline/eager-side-query.js'),eager=vm.runInContext('(()=>{'+fixture+';return coastBridgeSideContact;})()',h.context),query=h.context.coastBridgeSideContact;assert.equal(createHash('sha256').update(fixture).digest('hex'),'2c3945015d03b3272c0bcb2e3b94d27eae846c9ba35c8bf8aea0decb6d4d7567','exact eager Ada side query fixture, not9414 no-side code');
 let count=0,hits=0,misses=0;const check=(label,from,to,mustHit=false)=>{const expected=eager(coast,from,to),actual=query(coast,from,to);assert.deepEqual(structuredClone(actual),structuredClone(expected),label+' preserves every numeric result field/TOI/normal/pose/quad/depth/angular closing');if(expected)hits++;else misses++;if(mustHit)assert.ok(expected,label+' is a real eager finite-face contact, not vacuous null parity');count++;return expected;};
 const ordinals=[0,37,109,153,220,bridgeSegments.length-1],angles=[{yaw:0},{yaw:Math.PI/4},{yaw:Math.PI/2},{yaw:-Math.PI/2},{yaw:Math.PI,pitch:.35,roll:-.4},{yaw:.7,pitch:1.15,roll:.85}],rotations=[[{yaw:0},{yaw:1.4}],[{yaw:.6,pitch:-.65,roll:.8},{yaw:1.8,pitch:.9,roll:-.5}],[{yaw:Math.PI-.25},{yaw:-Math.PI+.3}],[{yaw:-Math.PI+.25},{yaw:Math.PI-.3}],[{yaw:1,pitch:.2,roll:0},{yaw:1,pitch:.2,roll:2.2}],[{yaw:-.4,pitch:-.7,roll:1.5},{yaw:.2,pitch:-.3,roll:1.8}]];
 for(const ordinal of ordinals)for(const edge of[0,4]){
  for(const a of angles)check(`constant pose segment${ordinal} edge${edge}`, ...cpuSidePath(ordinal,edge,a));
  for(const[a,b]of rotations)check(`rotating pose segment${ordinal} edge${edge}`, ...cpuSidePath(ordinal,edge,a,b));
  const[from,to]=cpuSidePath(ordinal,edge,{yaw:.7,pitch:.25,roll:-.15}),m=cpuSideFrame(ordinal,edge);
  for(const shift of[-12,12])check(`clear vertical offset${shift} segment${ordinal} edge${edge}`,{...from,y:from.y+shift},{...to,y:to.y+shift});check(`moving away segment${ordinal} edge${edge}`,from,{...from,x:from.x+m.nx*4,z:from.z+m.nz*4});
 }
 for(const ordinal of[109,220])for(const edge of[0,4]){
  const m=cpuSideFrame(ordinal,edge),yaw=Math.atan2(-m.tx,-m.tz),middle={x:m.x+m.nx*1.7,y:m.y,z:m.z+m.nz*1.7,pitch:0,yaw,roll:0},end={...middle,yaw:yaw+Math.PI};
  const endpointRadius=a=>.98*Math.abs(Math.cos(a)*m.nx-Math.sin(a)*m.nz)+2.31*Math.abs(Math.sin(a)*m.nx+Math.cos(a)*m.nz);assert.ok(endpointRadius(yaw)<1.7&&endpointRadius(end.yaw)<1.7,'both endpoint fallback OBBs are clear of this side plane');check(`rotation-only middle contact with clear endpoints segment${ordinal} edge${edge}`,middle,end,true);
  const[cellFrom,cellTo]=cpuSidePath(ordinal,edge,{yaw:.7,pitch:.25,roll:-.15},undefined,160,-160);assert.ok(Math.abs(Math.floor(cellFrom.x/64)-Math.floor(cellTo.x/64))>=2||Math.abs(Math.floor(cellFrom.z/64)-Math.floor(cellTo.z/64))>=2,'actual chord crosses multiple64m grid cells');assert.ok(Math.hypot(cellTo.x-cellFrom.x,cellTo.z-cellFrom.z)>120,'whole swept high-speed path exceeds120m, not merely a moderate endpoint overlap');check(`multi64m-cell chord segment${ordinal} edge${edge}`,cellFrom,cellTo,true);
  const[fastFrom,fastTo]=cpuSidePath(ordinal,edge,{yaw:.7,pitch:.25,roll:-.15},undefined,12,-12),hit=check(`whole-body endpoints clear but high-speed chord crosses side segment${ordinal} edge${edge}`,fastFrom,fastTo,true),at=t=>({...fastFrom,x:fastFrom.x+(fastTo.x-fastFrom.x)*t,y:fastFrom.y+(fastTo.y-fastFrom.y)*t,z:fastFrom.z+(fastTo.z-fastFrom.z)*t});const shortFrom=at(hit.t-.0001/24),shortTo=at(hit.t+.0001/24);assert.ok(Math.abs(Math.hypot(shortTo.x-shortFrom.x,shortTo.y-shortFrom.y,shortTo.z-shortFrom.z)-.0002)<1e-9,'strict0.2mm chord');check(`0.2mm near-TOI chord segment${ordinal} edge${edge}`,shortFrom,shortTo,true);
 }
 assert.equal(count,196);assert.ok(hits>40);assert.ok(misses>=24,'include substantial negative geometry parity, not only easy impacts');
});
