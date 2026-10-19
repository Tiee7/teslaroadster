/**
 * CPU-only, official Three.js r128 verification of lossless wheel batching.
 * node verification/reference-wheel-batching-runtime-check.cjs /path/to/three.min.js [result.json]
 * The independent baseline runs the exact same source with only the batching
 * invocation disabled. This does not use the simplified scene-graph fixture.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const runtimePath = process.argv[2];
if (!runtimePath) throw Error('Supply the official production Three.js r128 runtime.');
const runtime = fs.readFileSync(runtimePath, 'utf8');
const sourceFiles = ['world.js','highway-traffic.js','vehicles.js','reference-exterior.js','reference-cockpit.js','npc-traffic-assets.js','reference-traffic.js'];
// Read once so concurrent work on unrelated source cannot change the baseline.
const sources = Object.fromEntries(sourceFiles.map(file => [file,fs.readFileSync(path.join(root,'src',file),'utf8')]));
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const invocation = '    batchReferenceWheel(group,i);';
assert.equal(sources['reference-cockpit.js'].split(invocation).length,2,'Exactly one wheel batching invocation must exist.');
function load(batched) {
  const context = vm.createContext({console,Math,Float32Array,Uint16Array,Uint32Array,atob:text=>Buffer.from(text,'base64').toString('binary'),
    Event:class {constructor(type){this.type=type;}},
    window:{innerWidth:1440,innerHeight:900,addEventListener(){},dispatchEvent(){}},
    localStorage:{getItem(){return null;},setItem(){}},
    document:{createElement(){return {width:0,height:0,getContext(){return {};}};}}});
  vm.runInContext(runtime,context,{filename:path.basename(runtimePath)});
  assert.equal(context.THREE.REVISION,'128','Use the actual production runtime, not a geometry stub.');
  const world = sources['world.js'], start = world.indexOf('const bodyMaterial ='),end = world.indexOf('const highwayEnvGroup',start);
  assert.ok(start>=0&&end>start);
  vm.runInContext(`const scene=new THREE.Scene();const currentMap='highway';const WORLD_SPEED_SCALE=${Number(fs.readFileSync(path.join(root,'src/config.js'),'utf8').match(/const WORLD_SPEED_SCALE = ([\d.]+)/)[1])};${world.slice(start,end)}`,context);
  for (const file of sourceFiles.slice(1)) vm.runInContext(file==='reference-cockpit.js'&&!batched ? sources[file].replace(invocation,'    // Independent unbatched verification baseline.') : sources[file],context,{filename:file});
  vm.runInContext('this.parts={scene,carMeshGroup,wheels,frontWheelSteerGroups,setCockpitPerspective,setCockpitExteriorDetailsVisible};',context);
  const api = context.window.RoadsterVehicle;
  api.setModel('reference');api.setCockpit('reference');
  context.parts.setCockpitPerspective(false);context.parts.setCockpitExteriorDetailsVisible(true);
  return context;
}
const before = load(false), after = load(true);
const visible = object => {for(let p=object;p;p=p.parent)if(!p.visible)return false;return true;};
const wheelGroup = (context,index) => context.parts.wheels[index].getObjectByName(`reference-wheel-${index}`);
function materialKey(material) {
  if(Array.isArray(material))return JSON.stringify(material.map(materialKey));
  const properties = material.toJSON();delete properties.uuid;delete properties.metadata;
  // Non-wheel classic materials also include runtime texture/image IDs. Their
  // serialized properties are retained; only randomly assigned IDs are erased.
  const normalize = value => {
    if(Array.isArray(value))return value.map(normalize);
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>key!=='uuid'&&key!=='metadata').map(([key,v])=>[key,normalize(v)]));
    return typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)?'<runtime-uuid>':value;
  };
  return JSON.stringify(normalize(properties));
}
function triangleFingerprint(triangles) {
  // Preserve winding, while ignoring mesh order, triangle order, UUIDs and the
  // arbitrary choice of the first vertex in an oriented triangle.
  const records = triangles.map(triangle => {
    const vertices = triangle.map(vertex=>JSON.stringify(vertex));
    return [vertices.join('|'),[vertices[1],vertices[2],vertices[0]].join('|'),[vertices[2],vertices[0],vertices[1]].join('|')].sort()[0];
  }).sort();
  return sha(JSON.stringify(records));
}
function captureWheel(context,index,packSourceIntoFloat32) {
  const T = context.THREE, group = wheelGroup(context,index), materials = new Map();
  group.traverse(part => {
    if(!part.isMesh)return;
    assert.ok(!Array.isArray(part.material),'Each batch must use one unchanged material and one draw.');
    if(part.userData.referenceWheelBatch)assert.equal(part.geometry.groups.length,0,'A batch must not expand into material groups.');
    const key = materialKey(part.material),bucket=materials.get(key)||{triangles:[],meshes:0,vertices:0};
    materials.set(key,bucket);bucket.meshes++;
    const g=part.geometry,p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,idx=g.index?.array;
    bucket.vertices+=p.count;
    assert.equal(part.parent,group);
    const local = part.matrix;
    // The builder's child poses are translations only. Check that premise so
    // source normals can remain bit-identical rather than being recomputed.
    assert.equal(part.rotation.x,0);assert.equal(part.rotation.y,0);assert.equal(part.rotation.z,0);
    assert.deepEqual(Array.from(part.scale.toArray()),[1,1,1]);
    const normalMatrix = new T.Matrix3().getNormalMatrix(part.matrixWorld);
    for(let j=0;j<(idx?.length??p.count);j+=3){
      const triangle=[];
      for(let c=0;c<3;c++){
        const vi=idx?idx[j+c]:j+c,position=new T.Vector3().fromBufferAttribute(p,vi);
        if(packSourceIntoFloat32){
          // One unavoidable storage conversion occurs when baking a translated
          // source into a GPU Float32 position buffer. There is no coarser
          // epsilon rounding in the fingerprints.
          position.applyMatrix4(local);
          position.set(Math.fround(position.x),Math.fround(position.y),Math.fround(position.z));
          position.applyMatrix4(group.matrixWorld);
        }else position.applyMatrix4(part.matrixWorld);
        const normal=new T.Vector3().fromBufferAttribute(n,vi).applyNormalMatrix(normalMatrix);
        triangle.push([...position.toArray(),...normal.toArray(),uv?uv.getX(vi):0,uv?uv.getY(vi):0,n.getX(vi),n.getY(vi),n.getZ(vi)]);
      }
      bucket.triangles.push(triangle);
    }
  });
  return materials;
}
function allVisible(context,excludeReferenceWheels=false){
  const result=[];
  context.parts.carMeshGroup.traverse(part=>{
    if(!part.isMesh||!visible(part))return;
    if(excludeReferenceWheels){for(let p=part;p;p=p.parent)if(/^reference-wheel-\d$/.test(p.name))return;}
    const attrs=Object.fromEntries(Object.entries(part.geometry.attributes).map(([key,value])=>[key,Array.from(value.array)]));
    result.push({name:part.name,attrs,index:part.geometry.index&&Array.from(part.geometry.index.array),matrix:part.matrixWorld.toArray(),material:materialKey(part.material),castShadow:part.castShadow,receiveShadow:part.receiveShadow});
  });
  return result;
}
const poses = [
  {name:'neutral',spin:[0,0,0,0],steer:[0,0],carPosition:[0,0,0],carRotation:[0,0,0]},
  {name:'spinning-steering',spin:[.63,-1.19,2.73,-.48],steer:[-.31,.27],carPosition:[0,0,0],carRotation:[0,0,0]},
  {name:'moving-car',spin:[3.21,1.57,-2.03,4.78],steer:[.42,-.36],carPosition:[2.7,.18,-4.6],carRotation:[.08,.71,-.03]}
];
const output={generatedAt:new Date().toISOString(),pass:false,runtimeRevision:'128',runtimeSha256:sha(runtime),sources:Object.fromEntries(sourceFiles.map(file=>[file,sha(sources[file])])),
  baseline:'Same production sources with only batchReferenceWheel(group,i) disabled.',
  limits:'CPU verification of real r128 geometry, material properties, hierarchy and world-space oriented triangles. Mesh counts are single-material pre-culling draw submissions, not measured GPU frame time or browser FPS.',
  fingerprintConvention:'Every oriented triangle, world-space vertex normal, original stored vertex normal and applicable UV, sorted independent of mesh order and UUID. The baseline position is baked once into Float32 wheel-group coordinates, exactly matching GPU buffer storage; no epsilon quantization is used. Raw pre-bake world positions are separately compared and maximum storage error is reported.',
  maximumRawWorldPositionErrorMetres:0,maximumRawWorldNormalError:0,maximumUvError:0,poses:[],preservedClassicConfigurations:[]};
for(const pose of poses){
  for(const context of [before,after]){
    const p=context.parts;p.carMeshGroup.position.set(...pose.carPosition);p.carMeshGroup.rotation.set(...pose.carRotation);
    p.wheels.forEach((wheel,i)=>{wheel.rotation.x=pose.spin[i];});
    p.frontWheelSteerGroups.forEach((pivot,i)=>{pivot.rotation.y=pose.steer[i];});
    p.scene.updateMatrixWorld(true);
  }
  assert.equal(sha(JSON.stringify(allVisible(before,true))),sha(JSON.stringify(allVisible(after,true))),'Non-wheel visible scene changed.');
  const wheels=[];
  for(let i=0;i<4;i++){
    const sourceGroup=wheelGroup(before,i),batchGroup=wheelGroup(after,i);
    assert.equal(sourceGroup.parent,before.parts.wheels[i]);assert.equal(batchGroup.parent,after.parts.wheels[i]);
    assert.equal(before.parts.wheels[i].parent.name,after.parts.wheels[i].parent.name);
    assert.deepEqual(Array.from(sourceGroup.matrixWorld.toArray()),Array.from(batchGroup.matrixWorld.toArray()));
    assert.ok(batchGroup.getObjectByName(`reference-rounded-tire-${i}`),'Stable tire handle missing.');
    assert.equal(sourceGroup.children.length,37);assert.equal(batchGroup.children.length,4);
    const packed=captureWheel(before,i,true),raw=captureWheel(before,i,false),batched=captureWheel(after,i,false),materials=[];
    assert.equal(packed.size,4);assert.equal(batched.size,4);
    for(const [key,expected] of packed){
      const actual=batched.get(key),original=raw.get(key);assert.ok(actual,'Material properties changed.');
      assert.equal(actual.meshes,1);assert.equal(actual.vertices,expected.vertices);
      assert.equal(actual.triangles.length,expected.triangles.length,'Triangle added, removed or welded.');
      const beforeFingerprint=triangleFingerprint(expected.triangles),afterFingerprint=triangleFingerprint(actual.triangles);
      assert.equal(beforeFingerprint,afterFingerprint,'Oriented triangles, normals, UVs or material association changed beyond the sole Float32 storage conversion.');
      for(let t=0;t<original.triangles.length;t++)for(let c=0;c<3;c++){
        const a=original.triangles[t][c],b=actual.triangles[t][c];
        output.maximumRawWorldPositionErrorMetres=Math.max(output.maximumRawWorldPositionErrorMetres,Math.hypot(...a.slice(0,3).map((v,k)=>v-b[k])));
        output.maximumRawWorldNormalError=Math.max(output.maximumRawWorldNormalError,...a.slice(3,6).map((v,k)=>Math.abs(v-b[k+3])));
        output.maximumUvError=Math.max(output.maximumUvError,...a.slice(6,8).map((v,k)=>Math.abs(v-b[k+6])));
      }
      materials.push({color:JSON.parse(key).color,sourceMeshes:expected.meshes,batchMeshes:actual.meshes,vertices:actual.vertices,triangles:actual.triangles.length,beforeFingerprint,afterFingerprint});
    }
    wheels.push({wheel:i,beforeMeshes:37,afterMeshes:4,materials});
  }
  output.poses.push({name:pose.name,wheels});
}
assert.ok(output.maximumRawWorldPositionErrorMetres<1e-8,'Unexpected position change beyond Float32 baking precision.');
assert.ok(output.maximumRawWorldNormalError<1e-14,'Source vertex normal changed.');
assert.equal(output.maximumUvError,0,'Source UV changed.');
for(const cockpit of ['reference','classic'])for(const fpv of [false,true]){
  for(const context of [before,after]){
    const api=context.window.RoadsterVehicle;api.setModel('classic');api.setCockpit(cockpit);
    context.parts.setCockpitPerspective(fpv);context.parts.setCockpitExteriorDetailsVisible(!fpv);context.parts.scene.updateMatrixWorld(true);
  }
  const originalHash=sha(JSON.stringify(allVisible(before))),batchedHash=sha(JSON.stringify(allVisible(after)));
  assert.equal(originalHash,batchedHash,'Classic visible mesh geometry, material, pose or shadow flags changed.');
  output.preservedClassicConfigurations.push({cockpit,fpv,fingerprint:originalHash});
}
for(const context of [before,after]){
  const api=context.window.RoadsterVehicle;
  for(const model of ['reference','classic','reference']){
    api.setModel(model);
    for(let i=0;i<4;i++)assert.equal(visible(wheelGroup(context,i)),model==='reference');
  }
}
function opaquePreviewCount(context){
  const preview=context.window.RoadsterVehicle.getPreviewModel();let meshes=0,triangles=0;
  preview.traverse(part=>{
    if(!part.isMesh||!visible(part))return;
    const materials=Array.isArray(part.material)?part.material:[part.material];
    if(part.userData.shadowProxy||materials.every(m=>m.colorWrite===false)||materials.every(m=>m.transparent||m.opacity<.99))return;
    meshes++;triangles+=(part.geometry.index?.count??part.geometry.attributes.position.count)/3;
  });
  return {meshes,triangles};
}
output.opaqueNeutralPreviewBefore=opaquePreviewCount(before);output.opaqueNeutralPreviewAfter=opaquePreviewCount(after);
assert.equal(output.opaqueNeutralPreviewBefore.meshes-output.opaqueNeutralPreviewAfter.meshes,132);
assert.equal(output.opaqueNeutralPreviewBefore.triangles,output.opaqueNeutralPreviewAfter.triangles);
output.pass=true;output.beforeWheelMeshes=148;output.afterWheelMeshes=16;
output.wheelMeshReduction=132;output.wheelMeshReductionPercent=100*132/148;
output.totalWheelTriangles=output.poses[0].wheels.reduce((sum,wheel)=>sum+wheel.materials.reduce((s,m)=>s+m.triangles,0),0);
if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({pass:output.pass,beforeWheelMeshes:148,afterWheelMeshes:16,totalWheelTriangles:output.totalWheelTriangles,poses:poses.map(p=>p.name),maximumRawWorldPositionErrorMetres:output.maximumRawWorldPositionErrorMetres,maximumRawWorldNormalError:output.maximumRawWorldNormalError,maximumUvError:output.maximumUvError,classicConfigurations:output.preservedClassicConfigurations.length,opaqueNeutralPreviewBefore:output.opaqueNeutralPreviewBefore,opaqueNeutralPreviewAfter:output.opaqueNeutralPreviewAfter,fingerprintConvention:output.fingerprintConvention,limits:output.limits},null,2));
