import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {fixture} from './helpers/reference-fixture.mjs';
const source=readFileSync(new URL('../src/npc-traffic-assets.js',import.meta.url),'utf8');
const context=vm.createContext({atob:text=>Buffer.from(text,'base64').toString('binary')});
vm.runInContext(source+';this.assets=archivedTrafficAssets;this.unpack=unpackArchivedTrafficGeometry;',context);
const assets=context.assets;
const catalogPath=new URL('../assets/vehicle-variants/'+assets.archiveCatalog,import.meta.url),catalogBytes=readFileSync(catalogPath),catalog=JSON.parse(catalogBytes);
const asArray=value=>Array.from(value);

test('clean traffic profiles cover every historical entry without enabling a quarantined derivative',()=>{
 assert.equal(assets.format,'roadster-traffic-retopology-v1');assert.equal(assets.generator,'parameter-grid-boundary-v1');
 assert.equal(createHash('sha256').update(catalogBytes).digest('hex'),assets.archiveCatalogSha256);
 assert.equal(catalog.entries.length,20);assert.equal(catalog.geometryVariants.length,12);
 const covered=new Set(assets.variants.flatMap(v=>asArray(v.archiveEntries)));
 for(const entry of catalog.entries)assert.ok(covered.has(entry.id),entry.id);
 for(const variant of catalog.geometryVariants){const live=assets.variants.find(v=>v.id===variant.id);assert.ok(live);assert.equal(live.sourceGeometrySha256,variant.geometrySha256);}
 for(const id of ['legacy-classic-roadster','legacy-sculpted-track','legacy-sculpted-touring'])assert.ok(assets.variants.some(v=>v.id===id));
 assert.doesNotMatch(source,/vertex-cluster-v1|shared-position-cluster-v2|objects\/[a-f0-9]{2}\//);
});
test('packed shared geometry is finite, bounded, hash-checked and front-wound after transport',()=>{
 let totalBytes=0;
 for(const record of assets.geometryPool){
  const packed=Buffer.from(record.packed,'base64');totalBytes+=packed.length;
  assert.equal(createHash('sha256').update(packed).digest('hex'),record.sha256);
  const g=context.unpack(record);assert.equal(g.position.length,record.vertexCount*3);assert.equal(g.index.length,record.indexCount);
  assert.ok(g.position.every(Number.isFinite));assert.ok(g.normal.every(Number.isFinite));assert.ok(g.index.every(i=>i<record.vertexCount));
  for(let i=0;i<g.normal.length;i+=3)assert.ok(Math.abs(Math.hypot(...g.normal.slice(i,i+3))-1)<1e-5);
  for(let i=0;i<g.index.length;i+=3){
   const [a,b,c]=g.index.slice(i,i+3),p=j=>asArray(g.position.slice(j*3,j*3+3)),A=p(a),B=p(b),C=p(c),ab=B.map((v,k)=>v-A[k]),ac=C.map((v,k)=>v-A[k]);
   const n=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]],area=Math.hypot(...n);
   if(area<1e-8)continue;
   const avg=[0,1,2].map(k=>g.normal[a*3+k]+g.normal[b*3+k]+g.normal[c*3+k]);
   assert.ok(n.reduce((s,v,k)=>s+v*avg[k],0)>-1e-7,`${record.material} reversed triangle ${i/3}`);
  }
 }
 assert.ok(assets.geometryPool.length<=90);assert.ok(totalBytes<3_000_000);
 for(const variant of assets.variants)for(const level of ['near','far']){
  const data=variant.levels[level],triangles=data.geometries.reduce((s,i)=>s+assets.geometryPool[i].indexCount/3,0);
  assert.equal(data.triangles,triangles);assert.ok(triangles<=(level==='near'?19000:3500));assert.equal(data.draws,6);
 }
});
test('spawn randomness happens once and chooses all source identities without per-frame changes',()=>{
 const f=fixture();let calls=0;f.context.Math.random=()=>{calls++;return .3;};
 const car=f.createTrafficVehicleMesh(3),identity=car.userData.trafficVariant,entry=car.userData.archiveEntry;
 assert.equal(calls,1);
 for(let frame=0;frame<180;frame++){
  car.position.set(frame,0,frame%2?-400:400);
  f.window.RoadsterTrafficAssets.updateLods([{mesh:car}],{x:0,y:2,z:4});
  assert.equal(car.userData.trafficVariant,identity);assert.equal(car.userData.archiveEntry,entry);
 }
 assert.equal(calls,1,'rendering/movement/LOD/wrap do not consume random choices');
 const seen=new Set(),choices=assets.variants.flatMap(v=>asArray(v.archiveEntries).map(entry=>({id:v.id,entry})));
 for(let i=0;i<choices.length;i++){f.context.Math.random=()=> (i+.5)/choices.length;const spawned=f.createTrafficVehicleMesh(i);seen.add(spawned.userData.archiveEntry);assert.equal(spawned.userData.trafficVariant,choices[i].id);}
 assert.equal(seen.size,new Set(choices.map(x=>x.entry)).size);
});
test('geometry and materials are shared across instances and repeated LOD changes',()=>{
 const f=fixture(),id=assets.variants[0].id,a=f.createTrafficVehicleMesh(2,id),b=f.createTrafficVehicleMesh(2,id);
 for(let i=0;i<6;i++){assert.equal(a.children[i].geometry,b.children[i].geometry);assert.equal(a.children[i].material,b.children[i].material);}
 const far=a.children.map(m=>m.geometry);
 f.window.RoadsterTrafficAssets.updateLods([{mesh:a},{mesh:b}],{x:0,y:0,z:0});
 for(let i=0;i<6;i++)assert.equal(a.children[i].geometry,b.children[i].geometry);
 const near=a.children.map(m=>m.geometry);
 a.position.z=100;b.position.z=100;
 f.window.RoadsterTrafficAssets.updateLods([{mesh:a},{mesh:b}],{x:0,y:0,z:0});
 for(let i=0;i<6;i++)assert.equal(a.children[i].geometry,far[i]);
 a.position.z=0;f.window.RoadsterTrafficAssets.updateLods([{mesh:a}],{x:0,y:0,z:0});
 for(let i=0;i<6;i++)assert.equal(a.children[i].geometry,near[i]);
 assert.equal(f.window.RoadsterTrafficAssets.stats().sharedMaterials,14);
});
test('LOD caps nearby detail and each style preserves normal traffic dimensions',()=>{
 const f=fixture(),cars=[];
 for(let i=0;i<52;i++){const mesh=f.createTrafficVehicleMesh(i,assets.variants[i%assets.variants.length].id);mesh.position.set(i*.2,0,0);cars.push({mesh,speed:16+i/10,desiredSpeed:16+i/10});}
 const speeds=cars.map(c=>[c.speed,c.desiredSpeed]);
 f.window.RoadsterTrafficAssets.updateLods(cars,{x:0,y:0,z:0});
 assert.equal(cars.filter(c=>c.mesh.userData.trafficDetail==='near').length,8);
 assert.deepEqual(cars.map(c=>[c.speed,c.desiredSpeed]),speeds);
 assert.ok(cars.reduce((n,c)=>n+c.mesh.userData.triangleCount,0)<300000);
 assert.ok(cars.every(c=>c.mesh.children.length===6&&c.mesh.userData.length===4.62&&c.mesh.userData.height===1.25));
 assert.ok(f.window.RoadsterTrafficAssets.stats().cachedGeometries<=assets.geometryPool.length);
});
test('both maps cap repeated populations without growing shared geometry or retaining removed instances',()=>{
 const f=fixture();vm.runInContext('const LANE_COUNT=6,LANE_CENTERS=[-8.75,-5.25,-1.75,1.75,5.25,8.75],CITY_ROAD_COORDS=[-240,-120,0,120,240];this.population=populateTraffic;this.cars=()=>trafficCars;this.group=trafficGroup;',f.context);
 for(const map of ['highway','city']){
  vm.runInContext(`currentMap='${map}'`,f.context);
  for(const count of [20,36,52,200,0,52]){
   f.context.population(count);const cars=f.context.cars();assert.equal(cars.length,Math.min(52,count));assert.equal(f.context.group.children.length,cars.length);
   for(const car of cars){assert.equal(car.mode,map);assert.equal(car.length,4.62);assert.equal(car.height,1.25);}
   f.window.RoadsterTrafficAssets.updateLods(cars,{x:0,y:2,z:0});
  }
 }
 assert.ok(f.window.RoadsterTrafficAssets.stats().cachedGeometries<=assets.geometryPool.length);
 f.context.population(NaN);assert.equal(f.context.cars().length,0);
});

test('legacy canopy tiers keep the same closed crown and original roof rails stay densely sampled',()=>{
 for(const id of ['legacy-classic-roadster','legacy-sculpted-track','legacy-sculpted-touring']){
  const variant=assets.variants.find(v=>v.id===id),canopies=[];
  for(const level of ['near','far']){
   const geometryIndex=variant.levels[level].geometries.find(i=>assets.geometryPool[i].material==='glass'),record=assets.geometryPool[geometryIndex],g=context.unpack(record);
   let top=-Infinity;for(let i=1;i<g.position.length;i+=3)top=Math.max(top,g.position[i]);
   assert.ok(top>(id==='legacy-classic-roadster'?1.14:1.05),`${id} ${level} lost its canopy crown`);
   assert.ok(record.indexCount/3>=(id==='legacy-classic-roadster'?350:126));canopies.push(record.sha256);
  }
  assert.equal(canopies[0],canopies[1],`${id}: far canopy must reuse the verified near shape`);
 }
});
test('legacy-only repair leaves every historical reference style packed geometry byte-identical',()=>{
 const baseline=JSON.parse(readFileSync(new URL('../verification/npc-traffic/historical-style-baseline.json',import.meta.url)));
 assert.equal(baseline.length,12);
 for(const expected of baseline){
  const variant=assets.variants.find(v=>v.id===expected.id);
  for(const level of ['near','far']){
   const signature=createHash('sha256').update(JSON.stringify(variant.levels[level].geometries.map(i=>assets.geometryPool[i]))).digest('hex');
   assert.equal(signature,expected.levels[level],`${expected.id} ${level}`);
  }
 }
});

test('classic painted rails partition the canopy without overlapping offset surfaces',()=>{
 const audit=JSON.parse(readFileSync(new URL('../verification/npc-traffic/asset-audit.json',import.meta.url)));
 for(const level of ['near','far']){
  const entry=audit.audit.find(a=>a.id==='legacy-classic-roadster'&&a.level===level),parts=entry.retainedPanels.filter(p=>p.integratedRails);
  assert.equal(parts.length,2);
  for(const part of parts){assert.equal(part.integratedRails.sourceRails,2);assert.equal(part.integratedRails.heightOffsetMetres,0);assert.equal(part.integratedRails.overlappingTriangles,0);assert.equal(part.integratedRails.method,'non-overlapping-canopy-surface-partition');}
 }
});
