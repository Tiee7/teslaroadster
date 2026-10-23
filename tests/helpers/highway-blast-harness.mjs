// CPU production force/blast/aftermath/reset/contact blocks. No rendering/GPU.
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {motionHarness} from './motion-harness.mjs';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
export const physics=read('src/physics-main.js'),oldPhysics=read('tests/fixtures/highway-blast-height-baseline/physics-main.js');
const hud=read('src/ui-hud.js');
const part=(s,a,b)=>{assert.equal(s.split(a).length,2,a);const i=s.indexOf(a),j=s.indexOf(b,i+a.length);assert.ok(j>i,b);return s.slice(i,j);};
export const runtimePath=process.env.ROADSTER_THREE_RUNTIME||'/tmp/roadster-three.min.js';
export const nativeAvailable=existsSync(runtimePath);
let nativeCache;
export function nativeAssets(){
 if(nativeCache)return nativeCache;assert.ok(nativeAvailable,'native r128 is required');
 const c=vm.createContext({atob:t=>Buffer.from(t,'base64').toString('binary'),window:{innerWidth:1440,innerHeight:900,addEventListener(){},dispatchEvent(){}},Event:class{},localStorage:{getItem:()=>null,setItem(){}},document:{createElement:()=>({getContext:()=>({})})}});
 vm.runInContext(readFileSync(runtimePath,'utf8'),c);assert.equal(c.THREE.REVISION,'128');
 vm.runInContext(`const scene=new THREE.Scene();let currentMap='highway';const WORLD_SPEED_SCALE=1.65;${part(read('src/world.js'),'const bodyMaterial =','const highwayEnvGroup')}`,c);
 for(const f of['highway-traffic','vehicles','reference-exterior','reference-cockpit','npc-traffic-assets','reference-traffic'])vm.runInContext(read('src/'+f+'.js'),c,{filename:f});
 const vehicle=c.window.RoadsterVehicle;vehicle.setModel('reference');vehicle.setCockpit('reference');const model=vehicle.getPreviewModel();
 function points(mesh){mesh.updateMatrixWorld(true);const out=[];mesh.traverseVisible(p=>{if(!p.geometry||p.userData.shadowProxy)return;const mats=Array.isArray(p.material)?p.material:[p.material];if(mats.every(m=>!m||m.visible===false||m.colorWrite===false||m.transparent&&m.opacity===0))return;const g=p.geometry,a=g.attributes.position,ix=g.index,start=g.drawRange.start,end=Math.min(ix?.count??a.count,start+g.drawRange.count),ids=new Set();const add=(lo,hi)=>{for(let j=Math.max(start,lo);j<Math.min(end,hi);j++)ids.add(ix?ix.getX(j):j);};if(Array.isArray(p.material)){for(const group of g.groups)if(mats[group.materialIndex]?.visible!==false)add(group.start,group.start+group.count);}else add(0,end);for(const i of ids)out.push(new c.THREE.Vector3().fromBufferAttribute(a,i).applyMatrix4(p.matrixWorld));});return out;}
 const variants=c.window.RoadsterTrafficAssets.variants.map(v=>v.id),npcs=new Map();
 for(const variant of variants){c.selectedVariant=variant;const mesh=vm.runInContext('createTrafficVehicleMesh(0,selectedVariant)',c),bounds=c.window.RoadsterTrafficAssets.cityContactBounds(mesh),far=points(mesh);c.window.RoadsterTrafficAssets.updateLods([{mesh}],{x:0,y:0,z:0});const near=points(mesh);assert.ok(near.length>far.length);npcs.set(variant,{mesh,bounds,far,near});}
 return nativeCache={T:c.THREE,vehicle,model,points,playerPoints:points(model),variants,npcs};
}
export function highwayRun({fps=60,delay=.2,distance=5,seed=20261022,old=false,seconds=3.4,variant=null,native=true,blast=true,reset=true,initial={},carInitial={},keys={KeyW:true,Semicolon:true}}={}){
 const assets=native?nativeAssets():null,selected=variant||assets?.variants[0],bounds=assets?.npcs.get(selected)?.bounds;
 const car={mode:'highway',laneIdx:3,targetX:2.5,speed:20,desiredSpeed:20,length:4.62,width:2.03,height:1.25,vx:0,vz:-20,y:0,blastTimer:0,mesh:{position:{x:2.5,y:0,z:-distance},rotation:{x:0,y:0,z:0},visible:true,userData:{wheels:[],...(bounds?{cityContactBounds:bounds}:{})}},...carInitial};
 const text=old?oldPhysics:physics,h=motionHarness({x:2.5,y:0,z:0,speed:42,vz:-42,isDestroyed:false,...initial},'highway',{'physics-main.js':text});
 const el={style:{},classList:{add(){},remove(){},toggle(){}},textContent:''};
 Object.assign(h.context,{trafficCars:[car],scrollingProps:[],debrisPieces:[],clearDebris(){},renderBannerText(){},spawnExplosionEffect(){},spawnDestructionDebris(){},updateDestroyedModalText(){},hoverRingMat:{opacity:0},cityOwnsDrivingSound:()=>false,coastOwnsDrivingSound:()=>false,document:{getElementById:()=>el},carMeshGroup:{visible:true},captureContact:()=>{}});
 Object.assign(h.context.sound,{beep(){},update(){},playCrash(){}});
 if(assets){h.context.window.RoadsterVehicle=assets.vehicle;h.context.THREE.Box3=assets.T.Box3;}
 const traffic=part(text,"  if (currentMap === 'highway') {\n    highwayTraffic.step",'  // Render the resolved pose');
 const death=part(text,'  if (state.isDestroyed) {\n    if (typeof clearThrusterVisuals','  const scoreMotionStart =');
 const program=`Math.random=()=>{globalThis.rng=(Math.imul(globalThis.rng,1664525)+1013904223)>>>0;return globalThis.rng/2**32};\n${read('src/highway-traffic.js')}\n${part(text,'function applyExplosionBlastToTraffic(','function spawnDestructionDebris(')}\n${part(text,'function triggerPhysicsCollision(','function updateDestroyedScores(')}\n${part(hud,'function resetCar() {','function applyTranslations() {')}\nfunction aftermath(dt){const t=I18N[currentLang];${death}}\nfunction trafficFrame(dt,isAirborne){const playerWorldZ=0,demoGroundSweep=null;${traffic.replace('    if (bodyOverlap || demoSweptHit) {','    if (bodyOverlap || demoSweptHit) {captureContact(car);')}}\nglobalThis.ops={crash:()=>triggerPhysicsCollision(30,'crashReasonThreshold'),reset:resetCar,aftermath,trafficFrame};`;
 vm.runInContext(program,h.context);
 h.context.rng=seed;
 const cloneCar=()=>JSON.parse(JSON.stringify(car));
 if(blast){h.context.ops.crash();assert.equal(h.state.isDestroyed,true);assert.equal(car.blastTimer,3.2);}
 const blasted=cloneCar();for(let frame=0;frame<Math.round(delay*fps);frame++)h.context.ops.aftermath(1/fps);
 if(reset)h.context.ops.reset();Object.assign(h.keys,keys);
 const start=cloneCar(),rows=[],contacts=[];h.context.captureContact=()=>contacts.push({frame:rows.length,state:JSON.parse(JSON.stringify(h.state)),car:cloneCar()});
 const trigger=h.context.triggerPhysicsCollision;h.context.triggerPhysicsCollision=(...args)=>{h.impacts.push(args);return trigger(...args);};
 for(let frame=0;frame<Math.ceil(fps*seconds)&&!h.state.isDestroyed;frame++){
  h.state.impactCooldown=Math.max(0,h.state.impactCooldown-1/fps);const result=h.step(1/fps);h.context.ops.trafficFrame(1/fps,result.isAirborne);rows.push({frame,t:(frame+1)/fps,state:JSON.parse(JSON.stringify(h.state)),car:cloneCar(),impacts:[...h.impacts]});if(h.impacts.length)break;
 }
 return{h,car,blasted,start,rows,contacts,variant:selected};
}
