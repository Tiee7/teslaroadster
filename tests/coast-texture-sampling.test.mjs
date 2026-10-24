import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const runtime=process.env.ROADSTER_THREE_RUNTIME||'/tmp/roadster-three.min.js';
const skip=existsSync(runtime)?false:'Official production Three r128 required';
const sha=data=>createHash('sha256').update(data).digest('hex');
const source=read('src/coast-map.js'),baseline=read('tests/fixtures/weather-ground-traffic-baseline/coast-map.js');
function actual(art=source,probe){
 const c=vm.createContext({window:{},console});vm.runInContext(readFileSync(runtime,'utf8'),c);
 vm.runInContext(read('src/coast-road-network.js')+'\n'+art,c);
 const T=c.THREE,scene=new T.Scene();scene.userData.coastArtBridge={getFocus:()=>({x:-64,z:700}),sharedLights:[],...(probe?{getMaxGroundAnisotropy:probe}:{})};
 const coast=c.window.RoadsterCoast,root=coast.enter(scene,T);return {T,coast,root,scene};
}
function signature(root){
 const hashes=[],push=(name,data)=>hashes.push([name,sha(Buffer.from(data.buffer,data.byteOffset,data.byteLength))]);
 root.updateMatrixWorld(true);root.traverse(o=>{
  if(!o.isMesh)return;const p=o.name;
  hashes.push([p,'pose',Array.from(o.matrix.elements),Array.from(o.matrixWorld.elements),o.visible,o.count,o.castShadow,o.receiveShadow]);
  for(const [name,a]of Object.entries(o.geometry.attributes))push(p+':'+name,a.array);
  if(o.geometry.index)push(p+':index',o.geometry.index.array);
  if(o.instanceMatrix)push(p+':instances',o.instanceMatrix.array);
  if(o.instanceColor)push(p+':colors',o.instanceColor.array);
  for(const m of Array.isArray(o.material)?o.material:[o.material]){
   hashes.push([p,'material',m.type,m.color?.toArray(),m.emissive?.toArray(),m.roughness,m.metalness,m.opacity,m.transparent,m.depthTest,m.depthWrite,m.side]);
   for(const key of ['map','normalMap','emissiveMap']){const t=m[key];if(!t)continue;hashes.push([p,key,t.minFilter,t.magFilter,t.wrapS,t.wrapT,t.repeat.toArray(),t.offset.toArray(),t.generateMipmaps]);if(t.image?.data)push(p+':'+key,t.image.data);}
  }
 });return sha(JSON.stringify(hashes));
}

test('coast ground sampler uses one bounded renderer capability query with safe fallbacks',{skip},()=>{
 assert.match(read('src/world.js'),/getMaxGroundAnisotropy: \(\) => renderer\.capabilities\.getMaxAnisotropy\(\)/);
 for(const [maximum,expected]of [[16,8],[8,8],[4,4],[1,1],[0,1],[2.9,2],[NaN,1],[Infinity,1],['throw',1]]){
  let calls=0;const h=actual(source,()=>{calls++;if(maximum==='throw')throw Error('unavailable capability');return maximum;});
  for(const name of ['coast-promenade','coast-street-sidewalks','coast-road-surfaces','coast-pier-boardwalk'])assert.equal(h.root.getObjectByName(name).material.map.anisotropy,expected,name);
  assert.equal(h.root.getObjectByName('coast-water').material.normalMap.anisotropy,1,'do not increase unrelated animated-water sampling');
  for(let i=0;i<120;i++)h.coast.tick(1/60);assert.equal(calls,1,'not a per-frame query');h.coast.leave();
 }
 const h=actual();assert.equal(h.root.getObjectByName('coast-promenade').material.map.anisotropy,1);h.coast.leave();
});

test('grazing-detail correction preserves all original ground pixels, metre UVs, geometry, material and collision layout',{skip},()=>{
 const old=actual(baseline),now=actual(source,()=>16);
 assert.equal(signature(now.root),signature(old.root),'only sampler anisotropy changes; no geometry/UV/tint/material/scale hiding trick');
 assert.equal(JSON.stringify(now.coast.layout()),JSON.stringify(old.coast.layout()));
 const before=old.coast.metrics(),after=now.coast.metrics();for(const key of ['textureBytes','ownedTextures','staticMeshDraws','staticTriangles','ownedGeometryBufferBytes','ownedInstanceBufferBytes'])assert.equal(after[key],before[key],key);
 const texture=now.root.getObjectByName('coast-promenade').material.map,pixels=texture.image.data,version=texture.version,checksum=sha(pixels);
 assert.equal(texture.minFilter,now.T.LinearMipmapLinearFilter);assert.equal(texture.magFilter,now.T.LinearFilter);assert.equal(texture.generateMipmaps,true);
 assert.equal(texture.image.width,128);assert.equal(texture.image.height,128);
 for(let i=0;i<600;i++)now.coast.tick(1/60);now.coast.weather({rain:true});now.coast.weather({daylight:true});
 assert.equal(texture.version,version);assert.equal(texture.image.data,pixels);assert.equal(sha(pixels),checksum);assert.equal(texture.anisotropy,8);
 old.coast.leave();now.coast.leave();
});
