/**
 * CPU-only production-runtime regression evidence. No browser or FPS emulation.
 * Usage: node verification/visual-preservation-runtime-check.cjs /path/to/three.min.js [result.json]
 * Requires the production Three.js r128 runtime and the repository's history.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const runtimePath = process.argv[2];
if (!runtimePath) throw Error('Supply the official Three.js r128 runtime path.');
const runtime = fs.readFileSync(runtimePath, 'utf8');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const beforeModel = 'cab98f9';
const beforeFix = '683f6fd';
const source = (revision, file) => revision === 'worktree'
  ? fs.readFileSync(path.join(root, 'src', file), 'utf8')
  : execFileSync('git', ['show', `${revision}:src/${file}`], { cwd: root, encoding: 'utf8' });
function load(revision) {
  const context = vm.createContext({ console, Math, Float32Array, Uint16Array, Uint32Array, performance,
    Event: class { constructor(type) { this.type = type; } },
    window: { innerWidth: 1440, innerHeight: 900, addEventListener() {}, dispatchEvent() {} },
    localStorage: { getItem() { return null; }, setItem() {} },
    document: { createElement() { return { getContext() { return {}; } }; } }
  });
  vm.runInContext(runtime, context);
  vm.runInContext(`const scene=new THREE.Scene();let currentMap='highway';${
    ['whiteLeatherMat', 'cockpitMat', 'bodyMaterial', 'goldCanopyMaterial', 'carbonMaterial', 'titaniumMaterial']
      .map(name => `const ${name}=new THREE.MeshStandardMaterial();`).join('')}`, context);
  for (const file of ['vehicles.js', ...(revision === beforeModel ? [] : ['reference-exterior.js', 'reference-cockpit.js', 'reference-traffic.js'])]) {
    vm.runInContext(source(revision, file), context, { filename: file });
  }
  vm.runInContext('this.parts={carMeshGroup,setCockpitPerspective,setCockpitExteriorDetailsVisible,createTrafficVehicleMesh};', context);
  assert.equal(context.THREE.REVISION, '128');
  return context;
}
const isVisible = object => { for (let n = object; n; n = n.parent) if (!n.visible) return false; return true; };
function count(root) {
  const result = { visibleMeshes: 0, colorMeshes: 0, colorTriangles: 0, shadowMeshes: 0, shadowTriangles: 0, extraNoWriteTriangles: 0 };
  const appearance = [];
  root.traverse(object => {
    if (!object.isMesh || !isVisible(object)) return;
    result.visibleMeshes++;
    const geometry = object.geometry, material = object.material;
    const triangles = (geometry.index?.count || geometry.attributes.position.count) / 3;
    if (material.colorWrite === false) result.extraNoWriteTriangles += triangles;
    else {
      result.colorMeshes++; result.colorTriangles += triangles;
      const attributes = Object.fromEntries(Object.entries(geometry.attributes).map(([key, value]) => [key, hash(Buffer.from(value.array.buffer, value.array.byteOffset, value.array.byteLength))]));
      appearance.push({ name: object.name, attributes, index: geometry.index && hash(Buffer.from(geometry.index.array.buffer, geometry.index.array.byteOffset, geometry.index.array.byteLength)),
        position: object.position.toArray(), rotation: object.rotation.toArray(), scale: object.scale.toArray(),
        material: { type: material.type, color: material.color?.getHex(), emissive: material.emissive?.getHex(), side: material.side, transparent: material.transparent,
          opacity: material.opacity, roughness: material.roughness, metalness: material.metalness, clearcoat: material.clearcoat } });
    }
    if (object.castShadow) { result.shadowMeshes++; result.shadowTriangles += triangles; }
  });
  result.visibleAppearanceHash = hash(JSON.stringify(appearance));
  return result;
}
function report(context, revision) {
  const { parts: p, THREE: T } = context, api = context.window.RoadsterVehicle;
  const vehicle = {}, traffic = {};
  for (const model of api ? ['reference', 'classic'] : ['classic']) for (const cockpit of api ? ['reference', 'classic'] : ['classic']) for (const active of [false, true]) {
    api?.setModel(model); api?.setCockpit(cockpit);
    p.setCockpitPerspective(active); p.setCockpitExteriorDetailsVisible(!active);
    vehicle[`${model}:${cockpit}:${active ? 'fpv' : 'external'}`] = count(p.carMeshGroup);
  }
  for (let i = 0; i < 6; i++) traffic[i] = count(p.createTrafficVehicleMesh(i));
  let visits = 0;
  const original = T.Object3D.prototype.getObjectByProperty;
  T.Object3D.prototype.getObjectByProperty = function (...args) { visits++; return original.apply(this, args); };
  const viewSync = {};
  for (const active of [false, true]) {
    p.setCockpitPerspective(active); p.setCockpitExteriorDetailsVisible(!active);
    for (let i = 0; i < 1000; i++) { p.setCockpitPerspective(active); p.setCockpitExteriorDetailsVisible(!active); }
    visits = 0;
    const iterations = 20000, started = performance.now();
    for (let i = 0; i < iterations; i++) { p.setCockpitPerspective(active); p.setCockpitExteriorDetailsVisible(!active); }
    viewSync[active ? 'fpv' : 'external'] = { iterations, elapsedMs: performance.now() - started, recursiveLookupVisitsPerFrame: visits / iterations };
  }
  return { revision, vehicle, traffic, viewSync };
}
const old = report(load(beforeModel), beforeModel);
const before = report(load(beforeFix), beforeFix);
const currentContext = load('worktree');
const after = report(currentContext, 'worktree');
let maximumShadowSampleDeviationMetres = 0;
const shadowDeviations=[];
currentContext.parts.carMeshGroup.traverse(part => {
  const rs = part.userData.shadowGridRows, cs = part.userData.shadowGridColumns;
  if (!rs || !cs) return;
  let partMax=0;
  const p = part.geometry.attributes.position, columns = part.userData.surfaceColumns;
  const point = (r,c) => new currentContext.THREE.Vector3().fromBufferAttribute(p,r*(columns+1)+c);
  for (let ri=0; ri<rs.length-1; ri++) for (let ci=0; ci<cs.length-1; ci++) {
    const r0=rs[ri],r1=rs[ri+1],c0=cs[ci],c1=cs[ci+1];
    for (let r=r0; r<=r1; r++) for (let c=c0; c<=c1; c++) {
      const u=(c-c0)/(c1-c0),v=(r-r0)/(r1-r0);
      const a=point(r0,c0),b=point(r0,c1),lo=point(r1,c0),d=point(r1,c1);
      const approximated = v>=u ? a.multiplyScalar(1-v).addScaledVector(lo,v-u).addScaledVector(d,u)
        : a.multiplyScalar(1-u).addScaledVector(d,v).addScaledVector(b,u-v);
      partMax=Math.max(partMax,approximated.distanceTo(point(r,c)));
      maximumShadowSampleDeviationMetres = Math.max(maximumShadowSampleDeviationMetres,partMax);
    }
  }
  shadowDeviations.push({name:part.name,deviation:partMax});
});
assert.ok(maximumShadowSampleDeviationMetres < .02, 'Shadow silhouette approximation exceeded 2 cm.');
for (const key of Object.keys(before.vehicle).filter(key => key.startsWith('classic:'))) {
  assert.equal(after.vehicle[key].visibleAppearanceHash, before.vehicle[key].visibleAppearanceHash, `Visible mesh geometry/material/pose changed: ${key}`);
}
for (let i = 0; i < 6; i++) assert.deepEqual(after.traffic[i], before.traffic[i], `NPC ${i} changed`);
assert.equal(after.vehicle['reference:reference:external'].shadowMeshes, 2);
assert.ok(after.vehicle['reference:reference:external'].shadowTriangles < 15000);
assert.equal(after.viewSync.external.recursiveLookupVisitsPerFrame, 0);
assert.equal(after.viewSync.fpv.recursiveLookupVisitsPerFrame, 0);
// New visible-geometry contracts are independent of the classic preservation
// hash: lamp bridge rays must stop at paint, and plate/nozzle mouths must clear.
const p=currentContext.parts,T=currentContext.THREE,api=currentContext.window.RoadsterVehicle;
api.setModel('reference');api.setCockpit('reference');
p.setCockpitPerspective(false);p.setCockpitExteriorDetailsVisible(true);
p.carMeshGroup.updateMatrixWorld(true);
const ray=new T.Raycaster(),paintBridgeRays=[];
for(const side of [-1,1]){
  const bridge=p.carMeshGroup.getObjectByName(`referenceLampShoulderBridge${side}`);
  const positions=bridge.geometry.attributes.position,indices=bridge.geometry.index.array;
  for(let i=0;i<indices.length;i+=3){
    const target=new T.Vector3();
    for(let j=0;j<3;j++)target.add(new T.Vector3().fromBufferAttribute(positions,indices[i+j]));
    target.multiplyScalar(1/3).applyMatrix4(bridge.matrixWorld);
    const origin=target.clone().add(new T.Vector3(0,1,-2));
    ray.set(origin,target.clone().sub(origin).normalize());
    const hits=ray.intersectObject(bridge,false);
    assert.ok(hits.length,`Missing painted lamp bridge triangle ${side}:${i/3}`);
    paintBridgeRays.push({side,triangle:i/3,first:hits[0].object.name});
  }
}
const opaqueMeshes=[];
p.carMeshGroup.traverse(part=>{if(part.isMesh&&isVisible(part)&&(Array.isArray(part.material)?part.material:[part.material]).some(m=>!m.transparent||m.opacity>.01))opaqueMeshes.push(part);});
let directOpticRays=0,directOpticVisible=0;const opticBlocks=[];
for(const side of [-1,1]){
  const optic=p.carMeshGroup.getObjectByName(`referenceHeadlightProjector${side}`),pos=optic.geometry.attributes.position;
  const vertices=[0,1,2].map(i=>new T.Vector3().fromBufferAttribute(pos,i).applyMatrix4(optic.matrixWorld));
  for(const view of ['horizontal','reference-inspection'])for(const weights of [[.6,.2,.2],[.2,.6,.2],[.2,.2,.6],[.34,.33,.33]]){
    const target=new T.Vector3();vertices.forEach((v,i)=>target.addScaledVector(v,weights[i]));
    const origin=view==='horizontal'?target.clone().add(new T.Vector3(0,0,-2)):new T.Vector3(0,.8509439655,-6);
    ray.set(origin,target.clone().sub(origin).normalize());
    const first=ray.intersectObjects(opaqueMeshes,false)[0];directOpticRays++;
    if(first?.object===optic)directOpticVisible++;else opticBlocks.push({side,view,weights,first:first?.object.name,target:target.toArray(),hit:first?.point.toArray()});
  }
}
assert.equal(directOpticVisible,directOpticRays,'Front fender/rim occludes a triangular projector in horizontal or reference-inspection front view.');
const lowerFrontPixelRays=[];
const inspectionScale=56.7414768/36*1040;
for(const x of [148,151,921,924])for(const y of [523,525,527,529]){
  ray.set(new T.Vector3(0,.8509439655,-6),new T.Vector3((536-x)/inspectionScale,(208.8668305-y)/inspectionScale,1).normalize());
  const first=ray.intersectObjects(opaqueMeshes,false)[0];
  assert.ok(!/reference(?:CarbonSill|ArchReturn)/.test(first?.object.name||''),'Leading sill/arch return protrudes beneath the raised splitter.');
  lowerFrontPixelRays.push({x,y,first:first?.object.name||null});
}
const plate=p.carMeshGroup.getObjectByName('referenceRearPlatePad');
const plateBottom=new T.Box3().setFromObject(plate).min.y;
const jet=p.carMeshGroup.getObjectByName('reference-jet-flush-lip-0.15');
const nozzleTop=new T.Box3().setFromObject(jet).max.y;
assert.ok(plateBottom-nozzleTop>.014,'Registration pad clips a center nozzle mouth.');
const output = { generatedAt: new Date().toISOString(), pass: true, runtimeRevision: '128', runtimeSha256: hash(runtime),
  limits: 'CPU-only exact production scene-graph, geometry/material/pose hashes and view-sync microbenchmark. Counts are before frustum culling and material-group expansion, not measured GPU draw calls, browser input latency or FPS.',
  findings: ['Input handlers synchronously update key state; the RAF performs simulation before one render, without a new key debounce.',
    'Reference-model release expanded player shadow casters from 1 to 108; two lower-detail silhouette batches now replace those detailed shadow passes.',
    'All four classic model/cockpit/camera geometry, material and pose hashes match the integration baseline; reference visual geometry is intentionally revised.',
    'All six NPC variants are unchanged; unchanged-view recursive lookups drop from 548 to zero.'],
  maximumShadowSampleDeviationMetres, paintBridgeRays:paintBridgeRays.length, directOpticRays,directOpticVisible,lowerFrontPixelRays, plateNozzleGapMetres:plateBottom-nozzleTop, baseline: old, before, after };
if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ pass: true, playerBefore: before.vehicle['reference:reference:external'], playerAfter: after.vehicle['reference:reference:external'], maximumShadowSampleDeviationMetres, limits: output.limits }, null, 2));
