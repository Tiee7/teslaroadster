import test from'node:test';import assert from'node:assert/strict';import vm from'node:vm';import{readFileSync}from'node:fs';import{performance}from'node:perf_hooks';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function network(source){const c=vm.createContext({__narrow:0});vm.runInContext(source.replace('let enter=0,exit=1,normal=null;','globalThis.__narrow++;let enter=0,exit=1,normal=null;')+';globalThis.api=RoadsterCoastRoads;',c);return{n:c.api,c};}
const old=network(read('tests/fixtures/performance-passengers-baseline/coast-road-network.js')),next=network(read('tests/fixtures/coast-pier-baseline/coast-road-network.js'));
const result=h=>h?{t:h.t,kind:h.kind,height:h.height,normal:JSON.parse(JSON.stringify(h.normal)),box:h.box?{kind:h.box.kind,minX:h.box.minX,maxX:h.box.maxX,minZ:h.box.minZ,maxZ:h.box.maxZ,minY:h.box.minY,maxY:h.box.maxY}:null}:null;
let seed=72813;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
test('conservative 3.4m swept broadphase is exact for seeded chords, every rail/pier/abutment, yaw and vertical direction',()=>{
 const cases=[];for(let i=0;i<1800;i++){const a={x:-300+random()*1400,z:-1100+random()*2200,y:random()*90,yaw:(random()-.5)*Math.PI*2},b={x:a.x+(random()-.5)*60,z:a.z+(random()-.5)*60,y:a.y+(random()-.5)*15,yaw:a.yaw};cases.push([a,b]);}
 for(const box of old.n.structures)for(const yaw of[0,.7,-1.8]){const a={x:(box.minX+box.maxX)/2-8,z:(box.minZ+box.maxZ)/2,y:(box.minY+box.maxY)/2,yaw},b={...a,x:a.x+16};cases.push([a,b]);cases.push([{...a,y:box.minY-3},{...b,y:box.maxY+3}]);}
 let hits=0;for(const[a,b]of cases){const before=result(old.n.sweepStructures(a,b)),after=result(next.n.sweepStructures(a,b));assert.deepEqual(after,before);if(before)hits++;}assert.ok(hits>500);assert.ok(next.c.__narrow<old.c.__narrow*.025,'at least97.5% of expensive OBB setups rejected without changing hits');
});
test('actual road-lane sweeps retain exact contacts with bounded narrow-phase setup and report CPU-only timing',t=>{
 const cases=[];for(const id of[0,2])for(const lane of[1.75,5.25,8.75])for(let s=0;s<old.n.trafficPath(id,lane).length;s+=23)cases.push([old.n.sampleRoute(id,s,lane),old.n.sampleRoute(id,s+1.5,lane)]);
 const measurements=[];for(const h of[old,next]){h.c.__narrow=0;const start=performance.now();for(const[a,b]of cases)h.n.sweepStructures(a,b);measurements.push({milliseconds:performance.now()-start,narrowSetups:h.c.__narrow});}assert.ok(measurements[1].narrowSetups<measurements[0].narrowSetups*.015);t.diagnostic(JSON.stringify({scope:'CPU sweep function microbenchmark, not GPU/FPS/device-temperature evidence',queries:cases.length,baseline:measurements[0],candidate:measurements[1]}));
});

test('a2.6m car-radius bound loses the old projected-OBB contact;3.4m preserves that exact witness',()=>{
 const bad=network(read('src/coast-road-network.js').replaceAll('-3.4','-2.6').replaceAll('+3.4','+2.6'));const a={x:958.071413,y:55.550581,z:-323.327265,yaw:0},b={x:958.026577,y:55.550581,z:-323.367136,yaw:0};
 const hit=result(old.n.sweepStructures(a,b));assert.ok(hit&&hit.kind==='rail');assert.equal(bad.n.sweepStructures(a,b),null);assert.deepEqual(result(next.n.sweepStructures(a,b)),hit);
});

test('current oriented/rotating pier CCD retains conservative broadphase equivalence to all-structure scanning',()=>{
 const source=read('src/coast-road-network.js'),raw=source.replace('if(box.maxX<minX||box.minX>maxX||box.maxZ<minZ||box.minZ>maxZ||box.maxY<minY||box.minY>maxY)continue;','').replace('if(box.maxX<Math.min(px,next.x)-3.4||box.minX>Math.max(px,next.x)+3.4||box.maxZ<Math.min(pz,next.z)-3.4||box.minZ>Math.max(pz,next.z)+3.4||box.maxY<Math.min(py,next.y)||box.minY>Math.max(py,next.y)+height)return null;','');
 assert.notEqual(raw,source);const current=network(source),oracle=network(raw);let seed=99114;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296),cases=[];
 for(const p of current.n.structures.filter(p=>p.kind==='pier'))for(const yaw of[0,.4,Math.PI/2,2.4])for(const turn of[0,.2,-.4]){const a={x:(p.minX+p.maxX)/2-7,z:(p.minZ+p.maxZ)/2+2.5,y:(p.minY+p.maxY)/2,yaw},b={...a,x:a.x+14,z:a.z-5,yaw:yaw+turn};cases.push([a,b]);}
 for(let i=0;i<400;i++){const a={x:-1200+random()*2400,z:-1200+random()*2400,y:random()*90,yaw:random()*Math.PI*2},b={...a,x:a.x+(random()-.5)*100,z:a.z+(random()-.5)*100,y:a.y+(random()-.5)*10,yaw:a.yaw+(random()-.5)*.8};cases.push([a,b]);}
 for(const[a,b]of cases)assert.deepEqual(result(current.n.sweepStructures(a,b)),result(oracle.n.sweepStructures(a,b)));
});
