/** Exact production r128 mesh/transforms. No reconstructed body or browser/WebGL. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..'), runtime = process.argv[2];
if (!runtime) throw Error('Pass the official production Three.js r128 runtime path.');
const events = {};
const c = vm.createContext({ console, Math, Float32Array, Uint16Array, Uint32Array, atob:text=>Buffer.from(text,'base64').toString('binary'),
  Event: class { constructor(type) { this.type = type; } },
  window: { innerWidth:1440,innerHeight:900,addEventListener(t,fn){(events[t] ||= []).push(fn);},dispatchEvent(e){events[e.type]?.forEach(fn=>fn(e));} },
  localStorage:{getItem(){return null;},setItem(){}},
  document:{createElement(){return {getContext(){return {};}};}} });
vm.runInContext(fs.readFileSync(runtime,'utf8'),c);
assert.equal(c.THREE.REVISION,'128');
const files = ['world.js','highway-traffic.js','vehicles.js','reference-exterior.js','reference-cockpit.js','npc-traffic-assets.js','reference-traffic.js'];
const world = fs.readFileSync(path.join(root,'src/world.js'),'utf8');
vm.runInContext(`const scene=new THREE.Scene();const currentMap='highway';const WORLD_SPEED_SCALE=${Number(fs.readFileSync(path.join(root,'src/config.js'),'utf8').match(/const WORLD_SPEED_SCALE = ([\d.]+)/)[1])};${world.slice(world.indexOf('const bodyMaterial ='),world.indexOf('const highwayEnvGroup'))}`,c);
for (const file of files.slice(1)) vm.runInContext(fs.readFileSync(path.join(root,'src',file),'utf8'),c,{filename:file});
vm.runInContext('this.p={scene,carMeshGroup,roadsterCanopyMesh,screenDisplay,screenBezel,hudCombinerMesh,setCockpitPerspective,setCockpitExteriorDetailsVisible,resizeCockpitDisplay};',c);
const p=c.p,T=c.THREE,api=c.window.RoadsterVehicle;
p.carMeshGroup.parent.parent.position.set(0,0,0);
const visible=o=>{for(let n=o;n;n=n.parent)if(!n.visible)return false;return true;};
const ray=new T.Raycaster(), result={generatedAt:new Date().toISOString(),runtimeRevision:T.REVISION,
  sources:Object.fromEntries(files.map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'src',file))).digest('hex')])),
  limits:'CPU production scene graph, world transforms and exact triangle rays; CPU studio renders are separate from browser/GPU verification.',
  configurations:[],canopyClearanceRays:0,exteriorOcclusionRays:0,pass:false};
const screen=p.carMeshGroup.getObjectByName('interior-center-screen');
const physicalDisplay=screen.getObjectByName('interior-live-instruments');
assert.equal(physicalDisplay.material,p.screenDisplay.material);
for(const model of ['reference','classic'])for(const cockpit of ['reference','classic']){
  api.setModel(model);api.setCockpit(cockpit);p.setCockpitPerspective(false);p.setCockpitExteriorDetailsVisible(true);p.scene.updateMatrixWorld(true);
  const canopy=model==='classic'?p.roadsterCanopyMesh:p.carMeshGroup.getObjectByName('reference-canopy');
  const preview=api.getPreviewModel();preview.updateMatrixWorld(true);
  assert.ok(visible(screen));assert.ok(!visible(p.screenBezel)&&!visible(p.screenDisplay)&&!visible(p.hudCombinerMesh));
  for(const name of ['fpv-live-instruments','fpv-instrument-bezel'])assert.ok(!visible(preview.getObjectByName(name)));
  const bounds=new T.Box3().setFromObject(screen), record={model,cockpit,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},minimumGlassClearance:Infinity,exteriorFirstHits:{}};
  const targets=[];
  screen.traverse(part=>{if(!part.isMesh)return;const a=part.geometry.attributes.position;for(let i=0;i<a.count;i++)targets.push(new T.Vector3().fromBufferAttribute(a,i).applyMatrix4(part.matrixWorld));});
  // Every actual housing/display vertex, plus face-interior samples, must be
  // below the actual selected windshield surface with positive air clearance.
  for(const x of [-.19,-.095,0,.095,.19])for(const y of [-.08,-.04,0,.04,.08])targets.push(new T.Vector3(x,y,-.010).applyMatrix4(screen.matrixWorld));
  for(const target of targets){
    ray.set(new T.Vector3(target.x,2,target.z),new T.Vector3(0,-1,0));ray.near=0;ray.far=2;
    const hits=ray.intersectObject(canopy,true);assert.ok(hits.length,'Physical screen falls outside the actual windshield footprint.');
    const clearance=hits[0].point.y-target.y;assert.ok(clearance>.12,`Physical screen pierces ${model} glass (${clearance}).`);
    record.minimumGlassClearance=Math.min(record.minimumGlassClearance,clearance);result.canopyClearanceRays++;
  }
  const all=[];p.carMeshGroup.traverse(o=>{if(o.isMesh&&visible(o)&&!(Array.isArray(o.material)?o.material:[o.material]).every(m=>m.transparent&&m.opacity<=.01))all.push(o);});
  for(const origin of [[0,1.2,-5],[3,1.8,-5],[-3,1.8,-5]])for(const target of targets){
    const start=new T.Vector3(...origin);ray.set(start,target.clone().sub(start).normalize());ray.near=.01;ray.far=start.distanceTo(target)+1e-5;
    const hit=ray.intersectObjects(all,false)[0];assert.ok(hit,'Exterior ray has no blocking windshield/body surface.');
    assert.ok(!hit.object.name.startsWith('interior-')&&!hit.object.name.startsWith('fpv-'),'Exterior screen escapes windshield/body silhouette.');
    const name=hit.object.name||hit.object.geometry.type;record.exteriorFirstHits[name]=(record.exteriorFirstHits[name]||0)+1;result.exteriorOcclusionRays++;
  }
  for(const [w,h]of [[1440,900],[390,844],[844,390]]){
    p.setCockpitPerspective(true);p.setCockpitExteriorDetailsVisible(false);c.window.innerWidth=w;c.window.innerHeight=h;p.resizeCockpitDisplay();
    assert.ok(visible(p.screenDisplay)&&visible(p.screenBezel)&&!visible(screen));
    p.setCockpitPerspective(false);p.setCockpitExteriorDetailsVisible(true);p.scene.updateMatrixWorld(true);
    const again=new T.Box3().setFromObject(screen);assert.ok(again.min.equals(bounds.min)&&again.max.equals(bounds.max));
  }
  result.configurations.push(record);
}
result.pass=true;
if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
