import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, existsSync } from 'node:fs';
import { motionHarness } from './helpers/motion-harness.mjs';
import { lifecycleHarness } from './helpers/demo-lifecycle-harness.mjs';
const source=readFileSync(new URL('../src/coast-road-network.js',import.meta.url),'utf8')+'\n'+readFileSync(new URL('../src/coast-map.js',import.meta.url),'utf8');
const ui=readFileSync(new URL('../src/ui-hud.js',import.meta.url),'utf8');
const physics=readFileSync(new URL('../src/physics-main.js',import.meta.url),'utf8');
function api(){const context=vm.createContext({window:{}});vm.runInContext(source,context);return {context,coast:context.window.RoadsterCoast};}
const vector=()=>({x:0,y:0,z:0,set(x,y,z){Object.assign(this,{x,y,z});}});
const mesh=()=>({visible:true,position:vector(),rotation:vector(),userData:{length:4.62,height:1.25,wheels:[]}});
const group=()=>({children:[],add(x){this.children.push(x);}});

test('original map data is lazy, meter-scale, connected and explicitly separate from city/highway',()=>{
 const {coast}=api(),layout=coast.layout();
 assert.equal(coast.metrics().active,false);assert.equal(coast.metrics().builds,0);
 assert.equal(coast.spec.halfBound,1200);assert.equal(layout.buildings.length,44);
 assert.ok(layout.palms.length>=80&&layout.palms.length<=140);
 assert.equal(coast.nodes.length,3);assert.equal(coast.edges.length,4);
 const seen=new Set([0]);for(let i=0;i<12;i++)for(const e of coast.edges)if(seen.has(e.from))seen.add(e.to);
 assert.equal(seen.size,3);
 for(const b of layout.buildings){assert.ok(!coast.onRoad(b.x,b.z));assert.ok(!coast.surface(b.x,b.z).water);}
 assert.doesNotMatch(source,/fetch\(|XMLHttpRequest|GLTFLoader|TextureLoader|https?:\/\/|setInterval|new THREE\.(?:WebGLRenderer|WebGLRenderTarget|PointLight)/);
});

test('all directed routes and complete vehicle corners stay on legal roads, not sand, pier or water',()=>{
 const {coast}=api();
 coast.routes.forEach((r,id)=>{for(let s=0;s<r.length;s+=1.3){
  const p=coast.pose(id,s);assert.ok(Math.abs(Math.hypot(p.dx,p.dz)-1)<1e-10);
  assert.ok(coast.onRoad(p.x,p.z));assert.equal(coast.surface(p.x,p.z,p).water,false);assert.equal(coast.surface(p.x,p.z,p).pier,false);
  for(const a of [-2.31,2.31])for(const b of [-.98,.98])assert.ok(coast.onRoad(p.x+p.dx*a-p.dz*b,p.z+p.dz*a+p.dx*b),'whole vehicle inside road/junction');
 }});
});

for(const fps of [30,60,144])test(`coast20-car road motion uses real metres and finite speed at${fps}Hz`,()=>{
 const {coast}=api(),player={x:-64,z:700},cars=coast.createTraffic(20,mesh,group(),player);
 assert.equal(cars.length,20);assert.ok(cars.every(c=>c.mesh.visible));
 for(let frame=0;frame<15*fps;frame++){
  const old=cars.map(c=>({x:c.mesh.position.x,z:c.mesh.position.z}));coast.stepTraffic(cars,player,1/fps);
  cars.forEach((c,i)=>{
   assert.ok(coast.onRoad(c.mesh.position.x,c.mesh.position.z));assert.ok(!coast.surface(c.mesh.position.x,c.mesh.position.z).water);
   assert.ok(Math.hypot(c.mesh.position.x-old[i].x,c.mesh.position.z-old[i].z)<=16.5/fps+1e-8,'no map-scale multiplier or teleport');
   assert.ok(Number.isFinite(c.vx)&&Number.isFinite(c.vz)&&c.speed>=0&&c.speed<=c.desiredSpeed+1e-9);
  });
 }
});

test('collision stops on its actual route; blasts hide before a safe road-only respawn, without city wrap',()=>{
 const {coast}=api(),player={x:-64,z:700},cars=coast.createTraffic(16,mesh,group(),player),c=cars[0];
 const old={...c.mesh.position};coast.hit(c);coast.stepTraffic(cars,player,.05);
 assert.equal(c.mesh.position.x,old.x);assert.equal(c.mesh.position.z,old.z);assert.equal(c.speed,0);
 c.blastTimer=.03;c.blastVx=-50;c.blastVy=3;c.blastVz=10;coast.stepTraffic(cars,player,.05);
 assert.equal(c.mesh.visible,false);assert.equal(c.coastWaiting,true);
 coast.stepTraffic(cars,player,1/60);assert.equal(c.mesh.visible,true);assert.equal(c.coastWaiting,false);
 assert.ok(coast.onRoad(c.mesh.position.x,c.mesh.position.z));assert.ok(Math.hypot(c.mesh.position.x-player.x,c.mesh.position.z-player.z)>32);
 cars.forEach(b=>{if(b!==c&&b.mesh.visible)assert.ok(Math.hypot(c.mesh.position.x-b.mesh.position.x,c.mesh.position.z-b.mesh.position.z)>19);});
});

const runtime=process.env.ROADSTER_THREE_RUNTIME||'/tmp/roadster-three.min.js';
test('actualr128 low-poly model owns bounded geometry, creates lazily and disposes only its own map resources',{
 skip:existsSync(runtime)?false:'Official Three r128 runtime is needed for actual geometry QA'
},()=>{
 const context=vm.createContext({window:{},console});vm.runInContext(readFileSync(runtime,'utf8'),context);vm.runInContext(source,context);
 const {THREE}=context,coast=context.window.RoadsterCoast,scene=new THREE.Scene();
 const sharedGeo=new THREE.BoxGeometry(),sharedMat=new THREE.MeshStandardMaterial(),npc=new THREE.Mesh(sharedGeo,sharedMat);scene.add(npc);
 let sharedDisposed=0,instancesDisposed=0;sharedGeo.addEventListener('dispose',()=>sharedDisposed++);sharedMat.addEventListener('dispose',()=>sharedDisposed++);
 for(let round=0;round<5;round++){
  const root=coast.enter(scene,THREE),same=coast.enter(scene,THREE);assert.equal(same,root);assert.equal(scene.children.length,2);
  for(const name of ['coast-water','coast-sand','coast-promenade','coast-pier-boardwalk','coast-original-ferris-wheel','coast-palm-trunks'])assert.ok(root.getObjectByName(name),`${name} is actual owned scene geometry`);
  root.updateMatrixWorld(true);const wheelBox=new THREE.Box3().setFromObject(root.getObjectByName('coast-original-ferris-wheel'));
  assert.ok(wheelBox.max.y>58&&wheelBox.min.x< -640&&wheelBox.max.x< -640);
  const m=coast.metrics();assert.ok(m.staticMeshDraws<=coast.artBudget.staticMeshDraws);assert.ok(m.maximumStaticTriangles<=coast.artBudget.staticTriangles);assert.equal(m.buildings,52);assert.equal(m.retainedCoastalBuildings,44);assert.equal(m.hillsideBuildings,8);
  let instanceCount=0;
  root.traverse(o=>{if(o.isInstancedMesh){instanceCount++;o.addEventListener('dispose',()=>instancesDisposed++);for(const x of o.instanceMatrix.array)assert.ok(Number.isFinite(x));}if(!o.geometry)return;for(const x of o.geometry.attributes.position.array)assert.ok(Number.isFinite(x));});
  const before=instancesDisposed;
  coast.tick(1/30);coast.weather({rain:true});coast.leave();coast.leave();
  assert.equal(instancesDisposed-before,instanceCount,'every owned instance buffer receives disposal exactly once');
  assert.equal(scene.children.length,1);assert.equal(coast.metrics().ownedGeometries,0);assert.equal(coast.buildings().length,0);
 }
 assert.equal(sharedDisposed,0);assert.equal(coast.metrics().builds,5);assert.equal(coast.metrics().disposals,5);
});

function coastMotion(overrides={}){
 const h=motionHarness({x:-64,z:700,...overrides},'coast'),{coast}=api();
 h.context.window.RoadsterCoast={...coast,buildings:()=>coast.layout().obstacles};
 let resets=0;
 h.context.clearAllInputKeys=()=>{for(const key in h.keys)h.keys[key]=false;};
 h.context.clearDebris=()=>{};h.context.renderBannerText=()=>{};
 const reset=ui.slice(ui.indexOf('function resetCar()'),ui.indexOf('function applyTranslations('));vm.runInContext(reset,h.context);
 const actual=h.context.resetCar;h.context.resetCar=()=>{resets++;actual();};
 return {...h,coast,resets:()=>resets};
}
for(const fps of [30,60,144])test(`coastal300m drive takes5.4seconds at200km/h,${fps}Hz`,()=>{
 const speed=200/3.6,h=coastMotion({speed,vz:-speed});h.keys.KeyW=true;
 for(let i=0;i<Math.floor(5.4*fps);i++)h.step(1/fps);const tail=5.4-Math.floor(5.4*fps)/fps;if(tail>1e-12)h.step(tail);
 assert.ok(Math.abs(h.state.z-400)<1e-7);assert.equal(h.resets(),0);assert.equal(h.impacts.length,0);
});

test('sea permits flight but no ghost landing save or recharge; actual touch resets once onto the road',()=>{
 const flying=coastMotion({x:-500,z:0,y:10,vy:-8,airRemaining:5});flying.step(.05);
 assert.equal(flying.resets(),0);assert.equal(flying.state.airRemaining,5);assert.equal(flying.state.isAutoLandingSave,false);
 const falling=coastMotion({x:-500,z:0,y:0,airRemaining:5});
 for(let i=0;i<5;i++)falling.step(.05);assert.equal(falling.state.airRemaining,5,'no sea-floor recharge');assert.equal(falling.resets(),0);
 for(let i=0;i<30;i++)falling.step(.05);assert.equal(falling.resets(),1);assert.ok(falling.state.x>-330);assert.equal(falling.state.y,0);
 const pier=coastMotion({x:-600,z:-650,y:0,airRemaining:5});pier.step(.05);
 assert.equal(pier.resets(),0);assert.equal(pier.state.y,0);assert.ok(pier.state.airRemaining>5,'solid pier supports recharge');
});

test('spawn boulevard and pier approach form a traversable sightseeing path, not an isolated menu option',()=>{
 const {coast}=api(),obstacles=coast.layout().obstacles;
 const points=[coast.spec.spawn,{x:-64,z:-650},{x:-800,z:-650}];
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],length=Math.hypot(b.x-a.x,b.z-a.z);
  for(let d=0;d<=length;d+=1){const t=d/length,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;
   assert.equal(coast.surface(x,z).solid,true);assert.ok(obstacles.every(o=>x<o.minX-1.1||x>o.maxX+1.1||z<o.minZ-1.8||z>o.maxZ+1.8));
  }
 }
});

test('water/reset chooses a genuinely free road pose rather than spawning inside existing traffic',()=>{
 const h=coastMotion({x:-500,z:0,y:-.39,vy:-4}),cars=h.coast.createTraffic(20,mesh,group(),{x:1000,z:1100});
 cars[0].mesh.position.set(h.coast.spec.spawn.x,0,h.coast.spec.spawn.z);h.context.trafficCars=cars;
 h.step(.05);assert.equal(h.resets(),1);assert.ok(h.coast.onRoad(h.state.x,h.state.z));
 for(const c of cars)if(c.mesh.visible)assert.ok(Math.hypot(c.mesh.position.x-h.state.x,c.mesh.position.z-h.state.z)>32);
});

test('coast continuous side sweep prevents high-speed building tunneling and roofs remain real support',()=>{
 const {coast}=api(),b=coast.layout().buildings.find(b=>b.x===-5&&b.z===0);
 const h=coastMotion({x:b.minX-12,z:b.z,y:0,yaw:-Math.PI/2,speed:260,vx:260,vz:0,physicsMode:'fantasy'});
 h.step(.2);assert.ok(h.impacts.length>=1);assert.ok(h.state.x<=b.minX-1.099);assert.equal(h.resets(),0);
 const roof=coastMotion({x:b.x,z:b.z,y:b.height+.2,vy:-3});roof.step(.1);
 assert.ok(Math.abs(roof.state.y-b.height)<1e-8);assert.equal(roof.state.vy,0);assert.equal(roof.resets(),0);
});

test('after touchdown, rooftop driving and a fresh O takeoff never collide with their own supporting side wall',()=>{
 const {coast}=api(),b=coast.layout().buildings.find(b=>b.x===-5&&b.z===0),h=coastMotion({x:b.x,z:b.z,y:b.height+.2,vy:-3});
 h.step(.1);const oldZ=h.state.z;h.keys.KeyW=true;h.step(.1);
 assert.ok(h.state.z<oldZ);assert.equal(h.impacts.length,0);
 vm.runInContext(ui.slice(ui.indexOf('function triggerJump6m()'),ui.indexOf('function toggleAltitudeHold()')),h.context);
 h.context.triggerJump6m();h.step(.05);assert.ok(h.state.y>b.height+.2);assert.equal(h.impacts.length,0);
 const drive=coastMotion({x:b.x,z:b.z,y:b.height,speed:30,vz:-30});
 for(let i=0;i<40;i++)drive.step(.05);
 assert.ok(drive.state.z<b.minZ-2);assert.equal(drive.impacts.length,0);
});

test('actual coast contact block covers east/west cars and turning headings instead of a fixed north/south box',()=>{
 const start=physics.indexOf('    const dx = Math.abs(state.x - car.mesh.position.x);');
 const collision=physics.slice(start,physics.indexOf('\n  // Render the resolved pose',start)).replace(/\n  \}\);\s*$/,'');
 for(const yaw of [-Math.PI/2,-Math.PI/4]){
  const h=coastMotion({yaw,speed:10,vx:-Math.sin(yaw)*10,vz:-Math.cos(yaw)*10});
  const car={mesh:mesh(),mode:'coast',length:4.62,height:1.25,y:0,vx:0,vz:0,blastTimer:0};
  car.mesh.position.set(h.state.x-Math.sin(yaw)*3,0,h.state.z-Math.cos(yaw)*3);car.mesh.rotation.y=yaw;h.context.testCar=car;
  vm.runInContext(`function testCoastContact(car) {const coastMotionStart={x:state.x,y:state.y,z:state.z,yaw:state.yaw};const coastTrafficStart=new Map([[car,{x:car.mesh.position.x,z:car.mesh.position.z,yaw:car.mesh.rotation.y,visible:true}]]);const demoGroundSweep=null,isAirborne=false,playerWorldZ=state.z,dt=1/60;${collision}}testCoastContact(testCar);`,h.context);
  assert.equal(h.impacts.length,1);assert.equal(car.coastCooldown,1.8);assert.equal(car.speed,0);
 }
 const {coast}=api();const north=coast.contactBounds(0,0,4.62),east=coast.contactBounds(-Math.PI/2,-Math.PI/2,4.62);
 assert.ok(Math.abs(north.x-1.85)<1e-12&&Math.abs(north.z-4.46)<1e-12);
 assert.ok(Math.abs(east.x-4.46)<1e-12&&Math.abs(east.z-1.85)<1e-12);
});

test('coast traffic sweep intersects height over the whole overlap, not just entry or frame end',()=>{
 const start=physics.indexOf('    const dx = Math.abs(state.x - car.mesh.position.x);');
 const collision=physics.slice(start,physics.indexOf('\n  // Render the resolved pose',start)).replace(/\n  \}\);\s*$/,'');
 for(const spec of [
  {name:'rising through the side before clearing the roof',from:{x:-10,y:0,z:0},to:{x:10,y:3,z:0},vy:8,damage:true},
  {name:'descending into roof after horizontal entry',from:{x:-10,y:5,z:0},to:{x:10,y:0,z:0},vy:-8,roof:true},
  {name:'cleared roof for the entire chord',from:{x:-10,y:4,z:0},to:{x:10,y:5,z:0},vy:2,clear:true}
 ]){
  const h=coastMotion({...spec.to,yaw:-Math.PI/2,speed:20,vx:20,vy:spec.vy,vz:0});
  const car={mesh:mesh(),mode:'coast',length:4.62,height:1.25,y:0,vx:0,vz:0,blastTimer:0};car.mesh.rotation.y=-Math.PI/2;
  h.context.testCar=car;h.context.oldPlayer={...spec.from,yaw:-Math.PI/2};
  vm.runInContext(`function testCoastContact(car) {const coastMotionStart=oldPlayer;const coastTrafficStart=new Map([[car,{x:0,z:0,yaw:-Math.PI/2,visible:true}]]);const demoGroundSweep=null,isAirborne=true,playerWorldZ=state.z,dt=.05;${collision}}testCoastContact(testCar);`,h.context);
  if(spec.damage){assert.equal(h.impacts.length,1,spec.name);assert.ok(h.state.x<0);assert.ok(h.state.y<1.1);}
  if(spec.roof){assert.equal(h.impacts.length,0);assert.equal(h.state.vy,5.5);assert.equal(h.state.y,1.4);assert.ok(h.state.x<10);}
  if(spec.clear){assert.equal(h.impacts.length,0);assert.equal(h.state.x,10);assert.equal(h.state.y,5);}
 }
});

test('actual player and NPC wheel blocks retain highway calibration and meter scale on both free-roam maps',()=>{
 const playerStart=physics.indexOf('  const wheelSpinSpeed =');
 const player=physics.slice(playerStart,physics.indexOf('\n\n',playerStart));
 const npcStart=physics.indexOf('    if (car.mesh.userData.wheels) {');
 const npc=physics.slice(npcStart,physics.indexOf('\n    }',npcStart)+6);
 for(const currentMap of ['highway','city','coast']){
  const wheels=[{rotation:{x:0}}],npcWheels=[{rotation:{x:0}}],scale=currentMap==='highway'?1.65:1;
  vm.runInNewContext(player+'\n'+npc,{currentMap,state:{speed:20},car:{speed:20,mesh:{userData:{wheels:npcWheels}}},wheels,WORLD_SPEED_SCALE:1.65,CITY_WORLD_SPEED_SCALE:1,dt:.1});
  assert.ok(Math.abs(wheels[0].rotation.x+20*scale/.335*.1)<1e-9);
  assert.ok(Math.abs(npcWheels[0].rotation.x+20*scale/.33*.1)<1e-9);
 }
});

test('actual map switching isolates coast ownership/counts, blocks ranked starts and preserves existing maps',async()=>{
 const h=lifecycleHarness(),{coast}=api();let enters=0,leaves=0;
 // This wider menu test loads the real card/launch bindings omitted by the
 // controller-only lifecycle fixture, and the real traffic-label assignment.
 vm.runInContext(ui.slice(ui.indexOf('const cardHighwayEl ='),ui.indexOf('function clearAllInputKeys()')),h.context);
 const render=h.context.applyTranslations,trafficLine=ui.split('\n').find(s=>s.includes("getElementById('ui-traffic-btn').textContent"));
 h.context.applyTranslations=()=>{render();vm.runInContext('(()=>{const t=I18N[currentLang];'+trafficLine+'})();',h.context);};
 h.context.scene={};h.window.RoadsterCoast={...coast,enter(){enters++;},leave(){leaves++;},weather(){},buildings:()=>[]};
 await h.demo.toggle();await h.click('card-map-coast');assert.equal(vm.runInContext('currentMap',h.context),'highway');
 assert.equal(h.get('card-map-coast').getAttribute('aria-pressed'),'true');await h.click('btn-launch-selected-map');assert.equal(h.demo.isBusy(),false);assert.equal(enters,1);
 assert.equal(h.context.trafficCount,16);assert.equal(h.state.x,coast.respawn().x);assert.equal(h.get('ranked-start').disabled,true);
 assert.match(h.get('ui-traffic-btn').textContent,/16/);assert.doesNotMatch(h.get('ui-traffic-btn').textContent,/36/);
 await h.click('ranked-start');assert.equal(h.requests('/api/run').length,0);
 await h.click('btn-leaderboard');assert.equal(h.get('ranked-category').value,'highway-realistic');
 assert.ok(h.requests('/api/leaderboard').every(r=>!r.url.includes('coast')));
 h.context.switchMap('city');assert.equal(leaves,1);assert.equal(h.context.trafficCount,36);assert.equal(h.state.x,6);
 h.context.switchMap('highway');assert.equal(h.context.trafficCount,36);assert.equal(h.state.x,2.5);
});
