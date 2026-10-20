import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {EXPECTED_SOURCE_HASHES} from '../verification/demo-continuous/generate-numeric-projection-kernel.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const world=read('src/world.js'),source=read('src/coast-map.js'),ui=read('src/ui-hud.js'),config=read('src/config.js');
const runtime=process.env.ROADSTER_THREE_RUNTIME||'/tmp/roadster-three.min.js';
const skip=existsSync(runtime)?false:'Official production Three r128 required';
const bridgeSource=`// Explicit renderer-only bridge: coast consumes focus without writing camera/physics.\nscene.userData.coastArtBridge = Object.freeze({\n  getFocus: () => camera.position,\n  sharedLights: Object.freeze([ambientLight, dirLight, rimLight])\n});\n\n`;
const sha=s=>createHash('sha256').update(s).digest('hex');
const contract=JSON.parse(read('verification/coast-art/collision-contract.json'));
function harness(){
 const c=vm.createContext({window:{},console,document:{getElementById(){return null;}},renderModalWeatherGrid(){},applyTranslations(){},applyRoadWeather(){},sound:{beep(){}}});
 vm.runInContext(readFileSync(runtime,'utf8'),c);const T=c.THREE;
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(60,1.6,.1,4500);camera.position.set(-64,10.5,711.5);
 scene.background=new T.Color(0x070b16);scene.fog=new T.FogExp2(0x070b16,.00045);c.__scene=scene;c.__camera=camera;
 const lighting=world.slice(world.indexOf('const ambientLight ='),world.indexOf('// underGlowLight removed'));
 vm.runInContext('const scene=__scene,camera=__camera;\n'+lighting+'\nglobalThis.__lights=[ambientLight,dirLight,rimLight];',c);
 const begin=config.indexOf('const WEATHER_PRESETS ='),end=config.indexOf('\n];',begin)+3;
 assert.ok(begin>=0&&end>begin);vm.runInContext(config.slice(begin,end),c);
 vm.runInContext(`let weatherIndex=0;
  const roadMat={},cityAsphaltMat={},cityAsphaltEWMat={};
  const studioEnvMap=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1),marsSunsetEnvMap=new THREE.DataTexture(new Uint8Array([128,80,50,255]),1,1);
  const rainLinesMesh={visible:false},marsSunGroup={visible:false};
  globalThis.__presets=WEATHER_PRESETS;globalThis.__environments=[studioEnvMap,marsSunsetEnvMap];`,c);
 vm.runInContext(source,c);vm.runInContext(ui.slice(ui.indexOf('function selectWeatherMode('),ui.indexOf('function cycleWeatherMode(')),c);
 return {c,T,coast:c.window.RoadsterCoast,scene,camera,lights:c.__lights,presets:c.__presets,environments:c.__environments,
  select(index){vm.runInContext(`selectWeatherMode(${index},false)`,c);}};
}
function lightValues(light){return {color:Array.from(light.color.toArray()),intensity:light.intensity,position:Array.from(light.position.toArray())};}

test('world adds only an explicit read-only coast bridge; every numerical epoch input remains byte-identical',()=>{
 assert.equal(world.split(bridgeSource).length,2);assert.equal(sha(world.replace(bridgeSource,'')),contract.originalWorldSha256);
 assert.equal(Object.hasOwn(EXPECTED_SOURCE_HASHES,'src/world.js'),false);
 for(const [path,expected] of Object.entries(EXPECTED_SOURCE_HASHES))assert.equal(sha(read(path)),expected,path);
});

test('actual UI weather order restores original object identities and LAST selected weather through city/highway-style cycles',{skip},()=>{
 for(const [start,end] of [[0,2],[2,1],[1,0]]){
  const h=harness(),baseline=harness();h.select(start);baseline.select(start);baseline.select(end);
  const {scene,coast,lights}=h,background=scene.background,fog=scene.fog,fogColor=fog.color,parents=lights.map(l=>l.parent);
  const colors=lights.map(l=>l.color),positions=lights.map(l=>l.position),shadows=lights.map(l=>l.shadow),sharedChildren=scene.children.slice();
  lights[1].visible=false;const visibility=lights.map(l=>l.visible);
  const foreign=new h.T.PointLight(0xffffff,.1);scene.add(foreign);
  for(let cycle=0;cycle<5;cycle++){
   const group=coast.enter(scene,h.T);assert.equal(coast.enter(scene,h.T),group);assert.ok(lights.every(l=>l.visible===false));assert.equal(foreign.visible,true);
   assert.notEqual(scene.background,background);assert.notEqual(scene.fog,fog);const privateEnv=scene.environment;
   h.select(end);assert.equal(scene.environment,privateEnv,'repeated weather does not capture its own private environment as shared');
   assert.equal(coast.enter(scene,h.T),group);coast.leave();coast.leave();
   assert.equal(scene.background,background);assert.equal(scene.fog,fog);assert.equal(scene.fog.color,fogColor);
   assert.equal(scene.background.getHex(),h.presets[end].bgColor);assert.equal(scene.fog.color.getHex(),h.presets[end].fogColor);assert.equal(scene.fog.density,h.presets[end].fogDensity);
   assert.equal(scene.environment,h.environments[h.presets[end].marsSun?1:0]);
   lights.forEach((light,i)=>{
    assert.equal(light.visible,visibility[i]);assert.equal(light.parent,parents[i]);assert.equal(light.color,colors[i]);assert.equal(light.position,positions[i]);assert.equal(light.shadow,shadows[i]);
    assert.deepEqual(lightValues(light),lightValues(baseline.lights[i]),'do not roll shared lights back to entry weather');
   });
   assert.deepEqual(Array.from(scene.children),[...sharedChildren,foreign]);assert.equal(coast.metrics().ownedLights,0);assert.equal(coast.metrics().ownedTextures,0);
   const state=[scene.background.getHex(),scene.fog.color.getHex(),scene.fog.density,scene.environment];coast.tick(1);coast.weather(h.presets[start]);
   assert.deepEqual([scene.background.getHex(),scene.fog.color.getHex(),scene.fog.density,scene.environment],state,'inactive hooks are completely silent');
  }
 }
});

test('coast sun follows only finite camera XZ, has a live target matrix and never mutates camera or the old lights',{skip},()=>{
 const h=harness(),{T,scene,camera,coast}=h;h.select(0);const cameraPosition=camera.position,shared=h.lights.map(lightValues);
 assert.ok(Object.isFrozen(scene.userData.coastArtBridge));assert.ok(Object.isFrozen(scene.userData.coastArtBridge.sharedLights));
 const group=coast.enter(scene,T),sun=group.getObjectByName('coast-key-light');assert.equal(sun.shadow.mapSize.x,1024);assert.equal(sun.shadow.mapSize.y,1024);
 assert.equal(sun.shadow.camera.right-sun.shadow.camera.left,160);assert.equal(sun.target.parent,group);
 for(const [x,z,y] of [[-64,700,0],[950,-850,8000],[-600,-650,-10]]){
  camera.position.set(x,y,z);const before=camera.position.toArray();coast.tick(1/60);scene.updateMatrixWorld(true);sun.shadow.updateMatrices(sun);
  assert.equal(camera.position,cameraPosition);assert.deepEqual(camera.position.toArray(),before);assert.deepEqual(Array.from(sun.target.getWorldPosition(new T.Vector3()).toArray()),[x,0,z]);
  for(const n of [...sun.shadow.matrix.elements,...sun.shadow.camera.projectionMatrix.elements])assert.ok(Number.isFinite(n));
 }
 const previous=sun.position.toArray();camera.position.x=NaN;coast.tick(NaN);assert.deepEqual(sun.position.toArray(),previous);assert.ok(Number.isNaN(camera.position.x));
 for(const v of group.getObjectByName('coast-wheel-cabins').instanceMatrix.array)assert.ok(Number.isFinite(v));
 h.lights.forEach((l,i)=>assert.deepEqual(lightValues(l),shared[i]));coast.leave();
 const sceneWithoutBridge=new T.Scene();const fallback=coast.enter(sceneWithoutBridge,T).getObjectByName('coast-key-light');coast.tick(.01);assert.equal(fallback.target.position.x,coast.spec.spawn.x);assert.equal(fallback.target.position.z,coast.spec.spawn.z);coast.leave();
});

test('r128 DirectionalLight disposal releases private map/mapPass once and never releases shared shadow targets',{skip},()=>{
 const h=harness(),{T,scene,coast}=h;h.select(0);const sharedTarget=new T.WebGLRenderTarget(1,1);h.lights[1].shadow.map=sharedTarget;let shared=0;sharedTarget.addEventListener('dispose',()=>shared++);
 for(let cycle=0;cycle<5;cycle++){
  const root=coast.enter(scene,T),sun=root.getObjectByName('coast-key-light');const targets=[new T.WebGLRenderTarget(1,1),new T.WebGLRenderTarget(1,1)];sun.shadow.map=targets[0];sun.shadow.mapPass=targets[1];let disposed=0;
  targets.forEach(t=>t.addEventListener('dispose',()=>disposed++));coast.leave();coast.leave();assert.equal(disposed,2,'light.dispose internally disposes both targets: do not double-call shadow.dispose');assert.equal(shared,0);
 }
 assert.equal(h.lights[1].shadow.map,sharedTarget);sharedTarget.dispose();
});

test('construction and final-attach faults restore scene atomically and dispose all returned partial private resources',{skip},()=>{
 for(const failure of ['instance-build','scene-attach']){
  const h=harness(),{T,scene,coast}=h;h.select(0);h.lights[1].visible=false;const refs=[scene.background,scene.fog,scene.environment],visible=h.lights.map(l=>l.visible),children=scene.children.slice(),observed=new Map();let count=0;
  const track=object=>{observed.set(object,0);object.addEventListener('dispose',()=>observed.set(object,observed.get(object)+1));};
  const ProxyT={...T};for(const name of ['BoxGeometry','PlaneGeometry','BufferGeometry','DataTexture','CubeTexture','MeshStandardMaterial'])ProxyT[name]=class extends T[name]{constructor(...args){super(...args);track(this);}};
  ProxyT.InstancedMesh=class extends T.InstancedMesh{constructor(...args){if(failure==='instance-build'&&++count===7)throw Error('injected-map-build');super(...args);track(this);}};
  const add=scene.add;if(failure==='scene-attach')scene.add=function(object){add.call(this,object);if(object.name==='original-coastal-district')throw Error('injected-final-attach');return this;};
  assert.throws(()=>coast.enter(scene,ProxyT),/injected-/);assert.deepEqual([scene.background,scene.fog,scene.environment],refs);assert.deepEqual(h.lights.map(l=>l.visible),visible);assert.deepEqual(scene.children,children);assert.equal(coast.metrics().active,false);assert.equal(coast.metrics().builds,0);assert.equal(coast.metrics().failedBuilds,1);
  assert.ok(observed.size>10);for(const n of observed.values())assert.equal(n,1,'every successfully returned partial private resource disposed once');
  scene.add=add;coast.enter(scene,T);coast.leave();assert.deepEqual([scene.background,scene.fog,scene.environment],refs);assert.deepEqual(h.lights.map(l=>l.visible),visible);
 }
});

test('actual switchMap coast→city/highway→coast repeatedly restores scene and disposes before the next old-map frame',{skip},()=>{
 const h=harness(),{scene,coast}=h;h.select(0);h.lights[1].visible=false;
 const original={background:scene.background,fog:scene.fog,children:Array.from(scene.children),visible:Array.from(h.lights,l=>l.visible)};let disposedSkies=0;
 // Reset/traffic construction are outside this visual ownership test; only their
 // external effects are stubbed. The production map-controller body is unmodified.
 vm.runInContext(`let currentMap='highway',selectedMapInModal='highway',trafficLevelIndex=1;
  const highwayEnvGroup={visible:true},cityEnvGroup={visible:false};
  function mapTrafficCounts(){return [20,36,52];}function resetCar(){}function populateTraffic(){}`+
  ui.slice(ui.indexOf('function switchMap('),ui.indexOf('function resetCar(')),h.c);
 for(const [cycle,next] of ['city','highway','city','highway','city'].entries()){
  vm.runInContext("switchMap('coast')",h.c);const privateSky=scene.environment;
  privateSky.addEventListener('dispose',()=>{disposedSkies++;assert.notEqual(scene.environment,privateSky,'restore shared env before disposing private texture');});
  vm.runInContext("switchMap('coast')",h.c);assert.equal(scene.environment,privateSky);h.select(cycle%3);
  vm.runInContext(`switchMap('${next}')`,h.c);assert.equal(vm.runInContext('currentMap',h.c),next);
  assert.equal(scene.background,original.background);assert.equal(scene.fog,original.fog);assert.deepEqual(Array.from(scene.children),original.children);assert.deepEqual(Array.from(h.lights,l=>l.visible),original.visible);
  assert.equal(scene.environment,h.environments[h.presets[cycle%3].marsSun?1:0]);assert.equal(coast.metrics().active,false);
  assert.equal(vm.runInContext('highwayEnvGroup.visible',h.c),next==='highway');assert.equal(vm.runInContext('cityEnvGroup.visible',h.c),next==='city');
 }
 assert.equal(disposedSkies,5);assert.equal(coast.metrics().builds,5);assert.equal(coast.metrics().disposals,5);
});

test('direct r128 cube sky updates the same six owned payloads across every weather instead of retaining a cached equirectangular conversion',{skip},()=>{
 const h=harness(),{scene,T,coast}=h;h.select(0);coast.enter(scene,T);
 const sky=scene.environment;assert.equal(sky.isCubeTexture,true);assert.equal(sky.mapping,T.CubeReflectionMapping);assert.equal(sky.image.length,6);assert.equal(sky.format,T.RGBAFormat);
 const payloads=Array.from(sky.image),disposed=new Map();for(const resource of [sky,...payloads]){disposed.set(resource,0);resource.addEventListener('dispose',()=>disposed.set(resource,disposed.get(resource)+1));}
 const hashes=[];let previousVersion=sky.version;
 for(const index of [0,1,2,0,2,1]){
  h.select(index);assert.equal(scene.environment,sky);assert.ok(sky.version>previousVersion);previousVersion=sky.version;
  const bytes=[];payloads.forEach((face,i)=>{assert.equal(sky.image[i],face);assert.equal(face.isDataTexture,true);assert.equal(face.image.width,32);assert.equal(face.image.height,32);assert.equal(face.image.data.length,4096);bytes.push(...face.image.data);});
  hashes.push(sha(Uint8Array.from(bytes)));assert.ok(coast.metrics().textureBytes<4*1024*1024);
 }
 assert.notEqual(hashes[0],hashes[1]);assert.notEqual(hashes[0],hashes[2]);assert.notEqual(hashes[1],hashes[2]);assert.equal(hashes[0],hashes[3]);assert.equal(hashes[2],hashes[4]);assert.equal(hashes[1],hashes[5]);
 coast.leave();for(const n of disposed.values())assert.equal(n,1,'cube and all source payloads disposed once');
});
