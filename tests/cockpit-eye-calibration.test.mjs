import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,existsSync} from 'node:fs';
const read=n=>readFileSync(new URL(`../src/${n}`,import.meta.url),'utf8');
const runtime=process.env.ROADSTER_THREE_RUNTIME||'/tmp/roadster-three.min.js';
function fixture(){
 const context=vm.createContext({console,Math,Float32Array,Uint16Array,Uint32Array,atob:s=>Buffer.from(s,'base64').toString('binary'),Event:class{constructor(type){this.type=type;}},window:{innerWidth:390,innerHeight:844,addEventListener(){},dispatchEvent(){}},localStorage:{getItem(){return null;},setItem(){}},document:{createElement(){return {width:0,height:0,getContext(){return {};}};}}});
 vm.runInContext(readFileSync(runtime,'utf8'),context);assert.equal(context.THREE.REVISION,'128');
 const world=read('world.js');vm.runInContext(`const scene=new THREE.Scene();const currentMap='highway',WORLD_SPEED_SCALE=1.65;${world.slice(world.indexOf('const bodyMaterial ='),world.indexOf('const highwayEnvGroup'))}`,context);
 for(const file of ['highway-traffic.js','vehicles.js','reference-exterior.js','reference-cockpit.js','npc-traffic-assets.js','reference-traffic.js'])vm.runInContext(read(file),context,{filename:file});
 vm.runInContext('globalThis.parts={scene,carMeshGroup,roadsterAttitudeGroup,roadsterCanopyMesh,COCKPIT_VIEW,setCockpitPerspective,setCockpitExteriorDetailsVisible,resizeCockpitDisplay};',context);
 return {context,...context.parts,T:context.THREE,api:context.window.RoadsterVehicle};
}
test('actual r128 driver eye is inside both body canopies and looks through the front windshield, never over the roof',{skip:existsSync(runtime)?false:'Official r128 runtime required'},()=>{
 const f=fixture(),{T}=f,view=f.COCKPIT_VIEW;
 for(const model of ['reference','classic'])for(const cabin of ['reference','classic']){
  f.api.setModel(model);f.api.setCockpit(cabin);f.setCockpitPerspective(false);f.setCockpitExteriorDetailsVisible(true);f.scene.updateMatrixWorld(true);
  const glass=model==='reference'?f.carMeshGroup.getObjectByName('referencePanoramicCanopy'):f.roadsterCanopyMesh;
  const probe=new T.Mesh(glass.geometry,new T.MeshBasicMaterial({side:T.DoubleSide}));probe.matrixAutoUpdate=false;probe.matrixWorld.copy(glass.matrixWorld);
  const eye=new T.Vector3(0,view.eyeHeight,view.eyeZ).applyMatrix4(f.roadsterAttitudeGroup.matrixWorld);
  const up=new T.Raycaster(eye,new T.Vector3(0,1,0)),roof=up.intersectObject(probe,false)[0];
  assert.ok(roof&&roof.distance>.06&&roof.distance<.20,`${model}/${cabin}: actual roof above eye by60–200mm`);
  const forward=new T.Vector3(0,-view.downwardSlope,-1).normalize().transformDirection(f.roadsterAttitudeGroup.matrixWorld);
  const pane=new T.Raycaster(eye,forward).intersectObject(probe,false)[0];assert.ok(pane&&pane.distance>.08);
  const local=pane.point.clone();f.roadsterAttitudeGroup.worldToLocal(local);
  assert.ok(local.z<-.36&&local.z> -1.25&&local.y>.70&&local.y<1.07,`${model}/${cabin}: forward sight exits through actual front glass`);
  for(const [width,height] of [[320,568],[390,844],[375,667],[844,390],[667,320],[390,844]]){
   f.context.window.innerWidth=width;f.context.window.innerHeight=height;f.setCockpitPerspective(true);f.resizeCockpitDisplay();
   assert.equal(view.eyeHeight,1.04);assert.equal(view.eyeZ,-.15);
   f.setCockpitPerspective(false);assert.equal(glass.visible,true);
  }
  probe.material.dispose();
 }
 const physics=read('physics-main.js');assert.match(physics,/camera\.fov = 60/);assert.match(physics,/const desiredNear = isCockpitFpv\s*\? 0\.08/);assert.match(physics,/eyeLocal\.applyMatrix4\(roadsterAttitudeGroup\.matrixWorld\)/);
});
