import test from'node:test';import assert from'node:assert/strict';import vm from'node:vm';import{readFileSync}from'node:fs';import{motionHarness}from'./helpers/motion-harness.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function world(old=false){const c=vm.createContext({window:{}});for(const p of old?['tests/fixtures/coast-terrain-v2-baseline/road-network-before-surface-handoff.js','tests/fixtures/coast-terrain-v2-baseline/coast-map-before-surface-handoff.js']:['src/coast-road-network.js','src/coast-map.js'])vm.runInContext(read(p),c);return c.window.RoadsterCoast;}
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function nearest(path,q){let best=null;for(let i=0;i<path.stations.length-1;i++){const a=path.stations[i],b=path.stations[i+1],dx=b.x-a.x,dz=b.z-a.z,t=clamp(((q.x-a.x)*dx+(q.z-a.z)*dz)/(dx*dx+dz*dz),0,1),x=a.x+t*dx,z=a.z+t*dz,d=(x-q.x)**2+(z-q.z)**2;if(!best||d<best.d)best={d,s:a.s+t*(b.s-a.s)};}return best;}
function grassToHill(C,id=0,speed=20,seconds=95){
 const N=C.network,path=N.trafficPath(id),start=id===0?1400:path.length-2200,centre=N.sampleRoute(id,start,0),p={...centre,x:centre.x-centre.dz*8,z:centre.z+centre.dx*8},support=C.support({...p,grounded:true}),h=motionHarness({...p,y:support.height,speed,vx:p.vx*speed,vy:p.vy*speed,vz:p.vz*speed,coastSupportId:support.id,wasAirborne:false},'coast');h.context.window.RoadsterCoast={...C,buildings:()=>[]};const input={};h.context.window.RoadsterTouch={readInput:()=>input};let firstUnder=null,highest=0,handoffs=0,previous=support.id,bridge=false;
 for(let i=0;i<seconds*60;i++){
  const near=nearest(path,h.state),v=Math.hypot(h.state.vx,h.state.vz),look=Math.max(7,v*.6),goal=N.sampleRoute(id,near.s+look),want=Math.atan2(-(goal.x-h.state.x),-(goal.z-h.state.z)),error=Math.atan2(Math.sin(want-h.state.yaw),Math.cos(want-h.state.yaw)),rate=2*Math.sin(error)*v/look;
  input.steer=clamp(-rate/(2.35/(1+v*.015)),-1,1);input.throttle=v<speed?1:0;input.brake=v>speed+.2?.1:0;h.step(1/60);
  const road=N.candidates(h.state.x,h.state.z).find(s=>s.id===`road-${id%2}`),offset=nearest(path,h.state).d;
  if(previous!==h.state.coastSupportId){handoffs++;previous=h.state.coastSupportId;}
  if(road&&offset<2.5**2){highest=Math.max(highest,road.height);bridge ||=road.bridge;if(road.height-h.state.y>.16&&!firstUnder)firstUnder={frame:i,y:h.state.y,road:road.height,id:h.state.coastSupportId};}
 }
 return{h,firstUnder,highest,handoffs,bridge};
}
test('preserved published grass→asphalt→slope continuous-driving counterexample cuts through the road',()=>{
 const r=grassToHill(world(true),0,20,14);assert.ok(r.firstUnder&&r.firstUnder.road-r.firstUnder.y>.16);assert.equal(r.firstUnder.id,'terrain');
});
test('real production controls hand off grass to asphalt and follow the complete climb into the bridge, never resetting support per frame',()=>{
 const r=grassToHill(world(),0,20,110);assert.equal(r.firstUnder,null);assert.ok(r.highest>63.8&&r.bridge);assert.ok(r.handoffs>=1);assert.equal(r.h.impacts.length,0);
});
test('coincident ground can hand off but a distant bridge top never magnetizes terrain from below',()=>{
 const C=world(),N=C.network;let same=0,under=0;for(let s=0;s<N.routes[0].length;s+=7){const p=N.sampleRoute(0,s),terrain=N.terrainSupport(p.x,p.z),q=N.querySupport({...p,y:terrain.height,grounded:true,previousSupportId:'terrain'});if(Math.abs(terrain.height-p.y)<.0001){assert.equal(q.id,'road-0');same++;}if(p.bridge&&p.y-terrain.height>6){assert.notEqual(q.id,'road-0');under++;}}
 assert.ok(same>100&&under>5);
});
function bankApproach(C,lateral,start=3180,id=0){
 const N=C.network,p=N.sampleRoute(id,start,0),x=p.x-p.dz*lateral,z=p.z+p.dx*lateral,ground=C.support({x,z,y:p.y+.1,grounded:true}),goal=N.sampleRoute(id,start+70,1.75),yaw=Math.atan2(-(goal.x-x),-(goal.z-z)),speed=10,h=motionHarness({x,z,y:ground.height,yaw,coastSupportId:ground.id,speed,vx:-Math.sin(yaw)*speed,vz:-Math.cos(yaw)*speed,wasAirborne:false},'coast');h.context.window.RoadsterCoast={...C,buildings:()=>[]};let under=null;
 for(let i=0;i<600;i++){if(i>190&&!h.state.wasAirborne)h.keys.KeyW=true;h.step(1/60);const deck=N.candidates(h.state.x,h.state.z).find(s=>s.road&&s.bridge);if(deck&&h.state.y+1.25<deck.height-N.SLAB_DEPTH&&!h.state.wasAirborne){under={frame:i,y:h.state.y,deck:deck.height};break;}}
 return{initialSupport:ground.id,under,h};
}
test('original legal bank approach falls beneath the bridge, while real abutment wings close outer-bank bypasses',()=>{
 const old=bankApproach(world(true),8);assert.ok(old.under,'preserved true 284-frame under-bridge driving witness');
 for(const offset of[8,14,18,24,-18,-24]){const r=bankApproach(world(),offset);assert.equal(r.under,null,`offset${offset}: no driving through the bank end beneath the deck`);if(Math.abs(offset)>=18)assert.ok(r.h.impacts.length>0,'outer-bank route meets a real visible abutment, not a support snap or silent void');}
});
