// CPU-only verification against the exact production Three.js r128 meshes.
// Pass its runtime path; this neither starts a browser nor claims GPU testing.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),runtime=process.argv[2];
if(!runtime)throw Error('Pass the official production Three.js r128 runtime path.');
const source=name=>fs.readFileSync(path.join(root,'src',name),'utf8');
const c=vm.createContext({console,Math,Float32Array,Uint16Array,Uint32Array,Event:class{constructor(type){this.type=type;}},atob:t=>Buffer.from(t,'base64').toString('binary'),window:{innerWidth:1440,innerHeight:900,addEventListener(){},dispatchEvent(){}},localStorage:{getItem(){return null;},setItem(){}},document:{createElement(){return {getContext(){return {}}};}}});
vm.runInContext(fs.readFileSync(runtime,'utf8'),c);assert.equal(c.THREE.REVISION,'128');
const world=source('world.js');
vm.runInContext(`const scene=new THREE.Scene();let currentMap='highway',weatherIndex=1,cameraModeIndex=3;const state={x:0,y:0,z:0,vz:0,speed:0,isDestroyed:false};const WORLD_SPEED_SCALE=1.65;${world.slice(world.indexOf('const bodyMaterial ='),world.indexOf('const highwayEnvGroup'))}${world.slice(world.indexOf('const rainCount ='),world.indexOf('const marsSunGroup ='))}`,c);
const modules=['vehicles.js','reference-exterior.js','reference-cockpit.js','npc-traffic-assets.js','reference-traffic.js','weather-rain.js'];
// NPC geometry depends on the shared traffic helpers, just as in the bundle.
vm.runInContext(source('highway-traffic.js'),c);
for(const file of modules)vm.runInContext(source(file),c,{filename:file});
const get=code=>vm.runInContext(code,c);
const p=get('({scene,playerWrapper,roadsterAttitudeGroup,carMeshGroup,roadsterCanopyMesh,screenBezel,screenDisplay,yokeWheelGroup,glassRainMesh,glassRainGeometry,glassRainDrops,glassRainPositions,glassRainMaterial,glassRainOpacities,rainPositions,rainLinesMesh,COCKPIT_VIEW,RAIN_CABIN,setCockpitPerspective,setCockpitExteriorDetailsVisible,resizeCockpitDisplay,updateWindshieldRain,updateExteriorRain,rainSegmentIntersectsCabin})');
const T=c.THREE,api=c.window.RoadsterVehicle;
const camera=new T.PerspectiveCamera(60,1,.08,1000),ray=new T.Raycaster(),sheet=new T.Mesh(undefined,new T.MeshBasicMaterial({side:T.DoubleSide}));
const visible=o=>{for(let n=o;n;n=n.parent)if(!n.visible)return false;return true;};
const result={generatedAt:new Date().toISOString(),runtimeRevision:T.REVISION,sources:Object.fromEntries(['world.js','physics-main.js','ui-hud.js',...modules].map(f=>[f,crypto.createHash('sha256').update(source(f)).digest('hex')])),limits:'Production scene graph, actual triangle sampling, transforms and rays on CPU. Browser launch was blocked by socket permissions; no browser, WebGL, FPS or real-device pass is claimed.',configurations:[],cabinSegments:0,restoredSegments:0,pass:false};
const vector=new T.Vector3();
function project(v){const out=v.clone().project(camera);return[(out.x+1)/2,(1-out.y)/2];}
for(const [w,h]of[[1440,900],[390,844],[844,390],[360,800],[1920,1080],[2560,1080],[768,1024]])for(const model of ['reference','classic'])for(const cockpit of ['reference','classic']){
  api.setModel(model);api.setCockpit(cockpit);p.setCockpitPerspective(true);p.setCockpitExteriorDetailsVisible(false);p.roadsterCanopyMesh.visible=false;
  p.playerWrapper.position.set(0,0,0);p.roadsterAttitudeGroup.rotation.set(0,0,0);c.window.innerWidth=w;c.window.innerHeight=h;p.resizeCockpitDisplay();
  camera.aspect=w/h;camera.position.set(0,p.COCKPIT_VIEW.eyeHeight,p.COCKPIT_VIEW.eyeZ);camera.lookAt(0,p.COCKPIT_VIEW.eyeHeight-p.COCKPIT_VIEW.downwardSlope,p.COCKPIT_VIEW.eyeZ-1);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  get('weatherIndex=0;updateWindshieldRain(0);weatherIndex=1;cameraModeIndex=3;state.isDestroyed=false;');p.updateWindshieldRain(0);p.scene.updateMatrixWorld(true);
  const glass=model==='reference'?p.carMeshGroup.getObjectByName('referencePanoramicCanopy'):p.roadsterCanopyMesh;
  sheet.geometry=glass.geometry;sheet.matrixWorld.copy(glass.matrixWorld);sheet.matrixAutoUpdate=false;
  const blockers=[];p.carMeshGroup.traverse(o=>{if(o.isMesh&&o!==p.glassRainMesh&&visible(o))blockers.push(o);});
  const protectedMeshes=[];for(const o of[p.screenBezel,p.screenDisplay,p.yokeWheelGroup])o.traverse(m=>{if(m.isMesh&&visible(m))protectedMeshes.push(m);});
  const record={viewport:[w,h],model,cockpit,screenPoints:[],minimumGlassClearance:Infinity,maximumBeadWidthPixels:0,maximumTrailPixels:0};
  for(let i=0;i<32;i++)record.screenPoints.push(project(new T.Vector3().fromBufferAttribute(p.glassRainGeometry.attributes.position,i)));
  function projectedBounds(object){let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;object.traverse(o=>{if(!o.isMesh||!visible(o))return;const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++){const xy=project(new T.Vector3().fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld));minX=Math.min(minX,xy[0]);maxX=Math.max(maxX,xy[0]);minY=Math.min(minY,xy[1]);maxY=Math.max(maxY,xy[1]);}});return[minX,minY,maxX,maxY];}
  record.screenBounds=projectedBounds(p.screenBezel);record.yokeBounds=projectedBounds(p.yokeWheelGroup);
  // Full trajectories and the complete quad envelope, not only drop centers.
  for(let phase=0;phase<=1;phase+=.05){
    for(let i=0;i<8;i++)p.glassRainDrops[i].phase=Math.min(.999,phase);
    p.updateWindshieldRain(0);
    for(let i=0;i<32;i++){
      vector.fromBufferAttribute(p.glassRainGeometry.attributes.position,i);const worldPoint=vector.clone().applyMatrix4(p.carMeshGroup.matrixWorld),s=project(worldPoint);
      assert.ok(s[0]>.025&&s[0]<.975,`bead outside side edge ${model} ${w}: ${s}`);
      assert.ok(s[0]<.15||s[0]>.85,`bead enters road/instrument center ${model} ${w}: ${s}`);
      assert.ok(s[1]>(model==='reference'?.69:.54)&&s[1]<(model==='reference'?.755:.65),`water outside model's safe glass band: ${s}`);
      ray.set(camera.position,worldPoint.clone().sub(camera.position).normalize());ray.near=0;ray.far=camera.position.distanceTo(worldPoint)-1e-5;
      assert.equal(ray.intersectObjects(blockers,false).length,0,'water is hidden behind a cabin surface');
      ray.far=100;assert.equal(ray.intersectObjects(protectedMeshes,false).length,0,'water overlaps protected screen/yoke projection');
      ray.set(worldPoint,new T.Vector3(0,-1,0));ray.near=0;ray.far=.02;
      const hit=ray.intersectObject(sheet,false)[0];assert.ok(hit,'water is not attached outside the actual glass');
      assert.ok(hit.distance>.0008&&hit.distance<.004,`water/glass gap ${hit.distance}`);record.minimumGlassClearance=Math.min(record.minimumGlassClearance,hit.distance);
    }
    for(let triangle=0;triangle<16;triangle++) {
      const indices=p.glassRainGeometry.index.array;
      const a=new T.Vector3().fromBufferAttribute(p.glassRainGeometry.attributes.position,indices[triangle*3]);
      const b=new T.Vector3().fromBufferAttribute(p.glassRainGeometry.attributes.position,indices[triangle*3+1]);
      const d=new T.Vector3().fromBufferAttribute(p.glassRainGeometry.attributes.position,indices[triangle*3+2]);
      for(const [u,v]of[[1/3,1/3],[.1,.1],[.8,.1],[.1,.8]]) {
        const point=a.clone().multiplyScalar(1-u-v).addScaledVector(b,u).addScaledVector(d,v).applyMatrix4(p.carMeshGroup.matrixWorld);
        ray.set(point,new T.Vector3(0,-1,0));ray.near=0;ray.far=.02;
        const hit=ray.intersectObject(sheet,false)[0];assert.ok(hit,'quad interior crosses inside actual glass');
        assert.ok(hit.distance>.0008&&hit.distance<.004,`interior gap ${hit.distance}`);
      }
    }
    for(let i=0;i<8;i++){
      const a=project(new T.Vector3().fromBufferAttribute(p.glassRainGeometry.attributes.position,i*4));
      const b=project(new T.Vector3().fromBufferAttribute(p.glassRainGeometry.attributes.position,i*4+1));
      const d=project(new T.Vector3().fromBufferAttribute(p.glassRainGeometry.attributes.position,i*4+2));
      record.maximumBeadWidthPixels=Math.max(record.maximumBeadWidthPixels,Math.abs(a[0]-b[0])*w);
      record.maximumTrailPixels=Math.max(record.maximumTrailPixels,Math.abs(a[1]-d[1])*h);
    }
  }
  assert.ok(record.maximumBeadWidthPixels<5);assert.ok(record.maximumTrailPixels<18);
  result.configurations.push(record);
}
// Whole-field enclosure checks in world space across maps, altitude and 6-DOF.
const box=new T.Box3(new T.Vector3(p.RAIN_CABIN.minX,p.RAIN_CABIN.minY,p.RAIN_CABIN.minZ),new T.Vector3(p.RAIN_CABIN.maxX,p.RAIN_CABIN.maxY,p.RAIN_CABIN.maxZ));
for(const map of ['highway','city'])for(const altitude of [0,20,120])for(const attitude of [[0,0,0],[.7,1.2,.8],[Math.PI/2,0,0],[Math.PI,2,-Math.PI/2]])for(const speed of [0,100,-120]){
  get(`currentMap='${map}';weatherIndex=1;state.x=30;state.y=${altitude};state.z=150;state.vz=${speed};rainLinesMesh.visible=true;`);
  p.playerWrapper.position.set(30,altitude,map==='highway'?0:150);p.roadsterAttitudeGroup.rotation.set(...attitude);p.scene.updateMatrixWorld(true);
  const center=new T.Vector3(0,.78,.22).applyMatrix4(p.roadsterAttitudeGroup.matrixWorld),offsetY=Math.max(0,altitude-20);
  p.rainPositions[0]=center.x-30;p.rainPositions[1]=center.y+1.4-offsetY;p.rainPositions[2]=center.z-(map==='highway'?0:150);
  // The long vertical/slanted production segment passes through the enclosure.
  p.updateExteriorRain(0);
  const inv=new T.Matrix4().copy(p.roadsterAttitudeGroup.matrixWorld).invert(),offset=p.rainLinesMesh.position;
  for(let i=0;i<1500;i++){
    const head=new T.Vector3().fromArray(p.rainPositions,i*6).add(offset).applyMatrix4(inv),tail=new T.Vector3().fromArray(p.rainPositions,i*6+3).add(offset).applyMatrix4(inv);
    const length=head.distanceTo(tail);if(length<1e-7)continue;
    const hit=new T.Ray(head,tail.clone().sub(head).normalize()).intersectBox(box,new T.Vector3());
    assert.ok(!hit||head.distanceTo(hit)>length+1e-6,'surviving world streak crosses the cabin');result.cabinSegments++;
  }
}
// A clipped head retains its simulation state and regains a full tail after the car moves away.
get("currentMap='city';state.x=0;state.y=20;state.z=0;state.vz=0");p.playerWrapper.position.set(0,20,0);p.roadsterAttitudeGroup.rotation.set(0,0,0);
p.rainPositions.set([0,22,0,0,19.2,0],0);p.updateExteriorRain(0);assert.equal(p.rainPositions[1],p.rainPositions[4]);
get('state.x=40');p.playerWrapper.position.set(40,20,0);p.rainPositions[0]=-40;p.updateExteriorRain(0);assert.ok(Math.abs(p.rainPositions[1]-p.rainPositions[4]-2.8)<1e-5);result.restoredSegments++;
for(const mode of[0,1,2]){get(`cameraModeIndex=${mode};updateWindshieldRain(0)`);assert.equal(p.glassRainMesh.visible,false);}
get('cameraModeIndex=3;weatherIndex=0;updateWindshieldRain(0)');assert.equal(p.glassRainMesh.visible,false);
result.pass=true;if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,configurations:result.configurations.map(({screenPoints,...r})=>r)},null,2));
