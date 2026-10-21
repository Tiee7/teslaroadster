import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const context=vm.createContext({});
vm.runInContext(readFileSync(new URL('../src/coast-road-network.js',import.meta.url),'utf8')+';globalThis.network=RoadsterCoastRoads;',context);
const n=context.network;
const near=(a,b,e=1e-5)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);
test('terrain-v2 closed Float32 meter-scale source: 0–64m, gentle slopes, real 40m+ curves and bounded geometry',()=>{
 assert.equal(n.version,2);assert.equal(n.ROAD_WIDTH,9);
 const stats=n.stats();assert.ok(stats.mainLength>5300&&stats.mainLength<5700);assert.ok(stats.stations<=2048);
 assert.ok(stats.maxHeight>63.9&&stats.maxHeight<=64);assert.ok(stats.maxGrade<=.08);
 assert.ok(stats.roadTriangles<=16384);assert.equal(stats.terrainTriangles,8192);
 for(const r of n.routes){
  const first=r.stations[0],last=r.stations.at(-1);for(const axis of ['x','y','z'])near(first[axis],last[axis]);
  for(let i=1;i<r.stations.length-1;i++){
   const a=r.stations[i-1],b=r.stations[i],c=r.stations[i+1];
   const ab=Math.hypot(b.x-a.x,b.z-a.z),bc=Math.hypot(c.x-b.x,c.z-b.z),ac=Math.hypot(c.x-a.x,c.z-a.z);
   const twiceArea=Math.abs((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x));
   if(twiceArea>1e-7)assert.ok(ab*bc*ac/(2*twiceArea)>=40,'horizontal minimum radius');
   assert.ok(Math.abs(b.x)<1190&&Math.abs(b.z)<1190);assert.equal(b.x,Math.fround(b.x));
  }
 }
});
test('all four directed traffic routes have continuous mesh support and full vehicle corners on road',()=>{
 for(let id=0;id<4;id++)for(let s=0;s<n.routes[id%2].length;s+=2){
  const p=n.sampleRoute(id,s);for(const key of ['x','y','z','vx','vy','vz','pitch','roll'])assert.ok(Number.isFinite(p[key]));
  near(Math.hypot(p.vx,p.vy,p.vz),1,1e-10);
  for(const forward of [-2.31,2.31])for(const right of [-.98,.98]){
   const x=p.x+p.dx*forward-p.dz*right,z=p.z+p.dz*forward+p.dx*right;
   assert.ok(n.candidates(x,z).some(c=>c.road&&Math.abs(c.height-p.y)<.5),'full-size car on supported carriageway');
  }
  assert.ok(n.terrainSupport(p.x,p.z).height<=p.y+.025,'landscape cannot cover asphalt');
 }
});
test('two actual ground-road/viaduct crossings have 6m+ clearance and cannot magnetize a vehicle from below',()=>{
 const crossings=[];for(let s=0;s<n.routes[1].length;s+=1){const p=n.sampleRoute(1,s,0),bridge=n.candidates(p.x,p.z).find(c=>c.id==='road-0'&&c.bridge);if(bridge)crossings.push({p,bridge});}
 assert.ok(crossings.length>=12);
 assert.ok(crossings.some(c=>c.p.z<400)&&crossings.some(c=>c.p.z>800));
 for(const {p,bridge} of crossings){
  assert.ok(bridge.height-p.y-n.SLAB_DEPTH>=6);
  const ground=n.querySupport({...p,previousY:p.y,grounded:true,previousSupportId:'road-1'});
  near(ground.height,p.y);assert.notEqual(ground.id,'road-0');
  const top=n.querySupport({...p,y:bridge.height,previousY:bridge.height,grounded:true,previousSupportId:'road-0'});
  assert.equal(top.id,'road-0');near(top.height,bridge.height);
  assert.equal(n.sweepLanding({...p,y:p.y+2},{...p,y:p.y+1}),null,'ascending/air below deck cannot land on it');
  const landing=n.sweepLanding({...p,y:bridge.height+3},{...p,y:bridge.height-3});assert.equal(landing.id,'road-0');
 }
});
test('ground normal converted to YXZ pitch/roll agrees with forward/reverse slope direction',()=>{
 for(let id=0;id<4;id++)for(let s=0;s<n.routes[id%2].length;s+=13){
  const p=n.sampleRoute(id,s),cp=Math.cos(p.pitch),sp=Math.sin(p.pitch),cr=Math.cos(p.roll),sr=Math.sin(p.roll),cy=Math.cos(p.yaw),sy=Math.sin(p.yaw);
  const normal={x:cy*(-sr)+sy*sp*cr,y:cp*cr,z:-sy*(-sr)+cy*sp*cr};
  near(normal.x,p.normal.x,1e-10);near(normal.y,p.normal.y,1e-10);near(normal.z,p.normal.z,1e-10);
 }
});
test('a single fast downward chord selects the FIRST bridge top, never the ground beneath it',()=>{
 const p=n.sampleRoute(1,1039,0),bridge=n.candidates(p.x,p.z).find(c=>c.bridge);
 const hit=n.sweepLanding({...p,y:bridge.height+8},{...p,y:-2});
 assert.equal(hit.id,'road-0');near(hit.height,bridge.height);assert.ok(hit.t<.3);
});
test('mountain earth joins are broad gentle slopes, not narrow 80–272% dirt walls; pier link reaches the actual curved road',()=>{
 for(const t of n.banks)assert.ok(Math.hypot(t.normal.x,t.normal.z)/t.normal.y<=.30,'maximum30% earth bank grade');
 assert.ok(n.access.length>210&&n.access.length<220);
 for(let x=-250;x<=n.access.stations.at(-1).x;x+=.5)for(const dz of[-.98,0,.98])assert.ok(n.candidates(x,-650+dz).some(s=>s.road),'no28m grass gap at pier junction');
 const end=n.access.stations.at(-1);assert.ok(n.candidates(end.x,end.z).some(s=>s.id==='road-0'&&Math.abs(s.height-end.y)<.03),'true same-height primary-road connection');
});
test('the preserved pre-fix C-junction counterexample cuts through NPC wheels; final full-width nonbridge junctions are level',()=>{
 const old=vm.runInNewContext(readFileSync(new URL('./fixtures/coast-terrain-v2-baseline/road-network-before-level-junctions.js',import.meta.url),'utf8')+';RoadsterCoastRoads;');
 const bad=old.sampleRoute(3,1053.2);assert.ok(old.candidates(bad.x,bad.z).some(s=>s.road&&!s.bridge&&s.height>bad.y+.35),'preserved real37cm-cut counterexample');
 const points=new Map();for(const t of n.triangles)if(t.id.startsWith('road')&&!t.bridge){for(const p of[t.a,t.b,t.c,{x:(t.a.x+t.b.x+t.c.x)/3,y:(t.a.y+t.b.y+t.c.y)/3,z:(t.a.z+t.b.z+t.c.z)/3}])points.set(`${p.x},${p.z},${p.y}`,p);}
 for(const p of points.values())for(const s of n.candidates(p.x,p.z))if(s.road&&!s.bridge)near(s.height,p.y,.02);
 for(let id=0;id<4;id++)for(let s=0;s<n.trafficPath(id).length;s+=.5){const p=n.sampleRoute(id,s);for(const top of n.candidates(p.x,p.z))if(top.road&&!top.bridge)assert.ok(top.height<=p.y+.02,'no other nonbridge asphalt cuts any NPC wheel/body');}
});
test('viaduct is two-way six 3.5m lanes with metre-wide shoulders and smooth same-source widening',()=>{
 assert.equal(n.BRIDGE_ROAD_WIDTH,23);let wide=0,transitions=0;
 for(const segment of n.segments.filter(s=>s.routeId===0)){
  for(const p of[segment.a,segment.b]){assert.ok(p.halfWidth>=4.5&&p.halfWidth<=11.5);if(p.bridge){near(p.halfWidth,11.5);wide++;}if(p.halfWidth>4.51&&p.halfWidth<11.49)transitions++;}
  assert.ok(Math.abs(segment.a.halfWidth-segment.b.halfWidth)<.35,'gradual approach taper, not a width step');
 }
 assert.ok(wide>500&&transitions>100);
 for(const id of[0,2])for(const lane of[1.75,5.25,8.75])for(let s=3300;s<4600;s+=17){const p=n.sampleRoute(id,s,lane);if(!p.bridge)continue;
  for(const forward of[-2.31,2.31])for(const right of[-.98,.98])assert.ok(n.candidates(p.x+p.dx*forward-p.dz*right,p.z+p.dz*forward+p.dx*right).some(c=>c.id==='road-0'&&Math.abs(c.height-p.y)<.5),'all six full-size vehicle footprints share visible deck support');
  assert.equal(n.sweepStructures(p,n.sampleRoute(id,s+.2,lane)),null,'no lane is blocked by rendered/collision rail');
 }
});
test('real approach guide rails converge from the bank onto both deck edges with no open bank-end mouth',()=>{
 const bridge=n.segments.filter(s=>s.bridge),first=bridge[0],last=bridge.at(-1),guides=n.structures.filter(s=>s.guide);assert.ok(guides.length>100);
 for(const p of[first.a,last.b])for(const side of[-1,1]){const target={x:p.x+p.rx*side*p.halfWidth,z:p.z+p.rz*side*p.halfWidth};assert.ok(guides.some(g=>[g.a,g.b].some(q=>Math.hypot(q.x-target.x,q.z-target.z)<.001&&Math.abs(q.y-p.y)<.001)),'guide physically closes at the exact visible deck-edge station');}
});
test('additional real hill masses enrich the inland terrain while road/underpass geometry stays unchanged',()=>{
 const old=vm.runInNewContext(readFileSync(new URL('./fixtures/coast-terrain-v2-baseline/road-network-before-surface-handoff.js',import.meta.url),'utf8')+';RoadsterCoastRoads;');
 for(const[x,z]of[[1120,-1000],[720,650]])assert.ok(n.terrainSupport(x,z).height>old.terrainSupport(x,z).height+15);
 near(n.routes[0].length,old.routes[0].length);near(n.stats().maxHeight,old.stats().maxHeight);
});
test('all traffic lane station boundaries and micro-perturbations keep real road support, never fall back to terrain',()=>{
 const old=vm.runInNewContext(readFileSync(new URL('./fixtures/driving-feedback-baseline/road-network-before-station-neighbours.js',import.meta.url),'utf8')+';RoadsterCoastRoads;');
 const bad=old.sampleRoute(0,3767.198502582747,5.25);assert.ok(old.candidates(bad.x,bad.z).some(c=>c.id==='road-0'&&c.height>bad.y+46),'preserve exact station46.56m drop witness');
 let checked=0;for(const route of[0,1,2,3])for(const lane of[1.75,5.25,8.75])for(const station of n.trafficPath(route,lane).stations)for(const delta of[-.001,-.00001,0,.00001,.001]){
  const p=n.sampleRoute(route,station.s+delta,lane),surfaces=n.candidates(p.x,p.z).filter(c=>c.road&&Math.abs(c.height-station.y)<.01);
  assert.ok(p.supportId.startsWith('road-'),'legitimate NPC lane never silently uses terrain');assert.ok(surfaces.length,`independent road candidate route${route} lane${lane} s${station.s}`);assert.ok(surfaces.some(c=>Math.abs(c.height-p.y)<1e-7));near(p.y,station.y,.001);checked++;
 }assert.ok(checked>45000);
});
