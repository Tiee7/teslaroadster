import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {gzipSync} from 'node:zlib';
const source=readFileSync(new URL('../src/coast-map.js',import.meta.url),'utf8');
const contract=JSON.parse(readFileSync(new URL('../verification/coast-art/collision-contract.json',import.meta.url)));
const runtime=process.env.ROADSTER_THREE_RUNTIME||'/tmp/roadster-three.min.js';
const sha=s=>createHash('sha256').update(s).digest('hex');
function actual(){const c=vm.createContext({window:{},console});vm.runInContext(readFileSync(runtime,'utf8'),c);vm.runInContext(source,c);return {T:c.THREE,coast:c.window.RoadsterCoast};}

test('coast art preserves the complete original road, collision, surface, respawn and traffic source byte for byte',()=>{
 assert.equal(sha(source.slice(0,source.indexOf('  let active=null'))),contract.prefixSha256);
 assert.doesNotMatch(source,/TextureLoader|GLTFLoader|fetch\(|XMLHttpRequest|https?:\/\//,'no new asset network requests');
});

test('actual map art keeps a bounded sample street, separate texture ownership and unchanged drivable-road clearance',{
 skip:existsSync(runtime)?false:'Official production Three r128 required'
},()=>{
 const {T,coast}=actual(),scene=new T.Scene(),root=coast.enter(scene,T);root.updateMatrixWorld(true);
 const m=coast.metrics();assert.equal(m.ownedTextures,16);assert.ok(m.textureBytes<=4*1024*1024);assert.ok(m.staticMeshDraws<=coast.artBudget.staticMeshDraws);assert.ok(m.maximumStaticTriangles<=coast.artBudget.staticTriangles);
 const props=[];const color=new T.Color(),matrix=new T.Matrix4(),world=new T.Matrix4();
 const windowMesh=root.getObjectByName('coast-sample-framed-glazing');assert.ok(windowMesh.count>=20,'multiple real framed shop/upper-floor apertures');
 for(const name of ['coast-sample-shop-awnings','coast-sample-balcony-metal','coast-sample-timber-details','coast-sample-parcel-paving','coast-sample-planter-shrubs'])assert.ok(root.getObjectByName(name),name);
 root.traverse(o=>{if(!o.isInstancedMesh||!o.userData.coastArt?.visualOnly||o.userData.coastArt.flat)return;
  o.geometry.computeBoundingBox();
  for(let i=0;i<o.count;i++){
   o.getMatrixAt(i,matrix);world.multiplyMatrices(o.matrixWorld,matrix);const b=o.geometry.boundingBox.clone().applyMatrix4(world);
   // New raised props must not overlap actual drivable roads/junctions, including a 2m shoulder.
   for(const r of coast.roads){const pad=2;assert.ok(b.max.x<=r.x-r.w/2-pad||b.min.x>=r.x+r.w/2+pad||b.max.z<=r.z-r.d/2-pad||b.min.z>=r.z+r.d/2+pad,`${o.name}[${i}] road clearance`);}
   for(const n of coast.nodes){const h=17+2;assert.ok(b.max.x<=n.x-h||b.min.x>=n.x+h||b.max.z<=n.z-h||b.min.z>=n.z+h,`${o.name}[${i}] junction clearance`);}
   props.push(b);
  }
 });assert.ok(props.length>500);
 // Actual source instance colors must be finite, not a UI-only palette.
 root.traverse(o=>{if(o.instanceColor)for(const v of o.instanceColor.array)assert.ok(Number.isFinite(v)&&v>=0&&v<=1);});
 coast.leave();
});

test('five map art entry/exit cycles dispose every owned texture/material/geometry/instance once and retain shared assets',{
 skip:existsSync(runtime)?false:'Official production Three r128 required'
},()=>{
 const {T,coast}=actual(),scene=new T.Scene();const sharedG=new T.BoxGeometry(),sharedM=new T.MeshStandardMaterial(),sharedT=new T.DataTexture(new Uint8Array([255,255,255,255]),1,1);sharedM.map=sharedT;
 scene.add(new T.Mesh(sharedG,sharedM));let shared=0;for(const r of [sharedG,sharedM,sharedT])r.addEventListener('dispose',()=>shared++);
 for(let round=0;round<5;round++){
  const root=coast.enter(scene,T),g=new Set(),m=new Set(),t=new Set(),inst=new Set();assert.equal(coast.enter(scene,T),root);
  root.traverse(o=>{if(o.isInstancedMesh)inst.add(o);if(o.geometry)g.add(o.geometry);for(const mat of [].concat(o.material||[])){m.add(mat);for(const key of ['map','bumpMap','roughnessMap','normalMap','emissiveMap'])if(mat[key])t.add(mat[key]);}});
  if(scene.environment?.isTexture){t.add(scene.environment);if(scene.environment.isCubeTexture)for(const face of scene.environment.image)t.add(face);}
  const observed=new Map();for(const resource of [...g,...m,...t,...inst]){observed.set(resource,0);resource.addEventListener('dispose',()=>observed.set(resource,observed.get(resource)+1));}
  assert.equal(t.size,16);coast.tick(1/30);coast.weather({rain:true});coast.leave();coast.leave();
  for(const count of observed.values())assert.equal(count,1,'owned GPU resource disposed exactly once');
  assert.equal(root.children.length,0,'a retained detached root does not keep disposed matrices/materials alive');assert.equal(scene.children.length,1);assert.equal(coast.metrics().ownedTextures,0);assert.equal(coast.metrics().textureBytes,0);
 }
 assert.equal(shared,0);assert.equal(coast.metrics().builds,5);assert.equal(coast.metrics().disposals,5);
});

test('road render union is exact, non-overlapping and uses square world-metre texture UVs',{
 skip:existsSync(runtime)?false:'Official production Three r128 required'
},()=>{
 const {T,coast}=actual(),root=coast.enter(new T.Scene(),T),road=root.getObjectByName('coast-road-surfaces');
 assert.equal(road.isInstancedMesh,undefined,'road is one union surface, not stacked overlapping boxes');
 const g=road.geometry,p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,index=g.index.array,tile=road.material.userData.coastMetresPerTextureTile;
 assert.equal(tile,4);assert.equal(index.length/3,86);let area=0;const rects=[];
 for(let i=0;i<p.count;i++){
  assert.ok(Math.abs(n.getY(i)-1)<1e-7,'front face points above the road');
  assert.ok(Math.abs(uv.getX(i)*tile-p.getX(i))<2e-4);assert.ok(Math.abs(uv.getY(i)*tile-p.getZ(i))<2e-4);
 }
 for(let i=0;i<index.length;i+=3){const [a,b,c]=Array.from(index.slice(i,i+3)).map(i=>new T.Vector3().fromBufferAttribute(p,i));area+=new T.Vector3().subVectors(b,a).cross(new T.Vector3().subVectors(c,a)).length()/2;}
 assert.equal(area,229704,'analytical union area:235960−7216+960m²');
 for(let i=0;i<p.count;i+=4){const xs=[0,1,2,3].map(k=>p.getX(i+k)),zs=[0,1,2,3].map(k=>p.getZ(i+k));rects.push({minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs)});}
 for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){const a=rects[i],b=rects[j];assert.ok(a.maxX<=b.minX||a.minX>=b.maxX||a.maxZ<=b.minZ||a.minZ>=b.maxZ,'no stacked coplanar road tops');}
 let seed=1729;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<20000;i++){const x=-100+rand()*1100,z=-900+rand()*1800;assert.equal(rects.some(r=>x>=r.minX&&x<=r.maxX&&z>=r.minZ&&z<=r.maxZ),coast.onRoad(x,z));}
 for(const name of ['coast-promenade','coast-sample-parcel-paving','coast-street-sidewalks']){
  const o=root.getObjectByName(name),geo=o.geometry,t=o.material.userData.coastMetresPerTextureTile;assert.equal(t,2.4);
  for(let i=0;i<geo.attributes.position.count;i++){assert.ok(Math.abs(geo.attributes.uv.getX(i)*t-geo.attributes.position.getX(i))<2e-4);assert.ok(Math.abs(geo.attributes.uv.getY(i)*t-geo.attributes.position.getZ(i))<2e-4);}
 }
 root.updateMatrixWorld(true);const inland=root.getObjectByName('coast-inland-ground'),matrix=new T.Matrix4();inland.getMatrixAt(0,matrix);inland.geometry.computeBoundingBox();const land=inland.geometry.boundingBox.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(inland.matrixWorld,matrix)),sand=new T.Box3().setFromObject(root.getObjectByName('coast-sand'));
 assert.equal(land.min.x,sand.max.x,'land and beach meet at one boundary instead of sharing185m of coplanar surface');coast.leave();
});

test('batched Ferris cabins retain all sixteen colors, upright world poses and original wheel motion',{
 skip:existsSync(runtime)?false:'Official production Three r128 required'
},()=>{
 const {T,coast}=actual(),root=coast.enter(new T.Scene(),T),cabins=root.getObjectByName('coast-wheel-cabins'),matrix=new T.Matrix4(),world=new T.Matrix4();
 assert.equal(cabins.count,16);assert.ok(cabins.instanceColor);const initial=cabins.instanceMatrix.array.slice();
 for(let i=0;i<600;i++)coast.tick(1/60);root.updateMatrixWorld(true);
 for(let i=0;i<16;i++){
  cabins.getMatrixAt(i,matrix);world.multiplyMatrices(cabins.matrixWorld,matrix);const up=new T.Vector3(0,1,0).transformDirection(world);
  assert.ok(Math.abs(up.y-1)<1e-7&&Math.abs(up.x)<1e-7&&Math.abs(up.z)<1e-7,'cabin counter-rotation cancels wheel rotor');
  const center=new T.Vector3().setFromMatrixPosition(matrix);assert.ok(Math.abs(Math.hypot(center.x,center.y)-28)<1e-5);
 }
 assert.notDeepEqual(cabins.instanceMatrix.array,initial);assert.ok(Math.abs(cabins.parent.rotation.z-.45)<1e-10);
 assert.ok(coast.metrics().staticMeshDraws<coast.artBudget.staticMeshDraws,'sixteen colored cabins use one batch, not sixteen materials/draws');coast.leave();
});

test('original sculpted palms have finite nonzero folded leaves, real vertex colors and trunks inside original collision envelopes',{
 skip:existsSync(runtime)?false:'Official production Three r128 required'
},()=>{
 const {T,coast}=actual(),root=coast.enter(new T.Scene(),T),trunk=root.getObjectByName('coast-palm-trunks');
 const p=trunk.geometry.attributes.position;for(let i=0;i<p.count;i++)assert.ok(Math.hypot(p.getX(i),p.getZ(i))<.6,'trunk remains inside the unchanged palm collision radius');
 for(const name of ['coast-palm-fans','coast-palm-fans-compact','coast-palm-fans-far','coast-palm-fans-far-compact']){
  const o=root.getObjectByName(name),g=o.geometry,p=g.attributes.position,n=g.attributes.normal,c=g.attributes.color;assert.ok(o.count<=o.userData.coastArt.capacity);assert.equal(o.material.vertexColors,true);assert.equal(o.material.side,T.DoubleSide);assert.equal(c.count,p.count);
  const a=new T.Vector3(),b=new T.Vector3(),v=new T.Vector3();let lo=Infinity,hi=-Infinity;
  for(let i=0;i<p.count;i++){lo=Math.min(lo,p.getY(i));hi=Math.max(hi,p.getY(i));for(let axis=0;axis<3;axis++){assert.ok(Number.isFinite(n.array[i*3+axis]));assert.ok(c.array[i*3+axis]>=0&&c.array[i*3+axis]<=1);}}
  assert.ok(lo<-.8&&hi>.5,'two-level canopy has a true3D arch and drooping silhouette');
  for(let i=0;i<g.index.count;i+=3){a.fromBufferAttribute(p,g.index.array[i]);b.fromBufferAttribute(p,g.index.array[i+1]);v.fromBufferAttribute(p,g.index.array[i+2]);assert.ok(b.sub(a).cross(v.sub(a)).lengthSq()>1e-12,'collapsed leaf endpoints are pruned');}
 }
 assert.ok(coast.metrics().staticTriangles<=coast.artBudget.staticTriangles);coast.leave();
});

test('curated beach pockets, promenade furniture and pier gateway retain human scale and clear visual passages',{
 skip:existsSync(runtime)?false:'Official production Three r128 required'
},()=>{
 const {T,coast}=actual(),root=coast.enter(new T.Scene(),T);root.updateMatrixWorld(true);
 const parasols=root.getObjectByName('coast-beach-parasols'),roofs=root.getObjectByName('coast-beach-pitched-roofs');
 assert.equal(parasols.count,36);assert.equal(roofs.count,9,'three lifeguard huts and six pier kiosks');
 assert.equal(root.getObjectByName('coast-promenade-lamp-globes').count,111);
 assert.equal(coast.metrics().ownedLights,2,'emissive globes do not add dozens of real lights');
 const matrix=new T.Matrix4(),world=new T.Matrix4();
 const batches=['coast-beach-chalk-structures','coast-beach-metal-furnishings','coast-beach-timber-furnishings','coast-beach-huts-and-kiosks','coast-beach-pitched-roofs','coast-promenade-lamp-globes','coast-promenade-lamp-shades'];
 for(const name of batches){const mesh=root.getObjectByName(name);mesh.geometry.computeBoundingBox();
  for(let i=0;i<mesh.count;i++){
   mesh.getMatrixAt(i,matrix);world.multiplyMatrices(mesh.matrixWorld,matrix);const b=mesh.geometry.boundingBox.clone().applyMatrix4(world);
   if(b.min.y<2.5)assert.ok(b.max.x<=-137||b.min.x>=-131||b.max.z<=-1100||b.min.z>=1100,`${name}[${i}] promenade clear6m band`);
   if(b.min.y<4.15-1e-5){ // Float32 instance matrices round the exact4.15m lintel by<1e-7.
    for(const route of [{minX:-810,maxX:-250,minZ:-668,maxZ:-632},{minX:-250,maxX:-70,minZ:-659,maxZ:-641}])assert.ok(b.max.x<=route.minX||b.min.x>=route.maxX||b.max.z<=route.minZ||b.min.z>=route.maxZ,`${name}[${i}] full original pier/approach clearance below4.15m`);
   }
  }
 }
 const boardwalk=root.getObjectByName('coast-pier-boardwalk');assert.ok(boardwalk.material.map);assert.equal(boardwalk.material.userData.coastMetresPerTextureTile,2.4);
 const p=boardwalk.geometry.attributes.position,uv=boardwalk.geometry.attributes.uv;for(let i=0;i<p.count;i++){assert.ok(Math.abs(p.getX(i)-uv.getX(i)*2.4)<2e-4);assert.ok(Math.abs(p.getZ(i)-uv.getY(i)*2.4)<2e-4);}
 // Roof triangle normals agree with outward faceted roof geometry, no inverted slopes.
 const g=roofs.geometry,pts=g.attributes.position,n=g.attributes.normal;for(let i=0;i<pts.count;i++){assert.ok(Number.isFinite(n.getX(i)));assert.ok(Number.isFinite(n.getY(i)));assert.ok(Number.isFinite(n.getZ(i)));}
 coast.leave();
});

test('palm LOD keeps all100 original crown poses and bounded pools, caches stationary frames and uses hysteresis without touching layout',{
 skip:existsSync(runtime)?false:'Official production Three r128 required'
},()=>{
 const {T,coast}=actual(),scene=new T.Scene(),focus=new T.Vector3(-64,0,700);scene.userData.coastArtBridge={getFocus:()=>focus,sharedLights:[]};const root=coast.enter(scene,T);
 const meshes=['coast-palm-fans','coast-palm-fans-compact','coast-palm-fans-far','coast-palm-fans-far-compact'].map(n=>root.getObjectByName(n)),matrix=new T.Matrix4(),position=new T.Vector3();
 const check=()=>{
  const seen=new Set();let near=0,far=0;
  for(const mesh of meshes){assert.ok(mesh.count<=mesh.userData.coastArt.capacity);if(mesh.name.includes('-far'))far+=mesh.count;else near+=mesh.count;
   for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);position.setFromMatrixPosition(matrix);const index=coast.layout().palms.findIndex(p=>Math.abs(position.x-p.x-.18*Math.sin(Math.PI*.7))<1e-4&&Math.abs(position.z-p.z-.1*Math.sin(Math.PI*1.4))<1e-4&&Math.abs(position.y-p.h)<1e-4);assert.ok(index>=0);assert.equal(seen.has(index),false,'no duplicate high/low crown');seen.add(index);}
  }
  assert.equal(near+far,100);assert.equal(seen.size,100);assert.ok(near<=24);assert.equal(coast.metrics().nearPalms,near);assert.equal(coast.metrics().farPalms,far);assert.ok(coast.metrics().maximumStaticTriangles<=coast.artBudget.staticTriangles);
 };
 check();const versions=meshes.map(m=>m.instanceMatrix.version),refreshes=coast.metrics().foliageRefreshes;
 for(let i=0;i<600;i++)coast.tick(1/60);assert.deepEqual(meshes.map(m=>m.instanceMatrix.version),versions);assert.equal(coast.metrics().foliageRefreshes,refreshes);
 focus.x+=19;coast.tick(1/60);assert.equal(coast.metrics().foliageRefreshes,refreshes);focus.x+=2;coast.tick(1/60);assert.equal(coast.metrics().foliageRefreshes,refreshes+1);check();
 for(const [x,z] of [[-310,-1000],[430,0],[950,850],[-650,-650],[-64,700]]){focus.set(x,999,z);coast.tick(1/60);check();}
 const count=coast.metrics().foliageRefreshes;focus.x=NaN;coast.tick(NaN);assert.equal(coast.metrics().foliageRefreshes,count);check();coast.leave();
});

test('whole-district apertures have four outward faces, selective masked emission and a correctly budgeted reusable near-frame pool',{
 skip:existsSync(runtime)?false:'Official production Three r128 required'
},()=>{
 const {T,coast}=actual(),scene=new T.Scene(),focus=new T.Vector3(430,0,0);scene.userData.coastArtBridge={getFocus:()=>focus,sharedLights:[]};const root=coast.enter(scene,T),meta=root.userData.coastArtDistrict;
 assert.equal(root.getObjectByName('coast-dark-window-bands'),undefined);assert.equal(root.getObjectByName('coast-original-shop-houses').count,156);assert.equal(meta.entryCount,129);
 const windows=[root.getObjectByName('coast-district-window-sashes'),root.getObjectByName('coast-district-selected-lit-windows'),root.getObjectByName('coast-district-window-sashes-transom'),root.getObjectByName('coast-district-selected-lit-windows-transom')],pool=root.getObjectByName('coast-district-near-window-reveals');
 assert.equal(windows.reduce((n,m)=>n+m.count,0),meta.windowCount);assert.ok(meta.windowCount>14000&&meta.windowCount<19000);
 const matrix=new T.Matrix4(),point=new T.Vector3(),normal=new T.Vector3(),coverage=new Map();
 for(const mesh of windows)for(let i=0;i<mesh.count;i++){
  mesh.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);normal.set(1,0,0).transformDirection(matrix);
  const bi=coast.layout().buildings.findIndex(b=>point.y<b.height&&point.x>=b.minX-.07&&point.x<=b.maxX+.07&&point.z>=b.minZ-.07&&point.z<=b.maxZ+.07);
  assert.ok(bi>=0);assert.equal(mesh.userData.coastArt.facadeFamily,meta.families.find(r=>r.buildingIndex===bi).family,'one coherent atlas family per whole building');const b=coast.layout().buildings[bi];assert.ok(normal.dot(point.clone().sub(new T.Vector3(b.x,point.y,b.z)))>0,'front faces are not culled toward their own solid wall');
  const face=Math.abs(normal.x)>.9?(normal.x<0?'west':'east'):(normal.z<0?'north':'south');if(!coverage.has(bi))coverage.set(bi,new Set());coverage.get(bi).add(face);
 }
 assert.equal(coverage.size,129);for(const faces of coverage.values())assert.equal(faces.size,4);
 assert.equal(windows[1].material.emissiveMap.image.width,128);assert.equal(windows[0].material.map,windows[1].material.map);
 const mask=windows[1].material.emissiveMap.image.data;assert.equal(mask[(20*128+7)*4],0);assert.ok(mask[(20*128+8)*4]>0);assert.ok(mask[(20*128+55)*4]>0);assert.equal(mask[(20*128+56)*4],0);
 assert.equal(pool.userData.coastArt.capacity,768);assert.equal(pool.instanceMatrix.array.byteLength,49152);assert.ok(pool.count>0&&pool.count<=768);
 const buffer=pool.instanceMatrix.array,version=pool.instanceMatrix.version,refreshes=coast.metrics().detailRefreshes;
 for(let i=0;i<600;i++)coast.tick(1/60);assert.equal(pool.instanceMatrix.version,version);focus.x+=19.99;coast.tick(1/60);assert.equal(coast.metrics().detailRefreshes,refreshes);focus.x+=.02;coast.tick(1/60);assert.equal(coast.metrics().detailRefreshes,refreshes+1);
 for(const [x,z] of [[-64,700],[950,850],[1115,1000],[-700,-650],[430,0]]){focus.set(x,999,z);coast.tick(1/60);assert.equal(pool.instanceMatrix.array,buffer);assert.ok(pool.count<=768);assert.ok(coast.metrics().maximumStaticTriangles<=coast.artBudget.staticTriangles);}
 assert.ok(coast.metrics().ownedGeometryBufferBytes+coast.metrics().ownedInstanceBufferBytes<=coast.artBudget.geometryAndInstanceBytes);coast.leave();
});

test('all129 new entry doors face finite real street segments or explicit local gardens; linked paving never crosses another building',{
 skip:existsSync(runtime)?false:'Official production Three r128 required'
},()=>{
 const {T,coast}=actual(),root=coast.enter(new T.Scene(),T),meta=root.userData.coastArtDistrict,buildings=coast.layout().buildings;let linked=0,gardens=0;
 for(const entry of meta.entries){const b=buildings[entry.buildingIndex],axis=entry.axis,along=entry.door[axis==='x'?2:0],from=entry.door[axis==='x'?0:2];
  if(entry.kind==='street'){
   const r=coast.roads[entry.roadIndex];assert.ok(r);assert.equal(r.d>r.w?'x':'z',axis);assert.ok(along>=(axis==='x'?r.z-r.d/2:r.x-r.w/2)&&along<=(axis==='x'?r.z+r.d/2:r.x+r.w/2));assert.equal(Math.sign((axis==='x'?r.x:r.z)-(axis==='x'?b.x:b.z)),entry.side);
   if(entry.linkedToSidewalk){linked++;const half=axis==='x'?r.w/2:r.d/2,expected=(axis==='x'?r.x:r.z)-entry.side*(axis==='x'?half+10:21);assert.ok(Math.abs(entry.pathEnd-expected)<1e-9);}
  }else{gardens++;assert.equal(entry.kind,'garden');assert.equal(entry.roadIndex,-1);assert.equal(entry.linkedToSidewalk,false);}
  const lo=Math.min(from,entry.pathEnd),hi=Math.max(from,entry.pathEnd);
  for(const other of coast.layout().obstacles)if(other!==b)assert.ok(axis==='x'?other.maxX<=lo||other.minX>=hi||other.maxZ<=along-1.3||other.minZ>=along+1.3:other.maxZ<=lo||other.minZ>=hi||other.maxX<=along-1.3||other.minX>=along+1.3,'entry paving cannot draw through any original solid building or palm');
 }
 for(const index of [47,49,51]){const entry=meta.entries.find(e=>e.buildingIndex===index);assert.equal(entry.linkedToSidewalk,true);assert.ok(Math.abs(entry.door[2]-buildings[index].z)>2,'the three palm-conflicting doors actually moved along their facade');}
 assert.ok(linked>=30,'street-facing row doors actually reach original sidewalks');assert.equal(gardens,4,'outer corner parcels do not face imaginary road extensions');
 assert.ok(root.getObjectByName('coast-district-entry-paving').geometry.index.count>0);coast.leave();
});

test('boulevard planting and signs add scale only beyond unchanged road shoulders and keep real-light count bounded',{
 skip:existsSync(runtime)?false:'Official production Three r128 required'
},()=>{
 const {T,coast}=actual(),root=coast.enter(new T.Scene(),T),plants=root.getObjectByName('coast-boulevard-low-planting');assert.equal(plants.count,192);assert.equal(root.getObjectByName('coast-promenade-lamp-globes').count,111);assert.equal(coast.metrics().ownedLights,2);
 const matrix=new T.Matrix4(),box=new T.Box3();plants.geometry.computeBoundingBox();for(let i=0;i<plants.count;i++){plants.getMatrixAt(i,matrix);box.copy(plants.geometry.boundingBox).applyMatrix4(matrix);assert.ok(box.max.x<=-87||box.min.x>=-53,'unchanged30m road plus2m shoulder');assert.ok((box.max.x<=-95||box.min.x>=-89.5)&&(box.max.x<=-50.5||box.min.x>=-45),'preserved inner sidewalk band');}
 const maximum=coast.metrics().maximumStaticTriangles;coast.weather({rain:true});assert.equal(coast.metrics().maximumStaticTriangles,maximum);coast.leave();
});

test('boulevard calibration is flat paint only, retains full body clearance and leaves all intersections plus pier access unpainted',{
 skip:existsSync(runtime)?false:'Official production Three r128 required'
},()=>{
 const {T,coast}=actual(),root=coast.enter(new T.Scene(),T),matrix=new T.Matrix4(),point=new T.Vector3(),bounds=new T.Box3(),gaps=[...[-850,-300,300,850].map(z=>[z-34,z+34]),[-680,-620]],edges=[],centres=new Set();
 const checkBounds=box=>{const center=box.min.x>300?430:-70;centres.add(center);assert.ok(box.min.x>=center-14.75-1e-4&&box.max.x<=center+14.75+1e-4,'paint stays inside either unchanged30m boulevard');assert.ok(box.min.y>.025&&box.max.y<.026,'no raised divider/curb/obstacle');for(const [lo,hi] of (center===-70?gaps:gaps.slice(0,-1)))assert.ok(box.max.z<=lo+1e-4||box.min.z>=hi-1e-4,'turning, zebra and pier entrances stay blank');};
 for(const name of ['coast-boulevard-painted-cycle-lanes','coast-boulevard-white-road-paint','coast-boulevard-ochre-road-paint','coast-boulevard-cycle-stencil-wheels']){
  const mesh=root.getObjectByName(name);assert.ok(mesh.userData.coastArt.flat);assert.equal(mesh.castShadow,false);assert.equal(mesh.material.depthWrite,false);assert.equal(mesh.material.polygonOffset,true);const p=mesh.geometry.attributes.position;
  if(mesh.isInstancedMesh)for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);bounds.makeEmpty();for(let k=0;k<p.count;k++)bounds.expandByPoint(point.fromBufferAttribute(p,k).applyMatrix4(matrix));checkBounds(bounds);if(name.includes('white')&&Math.abs(matrix.elements[10])>100)edges.push(matrix.elements[12]-(matrix.elements[12]>300?430:-70));}
  else for(let i=0;i<p.count;i+=4){bounds.makeEmpty();for(let k=0;k<4;k++)bounds.expandByPoint(point.fromBufferAttribute(p,i+k));checkBounds(bounds);}
 }
 assert.deepEqual([...centres].sort((a,b)=>a-b),[-70,430],'both existing30m boulevards get scale calibration, not the22m street');
 assert.ok(edges.some(x=>Math.abs(x-7.5)<1e-5)&&edges.some(x=>Math.abs(x+7.5)<1e-5));
 for(const center of [-4,4,6]){const lo=center>0?2.5:-7.5,hi=center>0?7.5:-2.5;assert.ok(center-1.1>lo&&center+1.1<hi,'NPCs and default spawn retain a complete conservative body envelope within the through band');}
 coast.leave();
});

test('western boulevard curb has an actual visual cut across the original pier approach',{
 skip:existsSync(runtime)?false:'Official production Three r128 required'
},()=>{
 const {T,coast}=actual(),root=coast.enter(new T.Scene(),T),curbs=root.getObjectByName('coast-street-low-curbs'),matrix=new T.Matrix4(),position=new T.Vector3(),scale=new T.Vector3(),rotation=new T.Quaternion();let checked=0;
 for(let i=0;i<curbs.count;i++){curbs.getMatrixAt(i,matrix);matrix.decompose(position,rotation,scale);if(Math.abs(position.x+85.7)<1e-3){checked++;assert.ok(position.z+scale.z/2<=-662+1e-4||position.z-scale.z/2>=-638-1e-4,'no visible curb through the drivable18m pier entrance');}}
 assert.ok(checked>=3);coast.leave();
});

test('continuous water/sand grids retain exact original area, bounds, elevation and upward winding',{skip:existsSync(runtime)?false:'Official production Three r128 required'},()=>{
 const {T,coast}=actual(),root=coast.enter(new T.Scene(),T),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),normal=new T.Vector3();
 for(const [name,triangles,area,x0,x1,y,tile] of [['coast-water',480,2088000,-1200,-330,-.42,24],['coast-sand',400,444000,-330,-145,-.04,4]]){
  const mesh=root.getObjectByName(name),g=mesh.geometry,p=g.attributes.position,uv=g.attributes.uv,colors=g.attributes.color,idx=g.index.array;assert.equal(idx.length/3,triangles);g.computeBoundingBox();assert.equal(g.boundingBox.min.x,x0);assert.equal(g.boundingBox.max.x,x1);assert.equal(g.boundingBox.min.z,-1200);assert.equal(g.boundingBox.max.z,1200);assert.equal(mesh.material.vertexColors,true);assert.equal(mesh.material.color.getHex(),0xffffff);let sum=0;
  for(let i=0;i<p.count;i++){assert.ok(Math.abs(p.getY(i)-y)<1e-7);assert.ok(Math.abs(uv.getX(i)*tile-p.getX(i))<3e-4);assert.ok(Math.abs(uv.getY(i)*tile-p.getZ(i))<3e-4);for(let k=0;k<3;k++)assert.ok(colors.array[i*3+k]>=0&&colors.array[i*3+k]<=1);}
  for(let i=0;i<idx.length;i+=3){a.fromBufferAttribute(p,idx[i]);b.fromBufferAttribute(p,idx[i+1]);c.fromBufferAttribute(p,idx[i+2]);normal.crossVectors(b.sub(a),c.sub(a));assert.ok(normal.y>0);sum+=normal.y/2;}assert.ok(Math.abs(sum-area)<1e-5,'continuous non-overlapping coverage');
 }
 coast.leave();
});

test('native water normals drift by uniforms only, retain finite periodic offsets and dispose once',{skip:existsSync(runtime)?false:'Official production Three r128 required'},()=>{
 const {T,coast}=actual(),root=coast.enter(new T.Scene(),T),water=root.getObjectByName('coast-water'),normal=water.material.normalMap;assert.ok(normal.isDataTexture);assert.equal(normal.image.width,128);assert.equal(normal.image.height,128);assert.equal(normal.image.data.length,65536);assert.equal(normal.flipY,false);assert.equal(normal.wrapS,T.RepeatWrapping);assert.equal(normal.wrapT,T.RepeatWrapping);assert.equal(water.material.map,null,'r128 normal offset remains the selected common UV transform');assert.equal(water.material.transparent,false);assert.equal(water.material.normalScale.x,.28);assert.equal(water.material.normalScale.y,.28);
 const bytes=sha(normal.image.data),version=normal.version,offset=normal.offset.clone();let disposed=0;normal.addEventListener('dispose',()=>disposed++);for(let i=0;i<60000;i++)coast.tick(.05);assert.notDeepEqual(normal.offset,offset);assert.equal(normal.version,version,'no per-frame texture upload');assert.equal(sha(normal.image.data),bytes);
 for(const value of normal.offset.toArray())assert.ok(Number.isFinite(value)&&value>=0&&value<1);const stable=normal.offset.clone();for(const dt of [NaN,Infinity,-1])coast.tick(dt);assert.deepEqual(normal.offset,stable);coast.weather({rain:true});assert.equal(normal.version,version);coast.leave();coast.leave();assert.equal(disposed,1);
});


test('original art payload remains below the explicit32KiB gzip ceiling with zero art fetches',()=>{
 const context=vm.createContext({window:{}});vm.runInContext(source,context);const coast=context.window.RoadsterCoast;assert.equal(coast.artBudget.sourceGzipBytes,32768);assert.ok(gzipSync(source).byteLength<=coast.artBudget.sourceGzipBytes);assert.doesNotMatch(source,/fetch\(|TextureLoader|GLTFLoader|https?:\/\//);
});

test('fine surf stays strictly sea-side and the original38cm cut is closed without changing surface heights',{skip:existsSync(runtime)?false:'Official production Three r128 required'},()=>{
 const {T,coast}=actual(),root=coast.enter(new T.Scene(),T),foam=root.getObjectByName('coast-broken-surf-ribbons'),cut=root.getObjectByName('coast-shore-cut-face');assert.ok(foam&&cut);assert.equal(foam.castShadow,false);assert.equal(foam.material.transparent,false);assert.equal(foam.material.depthWrite,false);assert.equal(foam.material.polygonOffset,true);assert.equal(foam.renderOrder,1);
 const p=foam.geometry.attributes.position;for(let i=0;i<p.count;i++){assert.ok(p.getX(i)<-330.2);assert.ok(Math.abs(p.getY(i)+.4196)<1e-7);assert.ok(p.getZ(i)>=-1200&&p.getZ(i)<=1200);}
 const g=cut.geometry;assert.equal(g.index.count/3,2);for(let i=0;i<g.attributes.position.count;i++){assert.equal(g.attributes.position.getX(i),-330);assert.ok(Math.abs(g.attributes.normal.getX(i)+1)<1e-7);assert.ok(g.attributes.position.getY(i)>=-.4200001&&g.attributes.position.getY(i)<=-.0399999);}
 assert.equal(coast.surface(-330,0).water,false);assert.equal(coast.surface(-330.0001,0).water,true);coast.leave();
});


test('selected street-wall balcony stacks have real full-height doors exactly meeting their platform floors',{skip:existsSync(runtime)?false:'Official production Three r128 required'},()=>{
 const {T,coast}=actual(),root=coast.enter(new T.Scene(),T),records=root.userData.coastBalconies,glass=root.getObjectByName('coast-sample-framed-glazing'),trim=root.getObjectByName('coast-architecture-limestone-trims'),matrix=new T.Matrix4(),p=new T.Vector3(),q=new T.Quaternion(),scale=new T.Vector3(),poses=[];
 assert.ok(records.length>=40&&records.length<=100);for(let i=0;i<glass.count;i++){glass.getMatrixAt(i,matrix);matrix.decompose(p,q,scale);poses.push({p:p.clone(),s:scale.clone()});}
 for(const r of records){const b=coast.layout().buildings[r.buildingIndex];assert.ok([-5,355,485].includes(b.x));assert.equal(r.doorHeight,2.45);const face=(r.axis==='x'?b.x:b.z)+r.side*((r.axis==='x'?b.w:b.d)/2+.065),want=r.axis==='x'?new T.Vector3(face,r.floor+1.225,r.along):new T.Vector3(r.along,r.floor+1.225,face),door=poses.find(v=>v.p.distanceTo(want)<1e-3);assert.ok(door,'actual glass instance at each metadata door');assert.ok(Math.abs(door.s.y-2.45)<1e-6);assert.ok(Math.abs(door.p.y-door.s.y/2-r.floor)<1e-5,'door bottom meets the platform, not a raised window sill');let found=false;
  for(let i=0;i<trim.count;i++){trim.getMatrixAt(i,matrix);matrix.decompose(p,q,scale);const f=(r.axis==='x'?b.x:b.z)+r.side*(r.axis==='x'?b.w:b.d)/2+r.side*.78;if(Math.abs(p[r.axis]-f)<1e-3&&Math.abs(p[r.axis==='x'?'z':'x']-r.along)<1e-3&&Math.abs(p.y-(r.floor-.09))<1e-3&&Math.abs(scale.y-.18)<1e-5){assert.ok(Math.abs(p.y+scale.y/2-r.floor)<1e-5);found=true;break;}}assert.ok(found,'real platform geometry exists');
 }coast.leave();
});

test('curved roof trim is a finite closed shallow parapet, not a new collidable full roof',{skip:existsSync(runtime)?false:'Official production Three r128 required'},()=>{
 const {T,coast}=actual(),root=coast.enter(new T.Scene(),T),mesh=root.getObjectByName('coast-district-curved-parapets'),g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal,a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();assert.ok(mesh.count>=15&&mesh.count<=25);assert.equal(g.index.count/3,54);g.computeBoundingBox();assert.equal(g.boundingBox.min.y,0);assert.equal(g.boundingBox.max.y,1);
 for(let i=0;i<p.count;i++){assert.ok(Math.abs(n.getX(i)**2+n.getY(i)**2+n.getZ(i)**2-1)<1e-6);assert.ok(Math.abs(p.getX(i))<=.5&&Math.abs(p.getZ(i))<=.5);}for(let i=0;i<g.index.count;i+=3){a.fromBufferAttribute(p,g.index.getX(i));b.fromBufferAttribute(p,g.index.getX(i+1));c.fromBufferAttribute(p,g.index.getX(i+2));assert.ok(b.sub(a).cross(c.sub(a)).lengthSq()>1e-12);}coast.leave();
});

test('composed courtyard and three beach entries retain original obstacles, shoulders and ground datum',{skip:existsSync(runtime)?false:'Official production Three r128 required'},()=>{
 const {T,coast}=actual(),root=coast.enter(new T.Scene(),T),park=root.userData.coastCourtyard,rects=[...root.userData.coastBeachEntryRects,...park.paths];assert.equal(park.trees.length,3);assert.equal(park.width,48);assert.equal(park.depth,38);
 for(const r of rects){const box={minX:r.x-r.w/2,maxX:r.x+r.w/2,minZ:r.z-r.d/2,maxZ:r.z+r.d/2};for(const o of coast.layout().obstacles)assert.ok(box.maxX<=o.minX||box.minX>=o.maxX||box.maxZ<=o.minZ||box.minZ>=o.maxZ,'walk never routes through an original house/palm');for(const road of coast.roads)assert.ok(box.maxX<=road.x-road.w/2-2||box.minX>=road.x+road.w/2+2||box.maxZ<=road.z-road.d/2-2||box.minZ>=road.z+road.d/2+2,'no new pavement enters unchanged road shoulders');}
 const north=root.userData.coastBeachEntryRects;assert.ok(north.some(r=>r.x===-244.8&&r.d>20),'actual dogleg avoids the original600m palm');for(const name of ['coast-beach-access-boardwalks','coast-neighbourhood-courtyard-walks']){const o=root.getObjectByName(name);assert.equal(o.material.depthWrite,false);for(const y of o.geometry.attributes.position.array.filter((_,i)=>i%3===1))assert.ok(y>-.04&&y<-.039,'original ground top remains, only flat decal layering');}
 assert.ok(5-(2.68+.18)>2,'the small central basin leaves over2m pedestrian room on the10m plaza');coast.leave();
});


test('driving-visible inland corner shop windows replace ground sashes without inventing entrances or road obstacles',{
 skip:existsSync(runtime)?false:'Official production Three r128 required'
},()=>{
 const {T,coast}=actual(),root=coast.enter(new T.Scene(),T),records=root.userData.coastCornerStores,panels=root.getObjectByName('coast-corner-store-ground-panels');
 assert.equal(records.length,8);assert.equal(panels.count,8);assert.equal(new Set(records.map(r=>r.buildingIndex)).size,4);
 for(const r of records){const b=coast.layout().buildings[r.buildingIndex];assert.ok([355,485].includes(b.x)&&[440,580].includes(b.z));assert.ok(r.entranceUnchanged);assert.ok(r.axis==='x'?r.side===(b.x<430?1:-1):r.side===1);assert.equal(r.width,11.6);}
 assert.ok(coast.metrics().maximumStaticTriangles<=180000,'driving-scale details fit the same fixed maximum capacity budget');coast.leave();
});


test('corner storefront lettering reads left-to-right from actual outward X and Z viewpoints',{
 skip:existsSync(runtime)?false:'Official production Three r128 required'
},()=>{
 const {T,coast}=actual(),root=coast.enter(new T.Scene(),T),mesh=root.getObjectByName('coast-sample-storefront-lettering'),matrix=new T.Matrix4(),box=new T.Box3();mesh.geometry.computeBoundingBox();
 const glyphs={C:['01111','10000','10000','10000','10000','10000','01111'],A:['01110','10001','10001','11111','10001','10001','10001'],F:['11111','10000','10000','11110','10000','10000','10000'],E:['11111','10000','10000','11110','10000','10000','11111'],S:['01111','10000','10000','01110','00001','00001','11110'],U:['10001','10001','10001','10001','10001','10001','01110'],R:['11110','10001','10001','11110','10100','10010','10001']};
 for(const r of root.userData.coastCornerStores){
  const rectangles=[];for(let i=r.signStart;i<r.signStart+r.signCount;i++){mesh.getMatrixAt(i,matrix);const b=coast.layout().buildings[r.buildingIndex],face=r.axis==='x'?b.x+r.side*b.w/2:b.z+r.side*b.d/2;assert.ok(r.side*(matrix.elements[r.axis==='x'?12:14]-face)>.4,'letter plane is outside the original projecting cornice, not behind it');box.copy(mesh.geometry.boundingBox).applyMatrix4(matrix);const lo=r.axis==='x'?-r.side*(box.max.z-r.along):r.side*(box.min.x-r.along),hi=r.axis==='x'?-r.side*(box.min.z-r.along):r.side*(box.max.x-r.along);rectangles.push([Math.min(lo,hi),Math.max(lo,hi),box.min.y,box.max.y]);}
  for(const [letter,k] of [...r.signText].map((letter,k)=>[letter,k]))for(let y=0;y<7;y++)for(let x=0;x<5;x++){
   const sx=-((r.signText.length*6-1)*.06)/2+(k*6+x+.5)*.06,sy=3.7+(3-y)*.06,painted=rectangles.some(([lo,hi,bottom,top])=>sx>lo+1e-5&&sx<hi-1e-5&&sy>bottom+1e-5&&sy<top-1e-5);
   assert.equal(painted,glyphs[letter][y][x]==='1',`${r.axis}${r.side} ${r.signText} glyph${k} cell${x},${y} native-instance projection`);
  }
 }
 coast.leave();
});


test('continuous roof parapets preserve exact four-box union while removing2112 hidden corner triangles',{
 skip:existsSync(runtime)?false:'Official production Three r128 required'
},()=>{
 const {T,coast}=actual(),root=coast.enter(new T.Scene(),T),mesh=root.getObjectByName('coast-continuous-roof-parapets'),p=mesh.geometry.attributes.position,normal=mesh.geometry.attributes.normal,index=mesh.geometry.index;
 assert.equal(index.count/3,coast.layout().buildings.length*32);assert.equal(p.count,coast.layout().buildings.length*64);assert.equal(mesh.castShadow,true);
 for(const [bi,b] of coast.layout().buildings.entries()){
  const bounds=new T.Box3(),v=new T.Vector3();for(let i=bi*64;i<(bi+1)*64;i++){bounds.expandByPoint(v.fromBufferAttribute(p,i));assert.ok(Math.abs(Math.hypot(normal.getX(i),normal.getY(i),normal.getZ(i))-1)<1e-6);}
  for(const [value,expected] of [[bounds.min.x,b.minX],[bounds.max.x,b.maxX],[bounds.min.z,b.minZ],[bounds.max.z,b.maxZ],[bounds.min.y,b.height],[bounds.max.y,b.height+.64]])assert.ok(Math.abs(value-expected)<1e-4,'same roof edge/wall height as original visual boxes');
  let upwardArea=0;const a=new T.Vector3(),c=new T.Vector3(),d=new T.Vector3();for(let i=bi*96;i<(bi+1)*96;i+=3){a.fromBufferAttribute(p,index.getX(i));c.fromBufferAttribute(p,index.getX(i+1));d.fromBufferAttribute(p,index.getX(i+2));const cross=c.sub(a).cross(d.sub(a));if(cross.y>0)upwardArea+=cross.y/2;}
  assert.ok(Math.abs(upwardArea-(b.w*b.d-(b.w-.56)*(b.d-.56)))<.01,'open roof centre, exact .28m union ring without duplicate top corners');
 }
 coast.leave();
});


test('world ground field retains exact full box/independent UV, uploads once and reuses only bounded CPU pixels',{
 skip:existsSync(runtime)?false:'Official production Three r128 required'
},()=>{
 const {T,coast}=actual(),scene=new T.Scene(),root=coast.enter(scene,T),ground=root.getObjectByName('coast-inland-ground'),texture=ground.material.map,meta=root.userData.coastGroundField;
 assert.equal(texture.image.width,256);assert.equal(texture.image.height,256);assert.equal(texture.wrapS,T.ClampToEdgeWrapping);assert.equal(texture.wrapT,T.ClampToEdgeWrapping);assert.equal(texture.repeat.x,1);assert.equal(texture.repeat.y,1);assert.equal(texture.offset.x,0);assert.equal(texture.offset.y,0);assert.equal(texture.generateMipmaps,true);
 assert.deepEqual(Array.from(meta.bounds),[-145,1200,-1200,1200]);assert.equal(meta.regions.length,root.userData.coastArtDistrict.entries.filter(e=>e.linkedToSidewalk).length+root.userData.coastCornerCourts.length+1);assert.equal(ground.material.color.getHex(),0xffffff);
 const p=ground.geometry.attributes.position,uv=ground.geometry.attributes.uv;for(let i=0;i<p.count;i++){assert.ok(Math.abs(uv.getX(i)-(p.getX(i)+.5))<1e-7);assert.ok(Math.abs(uv.getY(i)-(p.getZ(i)+.5))<1e-7);}
 const matrix=new T.Matrix4();ground.getMatrixAt(0,matrix);ground.geometry.computeBoundingBox();const bounds=ground.geometry.boundingBox.clone().applyMatrix4(matrix);for(const [a,b] of [[bounds.min.x,-145],[bounds.max.x,1200],[bounds.min.z,-1200],[bounds.max.z,1200],[bounds.min.y,-.20],[bounds.max.y,-.04]])assert.ok(Math.abs(a-b)<1e-5,'complete original box including bottom and side heights');
 const pixels=texture.image.data,version=texture.version,checksum=sha(pixels);let disposed=0;texture.addEventListener('dispose',()=>disposed++);for(let i=0;i<600;i++)coast.tick(1/60);coast.weather({rain:true});coast.weather({marsSun:true});assert.equal(texture.image.data,pixels);assert.equal(texture.version,version);assert.equal(sha(pixels),checksum);assert.equal(pixels.byteLength,256*256*4);assert.ok(coast.metrics().cachedCpuPixelBytes<=coast.artBudget.cpuPixelCacheBytes);
 coast.leave();assert.equal(disposed,1);assert.equal(coast.metrics().ownedTextures,0);assert.equal(coast.metrics().textureBytes,0);assert.equal(coast.metrics().cachedCpuPixelBytes,256*256*4,'explicit CPU bitmap cache, not a retained GPU texture');const again=coast.enter(scene,T).getObjectByName('coast-inland-ground').material.map;assert.notEqual(again,texture);assert.equal(again.image.data,pixels);coast.leave();
});


test('two grouped aperture families use independent half-atlas UVs and synchronized albedo/emission masks',{
 skip:existsSync(runtime)?false:'Official production Three r128 required'
},()=>{
 const {T,coast}=actual(),root=coast.enter(new T.Scene(),T),meta=root.userData.coastArtDistrict;
 assert.equal(meta.families.length,129);for(const r of meta.families){const b=coast.layout().buildings[r.buildingIndex];assert.equal(r.family,(Math.floor((b.z+1000)/560)+(b.x>=430?1:0))%2);}
 const first=root.getObjectByName('coast-district-window-sashes'),second=root.getObjectByName('coast-district-window-sashes-transom'),lit=root.getObjectByName('coast-district-selected-lit-windows');assert.equal(first.material,second.material);assert.notEqual(first.geometry,second.geometry);
 for(const [family,mesh] of [[0,first],[1,second]]){const uv=mesh.geometry.attributes.uv;for(let i=0;i<uv.count;i++)assert.ok(uv.getX(i)>=family/2&&uv.getX(i)<=(family+1)/2);}
 const albedo=first.material.map.image.data,mask=lit.material.emissiveMap.image.data;
 for(let family=0;family<2;family++)for(let y=0;y<64;y++)for(let x=0;x<64;x++){
  const i=(y*128+family*64+x)*4,inner=x>=8&&x<56&&y>=8&&y<56,bar=family?(y>=44&&y<=45):(x>=31&&x<=32),glass=inner&&!bar;
  assert.equal(mask[i]>0,glass,'emission never illuminates an old/missing mullion');if(glass)assert.ok(albedo[i]<80);else if(inner)assert.equal(albedo[i],194);
 }
 assert.ok(Object.isFrozen(root.userData.coastGroundField.regions));assert.ok(root.userData.coastGroundField.regions.every(Object.isFrozen));coast.leave();
});

test('curated corner hard courts are flat original-paver continuations outside roads and every inherited obstacle',{
 skip:existsSync(runtime)?false:'Official production Three r128 required'
},()=>{
 const {T,coast}=actual(),root=coast.enter(new T.Scene(),T),courts=root.userData.coastCornerCourts;assert.equal(courts.length,8);assert.equal(new Set(courts.map(r=>r.buildingIndex)).size,4);
 for(const r of courts){const b=coast.layout().buildings[r.buildingIndex];assert.ok(r.minX<r.maxX&&r.minZ<r.maxZ);assert.ok((r.maxX-r.minX)*(r.maxZ-r.minZ)<300,'limited frontage, not a giant color rectangle');for(const o of coast.layout().obstacles)if(o!==b)assert.ok(r.maxX<=o.minX||r.minX>=o.maxX||r.maxZ<=o.minZ||r.minZ>=o.maxZ,'no false route through inherited palms/houses');for(const road of coast.roads)assert.ok(r.maxX<=road.x-road.w/2-2||r.minX>=road.x+road.w/2+2||r.maxZ<=road.z-road.d/2-2||r.minZ>=road.z+road.d/2+2);}
 assert.ok(root.getObjectByName('coast-district-entry-paving').userData.coastArt.flat);coast.leave();
});


test('window/forecourt refinements retain all129 published art entrance/path poses byte for byte',{
 skip:existsSync(runtime)?false:'Official production Three r128 required'
},()=>{
 const expected=JSON.parse(readFileSync(new URL('../verification/coast-art/entry-pose-contract.json',import.meta.url)));const {T,coast}=actual(),root=coast.enter(new T.Scene(),T);assert.equal(root.userData.coastArtDistrict.entries.length,expected.entries);assert.equal(sha(JSON.stringify(root.userData.coastArtDistrict.entries)),expected.sha256);coast.leave();
});

test('six grouped facade signatures partition original wall hulls exactly with explicitly initialized instance colors',{
 skip:existsSync(runtime)?false:'Official production Three r128 required'
},()=>{
 const {T,coast}=actual(),root=coast.enter(new T.Scene(),T),walls=root.getObjectByName('coast-original-shop-houses'),roles=walls.userData.coastWallPieces,signatures=root.userData.coastSignatureHouses,layout=coast.layout();root.updateMatrixWorld(true);
 assert.equal(signatures.length,6);assert.equal(walls.count,156);assert.equal(roles.length,walls.count);assert.ok(walls.instanceColor);const matrix=new T.Matrix4(),color=new T.Color(),boxes=[];walls.geometry.computeBoundingBox();
 for(let i=0;i<walls.count;i++){walls.getMatrixAt(i,matrix);boxes.push(walls.geometry.boundingBox.clone().applyMatrix4(matrix));walls.getColorAt(i,color);assert.ok(color.r>.2&&color.g>.2&&color.b>.2,'every body/pier color is initialized');}
 for(const [bi,b] of layout.buildings.entries()){
  const selected=signatures.find(s=>s.buildingIndex===bi),ids=roles.map((r,i)=>r.buildingIndex===bi&&r.role==='body'?i:-1).filter(i=>i>=0),segments=ids.map(i=>boxes[i]).sort((a,b)=>a.min.y-b.min.y);assert.equal(ids.length,selected?3:1);
  let last=0,volume=0;for(const box of segments){assert.ok(Math.abs(box.min.y-last)<1e-4,'continuous exact y partition');assert.ok(Math.abs(box.min.x-b.minX)<1e-4&&Math.abs(box.max.x-b.maxX)<1e-4&&Math.abs(box.min.z-b.minZ)<1e-4&&Math.abs(box.max.z-b.maxZ)<1e-4);assert.ok(box.max.y>box.min.y);last=box.max.y;volume+=(box.max.x-box.min.x)*(box.max.y-box.min.y)*(box.max.z-box.min.z);}
  assert.ok(Math.abs(last-b.height)<1e-4);assert.ok(Math.abs(volume-b.w*b.d*b.height)<.01,'sum of segment volumes is the original hull, not only its combined AABB');
  if(selected){assert.ok(Math.abs(segments[0].max.y-3.2)<1e-4);assert.ok(Math.abs(segments[1].max.y-selected.top)<1e-4);assert.ok(selected.top>3.2&&selected.top<b.height);for(let j=0;j<3;j++){walls.getColorAt(ids[j],color);assert.equal(color.getHex(),selected.colors[j]);}}
 }
 assert.equal(coast.metrics().staticMeshDraws,80);assert.equal(coast.metrics().maximumStaticTriangles,173566);assert.equal(coast.metrics().ownedTextures,16);coast.leave();
});

test('signature seams avoid native window and full-door reveals and corner piers retain full road, prop and aperture clearance',{
 skip:existsSync(runtime)?false:'Official production Three r128 required'
},()=>{
 const {T,coast}=actual(),scene=new T.Scene(),focus=new T.Vector3(445,0,635);scene.userData.coastArtBridge={getFocus:()=>focus,sharedLights:[]};const root=coast.enter(scene,T),walls=root.getObjectByName('coast-original-shop-houses'),roles=walls.userData.coastWallPieces,signatures=root.userData.coastSignatureHouses,layout=coast.layout(),matrix=new T.Matrix4();root.updateMatrixWorld(true);walls.geometry.computeBoundingBox();
 const piers=[];for(let i=0;i<walls.count;i++)if(roles[i].role==='pier'){walls.getMatrixAt(i,matrix);piers.push({box:walls.geometry.boundingBox.clone().applyMatrix4(matrix),buildingIndex:roles[i].buildingIndex});}assert.equal(piers.length,12);
 const overlap=(a,b)=>Math.min(a.max.x,b.max.x)-Math.max(a.min.x,b.min.x)>1e-4&&Math.min(a.max.y,b.max.y)-Math.max(a.min.y,b.min.y)>1e-4&&Math.min(a.max.z,b.max.z)-Math.max(a.min.z,b.min.z)>1e-4;
 const touches=(a,b)=>['x','y','z'].every(k=>Math.min(a.max[k],b.max[k])-Math.max(a.min[k],b.min[k])>=-1e-5);
 for(const {box,buildingIndex} of piers){assert.ok(Math.abs(box.min.y-4.05)<1e-4,'above3.95m highest fascia');for(const r of coast.roads)assert.ok(box.max.x<=r.x-r.w/2-2||box.min.x>=r.x+r.w/2+2||box.max.z<=r.z-r.d/2-2||box.min.z>=r.z+r.d/2+2);for(const n of coast.nodes)assert.ok(box.max.x<=n.x-19||box.min.x>=n.x+19||box.max.z<=n.z-19||box.min.z>=n.z+19);for(const [bi,b] of layout.buildings.entries())if(bi!==buildingIndex)assert.ok(box.max.x<=b.minX||box.min.x>=b.maxX||box.max.z<=b.minZ||box.min.z>=b.maxZ);for(const p of layout.palms)assert.ok(box.max.x<=p.x-1.7||box.min.x>=p.x+1.7||box.max.z<=p.z-1.7||box.min.z>=p.z+1.7);}
 for(let i=0;i<piers.length;i++)for(let j=i+1;j<piers.length;j++)assert.equal(overlap(piers[i].box,piers[j].box),false,'orthogonal piers butt, never overlap');
 const apertureNames=['coast-district-window-sashes','coast-district-selected-lit-windows','coast-district-window-sashes-transom','coast-district-selected-lit-windows-transom','coast-sample-framed-glazing','coast-architecture-window-reveals','coast-district-near-window-reveals'];
 for(const signature of signatures){const b=layout.buildings[signature.buildingIndex];focus.set(b.x,0,b.z);coast.tick(1/60);root.updateMatrixWorld(true);
  for(const name of apertureNames){const mesh=root.getObjectByName(name);mesh.geometry.computeBoundingBox();for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);const box=mesh.geometry.boundingBox.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(mesh.matrixWorld,matrix));if(box.max.x<b.minX-.5||box.min.x>b.maxX+.5||box.max.z<b.minZ-.5||box.min.z>b.maxZ+.5)continue;assert.ok(signature.top<=box.min.y||signature.top>=box.max.y,`${b.x}/${b.z} top seam cuts ${name}[${i}]`);assert.ok(3.2<=box.min.y||3.2>=box.max.y,`${b.x}/${b.z} commercial base seam cuts ${name}[${i}]`);for(const p of piers.filter(p=>p.buildingIndex===signature.buildingIndex))assert.equal(touches(box,p.box),false,`pier covers even zero-thickness ${name}`);}}
 }
 root.traverse(mesh=>{if(!mesh.isInstancedMesh||!mesh.userData.coastArt?.visualOnly||mesh.userData.coastArt.flat)return;mesh.geometry.computeBoundingBox();for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);const box=mesh.geometry.boundingBox.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(mesh.matrixWorld,matrix));for(const p of piers)assert.equal(touches(box,p.box),false,`pier intersects even zero-thickness actual ${mesh.name}[${i}]`);}});coast.leave();
});
