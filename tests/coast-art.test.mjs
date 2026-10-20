import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
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
 const m=coast.metrics();assert.equal(m.ownedTextures,14);assert.ok(m.textureBytes<=4*1024*1024);assert.ok(m.staticMeshDraws<=coast.artBudget.staticMeshDraws);assert.ok(m.maximumStaticTriangles<=coast.artBudget.staticTriangles);
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
  assert.equal(t.size,14);coast.tick(1/30);coast.weather({rain:true});coast.leave();coast.leave();
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
 assert.equal(root.getObjectByName('coast-promenade-lamp-globes').count,99);
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
 assert.equal(root.getObjectByName('coast-dark-window-bands'),undefined);assert.equal(root.getObjectByName('coast-original-shop-houses').count,132);assert.equal(meta.entryCount,129);
 const windows=[root.getObjectByName('coast-district-window-sashes'),root.getObjectByName('coast-district-selected-lit-windows')],pool=root.getObjectByName('coast-district-near-window-reveals');
 assert.equal(windows[0].count+windows[1].count,meta.windowCount);assert.ok(meta.windowCount>17000&&meta.windowCount<19000);
 const matrix=new T.Matrix4(),point=new T.Vector3(),normal=new T.Vector3(),coverage=new Map();
 for(const mesh of windows)for(let i=0;i<mesh.count;i++){
  mesh.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);normal.set(1,0,0).transformDirection(matrix);
  const bi=coast.layout().buildings.findIndex(b=>point.y<b.height&&point.x>=b.minX-.07&&point.x<=b.maxX+.07&&point.z>=b.minZ-.07&&point.z<=b.maxZ+.07);
  assert.ok(bi>=0);const b=coast.layout().buildings[bi];assert.ok(normal.dot(point.clone().sub(new T.Vector3(b.x,point.y,b.z)))>0,'front faces are not culled toward their own solid wall');
  const face=Math.abs(normal.x)>.9?(normal.x<0?'west':'east'):(normal.z<0?'north':'south');if(!coverage.has(bi))coverage.set(bi,new Set());coverage.get(bi).add(face);
 }
 assert.equal(coverage.size,129);for(const faces of coverage.values())assert.equal(faces.size,4);
 assert.equal(windows[1].material.emissiveMap.image.width,64);assert.equal(windows[0].material.map,windows[1].material.map);
 const mask=windows[1].material.emissiveMap.image.data;assert.equal(mask[(20*64+7)*4],0);assert.ok(mask[(20*64+8)*4]>0);assert.ok(mask[(20*64+55)*4]>0);assert.equal(mask[(20*64+56)*4],0);
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
 const {T,coast}=actual(),root=coast.enter(new T.Scene(),T),plants=root.getObjectByName('coast-boulevard-low-planting');assert.equal(plants.count,192);assert.equal(root.getObjectByName('coast-promenade-lamp-globes').count,99);assert.equal(coast.metrics().ownedLights,2);
 const matrix=new T.Matrix4(),box=new T.Box3();plants.geometry.computeBoundingBox();for(let i=0;i<plants.count;i++){plants.getMatrixAt(i,matrix);box.copy(plants.geometry.boundingBox).applyMatrix4(matrix);assert.ok(box.max.x<=-87||box.min.x>=-53,'unchanged30m road plus2m shoulder');assert.ok((box.max.x<=-95||box.min.x>=-89.5)&&(box.max.x<=-50.5||box.min.x>=-45),'preserved inner sidewalk band');}
 const maximum=coast.metrics().maximumStaticTriangles;coast.weather({rain:true});assert.equal(coast.metrics().maximumStaticTriangles,maximum);coast.leave();
});

test('boulevard calibration is flat paint only, retains full body clearance and leaves all intersections plus pier access unpainted',{
 skip:existsSync(runtime)?false:'Official production Three r128 required'
},()=>{
 const {T,coast}=actual(),root=coast.enter(new T.Scene(),T),matrix=new T.Matrix4(),point=new T.Vector3(),bounds=new T.Box3(),gaps=[...[-850,-300,300,850].map(z=>[z-34,z+34]),[-680,-620]],edges=[];
 const checkBounds=box=>{assert.ok(box.min.x>=-84.75-1e-4&&box.max.x<=-55.25+1e-4,'paint stays inside the unchanged30m boulevard');assert.ok(box.min.y>.025&&box.max.y<.026,'no raised divider/curb/obstacle');for(const [lo,hi] of gaps)assert.ok(box.max.z<=lo+1e-4||box.min.z>=hi-1e-4,'turning, zebra and pier entrances stay blank');};
 for(const name of ['coast-boulevard-painted-cycle-lanes','coast-boulevard-white-road-paint','coast-boulevard-ochre-road-paint','coast-boulevard-cycle-stencil-wheels']){
  const mesh=root.getObjectByName(name);assert.ok(mesh.userData.coastArt.flat);assert.equal(mesh.castShadow,false);assert.equal(mesh.material.depthWrite,false);assert.equal(mesh.material.polygonOffset,true);const p=mesh.geometry.attributes.position;
  if(mesh.isInstancedMesh)for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);bounds.makeEmpty();for(let k=0;k<p.count;k++)bounds.expandByPoint(point.fromBufferAttribute(p,k).applyMatrix4(matrix));checkBounds(bounds);if(name.includes('white')&&Math.abs(matrix.elements[10])>100)edges.push(matrix.elements[12]+70);}
  else for(let i=0;i<p.count;i+=4){bounds.makeEmpty();for(let k=0;k<4;k++)bounds.expandByPoint(point.fromBufferAttribute(p,i+k));checkBounds(bounds);}
 }
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
