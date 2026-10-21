import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {motionHarness} from './helpers/motion-harness.mjs';
const read=name=>readFileSync(new URL(`../src/${name}.js`,import.meta.url),'utf8');
const context=vm.createContext({window:{}});
vm.runInContext(read('coast-road-network')+'\n'+read('coast-map'),context);
const coast=context.window.RoadsterCoast,n=coast.network,ui=read('ui-hud');
function motion(p={}){
 const h=motionHarness(p,'coast');h.context.window.RoadsterCoast={...coast,buildings:()=>coast.layout().obstacles};
 vm.runInContext(ui.slice(ui.indexOf('function triggerJump6m()'),ui.indexOf('function toggleAltitudeHold()')),h.context);
 return h;
}
function initial(s,speed=20,id=0){const p=coast.pose(id,s);return{...p,speed,vx:p.vx*speed,vy:p.vy*speed,vz:p.vz*speed,coastSupportId:p.supportId,wasAirborne:false};}
const near=(a,b,e=.03)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);
for(const speed of[0,15,200/3.6,370/3.6])test(`production motion follows true terrain/bridge tire plane at ${speed}m/s without false gravity, damage or fuel burn`,()=>{
 for(let id=0;id<4;id++)for(let s=25;s<coast.routes[id].length;s+=47){
  const h=motion(initial(s,speed,id));h.keys.KeyW=speed>0;h.step(1/60);
  const support=coast.support({...h.state,grounded:true});
  near(h.state.y,support.height);assert.equal(h.state.wasAirborne,false);assert.equal(h.impacts.length,0);
  const attitude=n.groundAttitude(support.normal,h.state.yaw);near(h.state.pitch,attitude.pitch,1e-8);near(h.state.roll,attitude.roll,1e-8);
  assert.equal(h.state.airRemaining,10,'ordinary road travel is not lift/flight');
 }
});
test('slope-only gravity distinguishes coast uphill/downhill without changing EV constants',()=>{
 const up=motion(initial(1900,20)),down=motion(initial(4000,20));up.step(1/60);down.step(1/60);
 assert.ok(up.state.speed<20);assert.ok(Math.hypot(down.state.vx,down.state.vz)>Math.hypot(up.state.vx,up.state.vz));
});
for(const s of[1700,3800])test(`Space really detaches and keeps lifting from the ${s}m slope/bridge`,()=>{
 const h=motion(initial(s,0));h.keys.Space=true;
 const y=h.state.y;for(let i=0;i<30;i++)h.step(1/60);
 assert.ok(h.state.y>y+.5);assert.equal(h.state.wasAirborne,true);assert.equal(h.state.coastSupportId,null);assert.ok(h.state.airRemaining<10);
});
test('O targets six metres above actual attached bridge or the ground BELOW it, never the highest xz layer',()=>{
 const bridge=coast.pose(0,3800),top=motion({...bridge,speed:0,coastSupportId:bridge.supportId});top.context.triggerJump6m();near(top.state.jumpTargetY,bridge.y+6,1e-8);assert.equal(top.state.coastSupportId,null);
 for(let i=0;i<20;i++)top.step(1/60);assert.ok(top.state.y>bridge.y+5.5);assert.equal(top.impacts.length,0);
 const ground=coast.pose(1,1039),under=motion({...ground,speed:0,coastSupportId:ground.supportId});under.context.triggerJump6m();near(under.state.jumpTargetY,6,1e-8);
 for(let i=0;i<20;i++)under.step(1/60);assert.ok(under.state.y<7);assert.equal(under.impacts.length,0);
});
test('the production cabin hits bridge underside; upward impact cannot become a bridge-top landing',()=>{
 const p=coast.pose(1,1039),bridge=n.candidates(p.x,p.z).find(c=>c.bridge),h=motion({...p,y:bridge.height-n.SLAB_DEPTH-1.25-.08,vy:20,wasAirborne:true,coastSupportId:null});
 h.keys.Space=true;h.step(1/60);assert.ok(h.impacts.length>0);assert.ok(h.state.y<=bridge.height-n.SLAB_DEPTH-1.25+.001);assert.ok(h.state.vy<=0);assert.notEqual(h.state.coastSupportId,'road-0');
});
test('full-size bridge-lane vehicles do not strike diagonal rails, but a crossing chord does',()=>{
 let checked=0;for(let s=3250;s<4500;s+=11){const a=coast.pose(0,s),b=coast.pose(0,s+1);assert.equal(n.sweepStructures(a,b),null);checked++;}
 assert.ok(checked>100);
 const p=coast.pose(0,3800),q={...p,x:p.x-p.dz*(p.halfWidth+3),z:p.z+p.dx*(p.halfWidth+3)};assert.equal(n.sweepStructures(p,q).kind,'rail');
});
test('continuous pier contacts catch 200/370/fantasy-speed chords but do not create an invisible solid bridge wall',()=>{
 const pier=n.structures.find(b=>b.kind==='pier');assert.ok(pier);const z=(pier.minZ+pier.maxZ)/2,y=pier.minY+.2;
 for(const speed of[200/3.6,370/3.6,792/3.6]){const from={x:pier.minX-speed*.05-3,y,z,yaw:-Math.PI/2},to={...from,x:pier.maxX+speed*.05+3};assert.equal(n.sweepStructures(from,to).kind,'pier');}
 const p=coast.pose(1,1039),q=coast.pose(1,1041);assert.equal(n.sweepStructures(p,q),null);
});
test('a roof has exactly one original 4s/s recharge owner, not both road and roof owners',()=>{
 const b=coast.layout().buildings.find(b=>b.x===-5&&b.z===0),h=motion({x:b.x,z:b.z,y:b.height,airRemaining:5,coastSupportId:'roof'});h.step(1/60);near(h.state.airRemaining,5+4/60,1e-10);assert.equal(h.impacts.length,0);
});
test('a true airborne rooftop touchdown restores ground EV ownership instead of staying an invisible aircraft',()=>{
 const b=coast.layout().buildings.find(b=>b.x===-5&&b.z===0),h=motion({x:b.x,z:b.z,y:b.height+.2,vy:-3,wasAirborne:true,coastSupportId:null,airRemaining:5});
 for(let i=0;i<6;i++)h.step(1/60);
 assert.equal(h.state.wasAirborne,false);assert.equal(h.state.coastSupportId,'roof');near(h.state.y,b.height,1e-8);
 const air=h.state.airRemaining;h.keys.KeyW=true;h.step(1/60);assert.ok(h.state.airRemaining>=air,'electric throttle does not consume lift/rear gas');
});
test('a fast shallow deck-bottom scrape pays only normal impact, not the unrelated 50m/s tangential speed',()=>{
 const p=coast.pose(0,4500),bridge=n.candidates(p.x,p.z).find(c=>c.bridge),h=motion({...p,y:bridge.height-n.SLAB_DEPTH-1.25-.001,vy:1,wasAirborne:true,coastSupportId:null,speed:50,vx:p.dx*50,vz:p.dz*50});
 h.step(1/60);assert.ok(h.impacts.length>0);assert.ok(h.impacts[0][0]<6);assert.ok(Math.hypot(h.state.vx,h.state.vz)>45,'grazing contact keeps tangential motion');
});
test('a swept pier landing uses its contact material/position, not water at the frame endpoint',()=>{
 const h=motion({x:-809,y:.1,z:-650,vx:-120,vz:0,vy:-12,speed:120,airRemaining:0,isFreefalling:true,wasAirborne:true,coastSupportId:null});let resets=0;h.context.resetCar=()=>resets++;
 h.step(1/60);assert.equal(resets,0);near(h.state.y,0,1e-8);assert.ok(h.state.x>=-810);assert.equal(h.state.coastSupportId,'pier');
});
test('an already airborne low-altitude O tap cannot restart ground-hop inertia grace',()=>{
 const p=coast.pose(1,1039),h=motion({...p,y:.05,vy:1,wasAirborne:true,coastSupportId:null,jumpInertiaSeconds:.37,groundHopActive:false});h.context.triggerJump6m();assert.equal(h.state.groundHopActive,false);near(h.state.jumpInertiaSeconds,.37,1e-10);
});
test('a vehicle below the pier still contacts real water instead of falling forever below world zero',()=>{
 const h=motion({x:-600,y:-.39,z:-650,vy:-4,wasAirborne:true,coastSupportId:null,airRemaining:0,isFreefalling:true});let resets=0;h.context.resetCar=()=>resets++;
 h.step(1/60);assert.equal(resets,1);assert.ok(h.state.y<=-.4);
});
test('new hillside houses use absolute base/roof heights and solid foundations, not sea-level stretched walls',()=>{
 const houses=coast.layout().hillsideBuildings;assert.equal(houses.length,8);
 for(const b of houses){assert.ok(b.baseY>6&&b.height>b.baseY+8);const nearRoad=n.nearestSegment(b.x,b.z);assert.ok(!nearRoad||nearRoad.distance>nearRoad.halfWidth+45);
  for(const dx of[-b.w/2,0,b.w/2])for(const dz of[-b.d/2,0,b.d/2]){const ground=n.terrainSupport(b.x+dx,b.z+dz).height;assert.ok(b.baseY>=ground&&b.minY<=ground,'foundation covers all actual terrain under the footprint');}
  const h=motion({x:b.x,z:b.z,y:b.height+.001,vy:-.1,airRemaining:5});h.step(1/60);near(h.state.y,b.height,1e-8);assert.equal(h.state.vy,0);assert.equal(h.impacts.length,0);near(h.state.airRemaining,5+4/60,1e-8);
  const s={x:b.maxX+10,z:b.z,y:b.minY-3,vx:20,vz:0,speed:20};assert.equal(coast.clipBuildings({x:b.minX-10,z:b.z,y:s.y},s),null,'no hidden wall extends below the foundation');
 }
});
