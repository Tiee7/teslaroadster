import test from'node:test';import assert from'node:assert/strict';import vm from'node:vm';import{readFileSync,existsSync}from'node:fs';import{motionHarness}from'./helpers/motion-harness.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8'),old=read('tests/fixtures/city-contact-baseline/physics-main.js'),next=read('src/physics-main.js');
const section=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)+a.length));
function drive(initial={},cars=[],source=next,trafficSource=source){
 const h=motionHarness(initial,'city',{'physics-main.js':source}),c=h.context;c.trafficCars=cars;c.hoverRingMat={opacity:1};c.explosions=[];c.sound.playCrash=()=>{};c.spawnDestructionDebris=()=>{};c.spawnExplosionEffect=(...args)=>c.explosions.push(args);c.applyExplosionBlastToTraffic=()=>{};c.updateDestroyedModalText=()=>{};
 vm.runInContext(section(source,'function triggerPhysicsCollision(','function updateDestroyedScores()'),c);
 const traffic=section(trafficSource,"  if (currentMap === 'coast') globalThis.window?.RoadsterCoast?.stepTraffic",'  // Render the resolved pose');vm.runInContext(`function trafficStep(dt,isAirborne){const playerWorldZ=state.z,demoGroundSweep=null;${traffic}}`,c);
 return{...h,frame(){h.state.impactCooldown=Math.max(0,h.state.impactCooldown-1/60);const result=h.step(1/60);if(!h.state.isDestroyed)c.trafficStep(1/60,result.isAirborne);return result;}};
}
function car({x=0,y=0,z=3.5,yaw=-Math.PI/2,vx=12,vz=0,...extra}={}){return{mode:'city',length:4.62,height:1.25,speed:Math.hypot(vx,vz),vx,vz,y,blastTimer:0,mesh:{visible:true,userData:{wheels:[]},position:{x,y,z},rotation:{x:0,y:yaw,z:0}},...extra};}
for(const airborneNpc of[false,true])test(`continuous EW traffic pass rejects former ${airborneNpc?'airborne-NPC ground ghost':'unrotated side-gap'} fatal witness`,()=>{
 const outcomes=[];for(const source of[old,next]){const npc=car(airborneNpc?{y:20,z:0,blastTimer:1,blastVx:12,blastVz:0,blastVy:0,blastVPitch:0,blastVYaw:0,blastVRoll:0}:{}),h=drive({x:-20,z:0,yaw:-Math.PI/2,speed:200/3.6,vx:200/3.6,vz:0},[npc],source);h.keys.KeyW=true;for(let i=0;i<60&&!h.state.isDestroyed;i++)h.frame();outcomes.push(h);}
 assert.equal(outcomes[0].state.isDestroyed,true,'preserved old-source fatal counterexample');assert.equal(outcomes[1].state.isDestroyed,false);assert.equal(outcomes[1].context.explosions.length,0);assert.ok(outcomes[1].state.x>20);
});
test('a true head-on city contact still destroys at the unchanged18G threshold',()=>{
 const h=drive({x:6,z:0,speed:40,vz:-40},[car({x:6,z:-30,yaw:Math.PI,vx:0,vz:14})]);h.keys.KeyW=true;for(let i=0;i<60&&!h.state.isDestroyed;i++)h.frame();assert.equal(h.state.isDestroyed,true);assert.ok(h.state.lastImpactG>=18);assert.equal(h.context.explosions.length,1);
});
test('continuous W parallel to building0 passes the visible0.482m gap; direct wall hits remain physical',()=>{
 const b={id:0,minX:-954,maxX:-924,minZ:-1068,maxZ:-1032,height:18,isHelipad:false};for(const gap of[1.5,0]){const outcomes=[];for(const source of[old,next]){const h=drive({x:-994,z:b.maxZ+gap,yaw:-Math.PI/2},[],source);h.context.cityBuildings.push(b);h.keys.KeyW=true;for(let i=0;i<180&&!h.state.isDestroyed;i++)h.frame();outcomes.push(h);}assert.equal(outcomes[0].state.isDestroyed,true);assert.equal(outcomes[1].state.isDestroyed,gap===0);if(gap>0)assert.ok(outcomes[1].state.x>b.maxX+2);}
});
test('continuous ground-start climb flies over the actual45.3m city shield, not an infinite air wall',()=>{
 for(const source of[old,next]){const h=drive({x:6,z:900,yaw:Math.PI,infiniteJet:true},[],source);h.keys.Space=true;for(let i=0;i<420;i++)h.frame();h.keys.Space=false;h.state.isAltitudeHold=true;h.state.holdTargetY=h.state.y;h.keys.KeyW=true;for(let i=0;i<900&&!h.state.isDestroyed;i++)h.frame();assert.equal(h.state.isDestroyed,source===old);if(source===next)assert.ok(h.state.z>1205);}
});
test('visible low wall still collides; shape above it or beyond its finite span does not',()=>{
 const h=drive();h.context.pose={x:6,y:0,z:1190,yaw:0};h.context.after={x:6,y:0,z:1205,yaw:0};assert.ok(vm.runInContext('cityVisibleBoundaryHit(pose,after)',h.context));for(const y of[45.31,70]){h.context.pose.y=h.context.after.y=y;assert.equal(vm.runInContext('cityVisibleBoundaryHit(pose,after)',h.context),null);}
});
const runtime=process.env.ROADSTER_THREE_RUNTIME||'/tmp/roadster-three.min.js';test('actual NPC near/far geometry supplies one stable variant-specific city collider without changing highway/coast length',{skip:!existsSync(runtime)&&'Official Three r128 required'},()=>{
 const c=vm.createContext({window:{},atob:s=>Buffer.from(s,'base64').toString('binary')});vm.runInContext(readFileSync(runtime,'utf8'),c);vm.runInContext('const trafficPalette=[0xffffff];function createTrafficVehicleMesh(){}function populateTraffic(){}'+read('src/npc-traffic-assets.js')+'\n'+read('src/reference-traffic.js')+';globalThis.api={make:createTrafficVehicleMesh,variants:archivedTrafficAssets.variants};',c);
 for(const v of c.api.variants){const mesh=c.api.make(0,v.id),b=c.window.RoadsterTrafficAssets.cityContactBounds(mesh);assert.ok(b.maxX-b.minX>=2);assert.ok(b.maxZ-b.minZ>=4.62);const before=b;c.window.RoadsterTrafficAssets.updateLods([{mesh}],mesh.position);assert.equal(mesh.userData.cityContactBounds,before);assert.equal(mesh.userData.length,4.62);assert.equal(mesh.userData.height,1.25);}
});


test('full Euler XYZ contact follows vertical/rolled visible car geometry, not a four-metre horizontal phantom',()=>{
 const h=drive();h.context.box={minX:-10,maxX:10,minZ:-10,maxZ:0,height:100};h.context.pose={x:0,y:50,z:1.5,yaw:0,pitch:Math.PI/2,roll:0};assert.equal(vm.runInContext('cityTouchesBuilding(pose,box)',h.context),false);
 h.context.pose.pitch=0;assert.equal(vm.runInContext('cityTouchesBuilding(pose,box)',h.context),true,'a real horizontal nose does reach this same wall');
});
test('full3D city contact matrix agrees with real Three r128 Euler XYZ for pitch/yaw/roll',{skip:!existsSync(runtime)&&'Official Three r128 required'},()=>{
 const h=drive();vm.runInContext(readFileSync(runtime,'utf8'),h.context);
 for(const pitch of[0,.6,Math.PI/2])for(const yaw of[0,.7,Math.PI/2])for(const roll of[0,-.8,Math.PI/2]){h.context.pose={x:12,y:30,z:-40,pitch,yaw,roll};const result=vm.runInContext(`(()=>{const body=cityContactBody(pose),m=new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(pose.pitch,pose.yaw,pose.roll));return {axes:body.axes,elements:m.elements};})()`,h.context);for(let i=0;i<3;i++)for(let j=0;j<3;j++)assert.ok(Math.abs(result.axes[i][j]-result.elements[i*4+j])<1e-12);}
});

test('player contact uses actual YXZ while traffic keeps XYZ; pitched roof-corner clearance is not a wall strike',{skip:!existsSync(runtime)&&'Official Three r128 required'},()=>{
 const h=drive();vm.runInContext(readFileSync(runtime,'utf8'),h.context);assert.match(read('src/vehicles.js'),/roadsterAttitudeGroup.rotation.order = 'YXZ'/);
 for(const pitch of[.3,.8,1.4])for(const yaw of[.4,1.1,2.2])for(const roll of[-.7,.2,1]){h.context.pose={x:0,y:30,z:0,pitch,yaw,roll};const result=vm.runInContext(`(()=>{const body=cityPlayerBody(pose),m=new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(pose.pitch,pose.yaw,pose.roll,'YXZ'));return {axes:body.axes,elements:m.elements};})()`,h.context);for(let i=0;i<3;i++)for(let j=0;j<3;j++)assert.ok(Math.abs(result.axes[i][j]-result.elements[i*4+j])<1e-12);}
 h.context.box={minX:-10,maxX:10,minZ:-10,maxZ:0,height:18};h.context.pose={x:0,y:17,z:1.2,yaw:0,pitch:Math.PI/4,roll:0};assert.equal(vm.runInContext('cityTouchesBuilding(pose,box)',h.context),true,'preserve projected roof query');assert.equal(vm.runInContext('cityBuildingContact(pose,box)',h.context),null,'all projected overlap lies above the actual roof');h.context.pose.y=15;assert.ok(vm.runInContext('cityBuildingContact(pose,box)',h.context),'a real lower nose/wall overlap remains physical');
});

test('finite city wall initial overlap depenetrates once and preserves a departing rebound; parallel motion has no false impact',()=>{
 const h=drive({x:6,y:20,z:-1196.8,speed:20,vz:-20,wasAirborne:true});h.frame();assert.ok(h.state.vz>0);const speed=h.state.vz;h.frame();assert.ok(h.state.vz>0&&h.state.vz<speed);assert.equal(h.state.isDestroyed,false);
 const tangent=drive({x:1198.5,y:10,z:0,vx:0,vz:-40,speed:40,wasAirborne:true});const clear=drive({x:6,y:10,z:0,vx:0,vz:-40,speed:40,wasAirborne:true});for(let i=0;i<20;i++){tangent.frame();clear.frame();for(const key of['vx','vz','speed','z'])assert.ok(Object.is(tangent.state[key],clear.state[key]),'parallel wall has no artificial drag or movement loss');}assert.equal(tangent.state.isDestroyed,false);assert.equal(tangent.context.explosions.length,0);assert.ok(tangent.state.z<-8,JSON.stringify({x:tangent.state.x,z:tangent.state.z,vx:tangent.state.vx,vz:tangent.state.vz,hull:tangent.state.hullIntegrity}));
});

test('fast descending car cannot die inside the gentle roof cushion before any actual3D body contact',()=>{
 const prior=read('tests/fixtures/city-roof-cushion-baseline/npc-step.js');
 const makeCar=()=>{const npc=car({x:6,z:-30,vx:0,vz:0,yaw:0});npc.mesh.userData.cityContactBounds={minX:-1.02,maxX:1.02,minY:.0162,maxY:1.1476,minZ:-2.358,maxZ:2.2987};return npc;};
 for(const productionTraffic of[prior,next]){const npc=makeCar(),h=drive({x:6,z:-30,y:1.89,vy:-30,airRemaining:0,isFreefalling:true,wasAirborne:true},[npc],next,productionTraffic);h.frame();assert.equal(h.state.isDestroyed,productionTraffic===prior,'exact old production NPC slice reproduces the fatal air gap');if(productionTraffic===next){assert.equal(h.state.hullIntegrity,100);assert.ok(h.state.y>npc.mesh.userData.cityContactBounds.maxY+.2);assert.ok(h.state.vy<-30,'fast fall continues without a fictitious early bounce');}}
 const hit=drive({x:6,z:-30,y:1.6,vy:-30,airRemaining:0,isFreefalling:true,wasAirborne:true},[makeCar()]);hit.frame();assert.equal(hit.state.isDestroyed,true,'real3D fast roof impact still destroys');
});
