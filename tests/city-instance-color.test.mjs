import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const world=read('src/world.js'),runtime=process.env.ROADSTER_THREE_RUNTIME||'/tmp/roadster-three.min.js';
const skip=!existsSync(runtime)&&'Native Three r128 required';
const current='mesh.setColorAt(i,color.setHex(record.color??0xffffff));';
const previous='if(record.color!==undefined)mesh.setColorAt(i,color.setHex(record.color));';
function layout(source){
 const c=vm.createContext({console});vm.runInContext(readFileSync(runtime,'utf8'),c);vm.runInContext(read('src/config.js'),c);
 vm.runInContext(`const cityEnvGroup=new THREE.Group(),cityBuildings=[];let cityAsphaltMat=null,cityAsphaltEWMat=null;const createWetRoadDetail=()=>({});${source.slice(source.indexOf('function buildOpenWorldCity()'),source.indexOf('buildOpenWorldCity();')+21)};globalThis.api={root:cityEnvGroup,buildings:cityBuildings};`,c);
 return c.api;
}
function cohorts(root){const result=new Map();root.traverse(o=>{if(!o.isInstancedMesh)return;for(const m of(Array.isArray(o.material)?o.material:[o.material])){const list=result.get(m)||[];list.push(o);result.set(m,list);}});return [...result.values()];}
function geometrySignature(root){
 const h=createHash('sha256');root.traverse(o=>{if(!o.isMesh)return;h.update(JSON.stringify({name:o.name,count:o.count,position:o.position.toArray(),rotation:o.rotation.toArray(),scale:o.scale.toArray(),visible:o.visible,castShadow:o.castShadow,receiveShadow:o.receiveShadow}));
 for(const a of [...Object.values(o.geometry.attributes),o.geometry.index,o.instanceMatrix].filter(Boolean))h.update(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength));
 const ms=(Array.isArray(o.material)?o.material:[o.material]);h.update(JSON.stringify(ms.map(m=>({type:m.type,color:m.color?.getHex(),emissive:m.emissive?.getHex(),emissiveIntensity:m.emissiveIntensity,roughness:m.roughness,metalness:m.metalness,side:m.side,opacity:m.opacity,transparent:m.transparent,depthTest:m.depthTest,depthWrite:m.depthWrite,vertexColors:m.vertexColors,cacheKey:m.customProgramCacheKey()}))));
 for(const m of ms)for(const t of[m.map,m.emissiveMap])if(t?.image?.data)h.update(t.image.data);
 });return h.digest('hex');
}
test('city instancing assigns neutral white explicitly rather than mixing absent colour attributes',()=>{
 assert.equal(world.split(current).length,2);assert.doesNotMatch(world.slice(world.indexOf('function cityInstances('),world.indexOf('cityBodies.forEach')),/if\(record\.color!==undefined\)/);
});
test('native production city no longer reuses one r128 material across incompatible instanceColor layouts',{skip},t=>{
 const old=layout(world.replace(current,previous)),fixed=layout(world);
 const mixed=cohorts(old.root).filter(group=>group.some(o=>o.instanceColor)&&group.some(o=>!o.instanceColor));
 assert.equal(mixed.length,2,'retain the real two-material counterexample, not an artificial model');
 for(const family of[0,1]){const building=old.root.getObjectByName(`city-building-batch-${family}`),cornice=old.root.getObjectByName(`city-roof-cornices-${family}`);assert.equal(building.material,cornice.material);assert.ok(building.instanceColor);assert.equal(cornice.instanceColor,null);}
 for(const group of cohorts(fixed.root))assert.equal(new Set(group.map(o=>Boolean(o.instanceColor))).size,1,'a shared material cannot cache a coloured program then receive a null colour buffer');
 t.diagnostic(JSON.stringify({scope:'Native scene/program-input invariant; separate native r128 + Mesa capture proves render exception',previousMixedSharedMaterials:mixed.length,currentMixedSharedMaterials:0}));
});
test('neutral instance buffers preserve all original tint values, asset geometry, materials, matrices and collision bounds',{skip},t=>{
 const old=layout(world.replace(current,previous)),fixed=layout(world);assert.equal(geometrySignature(fixed.root),geometrySignature(old.root));assert.equal(JSON.stringify(fixed.buildings),JSON.stringify(old.buildings));
 let addedBytes=0,neutralInstances=0;old.root.traverse(before=>{if(!before.isInstancedMesh||!before.name.startsWith('city-'))return;const after=fixed.root.getObjectByName(before.name);assert.ok(after);if(before.instanceColor){assert.deepEqual(Array.from(after.instanceColor.array),Array.from(before.instanceColor.array),'original palette tint bytes remain unchanged');}else if(after.instanceColor){for(const channel of after.instanceColor.array)assert.equal(channel,1,'white multiplies the unchanged material by exactly one');neutralInstances+=after.count;addedBytes+=after.instanceColor.array.byteLength;}});
 assert.ok(addedBytes>0&&addedBytes<100000);t.diagnostic(JSON.stringify({scope:'static initialization only, no extra per-frame upload or draw',neutralInstances,addedInstanceColorBytes:addedBytes,unchangedGeometryMaterialTransformSha256:geometrySignature(fixed.root)}));
});
