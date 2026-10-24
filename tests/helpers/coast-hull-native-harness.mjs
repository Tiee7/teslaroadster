// CPU-only production motion + actual r128 scene geometry. No WebGL/GPU claim.
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import vm from 'node:vm';
import {motionHarness} from './motion-harness.mjs';

export const runtimePath = process.env.ROADSTER_THREE_RUNTIME || '/tmp/roadster-three.min.js';
export const nativeAvailable = existsSync(runtimePath);
const read = name => readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8');
export const physics = read('src/physics-main.js');
export const oldPhysics = read('tests/fixtures/coast-hull-contact-baseline/physics-main.js');
const source = Object.fromEntries(['config.js','driving-score.js','coast-road-network.js','coast-map.js',
  'world.js','highway-traffic.js','vehicles.js','reference-exterior.js','reference-cockpit.js']
  .map(name => [name, read(`src/${name}`)]));
source['physics-main.js'] = physics;
function section(text, from, to) {
  assert.equal(text.split(from).length, 2, `unique extraction: ${from}`);
  const start = text.indexOf(from), end = text.indexOf(to, start + from.length);
  assert.ok(end > start, `extraction end: ${to}`);
  return text.slice(start, end);
}
const pose = section(physics, '  // Render the resolved pose after traffic contact (which can change state.y).', '  RoadsterDrivingScore.segment');
const cockpit = section(physics, '    // Requirement 7: Rock-solid Cockpit FPV Camera', "  } else if (currentMap === 'highway')");
const suspension = section(physics, '  // 2nd-order critically damped suspension recovery:', '  // Dynamic Tire Drift Smoke Puffs');
for (const [from,to,part] of [
  ['  // Render the resolved pose after traffic contact (which can change state.y).','  RoadsterDrivingScore.segment',pose],
  ['    // Requirement 7: Rock-solid Cockpit FPV Camera',"  } else if (currentMap === 'highway')",cockpit],
  ['  // 2nd-order critically damped suspension recovery:','  // Dynamic Tire Drift Smoke Puffs',suspension]
]) assert.equal(section(oldPhysics,from,to),part,'counterfactual retains the identical presentation');

function hull2(points, u, v) {
  const sorted = [...points].sort((a,b) => a[u]-b[u] || a[v]-b[v]);
  const unique = sorted.filter((p,i) => !i || p[u]!==sorted[i-1][u] || p[v]!==sorted[i-1][v]);
  const cross = (a,b,c) => (b[u]-a[u])*(c[v]-a[v])-(b[v]-a[v])*(c[u]-a[u]);
  const half = list => { const out=[]; for (const p of list) { while(out.length>1 && cross(out.at(-2),out.at(-1),p)<=0) out.pop(); out.push(p); } return out; };
  return [...half(unique).slice(0,-1),...half([...unique].reverse()).slice(0,-1)];
}
let cached;
export function nativeWorld() {
  assert.ok(nativeAvailable, 'official r128 runtime required');
  if (cached) return cached;
  const context = vm.createContext({console, window:{innerWidth:1440,innerHeight:900,addEventListener(){},dispatchEvent(){}},
    Event:class{}, localStorage:{getItem:()=>null,setItem(){}}, document:{createElement:()=>({getContext:()=>({})})}});
  vm.runInContext(readFileSync(runtimePath,'utf8'),context);
  const T=context.THREE;
  assert.equal(T.REVISION,'128');
  vm.runInContext(source['coast-road-network.js']+'\n'+source['coast-map.js'],context);
  const mats=section(source['world.js'],'const bodyMaterial =','const highwayEnvGroup');
  vm.runInContext(`const scene=new THREE.Scene();let currentMap='coast';const WORLD_SPEED_SCALE=1.65;${mats}`,context);
  for(const name of ['highway-traffic.js','vehicles.js','reference-exterior.js','reference-cockpit.js']) vm.runInContext(source[name],context,{filename:name});
  const vehicle=context.window.RoadsterVehicle;
  vehicle.setModel('reference'); vehicle.setCockpit('reference');
  const model=vehicle.getPreviewModel(); model.updateMatrixWorld(true);
  const points=[],draws=m=>m&&m.visible!==false&&m.colorWrite!==false&&!(m.transparent&&m.opacity===0);
  model.traverseVisible(part=>{
    if(!part.geometry||part.userData.shadowProxy)return;
    const g=part.geometry,p=g.attributes.position,ix=g.index,total=ix?.count??p.count;
    const start=g.drawRange.start,end=Math.min(total,start+g.drawRange.count),ids=new Set();
    const add=(lo,hi)=>{for(let i=Math.max(start,lo);i<Math.min(end,hi);i++)ids.add(ix?ix.getX(i):i);};
    if(Array.isArray(part.material)){for(const group of g.groups)if(draws(part.material[group.materialIndex]))add(group.start,group.start+group.count);}
    else if(draws(part.material))add(0,total);
    for(const i of ids){const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(part.matrixWorld);points.push({x:v.x,y:v.y,z:v.z,name:part.name});}
  });
  assert.ok(points.length>1000,'actual neutral model, not an invented box');
  const xy=hull2(points,'x','y'),yz=hull2(points,'y','z');
  const coast=context.window.RoadsterCoast, scene=new T.Scene(), root=coast.enter(scene,T);
  scene.updateMatrixWorld(true);
  const names=['coast-inland-ground','coast-road-surfaces','coast-road-earth-banks','coast-sand','coast-promenade','coast-pier-boardwalk'];
  const meshes=names.map(name=>{const m=root.getObjectByName(name);assert.ok(m?.isMesh&&!m.isInstancedMesh,name);return m;});
  const grid=new Map(),triangles=[],cell=(x,z)=>`${Math.floor(x/64)},${Math.floor(z/64)}`;
  for(const mesh of meshes){
    for(let a=mesh;a;a=a.parent)assert.notEqual(a.visible,false);
    assert.ok(!Array.isArray(mesh.material)&&mesh.material.visible&&mesh.material.opacity>0);
    const g=mesh.geometry,p=g.attributes.position,ix=g.index,start=g.drawRange.start,end=Math.min(ix?.count??p.count,start+g.drawRange.count);
    for(let i=start;i+2<end;i+=3){
      const [a,b,c]=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(p,ix?ix.getX(i+k):i+k).applyMatrix4(mesh.matrixWorld));
      const den=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);
      if(Math.abs(den)<1e-12)continue;
      const t={a,b,c,den,mesh:mesh.name,index:triangles.length,minX:Math.min(a.x,b.x,c.x),maxX:Math.max(a.x,b.x,c.x),minZ:Math.min(a.z,b.z,c.z),maxZ:Math.max(a.z,b.z,c.z)};
      triangles.push(t);
      for(let x=Math.floor(t.minX/64);x<=Math.floor(t.maxX/64);x++)for(let z=Math.floor(t.minZ/64);z<=Math.floor(t.maxZ/64);z++){
        const key=`${x},${z}`;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(t);
      }
    }
  }
  // Independent of network.heightInTriangle/terrainSupport/candidates.
  function tops(x,z){const out=[];for(const t of grid.get(cell(x,z))||[]){
    if(x<t.minX-1e-5||x>t.maxX+1e-5||z<t.minZ-1e-5||z>t.maxZ+1e-5)continue;
    const u=((t.b.z-t.c.z)*(x-t.c.x)+(t.c.x-t.b.x)*(z-t.c.z))/t.den;
    const v=((t.c.z-t.a.z)*(x-t.c.x)+(t.a.x-t.c.x)*(z-t.c.z))/t.den,w=1-u-v;
    if(Math.min(u,v,w)>=-1e-7)out.push({height:u*t.a.y+v*t.b.y+w*t.c.y,mesh:t.mesh,triangle:t.index});
  }return out.sort((a,b)=>b.height-a.height);}
  function floor(point,target){const match=tops(point.x,point.z).sort((a,b)=>Math.abs(a.height-target)-Math.abs(b.height-target))[0];assert.ok(match,'actual rendered finite floor exists');return match;}
  vm.runInContext(`const camera=new THREE.PerspectiveCamera(60,16/9,.08,4500);
    globalThis.hullPresentation={suspend(state,isAirborne,dt){${suspension}},pose(state,isAirborne){
      const playerWorldZ=state.z,groundElevation=0,isAccelerating=false,isRearThrusterFiring=false,isFootBraking=false,isReversing=false;
      ${pose} camera.up.set(0,1,0); ${cockpit}
      camera.near=.08;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
      return {eye:camera.position.clone(),near:[[-1,-1],[1,-1],[-1,1],[1,1]].map(([x,y])=>new THREE.Vector3(x,y,-1).unproject(camera)),
        matrix:roadsterAttitudeGroup.matrixWorld.clone()};}};`,context);
  function lowest(matrix,full=false){
    const e=matrix.elements,list=full?points:e[9]===0?xy:e[1]===0?yz:points;let chosen=null,min=Infinity;
    for(const p of list){const y=e[1]*p.x+e[5]*p.y+e[9]*p.z+e[13];if(y<min){min=y;chosen=p;}}
    const q=new T.Vector3(chosen.x,chosen.y,chosen.z).applyMatrix4(matrix);return {...q,name:chosen.name};
  }
  function makeRun(initial={},bounds='native',text=physics){
    const h=motionHarness(initial,'coast',{...source,'physics-main.js':text});
    h.context.window.RoadsterCoast=coast;
    if(bounds==='native'){h.context.THREE.Box3=T.Box3;h.context.window.RoadsterVehicle=vehicle;}
    const impactFuel=[],trigger=h.context.triggerPhysicsCollision;
    h.context.triggerPhysicsCollision=(...args)=>{impactFuel.push(h.state.airRemaining);trigger(...args);};
    let resets=0;h.context.resetCar=()=>resets++;
    return {...h,impactFuel,get resets(){return resets;}};
  }
  function measure(h,result,dt,target){
    context.hullPresentation.suspend(h.state,result.isAirborne,dt);
    const view=context.hullPresentation.pose(h.state,result.isAirborne),vertex=lowest(view.matrix);
    return {root:h.state.y-floor(h.state,target).height,eye:view.eye.y-floor(view.eye,target).height,
      near:Math.min(...view.near.map(p=>p.y-floor(p,target).height)),vertex:vertex.y-floor(vertex,target).height,
      vertexWitness:vertex};
  }
  function natural({lift=.8,key=null,attitude=0,bounds='native',text=physics}={}){
    const p=coast.network.sampleRoute(1,400,0),initial={x:p.x,y:p.y,z:p.z,yaw:p.yaw,pitch:p.pitch,roll:p.roll,
      speed:0,vx:0,vy:0,vz:0,wasAirborne:false,coastSupportId:p.supportId,airRemaining:10};
    const h=makeRun(initial,bounds,text),history=[];let airborne=false,landedAt=null;
    for(let frame=0;frame<480;frame++){
      h.keys.Space=frame/60<lift;if(key)h.keys[key]=frame/60<attitude;
      const result=h.step(1/60),clearance=measure(h,result,1/60,p.y);
      const row={frame,t:(frame+1)/60,y:h.state.y,air:h.state.airRemaining,wasAirborne:h.state.wasAirborne,
        pitch:h.state.pitch,roll:h.state.roll,impacts:h.impacts.length,...clearance};history.push(row);
      if(h.state.wasAirborne)airborne=true;
      if(airborne&&!h.state.wasAirborne&&h.state.coastSupportId){landedAt=row.t;if(frame/60>Math.max(lift,attitude))break;}
      if(h.impacts.length||h.resets)break;
    }
    return {h,history,airborne,landedAt,peak:Math.max(...history.map(r=>r.y)),minEye:Math.min(...history.map(r=>r.eye)),
      minNear:Math.min(...history.map(r=>r.near)),minVertex:Math.min(...history.map(r=>r.vertex)),minRoot:Math.min(...history.map(r=>r.root))};
  }
  cached={T,coast,root,meshes,triangles,tops,floor,points,projectionHulls:{xy:xy.length,yz:yz.length},lowest,makeRun,measure,natural};
  return cached;
}
